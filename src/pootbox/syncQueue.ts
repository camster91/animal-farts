import { getOrCreateDeviceId } from "./lib/deviceId.js";

const DB_NAME = "pootbox";
const DB_VERSION = 3;
const SYNC_STORE = "sync-operations";
const BASE_RETRY_MS = 2_000;
const MAX_RETRY_MS = 5 * 60_000;
const SERVER_RECORDING_IDS_KEY = "pootbox-server-recording-ids-v1";

export type SyncStatus = "pending" | "syncing" | "failed";

interface SyncOperationBase {
  id: string;
  bubbleId: string;
  createdAt: number;
  attempts: number;
  nextAttemptAt: number;
  status: SyncStatus;
  lastError?: string;
}

export interface UploadSyncOperation extends SyncOperationBase {
  kind: "upload";
  blob: Blob;
  name: string;
  emoji: string;
  durationSec?: number;
}

export interface DeleteSyncOperation extends SyncOperationBase {
  kind: "delete";
  serverRecordingId?: number;
}

export type RecordingSyncOperation = UploadSyncOperation | DeleteSyncOperation;

export interface UploadSyncResult {
  id: number;
  audioUrl: string;
  name: string;
  emoji: string;
  durationSec: number | null;
}

export interface SyncQueueCallbacks {
  onStatus?: (bubbleId: string, status: SyncStatus | "synced" | "deleted", message?: string) => void;
  onUploadComplete?: (bubbleId: string, result: UploadSyncResult) => void;
  onDeleteComplete?: (bubbleId: string) => void;
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains("blobs")) db.createObjectStore("blobs");
      if (!db.objectStoreNames.contains("pages")) db.createObjectStore("pages");
      if (!db.objectStoreNames.contains(SYNC_STORE)) {
        db.createObjectStore(SYNC_STORE, { keyPath: "id" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function withStore<T>(
  mode: IDBTransactionMode,
  run: (store: IDBObjectStore, resolve: (value: T) => void, reject: (reason?: unknown) => void) => void,
): Promise<T> {
  const db = await openDB();
  try {
    return await new Promise<T>((resolve, reject) => {
      const tx = db.transaction(SYNC_STORE, mode);
      run(tx.objectStore(SYNC_STORE), resolve, reject);
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
}

export function createOperationId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `op-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function retryDelayMs(attempts: number): number {
  return Math.min(MAX_RETRY_MS, BASE_RETRY_MS * 2 ** Math.max(0, attempts - 1));
}

export function isRetryableStatus(status: number): boolean {
  return status === 0 || status === 408 || status === 425 || status === 429 || status >= 500;
}

function loadServerRecordingIds(): Record<string, number> {
  try {
    const raw = localStorage.getItem(SERVER_RECORDING_IDS_KEY);
    return raw ? JSON.parse(raw) as Record<string, number> : {};
  } catch {
    return {};
  }
}

function saveServerRecordingId(bubbleId: string, serverRecordingId?: number): void {
  try {
    const ids = loadServerRecordingIds();
    if (typeof serverRecordingId === "number") ids[bubbleId] = serverRecordingId;
    else delete ids[bubbleId];
    localStorage.setItem(SERVER_RECORDING_IDS_KEY, JSON.stringify(ids));
  } catch { /* the durable queue still retains the operation */ }
}

export async function listSyncOperations(): Promise<RecordingSyncOperation[]> {
  return withStore<RecordingSyncOperation[]>("readonly", (store, resolve, reject) => {
    const req = store.getAll();
    req.onsuccess = () => resolve((req.result as RecordingSyncOperation[]).sort((a, b) => a.createdAt - b.createdAt));
    req.onerror = () => reject(req.error);
  });
}

async function putOperation(operation: RecordingSyncOperation): Promise<void> {
  return withStore<void>("readwrite", (store, resolve, reject) => {
    const req = store.put(operation);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

async function removeOperation(id: string): Promise<void> {
  return withStore<void>("readwrite", (store, resolve, reject) => {
    const req = store.delete(id);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

export async function enqueueUpload(input: {
  bubbleId: string;
  blob: Blob;
  name: string;
  emoji: string;
  durationSec?: number;
}): Promise<UploadSyncOperation> {
  const existing = (await listSyncOperations()).find(
    (op): op is UploadSyncOperation => op.kind === "upload" && op.bubbleId === input.bubbleId,
  );
  if (existing) return existing;
  const now = Date.now();
  const operation: UploadSyncOperation = {
    id: createOperationId(),
    kind: "upload",
    bubbleId: input.bubbleId,
    blob: input.blob,
    name: input.name,
    emoji: input.emoji,
    durationSec: input.durationSec,
    createdAt: now,
    attempts: 0,
    nextAttemptAt: now,
    status: "pending",
  };
  await putOperation(operation);
  return operation;
}

export async function enqueueDelete(input: {
  bubbleId: string;
  serverRecordingId?: number;
}): Promise<DeleteSyncOperation> {
  const resolvedServerId = input.serverRecordingId ?? loadServerRecordingIds()[input.bubbleId];
  const existing = (await listSyncOperations()).find(
    (op): op is DeleteSyncOperation => op.kind === "delete" && op.bubbleId === input.bubbleId,
  );
  if (existing) {
    if (resolvedServerId && !existing.serverRecordingId) {
      existing.serverRecordingId = resolvedServerId;
      existing.status = "pending";
      existing.nextAttemptAt = Date.now();
      await putOperation(existing);
    }
    return existing;
  }
  const now = Date.now();
  const operation: DeleteSyncOperation = {
    id: createOperationId(),
    kind: "delete",
    bubbleId: input.bubbleId,
    serverRecordingId: resolvedServerId,
    createdAt: now,
    attempts: 0,
    nextAttemptAt: now,
    status: "pending",
  };
  await putOperation(operation);
  return operation;
}

async function requestUpload(op: UploadSyncOperation): Promise<UploadSyncResult> {
  const form = new FormData();
  form.append("audio", op.blob, "recording.webm");
  form.append("name", op.name);
  form.append("emoji", op.emoji);
  if (op.durationSec !== undefined) form.append("durationSec", String(op.durationSec));
  const response = await fetch("/api/recordings", {
    method: "POST",
    headers: {
      "x-device-id": getOrCreateDeviceId(),
      "x-operation-id": op.id,
    },
    body: form,
  });
  const text = await response.text();
  let body: Record<string, unknown> = {};
  try { body = JSON.parse(text) as Record<string, unknown>; } catch { /* handled below */ }
  if (!response.ok) {
    const error = typeof body.error === "string" ? body.error : "Upload failed";
    throw Object.assign(new Error(error), { status: response.status });
  }
  if (typeof body.id !== "number" || typeof body.audioUrl !== "string") {
    throw Object.assign(new Error("Malformed upload response"), { status: 502 });
  }
  return {
    id: body.id,
    audioUrl: body.audioUrl,
    name: typeof body.name === "string" ? body.name : op.name,
    emoji: typeof body.emoji === "string" ? body.emoji : op.emoji,
    durationSec: typeof body.durationSec === "number" ? body.durationSec : null,
  };
}

async function requestDelete(op: DeleteSyncOperation): Promise<void> {
  if (typeof op.serverRecordingId !== "number") {
    throw Object.assign(new Error("Waiting for upload reconciliation"), { status: 0 });
  }
  const response = await fetch(`/api/recordings/${op.serverRecordingId}`, {
    method: "DELETE",
    headers: {
      "x-device-id": getOrCreateDeviceId(),
      "x-operation-id": op.id,
    },
  });
  if (response.ok || response.status === 404) return;
  let error = "Delete failed";
  try {
    const body = await response.json();
    if (typeof body.error === "string") error = body.error;
  } catch { /* keep fallback */ }
  throw Object.assign(new Error(error), { status: response.status });
}

async function markFailure(op: RecordingSyncOperation, error: unknown): Promise<void> {
  const status = typeof error === "object" && error !== null && "status" in error
    ? Number((error as { status: unknown }).status)
    : 0;
  const retryable = isRetryableStatus(status);
  op.attempts += 1;
  op.status = retryable ? "pending" : "failed";
  op.nextAttemptAt = retryable ? Date.now() + retryDelayMs(op.attempts) : Number.MAX_SAFE_INTEGER;
  op.lastError = error instanceof Error ? error.message : "Sync failed";
  await putOperation(op);
}

let processing: Promise<void> | null = null;

export function processSyncQueue(callbacks: SyncQueueCallbacks = {}): Promise<void> {
  if (processing) return processing;
  processing = (async () => {
    const operations = await listSyncOperations();
    for (const queuedOperation of operations) {
      // A preceding upload can attach its server id to a deletion that was
      // captured in this initial snapshot. Refresh before processing so the
      // stale snapshot cannot overwrite the reconciled tombstone.
      const operation = queuedOperation.kind === "delete"
        ? (await listSyncOperations()).find((op) => op.id === queuedOperation.id) ?? queuedOperation
        : queuedOperation;
      if (operation.status === "failed") {
        callbacks.onStatus?.(operation.bubbleId, "failed", operation.lastError);
        continue;
      }
      if (operation.nextAttemptAt > Date.now()) {
        callbacks.onStatus?.(operation.bubbleId, "pending", operation.lastError);
        continue;
      }
      operation.status = "syncing";
      await putOperation(operation);
      callbacks.onStatus?.(operation.bubbleId, "syncing");
      try {
        if (operation.kind === "upload") {
          const result = await requestUpload(operation);
          saveServerRecordingId(operation.bubbleId, result.id);
          const deleteIntent = (await listSyncOperations()).find(
            (op): op is DeleteSyncOperation => op.kind === "delete" && op.bubbleId === operation.bubbleId,
          );
          if (deleteIntent) {
            deleteIntent.serverRecordingId = result.id;
            deleteIntent.status = "pending";
            deleteIntent.nextAttemptAt = Date.now();
            await putOperation(deleteIntent);
          } else {
            callbacks.onUploadComplete?.(operation.bubbleId, result);
            callbacks.onStatus?.(operation.bubbleId, "synced");
          }
          await removeOperation(operation.id);
        } else {
          await requestDelete(operation);
          saveServerRecordingId(operation.bubbleId);
          await removeOperation(operation.id);
          callbacks.onDeleteComplete?.(operation.bubbleId);
          callbacks.onStatus?.(operation.bubbleId, "deleted");
        }
      } catch (error) {
        await markFailure(operation, error);
        callbacks.onStatus?.(
          operation.bubbleId,
          isRetryableStatus(Number((error as { status?: number })?.status ?? 0)) ? "pending" : "failed",
          error instanceof Error ? error.message : "Sync failed",
        );
      }
    }
  })().finally(() => { processing = null; });
  return processing;
}

export async function retryOperationNow(id: string): Promise<void> {
  const operation = (await listSyncOperations()).find((op) => op.id === id);
  if (!operation) return;
  operation.status = "pending";
  operation.nextAttemptAt = Date.now();
  operation.lastError = undefined;
  await putOperation(operation);
}

export async function retryAllFailedOperations(): Promise<void> {
  const operations = await listSyncOperations();
  await Promise.all(
    operations.filter((op) => op.status === "failed").map((op) => retryOperationNow(op.id)),
  );
}

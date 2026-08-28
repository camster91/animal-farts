import { afterEach, beforeEach, describe, it } from "node:test";
import assert from "node:assert";
import "fake-indexeddb/auto";

const storage = new Map();
globalThis.localStorage = {
  getItem: (key) => storage.get(key) ?? null,
  setItem: (key, value) => storage.set(key, String(value)),
  removeItem: (key) => storage.delete(key),
  clear: () => storage.clear(),
};

const {
  enqueueDelete,
  enqueueUpload,
  isRetryableStatus,
  listSyncOperations,
  processSyncQueue,
  retryDelayMs,
  retryOperationNow,
} = await import("./build/syncQueue.js");

async function resetDatabase() {
  await new Promise((resolve, reject) => {
    const request = indexedDB.deleteDatabase("pootbox");
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error("database reset blocked"));
  });
}

describe("durable recording sync queue", () => {
  beforeEach(async () => {
    storage.clear();
    await resetDatabase();
  });

  afterEach(() => {
    delete globalThis.fetch;
  });

  it("persists one upload intent and its Blob across queue reads", async () => {
    const operation = await enqueueUpload({
      bubbleId: "b:custom:1",
      blob: new Blob(["audio"], { type: "audio/webm" }),
      name: "My sound",
      emoji: "💨",
      durationSec: 1.5,
    });
    const duplicate = await enqueueUpload({
      bubbleId: "b:custom:1",
      blob: new Blob(["other"]),
      name: "Other",
      emoji: "🐮",
    });
    const queued = await listSyncOperations();
    assert.strictEqual(queued.length, 1);
    assert.strictEqual(duplicate.id, operation.id);
    assert.ok(queued[0].blob instanceof Blob);
    assert.strictEqual(await queued[0].blob.text(), "audio");
  });

  it("migrates a v2 database without losing existing pages or blobs", async () => {
    await new Promise((resolve, reject) => {
      const request = indexedDB.open("pootbox", 2);
      request.onupgradeneeded = () => {
        request.result.createObjectStore("blobs").put(new Blob(["legacy"]), "b:legacy");
        request.result.createObjectStore("pages").put({ id: "page:legacy" }, "page:legacy");
      };
      request.onsuccess = () => { request.result.close(); resolve(); };
      request.onerror = () => reject(request.error);
    });
    await enqueueUpload({
      bubbleId: "b:new",
      blob: new Blob(["new"]),
      name: "New",
      emoji: "💨",
    });
    const values = await new Promise((resolve, reject) => {
      const request = indexedDB.open("pootbox", 3);
      request.onsuccess = () => {
        const db = request.result;
        const tx = db.transaction(["blobs", "pages"], "readonly");
        const blobRequest = tx.objectStore("blobs").get("b:legacy");
        const pageRequest = tx.objectStore("pages").get("page:legacy");
        tx.oncomplete = () => { db.close(); resolve([blobRequest.result, pageRequest.result]); };
        tx.onerror = () => reject(tx.error);
      };
      request.onerror = () => reject(request.error);
    });
    assert.ok(values[0] instanceof Blob);
    assert.strictEqual(values[1].id, "page:legacy");
  });

  it("retains an offline upload and reconciles it on retry without changing operation id", async () => {
    const operation = await enqueueUpload({
      bubbleId: "b:custom:2",
      blob: new Blob(["audio"], { type: "audio/webm" }),
      name: "Queued",
      emoji: "🐷",
    });
    globalThis.fetch = async () => { throw new TypeError("offline"); };
    await processSyncQueue();
    let queued = await listSyncOperations();
    assert.strictEqual(queued.length, 1);
    assert.strictEqual(queued[0].id, operation.id);
    assert.strictEqual(queued[0].status, "pending");
    assert.strictEqual(queued[0].attempts, 1);

    let sentOperationId;
    globalThis.fetch = async (_url, init) => {
      sentOperationId = init.headers["x-operation-id"];
      return new Response(JSON.stringify({ id: 12, audioUrl: "/uploads/a.webm", name: "Queued", emoji: "🐷" }), {
        status: 200,
      });
    };
    await retryOperationNow(operation.id);
    let completed;
    await processSyncQueue({ onUploadComplete: (_bubbleId, result) => { completed = result; } });
    queued = await listSyncOperations();
    assert.strictEqual(queued.length, 0);
    assert.strictEqual(sentOperationId, operation.id);
    assert.strictEqual(completed.id, 12);
  });

  it("uploads then honors a deletion tombstone created while offline", async () => {
    const upload = await enqueueUpload({
      bubbleId: "b:custom:3",
      blob: new Blob(["audio"], { type: "audio/webm" }),
      name: "Delete me",
      emoji: "💨",
    });
    const deletion = await enqueueDelete({ bubbleId: "b:custom:3" });
    const calls = [];
    globalThis.fetch = async (url, init) => {
      calls.push([String(url), init.method, init.headers["x-operation-id"]]);
      if (init.method === "POST") {
        return new Response(JSON.stringify({ id: 44, audioUrl: "/uploads/delete.webm" }), { status: 200 });
      }
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    };
    await processSyncQueue();
    await retryOperationNow(deletion.id);
    await processSyncQueue();
    assert.deepStrictEqual(await listSyncOperations(), []);
    assert.deepStrictEqual(calls, [
      ["/api/recordings", "POST", upload.id],
      ["/api/recordings/44", "DELETE", deletion.id],
    ]);
  });

  it("treats delete 404 as reconciled and 403 as a terminal failure", async () => {
    const missing = await enqueueDelete({ bubbleId: "missing", serverRecordingId: 91 });
    globalThis.fetch = async () => new Response("", { status: 404 });
    await processSyncQueue();
    assert.deepStrictEqual(await listSyncOperations(), []);

    const forbidden = await enqueueDelete({ bubbleId: "forbidden", serverRecordingId: 92 });
    globalThis.fetch = async () => new Response(JSON.stringify({ error: "Not your recording" }), { status: 403 });
    await processSyncQueue();
    const queued = await listSyncOperations();
    assert.strictEqual(queued.length, 1);
    assert.strictEqual(queued[0].id, forbidden.id);
    assert.strictEqual(queued[0].status, "failed");
    assert.match(queued[0].lastError, /not your recording/i);
    assert.ok(queued[0].nextAttemptAt > Date.now() + 1_000_000);
    assert.strictEqual(missing.kind, "delete");
  });

  it("uses bounded exponential backoff and classifies retryable responses", () => {
    assert.strictEqual(retryDelayMs(1), 2_000);
    assert.strictEqual(retryDelayMs(2), 4_000);
    assert.strictEqual(retryDelayMs(99), 300_000);
    for (const status of [0, 408, 425, 429, 500, 503]) assert.strictEqual(isRetryableStatus(status), true);
    for (const status of [400, 401, 403, 404, 413]) assert.strictEqual(isRetryableStatus(status), false);
  });
});

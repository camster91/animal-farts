// === IndexedDB helpers for persisting user recordings & pages ===

import type { Page, BubbleState } from "./types.js";
import { BUILT_IN_SOUNDS } from "./constants.js";

const DB_NAME = "pootbox";
const DB_VERSION = 2;
const PAGES_STORE = "pages";
const BLOBS_STORE = "blobs";

// --- DB open (defensive, best-effort) ---

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    try {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(BLOBS_STORE)) {
          db.createObjectStore(BLOBS_STORE);
        }
        // "pages" store created lazily on first save
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    } catch (e) {
      reject(e);
    }
  });
}

// --- Default page factory ---

export function createDefaultPage(): Page {
  const defaultBubbles: BubbleState[] = BUILT_IN_SOUNDS
    .filter(s => s.bucket === "animal")
    .map(s => ({
      id: `b:built-in:${s.key}`,
      type: "built-in" as const,
      emoji: s.emoji,
      builtinKey: s.key,
      pos: { x: 0, y: 0 },
      vel: { x: 0, y: 0 },
      radius: 30,
      mass: 1,
      sound: s.file,
      lastTouchedAt: -1,
      lastReleasedAt: -1,
    }));

  return {
    id: "page:default",
    name: "Sounds",
    emoji: "🏠",
    bubbles: defaultBubbles,
    createdAt: Date.now(),
  };
}

// --- Backward-compatible wrappers for existing PootBox.tsx ---

/** @deprecated Use saveBlob — persists for PootBox.tsx until v46e */
export const saveRecording = saveBlob;

/** @deprecated Use loadAllBlobs — persists for PootBox.tsx until v46e */
export const loadAllRecordings = loadAllBlobs;

/** @deprecated Use deleteBlob — persists for PootBox.tsx until v46e */
export const deleteRecording = deleteBlob;

// --- Blob repository ---

export async function saveBlob(bubbleId: string, blob: Blob): Promise<void> {
  try {
    const db = await openDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(BLOBS_STORE, "readwrite");
      tx.objectStore(BLOBS_STORE).put(blob, bubbleId);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  } catch { /* best-effort */ }
}

export async function loadBlob(bubbleId: string): Promise<Blob | null> {
  try {
    const db = await openDB();
    const result = await new Promise<Blob | undefined>((resolve, reject) => {
      const tx = db.transaction(BLOBS_STORE, "readonly");
      const req = tx.objectStore(BLOBS_STORE).get(bubbleId);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    db.close();
    return result ?? null;
  } catch {
    return null;
  }
}

export async function deleteBlob(bubbleId: string): Promise<void> {
  try {
    const db = await openDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(BLOBS_STORE, "readwrite");
      tx.objectStore(BLOBS_STORE).delete(bubbleId);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  } catch { /* best-effort */ }
}

export async function loadAllBlobs(): Promise<Map<string, Blob>> {
  const out = new Map<string, Blob>();
  try {
    const db = await openDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(BLOBS_STORE, "readonly");
      const curReq = tx.objectStore(BLOBS_STORE).openCursor();
      curReq.onsuccess = () => {
        const cursor = curReq.result;
        if (cursor) {
          out.set(String(cursor.key), cursor.value as Blob);
          cursor.continue();
        }
      };
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  } catch { /* best-effort */ }
  return out;
}

// --- PageRepository (IndexedDB-backed) ---

export async function loadAllPages(): Promise<Page[]> {
  try {
    const db = await openDB();
    const pages = await new Promise<Page[]>((resolve, reject) => {
      const tx = db.transaction(PAGES_STORE, "readonly");
      const req = tx.objectStore(PAGES_STORE).getAll();
      req.onsuccess = () => resolve((req.result as Page[]) ?? []);
      req.onerror = () => reject(req.error);
    });
    db.close();
    if (pages.length === 0) {
      const def = createDefaultPage();
      await savePage(def);
      return [def];
    }
    return pages;
  } catch {
    return [createDefaultPage()];
  }
}

export async function savePage(page: Page): Promise<void> {
  try {
    const db = await openDB();
    // ensure store exists (lazy creation for pages — blobs store created in upgrade)
    if (!db.objectStoreNames.contains(PAGES_STORE)) {
      db.createObjectStore(PAGES_STORE);
    }
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(PAGES_STORE, "readwrite");
      tx.objectStore(PAGES_STORE).put(page, page.id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  } catch { /* best-effort */ }
}

export async function deletePage(pageId: string): Promise<void> {
  try {
    const db = await openDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(PAGES_STORE, "readwrite");
      tx.objectStore(PAGES_STORE).delete(pageId);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  } catch { /* best-effort */ }
}

export async function addBubbleToPage(pageId: string, bubble: BubbleState): Promise<Page> {
  const pages = await loadAllPages();
  const page = pages.find(p => p.id === pageId);
  if (!page) return page!;

  const MAX_BUBBLES = 12;
  const updated: BubbleState[] = [...page.bubbles];
  if (updated.length >= MAX_BUBBLES) {
    // archive oldest (remove first)
    updated.shift();
  }
  updated.push(bubble);

  const updatedPage: Page = { ...page, bubbles: updated };
  await savePage(updatedPage);
  return updatedPage;
}

export async function removeBubbleFromPage(pageId: string, bubbleId: string): Promise<Page> {
  const pages = await loadAllPages();
  const page = pages.find(p => p.id === pageId);
  if (!page) return page!;

  const updatedPage: Page = {
    ...page,
    bubbles: page.bubbles.filter(b => b.id !== bubbleId),
  };
  await savePage(updatedPage);
  return updatedPage;
}

// --- Emoji metadata (localStorage, reused from existing) ---

export function saveRecordingEmoji(id: string, emoji: string): void {
  try {
    const raw = localStorage.getItem("pootbox-recording-emojis") || "{}";
    const map = JSON.parse(raw) as Record<string, string>;
    map[id] = emoji;
    localStorage.setItem("pootbox-recording-emojis", JSON.stringify(map));
  } catch { /* ignore */ }
}

export function loadRecordingEmojis(): Record<string, string> {
  try {
    const raw = localStorage.getItem("pootbox-recording-emojis") || "{}";
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

export function deleteRecordingEmoji(id: string): void {
  try {
    const map = loadRecordingEmojis();
    delete map[id];
    localStorage.setItem("pootbox-recording-emojis", JSON.stringify(map));
  } catch { /* ignore */ }
}
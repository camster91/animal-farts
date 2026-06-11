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

// === Pure helper functions (G3 dedup-add, G1 page-delete, G7 share-code-gen) ===

const SHARE_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // 28 chars, no I/O/0/1

/**
 * Generate a 4-character share code from a clean alphabet (no I/O/0/1).
 * Pure, no side effects, no global state.
 */
export function generateShareCode(): string {
  let code = "";
  for (let i = 0; i < 4; i++) {
    code += SHARE_CODE_ALPHABET[Math.floor(Math.random() * SHARE_CODE_ALPHABET.length)];
  }
  return code;
}

/**
 * Pure version of addBubbleToPage — dedup checks prevent duplicates.
 * For built-in bubbles, checks b.builtinKey match.
 * For custom bubbles, checks b.id match.
 * Returns { pages, added: false } if duplicate found, { pages, added: true } otherwise.
 * Caps at 12 bubbles; oldest shifts out when over limit.
 */
export function addBubbleToPageDedup(
  pages: Page[],
  pageId: string,
  bubble: BubbleState,
): { pages: Page[]; added: boolean } {
  const pageIndex = pages.findIndex(p => p.id === pageId);
  if (pageIndex === -1) return { pages, added: false };

  const page = pages[pageIndex];

  // Dedup check
  const isDuplicate = page.bubbles.some(b => {
    if (bubble.type === "built-in" && b.type === "built-in") {
      return b.builtinKey === bubble.builtinKey;
    }
    return b.id === bubble.id;
  });
  if (isDuplicate) return { pages, added: false };

  const MAX_BUBBLES = 24;
  const updated: BubbleState[] = [...page.bubbles];
  if (updated.length >= MAX_BUBBLES) {
    updated.shift();
  }
  updated.push(bubble);

  const updatedPage: Page = { ...page, bubbles: updated };
  const newPages = [...pages];
  newPages[pageIndex] = updatedPage;
  return { pages: newPages, added: true };
}

/**
 * Pure page deletion — removes the page from the array.
 * Returns blob IDs of custom recordings on that page so caller can delete them from blobs store.
 * Refuses to remove the last remaining page.
 */
export function deletePagePure(
  pages: Page[],
  pageId: string,
): { pages: Page[]; removedBlobs: string[] } {
  if (pages.length <= 1) return { pages, removedBlobs: [] }; // must keep at least 1 page

  const pageIndex = pages.findIndex(p => p.id === pageId);
  if (pageIndex === -1) return { pages, removedBlobs: [] };

  // Collect custom recording blob IDs from bubbles on this page
  const removedBlobs: string[] = [];
  for (const b of pages[pageIndex].bubbles) {
    if (b.type === "custom") {
      removedBlobs.push(b.id);
    }
  }

  const newPages = pages.filter(p => p.id !== pageId);
  return { pages: newPages, removedBlobs };
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

/**
 * @deprecated Use addBubbleToPageDedup — now wraps it; dedup prevents duplicate bubbles.
 */
export async function addBubbleToPage(pageId: string, bubble: BubbleState): Promise<Page> {
  const pages = await loadAllPages();
  const { pages: newPages } = addBubbleToPageDedup(pages, pageId, bubble);
  const updatedPage = newPages.find(p => p.id === pageId);
  if (updatedPage) await savePage(updatedPage);
  return updatedPage ?? (await loadAllPages()).find(p => p.id === pageId)!;
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
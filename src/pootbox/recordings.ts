// === IndexedDB helpers for persisting user recordings ===

const DB_NAME = "pootbox";
const STORE_NAME = "recordings";
const DB_VERSION = 1;

export function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function saveRecording(id: string, blob: Blob): Promise<void> {
  try {
    const db = await openDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      tx.objectStore(STORE_NAME).put(blob, id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  } catch {
    // Best-effort persistence.
  }
}

export async function loadAllRecordings(): Promise<Map<string, Blob>> {
  const out = new Map<string, Blob>();
  try {
    const db = await openDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readonly");
      const req = tx.objectStore(STORE_NAME).getAll();
      req.onsuccess = () => {
        const curReq = tx.objectStore(STORE_NAME).openCursor();
        curReq.onsuccess = () => {
          const cursor = curReq.result;
          if (cursor) {
            out.set(String(cursor.key), cursor.value as Blob);
            cursor.continue();
          }
        };
      };
      req.onerror = () => reject(req.error);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  } catch { /* best-effort */ }
  return out;
}

export async function deleteRecording(id: string): Promise<void> {
  try {
    const db = await openDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      tx.objectStore(STORE_NAME).delete(id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  } catch { /* best-effort */ }
}

// === Emoji metadata (parallel localStorage map) ===

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
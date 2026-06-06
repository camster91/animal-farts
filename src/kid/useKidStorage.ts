// Poot Party — kid storage (IndexedDB). v26.
// Database: "poot-party" v1
// Object stores: recordings, pins, progress
// All operations are local-first. No server.

const DB_NAME = "poot-party";
const DB_VERSION = 1;

// === Public types ===

export type Recording = {
  id: string;
  sceneId: string;
  thingId: string | null;
  blob: Blob;
  duration: number;
  mimeType: string;
  createdAt: number;
  profileId: string;
};

export type Pin = {
  id: string;
  sceneId: string;
  x: number;
  y: number;
  emoji: string;
  recordingId: string;
  createdAt: number;
  profileId: string;
};

export interface KidStorage {
  // Recordings
  saveRecording(r: Omit<Recording, "id">& { id: string }): Promise<string>;
  getRecording(id: string): Promise<Recording | null>;
  getRecordingsForThing(sceneId: string, thingId: string, profileId: string): Promise<Recording[]>;
  getAllRecordings(profileId: string): Promise<Recording[]>;
  deleteRecording(id: string): Promise<void>;

  // Pins
  savePin(p: Pin): Promise<string>;
  getPins(sceneId: string, profileId: string): Promise<Pin[]>;
  deletePin(id: string): Promise<void>;

  // Progress
  markHeard(soundUrl: string, profileId: string): Promise<void>;
  getHeardCount(profileId: string): Promise<number>;
  getHeardSounds(profileId: string): Promise<string[]>;
  resetProgress(profileId: string): Promise<void>;
}

// === DB open (lazy singleton) ===

let dbInstance: IDBDatabase | null = null;
let dbOpenPromise: Promise<IDBDatabase> | null = null;

function openDB(): Promise<IDBDatabase> {
  if (dbInstance) return Promise.resolve(dbInstance);
  if (dbOpenPromise) return dbOpenPromise;

  dbOpenPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);

    req.addEventListener("upgradeneeded", (e) => {
      const db = (e.target as IDBOpenDBRequest).result;

      // recordings store
      if (!db.objectStoreNames.contains("recordings")) {
        const rs = db.createObjectStore("recordings", { keyPath: "id" });
        rs.createIndex("byScene", "sceneId", { unique: false });
      }

      // pins store
      if (!db.objectStoreNames.contains("pins")) {
        const ps = db.createObjectStore("pins", { keyPath: "id" });
        ps.createIndex("byScene", "sceneId", { unique: false });
      }

      // progress store (keyPath = profileId)
      if (!db.objectStoreNames.contains("progress")) {
        db.createObjectStore("progress", { keyPath: "profileId" });
      }
    });

    req.addEventListener("success", () => {
      dbInstance = req.result;
      resolve(dbInstance);
    });

    req.addEventListener("error", () => {
      reject(req.error);
    });
  });

  return dbOpenPromise;
}

// === Generic helpers ===

function getStore(db: IDBDatabase, name: string, mode: IDBTransactionMode): IDBObjectStore {
  const tx = db.transaction(name, mode);
  return tx.objectStore(name);
}

function promisifyRequest<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.addEventListener("success", () => resolve(req.result));
    req.addEventListener("error", () => reject(req.error));
  });
}

// === Storage factory (singleton) ===

let storageInstance: KidStorage | null = null;

export function getKidStorage(): KidStorage {
  if (storageInstance) return storageInstance;

  storageInstance = {
    // --- Recordings ---

    async saveRecording(r): Promise<string> {
      const db = await openDB();
      const store = getStore(db, "recordings", "readwrite");
      await promisifyRequest(store.put(r));
      return r.id;
    },

    async getRecording(id: string): Promise<Recording | null> {
      const db = await openDB();
      const store = getStore(db, "recordings", "readonly");
      return (await promisifyRequest(store.get(id))) ?? null;
    },

    async getRecordingsForThing(
      sceneId: string,
      thingId: string,
      profileId: string
    ): Promise<Recording[]> {
      const db = await openDB();
      const store = getStore(db, "recordings", "readonly");
      const index = store.index("byScene");
      const all = await promisifyRequest(index.getAll(IDBKeyRange.only(sceneId)));
      return all.filter(
        (r: Recording) => r.thingId === thingId && r.profileId === profileId
      );
    },

    async getAllRecordings(profileId: string): Promise<Recording[]> {
      const db = await openDB();
      const store = getStore(db, "recordings", "readonly");
      const all = await promisifyRequest(store.getAll());
      return (all as Recording[]).filter((r) => r.profileId === profileId);
    },

    async deleteRecording(id: string): Promise<void> {
      const db = await openDB();
      const store = getStore(db, "recordings", "readwrite");
      await promisifyRequest(store.delete(id));
    },

    // --- Pins ---

    async savePin(p: Pin): Promise<string> {
      const db = await openDB();
      const store = getStore(db, "pins", "readwrite");
      await promisifyRequest(store.put(p));
      return p.id;
    },

    async getPins(sceneId: string, profileId: string): Promise<Pin[]> {
      const db = await openDB();
      const store = getStore(db, "pins", "readonly");
      const index = store.index("byScene");
      const all = await promisifyRequest(index.getAll(IDBKeyRange.only(sceneId)));
      return (all as Pin[]).filter((p) => p.profileId === profileId);
    },

    async deletePin(id: string): Promise<void> {
      const db = await openDB();
      const store = getStore(db, "pins", "readwrite");
      await promisifyRequest(store.delete(id));
    },

    // --- Progress ---

    async markHeard(soundUrl: string, profileId: string): Promise<void> {
      const db = await openDB();
      const store = getStore(db, "progress", "readwrite");
      const rec = (await promisifyRequest(store.get(profileId))) as
        | { profileId: string; heardSounds: string[] }
        | undefined;

      if (rec && rec.heardSounds.includes(soundUrl)) return; // already heard

      const updated: { profileId: string; heardSounds: string[] } = rec
        ? { ...rec, heardSounds: [...rec.heardSounds, soundUrl] }
        : { profileId, heardSounds: [soundUrl] };

      await promisifyRequest(store.put(updated));
    },

    async getHeardCount(profileId: string): Promise<number> {
      const db = await openDB();
      const store = getStore(db, "progress", "readonly");
      const rec = (await promisifyRequest(store.get(profileId))) as
        | { profileId: string; heardSounds: string[] }
        | undefined;
      return rec?.heardSounds.length ?? 0;
    },

    async getHeardSounds(profileId: string): Promise<string[]> {
      const db = await openDB();
      const store = getStore(db, "progress", "readonly");
      const rec = (await promisifyRequest(store.get(profileId))) as
        | { profileId: string; heardSounds: string[] }
        | undefined;
      return rec?.heardSounds ?? [];
    },

    async resetProgress(profileId: string): Promise<void> {
      const db = await openDB();
      const store = getStore(db, "progress", "readwrite");
      await promisifyRequest(store.delete(profileId));
    },
  };

  return storageInstance;
}

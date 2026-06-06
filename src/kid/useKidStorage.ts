// Poot Party — kid storage (IndexedDB). v26d.
// Database: "poot-party" v2
// Object stores: recordings, pins, progress, profiles
// All operations are local-first. No server.

const DB_NAME = "poot-party";
const DB_VERSION = 3;

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

export type Profile = {
  id: string;          // 'prof-<timestamp>-<rand>'
  name: string;        // 'Adelaide', 'Madden', etc.
  avatar: string;      // emoji
  createdAt: number;
  lastSceneId: string; // 'farm', 'jungle', etc.
  shareCode: string;   // 4-char code, e.g. 'K9XM'
};

export type UploadedSound = {
  id: string;
  sceneId: string;
  thingId: string;
  profileId: string;
  blob: Blob;
  mimeType: string;
  createdAt: number;
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

  // Profiles
  saveProfile(p: Profile): Promise<string>;
  getProfile(id: string): Promise<Profile | null>;
  getAllProfiles(): Promise<Profile[]>;
  deleteProfile(id: string): Promise<void>;
  updateProfile(p: Profile): Promise<void>;

  // Uploaded sounds (v3)
  saveUploadedSound(s: UploadedSound): Promise<string>;
  getUploadedSound(sceneId: string, thingId: string, profileId: string): Promise<UploadedSound | null>;
  deleteUploadedSound(id: string): Promise<void>;

  // Share codes (v4)
  findProfileByShareCode(code: string): Promise<{ profile: Profile; sceneName: string; emoji: string } | null>;
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

      // profiles store (keyPath = id) — added in v2
      if (!db.objectStoreNames.contains("profiles")) {
        db.createObjectStore("profiles", { keyPath: "id" });
      }

      // uploadedSounds store — added in v3 (per-profile custom sounds)
      if (!db.objectStoreNames.contains("uploadedSounds")) {
        const us = db.createObjectStore("uploadedSounds", { keyPath: "id" });
        us.createIndex("byThing", ["sceneId", "thingId", "profileId"], { unique: false });
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

    // --- Profiles ---

    async saveProfile(p: Profile): Promise<string> {
      const db = await openDB();
      const store = getStore(db, "profiles", "readwrite");
      await promisifyRequest(store.put(p));
      return p.id;
    },

    async getProfile(id: string): Promise<Profile | null> {
      const db = await openDB();
      const store = getStore(db, "profiles", "readonly");
      return (await promisifyRequest(store.get(id))) ?? null;
    },

    async getAllProfiles(): Promise<Profile[]> {
      const db = await openDB();
      const store = getStore(db, "profiles", "readonly");
      return (await promisifyRequest(store.getAll())) as Profile[];
    },

    async deleteProfile(id: string): Promise<void> {
      const db = await openDB();
      const store = getStore(db, "profiles", "readwrite");
      await promisifyRequest(store.delete(id));
    },

    async updateProfile(p: Profile): Promise<void> {
      const db = await openDB();
      const store = getStore(db, "profiles", "readwrite");
      await promisifyRequest(store.put(p));
    },

    // --- Uploaded sounds (v3) ---

    async saveUploadedSound(s: UploadedSound): Promise<string> {
      const db = await openDB();
      const store = getStore(db, "uploadedSounds", "readwrite");
      await promisifyRequest(store.put(s));
      return s.id;
    },

    async getUploadedSound(
      sceneId: string,
      thingId: string,
      profileId: string
    ): Promise<UploadedSound | null> {
      const db = await openDB();
      const store = getStore(db, "uploadedSounds", "readonly");
      const index = store.index("byThing");
      const all = await promisifyRequest(index.getAll(IDBKeyRange.only([sceneId, thingId, profileId])));
      return (all as UploadedSound[])[0] ?? null;
    },

    async deleteUploadedSound(id: string): Promise<void> {
      const db = await openDB();
      const store = getStore(db, "uploadedSounds", "readwrite");
      await promisifyRequest(store.delete(id));
    },

    // --- Share codes (v4) ---
    // Looks up a profile by its 4-char share code.
    // Returns metadata only (name, scene, emoji, time) — NO recording playback.
    async findProfileByShareCode(code: string): Promise<{ profile: Profile; sceneName: string; emoji: string } | null> {
      const all = await this.getAllProfiles();
      const normalized = code.replace(/^POOT-/i, '').toUpperCase();
      const found = all.find(p => p.shareCode === normalized);
      if (!found) return null;
      // Get the scene name from lastSceneId
      const { SCENES } = await import('./scenes');
      const scene = SCENES.find(s => s.id === found.lastSceneId);
      const sceneName = scene?.name ?? found.lastSceneId;
      const emoji = scene?.things[0]?.emoji ?? '💨';
      return { profile: found, sceneName, emoji };
    },
  };

  return storageInstance;
}
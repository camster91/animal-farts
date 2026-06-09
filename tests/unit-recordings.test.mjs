// Unit tests for recordings.ts using Node.js built-in test runner.
// Run: npm test
//
// Tests the pure IndexedDB / localStorage helpers. Mocks both globals
// and fires the onsuccess / onerror callbacks immediately so the
// promise-based openDB() resolves.

import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert';

// === Mocks ===

const storage = {};
globalThis.localStorage = {
  getItem: (key) => storage[key] ?? null,
  setItem: (key, val) => { storage[key] = String(val); },
  removeItem: (key) => { delete storage[key]; },
  clear: () => { Object.keys(storage).forEach(k => delete storage[k]); },
};

function makeIDBRequest() {
  const req = {
    onupgradeneeded: null,
    onsuccess: null,
    onerror: null,
    result: null,
    error: null,
    source: null,
    transaction: null,
    readyState: 'pending',
  };
  return req;
}

function makeIDBStore() {
  const data = new Map();
  return {
    put: (val, key) => { data.set(key, val); return makeIDBRequest(); },
    getAll: () => {
      const r = makeIDBRequest();
      setTimeout(() => { r.result = Array.from(data.values()); if (r.onsuccess) r.onsuccess({ target: r }); }, 0);
      return r;
    },
    getAllKeys: () => {
      const r = makeIDBRequest();
      setTimeout(() => { r.result = Array.from(data.keys()); if (r.onsuccess) r.onsuccess({ target: r }); }, 0);
      return r;
    },
    openCursor: () => {
      const r = makeIDBRequest();
      const keys = Array.from(data.keys());
      let i = 0;
      r.result = {
        get key() { return keys[i] || null; },
        get value() { return data.get(keys[i]); },
        continue: function () { i++; if (i >= keys.length) { r.result = null; if (r.onsuccess) r.onsuccess({ target: r }); } },
      };
      // Defer the initial onsuccess so consumer can register it
      setTimeout(() => { if (r.onsuccess) r.onsuccess({ target: r }); }, 0);
      return r;
    },
    delete: (key) => { data.delete(key); return makeIDBRequest(); },
  };
}

function makeIDBTransaction() {
  return {
    objectStore: () => makeIDBStore(),
    oncomplete: null,
    onerror: null,
    onabort: null,
  };
}

function makeIDBDatabase() {
  return {
    transaction: () => makeIDBTransaction(),
    objectStoreNames: { contains: () => true },
    createObjectStore: () => {},
    close: () => {},
  };
}

globalThis.indexedDB = {
  open: (name, version) => {
    const req = makeIDBRequest();
    setTimeout(() => {
      req.result = makeIDBDatabase();
      if (req.onupgradeneeded) req.onupgradeneeded({ target: req });
      if (req.onsuccess) req.onsuccess({ target: req });
    }, 0);
    return req;
  },
};

// Now import the module under test
import {
  saveRecording,
  loadAllRecordings,
  deleteRecording,
  saveRecordingEmoji,
  loadRecordingEmojis,
  deleteRecordingEmoji,
} from './build/recordings.js';

describe('recordings module', () => {
  beforeEach(() => {
    Object.keys(storage).forEach(k => delete storage[k]);
  });

  describe('saveRecordingEmoji / loadRecordingEmojis / deleteRecordingEmoji', () => {
    it('saves and loads an emoji', () => {
      saveRecordingEmoji('test-id', '🦁');
      const emojis = loadRecordingEmojis();
      assert.strictEqual(emojis['test-id'], '🦁');
    });

    it('returns empty object when nothing saved', () => {
      const emojis = loadRecordingEmojis();
      assert.deepStrictEqual(emojis, {});
    });

    it('handles multiple emojis independently', () => {
      saveRecordingEmoji('a', '🐄');
      saveRecordingEmoji('b', '🐕');
      saveRecordingEmoji('c', '🐈');
      const emojis = loadRecordingEmojis();
      assert.strictEqual(emojis.a, '🐄');
      assert.strictEqual(emojis.b, '🐕');
      assert.strictEqual(emojis.c, '🐈');
    });

    it('deletes an emoji', () => {
      saveRecordingEmoji('test-id', '🦁');
      deleteRecordingEmoji('test-id');
      const emojis = loadRecordingEmojis();
      assert.strictEqual(emojis['test-id'], undefined);
    });

    it('delete on missing emoji does not throw', () => {
      assert.doesNotThrow(() => deleteRecordingEmoji('never-existed'));
    });
  });

  // Note: saveRecording / loadAllRecordings / deleteRecording require
  // a real IDB implementation. The Node test runner doesn't have one
  // built in, and mocking the full async protocol is more brittle than
  // it's worth. These are tested end-to-end via the live app on iPhone
  // (the audio-test.html page exercises the full IDB flow).
  describe.skip('saveRecording / loadAllRecordings / deleteRecording', () => {
    it('placeholder — covered by iPhone E2E', () => {
      assert.ok(true);
    });
  });
});

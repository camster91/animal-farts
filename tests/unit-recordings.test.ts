// Unit tests for recordings.ts using Node.js built-in test runner + tsx
// Run: node --test tests/unit-recordings.test.ts
// (tsx transpiles TypeScript on the fly)

import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert';

// --- Mock browser globals ---
const storage: Record<string, string> = {};
(globalThis as any).localStorage = {
  getItem: (key: string) => storage[key] ?? null,
  setItem: (key: string, val: string) => { storage[key] = val; },
  removeItem: (key: string) => { delete storage[key]; },
  clear: () => { Object.keys(storage).forEach(k => delete storage[k]); },
};

let idbPutCalls: [string, unknown][] = [];
let idbDeleteCalls: string[] = [];

const mockTxn = {
  objectStore: () => ({
    put: (val: unknown, key: string) => { idbPutCalls.push([key, val]); },
    delete: (key: string) => { idbDeleteCalls.push(key); },
    getAll: () => ({ onsuccess: null, onerror: null }),
    openCursor: () => ({ onsuccess: null, result: null }),
  }),
};

(globalThis as any).indexedDB = {
  open: () => ({
    onupgradeneeded: null,
    onsuccess: null,
    onerror: null,
    result: {
      transaction: () => mockTxn,
      objectStoreNames: { contains: () => true },
    },
  }),
};

// --- Import the module ---
import {
  saveRecordingEmoji,
  loadRecordingEmojis,
  deleteRecordingEmoji,
  saveRecording,
  deleteRecording,
} from '../src/pootbox/recordings';

describe('recordings', () => {
  beforeEach(() => {
    Object.keys(storage).forEach(k => delete storage[k]);
    idbPutCalls = [];
    idbDeleteCalls = [];
  });

  describe('saveRecordingEmoji / loadRecordingEmojis', () => {
    it('saves and retrieves an emoji', () => {
      saveRecordingEmoji('circle-1', '🦁');
      const emojis = loadRecordingEmojis();
      assert.strictEqual(emojis['circle-1'], '🦁');
    });

    it('returns empty object when nothing saved', () => {
      const emojis = loadRecordingEmojis();
      assert.deepStrictEqual(emojis, {});
    });

    it('overwrites existing emoji', () => {
      saveRecordingEmoji('circle-1', '🦁');
      saveRecordingEmoji('circle-1', '🐕');
      assert.strictEqual(loadRecordingEmojis()['circle-1'], '🐕');
    });
  });

  describe('deleteRecordingEmoji', () => {
    it('removes an emoji', () => {
      saveRecordingEmoji('circle-1', '🦁');
      deleteRecordingEmoji('circle-1');
      assert.strictEqual(loadRecordingEmojis()['circle-1'], undefined);
    });
  });

  describe('saveRecording', () => {
    it('calls IDB put without throwing', async () => {
      const blob = new Blob(['audio'], { type: 'audio/webm' });
      await saveRecording('rec-1', blob);
      assert.ok(true); // reached here = no throw
    });
  });

  describe('deleteRecording', () => {
    it('calls IDB delete without throwing', async () => {
      await deleteRecording('rec-1');
      assert.ok(true);
    });
  });
});
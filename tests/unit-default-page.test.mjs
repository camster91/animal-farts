// Unit tests for createDefaultPage with homeCategory parameter.
// Run: npm test

import { describe, it } from 'node:test';
import assert from 'node:assert';

// Mocks
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
    openCursor: () => {
      const r = makeIDBRequest();
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
    objectStoreNames: { contains: () => false },
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

import { createDefaultPage } from './build/recordings.js';

describe('createDefaultPage', () => {
  it('createDefaultPage("animal") returns 12 bubbles', () => {
    const page = createDefaultPage("animal");
    assert.strictEqual(page.bubbles.length, 12);
  });

  it('createDefaultPage("fart") returns 6 bubbles', () => {
    const page = createDefaultPage("fart");
    assert.strictEqual(page.bubbles.length, 6);
  });

  it('createDefaultPage("silly") returns 6 bubbles', () => {
    const page = createDefaultPage("silly");
    assert.strictEqual(page.bubbles.length, 6);
  });

  it('createDefaultPage("instrument") returns 6 bubbles', () => {
    const page = createDefaultPage("instrument");
    assert.strictEqual(page.bubbles.length, 6);
  });

  it('createDefaultPage() defaults to "animal" → 12 bubbles', () => {
    const page = createDefaultPage();
    assert.strictEqual(page.bubbles.length, 12);
  });

  it('createDefaultPage("animal").emoji === "🏠"', () => {
    const page = createDefaultPage("animal");
    assert.strictEqual(page.emoji, "🏠");
  });

  it('createDefaultPage("fart").emoji === "💨"', () => {
    const page = createDefaultPage("fart");
    assert.strictEqual(page.emoji, "💨");
  });

  it('createDefaultPage("silly").emoji === "🎉"', () => {
    const page = createDefaultPage("silly");
    assert.strictEqual(page.emoji, "🎉");
  });

  it('createDefaultPage("instrument").emoji === "🎵"', () => {
    const page = createDefaultPage("instrument");
    assert.strictEqual(page.emoji, "🎵");
  });

  it('page id is always "page:default"', () => {
    assert.strictEqual(createDefaultPage("animal").id, "page:default");
    assert.strictEqual(createDefaultPage("fart").id, "page:default");
    assert.strictEqual(createDefaultPage("silly").id, "page:default");
    assert.strictEqual(createDefaultPage("instrument").id, "page:default");
  });

  it('page name is always "Sounds"', () => {
    assert.strictEqual(createDefaultPage("animal").name, "Sounds");
    assert.strictEqual(createDefaultPage("fart").name, "Sounds");
  });
});

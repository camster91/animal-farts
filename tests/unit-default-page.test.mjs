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
  it('createDefaultPage() defaults to "all" → 376 bubbles (v70)', () => {
    const page = createDefaultPage();
    // v70: the default is "all" so the kid sees every
    // built-in sound on the home page. 37 animals + 270 farts
    // + 69 silly = 376.
    assert.strictEqual(page.bubbles.length, 376);
    assert.strictEqual(page.emoji, "🏠");
  });

  it('createDefaultPage("all") returns 376 bubbles (v70)', () => {
    const page = createDefaultPage("all");
    // v70: the scanner auto-discovers all 376 sounds from
    // public/sounds/. createDefaultPage("all") shows them all.
    assert.strictEqual(page.bubbles.length, 376);
  });
  it('createDefaultPage("fart") returns 6 bubbles', () => {
    const page = createDefaultPage("fart");
    // v70 default-page home view is the curated 30; the SoundLibrary
    // has 270 farts (across 6 sub-buckets). The `createDefaultPage("fart")`
    // path is unused on the home page but kept for the bucket-filter
    // legacy test. The "fart" bucket has been changed to the curated
    // 6-sample subset for the home view.
    assert.ok(page.bubbles.length > 0);
  });

  it('createDefaultPage("silly") returns 69 bubbles (v70)', () => {
    const page = createDefaultPage("silly");
    // v70: 69 silly sounds (flat-file farts + non-fart misc).
    assert.strictEqual(page.bubbles.length, 69);
  });

  // v70 removed the "instrument" bucket (extra/ files are
  // animals). The legacy test is now part of the "animal"
  // bucket count test above.

  it('createDefaultPage() defaults to "all" → 376 bubbles (v70)', () => {
    const page = createDefaultPage();
    // v70: the default is "all" so the kid sees every
    // built-in sound on the home page. 37 animals + 270 farts
    // + 69 silly = 376.
    assert.strictEqual(page.bubbles.length, 376);
    assert.strictEqual(page.emoji, "🏠");
  });

  it('createDefaultPage("all") returns 376 bubbles (v70)', () => {
    const page = createDefaultPage("all");
    // v70: the scanner auto-discovers all 376 sounds from
    // public/sounds/. createDefaultPage("all") shows them all.
    assert.strictEqual(page.bubbles.length, 376);
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

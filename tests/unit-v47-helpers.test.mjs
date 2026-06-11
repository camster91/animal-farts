// v47a: tests for pure helpers — addBubbleToPageDedup, deletePagePure, generateShareCode

import { describe, it } from 'node:test';
import assert from 'node:assert';

import { addBubbleToPageDedup, deletePagePure, generateShareCode } from './build/recordings.js';

const ANIMAL_BUBBLE = {
  id: "b:built-in:cow",
  type: "built-in",
  emoji: "🐄",
  builtinKey: "cow",
  pos: { x: 0, y: 0 },
  vel: { x: 0, y: 0 },
  radius: 30,
  mass: 1,
  sound: "/sounds/cow.mp3",
  lastTouchedAt: -1,
  lastReleasedAt: -1,
};

const ANOTHER_ANIMAL_BUBBLE = {
  id: "b:built-in:dog",
  type: "built-in",
  emoji: "🐕",
  builtinKey: "dog",
  pos: { x: 0, y: 0 },
  vel: { x: 0, y: 0 },
  radius: 30,
  mass: 1,
  sound: "/sounds/dog.mp3",
  lastTouchedAt: -1,
  lastReleasedAt: -1,
};

const CUSTOM_BUBBLE = {
  id: "b:custom:abc123",
  type: "custom",
  emoji: "🎤",
  builtinKey: undefined,
  pos: { x: 0, y: 0 },
  vel: { x: 0, y: 0 },
  radius: 30,
  mass: 1,
  sound: "blob:abc123",
  lastTouchedAt: -1,
  lastReleasedAt: -1,
};

const makePage = (id, bubbles) => ({
  id,
  name: "Test",
  emoji: "🏠",
  bubbles,
  createdAt: Date.now(),
});

const SHARE_FORBIDDEN = new Set(["I", "O", "0", "1"]);

describe('addBubbleToPageDedup', () => {
  it('returns added:true for a new bubble', () => {
    const pages = [makePage('p1', [])];
    const result = addBubbleToPageDedup(pages, 'p1', ANIMAL_BUBBLE);
    assert.strictEqual(result.added, true);
    assert.strictEqual(result.pages[0].bubbles.length, 1);
    assert.strictEqual(result.pages[0].bubbles[0].builtinKey, 'cow');
  });

  it('returns added:false when same built-in builtinKey already exists', () => {
    const pages = [makePage('p1', [ANIMAL_BUBBLE])];
    const result = addBubbleToPageDedup(pages, 'p1', { ...ANIMAL_BUBBLE, id: 'b:built-in:cow-2' });
    assert.strictEqual(result.added, false);
    assert.strictEqual(result.pages[0].bubbles.length, 1);
    assert.strictEqual(result.pages[0].bubbles[0].id, 'b:built-in:cow');
  });

  it('returns added:false when same custom id already exists', () => {
    const pages = [makePage('p1', [CUSTOM_BUBBLE])];
    const result = addBubbleToPageDedup(pages, 'p1', CUSTOM_BUBBLE);
    assert.strictEqual(result.added, false);
    assert.strictEqual(result.pages[0].bubbles.length, 1);
  });

  it('allows same builtinKey on different pages', () => {
    const pages = [makePage('p1', [ANIMAL_BUBBLE]), makePage('p2', [])];
    const result = addBubbleToPageDedup(pages, 'p2', ANIMAL_BUBBLE);
    assert.strictEqual(result.added, true);
    assert.strictEqual(result.pages[1].bubbles.length, 1);
  });

  it('caps at 12 bubbles — oldest is shifted out', () => {
    const bubbles = Array.from({ length: 12 }, (_, i) => ({
      id: `b:built-in:animal${i}`,
      type: 'built-in',
      emoji: '🐄',
      builtinKey: `animal${i}`,
      pos: { x: 0, y: 0 },
      vel: { x: 0, y: 0 },
      radius: 30,
      mass: 1,
      sound: `/sounds/animal${i}.mp3`,
      lastTouchedAt: -1,
      lastReleasedAt: -1,
    }));
    const pages = [makePage('p1', bubbles)];
    const result = addBubbleToPageDedup(pages, 'p1', ANOTHER_ANIMAL_BUBBLE);
    assert.strictEqual(result.added, true);
    assert.strictEqual(result.pages[0].bubbles.length, 12);
    assert.strictEqual(result.pages[0].bubbles[0].builtinKey, 'animal1'); // animal0 was shifted
  });

  it('does not mutate original pages array', () => {
    const pages = [makePage('p1', [])];
    addBubbleToPageDedup(pages, 'p1', ANIMAL_BUBBLE);
    assert.strictEqual(pages[0].bubbles.length, 0);
  });
});

describe('deletePagePure', () => {
  it('removes the page', () => {
    const pages = [makePage('p1', []), makePage('p2', [])];
    const result = deletePagePure(pages, 'p1', new Map());
    assert.strictEqual(result.pages.length, 1);
    assert.strictEqual(result.pages[0].id, 'p2');
  });

  it('returns blob IDs for custom recordings on deleted page', () => {
    const pages = [makePage('p1', [CUSTOM_BUBBLE]), makePage('p2', [])];
    const result = deletePagePure(pages, 'p1', new Map());
    assert.deepStrictEqual(result.removedBlobs, ['b:custom:abc123']);
  });

  it('does NOT return blob IDs for built-in bubbles', () => {
    const pages = [makePage('p1', [ANIMAL_BUBBLE]), makePage('p2', [])];
    const result = deletePagePure(pages, 'p1', new Map());
    assert.deepStrictEqual(result.removedBlobs, []);
  });

  it('refuses to remove the last page', () => {
    const pages = [makePage('p1', [])];
    const result = deletePagePure(pages, 'p1', new Map());
    assert.strictEqual(result.pages.length, 1);
    assert.deepStrictEqual(result.removedBlobs, []);
  });

  it('returns unchanged when pageId not found', () => {
    const pages = [makePage('p1', [])];
    const result = deletePagePure(pages, 'nonexistent', new Map());
    assert.strictEqual(result.pages.length, 1);
  });

  it('does not mutate original pages array', () => {
    const pages = [makePage('p1', []), makePage('p2', [])];
    deletePagePure(pages, 'p1', new Map());
    assert.strictEqual(pages.length, 2);
  });
});

describe('generateShareCode', () => {
  it('returns exactly 4 characters', () => {
    for (let i = 0; i < 50; i++) {
      assert.strictEqual(generateShareCode().length, 4);
    }
  });

  it('contains no I, O, 0, or 1 characters', () => {
    for (let i = 0; i < 100; i++) {
      const code = generateShareCode();
      for (const char of code) {
        assert.strictEqual(SHARE_FORBIDDEN.has(char), false, `Unexpected forbidden char '${char}' in '${code}'`);
      }
    }
  });

  it('generates 200 codes with no duplicates', () => {
    const codes = new Set();
    for (let i = 0; i < 200; i++) {
      codes.add(generateShareCode());
    }
    assert.strictEqual(codes.size, 200);
  });

  it('only uses characters from the clean alphabet', () => {
    const ALPHABET = new Set('ABCDEFGHJKLMNPQRSTUVWXYZ23456789');
    for (let i = 0; i < 100; i++) {
      const code = generateShareCode();
      for (const char of code) {
        assert.strictEqual(ALPHABET.has(char), true, `Char '${char}' not in alphabet`);
      }
    }
  });
});

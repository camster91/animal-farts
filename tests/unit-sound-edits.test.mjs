import test, { beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { IDBFactory } from 'fake-indexeddb';
import { createDefaultPage, savePage, loadAllPages, saveBuiltInSoundToPage } from './build/recordings.js';
import { BUILT_IN_SOUNDS } from './build/constants.js';

beforeEach(() => { globalThis.indexedDB = new IDBFactory(); });
const cow = BUILT_IN_SOUNDS.find(sound => sound.key === 'cow');
const dog = BUILT_IN_SOUNDS.find(sound => sound.key === 'dog');

test('a changed sound is committed and survives reading pages again', async () => {
  const page = createDefaultPage();
  await savePage(page);
  await saveBuiltInSoundToPage(page.id, cow, page.bubbles[0].id);
  const [loaded] = await loadAllPages();
  assert.equal(loaded.bubbles[0].builtinKey, 'cow');
  assert.equal(loaded.bubbles[0].sound, cow.file);
  assert.equal(loaded.bubbles.length, page.bubbles.length);
});

test('an added card is committed without dropping existing cards', async () => {
  const page = createDefaultPage();
  await savePage(page);
  const saved = await saveBuiltInSoundToPage(page.id, cow);
  const [loaded] = await loadAllPages();
  assert.equal(loaded.bubbles.length, page.bubbles.length + 1);
  assert.equal(loaded.bubbles.at(-1).id, saved.bubbles.at(-1).id);
  assert.equal(loaded.bubbles.at(-1).sound, cow.file);
});

test('concurrent edits read the latest stored page instead of overwriting each other', async () => {
  const page = createDefaultPage();
  await savePage(page);
  await Promise.all([
    saveBuiltInSoundToPage(page.id, cow, page.bubbles[0].id),
    saveBuiltInSoundToPage(page.id, dog, page.bubbles[1].id),
  ]);
  const [loaded] = await loadAllPages();
  assert.equal(loaded.bubbles[0].builtinKey, 'cow');
  assert.equal(loaded.bubbles[1].builtinKey, 'dog');
});

test('missing cards and unavailable storage reject instead of reporting success', async () => {
  const page = createDefaultPage();
  await savePage(page);
  await assert.rejects(saveBuiltInSoundToPage(page.id, cow, 'not-a-card'));
  const [loaded] = await loadAllPages();
  assert.equal(loaded.bubbles[0].builtinKey, page.bubbles[0].builtinKey);
  globalThis.indexedDB = { open() { throw new Error('storage unavailable'); } };
  await assert.rejects(saveBuiltInSoundToPage(page.id, cow), /storage unavailable/);
});

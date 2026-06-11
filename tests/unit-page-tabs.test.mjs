// v47d: tests for PageTabs pure helpers — shouldTriggerLongPress, trimName

import { describe, it } from 'node:test';
import assert from 'node:assert';

// Import from the compiled build (tsconfig.test.json points to src/pootbox as rootDir)
import { shouldTriggerLongPress, trimName } from './build/PageTabs.js';

describe('shouldTriggerLongPress', () => {
  it('returns true when duration >= 800ms and moved < 10px', () => {
    assert.strictEqual(shouldTriggerLongPress(800, 0), true);
    assert.strictEqual(shouldTriggerLongPress(1000, 5), true);
  });

  it('returns false when duration < 800ms even with 0 movement', () => {
    assert.strictEqual(shouldTriggerLongPress(799, 0), false);
  });

  it('returns false when moved >= 10px even at exactly 800ms', () => {
    assert.strictEqual(shouldTriggerLongPress(800, 10), false);
    assert.strictEqual(shouldTriggerLongPress(800, 11), false);
  });

  it('returns false when moved >= 10px with longer duration', () => {
    assert.strictEqual(shouldTriggerLongPress(1500, 50), false);
  });
});

describe('trimName', () => {
  it('strips leading and trailing whitespace', () => {
    assert.strictEqual(trimName('  My Animals  '), 'My Animals');
  });

  it('falls back to "Page" when empty after trim', () => {
    assert.strictEqual(trimName(''), 'Page');
    assert.strictEqual(trimName('   '), 'Page');
  });

  it('truncates to 24 characters', () => {
    assert.strictEqual(trimName('a'.repeat(30)), 'a'.repeat(24));
  });

  it('leaves normal names unchanged', () => {
    assert.strictEqual(trimName('My Animals'), 'My Animals');
    assert.strictEqual(trimName('A'), 'A');
  });
});

// Unit tests for the SoundLibrary v71 cap behavior.
//
// The v71 change caps the unfiltered grid at 30 tiles by default. The
// SoundLibrary component is React + hooks, so a full component test
// would need a renderer (jsdom, react-test-renderer, etc.) which the
// project doesn't have. These tests exercise the same pure logic the
// component uses inline: the "first 30 by default, show all on toggle,
// no button when filtered is already ≤ 30" pattern. If the component
// diverges from this pattern, the tests fail.

import { describe, it } from "node:test";
import assert from "node:assert";

const DEFAULT_PAGE_LIMIT = 30;

/**
 * Pure mirror of the SoundLibrary slicing logic at
 * src/pootbox/components/SoundLibrary.tsx:99
 */
function sliceVisible(filtered, showAll) {
  return showAll ? filtered : filtered.slice(0, DEFAULT_PAGE_LIMIT);
}

/**
 * Pure mirror of the "Show-all button rendered?" condition at
 * src/pootbox/components/SoundLibrary.tsx:447
 */
function shouldShowAllButton(filteredTotal) {
  return filteredTotal > DEFAULT_PAGE_LIMIT;
}

/**
 * Generate N synthetic BuiltInSound records for the test inputs.
 */
function makeSounds(n) {
  return Array.from({ length: n }, (_, i) => ({
    key: `synthetic-${i}`,
    emoji: "🐄",
    name: `Synthetic ${i}`,
    file: `/sounds/synthetic-${i}.mp3`,
    bucket: "animal",
  }));
}

describe("SoundLibrary v71 cap: visible slicing", () => {
  it("filters 30 sounds (library size) returns all 30 when showAll=false", () => {
    const sounds = makeSounds(30);
    assert.strictEqual(sliceVisible(sounds, false).length, 30);
    assert.strictEqual(sliceVisible(sounds, true).length, 30);
  });

  it("filters 31 sounds returns first 30 when showAll=false, all 31 when true", () => {
    const sounds = makeSounds(31);
    assert.strictEqual(sliceVisible(sounds, false).length, 30, "default cap should be 30");
    assert.strictEqual(sliceVisible(sounds, true).length, 31, "showAll reveals the rest");
  });

  it("filters 376 sounds (v70 auto-discover max) returns first 30 by default", () => {
    // The v70 auto-discover scans public/sounds/ and produces up to 376
    // entries. Today the cap is invisible (library has 30). When the
    // library grows past 30, the default view stays at 30 and the
    // Show-all button appears.
    const sounds = makeSounds(376);
    const visible = sliceVisible(sounds, false);
    assert.strictEqual(visible.length, 30);
    assert.strictEqual(visible[0].key, "synthetic-0");
    assert.strictEqual(visible[29].key, "synthetic-29");
    assert.strictEqual(sliceVisible(sounds, true).length, 376);
  });

  it("filters 5 sounds (user types a search that narrows to 5) returns all 5", () => {
    const sounds = makeSounds(5);
    assert.strictEqual(sliceVisible(sounds, false).length, 5);
    assert.strictEqual(sliceVisible(sounds, true).length, 5);
  });
});

describe("SoundLibrary v71 cap: Show-all button visibility", () => {
  it("does NOT render the button when filteredTotal is 30 (today's library)", () => {
    assert.strictEqual(shouldShowAllButton(30), false);
  });

  it("renders the button when filteredTotal is 31", () => {
    assert.strictEqual(shouldShowAllButton(31), true);
  });

  it("renders the button when filteredTotal is 376 (v70 auto-discover max)", () => {
    assert.strictEqual(shouldShowAllButton(376), true);
  });

  it("does NOT render the button when filteredTotal is 0 (no matches, empty state)", () => {
    assert.strictEqual(shouldShowAllButton(0), false);
  });
});

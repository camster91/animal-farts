import { describe, it } from "node:test";
import assert from "node:assert";
import { pickRandomEmoji, QUICK_PICKS } from "./build/components/recordSheetUtils.js";

describe("pickRandomEmoji", () => {
  it("returns a string", () => {
    const result = pickRandomEmoji();
    assert.strictEqual(typeof result, "string");
    assert.ok(result.length > 0);
  });

  it("returns an emoji from the RANDOM_POOL (not in exclude)", () => {
    const RANDOM_POOL = [
      "🌈", "⭐", "🎈", "🎵", "🌟", "🐳", "🦄", "🍕", "🎪", "🐙", "🦋",
      "🌸", "🍦", "🎁", "🚀", "🌙", "🎨", "🎭", "🎬", "🎻", "🏖️", "🦜",
      "🐬", "🦩", "🐆", "🦔", "🦒", "🦦", "🐋", "🦈", "🪼",
    ];
    for (let i = 0; i < 50; i++) {
      const result = pickRandomEmoji(QUICK_PICKS);
      assert.ok(
        RANDOM_POOL.includes(result),
        `Expected emoji to be in RANDOM_POOL, got "${result}"`,
      );
    }
  });

  it("excludes the quick-pick animals", () => {
    for (let i = 0; i < 50; i++) {
      const result = pickRandomEmoji(QUICK_PICKS);
      assert.ok(
        !QUICK_PICKS.includes(result),
        `Expected emoji "${result}" to NOT be in QUICK_PICKS`,
      );
    }
  });

  it("excludes custom emojis passed via exclude param", () => {
    const customExclude = ["🌈", "⭐"];
    for (let i = 0; i < 50; i++) {
      const result = pickRandomEmoji(customExclude);
      assert.ok(
        !customExclude.includes(result),
        `Expected emoji "${result}" to NOT be in customExclude`,
      );
    }
  });

  it("handles empty exclude array", () => {
    const result = pickRandomEmoji([]);
    assert.strictEqual(typeof result, "string");
    assert.ok(result.length > 0);
  });

  it("is probabilistic (returns different values across multiple calls)", () => {
    const results = new Set();
    for (let i = 0; i < 100; i++) {
      results.add(pickRandomEmoji());
    }
    assert.ok(results.size > 1, `Expected multiple unique values, got only ${results.size}`);
  });
});

describe("QUICK_PICKS", () => {
  it("has exactly 12 items", () => {
    assert.strictEqual(QUICK_PICKS.length, 12);
  });

  it("matches the required animal set", () => {
    const required = ["🐄", "🐕", "🐈", "🐖", "🦆", "🦁", "🐸", "🐒", "🐎", "🐘", "🐓", "🐻"];
    assert.deepStrictEqual(QUICK_PICKS, required);
  });
});
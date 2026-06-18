// Unit tests for v73 server-side hardening.
// Covers Tier-2 items #8 (banned-words NFKD normalization) and
// #9 (PATCH /api/me body shape validation). The integration test
// for these lives in server-integration.test.mjs and needs a live
// server; this file is pure logic and runs in <50ms.

import { describe, it } from "node:test";
import assert from "node:assert";

// === Inline copies of the pure server functions (no JSX, no Express) ===

const BANNED_WORDS = [
  "fuck", "shit", "bitch", "cunt", "nigger", "fag", "kike",
  "piss", "ass", "whore", "crack", "dick", "cock", "pussy", "twat",
];

function normalizeForModeration(s) {
  return String(s || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[\u200B-\u200F\uFEFF]/g, "")
    .toLowerCase()
    .replace(/\s+/g, "");
}

function containsBannedWord(s) {
  const normalized = normalizeForModeration(s);
  if (!normalized) return false;
  return BANNED_WORDS.some((w) => normalized.includes(w));
}

// v73: typeof guards for PATCH /api/me. These are pure checks, the
// actual route handler is in server.js.
function validatePatchMeField(field, value) {
  if (value === undefined) return null; // field not being updated
  if (typeof value !== "string") return `${field} must be a string`;
  if (field === "displayName" && value.length > 30) return "Display name too long";
  if (field === "bio" && value.length > 200) return "Bio too long";
  return null;
}

describe("v73 moderation: normalizeForModeration", () => {
  it("lowercases ASCII", () => {
    assert.strictEqual(normalizeForModeration("FUCK"), "fuck");
  });
  it("strips combining diacritics (NFKD + Mn class)", () => {
    // f̶u̶c̶k̶ (each letter with a U+0336 combining short stroke)
    assert.strictEqual(normalizeForModeration("f̶u̶c̶k̶"), "fuck");
  });
  it("strips zero-width spaces (U+200B) between letters", () => {
    assert.strictEqual(normalizeForModeration("f\u200Bu\u200Bc\u200Bk"), "fuck");
  });
  it("strips U+FEFF (BOM) and U+200C-200F (other ZW chars)", () => {
    assert.strictEqual(normalizeForModeration("\uFEFFfu\u200Dck"), "fuck");
  });
  it("collapses whitespace", () => {
    assert.strictEqual(normalizeForModeration("  f u c k  "), "fuck");
  });
  it("handles empty / null / undefined safely", () => {
    assert.strictEqual(normalizeForModeration(""), "");
    assert.strictEqual(normalizeForModeration(null), "");
    assert.strictEqual(normalizeForModeration(undefined), "");
  });
});

describe("v73 moderation: containsBannedWord", () => {
  it("catches the original 7 word list", () => {
    for (const w of ["fuck", "shit", "bitch", "cunt", "nigger", "fag", "kike"]) {
      assert.strictEqual(containsBannedWord(w), true, `${w} must be caught`);
    }
  });
  it("catches the v73 added words", () => {
    for (const w of ["piss", "ass", "whore", "crack", "dick", "cock", "pussy", "twat"]) {
      assert.strictEqual(containsBannedWord(w), true, `${w} must be caught`);
    }
  });
  it("catches zero-width-obfuscated variants", () => {
    assert.strictEqual(containsBannedWord("f\u200Bu\u200Bc\u200Bk"), true);
    assert.strictEqual(containsBannedWord("f u c k"), true); // whitespace
  });
  it("catches diacritic-obfuscated variants (NFKD)", () => {
    // "fück" → NFKD → "fuck" (the ü decomposes to u + combining diaeresis,
    // which the regex strips)
    assert.strictEqual(containsBannedWord("fück"), true);
  });
  it("lets benign text through", () => {
    assert.strictEqual(containsBannedWord("cow"), false);
    assert.strictEqual(containsBannedWord("My Animal Sound"), false);
  });
  it("rejects empty / nullish input (defensive)", () => {
    assert.strictEqual(containsBannedWord(""), false);
    assert.strictEqual(containsBannedWord(null), false);
    assert.strictEqual(containsBannedWord(undefined), false);
  });
});

// Defensive helper: the v73 server code calls it containsBannedWord.
// This file uses the local copy, no aliasing needed.

describe("v73 PATCH /api/me: validatePatchMeField", () => {
  it("rejects non-string displayName (array)", () => {
    const err = validatePatchMeField("displayName", ["f", "u", "c", "k"]);
    assert.strictEqual(err, "displayName must be a string");
  });
  it("rejects non-string displayName (number)", () => {
    const err = validatePatchMeField("displayName", 42);
    assert.strictEqual(err, "displayName must be a string");
  });
  it("rejects non-string bio (object)", () => {
    const err = validatePatchMeField("bio", { html: "<script>" });
    assert.strictEqual(err, "bio must be a string");
  });
  it("rejects non-string handle (null)", () => {
    const err = validatePatchMeField("handle", null);
    assert.strictEqual(err, "handle must be a string");
  });
  it("accepts a normal string displayName", () => {
    assert.strictEqual(validatePatchMeField("displayName", "Mia"), null);
  });
  it("accepts undefined (field not being updated)", () => {
    assert.strictEqual(validatePatchMeField("displayName", undefined), null);
    assert.strictEqual(validatePatchMeField("bio", undefined), null);
    assert.strictEqual(validatePatchMeField("handle", undefined), null);
  });
  it("rejects displayName over 30 chars", () => {
    const err = validatePatchMeField("displayName", "a".repeat(31));
    assert.strictEqual(err, "Display name too long");
  });
  it("rejects bio over 200 chars", () => {
    const err = validatePatchMeField("bio", "a".repeat(201));
    assert.strictEqual(err, "Bio too long");
  });
  it("accepts empty string displayName (allows clearing)", () => {
    // v73 changed the gating from `if (displayName)` (truthy) to
    // `if (displayName !== undefined)` — empty string is now a valid
    // update that clears the field.
    assert.strictEqual(validatePatchMeField("displayName", ""), null);
  });
});

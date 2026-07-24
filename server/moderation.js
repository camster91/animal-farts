// Content moderation (single source of truth, shared by the server and
// the unit tests). Kept dependency-free so tests can import it without
// standing up Express.
//
// Two-tier matching fixes the Scunthorpe problem the previous single
// substring list had: short tokens that are legitimate substrings of
// innocent words ("ass" in "brass"/"class", "cock" in "cockatoo") were
// blocking harmless soundboard names. Those tokens now require a word
// boundary; only the "strong" tokens (which are almost never innocent
// substrings) keep substring matching so obfuscations like "shitface"
// and spaced-out "f u c k" are still caught after normalization.

// Strong tokens: substring match on the normalized string. These rarely
// appear inside innocent words, so substring matching is safe and lets us
// catch embedded/obfuscated variants ("shitface", "f u c k").
export const BANNED_WORDS_SUBSTRING = [
  "fuck", "shit", "bitch", "cunt", "nigger", "kike", "whore", "twat",
];

// Bounded tokens: word-boundary match only. These are substrings of
// common, innocent words (brass, class, grass, cockatoo, peacock,
// cracker, crackle, pussycat), so a raw substring check false-positives.
export const BANNED_WORDS_BOUNDED = [
  "ass", "piss", "crack", "dick", "cock", "fag", "pussy",
];

// Back-compat: the full flat list some callers/tests enumerate.
export const BANNED_WORDS = [...BANNED_WORDS_SUBSTRING, ...BANNED_WORDS_BOUNDED];

// NFKD-normalize + strip combining marks + zero-width chars + lowercase +
// collapse whitespace. This turns "f ü c k" / "f̶u̶c̶k̶" / "𝐟𝐮𝐜𝐤" into
// "fuck" before matching. NFKD first so "ﬁ" (U+FB01) decomposes to "fi".
export function normalizeForModeration(s) {
  return String(s || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "") // combining marks
    .replace(/[\u200B-\u200F\uFEFF]/g, "") // zero-width chars
    .toLowerCase()
    .replace(/\s+/g, "");
}

export function containsBannedWord(s) {
  const normalized = normalizeForModeration(s);
  if (!normalized) return false;
  if (BANNED_WORDS_SUBSTRING.some((w) => normalized.includes(w))) return true;
  // Bounded: match only when the token isn't part of a larger alphabetic
  // run. Whitespace is already collapsed, so boundaries are the string
  // edges and any non-letter char (digits, punctuation, emoji).
  return BANNED_WORDS_BOUNDED.some((w) =>
    new RegExp(`(?:^|[^a-z])${w}(?:[^a-z]|$)`).test(normalized),
  );
}

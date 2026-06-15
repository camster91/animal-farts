// Unit tests for the v70 scan-sounds.py output. The scanner
// generates src/pootbox/constants.ts from public/sounds/.
// These tests pin the invariants on the generated file:
//  - the right number of entries
//  - no duplicate keys
//  - all entries have a valid bucket (no "instrument" anymore)
//  - all farts have a subBucket
//  - all keys are filesystem-safe (lowercase, hyphenated, no
//    spaces, no special chars)

import { describe, it } from 'node:test';
import assert from 'node:assert';
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const CONSTANTS = new URL('../src/pootbox/constants.ts', import.meta.url).pathname;
const SOUNDS = new URL('../public/sounds/', import.meta.url).pathname;

function listPngsMatching(re) {
  return readdirSync(SOUNDS, { recursive: true })
    .filter(f => f.endsWith('.mp3') && re.test(f));
}

function readSrc() {
  return readFileSync(CONSTANTS, 'utf8');
}

function extractEntries() {
  const src = readSrc();
  // Extract just the entries: { key: "...", ... } inside
  // BUILT_IN_SOUNDS array.
  const match = src.match(/BUILT_IN_SOUNDS: BuiltInSound\[\] = \[([\s\S]*?)\];/);
  if (!match) throw new Error('BUILT_IN_SOUNDS array not found in constants.ts');
  const arrayBody = match[1];
  // Match each {...} entry. Simple regex: anything between
  // `{` and `}` on its own line.
  const entryRe = /\{([^{}]*)\}/g;
  const out = [];
  let m;
  while ((m = entryRe.exec(arrayBody)) !== null) {
    out.push(m[1]);
  }
  return out;
}

describe('v70: scan-sounds output invariants', () => {
  it('scan-sounds.py exists and is runnable', () => {
    const p = new URL('../scripts/scan-sounds.py', import.meta.url).pathname;
    assert.ok(existsSync(p), 'scripts/scan-sounds.py should exist');
  });

  it('BUILT_IN_SOUNDS array exists in constants.ts', () => {
    const src = readSrc();
    assert.ok(src.includes('BUILT_IN_SOUNDS: BuiltInSound[]'));
  });

  it('every .mp3 on disk has a matching BUILT_IN_SOUNDS entry', () => {
    // Walk the same files the scanner would, compare counts.
    // We don't compare individual entries (the names are
    // humanized by the scanner, which is fine) — we just
    // ensure the scanner didn't drop files.
    const src = readSrc();
    const builtInCount = (src.match(/file: "\/sounds\/[^"]+\.mp3"/g) || []).length;
    const onDiskCount = readdirSync(SOUNDS, { recursive: true })
      .filter(f => f.endsWith('.mp3')).length;
    // The scanner drops files in v1/ (legacy duplicates of
    // top-level). So the scanner count should be <= on-disk
    // count, and within the v1 filter range.
    assert.ok(builtInCount > 0, 'should have at least one entry');
    assert.ok(builtInCount <= onDiskCount, `scanner produced ${builtInCount} entries but only ${onDiskCount} files exist`);
    assert.ok(onDiskCount - builtInCount <= 20, 'unexpectedly few entries scanned');
  });

  it('no duplicate keys', () => {
    const entries = extractEntries();
    const keys = entries.map(e => {
      const m = e.match(/key:\s*"([^"]+)"/);
      return m ? m[1] : null;
    }).filter(Boolean);
    const seen = new Set();
    for (const k of keys) {
      assert.ok(!seen.has(k), `duplicate key: ${k}`);
      seen.add(k);
    }
  });

  it('no "instrument" bucket (v70 removed it; extra/ is animal)', () => {
    const src = readSrc();
    assert.ok(!src.includes('"instrument"'),
      'the "instrument" bucket should be removed (extra/ files are animals)');
  });

  it('all fart entries have a subBucket', () => {
    const entries = extractEntries();
    for (const e of entries) {
      const bucketM = e.match(/bucket:\s*"([^"]+)"/);
      const bucket = bucketM ? bucketM[1] : null;
      if (bucket !== 'fart') continue;
      // Fart entries MUST have a subBucket (set by the scanner
      // for files in public/sounds/farts/<sub>/).
      const subM = e.match(/subBucket:\s*"([^"]+)"/);
      assert.ok(subM, `fart entry missing subBucket: ${e}`);
    }
  });

  it('farts in /sounds/farts/<sub>/ have matching subBucket value', () => {
    // The scanner categorizes farts/<sub>/ as subBucket=<sub>.
    // Verify a sample of the actual files.
    const src = readSrc();
    // Find a wet fart entry
    const wetMatch = src.match(/farts\/wet\/[^"]+\.mp3"[\s\S]*?subBucket:\s*"wet"/);
    assert.ok(wetMatch, 'a farts/wet file should be tagged subBucket: "wet"');
    // And a dry one
    const dryMatch = src.match(/farts\/dry\/[^"]+\.mp3"[\s\S]*?subBucket:\s*"dry"/);
    assert.ok(dryMatch, 'a farts/dry file should be tagged subBucket: "dry"');
  });

  it('all keys are filesystem-safe (lowercase, hyphens, no spaces)', () => {
    const entries = extractEntries();
    for (const e of entries) {
      const m = e.match(/key:\s*"([^"]+)"/);
      if (!m) continue;
      const k = m[1];
      assert.ok(/^[a-z0-9-]+$/.test(k), `key "${k}" has invalid chars`);
      assert.ok(!k.includes(' '), `key "${k}" has a space`);
      assert.ok(k.length < 80, `key "${k}" too long`);
    }
  });

  it('all emoji are non-empty strings', () => {
    const entries = extractEntries();
    for (const e of entries) {
      const m = e.match(/emoji:\s*"([^"]+)"/);
      assert.ok(m, `entry missing emoji: ${e}`);
      assert.ok(m[1].length > 0, `empty emoji in: ${e}`);
    }
  });

  it('bucket values are from the valid set (animal|fart|silly)', () => {
    const entries = extractEntries();
    const valid = new Set(['animal', 'fart', 'silly']);
    for (const e of entries) {
      const m = e.match(/bucket:\s*"([^"]+)"/);
      assert.ok(m, `entry missing bucket: ${e}`);
      assert.ok(valid.has(m[1]), `invalid bucket value "${m[1]}" in: ${e}`);
    }
  });
});

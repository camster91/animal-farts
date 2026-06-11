// Unit tests for the library filter function.
// Run: npm test

import { describe, it } from 'node:test';
import assert from 'node:assert';

// === Inline copy of the pure filter function (no JSX, no React) ===

/** @type {import('../src/pootbox/types').BuiltInSound[]} */
const SOUNDS = [
  { key: 'cow',     emoji: '🐄', name: 'Cow',     file: '/sounds/cow.mp3',     bucket: 'animal' },
  { key: 'dog',     emoji: '🐕', name: 'Dog',     file: '/sounds/dog.mp3',     bucket: 'animal' },
  { key: 'cat',     emoji: '🐈', name: 'Cat',     file: '/sounds/cat.mp3',     bucket: 'animal' },
  { key: 'chicken', emoji: '🐔', name: 'Chicken',  file: '/sounds/chicken.mp3', bucket: 'animal' },
  { key: 'duck',    emoji: '🦆', name: 'Duck',    file: '/sounds/duck.mp3',    bucket: 'animal' },
  { key: 'horse',   emoji: '🐴', name: 'Horse',   file: '/sounds/horse.mp3',   bucket: 'animal' },
  { key: 'pig',     emoji: '🐷', name: 'Pig',     file: '/sounds/pig.mp3',     bucket: 'animal' },
  { key: 'lion',    emoji: '🦁', name: 'Lion',    file: '/sounds/lion.mp3',    bucket: 'animal' },
  { key: 'elephant',emoji: '🐘', name: 'Elephant',file: '/sounds/elephant.mp3',bucket: 'animal' },
  { key: 'monkey',  emoji: '🐒', name: 'Monkey',  file: '/sounds/monkey.mp3',  bucket: 'animal' },
  { key: 'fart-wet',emoji: '💦', name: 'Wet Fart',file: '/sounds/fart-wet.mp3',bucket: 'fart' },
  { key: 'fart-dry',emoji: '🌵', name: 'Dry Fart',file: '/sounds/fart-dry.mp3',bucket: 'fart' },
  { key: 'fart-long',emoji: '📏', name: 'Long Fart',file:'/sounds/fart-long.mp3',bucket:'fart'},
  { key: 'fart-bubble',emoji:'🫧',name:'Bubble Fart',file:'/sounds/fart-bubble.mp3',bucket:'fart'},
  { key: 'fart-squeak',emoji:'👃',name:'Squeak Fart',file:'/sounds/fart-squeak.mp3',bucket:'fart'},
  { key: 'fart-fart',emoji:'💨',name:'Fart',file:'/sounds/fart-fart.mp3',bucket:'fart'},
  { key: 'burp',    emoji: '🥤', name: 'Burp',   file: '/sounds/burp.mp3',    bucket: 'silly' },
  { key: 'splash',  emoji: '💥', name: 'Splash',  file: '/sounds/splash.mp3',  bucket: 'silly' },
  { key: ' hiccup', emoji: '🤰', name: 'Hiccup',  file: '/sounds/hiccup.mp3',  bucket: 'silly' },
  { key: 'slurp',   emoji: '🍜', name: 'Slurp',   file: '/sounds/slurp.mp3',   bucket: 'silly' },
  { key: 'cough',   emoji: '🤒', name: 'Cough',   file: '/sounds/cough.mp3',   bucket: 'silly' },
  { key: 'trumpet', emoji: '🎺', name: 'Trumpet', file: '/sounds/trumpet.mp3', bucket: 'instrument' },
  { key: 'trombone',emoji: '� trombone',name:'Trombone',file:'/sounds/trombone.mp3',bucket:'instrument'},
  { key: 'flute',   emoji: '🎶', name: 'Flute',   file: '/sounds/flute.mp3',   bucket: 'instrument' },
  { key: 'drum',    emoji: '🥁', name: 'Drum',    file: '/sounds/drum.mp3',    bucket: 'instrument' },
  { key: 'cymbal',  emoji: '🔔', name: 'Cymbal',  file: '/sounds/cymbal.mp3',  bucket: 'instrument' },
  { key: 'cowbell', emoji: '🔔', name: 'Cowbell', file: '/sounds/cowbell.mp3', bucket: 'instrument' },
  { key: 'airhorn', emoji: '📢', name: 'Airhorn', file: '/sounds/airhorn.mp3', bucket: 'instrument' },
  { key: 'record-scratch',emoji:'📻',name:'Record Scratch',file:'/sounds/record-scratch.mp3',bucket:'instrument'},
  { key: 'vuvuzela',emoji:'📯',name:'Vuvuzela',file:'/sounds/vuvuzela.mp3',bucket:'instrument'},
];

/**
 * @param {typeof SOUNDS} sounds
 * @param {string} search
 * @param {string} bucket
 */
function filterSounds(sounds, search, bucket) {
  const q = search.trim().toLowerCase();
  return sounds.filter((s) => {
    const matchSearch = q === '' || s.name.toLowerCase().includes(q);
    const matchBucket = bucket === 'all' || s.bucket === bucket;
    return matchSearch && matchBucket;
  });
}

describe('filterSounds', () => {
  it('search "burp" returns 1', () => {
    const result = filterSounds(SOUNDS, 'burp', 'all');
    assert.strictEqual(result.length, 1);
    assert.strictEqual(result[0].key, 'burp');
  });

  it('search "" returns all', () => {
    const result = filterSounds(SOUNDS, '', 'all');
    assert.strictEqual(result.length, SOUNDS.length);
  });

  it('bucket "fart" returns 6', () => {
    const result = filterSounds(SOUNDS, '', 'fart');
    assert.strictEqual(result.length, 6);
    assert.ok(result.every(s => s.bucket === 'fart'));
  });

  it('bucket "all" returns all', () => {
    const result = filterSounds(SOUNDS, '', 'all');
    assert.strictEqual(result.length, SOUNDS.length);
  });

  it('search "xx" returns []', () => {
    const result = filterSounds(SOUNDS, 'xx', 'all');
    assert.strictEqual(result.length, 0);
  });

  it('combined: bucket "animal" + search "cow" returns 1', () => {
    const result = filterSounds(SOUNDS, 'cow', 'animal');
    assert.strictEqual(result.length, 1);
    assert.strictEqual(result[0].key, 'cow');
  });

  it('combined: bucket "animal" + search "burp" returns 0', () => {
    const result = filterSounds(SOUNDS, 'burp', 'animal');
    assert.strictEqual(result.length, 0);
  });
});

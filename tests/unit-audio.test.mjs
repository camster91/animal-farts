// Unit tests for audioManager using Node.js built-in test runner.
// Run: npm test
// (test:build emits JS from .ts via tsc, then node --test runs the .mjs)
//
// The audioManager has been the source of 3 separate production bugs:
//   1. v32b had no cap → "wall of farts" chaos
//   2. v40a capped at 4 → still too many
//   3. v40d had a chain-reaction bug → "ton of random farts"
// These tests pin down the single-voice policy so it can't regress.

import { describe, it, beforeEach, mock } from 'node:test';
import assert from 'node:assert';
import { playSingle, stopAllSounds, isAnySoundPlaying } from './build/audioManager.js';

// === Mocks ===
// Replace HTMLAudioElement with a mock that records every action.
// We can't construct `new Audio()` directly in the source module, so
// we override the global constructor used at instantiation time.
const mockAudioInstances = [];

function MockAudio(src) {
  const instance = {
    src,
    volume: 1,
    paused: false,
    ended: false,
    errored: false,
    play: mock.fn(function () {
      return Promise.resolve();
    }),
    pause: mock.fn(function () {
      instance.paused = true;
    }),
    addEventListener: mock.fn(function (event, handler) {
      // store handler for triggering from tests
      instance['_' + event] = handler;
    }),
    removeEventListener: mock.fn(),
  };
  mockAudioInstances.push(instance);
  return instance;
}

globalThis.HTMLAudioElement = MockAudio;
globalThis.Audio = MockAudio;

describe('audioManager', () => {
  beforeEach(() => {
    stopAllSounds(); // reset state
    mockAudioInstances.length = 0;
  });

  it('playSingle creates exactly one audio element', () => {
    playSingle('/sounds/cow.mp3', 0.9);
    assert.strictEqual(mockAudioInstances.length, 1, 'one audio created');
  });

  it('playSingle sets the volume on the new audio', () => {
    playSingle('/sounds/cow.mp3', 0.5);
    assert.strictEqual(mockAudioInstances[0].volume, 0.5);
  });

  it('playSingle calls .play() on the new audio', () => {
    playSingle('/sounds/cow.mp3', 0.9);
    assert.strictEqual(mockAudioInstances[0].play.mock.calls.length, 1);
  });

  it('single-voice: a second playSingle pauses the first audio', () => {
    playSingle('/sounds/cow.mp3', 0.9);
    const first = mockAudioInstances[0];
    playSingle('/sounds/dog.mp3', 0.9);
    const second = mockAudioInstances[1];
    assert.strictEqual(first.paused, true, 'first audio should be paused');
    assert.strictEqual(second.paused, false, 'second audio should not be paused');
  });

  it('single-voice: 5 rapid playSingles produce 5 audios, but only 1 is "active"', () => {
    for (let i = 0; i < 5; i++) {
      playSingle('/sounds/' + i + '.mp3', 0.9);
    }
    assert.strictEqual(mockAudioInstances.length, 5);
    // Only the last is "active" (the rest are paused and not in the active set)
    assert.strictEqual(isAnySoundPlaying(), true);
  });

  it('stopAllSounds pauses all audios and clears the active set', () => {
    playSingle('/sounds/cow.mp3', 0.9);
    playSingle('/sounds/dog.mp3', 0.9);
    stopAllSounds();
    assert.strictEqual(mockAudioInstances[0].paused, true);
    assert.strictEqual(mockAudioInstances[1].paused, true);
    assert.strictEqual(isAnySoundPlaying(), false);
  });

  it('isAnySoundPlaying returns false after stopAllSounds', () => {
    playSingle('/sounds/cow.mp3', 0.9);
    assert.strictEqual(isAnySoundPlaying(), true);
    stopAllSounds();
    assert.strictEqual(isAnySoundPlaying(), false);
  });

  it('ended event on the active audio removes it from the set', () => {
    playSingle('/sounds/cow.mp3', 0.9);
    assert.strictEqual(isAnySoundPlaying(), true);
    // Simulate the ended event
    const audio = mockAudioInstances[0];
    audio._ended();
    assert.strictEqual(isAnySoundPlaying(), false);
  });

  it('error event on the active audio also removes it from the set', () => {
    playSingle('/sounds/cow.mp3', 0.9);
    assert.strictEqual(isAnySoundPlaying(), true);
    const audio = mockAudioInstances[0];
    audio._error();
    assert.strictEqual(isAnySoundPlaying(), false);
  });

  it('does not crash when stopAllSounds is called with no active audio', () => {
    assert.doesNotThrow(() => {
      stopAllSounds();
    });
  });

  it('does not crash when playSingle is called with src=undefined', () => {
    assert.doesNotThrow(() => {
      playSingle(undefined, 0.9);
    });
  });
});

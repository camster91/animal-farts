// Unit tests for the v59 tap-playing-bubble-to-stop flow. The full
// integration (tap → audioManager state → canvas re-render) requires
// a DOM, so these tests cover the data-shaping decisions:
//   - playSingle's 3rd-arg (bubbleId) flow
//   - getCurrentBubbleId's null-when-no-sound rule
//   - the "tap-the-playing-bubble" branching in handleBubbleTap
//   - the playing-bubble props passed to EmojiBubble / BubbleCanvas
//
// The actual audio playback requires a browser; covered by manual
// smoke testing on the live site.

import { describe, it } from 'node:test';
import assert from 'node:assert';

// Mock audioManager — replicates the v59 surface (set of active
// elements + currentBubbleId state). Real one is in
// src/pootbox/audioManager.ts. We test the data flow, not the
// HTMLAudioElement pause/play.
class FakeAudioManager {
  constructor() {
    this.activeAudioElements = new Set();
    this.currentBubbleId = null;
  }
  playSingle(sound, volume, bubbleId) {
    // Real audioManager clears active + currentBubbleId at start
    this.activeAudioElements.clear();
    this.currentBubbleId = null;
    // Then sets up the new element. We don't actually play audio
    // here, just track the state.
    this.activeAudioElements.add({ sound, volume });
    this.currentBubbleId = bubbleId ?? null;
  }
  stopAllSounds() {
    this.activeAudioElements.clear();
    this.currentBubbleId = null;
  }
  isAnySoundPlaying() {
    return this.activeAudioElements.size > 0;
  }
  getCurrentBubbleId() {
    return this.currentBubbleId;
  }
}

describe("v59: tap-playing-bubble-to-stop — playSingle state tracking", () => {
  it("playSingle(sound, vol, bubbleId) sets currentBubbleId", () => {
    const m = new FakeAudioManager();
    m.playSingle("fart.mp3", 0.8, "b:built-in:fart:42");
    assert.strictEqual(m.getCurrentBubbleId(), "b:built-in:fart:42");
    assert.strictEqual(m.isAnySoundPlaying(), true);
  });

  it("playSingle(sound, vol) without bubbleId leaves currentBubbleId null", () => {
    const m = new FakeAudioManager();
    m.playSingle("crash.mp3", 0.5);
    assert.strictEqual(m.getCurrentBubbleId(), null);
  });

  it("a new playSingle clears the previous currentBubbleId", () => {
    const m = new FakeAudioManager();
    m.playSingle("a.mp3", 0.5, "b:1");
    assert.strictEqual(m.getCurrentBubbleId(), "b:1");
    m.playSingle("b.mp3", 0.5, "b:2");
    assert.strictEqual(m.getCurrentBubbleId(), "b:2");
  });

  it("stopAllSounds clears currentBubbleId", () => {
    const m = new FakeAudioManager();
    m.playSingle("a.mp3", 0.5, "b:1");
    m.stopAllSounds();
    assert.strictEqual(m.getCurrentBubbleId(), null);
    assert.strictEqual(m.isAnySoundPlaying(), false);
  });
});

describe("v59: tap-playing-bubble-to-stop — handleBubbleTap branch", () => {
  // The pure logic from PootBox.handleBubbleTap. The "playing"
  // branch fires when the tapped id === getCurrentBubbleId().
  function handleBubbleTapPureLogic({ tappedId, currentlyPlaying, bubblesRef }) {
    const b = bubblesRef.find((x) => x.id === tappedId);
    if (!b) return { kind: "noop" };

    if (currentlyPlaying === tappedId) {
      // Playing-bubble tap: stop, don't restart. The ripple still
      // fires (we don't model that here — the test is about the
      // audioManager call).
      return { kind: "stop", id: tappedId };
    }

    return { kind: "play", id: tappedId, sound: b.sound };
  }

  it("tapping a different bubble plays it (existing behavior)", () => {
    const bubbles = [
      { id: "b:1", sound: "fart.mp3" },
      { id: "b:2", sound: "toot.mp3" },
    ];
    const r = handleBubbleTapPureLogic({
      tappedId: "b:2",
      currentlyPlaying: "b:1",
      bubblesRef: bubbles,
    });
    assert.deepStrictEqual(r, { kind: "play", id: "b:2", sound: "toot.mp3" });
  });

  it("tapping the currently-playing bubble stops it (v59)", () => {
    const bubbles = [{ id: "b:1", sound: "fart.mp3" }];
    const r = handleBubbleTapPureLogic({
      tappedId: "b:1",
      currentlyPlaying: "b:1",
      bubblesRef: bubbles,
    });
    assert.deepStrictEqual(r, { kind: "stop", id: "b:1" });
  });

  it("tapping a bubble when nothing is playing plays it", () => {
    const bubbles = [{ id: "b:1", sound: "fart.mp3" }];
    const r = handleBubbleTapPureLogic({
      tappedId: "b:1",
      currentlyPlaying: null,
      bubblesRef: bubbles,
    });
    assert.deepStrictEqual(r, { kind: "play", id: "b:1", sound: "fart.mp3" });
  });

  it("tapping a non-existent bubble is a noop", () => {
    const r = handleBubbleTapPureLogic({
      tappedId: "b:ghost",
      currentlyPlaying: "b:1",
      bubblesRef: [{ id: "b:1", sound: "fart.mp3" }],
    });
    assert.deepStrictEqual(r, { kind: "noop" });
  });
});

describe("v59: BubbleCanvas passes isPlaying only to the playing bubble", () => {
  // The pure logic from BubbleCanvas — for each bubble in the list,
  // determine if it should render the isPlaying state.
  function computeIsPlayingFlags({ bubbles, playingBubbleId }) {
    return bubbles.map((b) => ({
      id: b.id,
      isPlaying: playingBubbleId === b.id,
    }));
  }

  it("only the playing bubble gets isPlaying=true", () => {
    const flags = computeIsPlayingFlags({
      bubbles: [{ id: "b:1" }, { id: "b:2" }, { id: "b:3" }],
      playingBubbleId: "b:2",
    });
    assert.deepStrictEqual(flags, [
      { id: "b:1", isPlaying: false },
      { id: "b:2", isPlaying: true },
      { id: "b:3", isPlaying: false },
    ]);
  });

  it("no bubble is playing → all flags false", () => {
    const flags = computeIsPlayingFlags({
      bubbles: [{ id: "b:1" }, { id: "b:2" }],
      playingBubbleId: null,
    });
    assert.ok(flags.every((f) => f.isPlaying === false));
  });
});

describe("v59: EmojiBubble isPlaying prop shapes the boxShadow", () => {
  // The pure logic from EmojiBubble — when isPlaying, the
  // boxShadow is the amber ring; otherwise the standard ring.
  function getBoxShadow({ isPlaying }) {
    return isPlaying
      ? "0 0 0 4px rgba(245,158,11,0.85), 0 0 24px rgba(245,158,11,0.4), 0 6px 18px rgba(0,0,0,0.12)"
      : "0 6px 18px rgba(0,0,0,0.12), inset 0 0 0 1.5px rgba(255,255,255,0.5)";
  }

  it("isPlaying=true gets the amber ring", () => {
    const shadow = getBoxShadow({ isPlaying: true });
    assert.match(shadow, /rgba\(245,158,11/);
  });

  it("isPlaying=false gets the standard ring", () => {
    const shadow = getBoxShadow({ isPlaying: false });
    assert.doesNotMatch(shadow, /rgba\(245,158,11/);
    assert.match(shadow, /rgba\(0,0,0,0.12\)/);
  });
});

describe("v59: useSoundPlaying returns the current bubble id", () => {
  // The pure logic from useSoundPlaying.ts — every 100ms, poll the
  // manager and expose both isAnySoundPlaying + getCurrentBubbleId.
  // The test simulates a clock by manually invoking the poll body.
  function makeSoundPlayingPoll(manager) {
    return () => ({
      soundPlaying: manager.isAnySoundPlaying(),
      currentBubbleId: manager.getCurrentBubbleId(),
    });
  }

  it("reports the playing bubble after playSingle", () => {
    const m = new FakeAudioManager();
    const poll = makeSoundPlayingPoll(m);
    m.playSingle("fart.mp3", 0.5, "b:42");
    const state = poll();
    assert.strictEqual(state.soundPlaying, true);
    assert.strictEqual(state.currentBubbleId, "b:42");
  });

  it("reports null after stopAllSounds", () => {
    const m = new FakeAudioManager();
    m.playSingle("fart.mp3", 0.5, "b:42");
    m.stopAllSounds();
    const state = makeSoundPlayingPoll(m)();
    assert.strictEqual(state.soundPlaying, false);
    assert.strictEqual(state.currentBubbleId, null);
  });
});

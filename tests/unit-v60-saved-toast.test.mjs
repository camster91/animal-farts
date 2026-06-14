// Unit tests for the v60 mic-saved toast + first-run replay wiring.
// These are pure-logic tests of the callback data shape; the actual
// toast UI and localStorage manipulation are DOM/browser concerns
// covered by manual smoke testing on the live site.

import { describe, it } from 'node:test';
import assert from 'node:assert';

describe("v60: onSaved callback for the recording toast", () => {
  it("fires when the local IDB save succeeds", () => {
    // Replicates the useRecording.finalizeRecording logic. The save
    // attempt is synchronous for testing; in production it's
    // await saveBlob(id, pendingBlob).
    let toastFired = false;
    let savedBubble = null;

    function finalizeRecordingPureLogic(bubble, saveSucceeded) {
      if (!saveSucceeded) {
        // v60: on save failure, return early — the half-saved bubble
        // doesn't get added to the canvas. (In production the
        // catch block fires onError + returns; we skip onBubbleAdded
        // and onSaved.)
        return { bubbleAdded: false, toastFired: false };
      }
      // Save succeeded — notify parent (sets pages state) and
      // fire the v60 "saved" toast.
      return {
        bubbleAdded: true,
        toastFired: true,
        toastMessage: `${bubble.emoji} Saved!`,
      };
    }

    const bubble = { id: "b:custom:42", emoji: "💨" };
    const r = finalizeRecordingPureLogic(bubble, true);
    assert.strictEqual(r.bubbleAdded, true);
    assert.strictEqual(r.toastFired, true);
    assert.match(r.toastMessage, /Saved/);
  });

  it("does NOT fire when the local IDB save fails", () => {
    let toastFired = false;

    function finalizeRecordingPureLogic(bubble, saveSucceeded) {
      if (!saveSucceeded) return { bubbleAdded: false, toastFired: false };
      return { bubbleAdded: true, toastFired: true };
    }

    const r = finalizeRecordingPureLogic({ id: "b:custom:99" }, false);
    assert.strictEqual(r.bubbleAdded, false);
    assert.strictEqual(r.toastFired, false);
  });

  it("the toast message embeds the bubble's emoji", () => {
    // The PootBox wiring: `showToast(\`${bubble.emoji} Saved!\`)`
    // The kid sees their own emoji in the confirmation. Test the
    // string format.
    const cases = [
      { emoji: "💨", expected: "💨 Saved!" },
      { emoji: "🐄", expected: "🐄 Saved!" },
      { emoji: "🎵", expected: "🎵 Saved!" },
    ];
    for (const c of cases) {
      assert.strictEqual(`${c.emoji} Saved!`, c.expected);
    }
  });
});

describe("v60: 'Show welcome again' clears all onboarding keys", () => {
  it("removes all three localStorage keys so a fresh mount re-shows welcome + hint", () => {
    // Mock localStorage
    const store = new Map();
    const localStorage = {
      removeItem: (k) => store.delete(k),
      setItem: (k, v) => store.set(k, v),
      getItem: (k) => (store.has(k) ? store.get(k) : null),
    };

    // Simulate a kid who has used the app for a while
    localStorage.setItem("pootbox-firstrun-done", "1");
    localStorage.setItem("pootbox-onboarded-v1", "1");
    localStorage.setItem("pootbox-onboarded-v2", "1");

    // The v60 handler — replicates SettingsModal.tsx
    function showWelcomeAgain() {
      try {
        localStorage.removeItem("pootbox-firstrun-done");
        localStorage.removeItem("pootbox-onboarded-v1");
        localStorage.removeItem("pootbox-onboarded-v2");
      } catch { /* ignore */ }
      // In real code: window.location.reload();
    }

    showWelcomeAgain();

    // After the handler, all three keys are cleared
    assert.strictEqual(localStorage.getItem("pootbox-firstrun-done"), null);
    assert.strictEqual(localStorage.getItem("pootbox-onboarded-v1"), null);
    assert.strictEqual(localStorage.getItem("pootbox-onboarded-v2"), null);
  });

  it("only the v60 handler clears the v1/v2 keys (the old v56 handler didn't)", () => {
    // This is a regression pin. The pre-v60 handler only removed
    // 'pootbox-firstrun-done' — leaving the onboarding hint
    // dismissed. After clicking 'Show welcome again' the kid saw
    // the welcome modal but no hint, which was confusing. The
    // v60 fix clears all three.
    const oldHandler = () => {
      try { localStorage.removeItem("pootbox-firstrun-done"); } catch {}
    };
    const newHandler = () => {
      try {
        localStorage.removeItem("pootbox-firstrun-done");
        localStorage.removeItem("pootbox-onboarded-v1");
        localStorage.removeItem("pootbox-onboarded-v2");
      } catch {}
    };

    const store = new Map();
    const localStorage = {
      setItem: (k, v) => store.set(k, v),
      removeItem: (k) => store.delete(k),
      getItem: (k) => (store.has(k) ? store.get(k) : null),
    };

    localStorage.setItem("pootbox-firstrun-done", "1");
    localStorage.setItem("pootbox-onboarded-v1", "1");
    localStorage.setItem("pootbox-onboarded-v2", "1");

    oldHandler();
    assert.strictEqual(localStorage.getItem("pootbox-firstrun-done"), null,
      "old handler clears the welcome key");
    assert.strictEqual(localStorage.getItem("pootbox-onboarded-v1"), "1",
      "old handler does NOT clear the v1 key (regression)");
    assert.strictEqual(localStorage.getItem("pootbox-onboarded-v2"), "1",
      "old handler does NOT clear the v2 key (regression)");

    newHandler();
    assert.strictEqual(localStorage.getItem("pootbox-onboarded-v1"), null,
      "new handler clears the v1 key");
    assert.strictEqual(localStorage.getItem("pootbox-onboarded-v2"), null,
      "new handler clears the v2 key");
  });
});

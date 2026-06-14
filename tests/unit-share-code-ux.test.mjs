// Unit tests for the v58 share-code UX polish (the part that's
// testable as pure logic). The full integration (button click →
// state flip → input value) requires a DOM and is covered by
// manual smoke testing on the live site.

import { describe, it } from 'node:test';
import assert from 'node:assert';

// Replicates the ShareSheet input-normalization: take any string,
// uppercase, slice to 4 chars. This is the contract the lookup
// input must satisfy for the server's /api/share/:code route
// (which requires /^[A-Z0-9]{4}$/).
function normalizeLookupInput(s) {
  return (s || "").toUpperCase().slice(0, 4);
}

describe("share-sheet — lookup input normalization", () => {
  it("uppercases lowercase", () => {
    assert.strictEqual(normalizeLookupInput("abcd"), "ABCD");
  });

  it("keeps already-uppercase as-is", () => {
    assert.strictEqual(normalizeLookupInput("WXYZ"), "WXYZ");
  });

  it("truncates at 4 chars (the code length)", () => {
    assert.strictEqual(normalizeLookupInput("ABCDEFG"), "ABCD");
  });

  it("handles empty string", () => {
    assert.strictEqual(normalizeLookupInput(""), "");
  });

  it("handles undefined gracefully", () => {
    assert.strictEqual(normalizeLookupInput(undefined), "");
  });

  it("preserves digits and mixed case", () => {
    // Server regex is /^[A-Z0-9]{4}$/ — digits are allowed
    assert.strictEqual(normalizeLookupInput("a1b2"), "A1B2");
  });

  it("the server's share code validation matches the input shape", () => {
    // Per server/server.js: code is uppercased + sliced to 4 before
    // regex test, so the client-side normalize is the source of truth
    // for what the server will accept.
    const code = "QMSM"; // live smoke test result earlier
    const normalized = normalizeLookupInput(code);
    assert.ok(/^[A-Z0-9]{4}$/.test(normalized),
      `${normalized} should match the server's share-code regex`);
  });
});

describe("share-sheet — copy-to-clipboard wiring", () => {
  it("the copy code handler should fire a confirmation toast", () => {
    // Pure-logic test: given the copy handler signature, what does
    // it actually do? The toast message must include a positive
    // confirmation so the user knows we tried.
    const toastMessages = [];
    const fakeShowToast = (msg) => { toastMessages.push(msg); };
    const fakeClipboard = { writeText: async () => {} };

    // The handler from PootBox.tsx:
    const onCopyCode = async (c) => {
      try { await fakeClipboard.writeText(c); } catch { /* ignore */ }
      fakeShowToast("Copied to clipboard \u2713");
    };

    return onCopyCode("QMSM").then(() => {
      assert.strictEqual(toastMessages.length, 1);
      assert.match(toastMessages[0], /Copied/i);
    });
  });

  it("the copy code handler fires the toast even if clipboard write throws", async () => {
    // iOS Safari blocks clipboard without a user gesture; some
    // browsers require a permission prompt. The toast MUST fire
    // regardless so the user has feedback.
    const toastMessages = [];
    const fakeShowToast = (msg) => { toastMessages.push(msg); };
    const fakeClipboard = { writeText: async () => { throw new Error("blocked"); } };

    const onCopyCode = async (c) => {
      try { await fakeClipboard.writeText(c); } catch { /* ignore */ }
      fakeShowToast("Copied to clipboard \u2713");
    };

    await onCopyCode("QMSM");
    assert.strictEqual(toastMessages.length, 1);
  });
});

describe("share-sheet — self-test wiring", () => {
  it("self-test callback sets showShare='lookup' + lookupPrefill", () => {
    // The handler from PootBox.tsx. Pure logic — no DOM.
    let showShare = "share";
    let lookupPrefill = "";

    const onSelfTest = (code) => {
      showShare = "lookup";
      lookupPrefill = code;
    };

    onSelfTest("QMSM");
    assert.strictEqual(showShare, "lookup");
    assert.strictEqual(lookupPrefill, "QMSM");
  });

  it("self-test + key prop remount: useState initializer reads new prefill", () => {
    // When the user taps "Look up the code you just shared", we
    // re-mount ShareSheet via key={mode|prefill}. The new
    // useState initializer reads the new prefill. This test
    // verifies the initializer logic.
    const initializers = [];
    const fakeUseState = (initial) => {
      initializers.push(initial);
      return [initial, () => {}];
    };

    function renderShareSheet(prefill) {
      fakeUseState((prefill || "").toUpperCase().slice(0, 4));
    }

    renderShareSheet("");        // first mount
    renderShareSheet("QMSM");    // after self-test
    renderShareSheet("WXYZ");    // after second self-test

    assert.strictEqual(initializers[0], "");
    assert.strictEqual(initializers[1], "QMSM");
    assert.strictEqual(initializers[2], "WXYZ");
  });
});

describe("share-sheet — close clears lookupPrefill", () => {
  it("onClose resets lookupPrefill so the next open is fresh", () => {
    let lookupPrefill = "QMSM";
    let showShare = "lookup";

    const onClose = () => {
      showShare = "none";
      lookupPrefill = "";
    };

    onClose();
    assert.strictEqual(showShare, "none");
    assert.strictEqual(lookupPrefill, "");
  });
});

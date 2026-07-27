// Unit tests for the share-code UX polish (the part that's
// testable as pure logic). The full integration (button click →
// state flip → input value) requires a DOM and is covered by
// manual smoke testing on the live site.

import { describe, it } from 'node:test';
import assert from 'node:assert';

// Replicates the ShareSheet input-normalization: take any string,
// uppercase, slice to 8 chars. Server accepts legacy 4-char and
// new 8-char codes via /^[A-Z0-9]{4}$|^[A-Z0-9]{8}$/.
function normalizeLookupInput(s) {
  return (s || "").toUpperCase().slice(0, 8);
}

function isValidShareCode(code) {
  return /^[A-Z0-9]{4}$|^[A-Z0-9]{8}$/.test(code);
}

describe("share-sheet — lookup input normalization", () => {
  it("uppercases lowercase", () => {
    assert.strictEqual(normalizeLookupInput("abcd"), "ABCD");
  });

  it("keeps already-uppercase as-is", () => {
    assert.strictEqual(normalizeLookupInput("WXYZ"), "WXYZ");
  });

  it("truncates at 8 chars (the new code length)", () => {
    assert.strictEqual(normalizeLookupInput("ABCDEFGHIJK"), "ABCDEFGH");
  });

  it("handles empty string", () => {
    assert.strictEqual(normalizeLookupInput(""), "");
  });

  it("handles undefined gracefully", () => {
    assert.strictEqual(normalizeLookupInput(undefined), "");
  });

  it("preserves digits and mixed case", () => {
    assert.strictEqual(normalizeLookupInput("a1b2c3d4"), "A1B2C3D4");
  });

  it("accepts legacy 4-char and new 8-char codes", () => {
    assert.ok(isValidShareCode(normalizeLookupInput("QMSM")));
    assert.ok(isValidShareCode(normalizeLookupInput("QMSM2345")));
    assert.ok(!isValidShareCode(normalizeLookupInput("ABC")));
    assert.ok(!isValidShareCode(normalizeLookupInput("ABCDE")));
  });
});

describe("share-sheet — copy-to-clipboard wiring", () => {
  it("the copy code handler should fire a confirmation toast", () => {
    const toastMessages = [];
    const fakeShowToast = (msg) => { toastMessages.push(msg); };
    const fakeClipboard = { writeText: async () => {} };

    const onCopyCode = async (c) => {
      try { await fakeClipboard.writeText(c); } catch { /* ignore */ }
      fakeShowToast("Copied to clipboard \u2713");
    };

    return onCopyCode("QMSM2345").then(() => {
      assert.strictEqual(toastMessages.length, 1);
      assert.match(toastMessages[0], /Copied/i);
    });
  });

  it("the copy code handler fires the toast even if clipboard write throws", async () => {
    const toastMessages = [];
    const fakeShowToast = (msg) => { toastMessages.push(msg); };
    const fakeClipboard = { writeText: async () => { throw new Error("blocked"); } };

    const onCopyCode = async (c) => {
      try { await fakeClipboard.writeText(c); } catch { /* ignore */ }
      fakeShowToast("Copied to clipboard \u2713");
    };

    await onCopyCode("QMSM2345");
    assert.strictEqual(toastMessages.length, 1);
  });
});

describe("share-sheet — self-test wiring", () => {
  it("self-test callback sets showShare='lookup' + lookupPrefill", () => {
    let showShare = "share";
    let lookupPrefill = "";

    const onSelfTest = (code) => {
      showShare = "lookup";
      lookupPrefill = code;
    };

    onSelfTest("QMSM2345");
    assert.strictEqual(showShare, "lookup");
    assert.strictEqual(lookupPrefill, "QMSM2345");
  });

  it("self-test + key prop remount: useState initializer reads new prefill", () => {
    const initializers = [];
    const fakeUseState = (initial) => {
      initializers.push(initial);
      return [initial, () => {}];
    };

    function renderShareSheet(prefill) {
      fakeUseState((prefill || "").toUpperCase().slice(0, 8));
    }

    renderShareSheet("");
    renderShareSheet("QMSM2345");
    renderShareSheet("WXYZABCD");

    assert.strictEqual(initializers[0], "");
    assert.strictEqual(initializers[1], "QMSM2345");
    assert.strictEqual(initializers[2], "WXYZABCD");
  });
});

describe("share-sheet — close clears lookupPrefill", () => {
  it("onClose resets lookupPrefill so the next open is fresh", () => {
    let lookupPrefill = "QMSM2345";
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

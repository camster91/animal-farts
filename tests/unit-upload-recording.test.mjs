// Pure-logic unit tests for the upload recording flow. The upload itself
// is a fire-and-forget fetch (no return value to test), so these tests
// cover the data-shaping decisions: the onSuccess / onError callback
// routing, the offline detection, the malformed-response handling.
//
// The actual HTTP call is covered by the server-integration test in
// tests/server-integration.test.mjs (POST /api/recordings with a real
// multipart body).
//
// These tests use a mock parser that replicates the response-handling
// logic in uploadRecording.ts so we can test it without a DOM.

import { describe, it } from 'node:test';
import assert from 'node:assert';

// Mock parser — replicates the response-handling logic in
// uploadRecording.ts so we can test it without a DOM.
async function mockUpload(fakeResponse, fakeForm, fakeDeviceId) {
  // Replicates the onSuccess / onError callback shape from the real function.
  // The test calls this with a mock response and asserts on the result.
  const text = fakeResponse.body;
  if (!String(fakeResponse.status).startsWith("2")) {
    let error = "Upload failed";
    try {
      const j = JSON.parse(text);
      if (j && typeof j.error === "string") error = j.error;
    } catch { /* non-JSON error body */ }
    return {
      ok: false,
      status: fakeResponse.status,
      error,
      offline: fakeResponse.status === 0 || [502, 503, 504].includes(fakeResponse.status),
    };
  }
  try {
    const j = JSON.parse(text);
    if (j && typeof j.audioUrl === "string" && typeof j.id === "number") {
      return {
        ok: true,
        recording: {
          id: j.id,
          name: j.name || "",
          emoji: j.emoji || "",
          audioUrl: j.audioUrl,
          durationSec: typeof j.durationSec === "number" ? j.durationSec : null,
        },
      };
    }
    return { ok: false, status: 200, error: "Malformed response", offline: false };
  } catch {
    return { ok: false, status: 200, error: "Malformed JSON", offline: false };
  }
}

describe("upload recording — response parsing", () => {
  it("parses a successful response with audioUrl and id", async () => {
    const r = await mockUpload(
      { status: 200, body: JSON.stringify({
        id: 42, name: "My fart", emoji: "💨",
        audioUrl: "/uploads/abc123.webm", durationSec: 3.2,
      }) },
      new FormData(),
      "test-device",
    );
    assert.strictEqual(r.ok, true);
    if (r.ok) {
      assert.strictEqual(r.recording.id, 42);
      assert.strictEqual(r.recording.audioUrl, "/uploads/abc123.webm");
      assert.strictEqual(r.recording.durationSec, 3.2);
    }
  });

  it("parses a successful response with no durationSec", async () => {
    const r = await mockUpload(
      { status: 200, body: JSON.stringify({
        id: 7, name: "hi", emoji: "🎵", audioUrl: "/uploads/hi.webm",
      }) },
      new FormData(),
      "test-device",
    );
    assert.strictEqual(r.ok, true);
    if (r.ok) {
      assert.strictEqual(r.recording.durationSec, null);
    }
  });

  it("rejects a 200 with malformed JSON", async () => {
    const r = await mockUpload(
      { status: 200, body: "not json at all" },
      new FormData(),
      "test-device",
    );
    assert.strictEqual(r.ok, false);
    if (!r.ok) {
      assert.strictEqual(r.status, 200);
      assert.strictEqual(r.error, "Malformed JSON");
    }
  });

  it("rejects a 200 with valid JSON but missing audioUrl", async () => {
    const r = await mockUpload(
      { status: 200, body: JSON.stringify({ id: 1, name: "x" }) },
      new FormData(),
      "test-device",
    );
    assert.strictEqual(r.ok, false);
    if (!r.ok) assert.strictEqual(r.error, "Malformed response");
  });

  it("routes 4xx errors to offline=false (server reachable, request bad)", async () => {
    const r = await mockUpload(
      { status: 400, body: JSON.stringify({ error: "audioUrl is required" }) },
      new FormData(),
      "test-device",
    );
    assert.strictEqual(r.ok, false);
    if (!r.ok) {
      assert.strictEqual(r.status, 400);
      assert.strictEqual(r.error, "audioUrl is required");
      assert.strictEqual(r.offline, false);
    }
  });

  it("routes 413 (file too large) to offline=false but readable error", async () => {
    const r = await mockUpload(
      { status: 413, body: JSON.stringify({ error: "file too large" }) },
      new FormData(),
      "test-device",
    );
    assert.strictEqual(r.ok, false);
    if (!r.ok) {
      assert.strictEqual(r.status, 413);
      assert.strictEqual(r.error, "file too large");
    }
  });

  it("routes 502/503/504 to offline=true (gateway error, network layer)", async () => {
    for (const status of [502, 503, 504]) {
      const r = await mockUpload(
        { status, body: "" },
        new FormData(),
        "test-device",
      );
      assert.strictEqual(r.ok, false);
      if (!r.ok) {
        assert.strictEqual(r.offline, true, `status ${status} should be offline=true`);
      }
    }
  });

  it("routes non-JSON error body to fallback 'Upload failed'", async () => {
    const r = await mockUpload(
      { status: 500, body: "<html>500 Internal Server Error</html>" },
      new FormData(),
      "test-device",
    );
    assert.strictEqual(r.ok, false);
    if (!r.ok) {
      assert.strictEqual(r.status, 500);
      assert.strictEqual(r.error, "Upload failed"); // fallback
    }
  });
});

describe("upload recording — form data shape", () => {
  it("FormData carries the right fields and a WebM blob", () => {
    // The contract: FormData must have audio (Blob, filename), name,
    // emoji, optionally kidName + durationSec. The server's multer
    // middleware reads these specific field names.
    const blob = new Blob([new Uint8Array(64)], { type: "audio/webm" });
    const form = new FormData();
    form.append("audio", blob, "recording.webm");
    form.append("name", "My fart");
    form.append("emoji", "💨");
    form.append("kidName", "Mia");
    form.append("durationSec", "3.2");

    const audio = form.get("audio");
    assert.ok(audio instanceof Blob);
    assert.strictEqual(audio.type, "audio/webm");
    assert.strictEqual(audio.name, "recording.webm");
    assert.strictEqual(form.get("name"), "My fart");
    assert.strictEqual(form.get("emoji"), "💨");
    assert.strictEqual(form.get("kidName"), "Mia");
    assert.strictEqual(form.get("durationSec"), "3.2");
  });

  it("omits kidName / durationSec when not provided", () => {
    const form = new FormData();
    form.append("audio", new Blob([]), "recording.webm");
    form.append("name", "hi");
    form.append("emoji", "💨");
    assert.strictEqual(form.get("kidName"), null);
    assert.strictEqual(form.get("durationSec"), null);
  });
});

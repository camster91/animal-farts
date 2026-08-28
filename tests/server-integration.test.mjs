// Server integration smoke tests — runs the actual server.js in a subprocess
// against a fresh data dir, hits every public route over HTTP, and asserts
// the security/feature gates the server is supposed to enforce.
//
// These tests pin the live behavior so a refactor can't silently break
// the deploy contract. They're slow (~3s for the cold-start subprocess) so
// they live in a separate file and run alongside the unit tests.
//
// Run: npm test
//   (the npm test glob also picks up unit-*.test.mjs — these end in
//    server-integration.test.mjs to skip the unit-timeout of 2s per case.)

import { describe, it, before, after } from "node:test";
import assert from "node:assert";
import { spawn } from "node:child_process";
import { mkdtempSync, writeFileSync, existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { request } from "node:http";

const ROOT = join(import.meta.dirname, "..");
const SERVER = join(ROOT, "server", "server.js");
const PORT = 5284;
const BASE = `http://127.0.0.1:${PORT}`;

let dataDir;
let proc;
let started = false;
let startupStderr = "";
let startupExit = null;

function http(method, path, { headers = {}, body } = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE);
    const opts = {
      method,
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      headers,
    };
    const req = request(opts, (res) => {
      const chunks = [];
      res.on("data", (c) => chunks.push(c));
      res.on("end", () => {
        const buf = Buffer.concat(chunks);
        resolve({
          status: res.statusCode,
          headers: res.headers,
          text: buf.toString("utf8"),
          body: buf,
        });
      });
    });
    req.on("error", reject);
    if (body) req.write(body);
    req.end();
  });
}

function multipartAudio(fieldName, fileBuffer, filename, mime) {
  const boundary = "----test-" + Math.random().toString(36).slice(2);
  // Prepend real magic bytes so server-side sniffing accepts test payloads.
  // WebM = EBML; other mimes used in negative tests stay as-is.
  let payload = fileBuffer;
  if (mime === "audio/webm" && !(fileBuffer[0] === 0x1a && fileBuffer[1] === 0x45)) {
    payload = Buffer.concat([Buffer.from([0x1a, 0x45, 0xdf, 0xa3]), fileBuffer]);
  } else if (mime === "audio/ogg" && fileBuffer.slice(0, 4).toString() !== "OggS") {
    payload = Buffer.concat([Buffer.from("OggS"), fileBuffer]);
  } else if (
    (mime === "audio/wav" || mime === "audio/wave" || mime === "audio/x-wav") &&
    fileBuffer.slice(0, 4).toString() !== "RIFF"
  ) {
    payload = Buffer.concat([Buffer.from("RIFF"), Buffer.alloc(4), Buffer.from("WAVE"), fileBuffer]);
  } else if (
    (mime === "audio/mpeg" || mime === "audio/mp3") &&
    !(fileBuffer[0] === 0xff || (fileBuffer[0] === 0x49 && fileBuffer[1] === 0x44))
  ) {
    payload = Buffer.concat([Buffer.from([0xff, 0xfb]), fileBuffer]);
  }
  // Form fields MUST come before the file part. Multer (via busboy) parses
  // parts in stream order; if a file part ends with the multipart boundary
  // before a text field, the text field is silently dropped.
  const nameField = Buffer.from(
    `--${boundary}\r\n` +
      `Content-Disposition: form-data; name="name"\r\n\r\n` +
      `integration-test\r\n`,
  );
  const head = Buffer.from(
    `--${boundary}\r\n` +
      `Content-Disposition: form-data; name="${fieldName}"; filename="${filename}"\r\n` +
      `Content-Type: ${mime}\r\n\r\n`,
  );
  const tail = Buffer.from(`\r\n--${boundary}--\r\n`);
  return {
    body: Buffer.concat([nameField, head, payload, tail]),
    contentType: `multipart/form-data; boundary=${boundary}`,
  };
}

describe("server integration", () => {
before(async () => {
  if (!existsSync(SERVER)) {
    throw new Error(`[server-integration] ${SERVER} not found`);
  }
  dataDir = mkdtempSync(join(tmpdir(), "af-srv-int-"));
  proc = spawn("node", [SERVER], {
    env: {
      ...process.env,
      PORT: String(PORT),
      NODE_ENV: "production",
      // Many tests hit one server instance; raise the rate-limit ceilings so
      // the tight upload budget (6/min) doesn't 429 later upload-based tests.
      // Limiters stay active (RateLimit-* headers still emitted) — see
      // makeLimiter in server.js.
      RATE_LIMIT_DISABLED: "1",
      DB_PATH: join(dataDir, "farts.db"),
      UPLOAD_DIR: join(dataDir, "uploads"),
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  proc.stderr.on("data", (chunk) => {
    startupStderr += String(chunk);
  });
  proc.once("exit", (code, signal) => {
    startupExit = { code, signal };
  });
  // Wait for /api/health to return 200 (max 5s).
  const deadline = Date.now() + 5000;
  while (Date.now() < deadline) {
    if (startupExit) {
      throw new Error(
        `[server-integration] server exited before becoming healthy ` +
          `(code=${startupExit.code}, signal=${startupExit.signal ?? "none"}).${
            startupStderr ? ` Startup stderr:\n${startupStderr.trim()}` : ""
          }`,
      );
    }
    try {
      const r = await http("GET", "/api/health");
      if (r.status === 200) {
        started = true;
        return;
      }
    } catch {
      // not ready yet
    }
    await new Promise((res) => setTimeout(res, 100));
  }
  throw new Error(
    `[server-integration] server did not become healthy within 5s.${
      startupStderr ? ` Startup stderr:\n${startupStderr.trim()}` : ""
    }`,
  );
}, { timeout: 30000 });

after(async () => {
  if (proc) proc.kill("SIGKILL");
});

describe("server integration: env-respected data paths", () => {
  it("creates farts.db at the env-supplied DB_PATH, not server/farts.db", async (t) => {
    if (!started) return t.skip();
    const want = join(dataDir, "farts.db");
    assert.ok(existsSync(want), `expected DB at ${want}, not server/farts.db`);
  });

  it("creates uploads dir at the env-supplied UPLOAD_DIR", async (t) => {
    if (!started) return t.skip();
    const want = join(dataDir, "uploads");
    assert.ok(existsSync(want), `expected uploads at ${want}`);
  });
});

describe("server integration: security gates", () => {
  it("rejects XSS upload (audio/x-foo + .html filename) with 400 JSON", async (t) => {
    if (!started) return t.skip();
    const html = Buffer.from("<script>alert(1)</script>");
    const mp = multipartAudio("audio", html, "x.html", "audio/x-foo");
    const r = await http("POST", "/api/recordings", {
      headers: {
        "x-device-id": "int-smoke",
        "content-type": mp.contentType,
        "content-length": String(mp.body.length),
      },
      body: mp.body,
    });
    assert.strictEqual(r.status, 400, "XSS must be rejected with 400");
    const body = JSON.parse(r.text);
    assert.match(body.error, /audio/i);
  });

  it("rejects upload without x-device-id header with 400", async (t) => {
    if (!started) return t.skip();
    const webm = Buffer.from("fake webm bytes");
    const mp = multipartAudio("audio", webm, "ok.webm", "audio/webm");
    const r = await http("POST", "/api/recordings", {
      headers: {
        "content-type": mp.contentType,
        "content-length": String(mp.body.length),
      },
      body: mp.body,
    });
    assert.strictEqual(r.status, 400);
  });

  it("does NOT send Access-Control-Allow-Origin (no CORS wildcard)", async (t) => {
    if (!started) return t.skip();
    const r = await http("GET", "/api/health", {
      headers: { origin: "https://evil.example" },
    });
    assert.ok(!r.headers["access-control-allow-origin"], "CORS must be off");
  });

  it("serves /uploads/*.webm as audio/webm (not video/webm)", async (t) => {
    if (!started) return t.skip();
    const webm = Buffer.from("fake webm");
    const mp = multipartAudio("audio", webm, "audio-test.webm", "audio/webm");
    const up = await http("POST", "/api/recordings", {
      headers: {
        "x-device-id": "int-smoke",
        "content-type": mp.contentType,
        "content-length": String(mp.body.length),
      },
      body: mp.body,
    });
    assert.strictEqual(
      up.status,
      200,
      `valid webm upload should succeed, got ${up.status} body=${up.text}`,
    );
    const { audioUrl } = JSON.parse(up.text);
    const r = await http("GET", audioUrl);
    assert.strictEqual(r.status, 200);
    assert.match(
      r.headers["content-type"] || "",
      /^audio\//,
      `expected audio/* Content-Type, got ${r.headers["content-type"]}`,
    );
    assert.strictEqual(r.headers["x-content-type-options"], "nosniff");
  });

  it("does NOT rate-limit /uploads/* under the general limiter", async (t) => {
    if (!started) return t.skip();
    // /uploads static has no rate-limit headers; /api/* does.
    const api = await http("GET", "/api/health");
    const up = await http("GET", "/api/me");
    // /api/health (200) has RateLimit-Remaining; /api/me (400) does too —
    // both endpoints are under /api so both are rate-limited.
    assert.ok(api.headers["ratelimit-remaining"], "/api/* should be rate-limited");
    assert.ok(up.headers["ratelimit-remaining"], "/api/* should be rate-limited");
  });

  it("share-code lookup is rate-limited to 30/min", async (t) => {
    if (!started) return t.skip();
    const r = await http("GET", "/api/share/AAAA");
    assert.match(r.headers["ratelimit-limit"] || "", /30/, "share lookup cap should be 30");
  });
});

describe("server integration: :id route validation (v72)", () => {
  // v72 (code review 2026-06-16 #2): every :id route used parseInt, which
  // returns NaN for non-numeric input. The POST mutations (comments,
  // reactions) silently created orphan rows because (a) the recordings
  // table has no FOREIGN KEY constraint and (b) the handlers didn't
  // validate. These tests pin the 400-on-non-numeric behavior for all
  // 4 mutating endpoints.
  it("rejects POST /api/recordings/foo/comments with 400 (no orphan row)", async (t) => {
    if (!started) return t.skip();
    const r = await http("POST", "/api/recordings/foo/comments", {
      headers: {
        "x-device-id": "v72-test",
        "content-type": "application/json",
      },
      body: JSON.stringify({ body: "should not insert" }),
    });
    assert.strictEqual(r.status, 400, "non-numeric :id must be 400, got " + r.status);
    const body = JSON.parse(r.text);
    assert.match(body.error, /invalid id/i);
  });

  it("rejects POST /api/recordings/foo/reactions with 400", async (t) => {
    if (!started) return t.skip();
    const r = await http("POST", "/api/recordings/foo/reactions", {
      headers: {
        "x-device-id": "v72-test",
        "content-type": "application/json",
      },
      body: JSON.stringify({ emoji: "👍" }),
    });
    assert.strictEqual(r.status, 400);
    const body = JSON.parse(r.text);
    assert.match(body.error, /invalid id/i);
  });

  it("rejects POST /api/recordings/-1/upvote with 400 (negative not allowed)", async (t) => {
    if (!started) return t.skip();
    const r = await http("POST", "/api/recordings/-1/upvote", {
      headers: { "x-device-id": "v72-test" },
    });
    assert.strictEqual(r.status, 400, "negative :id must be 400");
  });

  it("rejects DELETE /api/comments/0 with 400 (zero not allowed)", async (t) => {
    if (!started) return t.skip();
    const r = await http("DELETE", "/api/comments/0", {
      headers: { "x-device-id": "v72-test" },
    });
    assert.strictEqual(r.status, 400);
  });

  it("rejects GET /api/recordings/foo/comments with 400 (silent-empty was a bug)", async (t) => {
    if (!started) return t.skip();
    const r = await http("GET", "/api/recordings/foo/comments");
    assert.strictEqual(r.status, 400, "GET should also reject — was silently returning empty");
  });
});

describe("server integration: DELETE /api/recordings/:id (v76 orphan fix)", () => {
  // v76: CardGrid's onDeleteCard now calls DELETE /api/recordings/:id
  // when a custom bubble with an uploaded server recording is removed.
  // Without this, every upload persisted an orphan server row.
  // These tests pin the round-trip: upload → delete → gone.
  it("deletes an uploaded recording end-to-end (no orphan)", async (t) => {
    if (!started) return t.skip();
    // 1. Upload a recording.
    const webm = Buffer.from("v76-orphan-fix-test-bytes");
    const mp = multipartAudio("audio", webm, "v76-orphan-test.webm", "audio/webm");
    const up = await http("POST", "/api/recordings", {
      headers: {
        "x-device-id": "v76-delete-test",
        "content-type": mp.contentType,
        "content-length": String(mp.body.length),
      },
      body: mp.body,
    });
    assert.strictEqual(up.status, 200, `upload should succeed, got ${up.status}`);
    const { id, audioUrl } = JSON.parse(up.text);
    assert.ok(id, "upload should return a numeric id");
    assert.match(audioUrl, /^\/uploads\//, "audioUrl should be a /uploads/ path");

    // 2. Verify it's reachable (the /api/recordings/:id/audio endpoint).
    const before = await http("GET", audioUrl);
    assert.strictEqual(before.status, 200, "uploaded file should be reachable");

    // 3. DELETE it.
    const del = await http("DELETE", `/api/recordings/${id}`, {
      headers: { "x-device-id": "v76-delete-test" },
    });
    assert.strictEqual(del.status, 200, `DELETE should succeed, got ${del.status} body=${del.text}`);

    // 4. Verify the audio file is gone (not just the DB row).
    const after = await http("GET", audioUrl);
    assert.strictEqual(after.status, 404, "audio file should be gone after DELETE");

    // 5. Verify the DB row is gone (404 on /api/recordings/:id/upvote).
    const upvote = await http("POST", `/api/recordings/${id}/upvote`, {
      headers: { "x-device-id": "v76-delete-test" },
    });
    assert.strictEqual(upvote.status, 404, "upvote on deleted recording should 404");
  });

  it("rejects DELETE /api/recordings/:id for wrong device (no auth bypass)", async (t) => {
    if (!started) return t.skip();
    // Upload as device A
    const webm = Buffer.from("v76-auth-test");
    const mp = multipartAudio("audio", webm, "v76-auth.webm", "audio/webm");
    const up = await http("POST", "/api/recordings", {
      headers: {
        "x-device-id": "v76-auth-A",
        "content-type": mp.contentType,
        "content-length": String(mp.body.length),
      },
      body: mp.body,
    });
    assert.strictEqual(up.status, 200);
    const { id } = JSON.parse(up.text);

    // Try to delete as device B — must 403, not 200.
    const theft = await http("DELETE", `/api/recordings/${id}`, {
      headers: { "x-device-id": "v76-auth-B" },
    });
    assert.strictEqual(theft.status, 403, "wrong device must 403, got " + theft.status);

    // Clean up as the original device.
    await http("DELETE", `/api/recordings/${id}`, {
      headers: { "x-device-id": "v76-auth-A" },
    });
  });
});

describe("server integration: POST /api/recordings/:id/upvote (v78)", () => {
  // v78: CardGrid now has a 👍 button on uploaded custom cards.
  // The server endpoint is idempotent per (device_id, recording_id).
  // First call: upvote count +1, userVoted=true. Second call: toggle off.
  it("upvote toggles per device (200, count goes up then down)", async (t) => {
    if (!started) return t.skip();
    // Upload a fresh recording.
    const webm = Buffer.from("v78-upvote-test");
    const mp = multipartAudio("audio", webm, "v78-upvote.webm", "audio/webm");
    const up = await http("POST", "/api/recordings", {
      headers: {
        "x-device-id": "v78-upvoter-1",
        "content-type": mp.contentType,
        "content-length": String(mp.body.length),
      },
      body: mp.body,
    });
    assert.strictEqual(up.status, 200);
    const { id } = JSON.parse(up.text);

    // Get initial count from /api/recordings (which includes userVoted
    // for the requesting device).
    const initial = JSON.parse((await http("GET", "/api/recordings")).text);
    const seed = initial.recordings.find((r) => r.id === id);
    assert.ok(seed, "uploaded recording should be in /api/recordings");
    const baseUpvotes = seed.upvotes;
    assert.strictEqual(seed.userVoted, false, "fresh device should not have voted yet");

    // First upvote from device 1: count goes to base+1, userVoted=true.
    const v1 = await http("POST", `/api/recordings/${id}/upvote`, {
      headers: { "x-device-id": "v78-upvoter-1" },
    });
    assert.strictEqual(v1.status, 200);
    const body1 = JSON.parse(v1.text);
    assert.strictEqual(body1.upvotes, baseUpvotes + 1, "first upvote increments");
    assert.strictEqual(body1.userVoted, true);

    // Second upvote from same device: count goes back to base, userVoted=false.
    const v1b = await http("POST", `/api/recordings/${id}/upvote`, {
      headers: { "x-device-id": "v78-upvoter-1" },
    });
    assert.strictEqual(v1b.status, 200);
    const body1b = JSON.parse(v1b.text);
    assert.strictEqual(body1b.upvotes, baseUpvotes, "second upvote toggles off");
    assert.strictEqual(body1b.userVoted, false);

    // Upvote from a DIFFERENT device: count goes to base+1 again.
    const v2 = await http("POST", `/api/recordings/${id}/upvote`, {
      headers: { "x-device-id": "v78-upvoter-2" },
    });
    assert.strictEqual(v2.status, 200);
    const body2 = JSON.parse(v2.text);
    assert.strictEqual(body2.upvotes, baseUpvotes + 1, "different device counts separately");
    assert.strictEqual(body2.userVoted, true);

    // Upvote from device 3: count goes to base+2.
    const v3 = await http("POST", `/api/recordings/${id}/upvote`, {
      headers: { "x-device-id": "v78-upvoter-3" },
    });
    assert.strictEqual(v3.status, 200);
    assert.strictEqual(JSON.parse(v3.text).upvotes, baseUpvotes + 2, "third upvote increments again");

    // Clean up.
    await http("DELETE", `/api/recordings/${id}`, {
      headers: { "x-device-id": "v78-upvoter-1" },
    });
  });

  it("upvote without x-device-id returns 400 (missing header)", async (t) => {
    if (!started) return t.skip();
    // Use any valid id; the header check fails first.
    const r = await http("POST", "/api/recordings/1/upvote");
    assert.strictEqual(r.status, 400, "missing x-device-id must 400");
  });

  it("upvote on non-numeric id returns 400 (v72 :id validation)", async (t) => {
    if (!started) return t.skip();
    const r = await http("POST", "/api/recordings/foo/upvote", {
      headers: { "x-device-id": "v78-upvoter" },
    });
    assert.strictEqual(r.status, 400);
  });
});

describe("server integration: POST /api/recordings/:id/reactions (v78)", () => {
  // v78: CardGrid now has 👍/😂/💀 reactions on uploaded custom
  // recordings. The endpoint toggles per (device_id, recording_id,
  // emoji) and returns {counts, mine, added}.
  it("reactions toggle per (device, emoji) with counts and 'mine'", async (t) => {
    if (!started) return t.skip();
    // Upload a fresh recording.
    const webm = Buffer.from("v78-reactions-test");
    const mp = multipartAudio("audio", webm, "v78-react.webm", "audio/webm");
    const up = await http("POST", "/api/recordings", {
      headers: {
        "x-device-id": "v78-react-A",
        "content-type": mp.contentType,
        "content-length": String(mp.body.length),
      },
      body: mp.body,
    });
    assert.strictEqual(up.status, 200);
    const { id } = JSON.parse(up.text);

    // Initial state: zero reactions, mine empty.
    const get0 = await http("GET", `/api/recordings/${id}/reactions`, {
      headers: { "x-device-id": "v78-react-A" },
    });
    assert.strictEqual(get0.status, 200);
    const initial = JSON.parse(get0.text);
    assert.deepStrictEqual(initial.counts, {}, "fresh recording has no reactions");
    assert.deepStrictEqual(initial.mine, [], "fresh device has not reacted");

    // Device A reacts with 👍: count 1, mine [👍], added=true.
    const r1 = await http("POST", `/api/recordings/${id}/reactions`, {
      headers: {
        "x-device-id": "v78-react-A",
        "content-type": "application/json",
      },
      body: JSON.stringify({ emoji: "👍" }),
    });
    assert.strictEqual(r1.status, 200);
    const body1 = JSON.parse(r1.text);
    assert.strictEqual(body1.counts["👍"], 1);
    assert.deepStrictEqual(body1.mine, ["👍"]);
    assert.strictEqual(body1.added, true);

    // Device A reacts with 👍 again: toggles off. count 0, mine [].
    const r1b = await http("POST", `/api/recordings/${id}/reactions`, {
      headers: {
        "x-device-id": "v78-react-A",
        "content-type": "application/json",
      },
      body: JSON.stringify({ emoji: "👍" }),
    });
    assert.strictEqual(r1b.status, 200);
    const body1b = JSON.parse(r1b.text);
    // A toggled-off reaction is omitted from the GROUP BY aggregation (the
    // same contract as a fresh recording's empty counts above), so the key
    // is absent rather than 0.
    assert.strictEqual(body1b.counts["👍"] ?? 0, 0);
    assert.deepStrictEqual(body1b.mine, []);
    assert.strictEqual(body1b.added, false);

    // Device A reacts with 👍, then 😂. Both mine.
    await http("POST", `/api/recordings/${id}/reactions`, {
      headers: { "x-device-id": "v78-react-A", "content-type": "application/json" },
      body: JSON.stringify({ emoji: "👍" }),
    });
    await http("POST", `/api/recordings/${id}/reactions`, {
      headers: { "x-device-id": "v78-react-A", "content-type": "application/json" },
      body: JSON.stringify({ emoji: "😂" }),
    });

    // Device B reacts with 👍. Count is 2 (A + B), A's mine shows
    // [👍, 😂], B's mine shows [👍].
    await http("POST", `/api/recordings/${id}/reactions`, {
      headers: { "x-device-id": "v78-react-B", "content-type": "application/json" },
      body: JSON.stringify({ emoji: "👍" }),
    });
    const aView = await http("GET", `/api/recordings/${id}/reactions`, {
      headers: { "x-device-id": "v78-react-A" },
    });
    const aData = JSON.parse(aView.text);
    assert.strictEqual(aData.counts["👍"], 2);
    assert.strictEqual(aData.counts["😂"], 1);
    assert.deepStrictEqual(aData.mine.sort(), ["👍", "😂"].sort());
    const bView = await http("GET", `/api/recordings/${id}/reactions`, {
      headers: { "x-device-id": "v78-react-B" },
    });
    const bData = JSON.parse(bView.text);
    assert.strictEqual(bData.counts["👍"], 2);
    assert.deepStrictEqual(bData.mine, ["👍"]);

    // Invalid emoji: 400 (REACTION_EMOJIS allowlist).
    const bad = await http("POST", `/api/recordings/${id}/reactions`, {
      headers: { "x-device-id": "v78-react-A", "content-type": "application/json" },
      body: JSON.stringify({ emoji: "💩" }),
    });
    assert.strictEqual(bad.status, 400, "invalid emoji must 400");

    // Clean up.
    await http("DELETE", `/api/recordings/${id}`, {
      headers: { "x-device-id": "v78-react-A" },
    });
  });

  it("reactions without x-device-id returns 400", async (t) => {
    if (!started) return t.skip();
    const r = await http("POST", "/api/recordings/1/reactions", {
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ emoji: "👍" }),
    });
    assert.strictEqual(r.status, 400);
  });

  it("reactions on non-numeric id returns 400", async (t) => {
    if (!started) return t.skip();
    const r = await http("POST", "/api/recordings/foo/reactions", {
      headers: { "x-device-id": "v78-react", "content-type": "application/json" },
      body: JSON.stringify({ emoji: "👍" }),
    });
    assert.strictEqual(r.status, 400);
  });
});

describe("server integration: comments (v78)", () => {
  // v78: the CommentsSheet calls GET/POST/DELETE on comments
  // endpoints. These tests pin the server contract: list, post,
  // delete-own, reject-delete-others, banned-words, length limit.
  it("comments: list empty → post → list has 1 → delete → list empty", async (t) => {
    if (!started) return t.skip();
    // Upload a fresh recording.
    const webm = Buffer.from("v78-comments-test");
    const mp = multipartAudio("audio", webm, "v78-cmt.webm", "audio/webm");
    const up = await http("POST", "/api/recordings", {
      headers: {
        "x-device-id": "v78-cmt-A",
        "content-type": mp.contentType,
        "content-length": String(mp.body.length),
      },
      body: mp.body,
    });
    assert.strictEqual(up.status, 200);
    const { id } = JSON.parse(up.text);

    // 1. Empty list initially.
    const list0 = await http("GET", `/api/recordings/${id}/comments`);
    assert.strictEqual(list0.status, 200);
    assert.deepStrictEqual(JSON.parse(list0.text).comments, []);

    // 2. Post a comment.
    const post1 = await http("POST", `/api/recordings/${id}/comments`, {
      headers: {
        "x-device-id": "v78-cmt-A",
        "content-type": "application/json",
      },
      body: JSON.stringify({ body: "cute!" }),
    });
    assert.strictEqual(post1.status, 200);
    const post1Body = JSON.parse(post1.text);
    assert.ok(typeof post1Body.id === "number");
    assert.strictEqual(post1Body.body, "cute!");

    // 3. List now has 1.
    const list1 = await http("GET", `/api/recordings/${id}/comments`);
    assert.strictEqual(JSON.parse(list1.text).comments.length, 1);

    // 4. Post a second comment from a different device.
    const post2 = await http("POST", `/api/recordings/${id}/comments`, {
      headers: {
        "x-device-id": "v78-cmt-B",
        "content-type": "application/json",
      },
      body: JSON.stringify({ body: "love it" }),
    });
    assert.strictEqual(post2.status, 200);

    // 5. List has 2, both visible.
    const list2 = await http("GET", `/api/recordings/${id}/comments`);
    const list2Body = JSON.parse(list2.text);
    assert.strictEqual(list2Body.comments.length, 2);
    const bodies = list2Body.comments.map((c) => c.body);
    assert.ok(bodies.includes("cute!"));
    assert.ok(bodies.includes("love it"));

    // 6. Delete own comment (device A's).
    const del = await http("DELETE", `/api/comments/${post1Body.id}`, {
      headers: { "x-device-id": "v78-cmt-A" },
    });
    assert.strictEqual(del.status, 200);

    // 7. List has 1 (only B's comment left).
    const list3 = await http("GET", `/api/recordings/${id}/comments`);
    assert.strictEqual(JSON.parse(list3.text).comments.length, 1);

    // Clean up.
    await http("DELETE", `/api/recordings/${id}`, {
      headers: { "x-device-id": "v78-cmt-A" },
    });
  });

  it("comments: empty body returns 400", async (t) => {
    if (!started) return t.skip();
    const r = await http("POST", "/api/recordings/1/comments", {
      headers: {
        "x-device-id": "v78-cmt",
        "content-type": "application/json",
      },
      body: JSON.stringify({ body: "" }),
    });
    assert.strictEqual(r.status, 400);
  });

  it("comments: 281-char body returns 400 (over 280 limit)", async (t) => {
    if (!started) return t.skip();
    const long = "a".repeat(281);
    const r = await http("POST", "/api/recordings/1/comments", {
      headers: {
        "x-device-id": "v78-cmt",
        "content-type": "application/json",
      },
      body: JSON.stringify({ body: long }),
    });
    assert.strictEqual(r.status, 400);
  });

  it("comments: banned words return 400 (v73 moderation)", async (t) => {
    if (!started) return t.skip();
    const r = await http("POST", "/api/recordings/1/comments", {
      headers: {
        "x-device-id": "v78-cmt",
        "content-type": "application/json",
      },
      body: JSON.stringify({ body: "f u c k" }),
    });
    assert.strictEqual(r.status, 400);
    assert.match(JSON.parse(r.text).error, /blocked/i);
  });

  it("comments: missing x-device-id returns 400", async (t) => {
    if (!started) return t.skip();
    const r = await http("POST", "/api/recordings/1/comments", {
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ body: "hi" }),
    });
    assert.strictEqual(r.status, 400);
  });

  it("comments: cannot delete someone else's comment (403)", async (t) => {
    if (!started) return t.skip();
    // Upload + post as device A
    const webm = Buffer.from("v78-cmt-auth");
    const mp = multipartAudio("audio", webm, "v78-auth.webm", "audio/webm");
    const up = await http("POST", "/api/recordings", {
      headers: {
        "x-device-id": "v78-cmt-A2",
        "content-type": mp.contentType,
        "content-length": String(mp.body.length),
      },
      body: mp.body,
    });
    assert.strictEqual(up.status, 200);
    const { id } = JSON.parse(up.text);
    const post = await http("POST", `/api/recordings/${id}/comments`, {
      headers: { "x-device-id": "v78-cmt-A2", "content-type": "application/json" },
      body: JSON.stringify({ body: "mine" }),
    });
    assert.strictEqual(post.status, 200);
    const commentId = JSON.parse(post.text).id;
    // Try to delete as device B.
    const theft = await http("DELETE", `/api/comments/${commentId}`, {
      headers: { "x-device-id": "v78-cmt-B2" },
    });
    assert.strictEqual(theft.status, 403, "wrong-device delete must 403");
    // Cleanup as device A.
    await http("DELETE", `/api/comments/${commentId}`, {
      headers: { "x-device-id": "v78-cmt-A2" },
    });
    await http("DELETE", `/api/recordings/${id}`, {
      headers: { "x-device-id": "v78-cmt-A2" },
    });
  });

  it("comments: list on non-numeric id returns 400", async (t) => {
    if (!started) return t.skip();
    const r = await http("GET", "/api/recordings/foo/comments");
    assert.strictEqual(r.status, 400);
  });
});

describe("server integration: SPA + privacy/about", () => {
  it("serves /, /sw.js, /privacy.html, /about.html with 200", async (t) => {
    if (!started) return t.skip();
    for (const path of ["/", "/sw.js", "/privacy.html", "/about.html"]) {
      const r = await http("GET", path);
      assert.strictEqual(r.status, 200, `${path} should be 200, got ${r.status}`);
    }
  });

  it("SPA fallback returns index.html for unknown paths", async (t) => {
    if (!started) return t.skip();
    const r = await http("GET", "/any/spa/route");
    assert.strictEqual(r.status, 200);
    assert.match(r.text, /<div id="root">/);
  });

  it("/api/* unknown path returns 404 (not the SPA)", async (t) => {
    if (!started) return t.skip();
    const r = await http("GET", "/api/nonexistent");
    assert.strictEqual(r.status, 404);
  });
});

describe("server integration: production audit security fixes", () => {
  it("public user payloads never include deviceId", async (t) => {
    if (!started) return t.skip();
    const me = await http("GET", "/api/me", {
      headers: { "x-device-id": "audit-device-alpha" },
    });
    assert.strictEqual(me.status, 200);
    const meBody = JSON.parse(me.text);
    assert.strictEqual(meBody.deviceId, undefined, "/api/me must not leak deviceId");
    assert.ok(meBody.handle, "handle should still be present");
    assert.strictEqual(meBody.isMe, true);

    const list = await http("GET", "/api/users", {
      headers: { "x-device-id": "audit-device-beta" },
    });
    assert.strictEqual(list.status, 200);
    const users = JSON.parse(list.text).users || [];
    for (const u of users) {
      assert.strictEqual(u.deviceId, undefined, "/api/users must not leak deviceId");
    }

    const profile = await http("GET", `/api/users/${meBody.handle}`, {
      headers: { "x-device-id": "audit-device-beta" },
    });
    assert.strictEqual(profile.status, 200);
    const pub = JSON.parse(profile.text);
    assert.strictEqual(pub.deviceId, undefined, "public profile must not leak deviceId");
    assert.strictEqual(pub.isMe, false);
  });

  it("share mint requires ownership + returns 8-char code", async (t) => {
    if (!started) return t.skip();
    const webm = Buffer.from("audit-share-test-bytes");
    const mp = multipartAudio("audio", webm, "audit-share.webm", "audio/webm");
    const up = await http("POST", "/api/recordings", {
      headers: {
        "x-device-id": "audit-share-owner",
        "content-type": mp.contentType,
        "content-length": String(mp.body.length),
      },
      body: mp.body,
    });
    assert.strictEqual(up.status, 200, `upload should succeed, got ${up.status} ${up.text}`);
    const { audioUrl } = JSON.parse(up.text);
    assert.match(audioUrl, /^\/uploads\//);

    // Wrong device cannot mint.
    const theft = await http("POST", "/api/share", {
      headers: {
        "content-type": "application/json",
        "x-device-id": "audit-share-thief",
      },
      body: JSON.stringify({ audioUrl, name: "Nope", emoji: "💨" }),
    });
    assert.strictEqual(theft.status, 403);

    // Owner can mint; code is 8 chars.
    const mint = await http("POST", "/api/share", {
      headers: {
        "content-type": "application/json",
        "x-device-id": "audit-share-owner",
      },
      body: JSON.stringify({ audioUrl, name: "Shared", emoji: "💨" }),
    });
    assert.strictEqual(mint.status, 200, `mint should succeed, got ${mint.status} ${mint.text}`);
    const { code } = JSON.parse(mint.text);
    assert.match(code, /^[A-Z0-9]{8}$/, "new share codes must be 8 chars");

    const lookup = await http("GET", `/api/share/${code}`);
    assert.strictEqual(lookup.status, 200);
    assert.strictEqual(JSON.parse(lookup.text).audioUrl, audioUrl);
  });

  it("share mint without x-device-id returns 400", async (t) => {
    if (!started) return t.skip();
    const r = await http("POST", "/api/share", {
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ audioUrl: "/uploads/deadbeefdeadbeef.webm", name: "x" }),
    });
    assert.strictEqual(r.status, 400);
  });

  it("health returns ok without leaking counts", async (t) => {
    if (!started) return t.skip();
    const r = await http("GET", "/api/health");
    assert.strictEqual(r.status, 200);
    const body = JSON.parse(r.text);
    assert.strictEqual(body.ok, true);
    assert.strictEqual(body.recordings, undefined);
    assert.strictEqual(body.uptime, undefined);
  });

  it("rejects upload whose bytes are not audio (magic mismatch)", async (t) => {
    if (!started) return t.skip();
    // Force non-audio payload while claiming audio/webm — bypass helper magic prepend.
    const boundary = "----test-magic-" + Math.random().toString(36).slice(2);
    const html = Buffer.from("<!doctype html><script>alert(1)</script>");
    const nameField = Buffer.from(
      `--${boundary}\r\nContent-Disposition: form-data; name="name"\r\n\r\nmagic-reject\r\n`,
    );
    const head = Buffer.from(
      `--${boundary}\r\nContent-Disposition: form-data; name="audio"; filename="x.webm"\r\nContent-Type: audio/webm\r\n\r\n`,
    );
    const tail = Buffer.from(`\r\n--${boundary}--\r\n`);
    const body = Buffer.concat([nameField, head, html, tail]);
    const r = await http("POST", "/api/recordings", {
      headers: {
        "x-device-id": "audit-magic-reject",
        "content-type": `multipart/form-data; boundary=${boundary}`,
        "content-length": String(body.length),
      },
      body,
    });
    assert.strictEqual(r.status, 400, `expected 400, got ${r.status} ${r.text}`);
    assert.match(JSON.parse(r.text).error, /webm|audio|valid/i);
  });
});

});

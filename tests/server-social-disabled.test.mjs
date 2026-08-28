import { after, before, describe, it } from "node:test";
import assert from "node:assert";
import { spawn } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { request } from "node:http";

const ROOT = join(import.meta.dirname, "..");
const PORT = 5285;
const BASE = `http://127.0.0.1:${PORT}`;
let proc;

function http(method, path, body) {
  return new Promise((resolve, reject) => {
    const payload = body === undefined ? null : Buffer.from(JSON.stringify(body));
    const url = new URL(path, BASE);
    const req = request({
      method,
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      headers: payload ? { "content-type": "application/json", "content-length": payload.length } : {},
    }, (res) => {
      res.resume();
      res.on("end", () => resolve(res.statusCode));
    });
    req.on("error", reject);
    if (payload) req.write(payload);
    req.end();
  });
}

before(async () => {
  const dataDir = mkdtempSync(join(tmpdir(), "af-social-off-"));
  proc = spawn("node", [join(ROOT, "server", "server.js")], {
    env: {
      ...process.env,
      PORT: String(PORT),
      DB_PATH: join(dataDir, "farts.db"),
      UPLOAD_DIR: join(dataDir, "uploads"),
      SOCIAL_FEATURES_ENABLED: "0",
      RATE_LIMIT_DISABLED: "1",
    },
    stdio: "ignore",
  });
  const deadline = Date.now() + 5000;
  while (Date.now() < deadline) {
    try {
      if (await http("GET", "/api/health") === 200) return;
    } catch { /* server is still starting */ }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error("social-disabled test server did not start");
});

after(() => proc?.kill("SIGKILL"));

describe("v1 child-safety boundary", () => {
  const disabled = [
    ["GET", "/api/recordings"],
    ["POST", "/api/recordings/1/upvote"],
    ["GET", "/api/recordings/1/comments"],
    ["POST", "/api/recordings/1/comments"],
    ["GET", "/api/recordings/1/reactions"],
    ["POST", "/api/recordings/1/reactions"],
    ["DELETE", "/api/comments/1"],
    ["GET", "/api/me"],
    ["PATCH", "/api/me"],
    ["GET", "/api/feed"],
    ["GET", "/api/users"],
    ["GET", "/api/users/test_user"],
    ["POST", "/api/users/test_user/follow"],
  ];

  for (const [method, path] of disabled) {
    it(`${method} ${path} is not exposed`, async () => {
      assert.strictEqual(await http(method, path, {}), 404);
    });
  }

  it("keeps health and private share-code lookup available", async () => {
    assert.strictEqual(await http("GET", "/api/health"), 200);
    assert.strictEqual(await http("GET", "/api/share/NOPE"), 404);
  });

  it("keeps recording upload and owner deletion routes available", async () => {
    assert.strictEqual(await http("POST", "/api/recordings", {}), 400);
    assert.strictEqual(await http("DELETE", "/api/recordings/1"), 400);
  });
});

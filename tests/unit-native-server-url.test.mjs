import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { PRODUCTION_SERVER_ORIGIN, serverUrl } from "./build/lib/serverUrl.js";

describe("native server URL routing", () => {
  it("keeps browser requests same-origin", () => {
    assert.equal(serverUrl("/api/health", false), "/api/health");
  });

  it("routes native requests to the production HTTPS server", () => {
    assert.equal(serverUrl("/api/recordings", true), `${PRODUCTION_SERVER_ORIGIN}/api/recordings`);
  });

  it("normalizes an injected server origin", () => {
    assert.equal(serverUrl("/uploads/test.webm", true, "https://example.test/"), "https://example.test/uploads/test.webm");
  });

  it("rejects paths that are not safe root-relative paths", () => {
    assert.throws(() => serverUrl("api/health", true), TypeError);
    assert.throws(() => serverUrl("//evil.example/steal", true), TypeError);
    assert.throws(() => serverUrl("/\\evil.example/steal", true), TypeError);
  });

  it("rejects insecure or credential-bearing native origins", () => {
    assert.throws(() => serverUrl("/api/health", true, "http://example.test"), TypeError);
    assert.throws(() => serverUrl("/api/health", true, "https://user:pass@example.test"), TypeError);
  });
});

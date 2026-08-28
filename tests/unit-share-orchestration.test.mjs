import { describe, it } from "node:test";
import assert from "node:assert";

const modulePath = new URL("./build/shareOrchestration.js", import.meta.url);
const {
  ShareMintError,
  createSharedPage,
  lookupShareCode,
  mintShareCode,
} = await import(modulePath);

const page = {
  id: "page-1",
  name: "My page",
  emoji: "💨",
  createdAt: 1,
  bubbles: [{
    id: "bubble-1",
    type: "custom",
    emoji: "🐮",
    sound: "/uploads/recording.webm",
    pos: { x: 0, y: 0 },
    vel: { x: 0, y: 0 },
    radius: 36,
    mass: 1,
    lastTouchedAt: -1,
    lastReleasedAt: -1,
  }],
};

describe("share orchestration", () => {
  it("mints the first durable uploaded recording with device ownership", async () => {
    let request;
    const code = await mintShareCode({
      page,
      deviceId: "device_1234",
      fetchImpl: async (url, init) => {
        request = { url, init };
        return new Response(JSON.stringify({ code: "ABCDEFGH" }), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      },
    });
    assert.strictEqual(code, "ABCDEFGH");
    assert.strictEqual(request.url, "/api/share");
    assert.strictEqual(request.init.headers["x-device-id"], "device_1234");
    assert.deepStrictEqual(JSON.parse(request.init.body), {
      audioUrl: "/uploads/recording.webm",
      name: "My page",
      emoji: "🐮",
    });
  });

  it("distinguishes no recording, server rejection, and network failure", async () => {
    await assert.rejects(
      mintShareCode({ page: { ...page, bubbles: [] }, deviceId: "device_1234" }),
      (error) => error instanceof ShareMintError && error.kind === "no-recording",
    );
    await assert.rejects(
      mintShareCode({
        page,
        deviceId: "device_1234",
        fetchImpl: async () => new Response(JSON.stringify({ error: "Not yours" }), {
          status: 403,
          headers: { "content-type": "application/json" },
        }),
      }),
      (error) => error instanceof ShareMintError && error.kind === "request" && error.message === "Not yours",
    );
    await assert.rejects(
      mintShareCode({ page, deviceId: "device_1234", fetchImpl: async () => { throw new Error("offline"); } }),
      (error) => error instanceof ShareMintError && error.kind === "network",
    );
  });

  it("makes offline lookup explicit and treats missing codes as null", async () => {
    assert.deepStrictEqual(
      await lookupShareCode({ code: "abcd1234", online: false }),
      { __offline: true, code: "ABCD1234" },
    );
    assert.strictEqual(
      await lookupShareCode({
        code: "abcd1234",
        online: true,
        fetchImpl: async () => new Response("", { status: 404 }),
      }),
      null,
    );
  });

  it("propagates cancellation instead of reporting a missing code", async () => {
    const controller = new AbortController();
    controller.abort();
    await assert.rejects(
      lookupShareCode({
        code: "ABCDEFGH",
        online: true,
        signal: controller.signal,
        fetchImpl: async (_url, init) => {
          throw init.signal.reason ?? new DOMException("Aborted", "AbortError");
        },
      }),
      (error) => error === controller.signal.reason,
    );
  });

  it("creates a deterministic persisted imported page", () => {
    const imported = createSharedPage({
      code: "ABCDEFGH",
      audioUrl: "/uploads/shared.webm",
      name: "Shared cow",
      emoji: "🐮",
    }, 1234);
    assert.strictEqual(imported.id, "page:share-ABCDEFGH-1234");
    assert.strictEqual(imported.bubbles[0].id, "b:shared:ABCDEFGH:1234");
    assert.strictEqual(imported.bubbles[0].sound, "/uploads/shared.webm");
    assert.strictEqual(imported.createdAt, 1234);
  });
});

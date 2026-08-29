import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import { gzipSync } from "node:zlib";
import { describe, it } from "node:test";

const assetsDir = new URL("../dist/assets/", import.meta.url);
const assetNames = await readdir(assetsDir);

async function sizes(extension) {
  const names = assetNames.filter((name) => name.endsWith(extension));
  const contents = await Promise.all(names.map((name) => readFile(new URL(name, assetsDir))));
  return {
    names,
    raw: contents.reduce((total, content) => total + content.byteLength, 0),
    gzip: contents.reduce((total, content) => total + gzipSync(content).byteLength, 0),
  };
}

describe("production bundle budgets", () => {
  it("keeps the complete JavaScript payload bounded", async () => {
    const javascript = await sizes(".js");
    assert.ok(javascript.names.length > 0, "build did not emit JavaScript assets");
    assert.ok(javascript.raw <= 380 * 1024, `JavaScript raw size ${javascript.raw} exceeds 380 KiB`);
    assert.ok(javascript.gzip <= 115 * 1024, `JavaScript gzip size ${javascript.gzip} exceeds 115 KiB`);
  });

  it("keeps the initial entry and stylesheet payloads bounded", async () => {
    const entryNames = assetNames.filter((name) => /^index-[^.]+\.js$/.test(name));
    assert.equal(entryNames.length, 1, "expected exactly one hashed entry bundle");
    const entry = await readFile(new URL(entryNames[0], assetsDir));
    const css = await sizes(".css");
    assert.ok(gzipSync(entry).byteLength <= 70 * 1024, "entry JavaScript exceeds 70 KiB gzip");
    assert.ok(css.gzip <= 5 * 1024, `CSS gzip size ${css.gzip} exceeds 5 KiB`);
  });
});

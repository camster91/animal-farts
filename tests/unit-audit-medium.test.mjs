// Unit tests for audio magic-byte sniffing + kid-safe error mapping.

import { describe, it } from "node:test";
import assert from "node:assert";
import { writeFileSync, unlinkSync, mkdtempSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { verifyAudioMagic } from "../server/audioMagic.js";
import { kidSafeError } from "./build/lib/kidSafeError.js";

describe("verifyAudioMagic", () => {
  const dir = mkdtempSync(join(tmpdir(), "af-magic-"));

  function write(name, bytes) {
    const p = join(dir, name);
    writeFileSync(p, Buffer.from(bytes));
    return p;
  }

  it("accepts WebM EBML header", () => {
    const p = write("a.webm", [0x1a, 0x45, 0xdf, 0xa3, 0x00, 0x00]);
    assert.strictEqual(verifyAudioMagic(p, "webm").ok, true);
    unlinkSync(p);
  });

  it("rejects HTML disguised as webm", () => {
    const p = write("x.webm", Buffer.from("<!doctype html><script>"));
    const r = verifyAudioMagic(p, "webm");
    assert.strictEqual(r.ok, false);
    unlinkSync(p);
  });

  it("accepts OggS / RIFF / ID3 / ftyp", () => {
    assert.strictEqual(verifyAudioMagic(write("a.ogg", Buffer.from("OggS....")), "ogg").ok, true);
    assert.strictEqual(verifyAudioMagic(write("a.wav", Buffer.from("RIFF....WAVE")), "wav").ok, true);
    assert.strictEqual(verifyAudioMagic(write("a.mp3", [0x49, 0x44, 0x33, 0x00]), "mp3").ok, true);
    assert.strictEqual(
      verifyAudioMagic(write("a.m4a", [0, 0, 0, 0x18, 0x66, 0x74, 0x79, 0x70]), "m4a").ok,
      true,
    );
  });
});

describe("kidSafeError", () => {
  it("maps known server errors to kid copy", () => {
    assert.match(kidSafeError("Handle taken"), /taken/i);
    assert.match(kidSafeError("Comment contains blocked words"), /don't allow/i);
  });

  it("hides internal / HTTP plumbing", () => {
    assert.strictEqual(kidSafeError("Missing x-device-id"), "Something went wrong. Try again!");
    assert.strictEqual(kidSafeError("HTTP 500"), "Something went wrong. Try again!");
  });

  it("uses custom fallback", () => {
    assert.strictEqual(kidSafeError("SQLITE boom", "Try again!"), "Try again!");
  });
});

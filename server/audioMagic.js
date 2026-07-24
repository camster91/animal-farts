// audioMagic.js — magic-byte checks for uploaded audio files.
// Client Content-Type is untrusted; after multer writes the file we sniff
// the first bytes and reject polyglots / non-audio payloads.

import fs from "node:fs";

/**
 * @param {string} filePath absolute path to the uploaded file
 * @param {string} ext extension without dot (webm|m4a|mp3|wav|ogg)
 * @returns {{ ok: true } | { ok: false, error: string }}
 */
export function verifyAudioMagic(filePath, ext) {
  let buf;
  try {
    const fd = fs.openSync(filePath, "r");
    try {
      buf = Buffer.alloc(16);
      const n = fs.readSync(fd, buf, 0, 16, 0);
      buf = buf.subarray(0, n);
    } finally {
      fs.closeSync(fd);
    }
  } catch {
    return { ok: false, error: "Could not read uploaded file" };
  }
  if (buf.length < 4) {
    return { ok: false, error: "File too small to be audio" };
  }

  const e = String(ext || "").toLowerCase();
  if (e === "webm") {
    // EBML header
    if (buf[0] === 0x1a && buf[1] === 0x45 && buf[2] === 0xdf && buf[3] === 0xa3) {
      return { ok: true };
    }
    return { ok: false, error: "Not a valid WebM file" };
  }
  if (e === "ogg") {
    if (buf[0] === 0x4f && buf[1] === 0x67 && buf[2] === 0x67 && buf[3] === 0x53) {
      return { ok: true };
    }
    return { ok: false, error: "Not a valid Ogg file" };
  }
  if (e === "wav") {
    if (
      buf[0] === 0x52 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x46 &&
      buf.length >= 12 &&
      buf[8] === 0x57 && buf[9] === 0x41 && buf[10] === 0x56 && buf[11] === 0x45
    ) {
      return { ok: true };
    }
    // Accept RIFF alone — some writers delay WAVE tag; still block HTML/SVG.
    if (buf[0] === 0x52 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x46) {
      return { ok: true };
    }
    return { ok: false, error: "Not a valid WAV file" };
  }
  if (e === "mp3") {
    // ID3v2 or MPEG frame sync
    if (buf[0] === 0x49 && buf[1] === 0x44 && buf[2] === 0x33) return { ok: true };
    if (buf[0] === 0xff && (buf[1] & 0xe0) === 0xe0) return { ok: true };
    return { ok: false, error: "Not a valid MP3 file" };
  }
  if (e === "m4a") {
    // ISO BMFF: size(4) + 'ftyp'
    if (buf.length >= 8 && buf[4] === 0x66 && buf[5] === 0x74 && buf[6] === 0x79 && buf[7] === 0x70) {
      return { ok: true };
    }
    return { ok: false, error: "Not a valid M4A file" };
  }
  return { ok: false, error: "Unsupported audio type" };
}

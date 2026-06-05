// Animal Farts — audio engine. v25r.
//
// - Per-animal play (v25q): each animal has its own sound files, round-
//   robined through `srcs` on every tap. No more "tapping Cow plays a
//   random wet-flavor fart".
// - v25r: playback stops any in-flight audio first (auto-stop-on-tap).
// - Random play (the 🎲 button): 270 MyInstants farts, picked across
//   the active flavor filters. The catalog is imported lazily so the
//   per-animal hot path doesn't pull it.
// - Recording: 6s hard cap, mic permission, returns a Blob + duration.
// - FX: pitch (playbackRate) + bathroom echo (Web Audio convolver).

// === FX state ===
let pitchRate = 1.0;        // 0.5x = deep, 2.0x = chipmunk
let echoAmount = 0;         // 0 = dry, 1 = bathroom

export function setPitchRate(r: number) { pitchRate = r; }
export function setEchoAmount(e: number) { echoAmount = e; }
export function setLengthScale(_s: number) { /* reserved */ }

// === Audio context (lazy) for the echo convolver ===
let audioCtx: AudioContext | null = null;
function getCtx(): AudioContext {
  if (!audioCtx) {
    const C = window.AudioContext || (window as any).webkitAudioContext;
    audioCtx = new C();
  }
  if (audioCtx.state === "suspended") audioCtx.resume();
  return audioCtx;
}

let echoImpulse: AudioBuffer | null = null;
function getEchoImpulse(ctx: AudioContext): AudioBuffer {
  if (echoImpulse && echoImpulse.sampleRate === ctx.sampleRate) return echoImpulse;
  const length = ctx.sampleRate * 1.2;
  const buf = ctx.createBuffer(2, length, ctx.sampleRate);
  for (let c = 0; c < 2; c++) {
    const data = buf.getChannelData(c);
    for (let i = 0; i < length; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, 2.5);
    }
  }
  echoImpulse = buf;
  return buf;
}

// === Playback ===
// v25r: every playback now stops all currently-playing sounds first.
// This is what the kid wants: tap a new animal = new sound, not "two
// animals at once". The previously-active element is paused, rewound,
// and dropped from the active set.

export function playFartUrl(src: string): Promise<void> {
  stopActiveElements();
  if (echoAmount > 0) return playWithEcho(src);
  return playDirect(src);
}

function playDirect(src: string): Promise<void> {
  const a = new Audio(src);
  a.playbackRate = pitchRate;
  a.volume = 0.9;
  trackActive(a);
  return a.play().catch((err) => {
    console.warn("[fart] play failed:", err);
  });
}

async function playWithEcho(src: string): Promise<void> {
  try {
    const ctx = getCtx();
    const resp = await fetch(src);
    const arrayBuf = await resp.arrayBuffer();
    const audioBuf = await ctx.decodeAudioData(arrayBuf);
    const src2 = ctx.createBufferSource();
    src2.buffer = audioBuf;
    src2.playbackRate.value = pitchRate;
    const convolver = ctx.createConvolver();
    convolver.buffer = getEchoImpulse(ctx);
    const dry = ctx.createGain();
    dry.gain.value = 0.4;
    const wet = ctx.createGain();
    wet.gain.value = 0.6;
    src2.connect(dry).connect(ctx.destination);
    src2.connect(convolver).connect(wet).connect(ctx.destination);
    src2.start();
    setTimeout(() => { try { src2.stop(); } catch {} }, (audioBuf.duration / pitchRate + 0.5) * 1000);
  } catch (err) {
    console.warn("[fart] echo playback failed, falling back:", err);
    void playDirect(src);
  }
}

// === Random fart picker ===
// v25r: drops the 270-MyInstants library (v25m) and the per-flavor
// filter system. The 🎲 button now picks from the curated per-animal
// sounds (one per tile in the grid) — a kid pressing "Random" gets
// any animal sound, not an external library that no one curated.
//
// v25s: tiles each have their own unique sound. playRandomFart pulls
// from the TILES list so we don't double-import soundPool here.

import { TILES } from "../animals";

export function playRandomFart(): Promise<void> {
  if (TILES.length === 0) return Promise.resolve();
  const tile = TILES[Math.floor(Math.random() * TILES.length)];
  return playFartUrl(tile.sound);
}

// === Per-tile play (v25s) ===
// Each grid tile has a unique sound. Tapping the same tile always
// plays the same sound (no rotation). playFartUrl already stops the
// prior audio, so re-tapping the same tile just restarts.
export function playSound(sound: string): Promise<void> {
  return playFartUrl(sound);
}

// === Active audio tracker ===
// We don't preload — every tap creates a new <audio>. To stop them all
// we keep a Set of in-flight elements, prune them on `ended`, and pause
// them all on `stopAllSounds()`.

const activeElements = new Set<HTMLAudioElement>();

function trackActive(a: HTMLAudioElement) {
  activeElements.add(a);
  a.addEventListener("ended", () => activeElements.delete(a), { once: true });
  // Safety: prune after 30s if `ended` never fires
  window.setTimeout(() => activeElements.delete(a), 30000);
}

// v25r: pause + rewind every active element so the next tap wins.
// Called by playFartUrl (auto-stop-on-tap) and the explicit Stop button.
function stopActiveElements() {
  for (const a of activeElements) {
    try { a.pause(); } catch {}
    try { a.currentTime = 0; } catch {}
  }
  activeElements.clear();
}

export function stopAllSounds() {
  stopActiveElements();
  if (audioCtx && audioCtx.state === "running") audioCtx.suspend();
}

// === Recording ===
// 6-second hard cap. After 6s, auto-stop. Result is a Blob (webm)
// and the actual duration.

export const MAX_RECORDING_SEC = 6;

let activeRecorder: MediaRecorder | null = null;
let activeStream: MediaStream | null = null;
let chunks: Blob[] = [];
let startedAt = 0;
let autoStopTimer: number | null = null;

export async function startRecording(): Promise<void> {
  if (activeRecorder) return;
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  activeStream = stream;
  chunks = [];
  const mime = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
    ? "audio/webm;codecs=opus"
    : "audio/webm";
  activeRecorder = new MediaRecorder(stream, { mimeType: mime });
  activeRecorder.addEventListener("dataavailable", (e) => {
    if (e.data.size > 0) chunks.push(e.data);
  });
  activeRecorder.start(100);
  startedAt = Date.now();
  // 6s hard cap — auto-stop
  autoStopTimer = window.setTimeout(() => {
    if (activeRecorder && activeRecorder.state === "recording") {
      void stopRecording();
    }
  }, MAX_RECORDING_SEC * 1000);
}

export type RecordingResult = {
  blob: Blob;
  duration: number;
};

export async function stopRecording(): Promise<RecordingResult | null> {
  if (autoStopTimer) {
    window.clearTimeout(autoStopTimer);
    autoStopTimer = null;
  }
  if (!activeRecorder) return null;
  return new Promise((resolve) => {
    const recorder = activeRecorder!;
    const stream = activeStream;
    recorder.addEventListener("stop", () => {
      const duration = (Date.now() - startedAt) / 1000;
      const blob = new Blob(chunks, { type: recorder.mimeType });
      if (stream) stream.getTracks().forEach((t) => t.stop());
      activeRecorder = null;
      activeStream = null;
      chunks = [];
      resolve({ blob, duration });
    }, { once: true });
    recorder.stop();
  });
}

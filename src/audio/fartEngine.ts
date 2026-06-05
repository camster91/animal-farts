// Animal Farts — audio engine. v25m.
//
// Catalog: 270 real MyInstants farts across 6 flavor buckets. Every
// tap picks a random fart from the active flavor(s) and plays it.
//
// v25m design: NO preloaded pool, NO sample, NO synth. The MP3 is
// played directly. Per-fart <audio> elements are created on demand
// (cheap, garbage-collected) — this keeps first-install size small
// (no need to precache 23MB) and keeps the code simple.
//
// The "FX" controls (length, pitch, echo) are applied at play time
// via Web Audio (playbackRate, convolver). They cost nothing when
// the user doesn't touch them.

import {
  wet, dry, long, bubbly, squeaky, echo,
  FLAVORS, FLAVOR_LABELS, type Flavor,
} from "./fartCatalog";

export { FLAVORS, FLAVOR_LABELS, type Flavor };

// FX state. All settable from App.tsx.
let pitchRate = 1.0;        // 0.5 = half speed (low), 2.0 = double (chipmunk)
let echoAmount = 0;         // 0 = dry, 1 = bathroom echo

export function setPitchRate(r: number) { pitchRate = r; }
export function setEchoAmount(e: number) { echoAmount = e; }
export function setLengthScale(_s: number) { /* reserved for future use */ }

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

// Bathroom echo: cached impulse response. Synthesized at runtime — no asset.
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

// Play an MP3 URL with the current FX applied.
// echoAmount > 0 → route through convolver (Web Audio graph).
// pitchRate != 1 → adjust playbackRate.
// lengthScale != 1 → trim or pad the playback via currentTime + scheduled stop.
export function playFartUrl(src: string): Promise<void> {
  if (echoAmount > 0) {
    return playWithEcho(src);
  }
  return playDirect(src);
}

function playDirect(src: string): Promise<void> {
  const a = new Audio(src);
  a.playbackRate = pitchRate;
  a.volume = 0.9;
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
    // Fall back to direct playback if decodeAudioData fails
    console.warn("[fart] echo playback failed, falling back:", err);
    void playDirect(src);
  }
}

// === Public: pick a random fart from the active flavors and play it. ===
//
// activeFlavors is a Set the UI keeps in sync — empty means "all flavors".
export function randomFart(activeFlavors: Set<Flavor> = new Set()): string {
  const pool: string[] = [];
  for (const f of FLAVORS) {
    if (activeFlavors.size === 0 || activeFlavors.has(f)) {
      const list = f === "wet" ? wet
        : f === "dry" ? dry
        : f === "long" ? long
        : f === "bubbly" ? bubbly
        : f === "squeaky" ? squeaky
        : echo;
      pool.push(...list);
    }
  }
  if (pool.length === 0) {
    // All flavors disabled — fall back to dry
    pool.push(...dry);
  }
  return pool[Math.floor(Math.random() * pool.length)];
}

export function playRandomFart(activeFlavors: Set<Flavor> = new Set()): Promise<void> {
  return playFartUrl(randomFart(activeFlavors));
}

// Play a specific URL (for recordings).
export function playUrl(src: string): Promise<void> {
  return playFartUrl(src);
}

export function stopAllSounds() {
  // With per-tap audio elements, there's no global pool to pause.
  // The browser GCs each Audio once it ends. We just suspend the
  // AudioContext which is used for echo.
  if (audioCtx) audioCtx.suspend();
}

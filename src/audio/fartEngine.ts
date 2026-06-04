// Real audio sample playback with synth fallback, optional bathroom reverb.
// v25j: removed pitchShift + rate on every preset — the engine plays samples
// at 1.0x, no transformation. Kids complained that pitch-shifted samples
// didn't sound like farts. v25j also removed Cave reverb, Chipmunk/Slow-Mo
// modes, and the Speed/Pitch sliders. Only Bathroom reverb remains as FX.

import { playFartSynth, type FartPreset as SynthPreset } from "./fartSynth";

export type FartPreset = SynthPreset & {
  // Sample source. If null, this is a pure-synth preset (no recording).
  src: string | null;
  // Additional sample sources — one is picked at random per play for variety.
  // Each entry is a full URL like "/sounds/extra/cow2.mp3".
  altSrcs?: string[];
  caption: string;
  // Whether this card supports loop toggle
  loopable: boolean;
};

// Helper: build a flat preset with no transformation. The base synth params
// (baseFreq, detune, etc.) are only used for the synth fallback; with a real
// sample they don't apply.
function make(id: string, name: string, emoji: string, color: string, src: string, altSrcs: string[] | undefined, caption: string, synth: Omit<SynthPreset, "id" | "name" | "emoji" | "color">): FartPreset {
  return {
    ...synth,
    id, name, emoji, color,
    src, altSrcs, caption,
    loopable: false,
  };
}

export const PRESETS: FartPreset[] = [
  // Original 12 (v1 sounds — recovered from git, no pitch shift, no rate change)
  make("cow", "Cow", "🐄", "from-pink-200 to-pink-400",
    "/sounds/v1/cow.mp3", undefined, "MOOO-TION TOOT",
    { baseFreq: 75, detune: 12, attack: 0.02, hold: 0.55, release: 0.35, cutoff: 600, noise: 0.18, pitchSweep: -4, wobble: 8, wobbleRate: 14, squelch: 0, thump: true }),
  make("dog", "Dog", "🐕", "from-amber-200 to-amber-400",
    "/sounds/v1/dog.mp3", undefined, "SQUEAKY TOOT",
    { baseFreq: 180, detune: 25, attack: 0.01, hold: 0.15, release: 0.12, cutoff: 1800, noise: 0.35, pitchSweep: -2, wobble: 15, wobbleRate: 22, squelch: 0.4, thump: false }),
  make("cat", "Cat", "🐈", "from-purple-200 to-purple-400",
    "/sounds/v1/cat.mp3", undefined, "PURR-TOOT",
    { baseFreq: 240, detune: 18, attack: 0.01, hold: 0.18, release: 0.18, cutoff: 2200, noise: 0.22, pitchSweep: -3, wobble: 10, wobbleRate: 18, squelch: 0.5, thump: false }),
  make("bird", "Bird", "🐦", "from-sky-200 to-sky-400",
    "/sounds/v1/bird.mp3", undefined, "TWEET-TOOT",
    { baseFreq: 520, detune: 8, attack: 0.005, hold: 0.08, release: 0.06, cutoff: 4000, noise: 0.5, pitchSweep: 2, wobble: 25, wobbleRate: 35, squelch: 0, thump: false }),
  make("horse", "Horse", "🐎", "from-orange-200 to-orange-400",
    "/sounds/v1/horse.mp3", undefined, "THUNDER PLOP",
    { baseFreq: 60, detune: 6, attack: 0.03, hold: 0.9, release: 0.5, cutoff: 450, noise: 0.12, pitchSweep: -2, wobble: 4, wobbleRate: 8, squelch: 0.1, thump: true }),
  make("pig", "Pig", "🐖", "from-rose-200 to-rose-400",
    "/sounds/v1/pig.mp3", undefined, "OINK-OINK TOOT",
    { baseFreq: 140, detune: 30, attack: 0.02, hold: 0.25, release: 0.2, cutoff: 1200, noise: 0.28, pitchSweep: -3, wobble: 20, wobbleRate: 25, squelch: 0.7, thump: false }),
  make("duck", "Duck", "🦆", "from-yellow-200 to-yellow-400",
    "/sounds/v1/duck.mp3", undefined, "QUACK-TOOT",
    { baseFreq: 380, detune: 4, attack: 0.005, hold: 0.12, release: 0.1, cutoff: 3000, noise: 0.1, pitchSweep: -8, wobble: 2, wobbleRate: 4, squelch: 0, thump: false }),
  make("elephant", "Elephant", "🐘", "from-slate-300 to-slate-500",
    "/sounds/v1/elephant.mp3", undefined, "ROLLING THUNDER",
    { baseFreq: 45, detune: 10, attack: 0.04, hold: 1.1, release: 0.7, cutoff: 350, noise: 0.08, pitchSweep: -6, wobble: 6, wobbleRate: 6, squelch: 0.05, thump: true }),
  make("monkey", "Monkey", "🐒", "from-lime-200 to-lime-400",
    "/sounds/v1/monkey.mp3", undefined, "BEAT DROP",
    { baseFreq: 280, detune: 35, attack: 0.01, hold: 0.2, release: 0.15, cutoff: 2400, noise: 0.4, pitchSweep: -4, wobble: 30, wobbleRate: 28, squelch: 0.6, thump: false }),
  make("snake", "Snake", "🐍", "from-emerald-200 to-emerald-400",
    "/sounds/v1/snake.mp3", undefined, "BURP-N-FART",
    { baseFreq: 320, detune: 2, attack: 0.01, hold: 0.7, release: 0.6, cutoff: 2800, noise: 0.7, pitchSweep: -2, wobble: 1, wobbleRate: 14, squelch: 0, thump: false }),
  make("lion", "Lion", "🦁", "from-yellow-300 to-amber-500",
    "/sounds/v1/lion.mp3", undefined, "ROAR-TOOT",
    { baseFreq: 55, detune: 8, attack: 0.05, hold: 0.85, release: 0.6, cutoff: 500, noise: 0.15, pitchSweep: -5, wobble: 5, wobbleRate: 10, squelch: 0.05, thump: true }),
  make("frog", "Frog", "🐸", "from-green-300 to-green-500",
    "/sounds/v1/frog.mp3", undefined, "RIBBIT TOOT",
    { baseFreq: 160, detune: 6, attack: 0.008, hold: 0.1, release: 0.1, cutoff: 2000, noise: 0.12, pitchSweep: -10, wobble: 18, wobbleRate: 30, squelch: 0.8, thump: false }),

  // Bull/Rabbit/Bear/Rooster/Turtle/Whale — these v3 sources are the only
  // versions we have. No pitch shift, no rate. Each kept as a single source.
  make("bull", "Bull", "🐂", "from-red-300 to-red-500",
    "/sounds/bull.mp3", undefined, "ROARIN' BULL",
    { baseFreq: 55, detune: 8, attack: 0.05, hold: 0.85, release: 0.6, cutoff: 450, noise: 0.15, pitchSweep: -5, wobble: 5, wobbleRate: 10, squelch: 0.05, thump: true }),
  make("rabbit", "Rabbit", "🐰", "from-pink-100 to-pink-300",
    "/sounds/rabbit.mp3", undefined, "TINY TOOT",
    { baseFreq: 380, detune: 4, attack: 0.005, hold: 0.12, release: 0.1, cutoff: 3000, noise: 0.1, pitchSweep: -8, wobble: 2, wobbleRate: 4, squelch: 0, thump: false }),
  make("bear", "Bear", "🐻", "from-amber-500 to-orange-700",
    "/sounds/bear.mp3", undefined, "GRIZZLY GRUMBLE",
    { baseFreq: 50, detune: 10, attack: 0.05, hold: 1.2, release: 0.8, cutoff: 400, noise: 0.1, pitchSweep: -4, wobble: 4, wobbleRate: 6, squelch: 0.05, thump: true }),
  make("rooster", "Rooster", "🐓", "from-red-200 to-orange-300",
    "/sounds/rooster.mp3", undefined, "COCK-A-DOODLE",
    { baseFreq: 400, detune: 8, attack: 0.005, hold: 0.2, release: 0.15, cutoff: 2500, noise: 0.2, pitchSweep: -3, wobble: 12, wobbleRate: 20, squelch: 0, thump: false }),
  make("turtle", "Turtle", "🐢", "from-emerald-300 to-emerald-500",
    "/sounds/turtle.mp3", undefined, "SLOW & LOW",
    { baseFreq: 90, detune: 4, attack: 0.04, hold: 0.6, release: 0.4, cutoff: 600, noise: 0.1, pitchSweep: -2, wobble: 2, wobbleRate: 4, squelch: 0, thump: false }),
  make("whale", "Whale", "🐋", "from-blue-300 to-blue-500",
    "/sounds/whale.mp3", undefined, "WHALE SONG",
    { baseFreq: 40, detune: 6, attack: 0.06, hold: 1.5, release: 1.0, cutoff: 300, noise: 0.05, pitchSweep: -3, wobble: 3, wobbleRate: 4, squelch: 0.1, thump: true }),

  // v11+ animals — only one source per animal. No pitch shift.
  make("goat", "Goat", "🐐", "from-stone-300 to-stone-500",
    "/sounds/extra/goat.mp3", undefined, "BLEAT-BLAST",
    { baseFreq: 200, detune: 20, attack: 0.01, hold: 0.6, release: 0.4, cutoff: 1500, noise: 0.25, pitchSweep: -2, wobble: 8, wobbleRate: 12, squelch: 0.3, thump: false }),
  make("sheep", "Sheep", "🐑", "from-gray-200 to-gray-400",
    "/sounds/extra/sheep.mp3", undefined, "WOOLY POP",
    { baseFreq: 260, detune: 8, attack: 0.01, hold: 0.3, release: 0.2, cutoff: 2400, noise: 0.2, pitchSweep: -1, wobble: 6, wobbleRate: 14, squelch: 0.2, thump: false }),
  make("bee", "Bee", "🐝", "from-yellow-300 to-yellow-500",
    "/sounds/extra/bee.mp3", undefined, "BUZZ-WOOF",
    { baseFreq: 600, detune: 4, attack: 0.005, hold: 0.5, release: 0.3, cutoff: 3500, noise: 0.3, pitchSweep: 1, wobble: 30, wobbleRate: 40, squelch: 0, thump: false }),
  make("turkey", "Turkey", "🦃", "from-red-400 to-red-600",
    "/sounds/extra/turkey.mp3", undefined, "GOBBLE-BOOM",
    { baseFreq: 80, detune: 6, attack: 0.03, hold: 0.9, release: 0.6, cutoff: 500, noise: 0.15, pitchSweep: -3, wobble: 4, wobbleRate: 6, squelch: 0.05, thump: true }),
  make("owl", "Owl", "🦉", "from-indigo-300 to-indigo-500",
    "/sounds/extra/owl.mp3", undefined, "HOOT-FART",
    { baseFreq: 400, detune: 12, attack: 0.01, hold: 0.4, release: 0.3, cutoff: 2800, noise: 0.3, pitchSweep: 2, wobble: 18, wobbleRate: 22, squelch: 0.4, thump: false }),
  make("penguin", "Penguin", "🐧", "from-cyan-200 to-cyan-400",
    "/sounds/extra/penguin.mp3", undefined, "TUXEDO SQUEAK",
    { baseFreq: 320, detune: 6, attack: 0.008, hold: 0.3, release: 0.2, cutoff: 2200, noise: 0.4, pitchSweep: -2, wobble: 10, wobbleRate: 16, squelch: 0.5, thump: false }),
  make("seal", "Seal", "🦭", "from-slate-200 to-slate-400",
    "/sounds/extra/seal.mp3", undefined, "HONK-FART",
    { baseFreq: 150, detune: 8, attack: 0.01, hold: 0.8, release: 0.5, cutoff: 1200, noise: 0.2, pitchSweep: 1, wobble: 4, wobbleRate: 8, squelch: 0.05, thump: false }),
  make("hippo", "Hippo", "🦛", "from-pink-300 to-purple-400",
    "/sounds/extra/hippo.mp3", undefined, "CHUNKY BLAST",
    { baseFreq: 50, detune: 6, attack: 0.04, hold: 1.2, release: 0.8, cutoff: 400, noise: 0.1, pitchSweep: -2, wobble: 3, wobbleRate: 4, squelch: 0.05, thump: true }),
  make("rhino", "Rhino", "🦏", "from-stone-400 to-stone-600",
    "/sounds/extra/rhino.mp3", undefined, "HORN HONK",
    { baseFreq: 45, detune: 4, attack: 0.05, hold: 1.3, release: 0.7, cutoff: 380, noise: 0.08, pitchSweep: -3, wobble: 4, wobbleRate: 5, squelch: 0.05, thump: true }),
  make("zebra", "Zebra", "🦓", "from-gray-100 to-gray-300",
    "/sounds/extra/zebra.mp3", undefined, "STRIPED TOOT",
    { baseFreq: 220, detune: 12, attack: 0.01, hold: 0.4, release: 0.3, cutoff: 2000, noise: 0.2, pitchSweep: -1, wobble: 8, wobbleRate: 14, squelch: 0.2, thump: false }),
  make("giraffe", "Giraffe", "🦒", "from-yellow-200 to-amber-300",
    "/sounds/extra/giraffe.mp3", undefined, "NECK BLAST",
    { baseFreq: 75, detune: 6, attack: 0.02, hold: 0.7, release: 0.5, cutoff: 600, noise: 0.12, pitchSweep: -2, wobble: 5, wobbleRate: 8, squelch: 0.05, thump: true }),
  make("moose", "Moose", "🦌", "from-amber-500 to-orange-600",
    "/sounds/extra/moose.mp3", undefined, "ANTLER POOT",
    { baseFreq: 55, detune: 8, attack: 0.04, hold: 1.0, release: 0.6, cutoff: 450, noise: 0.1, pitchSweep: -3, wobble: 4, wobbleRate: 6, squelch: 0.05, thump: true }),
  make("kangaroo", "Kangaroo", "🦘", "from-orange-300 to-orange-500",
    "/sounds/extra/kangaroo.mp3", undefined, "POUCH POP",
    { baseFreq: 180, detune: 15, attack: 0.01, hold: 0.3, release: 0.2, cutoff: 1500, noise: 0.25, pitchSweep: -1, wobble: 12, wobbleRate: 18, squelch: 0.3, thump: false }),
  make("sloth", "Sloth", "🦥", "from-lime-200 to-amber-200",
    "/sounds/extra/sloth.mp3", undefined, "SLOW SQUEEZE",
    { baseFreq: 100, detune: 4, attack: 0.05, hold: 1.5, release: 1.0, cutoff: 700, noise: 0.08, pitchSweep: -1, wobble: 2, wobbleRate: 3, squelch: 0.05, thump: false }),
  make("skunk", "Skunk", "🦨", "from-gray-300 to-gray-500",
    "/sounds/extra/skunk.mp3", undefined, "STINKY SPRAY",
    { baseFreq: 300, detune: 6, attack: 0.01, hold: 0.5, release: 0.4, cutoff: 2200, noise: 0.4, pitchSweep: -2, wobble: 10, wobbleRate: 14, squelch: 0.3, thump: false }),
  make("raccoon", "Raccoon", "🦝", "from-stone-300 to-stone-500",
    "/sounds/extra/raccoon.mp3", undefined, "MIDNIGHT TOOT",
    { baseFreq: 200, detune: 10, attack: 0.015, hold: 0.4, release: 0.3, cutoff: 1800, noise: 0.3, pitchSweep: -1, wobble: 8, wobbleRate: 12, squelch: 0.2, thump: false }),

  // Long sounds (recovered from v11 era; originally 4-12s, played un-altered)
  make("elephant-long", "Mammoth", "🦣", "from-stone-500 to-stone-700",
    "/sounds/extra/elephant_long.mp3", undefined, "LONG RUMBLE",
    { baseFreq: 40, detune: 8, attack: 0.05, hold: 8.0, release: 3.0, cutoff: 300, noise: 0.05, pitchSweep: -8, wobble: 3, wobbleRate: 4, squelch: 0.05, thump: true }),
  make("lion-long", "Mega-Lion", "🦁", "from-amber-400 to-red-600",
    "/sounds/extra/lion_long.mp3", undefined, "EPIC ROAR",
    { baseFreq: 50, detune: 10, attack: 0.05, hold: 5.0, release: 2.0, cutoff: 450, noise: 0.1, pitchSweep: -6, wobble: 4, wobbleRate: 6, squelch: 0.05, thump: true }),
  make("snake-long", "Python", "🐍", "from-emerald-400 to-emerald-600",
    "/sounds/extra/snake_long.mp3", undefined, "SLOW HISS",
    { baseFreq: 240, detune: 4, attack: 0.02, hold: 3.0, release: 1.0, cutoff: 2000, noise: 0.6, pitchSweep: -2, wobble: 1, wobbleRate: 8, squelch: 0, thump: false }),
];

// Pool of audio elements per preset
const POOL_SIZE = 4;
const pools = new Map<string, HTMLAudioElement[]>();
const sampleHealth = new Map<string, "unknown" | "ok" | "bad">();
let unlocked = false;

function getPool(preset: FartPreset): HTMLAudioElement[] {
  let pool = pools.get(preset.id);
  if (!pool && preset.src) {
    pool = [];
    const allSources = [preset.src, ...(preset.altSrcs || [])];
    for (const src of allSources) {
      for (let i = 0; i < POOL_SIZE; i++) {
        const audio = new Audio(src);
        audio.preload = "auto";
        // Mark THIS specific audio as bad on error, not the whole preset.
        // Otherwise a missing altSrc (e.g. /sounds/cow2.mp3 returns the SPA
        // index.html via the catch-all fallback) poisons the primary src
        // too — which is the bug that made sounds disappear on the live site.
        audio.addEventListener("error", () => {
          (audio as HTMLAudioElement & { __bad?: boolean }).__bad = true;
        });
        pool.push(audio);
      }
    }
    pools.set(preset.id, pool);
    sampleHealth.set(preset.id, "unknown");
  }
  return pool || [];
}

function isSampleHealthy(preset: FartPreset): boolean {
  if (!preset.src) return false;
  // A preset is healthy if at least one of its primary-src pool audios
  // exists and isn't bad. (We used to key off sampleHealth which was
  // poisoned by altSrc errors; now we inspect the pool directly.)
  const pool = pools.get(preset.id);
  if (!pool || pool.length === 0) return true; // pool will be created on first pick
  const hasGoodPrimary = pool.some((a) => {
    const bad = (a as HTMLAudioElement & { __bad?: boolean }).__bad;
    return !bad && a.src === preset.src;
  });
  return hasGoodPrimary;
}

let lastIndex = 0;
function pickNext(pool: HTMLAudioElement[]): HTMLAudioElement {
  if (pool.length === 0) throw new Error("empty audio pool");
  // Prefer an audio element that is not bad AND has buffered enough to play.
  // iOS Safari silently rejects play() on readyState < 2 (HAVE_CURRENT_DATA)
  // on a freshly-created audio, which is what made the first tap silent.
  // Walk the pool starting from lastIndex, return the first element
  // that's both ready and not bad. If none are ready, return the first
  // non-bad one (the caller will await canplay before playing).
  for (let i = 0; i < pool.length; i++) {
    const a = pool[(lastIndex + i) % pool.length];
    const bad = (a as HTMLAudioElement & { __bad?: boolean }).__bad;
    if (!bad && a.readyState >= 2) {
      lastIndex = (lastIndex + i + 1) % pool.length;
      return a;
    }
  }
  // No ready non-bad audios — return the first non-bad one anyway.
  for (let i = 0; i < pool.length; i++) {
    const a = pool[(lastIndex + i) % pool.length];
    const bad = (a as HTMLAudioElement & { __bad?: boolean }).__bad;
    if (!bad) {
      lastIndex = (lastIndex + i + 1) % pool.length;
      return a;
    }
  }
  // Everything is bad — fall through to the next in round-robin
  // (better than throwing; the play() will reject and synth will play).
  const fallback = pool[lastIndex % pool.length];
  lastIndex = (lastIndex + 1) % pool.length;
  return fallback;
}

// Wait for an audio element to have enough data to play. Resolves
// immediately if it's already ready.
function waitReady(a: HTMLAudioElement): Promise<void> {
  if (a.readyState >= 2) return Promise.resolve();
  return new Promise((resolve) => {
    const onReady = () => { a.removeEventListener("canplay", onReady); a.removeEventListener("canplaythrough", onReady); a.removeEventListener("error", onErr); resolve(); };
    const onErr = () => { a.removeEventListener("canplay", onReady); a.removeEventListener("canplaythrough", onReady); a.removeEventListener("error", onErr); resolve(); /* resolve anyway; play() will reject and the caller will fall back to synth */ };
    a.addEventListener("canplay", onReady, { once: true });
    a.addEventListener("canplaythrough", onReady, { once: true });
    a.addEventListener("error", onErr, { once: true });
  });
}

async function unlockAudio() {
  if (unlocked) return;
  unlocked = true;
  const allAudios: HTMLAudioElement[] = [];
  pools.forEach((pool) => allAudios.push(...pool));
  for (const a of allAudios) {
    const savedVolume = a.volume;
    a.muted = true;
    a.volume = 0;
    try {
      await a.play();
      a.pause();
      a.currentTime = 0;
    } catch {}
    a.muted = false;
    a.volume = savedVolume;
  }
}

// Bathroom reverb impulse. Synthesized at runtime and cached.
// (Cave mode was removed in v25j — only Bathroom remains as an FX option.)
let bathroomImpulse: AudioBuffer | null = null;
function getBathroomImpulse(ctx: AudioContext): AudioBuffer {
  if (bathroomImpulse) return bathroomImpulse;
  const length = ctx.sampleRate * 1.5;
  const impulse = ctx.createBuffer(2, length, ctx.sampleRate);
  for (let c = 0; c < 2; c++) {
    const data = impulse.getChannelData(c);
    for (let i = 0; i < length; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, 3);
    }
  }
  bathroomImpulse = impulse;
  return impulse;
}

// Play an AudioBuffer through the FX chain (bathroom reverb on/off).
// Internal helper for the reverb-using callers below.
function playAudioBufferWithFx(buffer: AudioBuffer, bathroom: boolean): void {
  const ctx = getAudioCtx();
  const src = ctx.createBufferSource();
  src.buffer = buffer;
  src.loop = false;
  const gain = ctx.createGain();
  gain.gain.value = 0.9;
  if (bathroom) {
    const convolver = ctx.createConvolver();
    convolver.buffer = getBathroomImpulse(ctx);
    // Bathroom is balanced — dry 55%, wet 65% — not a cathedral
    const dryGain = ctx.createGain();
    dryGain.gain.value = 0.55;
    const wetGain = ctx.createGain();
    wetGain.gain.value = 0.65;
    src.connect(dryGain).connect(gain);
    src.connect(convolver).connect(wetGain).connect(gain);
  } else {
    src.connect(gain);
  }
  gain.connect(ctx.destination);
  src.start();
  setTimeout(() => { try { src.stop(); } catch {} }, (buffer.duration + 0.5) * 1000);
}

let sharedAudioCtx: AudioContext | null = null;
function getAudioCtx(): AudioContext {
  if (!sharedAudioCtx) {
    const C = window.AudioContext || (window as any).webkitAudioContext;
    sharedAudioCtx = new C();
  }
  return sharedAudioCtx;
}

// Track currently playing audio for loop control
const activeAudios = new Set<HTMLAudioElement>();

// v25j: the only FX left is bathroom reverb (boolean on/off).
// pitchShift and speedFactor are gone — samples play at 1.0x.
let bathroomOn = false;

export function setBathroomOn(on: boolean) {
  bathroomOn = on;
  (window as any).__reverbEnabled = on;
  (window as any).__reverbAmount = on ? 1 : 0;
}

// Decode an audio Blob and play it through the FX chain (bathroom: boolean).
export async function playBlobWithFx(blob: Blob, bathroom: boolean): Promise<void> {
  const ctx = getAudioCtx();
  const arrayBuffer = await blob.arrayBuffer();
  const audioBuffer = await ctx.decodeAudioData(arrayBuffer);
  playAudioBufferWithFx(audioBuffer, bathroom);
}

export async function playFart(preset: FartPreset, options: { loop?: boolean } = {}) {
  if (!preset.src || !isSampleHealthy(preset)) {
    try { playFartSynth(preset); } catch {}
    return;
  }
  const pool = getPool(preset);
  const audio = pickNext(pool);
  // v25j: no more presetRate * fxRate — samples play at 1.0x, no transformation.
  audio.playbackRate = 1.0;
  audio.volume = 0.9;
  audio.loop = options.loop ?? false;

  try { audio.currentTime = 0; } catch {}

  // If bathroom reverb is on, route through the Web Audio convolver chain
  // instead of the plain <audio> element. The <audio> can't be reverb'd
  // directly — we have to fetch + decode + play through the FX graph.
  if (bathroomOn) {
    void playSampleWithBathroom(audio.src);
    return;
  }

  // Wait for the audio to have enough data buffered before calling play().
  // iOS Safari silently rejects play() on a freshly-created audio
  // (readyState < 2), and the rejection falls through to the synth fallback
  // — which is why the kid heard nothing on the first tap.
  await waitReady(audio);

  const p = audio.play();
  if (p && typeof p.catch === "function") {
    p.catch(() => {
      // Mark just THIS audio as bad (e.g. transient network or iOS autoplay
      // rejection). Don't poison the whole preset.
      (audio as HTMLAudioElement & { __bad?: boolean }).__bad = true;
      try { playFartSynth(preset); } catch {}
    });
  }
  activeAudios.add(audio);
  audio.addEventListener("ended", () => activeAudios.delete(audio), { once: true });
}

// Fetch a sample URL, decode, and play through the bathroom reverb chain.
async function playSampleWithBathroom(url: string): Promise<void> {
  try {
    const ctx = getAudioCtx();
    const resp = await fetch(url);
    const arrayBuffer = await resp.arrayBuffer();
    const audioBuffer = await ctx.decodeAudioData(arrayBuffer);
    playAudioBufferWithFx(audioBuffer, true);
  } catch (err) {
    console.warn("[fart] bathroom playback failed:", err);
  }
}

export function stopAllSounds() {
  activeAudios.forEach((a) => {
    a.pause();
    a.currentTime = 0;
  });
  activeAudios.clear();
}

export async function primeAudio() {
  PRESETS.forEach((p) => getPool(p));
  await unlockAudio();
}

// Diagnostic

// Recording API
type RecordingResult = {
  blob: Blob;
  url: string;
  duration: number;
};

let activeRecorder: MediaRecorder | null = null;
let activeStream: MediaStream | null = null;
let recordingChunks: BlobPart[] = [];
let recordingStartTime = 0;

export async function startRecording(): Promise<void> {
  if (activeRecorder) return;
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  activeStream = stream;
  recordingChunks = [];
  // Pick best supported mime type
  const mime = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
    ? "audio/webm;codecs=opus"
    : MediaRecorder.isTypeSupported("audio/mp4")
    ? "audio/mp4"
    : "audio/webm";
  activeRecorder = new MediaRecorder(stream, { mimeType: mime });
  activeRecorder.addEventListener("dataavailable", (e) => {
    if (e.data.size > 0) recordingChunks.push(e.data);
  });
  activeRecorder.start(100); // gather chunks every 100ms
  recordingStartTime = Date.now();
}

export function stopRecording(): Promise<RecordingResult | null> {
  return new Promise((resolve) => {
    if (!activeRecorder) { resolve(null); return; }
    const recorder = activeRecorder;
    const stream = activeStream;
    recorder.addEventListener("stop", () => {
      const duration = (Date.now() - recordingStartTime) / 1000;
      const blob = new Blob(recordingChunks, { type: recorder.mimeType });
      const url = URL.createObjectURL(blob);
      if (stream) stream.getTracks().forEach((t) => t.stop());
      activeRecorder = null;
      activeStream = null;
      resolve({ blob, url, duration });
    });
    recorder.stop();
  });
}

// Custom recording preset (from user's mic)
export type CustomRecording = {
  id: string;
  name: string;
  emoji: string;
  url: string;
  createdAt: number;
  /**
   * "local"  = only saved on this device, never leaves it.
   * "public" = uploaded to the feed so friends can hear it.
   * Recordings default to "local"; a user must explicitly tap "Post to feed".
   */
  visibility: "local" | "public";
  /** Server-side id once uploaded. null while still local. */
  serverId?: string | null;
};

const RECORDINGS_KEY = "fart-custom-recordings";

export function loadRecordings(): CustomRecording[] {
  try {
    const raw = localStorage.getItem(RECORDINGS_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch { return []; }
}

export function saveRecording(rec: Omit<CustomRecording, "id" | "createdAt" | "visibility"> & { visibility?: "local" | "public" }): CustomRecording {
  const all = loadRecordings();
  // Find next free slot number
  let i = 1;
  while (all.some((r) => r.id === `rec-${i}`)) i++;
  const newRec: CustomRecording = {
    id: `rec-${i}`,
    name: rec.name,
    emoji: rec.emoji,
    url: rec.url,
    createdAt: Date.now(),
    visibility: rec.visibility ?? "local",
    serverId: rec.serverId ?? null,
  };
  all.push(newRec);
  localStorage.setItem(RECORDINGS_KEY, JSON.stringify(all));
  return newRec;
}

export function deleteRecording(id: string): void {
  const all = loadRecordings();
  const filtered = all.filter((r) => {
    if (r.id === id) {
      // Revoke blob URL to free memory
      try { URL.revokeObjectURL(r.url); } catch {}
      return false;
    }
    return true;
  });
  localStorage.setItem(RECORDINGS_KEY, JSON.stringify(filtered));
}

// Favorites tracking (per-animal tap count)

// Per-card loop state (UI)

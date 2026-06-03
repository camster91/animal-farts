// Real audio sample playback with synth fallback, reverb mode, loop support.
// Samples are preloaded MP3s from /sounds/. Custom recordings use Blob URLs.

import { playFartSynth, type FartPreset as SynthPreset } from "./fartSynth";

export type FartPreset = SynthPreset & {
  // Sample source. If null, this is a pure-synth preset (no recording).
  src: string | null;
  // Additional sample sources — one is picked at random per play for variety.
  // Each entry is a full URL like "/sounds/extra/cow2.mp3".
  altSrcs?: string[];
  // Pitch shift in semitones applied to the sample via playbackRate
  pitchShift: number;
  // Base playback rate
  rate: number;
  caption: string;
  // Visual: color, emoji, name are inherited from SynthPreset
  // Whether this card supports loop toggle
  loopable: boolean;
};

export const PRESETS: FartPreset[] = [
  // Original 12 — kept exactly as v4 (with 2nd variants from extra/)
  {
    id: "cow", name: "Cow", emoji: "🐄", color: "from-pink-200 to-pink-400",
    src: "/sounds/cow.mp3", altSrcs: ["/sounds/extra/cow2.mp3"],
    pitchShift: -2, rate: 0.9, caption: "MOOO-TION TOOT",
    loopable: false, baseFreq: 75, detune: 12, attack: 0.02, hold: 0.55, release: 0.35,
    cutoff: 600, noise: 0.18, pitchSweep: -4, wobble: 8, wobbleRate: 14, squelch: 0, thump: true,
  },
  {
    id: "dog", name: "Dog", emoji: "🐕", color: "from-amber-200 to-amber-400",
    src: "/sounds/dog.mp3", altSrcs: ["/sounds/extra/dog_v2.mp3"],
    pitchShift: 0, rate: 1.0, caption: "SQUEAKY TOOT",
    loopable: false, baseFreq: 180, detune: 25, attack: 0.01, hold: 0.15, release: 0.12,
    cutoff: 1800, noise: 0.35, pitchSweep: -2, wobble: 15, wobbleRate: 22, squelch: 0.4, thump: false,
  },
  {
    id: "cat", name: "Cat", emoji: "🐈", color: "from-purple-200 to-purple-400",
    src: "/sounds/cat.mp3", altSrcs: ["/sounds/extra/cat2.mp3"],
    pitchShift: 1, rate: 1.05, caption: "PURR-TOOT",
    loopable: false, baseFreq: 240, detune: 18, attack: 0.01, hold: 0.18, release: 0.18,
    cutoff: 2200, noise: 0.22, pitchSweep: -3, wobble: 10, wobbleRate: 18, squelch: 0.5, thump: false,
  },
  {
    id: "bird", name: "Bird", emoji: "🐦", color: "from-sky-200 to-sky-400",
    src: "/sounds/bird.mp3", altSrcs: ["/sounds/extra/bird2.mp3"],
    pitchShift: 2, rate: 1.1, caption: "TWEET-TOOT",
    loopable: false, baseFreq: 520, detune: 8, attack: 0.005, hold: 0.08, release: 0.06,
    cutoff: 4000, noise: 0.5, pitchSweep: 2, wobble: 25, wobbleRate: 35, squelch: 0, thump: false,
  },
  {
    id: "horse", name: "Horse", emoji: "🐎", color: "from-orange-200 to-orange-400",
    src: "/sounds/horse.mp3", altSrcs: ["/sounds/extra/horse2.mp3"],
    pitchShift: -3, rate: 0.85, caption: "THUNDER PLOP",
    loopable: false, baseFreq: 60, detune: 6, attack: 0.03, hold: 0.9, release: 0.5,
    cutoff: 450, noise: 0.12, pitchSweep: -2, wobble: 4, wobbleRate: 8, squelch: 0.1, thump: true,
  },
  {
    id: "pig", name: "Pig", emoji: "🐖", color: "from-rose-200 to-rose-400",
    src: "/sounds/pig.mp3", altSrcs: ["/sounds/extra/pig2.mp3"],
    pitchShift: 0, rate: 0.95, caption: "OINK-OINK TOOT",
    loopable: false, baseFreq: 140, detune: 30, attack: 0.02, hold: 0.25, release: 0.2,
    cutoff: 1200, noise: 0.28, pitchSweep: -3, wobble: 20, wobbleRate: 25, squelch: 0.7, thump: false,
  },
  {
    id: "duck", name: "Duck", emoji: "🦆", color: "from-yellow-200 to-yellow-400",
    src: "/sounds/duck.mp3", altSrcs: ["/sounds/extra/duck2.mp3"],
    pitchShift: 1, rate: 1.0, caption: "QUACK-TOOT",
    loopable: false, baseFreq: 380, detune: 4, attack: 0.005, hold: 0.12, release: 0.1,
    cutoff: 3000, noise: 0.1, pitchSweep: -8, wobble: 2, wobbleRate: 4, squelch: 0, thump: false,
  },
  {
    id: "elephant", name: "Elephant", emoji: "🐘", color: "from-slate-300 to-slate-500",
    src: "/sounds/elephant.mp3", altSrcs: ["/sounds/extra/elephant2.mp3"],
    pitchShift: -4, rate: 0.8, caption: "ROLLING THUNDER",
    loopable: false, baseFreq: 45, detune: 10, attack: 0.04, hold: 1.1, release: 0.7,
    cutoff: 350, noise: 0.08, pitchSweep: -6, wobble: 6, wobbleRate: 6, squelch: 0.05, thump: true,
  },
  {
    id: "monkey", name: "Monkey", emoji: "🐒", color: "from-lime-200 to-lime-400",
    src: "/sounds/monkey.mp3", altSrcs: ["/sounds/extra/monkey_v2.mp3"],
    pitchShift: 0, rate: 1.0, caption: "BEAT DROP",
    loopable: false, baseFreq: 280, detune: 35, attack: 0.01, hold: 0.2, release: 0.15,
    cutoff: 2400, noise: 0.4, pitchSweep: -4, wobble: 30, wobbleRate: 28, squelch: 0.6, thump: false,
  },
  {
    id: "snake", name: "Snake", emoji: "🐍", color: "from-emerald-200 to-emerald-400",
    src: "/sounds/snake.mp3", altSrcs: ["/sounds/extra/snake2.mp3"],
    pitchShift: 1, rate: 1.1, caption: "BURP-N-FART",
    loopable: false, baseFreq: 320, detune: 2, attack: 0.01, hold: 0.7, release: 0.6,
    cutoff: 2800, noise: 0.7, pitchSweep: -2, wobble: 1, wobbleRate: 14, squelch: 0, thump: false,
  },
  {
    id: "lion", name: "Lion", emoji: "🦁", color: "from-yellow-300 to-amber-500",
    src: "/sounds/lion.mp3", altSrcs: ["/sounds/extra/lion2.mp3"],
    pitchShift: -1, rate: 0.95, caption: "ROAR-TOOT",
    loopable: false, baseFreq: 55, detune: 8, attack: 0.05, hold: 0.85, release: 0.6,
    cutoff: 500, noise: 0.15, pitchSweep: -5, wobble: 5, wobbleRate: 10, squelch: 0.05, thump: true,
  },
  {
    id: "frog", name: "Frog", emoji: "🐸", color: "from-green-300 to-green-500",
    src: "/sounds/frog.mp3", altSrcs: ["/sounds/extra/frog2.mp3"],
    pitchShift: 2, rate: 1.1, caption: "RIBBIT TOOT",
    loopable: false, baseFreq: 160, detune: 6, attack: 0.008, hold: 0.1, release: 0.1,
    cutoff: 2000, noise: 0.12, pitchSweep: -10, wobble: 18, wobbleRate: 30, squelch: 0.8, thump: false,
  },
  // New animals (additive)
  {
    id: "bull", name: "Bull", emoji: "🐂", color: "from-red-300 to-red-500",
    src: "/sounds/bull.mp3", altSrcs: ["/sounds/extra/bull2.mp3"],
    pitchShift: -3, rate: 0.85, caption: "ROARIN' BULL",
    loopable: false, baseFreq: 55, detune: 8, attack: 0.05, hold: 0.85, release: 0.6,
    cutoff: 450, noise: 0.15, pitchSweep: -5, wobble: 5, wobbleRate: 10, squelch: 0.05, thump: true,
  },
  {
    id: "rabbit", name: "Rabbit", emoji: "🐰", color: "from-pink-100 to-pink-300",
    src: "/sounds/rabbit.mp3", altSrcs: ["/sounds/extra/rabbit_v2.mp3"],
    pitchShift: 4, rate: 1.2, caption: "TINY TOOT",
    loopable: false, baseFreq: 380, detune: 4, attack: 0.005, hold: 0.12, release: 0.1,
    cutoff: 3000, noise: 0.1, pitchSweep: -8, wobble: 2, wobbleRate: 4, squelch: 0, thump: false,
  },
  {
    id: "bear", name: "Bear", emoji: "🐻", color: "from-amber-500 to-orange-700",
    src: "/sounds/bear.mp3", altSrcs: ["/sounds/extra/bear2.mp3"],
    pitchShift: -5, rate: 0.75, caption: "GRIZZLY GRUMBLE",
    loopable: false, baseFreq: 50, detune: 10, attack: 0.05, hold: 1.2, release: 0.8,
    cutoff: 400, noise: 0.1, pitchSweep: -4, wobble: 4, wobbleRate: 6, squelch: 0.05, thump: true,
  },
  {
    id: "rooster", name: "Rooster", emoji: "🐓", color: "from-red-200 to-orange-300",
    src: "/sounds/rooster.mp3", altSrcs: ["/sounds/extra/rooster2.mp3"],
    pitchShift: 2, rate: 1.1, caption: "COCK-A-DOODLE",
    loopable: false, baseFreq: 400, detune: 8, attack: 0.005, hold: 0.2, release: 0.15,
    cutoff: 2500, noise: 0.2, pitchSweep: -3, wobble: 12, wobbleRate: 20, squelch: 0, thump: false,
  },
  {
    id: "turtle", name: "Turtle", emoji: "🐢", color: "from-emerald-300 to-emerald-500",
    src: "/sounds/turtle.mp3", altSrcs: ["/sounds/extra/turtle2.mp3"],
    pitchShift: -1, rate: 0.9, caption: "SLOW & LOW",
    loopable: false, baseFreq: 90, detune: 4, attack: 0.04, hold: 0.6, release: 0.4,
    cutoff: 600, noise: 0.1, pitchSweep: -2, wobble: 2, wobbleRate: 4, squelch: 0, thump: false,
  },
  {
    id: "whale", name: "Whale", emoji: "🐋", color: "from-blue-300 to-blue-500",
    src: "/sounds/whale.mp3", altSrcs: ["/sounds/extra/whale2.mp3"],
    pitchShift: -6, rate: 0.7, caption: "WHALE SONG",
    loopable: false, baseFreq: 40, detune: 6, attack: 0.06, hold: 1.5, release: 1.0,
    cutoff: 300, noise: 0.05, pitchSweep: -3, wobble: 3, wobbleRate: 4, squelch: 0.1, thump: true,
  },
  // v11: 6 new animals from extra/
  {
    id: "goat", name: "Goat", emoji: "🐐", color: "from-stone-300 to-stone-500",
    src: "/sounds/extra/goat.mp3",
    pitchShift: 0, rate: 1.0, caption: "BLEAT-BLAST",
    loopable: false, baseFreq: 200, detune: 20, attack: 0.01, hold: 0.6, release: 0.4,
    cutoff: 1500, noise: 0.25, pitchSweep: -2, wobble: 8, wobbleRate: 12, squelch: 0.3, thump: false,
  },
  {
    id: "sheep", name: "Sheep", emoji: "🐑", color: "from-gray-200 to-gray-400",
    src: "/sounds/extra/sheep.mp3",
    pitchShift: 1, rate: 1.05, caption: "WOOLY POP",
    loopable: false, baseFreq: 260, detune: 8, attack: 0.01, hold: 0.3, release: 0.2,
    cutoff: 2400, noise: 0.2, pitchSweep: -1, wobble: 6, wobbleRate: 14, squelch: 0.2, thump: false,
  },
  {
    id: "bee", name: "Bee", emoji: "🐝", color: "from-yellow-300 to-yellow-500",
    src: "/sounds/extra/bee.mp3",
    pitchShift: 4, rate: 1.2, caption: "BUZZ-WOOF",
    loopable: false, baseFreq: 600, detune: 4, attack: 0.005, hold: 0.5, release: 0.3,
    cutoff: 3500, noise: 0.3, pitchSweep: 1, wobble: 30, wobbleRate: 40, squelch: 0, thump: false,
  },
  {
    id: "turkey", name: "Turkey", emoji: "🦃", color: "from-red-400 to-red-600",
    src: "/sounds/extra/turkey.mp3",
    pitchShift: -2, rate: 0.9, caption: "GOBBLE-BOOM",
    loopable: false, baseFreq: 80, detune: 6, attack: 0.03, hold: 0.9, release: 0.6,
    cutoff: 500, noise: 0.15, pitchSweep: -3, wobble: 4, wobbleRate: 6, squelch: 0.05, thump: true,
  },
  {
    id: "owl", name: "Owl", emoji: "🦉", color: "from-indigo-300 to-indigo-500",
    src: "/sounds/extra/owl.mp3",
    pitchShift: 3, rate: 1.1, caption: "HOOT-FART",
    loopable: false, baseFreq: 400, detune: 12, attack: 0.01, hold: 0.4, release: 0.3,
    cutoff: 2800, noise: 0.3, pitchSweep: 2, wobble: 18, wobbleRate: 22, squelch: 0.4, thump: false,
  },
  {
    id: "penguin", name: "Penguin", emoji: "🐧", color: "from-cyan-200 to-cyan-400",
    src: "/sounds/extra/penguin.mp3",
    pitchShift: 2, rate: 1.0, caption: "TUXEDO SQUEAK",
    loopable: false, baseFreq: 320, detune: 6, attack: 0.008, hold: 0.3, release: 0.2,
    cutoff: 2200, noise: 0.4, pitchSweep: -2, wobble: 10, wobbleRate: 16, squelch: 0.5, thump: false,
  },
];

// "Oh No" voice samples — played as standalone buttons in the Oh No tab
export const OHNO_PRESETS: FartPreset[] = [
  {
    id: "ohno1", name: "Oh No!", emoji: "😱", color: "from-yellow-200 to-red-300",
    src: "/sounds/ohno1.mp3", pitchShift: 0, rate: 1.0, caption: "OOPS!",
    loopable: true, baseFreq: 200, detune: 0, attack: 0.01, hold: 0.5, release: 0.3,
    cutoff: 2000, noise: 0, pitchSweep: 0, wobble: 0, wobbleRate: 0, squelch: 0, thump: false,
  },
  {
    id: "ohno2", name: "Noooo", emoji: "🙀", color: "from-pink-300 to-purple-400",
    src: "/sounds/ohno2.mp3", pitchShift: 0, rate: 1.0, caption: "NOOOO!",
    loopable: true, baseFreq: 200, detune: 0, attack: 0.01, hold: 0.5, release: 0.3,
    cutoff: 2000, noise: 0, pitchSweep: 0, wobble: 0, wobbleRate: 0, squelch: 0, thump: false,
  },
  {
    id: "ohno3", name: "Oopsie", emoji: "😅", color: "from-rose-200 to-pink-300",
    src: "/sounds/ohno3.mp3", pitchShift: 0, rate: 1.0, caption: "OOPSIE",
    loopable: true, baseFreq: 200, detune: 0, attack: 0.01, hold: 0.5, release: 0.3,
    cutoff: 2000, noise: 0, pitchSweep: 0, wobble: 0, wobbleRate: 0, squelch: 0, thump: false,
  },
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
        audio.addEventListener("error", () => {
          sampleHealth.set(preset.id, "bad");
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
  const health = sampleHealth.get(preset.id) ?? "unknown";
  if (health === "bad") return false;
  const pool = pools.get(preset.id);
  if (pool && pool[0].readyState >= 2) {
    if (health === "unknown") sampleHealth.set(preset.id, "ok");
    return true;
  }
  return true;
}

let lastIndex = 0;
function pickNext(pool: HTMLAudioElement[]): HTMLAudioElement {
  if (pool.length === 0) throw new Error("empty audio pool");
  // Round-robin through the pool so different variants (when altSrcs is set)
  // get played in sequence rather than always picking the same one.
  const audio = pool[lastIndex % pool.length];
  lastIndex++;
  return audio;
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

// Bathroom reverb impulse response (synthesized at runtime)
let reverbImpulse: AudioBuffer | null = null;
function getReverbImpulse(ctx: AudioContext): AudioBuffer {
  if (reverbImpulse) return reverbImpulse;
  // Tile bathroom: 1.5s decay, ~5m^3 space
  const length = ctx.sampleRate * 1.5;
  const impulse = ctx.createBuffer(2, length, ctx.sampleRate);
  for (let c = 0; c < 2; c++) {
    const data = impulse.getChannelData(c);
    for (let i = 0; i < length; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, 3);
    }
  }
  reverbImpulse = impulse;
  return impulse;
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

export function setReverbMode(enabled: boolean) {
  (window as any).__reverbEnabled = enabled;
}

function isReverbEnabled(): boolean {
  return !!(window as any).__reverbEnabled;
}

// Play an AudioBuffer through a Web Audio chain with optional reverb.
// Used for reverb mode + custom recording playback.
export function playAudioBufferWithFx(buffer: AudioBuffer, withReverb: boolean): void {
  const ctx = getAudioCtx();
  const src = ctx.createBufferSource();
  src.buffer = buffer;
  src.loop = false;
  const gain = ctx.createGain();
  gain.gain.value = 0.9;
  if (withReverb) {
    const convolver = ctx.createConvolver();
    convolver.buffer = getReverbImpulse(ctx);
    const dryGain = ctx.createGain();
    dryGain.gain.value = 0.6;
    const wetGain = ctx.createGain();
    wetGain.gain.value = 0.6;
    src.connect(dryGain).connect(gain);
    src.connect(convolver).connect(wetGain).connect(gain);
  } else {
    src.connect(gain);
  }
  gain.connect(ctx.destination);
  src.start();
  setTimeout(() => { try { src.stop(); } catch {} }, (buffer.duration + 0.5) * 1000);
}

// Decode an audio Blob and play it through the FX chain.
// Used for custom recordings (saved as Blob URLs).
export async function playBlobWithFx(blob: Blob, withReverb: boolean): Promise<void> {
  const ctx = getAudioCtx();
  const arrayBuffer = await blob.arrayBuffer();
  const audioBuffer = await ctx.decodeAudioData(arrayBuffer);
  playAudioBufferWithFx(audioBuffer, withReverb);
}

export function playFart(preset: FartPreset, options: { loop?: boolean } = {}) {
  if (!preset.src || !isSampleHealthy(preset)) {
    try { playFartSynth(preset); } catch {}
    return;
  }
  const pool = getPool(preset);
  const audio = pickNext(pool);
  const semitoneRate = Math.pow(2, preset.pitchShift / 12);
  audio.playbackRate = preset.rate * semitoneRate;
  audio.volume = 0.9;
  audio.loop = options.loop ?? false;

  try { audio.currentTime = 0; } catch {}

  // If reverb is on, route through Web Audio convolver instead of direct
  if (isReverbEnabled()) {
    void playSampleWithReverb(audio.src);
    return;
  }

  const p = audio.play();
  if (p && typeof p.catch === "function") {
    p.catch(() => {
      sampleHealth.set(preset.id, "bad");
      try { playFartSynth(preset); } catch {}
    });
  }
  activeAudios.add(audio);
  audio.addEventListener("ended", () => activeAudios.delete(audio), { once: true });
}

// Fetch a sample URL, decode, and play through the reverb chain.
// Used when Bathroom mode is on.
async function playSampleWithReverb(url: string): Promise<void> {
  try {
    const ctx = getAudioCtx();
    const resp = await fetch(url);
    const arrayBuffer = await resp.arrayBuffer();
    const audioBuffer = await ctx.decodeAudioData(arrayBuffer);
    playAudioBufferWithFx(audioBuffer, true);
  } catch (err) {
    console.warn("[fart] reverb playback failed:", err);
  }
}

export function stopAllSounds() {
  activeAudios.forEach((a) => {
    a.pause();
    a.currentTime = 0;
  });
  activeAudios.clear();
}

export function playCombo(presets: FartPreset[]) {
  presets.forEach((p, i) => setTimeout(() => playFart(p), i * 220));
}

export function randomPreset(): FartPreset {
  return PRESETS[Math.floor(Math.random() * PRESETS.length)];
}

export async function primeAudio() {
  PRESETS.forEach((p) => getPool(p));
  OHNO_PRESETS.forEach((p) => getPool(p));
  await unlockAudio();
}

// Diagnostic
export function getAudioState(presetId: string) {
  const pool = pools.get(presetId);
  if (!pool || pool.length === 0) return null;
  const a = pool[0];
  return {
    src: a.src.split("/").pop(),
    paused: a.paused,
    currentTime: a.currentTime,
    duration: a.duration,
    readyState: a.readyState,
    error: a.error?.message || null,
    health: sampleHealth.get(presetId) || "unknown",
  };
}

// Recording API
export type RecordingResult = {
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

export function isRecording(): boolean {
  return activeRecorder !== null && activeRecorder.state === "recording";
}

// Custom recording preset (from user's mic)
export type CustomRecording = {
  id: string;
  name: string;
  emoji: string;
  url: string;
  createdAt: number;
};

const RECORDINGS_KEY = "fart-custom-recordings";

export function loadRecordings(): CustomRecording[] {
  try {
    const raw = localStorage.getItem(RECORDINGS_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch { return []; }
}

export function saveRecording(rec: Omit<CustomRecording, "id" | "createdAt">): CustomRecording {
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

export function renameRecording(id: string, name: string): void {
  const all = loadRecordings();
  const found = all.find((r) => r.id === id);
  if (found) {
    found.name = name;
    localStorage.setItem(RECORDINGS_KEY, JSON.stringify(all));
  }
}

// Favorites tracking (per-animal tap count)
const TAPS_KEY = "fart-tap-counts";

export function loadTapCounts(): Record<string, number> {
  try {
    const raw = localStorage.getItem(TAPS_KEY);
    if (!raw) return {};
    return JSON.parse(raw);
  } catch { return {}; }
}

export function recordTap(id: string): Record<string, number> {
  const counts = loadTapCounts();
  counts[id] = (counts[id] || 0) + 1;
  localStorage.setItem(TAPS_KEY, JSON.stringify(counts));
  return counts;
}

export function clearTaps(): void {
  localStorage.removeItem(TAPS_KEY);
}

// Per-card loop state (UI)
export function setCardLoop(id: string, looping: boolean): void {
  try {
    const raw = localStorage.getItem("fart-card-loops");
    const obj = raw ? JSON.parse(raw) : {};
    obj[id] = looping;
    localStorage.setItem("fart-card-loops", JSON.stringify(obj));
  } catch {}
}

export function loadCardLoops(): Record<string, boolean> {
  try {
    const raw = localStorage.getItem("fart-card-loops");
    if (!raw) return {};
    return JSON.parse(raw);
  } catch { return {}; }
}

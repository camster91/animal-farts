// Real audio sample playback with synth fallback.
// If a sample fails to load (404, decode error, autoplay block), fall back
// to a Web Audio synth. Per-preset health is tracked so we don't retry bad URLs.

import { playFartSynth, type FartPreset as SynthPreset } from "./fartSynth";

export type FartPreset = SynthPreset & {
  src: string;
  // Pitch shift in semitones applied to the sample via playbackRate
  pitchShift: number;
  // Base playback rate (1 = normal speed)
  rate: number;
  caption: string;
};

export const PRESETS: FartPreset[] = [
  {
    id: "cow",
    name: "Cow",
    emoji: "🐄",
    color: "from-pink-200 to-pink-400",
    src: "/sounds/cow.mp3",
    pitchShift: -2,
    rate: 0.9,
    caption: "MOOO-TION TOOT",
    baseFreq: 75, detune: 12, attack: 0.02, hold: 0.55, release: 0.35,
    cutoff: 600, noise: 0.18, pitchSweep: -4, wobble: 8, wobbleRate: 14,
    squelch: 0, thump: true,
  },
  {
    id: "dog",
    name: "Dog",
    emoji: "🐕",
    color: "from-amber-200 to-amber-400",
    src: "/sounds/dog.mp3",
    pitchShift: 0,
    rate: 1.0,
    caption: "SQUEAKY TOOT",
    baseFreq: 180, detune: 25, attack: 0.01, hold: 0.15, release: 0.12,
    cutoff: 1800, noise: 0.35, pitchSweep: -2, wobble: 15, wobbleRate: 22,
    squelch: 0.4, thump: false,
  },
  {
    id: "cat",
    name: "Cat",
    emoji: "🐈",
    color: "from-purple-200 to-purple-400",
    src: "/sounds/cat.mp3",
    pitchShift: 1,
    rate: 1.05,
    caption: "PURR-TOOT",
    baseFreq: 240, detune: 18, attack: 0.01, hold: 0.18, release: 0.18,
    cutoff: 2200, noise: 0.22, pitchSweep: -3, wobble: 10, wobbleRate: 18,
    squelch: 0.5, thump: false,
  },
  {
    id: "bird",
    name: "Bird",
    emoji: "🐦",
    color: "from-sky-200 to-sky-400",
    src: "/sounds/bird.mp3",
    pitchShift: 2,
    rate: 1.1,
    caption: "TWEET-TOOT",
    baseFreq: 520, detune: 8, attack: 0.005, hold: 0.08, release: 0.06,
    cutoff: 4000, noise: 0.5, pitchSweep: 2, wobble: 25, wobbleRate: 35,
    squelch: 0, thump: false,
  },
  {
    id: "horse",
    name: "Horse",
    emoji: "🐎",
    color: "from-orange-200 to-orange-400",
    src: "/sounds/horse.mp3",
    pitchShift: -3,
    rate: 0.85,
    caption: "THUNDER PLOP",
    baseFreq: 60, detune: 6, attack: 0.03, hold: 0.9, release: 0.5,
    cutoff: 450, noise: 0.12, pitchSweep: -2, wobble: 4, wobbleRate: 8,
    squelch: 0.1, thump: true,
  },
  {
    id: "pig",
    name: "Pig",
    emoji: "🐖",
    color: "from-rose-200 to-rose-400",
    src: "/sounds/pig.mp3",
    pitchShift: 0,
    rate: 0.95,
    caption: "OINK-OINK TOOT",
    baseFreq: 140, detune: 30, attack: 0.02, hold: 0.25, release: 0.2,
    cutoff: 1200, noise: 0.28, pitchSweep: -3, wobble: 20, wobbleRate: 25,
    squelch: 0.7, thump: false,
  },
  {
    id: "duck",
    name: "Duck",
    emoji: "🦆",
    color: "from-yellow-200 to-yellow-400",
    src: "/sounds/duck.mp3",
    pitchShift: 1,
    rate: 1.0,
    caption: "QUACK-TOOT",
    baseFreq: 380, detune: 4, attack: 0.005, hold: 0.12, release: 0.1,
    cutoff: 3000, noise: 0.1, pitchSweep: -8, wobble: 2, wobbleRate: 4,
    squelch: 0, thump: false,
  },
  {
    id: "elephant",
    name: "Elephant",
    emoji: "🐘",
    color: "from-slate-300 to-slate-500",
    src: "/sounds/elephant.mp3",
    pitchShift: -4,
    rate: 0.8,
    caption: "BOOM-BOOM",
    baseFreq: 45, detune: 10, attack: 0.04, hold: 1.1, release: 0.7,
    cutoff: 350, noise: 0.08, pitchSweep: -6, wobble: 6, wobbleRate: 6,
    squelch: 0.05, thump: true,
  },
  {
    id: "monkey",
    name: "Monkey",
    emoji: "🐒",
    color: "from-lime-200 to-lime-400",
    src: "/sounds/monkey.mp3",
    pitchShift: 0,
    rate: 1.0,
    caption: "OO-OO TOOT",
    baseFreq: 280, detune: 35, attack: 0.01, hold: 0.2, release: 0.15,
    cutoff: 2400, noise: 0.4, pitchSweep: -4, wobble: 30, wobbleRate: 28,
    squelch: 0.6, thump: false,
  },
  {
    id: "snake",
    name: "Snake",
    emoji: "🐍",
    color: "from-emerald-200 to-emerald-400",
    src: "/sounds/snake.mp3",
    pitchShift: 1,
    rate: 1.1,
    caption: "HISSS-TOOT",
    baseFreq: 320, detune: 2, attack: 0.01, hold: 0.7, release: 0.6,
    cutoff: 2800, noise: 0.7, pitchSweep: -2, wobble: 1, wobbleRate: 14,
    squelch: 0, thump: false,
  },
  {
    id: "lion",
    name: "Lion",
    emoji: "🦁",
    color: "from-yellow-300 to-amber-500",
    src: "/sounds/lion.mp3",
    pitchShift: -1,
    rate: 0.95,
    caption: "ROAR-TOOT",
    baseFreq: 55, detune: 8, attack: 0.05, hold: 0.85, release: 0.6,
    cutoff: 500, noise: 0.15, pitchSweep: -5, wobble: 5, wobbleRate: 10,
    squelch: 0.05, thump: true,
  },
  {
    id: "frog",
    name: "Frog",
    emoji: "🐸",
    color: "from-green-300 to-green-500",
    src: "/sounds/frog.mp3",
    pitchShift: 2,
    rate: 1.1,
    caption: "RIBBIT TOOT",
    baseFreq: 160, detune: 6, attack: 0.008, hold: 0.1, release: 0.1,
    cutoff: 2000, noise: 0.12, pitchSweep: -10, wobble: 18, wobbleRate: 30,
    squelch: 0.8, thump: false,
  },
];

// Pool of audio elements per preset — multiple instances allow rapid-fire taps
// without one playback cutting off the previous.
const POOL_SIZE = 4;
const pools = new Map<string, HTMLAudioElement[]>();
const sampleHealth = new Map<string, "unknown" | "ok" | "bad">();
let unlocked = false;

function getPool(preset: FartPreset): HTMLAudioElement[] {
  let pool = pools.get(preset.id);
  if (!pool) {
    pool = [];
    for (let i = 0; i < POOL_SIZE; i++) {
      const audio = new Audio(preset.src);
      audio.preload = "auto";
      // Mark sample as bad if it errors
      audio.addEventListener("error", () => {
        sampleHealth.set(preset.id, "bad");
      });
      pool.push(audio);
    }
    pools.set(preset.id, pool);
    sampleHealth.set(preset.id, "unknown");
  }
  return pool;
}

// Check if a sample is healthy (loaded without error)
function isSampleHealthy(preset: FartPreset): boolean {
  const health = sampleHealth.get(preset.id) ?? "unknown";
  if (health === "bad") return false;
  // Check the first pool element's readyState
  const pool = pools.get(preset.id);
  if (pool && pool[0].readyState >= 2) {
    // HAVE_CURRENT_DATA or better — loaded successfully
    if (health === "unknown") sampleHealth.set(preset.id, "ok");
    return true;
  }
  // Still loading — try the sample (it might work)
  return true;
}

let lastIndex = 0;
function pickNext(pool: HTMLAudioElement[]): HTMLAudioElement {
  const audio = pool[lastIndex % pool.length];
  lastIndex++;
  return audio;
}

// One-time unlock: play each sample muted for 1ms so iOS Safari registers
// a user-gesture interaction and lets subsequent play() calls through.
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
    } catch {
      // Unlock may fail; individual plays still work after the first real tap
    } finally {
      a.muted = false;
      a.volume = savedVolume;
    }
  }
}

export function playFart(preset: FartPreset) {
  // Try the real sample first if it's healthy (or we don't know yet)
  if (isSampleHealthy(preset)) {
    const pool = getPool(preset);
    const audio = pickNext(pool);
    const semitoneRate = Math.pow(2, preset.pitchShift / 12);
    audio.playbackRate = preset.rate * semitoneRate;
    audio.volume = 0.9;
    try {
      audio.currentTime = 0;
    } catch {}
    const p = audio.play();
    if (p && typeof p.catch === "function") {
      p.catch(() => {
        // Sample failed (autoplay block, decode error) — fall back to synth
        sampleHealth.set(preset.id, "bad");
        try { playFartSynth(preset); } catch {}
      });
    }
    return;
  }
  // Sample known bad — use synth
  try {
    playFartSynth(preset);
  } catch {}
}

export function playCombo(presets: FartPreset[]) {
  presets.forEach((p, i) => {
    setTimeout(() => playFart(p), i * 220);
  });
}

export function randomPreset(): FartPreset {
  return PRESETS[Math.floor(Math.random() * PRESETS.length)];
}

// Pre-warm the audio pool — call from a user gesture (e.g. first tap) to unlock
// iOS Safari audio.
export async function primeAudio() {
  PRESETS.forEach((p) => getPool(p));
  await unlockAudio();
}

// Diagnostic — get the actual state of the first audio element for a preset
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
    networkState: a.networkState,
    error: a.error?.message || null,
    volume: a.volume,
    playbackRate: a.playbackRate,
    health: sampleHealth.get(presetId) || "unknown",
  };
}

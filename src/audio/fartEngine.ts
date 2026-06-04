// Animal Farts — audio engine. v25k.1.
//
// v25k.1: sounds were picked from a MyInstants catalog but many of them
// aren't actually farts (cowbell, bird chirp, horse whinny). Kids noticed.
// New strategy: every tap plays a guaranteed-real-fart synth sound
// (low sawtooth + noise + lowpass + envelope) AND the sample on top at
// 30% volume (so cow has a cow-flavoured fart, bird has a bird-flavoured
// fart). If the sample fails to load, the synth alone still sounds good.

import { playFartSynth, type FartPreset as SynthPreset } from "./fartSynth";

export type FartPreset = SynthPreset & {
  // Optional sample for flavour on top of the synth. May be missing or
  // fail to load — synth plays regardless.
  src?: string;
};

export const PRESETS: FartPreset[] = [
  // Original 12 — v1 sounds recovered from git (used for flavour, NOT
  // as the primary sound). The synth is what makes the actual fart.
  { id: "cow", name: "Cow", emoji: "🐄", color: "from-pink-200 to-pink-400", src: "/sounds/v1/cow.mp3",
    baseFreq: 75, detune: 12, attack: 0.02, hold: 0.55, release: 0.35, cutoff: 600, noise: 0.18, pitchSweep: -4, wobble: 8, wobbleRate: 14, squelch: 0, thump: true },
  { id: "dog", name: "Dog", emoji: "🐕", color: "from-amber-200 to-amber-400", src: "/sounds/v1/dog.mp3",
    baseFreq: 180, detune: 25, attack: 0.01, hold: 0.15, release: 0.12, cutoff: 1800, noise: 0.35, pitchSweep: -2, wobble: 15, wobbleRate: 22, squelch: 0.4, thump: false },
  { id: "cat", name: "Cat", emoji: "🐈", color: "from-purple-200 to-purple-400", src: "/sounds/v1/cat.mp3",
    baseFreq: 240, detune: 18, attack: 0.01, hold: 0.18, release: 0.18, cutoff: 2200, noise: 0.22, pitchSweep: -3, wobble: 10, wobbleRate: 18, squelch: 0.5, thump: false },
  { id: "bird", name: "Bird", emoji: "🐦", color: "from-sky-200 to-sky-400", src: "/sounds/v1/bird.mp3",
    baseFreq: 520, detune: 8, attack: 0.005, hold: 0.08, release: 0.06, cutoff: 4000, noise: 0.5, pitchSweep: 2, wobble: 25, wobbleRate: 35, squelch: 0, thump: false },
  { id: "horse", name: "Horse", emoji: "🐎", color: "from-orange-200 to-orange-400", src: "/sounds/v1/horse.mp3",
    baseFreq: 60, detune: 6, attack: 0.03, hold: 0.9, release: 0.5, cutoff: 450, noise: 0.12, pitchSweep: -2, wobble: 4, wobbleRate: 8, squelch: 0.1, thump: true },
  { id: "pig", name: "Pig", emoji: "🐖", color: "from-rose-200 to-rose-400", src: "/sounds/v1/pig.mp3",
    baseFreq: 140, detune: 30, attack: 0.02, hold: 0.25, release: 0.2, cutoff: 1200, noise: 0.28, pitchSweep: -3, wobble: 20, wobbleRate: 25, squelch: 0.7, thump: false },
  { id: "duck", name: "Duck", emoji: "🦆", color: "from-yellow-200 to-yellow-400", src: "/sounds/v1/duck.mp3",
    baseFreq: 380, detune: 4, attack: 0.005, hold: 0.12, release: 0.1, cutoff: 3000, noise: 0.1, pitchSweep: -8, wobble: 2, wobbleRate: 4, squelch: 0, thump: false },
  { id: "elephant", name: "Elephant", emoji: "🐘", color: "from-slate-300 to-slate-500", src: "/sounds/v1/elephant.mp3",
    baseFreq: 45, detune: 10, attack: 0.04, hold: 1.1, release: 0.7, cutoff: 350, noise: 0.08, pitchSweep: -6, wobble: 6, wobbleRate: 6, squelch: 0.05, thump: true },
  { id: "monkey", name: "Monkey", emoji: "🐒", color: "from-lime-200 to-lime-400", src: "/sounds/v1/monkey.mp3",
    baseFreq: 280, detune: 35, attack: 0.01, hold: 0.2, release: 0.15, cutoff: 2400, noise: 0.4, pitchSweep: -4, wobble: 30, wobbleRate: 28, squelch: 0.6, thump: false },
  { id: "snake", name: "Snake", emoji: "🐍", color: "from-emerald-200 to-emerald-400", src: "/sounds/v1/snake.mp3",
    baseFreq: 320, detune: 2, attack: 0.01, hold: 0.7, release: 0.6, cutoff: 2800, noise: 0.7, pitchSweep: -2, wobble: 1, wobbleRate: 14, squelch: 0, thump: false },
  { id: "lion", name: "Lion", emoji: "🦁", color: "from-yellow-300 to-amber-500", src: "/sounds/v1/lion.mp3",
    baseFreq: 55, detune: 8, attack: 0.05, hold: 0.85, release: 0.6, cutoff: 500, noise: 0.15, pitchSweep: -5, wobble: 5, wobbleRate: 10, squelch: 0.05, thump: true },
  { id: "frog", name: "Frog", emoji: "🐸", color: "from-green-300 to-green-500", src: "/sounds/v1/frog.mp3",
    baseFreq: 160, detune: 6, attack: 0.008, hold: 0.1, release: 0.1, cutoff: 2000, noise: 0.12, pitchSweep: -10, wobble: 18, wobbleRate: 30, squelch: 0.8, thump: false },
  // v11+ animals — no sample, pure synth (these never had a real recording).
  { id: "bull", name: "Bull", emoji: "🐂", color: "from-red-300 to-red-500",
    baseFreq: 50, detune: 8, attack: 0.05, hold: 0.9, release: 0.6, cutoff: 420, noise: 0.18, pitchSweep: -5, wobble: 5, wobbleRate: 9, squelch: 0.05, thump: true },
  { id: "rabbit", name: "Rabbit", emoji: "🐰", color: "from-pink-100 to-pink-300",
    baseFreq: 380, detune: 4, attack: 0.005, hold: 0.12, release: 0.1, cutoff: 3000, noise: 0.1, pitchSweep: -8, wobble: 2, wobbleRate: 4, squelch: 0, thump: false },
  { id: "bear", name: "Bear", emoji: "🐻", color: "from-amber-500 to-orange-700",
    baseFreq: 50, detune: 10, attack: 0.05, hold: 1.2, release: 0.8, cutoff: 380, noise: 0.1, pitchSweep: -4, wobble: 4, wobbleRate: 6, squelch: 0.05, thump: true },
  { id: "rooster", name: "Rooster", emoji: "🐓", color: "from-red-200 to-orange-300",
    baseFreq: 400, detune: 8, attack: 0.005, hold: 0.2, release: 0.15, cutoff: 2500, noise: 0.2, pitchSweep: -3, wobble: 12, wobbleRate: 20, squelch: 0, thump: false },
  { id: "turtle", name: "Turtle", emoji: "🐢", color: "from-emerald-300 to-emerald-500",
    baseFreq: 90, detune: 4, attack: 0.04, hold: 0.6, release: 0.4, cutoff: 600, noise: 0.1, pitchSweep: -2, wobble: 2, wobbleRate: 4, squelch: 0, thump: false },
  { id: "whale", name: "Whale", emoji: "🐋", color: "from-blue-300 to-blue-500",
    baseFreq: 40, detune: 6, attack: 0.06, hold: 1.5, release: 1.0, cutoff: 280, noise: 0.05, pitchSweep: -3, wobble: 3, wobbleRate: 4, squelch: 0.1, thump: true },
  { id: "goat", name: "Goat", emoji: "🐐", color: "from-stone-300 to-stone-500",
    baseFreq: 200, detune: 20, attack: 0.01, hold: 0.6, release: 0.4, cutoff: 1500, noise: 0.25, pitchSweep: -2, wobble: 8, wobbleRate: 12, squelch: 0.3, thump: false },
  { id: "sheep", name: "Sheep", emoji: "🐑", color: "from-gray-200 to-gray-400",
    baseFreq: 260, detune: 8, attack: 0.01, hold: 0.3, release: 0.2, cutoff: 2400, noise: 0.2, pitchSweep: -1, wobble: 6, wobbleRate: 14, squelch: 0.2, thump: false },
  { id: "bee", name: "Bee", emoji: "🐝", color: "from-yellow-300 to-yellow-500",
    baseFreq: 600, detune: 4, attack: 0.005, hold: 0.5, release: 0.3, cutoff: 3500, noise: 0.3, pitchSweep: 1, wobble: 30, wobbleRate: 40, squelch: 0, thump: false },
  { id: "turkey", name: "Turkey", emoji: "🦃", color: "from-red-400 to-red-600",
    baseFreq: 80, detune: 6, attack: 0.03, hold: 0.9, release: 0.6, cutoff: 500, noise: 0.15, pitchSweep: -3, wobble: 4, wobbleRate: 6, squelch: 0.05, thump: true },
  { id: "owl", name: "Owl", emoji: "🦉", color: "from-indigo-300 to-indigo-500",
    baseFreq: 400, detune: 12, attack: 0.01, hold: 0.4, release: 0.3, cutoff: 2800, noise: 0.3, pitchSweep: 2, wobble: 18, wobbleRate: 22, squelch: 0.4, thump: false },
  { id: "penguin", name: "Penguin", emoji: "🐧", color: "from-cyan-200 to-cyan-400",
    baseFreq: 320, detune: 6, attack: 0.008, hold: 0.3, release: 0.2, cutoff: 2200, noise: 0.4, pitchSweep: -2, wobble: 10, wobbleRate: 16, squelch: 0.5, thump: false },
  { id: "seal", name: "Seal", emoji: "🦭", color: "from-slate-200 to-slate-400",
    baseFreq: 150, detune: 8, attack: 0.01, hold: 0.8, release: 0.5, cutoff: 1200, noise: 0.2, pitchSweep: 1, wobble: 4, wobbleRate: 8, squelch: 0.05, thump: false },
  { id: "hippo", name: "Hippo", emoji: "🦛", color: "from-pink-300 to-purple-400",
    baseFreq: 50, detune: 6, attack: 0.04, hold: 1.2, release: 0.8, cutoff: 400, noise: 0.1, pitchSweep: -2, wobble: 3, wobbleRate: 4, squelch: 0.05, thump: true },
  { id: "rhino", name: "Rhino", emoji: "🦏", color: "from-stone-400 to-stone-600",
    baseFreq: 45, detune: 4, attack: 0.05, hold: 1.3, release: 0.7, cutoff: 360, noise: 0.08, pitchSweep: -3, wobble: 4, wobbleRate: 5, squelch: 0.05, thump: true },
  { id: "zebra", name: "Zebra", emoji: "🦓", color: "from-gray-100 to-gray-300",
    baseFreq: 220, detune: 12, attack: 0.01, hold: 0.4, release: 0.3, cutoff: 2000, noise: 0.2, pitchSweep: -1, wobble: 8, wobbleRate: 14, squelch: 0.2, thump: false },
  { id: "giraffe", name: "Giraffe", emoji: "🦒", color: "from-yellow-200 to-amber-300",
    baseFreq: 75, detune: 6, attack: 0.02, hold: 0.7, release: 0.5, cutoff: 600, noise: 0.12, pitchSweep: -2, wobble: 5, wobbleRate: 8, squelch: 0.05, thump: true },
  { id: "moose", name: "Moose", emoji: "🦌", color: "from-amber-500 to-orange-600",
    baseFreq: 55, detune: 8, attack: 0.04, hold: 1.0, release: 0.6, cutoff: 450, noise: 0.1, pitchSweep: -3, wobble: 4, wobbleRate: 6, squelch: 0.05, thump: true },
  { id: "kangaroo", name: "Kangaroo", emoji: "🦘", color: "from-orange-300 to-orange-500",
    baseFreq: 180, detune: 15, attack: 0.01, hold: 0.3, release: 0.2, cutoff: 1500, noise: 0.25, pitchSweep: -1, wobble: 12, wobbleRate: 18, squelch: 0.3, thump: false },
  { id: "sloth", name: "Sloth", emoji: "🦥", color: "from-lime-200 to-amber-200",
    baseFreq: 100, detune: 4, attack: 0.05, hold: 1.5, release: 1.0, cutoff: 700, noise: 0.08, pitchSweep: -1, wobble: 2, wobbleRate: 3, squelch: 0.05, thump: false },
  { id: "skunk", name: "Skunk", emoji: "🦨", color: "from-gray-300 to-gray-500",
    baseFreq: 300, detune: 6, attack: 0.01, hold: 0.5, release: 0.4, cutoff: 2200, noise: 0.4, pitchSweep: -2, wobble: 10, wobbleRate: 14, squelch: 0.3, thump: false },
  { id: "raccoon", name: "Raccoon", emoji: "🦝", color: "from-stone-300 to-stone-500",
    baseFreq: 200, detune: 10, attack: 0.015, hold: 0.4, release: 0.3, cutoff: 1800, noise: 0.3, pitchSweep: -1, wobble: 8, wobbleRate: 12, squelch: 0.2, thump: false },
  { id: "elephant-long", name: "Mammoth", emoji: "🦣", color: "from-stone-500 to-stone-700",
    baseFreq: 40, detune: 8, attack: 0.05, hold: 2.0, release: 0.8, cutoff: 280, noise: 0.05, pitchSweep: -8, wobble: 3, wobbleRate: 4, squelch: 0.05, thump: true },
  { id: "lion-long", name: "Mega-Lion", emoji: "🦁", color: "from-amber-400 to-red-600",
    baseFreq: 50, detune: 10, attack: 0.05, hold: 1.5, release: 0.6, cutoff: 450, noise: 0.1, pitchSweep: -6, wobble: 4, wobbleRate: 6, squelch: 0.05, thump: true },
  { id: "snake-long", name: "Python", emoji: "🐍", color: "from-emerald-400 to-emerald-600",
    baseFreq: 240, detune: 4, attack: 0.02, hold: 1.2, release: 0.5, cutoff: 2000, noise: 0.6, pitchSweep: -2, wobble: 1, wobbleRate: 8, squelch: 0, thump: false },
];

// One pool of <audio> elements per sample URL, lazy-created on first play.
// Used for the sample "flavour" layer on top of the synth.
const pool = new Map<string, HTMLAudioElement[]>();
const POOL_SIZE = 3;

function getOrCreatePool(src: string): HTMLAudioElement[] {
  let p = pool.get(src);
  if (!p) {
    p = [];
    for (let i = 0; i < POOL_SIZE; i++) {
      const a = new Audio(src);
      a.preload = "auto";
      p.push(a);
    }
    pool.set(src, p);
  }
  return p;
}

let cursor = 0;
function nextAudio(src: string): HTMLAudioElement {
  const p = getOrCreatePool(src);
  const a = p[cursor % p.length];
  cursor = (cursor + 1) % p.length;
  return a;
}

// === Public API ===

// Play a preset's sound. The synth is the primary fart sound; if the preset
// has a sample, it plays at 25% volume underneath for flavour. Returns a
// promise that resolves when both layers are done. Safe to call from a click.
export function playFart(preset: FartPreset): Promise<void> {
  // Layer 1: the synth (always plays, regardless of sample)
  try {
    playFartSynth(preset);
  } catch (err) {
    console.warn("[fart] synth failed:", err);
  }

  // Layer 2: the sample at 25% volume (best-effort, may fail silently)
  if (preset.src) {
    const a = nextAudio(preset.src);
    try { a.currentTime = 0; } catch {}
    a.volume = 0.25;
    return a.play().catch((err) => {
      // Sample failed (network, format). Synth is already playing, so
      // the kid still hears a fart.
      console.warn("[fart] sample failed:", err);
    });
  }

  // Synth-only. Resolve on a short delay (roughly synth duration).
  const dur = preset.attack + preset.hold + preset.release;
  return new Promise((resolve) => setTimeout(resolve, dur * 1000));
}

// Play a recording (Blob URL) or any arbitrary URL.
export function playUrl(url: string): Promise<void> {
  const a = nextAudio(url);
  try { a.currentTime = 0; } catch {}
  a.volume = 0.9;
  return a.play().catch((err) => {
    console.warn("[fart] play failed:", err);
  });
}

export function stopAllSounds() {
  pool.forEach((arr) => {
    for (const a of arr) {
      a.pause();
      a.currentTime = 0;
    }
  });
}

// === Recording ===

let activeRecorder: MediaRecorder | null = null;
let activeStream: MediaStream | null = null;
let chunks: Blob[] = [];
let startedAt = 0;

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
}

export type RecordingResult = {
  blob: Blob;
  url: string;
  duration: number;
};

export function stopRecording(): Promise<RecordingResult | null> {
  return new Promise((resolve) => {
    if (!activeRecorder) {
      resolve(null);
      return;
    }
    const recorder = activeRecorder;
    const stream = activeStream;
    recorder.addEventListener(
      "stop",
      () => {
        const duration = (Date.now() - startedAt) / 1000;
        const blob = new Blob(chunks, { type: recorder.mimeType });
        const url = URL.createObjectURL(blob);
        if (stream) stream.getTracks().forEach((t) => t.stop());
        activeRecorder = null;
        activeStream = null;
        resolve({ blob, url, duration });
      },
      { once: true }
    );
    recorder.stop();
  });
}

// === Custom recording persistence (localStorage) ===

export type CustomRecording = {
  id: string;
  url: string;
  duration: number;
  createdAt: number;
};

const REC_KEY = "fart-custom-recordings-v1";

export function loadRecordings(): CustomRecording[] {
  try {
    const raw = localStorage.getItem(REC_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

export function saveRecording(rec: Omit<CustomRecording, "id" | "createdAt">): CustomRecording {
  const all = loadRecordings();
  const id = `rec-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const entry: CustomRecording = { ...rec, id, createdAt: Date.now() };
  all.push(entry);
  localStorage.setItem(REC_KEY, JSON.stringify(all));
  return entry;
}

export function deleteRecording(id: string): void {
  const all = loadRecordings();
  const target = all.find((r) => r.id === id);
  if (target) {
    try {
      URL.revokeObjectURL(target.url);
    } catch {
      // ignore
    }
  }
  localStorage.setItem(
    REC_KEY,
    JSON.stringify(all.filter((r) => r.id !== id))
  );
}

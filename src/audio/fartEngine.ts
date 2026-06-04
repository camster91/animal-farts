// Animal Farts — minimal audio engine. v25k.
//
// One job: play an animal's sound file. No reverb, no pitch shift, no FX.
// Recordings use the same play path with a Blob URL.
//
// The 37 animals share a small pool of HTMLAudioElements. When the kid taps
// an animal, we round-robin through the pool so rapid taps don't all hit
// the same element (which is still busy playing).

export type FartPreset = {
  id: string;
  name: string;
  emoji: string;
  color: string;
  src: string;
};

// v1 sounds (recovered from git) for the original 12, single source per
// animal for the rest. No pitch shift, no rate change.
export const PRESETS: FartPreset[] = [
  { id: "cow", name: "Cow", emoji: "🐄", color: "from-pink-200 to-pink-400", src: "/sounds/v1/cow.mp3" },
  { id: "dog", name: "Dog", emoji: "🐕", color: "from-amber-200 to-amber-400", src: "/sounds/v1/dog.mp3" },
  { id: "cat", name: "Cat", emoji: "🐈", color: "from-purple-200 to-purple-400", src: "/sounds/v1/cat.mp3" },
  { id: "bird", name: "Bird", emoji: "🐦", color: "from-sky-200 to-sky-400", src: "/sounds/v1/bird.mp3" },
  { id: "horse", name: "Horse", emoji: "🐎", color: "from-orange-200 to-orange-400", src: "/sounds/v1/horse.mp3" },
  { id: "pig", name: "Pig", emoji: "🐖", color: "from-rose-200 to-rose-400", src: "/sounds/v1/pig.mp3" },
  { id: "duck", name: "Duck", emoji: "🦆", color: "from-yellow-200 to-yellow-400", src: "/sounds/v1/duck.mp3" },
  { id: "elephant", name: "Elephant", emoji: "🐘", color: "from-slate-300 to-slate-500", src: "/sounds/v1/elephant.mp3" },
  { id: "monkey", name: "Monkey", emoji: "🐒", color: "from-lime-200 to-lime-400", src: "/sounds/v1/monkey.mp3" },
  { id: "snake", name: "Snake", emoji: "🐍", color: "from-emerald-200 to-emerald-400", src: "/sounds/v1/snake.mp3" },
  { id: "lion", name: "Lion", emoji: "🦁", color: "from-yellow-300 to-amber-500", src: "/sounds/v1/lion.mp3" },
  { id: "frog", name: "Frog", emoji: "🐸", color: "from-green-300 to-green-500", src: "/sounds/v1/frog.mp3" },
  { id: "bull", name: "Bull", emoji: "🐂", color: "from-red-300 to-red-500", src: "/sounds/bull.mp3" },
  { id: "rabbit", name: "Rabbit", emoji: "🐰", color: "from-pink-100 to-pink-300", src: "/sounds/rabbit.mp3" },
  { id: "bear", name: "Bear", emoji: "🐻", color: "from-amber-500 to-orange-700", src: "/sounds/bear.mp3" },
  { id: "rooster", name: "Rooster", emoji: "🐓", color: "from-red-200 to-orange-300", src: "/sounds/rooster.mp3" },
  { id: "turtle", name: "Turtle", emoji: "🐢", color: "from-emerald-300 to-emerald-500", src: "/sounds/turtle.mp3" },
  { id: "whale", name: "Whale", emoji: "🐋", color: "from-blue-300 to-blue-500", src: "/sounds/whale.mp3" },
  { id: "goat", name: "Goat", emoji: "🐐", color: "from-stone-300 to-stone-500", src: "/sounds/extra/goat.mp3" },
  { id: "sheep", name: "Sheep", emoji: "🐑", color: "from-gray-200 to-gray-400", src: "/sounds/extra/sheep.mp3" },
  { id: "bee", name: "Bee", emoji: "🐝", color: "from-yellow-300 to-yellow-500", src: "/sounds/extra/bee.mp3" },
  { id: "turkey", name: "Turkey", emoji: "🦃", color: "from-red-400 to-red-600", src: "/sounds/extra/turkey.mp3" },
  { id: "owl", name: "Owl", emoji: "🦉", color: "from-indigo-300 to-indigo-500", src: "/sounds/extra/owl.mp3" },
  { id: "penguin", name: "Penguin", emoji: "🐧", color: "from-cyan-200 to-cyan-400", src: "/sounds/extra/penguin.mp3" },
  { id: "seal", name: "Seal", emoji: "🦭", color: "from-slate-200 to-slate-400", src: "/sounds/extra/seal.mp3" },
  { id: "hippo", name: "Hippo", emoji: "🦛", color: "from-pink-300 to-purple-400", src: "/sounds/extra/hippo.mp3" },
  { id: "rhino", name: "Rhino", emoji: "🦏", color: "from-stone-400 to-stone-600", src: "/sounds/extra/rhino.mp3" },
  { id: "zebra", name: "Zebra", emoji: "🦓", color: "from-gray-100 to-gray-300", src: "/sounds/extra/zebra.mp3" },
  { id: "giraffe", name: "Giraffe", emoji: "🦒", color: "from-yellow-200 to-amber-300", src: "/sounds/extra/giraffe.mp3" },
  { id: "moose", name: "Moose", emoji: "🦌", color: "from-amber-500 to-orange-600", src: "/sounds/extra/moose.mp3" },
  { id: "kangaroo", name: "Kangaroo", emoji: "🦘", color: "from-orange-300 to-orange-500", src: "/sounds/extra/kangaroo.mp3" },
  { id: "sloth", name: "Sloth", emoji: "🦥", color: "from-lime-200 to-amber-200", src: "/sounds/extra/sloth.mp3" },
  { id: "skunk", name: "Skunk", emoji: "🦨", color: "from-gray-300 to-gray-500", src: "/sounds/extra/skunk.mp3" },
  { id: "raccoon", name: "Raccoon", emoji: "🦝", color: "from-stone-300 to-stone-500", src: "/sounds/extra/raccoon.mp3" },
  { id: "elephant-long", name: "Mammoth", emoji: "🦣", color: "from-stone-500 to-stone-700", src: "/sounds/extra/elephant_long.mp3" },
  { id: "lion-long", name: "Mega-Lion", emoji: "🦁", color: "from-amber-400 to-red-600", src: "/sounds/extra/lion_long.mp3" },
  { id: "snake-long", name: "Python", emoji: "🐍", color: "from-emerald-400 to-emerald-600", src: "/sounds/extra/snake_long.mp3" },
];

// One pool of <audio> elements per preset, lazy-created on first play.
// Recordings get their own single-use element (Blob URL).
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

// Play an animal's sound. Returns a promise that resolves when playback
// ends or rejects on error. Safe to call from a click handler — the first
// user gesture unlocks the AudioContext, so subsequent plays work.
export function playFart(preset: FartPreset): Promise<void> {
  const a = nextAudio(preset.src);
  a.currentTime = 0;
  a.volume = 0.9;
  return a.play().catch((err) => {
    // Autoplay blocked, file missing, etc. — fail silently, the kid will
    // tap again and the next click usually works.
    console.warn("[fart] play failed:", err);
  });
}

// Play a recording (Blob URL) or any arbitrary URL. Same shape as playFart.
export function playUrl(url: string): Promise<void> {
  const a = nextAudio(url);
  a.currentTime = 0;
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

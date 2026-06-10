export const DEFAULT_SETTINGS = { volume: 0.9, reducedMotion: false };
export const SETTINGS_KEY = "pootbox-settings-v1";
export const HIDDEN_LONG_PRESS_MS = 5000;
export const MAX_RECORDING_MS = 6000;
// Physics constants
export const FRICTION = 0.995;
export const WALL_BOUNCE = 0.7;
export const COLLISION_BOUNCE = 0.85;
export const DRAG_THROW_MULTIPLIER = 1.0;
export const COLLISION_AUDIO_WINDOW_MS = 500;
// New v46 constants
export const SHAKE_DETECTION_MS = 2000;
export const SHAKE_THRESHOLD = 22;
export const MIN_DRIFT_INTERVAL_MS = 4000;
export const DRIFT_FORCE_MAX = 0.15;
export const MAX_PAGES = 6;
export const MAX_BUBBLES_PER_PAGE = 12;
export const DEFAULT_PAGE_EMOJI = "🏠";
// --- Built-in sound library (~30 entries, curated from existing assets) ---
export const BUILT_IN_SOUNDS = [
    // Animals (12)
    { key: "cow", emoji: "🐄", name: "Cow", file: "/sounds/cow.mp3", bucket: "animal" },
    { key: "dog", emoji: "🐕", name: "Dog", file: "/sounds/dog.mp3", bucket: "animal" },
    { key: "cat", emoji: "🐈", name: "Cat", file: "/sounds/cat.mp3", bucket: "animal" },
    { key: "pig", emoji: "🐖", name: "Pig", file: "/sounds/pig.mp3", bucket: "animal" },
    { key: "duck", emoji: "🦆", name: "Duck", file: "/sounds/duck.mp3", bucket: "animal" },
    { key: "lion", emoji: "🦁", name: "Lion", file: "/sounds/lion.mp3", bucket: "animal" },
    { key: "frog", emoji: "🐸", name: "Frog", file: "/sounds/frog.mp3", bucket: "animal" },
    { key: "monkey", emoji: "🐒", name: "Monkey", file: "/sounds/monkey.mp3", bucket: "animal" },
    { key: "horse", emoji: "🐎", name: "Horse", file: "/sounds/horse.mp3", bucket: "animal" },
    { key: "elephant", emoji: "🐘", name: "Elephant", file: "/sounds/elephant.mp3", bucket: "animal" },
    { key: "rooster", emoji: "🐓", name: "Rooster", file: "/sounds/rooster.mp3", bucket: "animal" },
    { key: "bear", emoji: "🐻", name: "Bear", file: "/sounds/bear.mp3", bucket: "animal" },
    // Farts (6 — kid-friendly names, from /sounds/farts/)
    { key: "fart-wet", emoji: "💥", name: "Wet Fart", file: "/sounds/farts/025-wet-squelch.mp3", bucket: "fart" },
    { key: "fart-squeaky", emoji: "💨", name: "Squeaky Fart", file: "/sounds/farts/010-squeaky-pitch.mp3", bucket: "fart" },
    { key: "fart-long", emoji: "💨", name: "Long Fart", file: "/sounds/farts/012-long-drawn-out.mp3", bucket: "fart" },
    { key: "fart-bubbly", emoji: "🫧", name: "Bubbly Fart", file: "/sounds/farts/023-bubbly-tiny-bursts.mp3", bucket: "fart" },
    { key: "fart-dry", emoji: "💨", name: "Dry Fart", file: "/sounds/farts/014-dry-blast.mp3", bucket: "fart" },
    { key: "fart-echo", emoji: "🕳️", name: "Echo Fart", file: "/sounds/farts/041-echo-room.mp3", bucket: "fart" },
    // Silly (6)
    { key: "burp", emoji: "🤮", name: "Burp", file: "/sounds/farts/005-groan-1306380507.mp3", bucket: "silly" },
    { key: "kiss", emoji: "💋", name: "Kiss", file: "/sounds/farts/007-uuuuuu-paula-1357936016.mp3", bucket: "silly" },
    { key: "boom", emoji: "💥", name: "Boom", file: "/sounds/farts/006-silly-farts-joe-1473367952.mp3", bucket: "silly" },
    { key: "whistle", emoji: "🎵", name: "Whistle", file: "/sounds/farts/049-squeaky-whistle.mp3", bucket: "silly" },
    { key: "drum", emoji: "🥁", name: "Drum", file: "/sounds/farts/009-reverb-faraway.mp3", bucket: "silly" },
    { key: "bell", emoji: "🔔", name: "Bell", file: "/sounds/farts/003-toilet-flushing-kevangc-917782919.mp3", bucket: "silly" },
    // Instruments (6)
    { key: "piano", emoji: "🎹", name: "Piano", file: "/sounds/extra/lion_long.mp3", bucket: "instrument" },
    { key: "guitar", emoji: "🎸", name: "Guitar", file: "/sounds/extra/moose.mp3", bucket: "instrument" },
    { key: "drum2", emoji: "🥁", name: "Drum", file: "/sounds/extra/bee.mp3", bucket: "instrument" },
    { key: "cymbal", emoji: "🟠", name: "Cymbal", file: "/sounds/extra/rhino.mp3", bucket: "instrument" },
    { key: "flute", emoji: "🎶", name: "Flute", file: "/sounds/extra/owl.mp3", bucket: "instrument" },
    { key: "horn", emoji: "📯", name: "Horn", file: "/sounds/extra/giraffe.mp3", bucket: "instrument" },
];
// --- Backward-compatible aliases for existing PootBox.tsx ---
/** @deprecated Use BUILT_IN_SOUNDS with bucket="animal" — persists for PootBox.tsx until v46e */
export const CIRCLES = BUILT_IN_SOUNDS
    .filter(s => s.bucket === "animal")
    .map(s => ({
    id: s.key,
    emoji: s.emoji,
    color: "transparent",
    shadow: "transparent",
    hatchEmoji: "🐦",
    sounds: [s.file],
    radius: 32,
    mass: 1,
}));
/** @deprecated Use MAX_BUBBLES_PER_PAGE — persists for PootBox.tsx until v46e */
export const MAX_CUSTOM_CIRCLES = MAX_BUBBLES_PER_PAGE;
// --- Settings helpers ---
export function loadSettings() {
    try {
        const raw = localStorage.getItem(SETTINGS_KEY);
        if (raw)
            return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
    }
    catch { /* ignore */ }
    return DEFAULT_SETTINGS;
}
export function saveSettings(s) {
    try {
        localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
    }
    catch { /* ignore */ }
}

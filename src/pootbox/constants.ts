import type { Circle } from "./types";

export const CIRCLES: Circle[] = [
  { id: "cow", emoji: "🐄", color: "transparent", shadow: "transparent", hatchEmoji: "🐦", sounds: ["/sounds/cow.mp3", "/sounds/v1/cow.mp3"], radius: 32, mass: 1 },
  { id: "dog", emoji: "🐕", color: "transparent", shadow: "transparent", hatchEmoji: "🦋", sounds: ["/sounds/dog.mp3", "/sounds/v1/dog.mp3"], radius: 30, mass: 1 },
  { id: "cat", emoji: "🐈", color: "transparent", shadow: "transparent", hatchEmoji: "🐟", sounds: ["/sounds/cat.mp3", "/sounds/v1/cat.mp3"], radius: 30, mass: 1 },
  { id: "pig", emoji: "🐖", color: "transparent", shadow: "transparent", hatchEmoji: "🐛", sounds: ["/sounds/pig.mp3", "/sounds/extra/pig.mp3"], radius: 32, mass: 1 },
  { id: "duck", emoji: "🦆", color: "transparent", shadow: "transparent", hatchEmoji: "🐝", sounds: ["/sounds/duck.mp3", "/sounds/v1/duck.mp3"], radius: 30, mass: 1 },
  { id: "lion", emoji: "🦁", color: "transparent", shadow: "transparent", hatchEmoji: "🐞", sounds: ["/sounds/lion.mp3", "/sounds/v1/lion.mp3", "/sounds/extra/lion_long.mp3"], radius: 32, mass: 1 },
  { id: "frog", emoji: "🐸", color: "transparent", shadow: "transparent", hatchEmoji: "🐜", sounds: ["/sounds/frog.mp3", "/sounds/v1/frog.mp3"], radius: 30, mass: 1 },
  { id: "monkey", emoji: "🐒", color: "transparent", shadow: "transparent", hatchEmoji: "🐌", sounds: ["/sounds/monkey.mp3", "/sounds/v1/monkey.mp3"], radius: 30, mass: 1 },
  { id: "horse", emoji: "🐎", color: "transparent", shadow: "transparent", hatchEmoji: "🐢", sounds: ["/sounds/horse.mp3", "/sounds/v1/horse.mp3"], radius: 32, mass: 1 },
  { id: "elephant", emoji: "🐘", color: "transparent", shadow: "transparent", hatchEmoji: "🦄", sounds: ["/sounds/elephant.mp3", "/sounds/v1/elephant.mp3", "/sounds/extra/elephant_long.mp3"], radius: 34, mass: 1 },
  { id: "rooster", emoji: "🐓", color: "transparent", shadow: "transparent", hatchEmoji: "🦜", sounds: ["/sounds/rooster.mp3"], radius: 30, mass: 1 },
  { id: "bear", emoji: "🐻", color: "transparent", shadow: "transparent", hatchEmoji: "🐨", sounds: ["/sounds/bear.mp3"], radius: 32, mass: 1 },
];

export const DEFAULT_SETTINGS = { volume: 0.9, reducedMotion: false };
export const SETTINGS_KEY = "pootbox-settings-v1";
export const HIDDEN_LONG_PRESS_MS = 5000;
export const MAX_CUSTOM_CIRCLES = 12;
export const MAX_RECORDING_MS = 6000;

// Physics constants
export const FRICTION = 0.995;
export const WALL_BOUNCE = 0.7;
export const COLLISION_BOUNCE = 0.85;
export const DRAG_THROW_MULTIPLIER = 1.0;
export const COLLISION_AUDIO_WINDOW_MS = 800;

export function loadSettings(): { volume: number; reducedMotion: boolean } {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (raw) return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch { /* ignore */ }
  return DEFAULT_SETTINGS;
}

export function saveSettings(s: { volume: number; reducedMotion: boolean }): void {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
  } catch { /* ignore */ }
}
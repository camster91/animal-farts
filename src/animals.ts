// Shared animal/catalog list. v25t: drops the v25s animal-only model
// and uses the full 388-entry SOUND_CATALOG. Each tile is a unique
// (sound, emoji, name) tuple. The grid shows ALL tiles by default.
// Animal sound tiles still get animal emoji + animal name. Flavor
// farts get flavor emoji (💦 wet, 🍂 dry, 🏛️ echo, 🐌 long, 🎺 squeaky,
// 🫧 bubbly). Flat /farts/ cycle through a curated non-animal emoji
// pool so the kid gets visual variety.

import { SOUND_CATALOG, type SoundEntry } from "./audio/soundCatalog";

export type { SoundEntry };

/** A single grid tile. v25t: 1:1 with a catalog entry. */
export type Tile = {
  id: string;        // catalog index as string ("0", "1", ...)
  sound: string;
  emoji: string;
  name: string;
  /** "animal" | "wet" | "dry" | "echo" | "long" | "squeaky" | "bubbly" | "other" */
  group: string;
};

/** Group classification. The grid can filter by group. */
function classify(entry: SoundEntry): string {
  const s = entry.sound;
  // Per-animal sounds (49 total)
  if (s.match(/^\/sounds\/(?:extra\/|v1\/)?[a-z]+(?:\.mp3|_v\d+\.mp3|_long\.mp3|2\.mp3|3\.mp3|_2\.mp3|_3\.mp3)$/)
      && !s.includes('/farts/')) {
    return 'animal';
  }
  if (s.includes('/farts/wet/')) return 'wet';
  if (s.includes('/farts/dry/')) return 'dry';
  if (s.includes('/farts/echo/')) return 'echo';
  if (s.includes('/farts/long/')) return 'long';
  if (s.includes('/farts/squeaky/')) return 'squeaky';
  if (s.includes('/farts/bubbly/')) return 'bubbly';
  if (s.includes('/farts/')) return 'other';
  return 'animal';
}

export const TILES: Tile[] = SOUND_CATALOG.map((e, i) => ({
  id: String(i),
  sound: e.sound,
  emoji: e.emoji,
  name: e.name,
  group: classify(e),
}));

export const TILE_BY_ID = new Map(TILES.map((t) => [t.id, t]));

/** Filter chip definitions. */
export const FILTERS = [
  { id: 'all',     label: 'All sounds',  emoji: '💨', groups: null as readonly string[] | null },
  { id: 'animal',  label: 'Animals',     emoji: '🐾', groups: ['animal'] },
  { id: 'wet',     label: 'Wet',         emoji: '💦', groups: ['wet'] },
  { id: 'dry',     label: 'Dry',         emoji: '🍂', groups: ['dry'] },
  { id: 'echo',    label: 'Echo',        emoji: '🏛️', groups: ['echo'] },
  { id: 'long',    label: 'Long',        emoji: '🐌', groups: ['long'] },
  { id: 'bubbly',  label: 'Bubbly',      emoji: '🫧', groups: ['bubbly'] },
  { id: 'squeaky', label: 'Squeaky',     emoji: '🎺', groups: ['squeaky'] },
  { id: 'other',   label: 'Fun',         emoji: '🎲', groups: ['other'] },
];

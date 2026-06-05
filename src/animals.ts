// Shared animal list. v25s: each animal has emoji variants. The grid
// renders one tile per (animalId, emoji) pair, and each tile is
// assigned a UNIQUE sound from the 388-sound pool in soundPool.ts.
// Different emojis = different sounds. Same emoji = same sound.

import { SOUND_POOL } from "./audio/soundPool";

export type Animal = {
  id: string;
  name: string;
  /** Primary emoji used in the bottom-tab nav. */
  emoji: string;
  color: string;
  /**
   * Visual variants for the same animal. The grid renders one tile
   * per emoji. Different emojis get different sounds.
   */
  emojis: string[];
};

/** A single grid tile = one (animal, emoji) pair with its own sound. */
export type Tile = {
  id: string;            // "cow:0", "cow:1", ...
  animalId: string;      // "cow"
  emoji: string;         // "🐄"
  sound: string;         // "/sounds/cow.mp3"
  showName: boolean;     // First variant shows the name; rest are blank.
};

const ANIMALS_RAW: Omit<Animal, "emojis">[] = [
  { id: "cow", name: "Cow", emoji: "🐄", color: "from-pink-200 to-pink-400" },
  { id: "dog", name: "Dog", emoji: "🐕", color: "from-amber-200 to-amber-400" },
  { id: "cat", name: "Cat", emoji: "🐈", color: "from-purple-200 to-purple-400" },
  { id: "bird", name: "Bird", emoji: "🐦", color: "from-sky-200 to-sky-400" },
  { id: "horse", name: "Horse", emoji: "🐎", color: "from-orange-200 to-orange-400" },
  { id: "pig", name: "Pig", emoji: "🐖", color: "from-rose-200 to-rose-400" },
  { id: "duck", name: "Duck", emoji: "🦆", color: "from-yellow-200 to-yellow-400" },
  { id: "elephant", name: "Elephant", emoji: "🐘", color: "from-slate-300 to-slate-500" },
  { id: "monkey", name: "Monkey", emoji: "🐒", color: "from-lime-200 to-lime-400" },
  { id: "snake", name: "Snake", emoji: "🐍", color: "from-emerald-200 to-emerald-400" },
  { id: "lion", name: "Lion", emoji: "🦁", color: "from-yellow-300 to-amber-500" },
  { id: "frog", name: "Frog", emoji: "🐸", color: "from-green-300 to-green-500" },
  { id: "bull", name: "Bull", emoji: "🐂", color: "from-red-300 to-red-500" },
  { id: "rabbit", name: "Rabbit", emoji: "🐰", color: "from-pink-100 to-pink-300" },
  { id: "bear", name: "Bear", emoji: "🐻", color: "from-amber-500 to-orange-700" },
  { id: "rooster", name: "Rooster", emoji: "🐓", color: "from-red-200 to-orange-300" },
  { id: "turtle", name: "Turtle", emoji: "🐢", color: "from-emerald-300 to-emerald-500" },
  { id: "whale", name: "Whale", emoji: "🐋", color: "from-blue-300 to-blue-500" },
  { id: "goat", name: "Goat", emoji: "🐐", color: "from-stone-300 to-stone-500" },
  { id: "sheep", name: "Sheep", emoji: "🐑", color: "from-gray-200 to-gray-400" },
  { id: "bee", name: "Bee", emoji: "🐝", color: "from-yellow-300 to-yellow-500" },
  { id: "turkey", name: "Turkey", emoji: "🦃", color: "from-red-400 to-red-600" },
  { id: "owl", name: "Owl", emoji: "🦉", color: "from-indigo-300 to-indigo-500" },
  { id: "penguin", name: "Penguin", emoji: "🐧", color: "from-cyan-200 to-cyan-400" },
  { id: "seal", name: "Seal", emoji: "🦭", color: "from-slate-200 to-slate-400" },
  { id: "hippo", name: "Hippo", emoji: "🦛", color: "from-pink-300 to-purple-400" },
  { id: "rhino", name: "Rhino", emoji: "🦏", color: "from-stone-400 to-stone-600" },
  { id: "zebra", name: "Zebra", emoji: "🦓", color: "from-gray-100 to-gray-300" },
  { id: "giraffe", name: "Giraffe", emoji: "🦒", color: "from-yellow-200 to-amber-300" },
  { id: "moose", name: "Moose", emoji: "🦌", color: "from-amber-500 to-orange-600" },
  { id: "kangaroo", name: "Kangaroo", emoji: "🦘", color: "from-orange-300 to-orange-500" },
  { id: "sloth", name: "Sloth", emoji: "🦥", color: "from-lime-200 to-amber-200" },
  { id: "skunk", name: "Skunk", emoji: "🦨", color: "from-gray-300 to-gray-500" },
  { id: "raccoon", name: "Raccoon", emoji: "🦝", color: "from-stone-300 to-stone-500" },
  { id: "mammoth", name: "Mammoth", emoji: "🦣", color: "from-stone-500 to-stone-700" },
  { id: "megaLion", name: "Mega-Lion", emoji: "🦁", color: "from-amber-400 to-red-600" },
  { id: "python", name: "Python", emoji: "🐍", color: "from-emerald-400 to-emerald-600" },
];

const EMOJI_VARIANTS: Record<string, string[]> = {
  cow: ["🐄", "🐮", "🐂", "🫎"],
  dog: ["🐕", "🐶", "🦮", "🐕‍🦺"],
  cat: ["🐈", "🐈‍⬛", "🐱", "😺"],
  bird: ["🐦", "🐤", "🐔", "🦜", "🦚"],
  horse: ["🐎", "🐴", "🦄", "🫎"],
  pig: ["🐖", "🐽", "🐷", "🐗"],
  duck: ["🦆", "🦢", "🐦", "🐤"],
  elephant: ["🐘", "🦣", "🐛"],
  monkey: ["🐒", "🐵", "🦍", "🐶"],
  snake: ["🐍", "🐉", "🪱"],
  lion: ["🦁", "🐅", "🐆", "😺"],
  frog: ["🐸", "🐊", "🐢"],
  bull: ["🐂", "🐄", "🐃", "🦬"],
  rabbit: ["🐰", "🐇", "🐰"],
  bear: ["🐻", "🐨", "🐼", "🦨"],
  rooster: ["🐓", "🐔", "🦃", "🐦"],
  turtle: ["🐢", "🐢", "🐊"],
  whale: ["🐋", "🐳", "🐟", "🐬"],
  goat: ["🐐", "🐏", "🐂"],
  sheep: ["🐑", "🐏", "☁️"],
  bee: ["🐝", "🐝", "🐛"],
  turkey: ["🦃", "🐔", "🐓"],
  owl: ["🦉", "🦅", "🐦"],
  penguin: ["🐧", "🐦", "🦆"],
  seal: ["🦭", "🐻", "🐾"],
  hippo: ["🦛", "🐗", "🐷"],
  rhino: ["🦏", "🐂", "🦬"],
  zebra: ["🦓", "🐎", "🦄"],
  giraffe: ["🦒", "🦒", "🐎"],
  moose: ["🦌", "🫎", "🐂"],
  kangaroo: ["🦘", "🐰", "🐾"],
  sloth: ["🦥", "🐒", "🐻"],
  skunk: ["🦨", "🐻", "🐾"],
  raccoon: ["🦝", "🐻", "🐾"],
  mammoth: ["🦣", "🐘", "🐃"],
  megaLion: ["🦁", "🐅", "🐯", "🦊"],
  python: ["🐍", "🐉", "🪱"],
};

export const ANIMALS: Animal[] = ANIMALS_RAW.map((a) => ({
  ...a,
  emojis: EMOJI_VARIANTS[a.id] ?? [a.emoji],
}));

export const ANIMAL_BY_ID = new Map(ANIMALS.map((a) => [a.id, a]));

// === v25s: build the flat tile list with unique sounds ===
// We assign sounds from the 388-pool in order, advancing for every
// tile. With 49 animals × ~3 emoji = ~140 tiles and 388 sounds,
// each tile gets a unique sound.

export const TILES: Tile[] = (() => {
  const out: Tile[] = [];
  let poolIdx = 0;
  for (const animal of ANIMALS) {
    for (let i = 0; i < animal.emojis.length; i++) {
      out.push({
        id: `${animal.id}:${i}`,
        animalId: animal.id,
        emoji: animal.emojis[i],
        sound: SOUND_POOL[poolIdx % SOUND_POOL.length],
        showName: i === 0,
      });
      poolIdx++;
    }
  }
  return out;
})();

/** Lookup tile by id (e.g. "cow:0", "lion:2"). */
export const TILE_BY_ID = new Map(TILES.map((t) => [t.id, t]));

/** Filter chip helpers. */
export const FILTER_ANIMALS: Record<string, readonly string[]> = {
  all: ANIMALS.map((a) => a.id),
  long: ["mammoth", "megaLion", "python"],
  farm: ["cow", "pig", "duck", "rooster", "horse", "bull", "sheep", "goat", "rabbit"],
  wild: ["lion", "elephant", "monkey", "snake", "bear", "tiger", "rhino", "zebra", "giraffe", "moose", "kangaroo", "hippo", "sloth", "skunk", "raccoon", "mammoth", "megaLion", "python"],
  sea: ["whale", "seal", "penguin"],
  bugs: ["bee", "owl", "turkey", "frog", "turtle", "bird"],
};

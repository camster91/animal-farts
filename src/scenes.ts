// v25v: scene catalog. The kid's experience is one big illustrated
// scene at a time (Farm, Jungle, Ocean, City, Bedroom, Bathroom).
// Each scene has 6-10 tappable "things" — each thing has a
// satisfying sound when tapped.
//
// The 388 sounds distribute across scenes. Animal sounds (49) are
// the natural fit for animal-shaped things. Flavor farts fill gaps
// and provide variety. Sound files are mapped to scenes based on
// what animal/thing they most naturally represent.
//
// A scene is a full-screen world. The kid taps things, hears
// sounds, swipes left/right to change scenes. No menus, no
// library, no settings.

export interface SceneThing {
  id: string;        // e.g. "farm:cow"
  emoji: string;     // fallback visual
  name: string;      // "Cow", "Tractor", etc.
  /** Position in the scene, in % coordinates of the scene container.
   *  x: 0=left edge, 100=right edge. y: 0=top, 100=bottom. */
  x: number;
  y: number;
  /** Tap target size in % of scene width. Default 18. */
  size?: number;
  /** Sounds to pick from when tapped. First one plays first; rest
   *  cycle via random pick (or sequential, your call at runtime). */
  sounds: string[];
}

export interface Scene {
  id: string;
  name: string;
  emoji: string;        // scene icon (for the page indicator)
  /** Background gradient or color name. */
  bg: string;           // e.g. "from-green-300 to-green-500"
  /** Optional background scene description (for future illustrations). */
  description: string;
  things: SceneThing[];
}

// === Scene data ===
// Each thing's sounds array: ideally a per-animal sound (cow.mp3)
// with fallbacks to flavor farts. The runtime picks randomly.
//
// Backgrounds are Tailwind gradient class names — the scene is a
// full-screen div with that gradient. Things are absolutely positioned
// emoji over the gradient.

export const SCENES: Scene[] = [
  {
    id: "farm",
    name: "Farm",
    emoji: "🌾",
    bg: "from-lime-300 via-green-400 to-emerald-500",
    description: "A sunny green farm with happy animals.",
    things: [
      { id: "farm:cow",      emoji: "🐄", name: "Cow",      x: 18, y: 58, size: 18, sounds: ["/sounds/cow.mp3", "/sounds/extra/cow2.mp3", "/sounds/v1/cow.mp3"] },
      { id: "farm:pig",      emoji: "🐖", name: "Pig",      x: 38, y: 64, size: 16, sounds: ["/sounds/pig.mp3", "/sounds/extra/pig2.mp3", "/sounds/v1/pig.mp3"] },
      { id: "farm:horse",    emoji: "🐎", name: "Horse",    x: 60, y: 56, size: 20, sounds: ["/sounds/horse.mp3", "/sounds/v1/horse.mp3", "/sounds/extra/horse2.mp3"] },
      { id: "farm:rooster",  emoji: "🐓", name: "Rooster",  x: 80, y: 32, size: 14, sounds: ["/sounds/rooster.mp3", "/sounds/v1/rooster.mp3"] },
      { id: "farm:sheep",    emoji: "🐑", name: "Sheep",    x: 78, y: 70, size: 14, sounds: ["/sounds/extra/sheep.mp3", "/sounds/extra/sheep_v2.mp3"] },
      { id: "farm:goat",     emoji: "🐐", name: "Goat",     x: 12, y: 78, size: 13, sounds: ["/sounds/extra/goat.mp3", "/sounds/extra/goat_v2.mp3"] },
      { id: "farm:duck",     emoji: "🦆", name: "Duck",     x: 28, y: 80, size: 12, sounds: ["/sounds/duck.mp3", "/sounds/v1/duck.mp3"] },
      { id: "farm:tractor",  emoji: "🚜", name: "Tractor",  x: 55, y: 84, size: 18, sounds: ["/sounds/extra/bull.mp3", "/sounds/extra/elephant_long.mp3"] },
    ],
  },
  {
    id: "jungle",
    name: "Jungle",
    emoji: "🌴",
    bg: "from-emerald-400 via-green-500 to-lime-600",
    description: "A wild jungle with exotic animals.",
    things: [
      { id: "jungle:elephant", emoji: "🐘", name: "Elephant", x: 22, y: 62, size: 22, sounds: ["/sounds/elephant.mp3", "/sounds/extra/elephant2.mp3", "/sounds/extra/elephant_long.mp3", "/sounds/v1/elephant.mp3"] },
      { id: "jungle:lion",     emoji: "🦁", name: "Lion",     x: 50, y: 60, size: 18, sounds: ["/sounds/lion.mp3", "/sounds/extra/lion2.mp3", "/sounds/extra/lion_long.mp3", "/sounds/v1/lion.mp3"] },
      { id: "jungle:monkey",   emoji: "🐒", name: "Monkey",   x: 38, y: 38, size: 14, sounds: ["/sounds/monkey.mp3", "/sounds/extra/monkey_v2.mp3", "/sounds/v1/monkey.mp3"] },
      { id: "jungle:snake",    emoji: "🐍", name: "Snake",    x: 72, y: 70, size: 14, sounds: ["/sounds/snake.mp3", "/sounds/extra/snake2.mp3", "/sounds/extra/snake_long.mp3", "/sounds/v1/snake.mp3"] },
      { id: "jungle:bear",     emoji: "🐻", name: "Bear",     x: 80, y: 50, size: 18, sounds: ["/sounds/bear.mp3", "/sounds/extra/bear2.mp3"] },
      { id: "jungle:bird",     emoji: "🦜", name: "Parrot",   x: 60, y: 26, size: 12, sounds: ["/sounds/bird.mp3", "/sounds/v1/bird.mp3"] },
      { id: "jungle:frog",     emoji: "🐸", name: "Frog",     x: 14, y: 86, size: 12, sounds: ["/sounds/frog.mp3", "/sounds/v1/frog.mp3"] },
      { id: "jungle:hippo",    emoji: "🦛", name: "Hippo",    x: 50, y: 86, size: 18, sounds: ["/sounds/extra/hippo.mp3"] },
    ],
  },
  {
    id: "ocean",
    name: "Ocean",
    emoji: "🌊",
    bg: "from-sky-300 via-blue-400 to-cyan-600",
    description: "A bright blue ocean with sea creatures.",
    things: [
      { id: "ocean:whale",   emoji: "🐋", name: "Whale",   x: 28, y: 50, size: 24, sounds: ["/sounds/whale.mp3", "/sounds/extra/elephant_long.mp3"] },
      { id: "ocean:dolphin", emoji: "🐬", name: "Dolphin", x: 55, y: 38, size: 14, sounds: ["/sounds/extra/seal.mp3", "/sounds/bird.mp3"] },
      { id: "ocean:seal",    emoji: "🦭", name: "Seal",    x: 72, y: 58, size: 16, sounds: ["/sounds/extra/seal.mp3"] },
      { id: "ocean:fish",    emoji: "🐟", name: "Fish",    x: 42, y: 64, size: 12, sounds: ["/sounds/bird.mp3", "/sounds/duck.mp3"] },
      { id: "ocean:octopus", emoji: "🐙", name: "Octopus", x: 14, y: 72, size: 16, sounds: ["/sounds/extra/moose.mp3", "/sounds/extra/sloth.mp3"] },
      { id: "ocean:shark",   emoji: "🦈", name: "Shark",   x: 78, y: 76, size: 18, sounds: ["/sounds/extra/shark.mp3" ] },
      { id: "ocean:crab",    emoji: "🦀", name: "Crab",    x: 30, y: 84, size: 12, sounds: ["/sounds/extra/skunk.mp3", "/sounds/extra/raccoon.mp3"] },
    ],
  },
  {
    id: "city",
    name: "City",
    emoji: "🏙️",
    bg: "from-slate-400 via-gray-500 to-zinc-600",
    description: "A busy city with cars, buses, and trains.",
    things: [
      { id: "city:car",      emoji: "🚗", name: "Car",      x: 22, y: 70, size: 18, sounds: ["/sounds/extra/horse2.mp3", "/sounds/bull.mp3"] },
      { id: "city:bus",      emoji: "🚌", name: "Bus",      x: 40, y: 78, size: 22, sounds: ["/sounds/extra/bull2.mp3", "/sounds/extra/elephant.mp3"] },
      { id: "city:truck",    emoji: "🚚", name: "Truck",    x: 60, y: 80, size: 20, sounds: ["/sounds/extra/horse.mp3"] },
      { id: "city:train",    emoji: "🚂", name: "Train",    x: 78, y: 70, size: 20, sounds: ["/sounds/extra/elephant_long.mp3", "/sounds/extra/lion_long.mp3"] },
      { id: "city:police",   emoji: "🚓", name: "Police",   x: 30, y: 52, size: 16, sounds: ["/sounds/extra/dog_v2.mp3", "/sounds/extra/dog_v3.mp3", "/sounds/dog.mp3"] },
      { id: "city:fire",     emoji: "🚒", name: "Fire",     x: 52, y: 48, size: 16, sounds: ["/sounds/extra/bear.mp3", "/sounds/extra/bear2.mp3"] },
      { id: "city:bike",     emoji: "🚲", name: "Bike",     x: 74, y: 50, size: 14, sounds: ["/sounds/extra/cow2.mp3", "/sounds/v1/dog.mp3"] },
    ],
  },
  {
    id: "bedroom",
    name: "Bedroom",
    emoji: "🛏️",
    bg: "from-indigo-300 via-purple-400 to-pink-400",
    description: "A cozy bedroom at night with sleeping things.",
    things: [
      { id: "bed:bed",      emoji: "🛏️", name: "Bed",      x: 25, y: 56, size: 28, sounds: ["/sounds/extra/bear.mp3", "/sounds/extra/elephant_long.mp3"] },
      { id: "bed:pillow",   emoji: "💤", name: "Pillow",   x: 16, y: 64, size: 14, sounds: ["/sounds/extra/sheep.mp3", "/sounds/extra/bear2.mp3"] },
      { id: "bed:clock",    emoji: "🕰️", name: "Clock",    x: 75, y: 30, size: 14, sounds: ["/sounds/extra/moose.mp3"] },
      { id: "bed:lamp",     emoji: "💡", name: "Lamp",     x: 18, y: 32, size: 14, sounds: ["/sounds/extra/cat2.mp3", "/sounds/v1/cat.mp3"] },
      { id: "bed:window",   emoji: "🌙", name: "Window",   x: 80, y: 50, size: 14, sounds: ["/sounds/extra/snake_long.mp3", "/sounds/extra/lion_long.mp3"] },
      { id: "bed:door",     emoji: "🚪", name: "Door",     x: 50, y: 80, size: 14, sounds: ["/sounds/extra/dog.mp3", "/sounds/extra/dog_v2.mp3", "/sounds/dog.mp3"] },
      { id: "bed:toybox",   emoji: "🧸", name: "Toy Box",  x: 76, y: 80, size: 14, sounds: ["/sounds/extra/raccoon.mp3", "/sounds/extra/skunk.mp3"] },
    ],
  },
  {
    id: "bathroom",
    name: "Bathroom",
    emoji: "🛁",
    bg: "from-cyan-300 via-sky-400 to-blue-500",
    description: "A splashy bathroom with funny noises.",
    things: [
      { id: "bath:toilet",    emoji: "🚽", name: "Toilet",    x: 25, y: 60, size: 22, sounds: ["/sounds/farts/001-toilet-flush-clear-mike-koenig.mp3", "/sounds/farts/003-toilet-flushing-kevangc-917782919.mp3"] },
      { id: "bath:shower",    emoji: "🚿", name: "Shower",    x: 55, y: 32, size: 18, sounds: ["/sounds/farts/011-reverb-underwater.mp3"] },
      { id: "bath:bathtub",   emoji: "🛁", name: "Bathtub",   x: 70, y: 60, size: 22, sounds: ["/sounds/farts/005-farting-in-the-bathtub-and-biting-the-bubbles.mp3"] },
      { id: "bath:sink",      emoji: "🚰", name: "Sink",      x: 22, y: 36, size: 16, sounds: ["/sounds/farts/025-wet-squelch.mp3", "/sounds/farts/027-wet-gush.mp3"] },
      { id: "bath:toothbrush",emoji: "🪥", name: "Brush",     x: 50, y: 76, size: 14, sounds: ["/sounds/farts/008-fart-squeeze-yer-knees-mike-koenig.mp3"] },
      { id: "bath:soap",      emoji: "🧼", name: "Soap",      x: 78, y: 78, size: 14, sounds: ["/sounds/farts/046-bubbly-popcorn.mp3", "/sounds/farts/069-bubbly-machine-gun.mp3"] },
    ],
  },
];

export const SCENE_BY_ID = new Map(SCENES.map((s) => [s.id, s]));

export type Thing = {
  id: string;
  emoji: string;
  name: string;
  x: number;        // 0–100, % from left
  y: number;        // 0–100, % from top
  size: number;     // 9–18, % of viewport width
  sounds: string[]; // 2–4 paths to /sounds/* (relative)
};

export type Scene = {
  id: string;
  name: string;
  bg: string;        // /scenes/<id>.jpg
  things: Thing[];
};

export const SCENES: Scene[] = [
  {
    id: 'home',
    name: 'Home',
    bg: '/scenes/home.jpg',
    things: [],
  },
  {
    id: 'farm',
    name: 'Farm',
    bg: '/scenes/farm.jpg',
    things: [
      // Ground animals on grass (y 60–84), well spaced left-to-right
      { id: 'cow',     emoji: '🐄', name: 'Cow',     x: 12, y: 66, size: 14, sounds: ['/sounds/cow.mp3', '/sounds/extra/cow2.mp3', '/sounds/extra/cow_v3.mp3'] },
      { id: 'horse',   emoji: '🐎', name: 'Horse',   x: 30, y: 63, size: 15, sounds: ['/sounds/horse.mp3', '/sounds/v1/horse.mp3', '/sounds/extra/horse2.mp3'] },
      { id: 'pig',     emoji: '🐖', name: 'Pig',     x: 50, y: 65, size: 12, sounds: ['/sounds/pig.mp3', '/sounds/extra/pig2.mp3'] },
      { id: 'goat',    emoji: '🐐', name: 'Goat',    x: 72, y: 67, size: 11, sounds: ['/sounds/extra/goat.mp3'] },
      { id: 'sheep',   emoji: '🐑', name: 'Sheep',   x: 88, y: 68, size: 11, sounds: ['/sounds/extra/sheep.mp3', '/sounds/extra/sheep_v2.mp3'] },
      // Dog moved lower-right to separate from sheep
      { id: 'dog',     emoji: '🐕', name: 'Dog',     x: 55, y: 78, size: 10, sounds: ['/sounds/dog.mp3', '/sounds/extra/dog_v2.mp3'] },
      // Lower ground items (duck, tractor, hay, owl)
      { id: 'duck',    emoji: '🦆', name: 'Duck',    x: 25, y: 84, size:  9, sounds: ['/sounds/duck.mp3', '/sounds/v1/duck.mp3'] },
      { id: 'tractor', emoji: '🚜', name: 'Tractor', x: 78, y: 82, size: 12, sounds: ['/sounds/extra/bull.mp3'] },
      { id: 'hay',     emoji: '🌾', name: 'Hay',     x: 42, y: 84, size:  9, sounds: ['/sounds/extra/monkey_v2.mp3'] },
      // Owl in the tree above the barn (tree is upper-left, near barn)
      { id: 'owl',     emoji: '🦉', name: 'Owl',     x: 17, y: 38, size:  9, sounds: ['/sounds/extra/owl.mp3'] },
      // Rooster on the right-side tree (not barn tree) — perched mid-branch
      { id: 'rooster', emoji: '🐓', name: 'Rooster', x: 88, y: 46, size: 10, sounds: ['/sounds/rooster.mp3', '/sounds/v1/rooster.mp3'] },
      // Barn on the actual barn illustration (center-left, x~15-30, y~40-60)
      { id: 'barn',    emoji: '🏚️', name: 'Barn',    x: 22, y: 50, size: 14, sounds: ['/sounds/extra/cat.mp3'] },
    ],
  },
  {
    id: 'jungle',
    name: 'Jungle',
    bg: '/scenes/jungle.jpg',
    // 10 things (reduced from 12) — dense canopy leaves little room for more
    things: [
      // Upper canopy — monkey, parrot, toucan (all in upper y 15-28 band)
      { id: 'monkey',  emoji: '🐒', name: 'Monkey',  x: 12, y: 18, size: 10, sounds: ['/sounds/monkey.mp3', '/sounds/extra/monkey_v2.mp3'] },
      { id: 'parrot',  emoji: '🦚', name: 'Parrot',  x: 30, y: 16, size:  9, sounds: ['/sounds/extra/parrot.mp3', '/sounds/bird.mp3'] },
      { id: 'toucan',  emoji: '🦜', name: 'Toucan',  x: 82, y: 22, size: 11, sounds: ['/sounds/extra/parrot.mp3', '/sounds/bird.mp3'] },
      // Giraffe in mid-upper area, well separated from monkey (right side of scene)
      { id: 'giraffe', emoji: '🦒', name: 'Giraffe', x: 68, y: 24, size: 14, sounds: ['/sounds/extra/giraffe.mp3'] },
      // Mid-level things — tiger on right vine, gorilla in center clearing
      { id: 'gorilla', emoji: '🦍', name: 'Gorilla', x: 44, y: 42, size: 13, sounds: ['/sounds/extra/bull.mp3', '/sounds/monkey.mp3'] },
      { id: 'tiger',   emoji: '🐯', name: 'Tiger',   x: 78, y: 42, size: 12, sounds: ['/sounds/lion.mp3'] },
      // Ground level — elephant left, lion center, snake left vine, hippo right, zebra right-center, frog bottom-center
      { id: 'elephant',emoji: '🐘', name: 'Elephant',x: 12, y: 66, size: 16, sounds: ['/sounds/elephant.mp3', '/sounds/elephant_long.mp3'] },
      { id: 'lion',    emoji: '🦁', name: 'Lion',    x: 42, y: 72, size: 13, sounds: ['/sounds/lion.mp3', '/sounds/lion_long.mp3'] },
      { id: 'snake',   emoji: '🐍', name: 'Snake',   x: 22, y: 58, size:  9, sounds: ['/sounds/snake.mp3', '/sounds/snake_long.mp3'] },
      { id: 'hippo',   emoji: '🦛', name: 'Hippo',   x: 74, y: 74, size: 13, sounds: ['/sounds/extra/hippo.mp3'] },
    ],
  },
  {
    id: 'ocean',
    name: 'Ocean',
    bg: '/scenes/ocean.jpg',
    things: [
      // Surface creatures — dolphin, whale, shark (y 20-40, sky/horizon area)
      { id: 'whale',   emoji: '🐳', name: 'Whale',     x: 52, y: 24, size: 16, sounds: ['/sounds/whale.mp3'] },
      { id: 'dolphin', emoji: '🐬', name: 'Dolphin',   x: 22, y: 36, size: 13, sounds: ['/sounds/bird.mp3', '/sounds/v1/bird.mp3'] },
      { id: 'shark',   emoji: '🦈', name: 'Shark',     x: 78, y: 34, size: 13, sounds: ['/sounds/lion.mp3', '/sounds/extra/lion_long.mp3'] },
      // Mid-water — fish and octopus
      { id: 'fish',    emoji: '🐠', name: 'Tropical',  x: 62, y: 52, size: 10, sounds: ['/sounds/bird.mp3', '/sounds/v1/bird.mp3'] },
      { id: 'octopus', emoji: '🐙', name: 'Octopus',   x: 35, y: 58, size: 12, sounds: ['/sounds/monkey.mp3', '/sounds/v1/monkey.mp3'] },
      { id: 'squid',   emoji: '🦑', name: 'Squid',     x: 48, y: 64, size: 10, sounds: ['/sounds/monkey.mp3', '/sounds/v1/monkey.mp3'] },
      { id: 'puffer',  emoji: '🐡', name: 'Puffer',    x: 18, y: 56, size:  9, sounds: ['/sounds/frog.mp3', '/sounds/v1/frog.mp3'] },
      // Shore / seabed — turtle, crab, seal, coral, seashell (y 75-90)
      { id: 'turtle',  emoji: '🐢', name: 'Turtle',    x: 68, y: 80, size: 12, sounds: ['/sounds/turtle.mp3'] },
      { id: 'crab',    emoji: '🦀', name: 'Crab',      x: 32, y: 86, size:  9, sounds: ['/sounds/bull.mp3'] },
      { id: 'seal',    emoji: '🦭', name: 'Seal',      x: 85, y: 78, size: 11, sounds: ['/sounds/dog.mp3', '/sounds/v1/dog.mp3'] },
      { id: 'coral',   emoji: '🪸', name: 'Coral',     x: 12, y: 82, size: 10, sounds: ['/sounds/bird.mp3'] },
      { id: 'seashell',emoji: '🐚', name: 'Seashell',  x: 56, y: 88, size:  8, sounds: ['/sounds/bird.mp3'] },
    ],
  },
  {
    id: 'city',
    name: 'City',
    bg: '/scenes/city.jpg',
    things: [
      // Road vehicles — all at y 72 (on the road/sidewalk)
      { id: 'taxi',     emoji: '🚕', name: 'Taxi',      x: 24, y: 72, size: 12, sounds: ['/sounds/bear.mp3'] },
      { id: 'train',    emoji: '🚂', name: 'Train',     x: 62, y: 72, size: 13, sounds: ['/sounds/elephant.mp3'] },
      { id: 'bus',      emoji: '🚌', name: 'Bus',        x: 80, y: 72, size: 11, sounds: ['/sounds/elephant.mp3'] },
      { id: 'ambulance',emoji: '🚑', name: 'Ambulance', x: 10, y: 72, size: 11, sounds: ['/sounds/bear.mp3'] },
      { id: 'firetruck',emoji: '🚒', name: 'Fire',      x: 46, y: 72, size: 12, sounds: ['/sounds/bull.mp3'] },
      // Dog on sidewalk
      { id: 'dog2',     emoji: '🐕', name: 'Service',   x: 56, y: 80, size: 10, sounds: ['/sounds/dog.mp3', '/sounds/v1/dog.mp3'] },
      // Cat on lower sidewalk (left side)
      { id: 'cat',      emoji: '🐈', name: 'Cat',       x: 22, y: 82, size: 10, sounds: ['/sounds/cat.mp3', '/sounds/v1/cat.mp3'] },
      // Buildings and sky items (y 30-58)
      { id: 'building', emoji: '🏢', name: 'Building',  x: 72, y: 40, size: 15, sounds: ['/sounds/bird.mp3'] },
      { id: 'eiffel',   emoji: '🗼', name: 'Tower',     x: 36, y: 30, size: 14, sounds: ['/sounds/bird.mp3'] },
      { id: 'bell',     emoji: '🛎️', name: 'Bell',      x: 52, y: 54, size:  8, sounds: ['/sounds/bird.mp3'] },
      { id: 'store',    emoji: '🏪', name: 'Store',     x: 14, y: 54, size: 11, sounds: ['/sounds/bird.mp3'] },
      { id: 'light',    emoji: '🚦', name: 'Light',     x: 88, y: 58, size:  9, sounds: ['/sounds/bear.mp3'] },
    ],
  },
  {
    id: 'bedroom',
    name: 'Bedroom',
    bg: '/scenes/bedroom.jpg',
    things: [
      // Window centered on back wall (upper area)
      { id: 'window',   emoji: '🪟', name: 'Window',    x: 50, y: 26, size: 14, sounds: ['/sounds/extra/owl.mp3'] },
      // Moon and stars in upper sky (through window)
      { id: 'moon',     emoji: '🌙', name: 'Moon',      x: 76, y: 18, size: 12, sounds: ['/sounds/extra/owl.mp3'] },
      { id: 'star',     emoji: '⭐', name: 'Star',      x: 22, y: 18, size: 10, sounds: ['/sounds/extra/owl.mp3'] },
      // Wall-level items — TV on upper wall, mirror left, door right, teddy upper-right
      { id: 'tv',       emoji: '📺', name: 'TV',        x: 68, y: 40, size: 12, sounds: ['/sounds/bird.mp3'] },
      { id: 'mirror',   emoji: '🪞', name: 'Mirror',    x: 18, y: 40, size: 11, sounds: ['/sounds/bird.mp3'] },
      { id: 'stuffed',  emoji: '🧸', name: 'Plush',     x: 82, y: 52, size: 10, sounds: ['/sounds/bear.mp3'] },
      // Door on right wall (mid-height)
      { id: 'door',     emoji: '🚪', name: 'Door',      x: 88, y: 64, size: 11, sounds: ['/sounds/bird.mp3'] },
      // Book on upper-left shelf area
      { id: 'book',     emoji: '📖', name: 'Book',      x: 32, y: 54, size:  9, sounds: ['/sounds/bird.mp3'] },
      // Bed on the actual bed illustration (right side, lower)
      { id: 'bed',      emoji: '🛏️', name: 'Bed',       x: 62, y: 78, size: 14, sounds: ['/sounds/elephant.mp3', '/sounds/extra/elephant_long.mp3'] },
      // Floor items — teddy near bed, duck near nightstand, yarn on floor
      { id: 'teddy',    emoji: '🧸', name: 'Teddy',     x: 48, y: 80, size: 10, sounds: ['/sounds/bear.mp3'] },
      { id: 'rubberduck',emoji: '🦆', name: 'Duck',     x: 38, y: 84, size: 10, sounds: ['/sounds/duck.mp3', '/sounds/v1/duck.mp3'] },
      { id: 'yarn',     emoji: '🧶', name: 'Yarn',      x: 16, y: 80, size:  9, sounds: ['/sounds/cat.mp3', '/sounds/v1/cat.mp3'] },
    ],
  },
  {
    id: 'bathroom',
    name: 'Bathroom',
    bg: '/scenes/bathroom.jpg',
    // 10 things (reduced from 12) — illustration has no toilet, only sink, tub, floor
    things: [
      // Sink area (left side, wall-mounted under flower mirror)
      { id: 'sink',     emoji: '🚰', name: 'Sink',      x: 18, y: 66, size: 11, sounds: ['/sounds/frog.mp3', '/sounds/v1/frog.mp3'] },
      // Mirror above sink (wall-mounted, left side)
      { id: 'mirror2',  emoji: '🪞', name: 'Mirror',    x: 18, y: 32, size: 13, sounds: ['/sounds/bird.mp3'] },
      // Bathtub (right side, floor-level)
      { id: 'bathtub',  emoji: '🛁', name: 'Bathtub',   x: 68, y: 72, size: 14, sounds: ['/sounds/elephant.mp3', '/sounds/extra/elephant_long.mp3'] },
      // Rubber ducks in scene — one on sink edge, one on floor near tub
      { id: 'rubberduck2',emoji: '🦆', name: 'Duck',     x: 28, y: 74, size:  9, sounds: ['/sounds/duck.mp3', '/sounds/v1/duck.mp3'] },
      { id: 'duck2',    emoji: '🦆', name: 'Duck2',     x: 82, y: 84, size:  9, sounds: ['/sounds/duck.mp3', '/sounds/v1/duck.mp3'] },
      // Floor items — towel, stool, plant (y 78-84)
      { id: 'towel',    emoji: '🧺', name: 'Towel',     x: 46, y: 80, size: 10, sounds: ['/sounds/cat.mp3', '/sounds/v1/cat.mp3'] },
      { id: 'soap',     emoji: '🧴', name: 'Soap',      x: 84, y: 56, size:  9, sounds: ['/sounds/bird.mp3'] },
      { id: 'plant',    emoji: '🪴', name: 'Plant',     x: 88, y: 74, size: 10, sounds: ['/sounds/elephant.mp3', '/sounds/extra/elephant_long.mp3'] },
      // Wall items — shower head (upper right area), toothbrush (mid-left)
      { id: 'shower',   emoji: '🚿', name: 'Shower',    x: 84, y: 30, size: 11, sounds: ['/sounds/frog.mp3', '/sounds/v1/frog.mp3'] },
      { id: 'toothbrush',emoji: '🪥', name: 'Brush',    x: 36, y: 44, size:  8, sounds: ['/sounds/bird.mp3'] },
    ],
  },
];

export function getThing(sceneId: string, thingId: string): Thing | null {
  const s = SCENES.find(x => x.id === sceneId);
  return s?.things.find(t => t.id === thingId) ?? null;
}
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
      { id: 'cow',     emoji: '🐄', name: 'Cow',     x: 18, y: 62, size: 14, sounds: ['/sounds/cow.mp3', '/sounds/extra/cow2.mp3', '/sounds/extra/cow_v3.mp3'] },
      { id: 'pig',     emoji: '🐖', name: 'Pig',     x: 33, y: 66, size: 12, sounds: ['/sounds/pig.mp3', '/sounds/extra/pig2.mp3'] },
      { id: 'horse',   emoji: '🐎', name: 'Horse',   x: 50, y: 60, size: 14, sounds: ['/sounds/horse.mp3', '/sounds/v1/horse.mp3', '/sounds/extra/horse2.mp3'] },
      { id: 'sheep',   emoji: '🐑', name: 'Sheep',   x: 65, y: 67, size: 11, sounds: ['/sounds/extra/sheep.mp3', '/sounds/extra/sheep_v2.mp3'] },
      { id: 'goat',    emoji: '🐐', name: 'Goat',    x: 82, y: 64, size: 11, sounds: ['/sounds/extra/goat.mp3'] },
      { id: 'duck',    emoji: '🦆', name: 'Duck',    x: 14, y: 78, size:  9, sounds: ['/sounds/duck.mp3', '/sounds/v1/duck.mp3'] },
      { id: 'rooster', emoji: '🐓', name: 'Rooster', x: 11, y: 30, size: 10, sounds: ['/sounds/rooster.mp3', '/sounds/v1/rooster.mp3'] },
      { id: 'tractor', emoji: '🚜', name: 'Tractor', x: 88, y: 78, size: 12, sounds: ['/sounds/extra/bull.mp3'] },
      { id: 'barn',    emoji: '🏚️', name: 'Barn',    x: 22, y: 50, size: 14, sounds: ['/sounds/extra/cat.mp3'] },
      { id: 'hay',     emoji: '🌾', name: 'Hay',     x: 47, y: 84, size:  9, sounds: ['/sounds/extra/monkey_v2.mp3'] },
      { id: 'dog',     emoji: '🐕', name: 'Dog',     x: 60, y: 70, size: 10, sounds: ['/sounds/dog.mp3', '/sounds/extra/dog_v2.mp3'] },
      { id: 'owl',     emoji: '🦉', name: 'Owl',     x: 82, y: 32, size:  9, sounds: ['/sounds/extra/owl.mp3'] },
    ],
  },
  {
    id: 'jungle',
    name: 'Jungle',
    bg: '/scenes/jungle.jpg',
    things: [
      // Toucan — perched on right branch (x:86-98%, y:30-52% per scene analysis)
      { id: 'toucan',  emoji: '🦜', name: 'Toucan',  x: 88, y: 36, size: 12, sounds: ['/sounds/extra/parrot.mp3', '/sounds/bird.mp3'] },
      // Monkey — upper-left canopy (x:5-18%, y:8-25%)
      { id: 'monkey',  emoji: '🐒', name: 'Monkey',  x: 12, y: 16, size: 11, sounds: ['/sounds/monkey.mp3', '/sounds/extra/monkey_v2.mp3'] },
      // Elephant — lower-left (front of scene)
      { id: 'elephant',emoji: '🐘', name: 'Elephant',x:  8, y: 68, size: 16, sounds: ['/sounds/elephant.mp3', '/sounds/elephant_long.mp3'] },
      // Giraffe — left-center (tall, peeking from behind foliage)
      { id: 'giraffe', emoji: '🦒', name: 'Giraffe', x: 25, y: 28, size: 15, sounds: ['/sounds/extra/giraffe.mp3'] },
      // Lion — lower-center (on the forest floor)
      { id: 'lion',    emoji: '🦁', name: 'Lion',    x: 45, y: 74, size: 13, sounds: ['/sounds/lion.mp3', '/sounds/lion_long.mp3'] },
      // Snake — winding up left vine area (x:2-20%, y:55-75%)
      { id: 'snake',   emoji: '🐍', name: 'Snake',   x: 14, y: 58, size:  9, sounds: ['/sounds/snake.mp3', '/sounds/snake_long.mp3'] },
      // Frog — bottom-center (in the dense foliage)
      { id: 'frog',    emoji: '🐸', name: 'Frog',    x: 48, y: 86, size:  9, sounds: ['/sounds/frog.mp3'] },
      // Hippo — lower-right (in the dense foliage)
      { id: 'hippo',   emoji: '🦛', name: 'Hippo',   x: 72, y: 76, size: 14, sounds: ['/sounds/extra/hippo.mp3'] },
      // Zebra — lower-right center (grazing)
      { id: 'zebra',   emoji: '🦓', name: 'Zebra',   x: 62, y: 72, size: 12, sounds: ['/sounds/extra/zebra.mp3'] },
      // Tiger — right side middle (hidden in foliage edge)
      { id: 'tiger',   emoji: '🐯', name: 'Tiger',   x: 78, y: 55, size: 13, sounds: ['/sounds/lion.mp3'] },
      // Gorilla — center (in the clearing)
      { id: 'gorilla', emoji: '🦍', name: 'Gorilla', x: 42, y: 52, size: 14, sounds: ['/sounds/extra/bull.mp3', '/sounds/monkey.mp3'] },
      // Parrot — right upper (near the toucan)
      { id: 'parrot',  emoji: '🦚', name: 'Parrot',  x: 92, y: 24, size: 10, sounds: ['/sounds/extra/parrot.mp3', '/sounds/bird.mp3'] },
    ],
  },
  {
    id: 'ocean',
    name: 'Ocean',
    bg: '/scenes/ocean.jpg',
    things: [
      { id: 'octopus',  emoji: '🐙', name: 'Octopus',   x: 78, y: 78, size: 13, sounds: ['/sounds/monkey.mp3', '/sounds/v1/monkey.mp3'] },
      { id: 'turtle',  emoji: '🐢', name: 'Turtle',    x: 28, y: 82, size: 12, sounds: ['/sounds/turtle.mp3'] },
      { id: 'dolphin', emoji: '🐬', name: 'Dolphin',   x: 20, y: 38, size: 14, sounds: ['/sounds/bird.mp3', '/sounds/v1/bird.mp3'] },
      { id: 'fish',    emoji: '🐠', name: 'Tropical',  x: 55, y: 55, size:  9, sounds: ['/sounds/bird.mp3', '/sounds/v1/bird.mp3'] },
      { id: 'crab',    emoji: '🦀', name: 'Crab',      x: 82, y: 82, size:  9, sounds: ['/sounds/bull.mp3'] },
      { id: 'whale',   emoji: '🐳', name: 'Whale',     x: 48, y: 22, size: 16, sounds: ['/sounds/whale.mp3'] },
      { id: 'shark',   emoji: '🦈', name: 'Shark',     x: 72, y: 38, size: 13, sounds: ['/sounds/lion.mp3', '/sounds/extra/lion_long.mp3'] },
      { id: 'seashell',emoji: '🐚', name: 'Seashell',  x: 14, y: 88, size:  8, sounds: ['/sounds/bird.mp3'] },
      { id: 'squid',   emoji: '🦑', name: 'Squid',     x: 42, y: 68, size: 11, sounds: ['/sounds/monkey.mp3', '/sounds/v1/monkey.mp3'] },
      { id: 'puffer',  emoji: '🐡', name: 'Puffer', x: 88, y: 62, size:  9, sounds: ['/sounds/frog.mp3', '/sounds/v1/frog.mp3'] },
      { id: 'coral',   emoji: '🪸', name: 'Coral',     x: 10, y: 78, size: 10, sounds: ['/sounds/bird.mp3'] },
      { id: 'seal',    emoji: '🦭', name: 'Seal',      x: 60, y: 76, size: 11, sounds: ['/sounds/dog.mp3', '/sounds/v1/dog.mp3'] },
    ],
  },
  {
    id: 'city',
    name: 'City',
    bg: '/scenes/city.jpg',
    things: [
      { id: 'taxi',     emoji: '🚕', name: 'Taxi',      x: 20, y: 72, size: 12, sounds: ['/sounds/bear.mp3'] },
      { id: 'train',    emoji: '🚂', name: 'Train',     x: 48, y: 74, size: 13, sounds: ['/sounds/elephant.mp3'] },
      { id: 'building', emoji: '🏢', name: 'Building',  x: 68, y: 42, size: 16, sounds: ['/sounds/bird.mp3'] },
      { id: 'dog2',     emoji: '🐕', name: 'Service', x: 35, y: 72, size: 10, sounds: ['/sounds/dog.mp3', '/sounds/v1/dog.mp3'] },
      { id: 'firetruck',emoji: '🚒', name: 'Fire', x: 82, y: 72, size: 12, sounds: ['/sounds/bull.mp3'] },
      { id: 'ambulance',emoji: '🚑', name: 'Ambulance', x: 10, y: 72, size: 11, sounds: ['/sounds/bear.mp3'] },
      { id: 'bell',     emoji: '🛎️', name: 'Bell',      x: 55, y: 58, size:  8, sounds: ['/sounds/bird.mp3'] },
      { id: 'eiffel',   emoji: '🗼', name: 'Tower',     x: 30, y: 32, size: 15, sounds: ['/sounds/bird.mp3'] },
      { id: 'bus',      emoji: '🚌', name: 'Bus',  x: 78, y: 58, size:  9, sounds: ['/sounds/elephant.mp3'] },
      { id: 'store',    emoji: '🏪', name: 'Store',     x: 14, y: 58, size: 11, sounds: ['/sounds/bird.mp3'] },
      { id: 'light',    emoji: '🚦', name: 'Light',     x: 88, y: 62, size:  9, sounds: ['/sounds/bear.mp3'] },
      { id: 'cat',      emoji: '🐈', name: 'Cat',       x: 44, y: 82, size: 10, sounds: ['/sounds/cat.mp3', '/sounds/v1/cat.mp3'] },
    ],
  },
  {
    id: 'bedroom',
    name: 'Bedroom',
    bg: '/scenes/bedroom.jpg',
    things: [
      { id: 'teddy',    emoji: '🧸', name: 'Teddy',     x: 72, y: 68, size: 12, sounds: ['/sounds/bear.mp3'] },
      { id: 'book',     emoji: '📖', name: 'Book',      x: 28, y: 62, size:  9, sounds: ['/sounds/bird.mp3'] },
      { id: 'window',   emoji: '🪟', name: 'Window',    x: 50, y: 28, size: 14, sounds: ['/sounds/extra/owl.mp3'] },
      { id: 'moon',     emoji: '🌙', name: 'Moon',      x: 80, y: 22, size: 13, sounds: ['/sounds/extra/owl.mp3'] },
      { id: 'star',     emoji: '⭐', name: 'Star',      x: 15, y: 22, size: 10, sounds: ['/sounds/extra/owl.mp3'] },
      { id: 'rubberduck',emoji: '🦆', name: 'Duck',     x: 58, y: 78, size: 10, sounds: ['/sounds/duck.mp3', '/sounds/v1/duck.mp3'] },
      { id: 'bed',      emoji: '🛏️', name: 'Bed',       x: 38, y: 78, size: 14, sounds: ['/sounds/elephant.mp3', '/sounds/extra/elephant_long.mp3'] },
      { id: 'door',     emoji: '🚪', name: 'Door',      x: 10, y: 72, size: 11, sounds: ['/sounds/bird.mp3'] },
      { id: 'stuffed',  emoji: '🧸', name: 'Plush',     x: 84, y: 58, size: 10, sounds: ['/sounds/bear.mp3'] },
      { id: 'tv',       emoji: '📺', name: 'TV',        x: 65, y: 38, size: 13, sounds: ['/sounds/bird.mp3'] },
      { id: 'mirror',   emoji: '🪞', name: 'Mirror',    x: 18, y: 42, size: 11, sounds: ['/sounds/bird.mp3'] },
      { id: 'yarn',     emoji: '🧶', name: 'Yarn',      x: 50, y: 82, size:  9, sounds: ['/sounds/cat.mp3', '/sounds/v1/cat.mp3'] },
    ],
  },
  {
    id: 'bathroom',
    name: 'Bathroom',
    bg: '/scenes/bathroom.jpg',
    things: [
      { id: 'toilet',   emoji: '🚽', name: 'Toilet',    x: 20, y: 78, size: 11, sounds: ['/sounds/frog.mp3', '/sounds/v1/frog.mp3'] },
      { id: 'bathtub',  emoji: '🛁', name: 'Bathtub',   x: 50, y: 72, size: 14, sounds: ['/sounds/elephant.mp3', '/sounds/extra/elephant_long.mp3'] },
      { id: 'sink',     emoji: '🚰', name: 'Sink',      x: 78, y: 72, size: 10, sounds: ['/sounds/frog.mp3', '/sounds/v1/frog.mp3'] },
      { id: 'shower',   emoji: '🚿', name: 'Shower',    x: 82, y: 28, size: 12, sounds: ['/sounds/frog.mp3', '/sounds/v1/frog.mp3'] },
      { id: 'mirror2',  emoji: '🪞', name: 'Mirror',    x: 50, y: 32, size: 13, sounds: ['/sounds/bird.mp3'] },
      { id: 'towel',    emoji: '🧺', name: 'Towel',     x: 14, y: 52, size: 10, sounds: ['/sounds/cat.mp3', '/sounds/v1/cat.mp3'] },
      { id: 'soap',     emoji: '🧴', name: 'Soap',      x: 72, y: 52, size:  9, sounds: ['/sounds/bird.mp3'] },
      { id: 'toothbrush',emoji: '🪥', name: 'Brush',    x: 36, y: 52, size:  8, sounds: ['/sounds/bird.mp3'] },
      { id: 'tissue',   emoji: '🧻', name: 'Tissue',    x: 64, y: 82, size:  9, sounds: ['/sounds/bird.mp3'] },
      { id: 'rubberduck2',emoji: '🦆', name: 'Duck',   x: 50, y: 82, size: 10, sounds: ['/sounds/duck.mp3', '/sounds/v1/duck.mp3'] },
      { id: 'scale',    emoji: '⚖️', name: 'Scale',     x: 14, y: 78, size:  9, sounds: ['/sounds/bird.mp3'] },
      { id: 'plant',    emoji: '🪴', name: 'Plant',     x: 88, y: 52, size: 10, sounds: ['/sounds/elephant.mp3', '/sounds/extra/elephant_long.mp3'] },
    ],
  },
];

export function getThing(sceneId: string, thingId: string): Thing | null {
  const s = SCENES.find(x => x.id === sceneId);
  return s?.things.find(t => t.id === thingId) ?? null;
}

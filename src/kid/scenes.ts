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
];

export function getThing(sceneId: string, thingId: string): Thing | null {
  const s = SCENES.find(x => x.id === sceneId);
  return s?.things.find(t => t.id === thingId) ?? null;
}

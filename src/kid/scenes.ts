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
];

export function getThing(sceneId: string, thingId: string): Thing | null {
  const s = SCENES.find(x => x.id === sceneId);
  return s?.things.find(t => t.id === thingId) ?? null;
}

// Shared animal list. Each animal knows its own sound file(s) so
// tapping 🐄 Cow always plays the cow sound, not a random one.
// v25r: each animal now also has a list of emoji variants. The grid
// renders one tile per emoji so kids can pick their favorite visual
// for the same sound. Variants are picked from Unicode emoji 15+ that
// look like the same animal (e.g. 🐄 Cow, 🐮 Cow face, 🐂 Ox for
// the cow-family "long wet fart" group).

export type Animal = {
  id: string;
  name: string;
  /** Primary emoji used in the bottom-tab nav. */
  emoji: string;
  color: string;
  /** Primary sound + 0+ alternates. Picked round-robin on each tap. */
  srcs: string[];
  /**
   * Visual variants for the same sound. v25r: 2-4 emoji options per
   * animal so the kid can find their favorite look. The first one is
   * the canonical (used in titles, badges, etc.).
   */
  emojis: string[];
};

const s = (path: string) => [`/sounds/${path}`];
const ss = (...paths: string[]) => paths.map((p) => `/sounds/${p}`);

export const ANIMALS: Animal[] = [
  { id: "cow", name: "Cow", emoji: "🐄", color: "from-pink-200 to-pink-400",
    srcs: ss("cow.mp3", "extra/cow2.mp3", "extra/cow_v3.mp3"),
    emojis: ["🐄", "🐮", "🐂", "🫎"] },
  { id: "dog", name: "Dog", emoji: "🐕", color: "from-amber-200 to-amber-400",
    srcs: ss("dog.mp3", "extra/dog_v2.mp3", "extra/dog_v3.mp3"),
    emojis: ["🐕", "🐶", "🦮", "🐕‍🦺"] },
  { id: "cat", name: "Cat", emoji: "🐈", color: "from-purple-200 to-purple-400",
    srcs: ss("cat.mp3", "extra/cat2.mp3", "extra/cat_v3.mp3"),
    emojis: ["🐈", "🐈‍⬛", "🐱", "😺"] },
  { id: "bird", name: "Bird", emoji: "🐦", color: "from-sky-200 to-sky-400",
    srcs: ss("bird.mp3", "extra/bird2.mp3", "extra/bird_v3.mp3"),
    emojis: ["🐦", "🐤", "🐔", "🦜", "🦚"] },
  { id: "horse", name: "Horse", emoji: "🐎", color: "from-orange-200 to-orange-400",
    srcs: ss("horse.mp3", "extra/horse2.mp3", "extra/horse_v2.mp3"),
    emojis: ["🐎", "🐴", "🦄", "🫎"] },
  { id: "pig", name: "Pig", emoji: "🐖", color: "from-rose-200 to-rose-400",
    srcs: ss("pig.mp3", "extra/pig2.mp3", "extra/pig_v3.mp3"),
    emojis: ["🐖", "🐽", "🐷", "🐗"] },
  { id: "duck", name: "Duck", emoji: "🦆", color: "from-yellow-200 to-yellow-400",
    srcs: ss("duck.mp3", "extra/duck2.mp3", "extra/duck_v3.mp3"),
    emojis: ["🦆", "🦢", "🐦", "🐤"] },
  { id: "elephant", name: "Elephant", emoji: "🐘", color: "from-slate-300 to-slate-500",
    srcs: ss("elephant.mp3", "extra/elephant2.mp3", "extra/elephant_v3.mp3"),
    emojis: ["🐘", "🦣", "🐛"] },
  { id: "monkey", name: "Monkey", emoji: "🐒", color: "from-lime-200 to-lime-400",
    srcs: ss("monkey.mp3", "extra/monkey_v2.mp3", "extra/monkey_v3.mp3"),
    emojis: ["🐒", "🐵", "🦍", "🐶"] },
  { id: "snake", name: "Snake", emoji: "🐍", color: "from-emerald-200 to-emerald-400",
    srcs: ss("snake.mp3", "extra/snake2.mp3", "extra/snake_v3.mp3"),
    emojis: ["🐍", "🐉", "🪱"] },
  { id: "lion", name: "Lion", emoji: "🦁", color: "from-yellow-300 to-amber-500",
    srcs: ss("lion.mp3", "extra/lion2.mp3", "extra/lion_v3.mp3"),
    emojis: ["🦁", "🐅", "🐆", "😺"] },
  { id: "frog", name: "Frog", emoji: "🐸", color: "from-green-300 to-green-500",
    srcs: ss("frog.mp3", "extra/frog2.mp3", "extra/frog_v3.mp3"),
    emojis: ["🐸", "🐊", "🐢"] },
  { id: "bull", name: "Bull", emoji: "🐂", color: "from-red-300 to-red-500",
    srcs: ss("bull.mp3", "extra/bull2.mp3", "extra/bull_v3.mp3"),
    emojis: ["🐂", "🐄", "🐃", "🦬"] },
  { id: "rabbit", name: "Rabbit", emoji: "🐰", color: "from-pink-100 to-pink-300",
    srcs: ss("rabbit.mp3", "extra/rabbit_v2.mp3", "extra/rabbit_v3.mp3"),
    emojis: ["🐰", "🐇", "🐰"] },
  { id: "bear", name: "Bear", emoji: "🐻", color: "from-amber-500 to-orange-700",
    srcs: ss("bear.mp3", "extra/bear2.mp3", "extra/bear_v3.mp3"),
    emojis: ["🐻", "🐨", "🐼", "🦨"] },
  { id: "rooster", name: "Rooster", emoji: "🐓", color: "from-red-200 to-orange-300",
    srcs: ss("rooster.mp3", "extra/rooster2.mp3", "extra/rooster_v3.mp3"),
    emojis: ["🐓", "🐔", "🦃", "🐦"] },
  { id: "turtle", name: "Turtle", emoji: "🐢", color: "from-emerald-300 to-emerald-500",
    srcs: ss("turtle.mp3", "extra/turtle2.mp3", "extra/turtle_v3.mp3"),
    emojis: ["🐢", "🐢", "🐊"] },
  { id: "whale", name: "Whale", emoji: "🐋", color: "from-blue-300 to-blue-500",
    srcs: ss("whale.mp3", "extra/whale2.mp3", "extra/whale_v3.mp3"),
    emojis: ["🐋", "🐳", "🐟", "🐬"] },
  { id: "goat", name: "Goat", emoji: "🐐", color: "from-stone-300 to-stone-500",
    srcs: ss("extra/goat.mp3", "extra/goat_v2.mp3"),
    emojis: ["🐐", "🐏", "🐂"] },
  { id: "sheep", name: "Sheep", emoji: "🐑", color: "from-gray-200 to-gray-400",
    srcs: ss("extra/sheep.mp3", "extra/sheep_v2.mp3"),
    emojis: ["🐑", "🐏", "☁️"] },
  { id: "bee", name: "Bee", emoji: "🐝", color: "from-yellow-300 to-yellow-500",
    srcs: ss("extra/bee.mp3", "extra/bee_v2.mp3"),
    emojis: ["🐝", "🐝", "🐛"] },
  { id: "turkey", name: "Turkey", emoji: "🦃", color: "from-red-400 to-red-600",
    srcs: ss("extra/turkey.mp3", "extra/turkey_v2.mp3"),
    emojis: ["🦃", "🐔", "🐓"] },
  { id: "owl", name: "Owl", emoji: "🦉", color: "from-indigo-300 to-indigo-500",
    srcs: ss("extra/owl.mp3", "extra/owl_v2.mp3"),
    emojis: ["🦉", "🦅", "🐦"] },
  { id: "penguin", name: "Penguin", emoji: "🐧", color: "from-cyan-200 to-cyan-400",
    srcs: ss("extra/penguin.mp3", "extra/penguin_v2.mp3"),
    emojis: ["🐧", "🐦", "🦆"] },
  { id: "seal", name: "Seal", emoji: "🦭", color: "from-slate-200 to-slate-400",
    srcs: s("extra/seal.mp3"),
    emojis: ["🦭", "🐻", "🐾"] },
  { id: "hippo", name: "Hippo", emoji: "🦛", color: "from-pink-300 to-purple-400",
    srcs: s("extra/hippo.mp3"),
    emojis: ["🦛", "🐗", "🐷"] },
  { id: "rhino", name: "Rhino", emoji: "🦏", color: "from-stone-400 to-stone-600",
    srcs: s("extra/rhino.mp3"),
    emojis: ["🦏", "🐂", "🦬"] },
  { id: "zebra", name: "Zebra", emoji: "🦓", color: "from-gray-100 to-gray-300",
    srcs: s("extra/zebra.mp3"),
    emojis: ["🦓", "🐎", "🦄"] },
  { id: "giraffe", name: "Giraffe", emoji: "🦒", color: "from-yellow-200 to-amber-300",
    srcs: s("extra/giraffe.mp3"),
    emojis: ["🦒", "🦒", "🐎"] },
  { id: "moose", name: "Moose", emoji: "🦌", color: "from-amber-500 to-orange-600",
    srcs: s("extra/moose.mp3"),
    emojis: ["🦌", "🫎", "🐂"] },
  { id: "kangaroo", name: "Kangaroo", emoji: "🦘", color: "from-orange-300 to-orange-500",
    srcs: s("extra/kangaroo.mp3"),
    emojis: ["🦘", "🐰", "🐾"] },
  { id: "sloth", name: "Sloth", emoji: "🦥", color: "from-lime-200 to-amber-200",
    srcs: s("extra/sloth.mp3"),
    emojis: ["🦥", "🐒", "🐻"] },
  { id: "skunk", name: "Skunk", emoji: "🦨", color: "from-gray-300 to-gray-500",
    srcs: s("extra/skunk.mp3"),
    emojis: ["🦨", "🐻", "🐾"] },
  { id: "raccoon", name: "Raccoon", emoji: "🦝", color: "from-stone-300 to-stone-500",
    srcs: s("extra/raccoon.mp3"),
    emojis: ["🦝", "🐻", "🐾"] },
  { id: "mammoth", name: "Mammoth", emoji: "🦣", color: "from-stone-500 to-stone-700",
    srcs: s("extra/elephant_long.mp3"),
    emojis: ["🦣", "🐘", "🐃"] },
  { id: "megaLion", name: "Mega-Lion", emoji: "🦁", color: "from-amber-400 to-red-600",
    srcs: s("extra/lion_long.mp3"),
    emojis: ["🦁", "🐅", "🐯", "🦊"] },
  { id: "python", name: "Python", emoji: "🐍", color: "from-emerald-400 to-emerald-600",
    srcs: s("extra/snake_long.mp3"),
    emojis: ["🐍", "🐉", "🪱"] },
];

export const ANIMAL_BY_ID = new Map(ANIMALS.map((a) => [a.id, a]));

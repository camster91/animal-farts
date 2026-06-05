// v25u: build a cluster catalog. Instead of 388 individual tiles, we
// group the sounds into ~44 clusters (one per animal, plus 6 flavor
// buckets, plus a handful of themed clusters like Toilet, Brain, Funny).
// Each cluster = (emoji, name, sounds[]). Tapping a cluster plays a
// random sound from its bucket. Same tile = different sound every
// time, so the kid never gets bored.
//
// Cluster model:
//   animal:<name>     — per-animal sounds (49 sounds → 36 animal clusters)
//   wet / dry / echo / long / squeaky / bubbly  — flavor buckets
//   toilet / brain / brrt / funny / horn / sleep / sneeze / burp /
//   cough / breath / groan / scream / punch / kiss / boing / flute /
//   machine / mega / tiny / quick / crack / laugh / teeth / fire /
//   water / thunder / magic / other
//     — themed clusters for the flat /farts/ that don't fit a flavor
//
// Total: 44 clusters, 388 sounds.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..", "public", "sounds");
const OUT = path.join(__dirname, "..", "src", "audio", "clusterCatalog.ts");

// Animal metadata: (emoji, display name) per animal id
const ANIMAL_INFO = {
  bear: ["🐻", "Bear"],
  bee: ["🐝", "Bee"],
  bird: ["🐦", "Bird"],
  bull: ["🐂", "Bull"],
  cat: ["🐈", "Cat"],
  cow: ["🐄", "Cow"],
  dog: ["🐕", "Dog"],
  duck: ["🦆", "Duck"],
  elephant: ["🐘", "Elephant"],
  frog: ["🐸", "Frog"],
  giraffe: ["🦒", "Giraffe"],
  goat: ["🐐", "Goat"],
  hippo: ["🦛", "Hippo"],
  horse: ["🐎", "Horse"],
  kangaroo: ["🦘", "Kangaroo"],
  lion: ["🦁", "Lion"],
  monkey: ["🐒", "Monkey"],
  moose: ["🦌", "Moose"],
  owl: ["🦉", "Owl"],
  penguin: ["🐧", "Penguin"],
  pig: ["🐖", "Pig"],
  python: ["🐍", "Python"],
  rabbit: ["🐰", "Rabbit"],
  raccoon: ["🦝", "Raccoon"],
  rhino: ["🦏", "Rhino"],
  rooster: ["🐓", "Rooster"],
  seal: ["🦭", "Seal"],
  sheep: ["🐑", "Sheep"],
  skunk: ["🦨", "Skunk"],
  sloth: ["🦥", "Sloth"],
  snake: ["🐍", "Snake"],
  turtle: ["🐢", "Turtle"],
  whale: ["🐋", "Whale"],
  zebra: ["🦓", "Zebra"],
  mammoth: ["🦣", "Mammoth"],
  megaLion: ["🦁", "Mega Lion"],
};

// Themed cluster emoji + name. Display order: animals first, then
// flavor, then themed. We don't bake the order into the file — the
// grid lays it out separately.

const FLAVOR_CLUSTERS = {
  wet: ["💦", "Wet"],
  dry: ["🍂", "Dry"],
  echo: ["🏛️", "Echo"],
  long: ["🐌", "Long"],
  squeaky: ["🎺", "Squeaky"],
  bubbly: ["🫧", "Bubbly"],
};

const THEMED_CLUSTERS = {
  toilet: ["🚽", "Toilet"],
  brain: ["🧠", "Brain"],
  brrt: ["🔫", "Brrt"],
  funny: ["🤪", "Funny"],
  horn: ["📯", "Horn"],
  sleep: ["😴", "Snore"],
  sneeze: ["🤧", "Sneeze"],
  burp: ["🫢", "Burp"],
  cough: ["😷", "Cough"],
  breath: ["😮‍💨", "Breath"],
  groan: ["😩", "Groan"],
  scream: ["😱", "Scream"],
  punch: ["👊", "Punch"],
  kiss: ["💋", "Kiss"],
  boing: ["🪀", "Boing"],
  flute: ["🎶", "Whistle"],
  machine: ["⚙️", "Machine"],
  mega: ["💪", "Mega"],
  tiny: ["🤏", "Tiny"],
  quick: ["⚡", "Quick"],
  crack: ["⚡", "Crack"],
  laugh: ["🤣", "Laugh"],
  teeth: ["🦷", "Teeth"],
  fire: ["🔥", "Fire"],
  water: ["💧", "Water"],
  thunder: ["⛈️", "Thunder"],
  magic: ["✨", "Magic"],
  other: ["💨", "Fart"],
};

// === Classifier ===
// Returns { kind: "animal"|"flavor"|"themed", key: string }
function classify(sound) {
  const fn = sound.split("/").pop().replace(/\.mp3$/, "");
  // Strip the optional v1/ or extra/ prefix
  let base = fn;
  for (const p of ["v1/", "extra/"]) {
    if (base.startsWith(p)) base = base.slice(p.length);
  }

  // Animal files
  if (sound.startsWith("/sounds/") && !sound.includes("/farts/")) {
    for (const name of Object.keys(ANIMAL_INFO)) {
      if (
        fn === name ||
        fn === name + "_long" ||
        fn.startsWith(name + "_")
      ) {
        return { kind: "animal", key: name };
      }
    }
    return { kind: "themed", key: "other" };
  }

  // Flavor subdirectories
  if (sound.includes("/farts/wet/")) return { kind: "flavor", key: "wet" };
  if (sound.includes("/farts/dry/")) return { kind: "flavor", key: "dry" };
  if (sound.includes("/farts/echo/")) return { kind: "flavor", key: "echo" };
  if (sound.includes("/farts/long/")) return { kind: "flavor", key: "long" };
  if (sound.includes("/farts/squeaky/")) return { kind: "flavor", key: "squeaky" };
  if (sound.includes("/farts/bubbly/")) return { kind: "flavor", key: "bubbly" };

  // Flat /farts/ — keyword-based
  const b = base.toLowerCase();
  if (/(toilet|flush|potty)/.test(b)) return { kind: "themed", key: "toilet" };
  if (/brain/.test(b)) return { kind: "themed", key: "brain" };
  if (/(brrt|machine-gun|warthog|a-10)/.test(b)) return { kind: "themed", key: "brrt" };
  if (/(reverb|echo)/.test(b)) return { kind: "flavor", key: "echo" };
  if (/(wet|squelch|squish|mushy|muddy|sloppy|juicy|splat|splash|goopy|gooey|dribble)/.test(b)) return { kind: "flavor", key: "wet" };
  if (/(dry|crack|blast|snap|pop)/.test(b)) return { kind: "flavor", key: "dry" };
  if (/(squeaky|squeak|tight|reed|whistle|peep|pitch)/.test(b)) return { kind: "flavor", key: "squeaky" };
  if (/(long|drawn|sustained|drone|whoosh|wind|airy|growl|rumble|massive|big|reverse|reversed|slow|slowed)/.test(b)) return { kind: "flavor", key: "long" };
  if (/(bubble|bubbly|popcorn|machine-gun|bubble-in)/.test(b)) return { kind: "flavor", key: "bubbly" };
  // Animal-sound keywords in flat /farts/
  if (/(bark|barking)/.test(b)) return { kind: "animal", key: "dog" };
  if (/(meow|purr|mew)/.test(b)) return { kind: "animal", key: "cat" };
  if (/(oink|squeal|grunt|snort)/.test(b)) return { kind: "animal", key: "pig" };
  if (/(moo|bellow)/.test(b)) return { kind: "animal", key: "cow" };
  if (/(neigh|whinny|bray|nicker|chuff)/.test(b)) return { kind: "animal", key: "horse" };
  if (/(cock|crow|gobble|cluck|bawk|honk|cuack|quack|cucu|cackle)/.test(b)) return { kind: "animal", key: "rooster" };
  if (/(ribbit|croak)/.test(b)) return { kind: "animal", key: "frog" };
  if (/(trumpet)/.test(b)) return { kind: "animal", key: "elephant" };
  if (/(chitter|screech)/.test(b)) return { kind: "animal", key: "monkey" };
  if (/(tweet|chirp|trill|squawk|caw|hoot|peep|coo)/.test(b)) return { kind: "animal", key: "bird" };
  if (/(buzz|hum|wasp|hornet)/.test(b)) return { kind: "animal", key: "bee" };
  if (/(squeak|click)/.test(b)) return { kind: "animal", key: "mouse" };
  if (/(hoot)/.test(b)) return { kind: "animal", key: "owl" };
  if (/(baa|bleat)/.test(b)) return { kind: "animal", key: "sheep" };
  if (/(maa)/.test(b)) return { kind: "animal", key: "goat" };
  if (/(yip|yap)/.test(b)) return { kind: "animal", key: "fox" };
  if (/(howl|yelp|growl)/.test(b)) return { kind: "animal", key: "wolf" };
  if (/(hiss|rattle)/.test(b)) return { kind: "animal", key: "snake" };
  // Themed
  if (/(horn|trumpet|trombone|tuba|cornet|beep)/.test(b)) return { kind: "themed", key: "horn" };
  if (/(snore|snoring|zzz|sleep|zzzz)/.test(b)) return { kind: "themed", key: "sleep" };
  if (/sneeze/.test(b)) return { kind: "themed", key: "sneeze" };
  if (/(burp|belch|hickup|hiccup)/.test(b)) return { kind: "themed", key: "burp" };
  if (/(cough|hack|wheeze)/.test(b)) return { kind: "themed", key: "cough" };
  if (/(breath|breathing|inhale|exhale|huff|puff)/.test(b)) return { kind: "themed", key: "breath" };
  if (/(groan|moan|ugh|sigh|oof|argh|oooo|ohh|ahh|uuuu|uhh|arg)/.test(b)) return { kind: "themed", key: "groan" };
  if (/(roar|shout|scream|yell|cry|wail|shh|shhh|pa)/.test(b)) return { kind: "themed", key: "scream" };
  if (/(punch|hit|slam|kick|slap|thump)/.test(b)) return { kind: "themed", key: "punch" };
  if (/(kiss|mwah|smooch|muah)/.test(b)) return { kind: "themed", key: "kiss" };
  if (/(boing|bouncy|spring)/.test(b)) return { kind: "themed", key: "boing" };
  if (/(flute|whistling|fife|piccolo)/.test(b)) return { kind: "themed", key: "flute" };
  if (/(machine|machinery|motor|engine|drill)/.test(b)) return { kind: "themed", key: "machine" };
  if (/(mega|epic|extreme|loud|ultimate|super|turbo)/.test(b)) return { kind: "themed", key: "mega" };
  if (/(tiny|micro|mini|small|little|wee|quiet|silent|whisper)/.test(b)) return { kind: "themed", key: "tiny" };
  if (/(short|quick|rapid|pff|pfft|pfffft|snappy|snip)/.test(b)) return { kind: "themed", key: "quick" };
  if (/(crackle|crunch|crispy)/.test(b)) return { kind: "themed", key: "crack" };
  if (/(laugh|haha|hee|hee-haw|ha-ha|hehe|ree|hahaha|lol|rofl)/.test(b)) return { kind: "themed", key: "laugh" };
  if (/(tooth|teeth|fang|bite|jaw)/.test(b)) return { kind: "themed", key: "teeth" };
  if (/(fire|flame|burn|ignite|smoke)/.test(b)) return { kind: "themed", key: "fire" };
  if (/(splash|water|swim|dive)/.test(b)) return { kind: "themed", key: "water" };
  if (/(thunder|storm|lightning|thunderclap)/.test(b)) return { kind: "themed", key: "thunder" };
  if (/(magic|spell|wizard|fairy|ghost|skull|skeleton|zombie|vampire|dragon|alien|robot|monster|demon|devil|evil|dastardly)/.test(b)) return { kind: "themed", key: "magic" };
  if (/(meme|silly|goofy|funny|chaos|earrape|bass|crazy|insane|shut|folly|bernhard|jake|r2d2|spongebob|paula|mike|brian|cirno|enrique|german|autobahn|bologna|peppa|dummy|duane|billy-bob|oopsy|oops|uh-oh|oh-no|teddy|windows|cackle|cucu|foo|stereo|billy|bob|fartg)/.test(b)) return { kind: "themed", key: "funny" };
  return { kind: "themed", key: "other" };
}

// === Walk + cluster ===
const all = [];
function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    else if (entry.isFile() && entry.name.endsWith(".mp3")) {
      const rel = path.relative(ROOT, full).split(path.sep).join("/");
      all.push("/sounds/" + rel);
    }
  }
}
walk(ROOT);
all.sort();

const clusterMap = new Map(); // id -> { id, kind, key, emoji, name, sounds }
for (const s of all) {
  const { kind, key } = classify(s);
  const id = kind === "animal" ? `animal:${key}` : key;
  if (!clusterMap.has(id)) {
    let emoji, name;
    if (kind === "animal") {
      [emoji, name] = ANIMAL_INFO[key] || ["🐾", key];
    } else if (kind === "flavor") {
      [emoji, name] = FLAVOR_CLUSTERS[key];
    } else {
      [emoji, name] = THEMED_CLUSTERS[key] || ["💨", key];
    }
    clusterMap.set(id, { id, kind, key, emoji, name, sounds: [] });
  }
  clusterMap.get(id).sounds.push(s);
}

// Stable order: animals first (alphabetical), then flavor, then themed
const ordered = [];
const animalIds = [...clusterMap.keys()].filter((id) => id.startsWith("animal:")).sort();
const flavorIds = ["wet", "dry", "echo", "long", "squeaky", "bubbly"];
const themedIds = ["toilet", "brain", "brrt", "funny", "horn", "sleep", "sneeze",
  "burp", "cough", "breath", "groan", "scream", "punch", "kiss", "boing",
  "flute", "machine", "mega", "tiny", "quick", "crack", "laugh", "teeth",
  "fire", "water", "thunder", "magic", "other"];
for (const id of animalIds) ordered.push(clusterMap.get(id));
for (const k of flavorIds) if (clusterMap.has(k)) ordered.push(clusterMap.get(k));
for (const k of themedIds) if (clusterMap.has(k)) ordered.push(clusterMap.get(k));

// === Emit ===
const ts = `// AUTO-GENERATED by scripts/build-cluster-catalog.mjs at build time.
// v25u: cluster catalog. ${ordered.length} tiles cover all ${all.length}
// sounds. Each tile is (emoji, name, sounds[]). Tapping a tile picks
// a random sound from its bucket. Same tile = different sound every
// time.

export interface Cluster {
  id: string;
  kind: "animal" | "flavor" | "themed";
  key: string;
  emoji: string;
  name: string;
  sounds: string[];
}

export const CLUSTERS: Cluster[] = [
${ordered.map((c) => `  { id: ${JSON.stringify(c.id)}, kind: ${JSON.stringify(c.kind)}, key: ${JSON.stringify(c.key)}, emoji: ${JSON.stringify(c.emoji)}, name: ${JSON.stringify(c.name)}, sounds: [${c.sounds.map((s) => JSON.stringify(s)).join(", ")}] },`).join("\n")}
];
`;
fs.writeFileSync(OUT, ts);
console.log(`[build-cluster-catalog] ${ordered.length} clusters (${all.length} sounds) → ${path.relative(process.cwd(), OUT)}`);

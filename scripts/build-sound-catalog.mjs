// v25t: build the sound catalog. Each of the 388 sounds gets a unique
// (emoji, name) tuple so the kid can browse a giant emoji soundboard.
// Animals keep their real animal emoji; flavor farts share an emoji
// per flavor; flat /farts/ cycle through a curated non-animal emoji pool.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..", "public", "sounds");
const OUT = path.join(__dirname, "..", "src", "audio", "soundCatalog.ts");

const ANIMAL_TABLE = [
  ["bear", "🐻", "Bear"],
  ["bee", "🐝", "Bee"],
  ["bird", "🐦", "Bird"],
  ["bull", "🐂", "Bull"],
  ["cat", "🐈", "Cat"],
  ["cow", "🐄", "Cow"],
  ["dog", "🐕", "Dog"],
  ["duck", "🦆", "Duck"],
  ["elephant", "🐘", "Elephant"],
  ["frog", "🐸", "Frog"],
  ["giraffe", "🦒", "Giraffe"],
  ["goat", "🐐", "Goat"],
  ["hippo", "🦛", "Hippo"],
  ["horse", "🐎", "Horse"],
  ["kangaroo", "🦘", "Kangaroo"],
  ["lion", "🦁", "Lion"],
  ["monkey", "🐒", "Monkey"],
  ["moose", "🦌", "Moose"],
  ["owl", "🦉", "Owl"],
  ["penguin", "🐧", "Penguin"],
  ["pig", "🐖", "Pig"],
  ["python", "🐍", "Python"],
  ["rabbit", "🐰", "Rabbit"],
  ["raccoon", "🦝", "Raccoon"],
  ["rhino", "🦏", "Rhino"],
  ["rooster", "🐓", "Rooster"],
  ["seal", "🦭", "Seal"],
  ["sheep", "🐑", "Sheep"],
  ["skunk", "🦨", "Skunk"],
  ["sloth", "🦥", "Sloth"],
  ["snake", "🐍", "Snake"],
  ["turtle", "🐢", "Turtle"],
  ["whale", "🐋", "Whale"],
  ["zebra", "🦓", "Zebra"],
  ["mammoth", "🦣", "Mammoth"],
  ["megaLion", "🦁", "Mega Lion"],
  ["elephant_long", "🦣", "Mammoth"],
  ["lion_long", "🦁", "Mega Lion"],
  ["snake_long", "🐍", "Python"],
];
const ANIMAL_MAP = Object.fromEntries(
  ANIMAL_TABLE.map(([k, e, n]) => [k, [e, n]])
);

const FLAVORS = [
  ["wet", "💦", "Wet"],
  ["dry", "🍂", "Dry"],
  ["echo", "🏛️", "Echo"],
  ["long", "🐌", "Long"],
  ["squeaky", "🎺", "Squeaky"],
  ["bubbly", "🫧", "Bubbly"],
];
const FLAVOR_BY_KEY = Object.fromEntries(FLAVORS);

// Curated non-animal emoji pool (used for flat /farts/ tiles so the
// kid gets a giant emoji soundboard, not a tiny one). ~400 unique.
const NON_ANIMAL_POOL = [
  "😀","😃","😄","😁","😆","😅","🤣","😊","😇","🙂","😉","😌","😍","🥰","😘","😗","😚","😙",
  "🤪","😜","😝","😛","🤑","🤗","🤭","🤫","🤔","🤐","🤨","😐","😑","😶","😏","😒","🙄","😬","🤥",
  "😪","😴","🤤","😷","🤒","🤕","🤢","🤮","🤧","🥵","🥶","🥴","😵","🤯","🤠","🥳","😎","🤓","🧐",
  "👋","🤚","✋","🖐️","🖖","👌","🤌","🤏","✌️","🤞","🤟","🤘","🤙","👈","👉","👆","🖕","👇","☝️","👍","👎","✊","👊","🤛","🤜","👏","🙌","👐","🤲","🤝","🙏",
  "❤️","🧡","💛","💚","💙","💜","🖤","🤍","🤎","💔","❣️","💕","💞","💓","💗","💖","💘","💝","💟","♥️",
  "💯","💢","💥","💫","💦","💨","🕳️","💬","🗨️","🗯️","💭","💤",
  "🍎","🍐","🍊","🍋","🍌","🍉","🍇","🍓","🫐","🍈","🍒","🍑","🥭","🍍","🥥","🥝","🍅","🍆","🥑","🥦",
  "🥬","🥒","🌶️","🫑","🌽","🥕","🫒","🧄","🧅","🥔","🍠","🥐","🥯","🍞","🥖","🥨","🧀","🥚","🍳","🧈",
  "🥞","🧇","🥓","🥩","🍗","🍖","🌭","🍔","🍟","🍕","🥪","🥙","🧆","🌮","🌯","🥗","🥘","🫕","🥫","🍝",
  "🍜","🍲","🍛","🍣","🍱","🥟","🦪","🍤","🍙","🍚","🍘","🍥","🥠","🥮","🍢","🍡","🍧","🍨","🍦","🥧",
  "🧁","🍰","🎂","🍮","🍭","🍬","🍫","🍿","🍩","🍪","🌰","🥜","🍯","🥛","🍼","☕","🍵","🧃","🥤","🧋",
  "🍶","🍺","🍻","🥂","🍷","🥃","🍸","🍹","🍾","🧊","🥄","🍴","🍽️","🥣","🥡","🥢","🧂",
  "⚽","🏀","🏈","⚾","🥎","🎾","🏐","🏉","🥏","🎱","🪀","🏓","🏸","🏒","🏑","🥍","🏏","🥅","⛳","🪁",
  "🏹","🎣","🤿","🥊","🥋","🎽","🛹","🛼","🛷","⛸️","🥌","🎿","⛷️","🏂","🪂","🏋️","🤼","🤸","⛹️","🤺",
  "🤾","🏌️","🏇","🧘",
  "🚗","🚕","🚙","🚌","🚎","🏎️","🚓","🚑","🚒","🚐","🛻","🚚","🚛","🚜","🛴","🚲","🛵","🏍️","🛺","🚨",
  "🚔","🚍","🚘","🚖","🚡","🚠","🚟","🚃","🚋","🚞","🚝","🚄","🚅","🚈","🚂","🚆","🚇","🚊","🚉","✈️",
  "🛫","🛬","🛩️","💺","🛰️","🚀","🛸","🚁","🛶","⛵","🚤","🛥️","🛳️","⛴️","🚢","⚓","🚧","⛽","🚏","🚦",
  "🚥","🗺️","🗿","🗽","🗼","🏰","🏯","🏟️","🎡","🎢","🎠","⛲","🏖️","🏝️","🏜️","🌋","⛰️","🏔️","🗻","🏕️",
  "⛺","🏠","🏡","🏘️","🏚️","🏗️","🏭","🏢","🏬","🏣","🏤","🏥","🏦","🏨","🏪","🏫","🏩","💒","🏛️","⛪",
  "🕌","🕍","🛕","🕋",
  "☀️","🌤️","⛅","🌥️","☁️","🌦️","🌧️","⛈️","🌩️","🌨️","❄️","☃️","⛄","🌬️","💨","💧","💦","☔","☂️","🌫️",
  "🌪️","🌈","🌂","☄️","✨","⭐","🌟","💫","🔥","💥","🌊","🌱","🌿","☘️","🍀","🎋","🎍","🌳","🌲","🌴",
  "🌵","🌾","🌷","🌹","🥀","🌺","🌸","🌼","🌻","🌞","🌝","🌛","🌜","🌚","🌕","🌖","🌗","🌘","🌑","🌒",
  "🌓","🌔","🌙","🌎","🌍","🌏","🪐","💫","☄️","🔥",
  "⌚","📱","📲","💻","⌨️","🖥️","🖨️","🖱️","🖲️","🕹️","🗜️","💽","💾","💿","📀","📼","📷","📸","📹","🎥",
  "📽️","🎞️","📞","☎️","📟","📠","📺","📻","🎙️","🎚️","🎛️","🧭","⏱️","⏲️","⏰","🕰️","⌛","⏳","📡","🔋",
  "🔌","💡","🔦","🕯️","🪔","🧯","🛢️","💸","💵","💴","💶","💷","🪙","💰","💳","💎","⚖️","🪜","🧰","🪛",
  "🔧","🔨","⚒️","🛠️","⛏️","🪚","🔩","⚙️","🪤","🧱","⛓️","🧲","🔫","💣","🧨","🪓","🔪","🗡️","⚔️","🛡️",
  "🚬","⚰️","🪦","⚱️","🏺","🔮","📿","🧿","💈","⚗️","🔭","🔬","🕳️","🩹","🩺","💊","💉","🩸","🧬","🦠",
  "🧫","🧪","🌡️","🧹","🪠","🧺","🧻","🚽","🚰","🚿","🛁","🛀","🧼","🪥","🪒","🧽","🪣","🧴","🛎️","🔑",
  "🗝️","🚪","🪑","🛋️","🛏️","🛌","🧸","🪆","🖼️","🪞","🪟","🛍️","🛒","🎁","🎈","🎏","🎀","🪄","🪅","🎊",
  "🎉","🎎","🏮","🎐","🧧",
  "💩","👻","🤖","👽","🦄","🐲","🎃","🎄","🎁","🎈","🎉","🎊","🪄","🪅","🧸",
  "🎵","🎶","🎤","🎧","🎸","🎹","🥁","🎺","🎻","🎼","🎷","🪕","🎙️",
  "🏆","🥇","🥈","🥉","🏅","🎖️","🏵️","🎗️","🎫","🎟️","🎪","🤹","🎭","🩰","🎨","🎬","🎤","🎧","🎼","🎹",
  "🚗","🚕","🚙","🚌","🚎","🏎️","🚓","🚑","🚒","🚐","🛻","🚚","🚛","🚜","🛴","🚲","🛵","🏍️","🛺","🚨",
  "👶","🧒","👦","👧","🧑","👱","👨","🧔","👩","🧓","👴","👵","🙅","🙆","💁","🙋","🧏","🙇","🤦","🤷",
  "👮","🕵️","💂","👷","🤴","👸","👳","👲","🧕","🤵","👰","🤰","🤱","👼","🎅","🤶","🦸","🦹","🧙","🧚",
  "🧛","🧜","🧝","🧞","🧟","💆","💇","🚶","🏃","💃","🕺","🧎","🧖",
];

// === Helpers ===

function matchAnimal(sound) {
  const fn = sound.split("/").pop().replace(/\.mp3$/, "");
  let norm = fn;
  for (const p of ["v1/", "extra/"]) {
    if (norm.startsWith(p)) norm = norm.slice(p.length);
  }
  if (norm.endsWith("_long")) norm = norm.slice(0, -"_long".length);
  // Exact match — ANIMAL_MAP values are [emoji, name] 2-tuples
  if (ANIMAL_MAP[norm]) return ANIMAL_MAP[norm];
  for (const sfx of ["_v2", "_v3", "_2", "_3"]) {
    if (norm.endsWith(sfx)) {
      const stripped = norm.slice(0, -sfx.length);
      if (ANIMAL_MAP[stripped]) return ANIMAL_MAP[stripped];
    }
  }
  return null;
}

function matchFlavor(sound) {
  for (const [f, e, n] of FLAVORS) {
    if (sound.includes(`/farts/${f}/`)) return { emoji: e, label: n, flavor: f };
  }
  return null;
}

const NOISE = [
  "mike koenig", "kevangc", "keving", "joe", "jack", "jeb", "kev",
  "jake", "billy bob", "folly", "bernhard", "enrique", "duane",
  "bologna", "cirno", "dummy", "r2d2", "german", "autobahn",
  "spongebob", "peppa pig", "paula", "brian", "brain fart",
  "pa", "windows", "stereo", "mike", "koenig",
];
const TIMESTAMP_RE = /\b\d{7,}\b/g;

function makeName(sound) {
  let fn = sound.split("/").pop().replace(/\.mp3$/, "");
  fn = fn.replace(/^\d+-?/, "");
  fn = fn.replace(/[-_]+/g, " ").trim();
  fn = fn.replace(TIMESTAMP_RE, "").trim();
  for (const d of NOISE) fn = fn.replace(new RegExp(d, "gi"), "").trim();
  fn = fn.replace(/\s+/g, " ");
  if (!fn || fn.length < 2) return "Fart";
  const words = fn.split(" ");
  const out = words.map((w) =>
    w.length <= 2 ? w.toUpperCase() : w[0].toUpperCase() + w.slice(1)
  );
  let name = out.join(" ").trim();
  if (name.length > 30) name = name.slice(0, 30);
  return name || "Fart";
}

// === Walk and build catalog ===
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

const catalog = [];
let flatIdx = 0;
for (const s of all) {
  // 1. Animal — matchAnimal returns [emoji, name] or null
  const animal = matchAnimal(s);
  if (animal) {
    const [emoji, name] = animal;
    catalog.push({ sound: s, emoji, name });
    continue;
  }
  // 2. Flavor
  const flavor = matchFlavor(s);
  if (flavor) {
    const baseName = makeName(s);
    const flavorLower = flavor.flavor;
    let name = baseName;
    if (name.toLowerCase().startsWith(flavorLower + " ")) {
      name = name.slice(flavorLower.length + 1);
    }
    if (!name) name = baseName;
    catalog.push({ sound: s, emoji: flavor.emoji, name: `${flavor.label} ${name}` });
    continue;
  }
  // 3. Flat /farts/ — cycle through non-animal emoji
  if (s.includes("/farts/")) {
    const emoji = NON_ANIMAL_POOL[flatIdx % NON_ANIMAL_POOL.length];
    flatIdx++;
    catalog.push({ sound: s, emoji, name: makeName(s) });
    continue;
  }
  catalog.push({ sound: s, emoji: "💨", name: makeName(s) });
}

// Emoji are non-BMP code points (above U+FFFF). JSON.stringify escapes
// them as `\uXXXX\uXXXX` surrogate pairs, which TypeScript/JS handles
// fine, but it's hard to read in source. TypeScript does NOT support
// multi-codepoint `\u{XXXX XXXX}` escapes (TS1199), so we emit each
// code point as a separate `\u{XXXX}` literal.
function emojiToEscape(emoji) {
  const cps = [];
  for (const ch of emoji) cps.push(ch.codePointAt(0).toString(16));
  return `"${cps.map((cp) => `\\u{${cp}}`).join("")}"`;
}

const ts = `// AUTO-GENERATED by scripts/build-sound-catalog.mjs at build time.
// v25t: master catalog of ${all.length} sounds. Each tile has a unique
// (emoji, name, sound) tuple — the kid can browse a giant emoji
// soundboard where every tile is visually distinct.

export interface SoundEntry {
  sound: string;
  emoji: string;
  name: string;
}

export const SOUND_CATALOG: SoundEntry[] = [
${catalog.map((c) => `  { sound: ${JSON.stringify(c.sound)}, emoji: ${emojiToEscape(c.emoji)}, name: ${JSON.stringify(c.name)} },`).join("\n")}
];
`;
fs.writeFileSync(OUT, ts);
console.log(`[build-sound-catalog] ${catalog.length} entries → ${path.relative(process.cwd(), OUT)}`);

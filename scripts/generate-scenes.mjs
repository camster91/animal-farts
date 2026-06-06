// Generate the 6 illustrated scene backgrounds using the minimax
// image generation API. Run this once, commit the resulting JPEGs
// to public/scenes/, and the v25w app picks them up automatically.
//
// Usage: node scripts/generate-scenes.mjs
//
// Requires: MINIMAX_API_KEY in ~/.hermes/.env (already set).

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..", "public", "scenes");
const ENV_PATH = path.join(process.env.HOME, ".hermes", ".env");

// === Scene prompts ===
const SCENES = [
  {
    id: "farm",
    name: "Farm",
    prompt: "A bright, cheerful cartoon illustration of a sunny farm scene for a kids' sound toy app. Wide horizontal banner, 1500x600 px. Rolling green grass in the foreground, soft blue sky with puffy white clouds, a red wooden barn with white roof on the left, white picket fence, a few green trees, a yellow sun in the upper-right corner, a tractor in the distance. Pixar-style art. Empty space in the center/foreground for app tile buttons to overlay. No text. No logos.",
  },
  {
    id: "jungle",
    name: "Jungle",
    prompt: "A bright, cheerful cartoon illustration of a tropical jungle scene for a kids' sound toy app. Wide horizontal banner, 1500x600 px. Dense green tropical leaves and vines in the foreground, tall tree trunks with brown bark, vines hanging down, lush green canopy, golden light filtering through the trees, a toucan or parrot peeking from the foliage, pink hibiscus flowers at the bottom. Pixar-style art. Empty space in the center/foreground for app tile buttons to overlay. No text. No logos.",
  },
  {
    id: "ocean",
    name: "Ocean",
    prompt: "A bright, cheerful cartoon illustration of an ocean scene for a kids' sound toy app. Wide horizontal banner, 1500x600 px. Calm turquoise ocean water with gentle waves in the foreground, deeper blue water, distant horizon line, sunny sky with a few white clouds, a small tropical island in the distance, an orange starfish and a small fish in the water. Pixar-style art. Empty space in the center/foreground for app tile buttons to overlay. No text. No logos.",
  },
  {
    id: "city",
    name: "City",
    prompt: "A bright, cheerful cartoon illustration of a small town city scene for a kids' sound toy app. Wide horizontal banner, 1500x600 px. Tall colorful buildings in soft pastel pinks, yellows, and blues in the background, a paved road with white lane markings in the foreground, a traffic light, a bus stop sign, sunny blue sky with a few clouds, a couple of small trees in planters. Pixar-style art. Empty space in the center/foreground for app tile buttons to overlay. No text. No logos.",
  },
  {
    id: "bedroom",
    name: "Bedroom",
    prompt: "A bright, cheerful cartoon illustration of a cozy kids' bedroom at night for a kids' sound toy app. Wide horizontal banner, 1500x600 px. Soft purple/blue night sky visible through a window with stars and a crescent moon, a comfy bed with colorful blankets on the right, a soft rug on wooden floor, a small nightlight glowing warmly on a nightstand, a few pillows and stuffed animals. Pixar-style art. Empty space in the center/foreground for app tile buttons to overlay. No text. No logos.",
  },
  {
    id: "bathroom",
    name: "Bathroom",
    prompt: "A bright, cheerful cartoon illustration of a kids' bathroom scene for a kids' sound toy app. Wide horizontal banner, 1500x600 px. Light blue ceramic tile wall, a white bathtub on the right, a small step stool, a rubber duck, a toothbrush in a cup on the sink counter, a mirror, a bath mat on the floor, soft warm lighting. Pixar-style art. Empty space in the center/foreground for app tile buttons to overlay. No text. No logos.",
  },
];

// === Load API key from ~/.hermes/.env ===
function loadApiKey() {
  const env = fs.readFileSync(ENV_PATH, "utf8");
  for (const line of env.split("\n")) {
    if (line.startsWith("MINIMAX_API_KEY=") && !line.startsWith("#")) {
      return line.split("=", 2)[1].trim();
    }
  }
  throw new Error(`MINIMAX_API_KEY not found in ${ENV_PATH}`);
}

// === Generate one image ===
async function generate(prompt, aspectRatio = "16:9") {
  const key = loadApiKey();
  const url = "https://api.minimax.io/v1/image_generation";
  const body = JSON.stringify({
    model: "image-01",
    prompt,
    aspect_ratio: aspectRatio,
    response_format: "base64",
  });
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${key}`,
    },
    body,
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`HTTP ${res.status}: ${txt.slice(0, 500)}`);
  }
  const json = await res.json();
  const images = json?.data?.image_base64;
  if (!images || !images[0]) throw new Error("No image in response");
  return Buffer.from(images[0], "base64");
}

// === Main ===
fs.mkdirSync(ROOT, { recursive: true });

for (const scene of SCENES) {
  const out = path.join(ROOT, `${scene.id}.jpg`);
  if (fs.existsSync(out) && !process.argv.includes("--force")) {
    console.log(`[skip] ${scene.id} (already exists, --force to overwrite)`);
    continue;
  }
  console.log(`[generate] ${scene.id}...`);
  try {
    const buf = await generate(scene.prompt);
    fs.writeFileSync(out, buf);
    console.log(`  saved: ${out} (${(buf.length / 1024).toFixed(0)} KB)`);
  } catch (err) {
    console.error(`  FAILED: ${err.message}`);
  }
}

console.log("Done.");

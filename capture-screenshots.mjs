import { chromium } from 'playwright';
import { mkdir } from 'fs/promises';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BASE = 'http://localhost:5174';
const OUT  = path.join(__dirname, 'public', 'store-assets', 'screenshots');

const SCENES = [
  { name: 'farm',     title: 'Farm',     tagline: 'Moo! Baa! Oink!',           feature: '12 barnyard sounds to tap' },
  { name: 'jungle',  title: 'Jungle',   tagline: 'Rawr! Screech! Trumpet!',    feature: '12 wild jungle sounds' },
  { name: 'ocean',   title: 'Ocean',    tagline: 'Splash! Bubble! Whooo!',     feature: '12 ocean sounds' },
  { name: 'city',    title: 'City',     tagline: 'Beep! Vroom! Honk!',         feature: '12 city sounds' },
  { name: 'bedroom', title: 'Bedroom',   tagline: 'Squeak! Rustle! Zzz!',       feature: '12 bedroom sounds' },
  { name: 'bathroom',title: 'Bathroom', tagline: 'Flush! Drip! Squirt!',       feature: '12 bathroom sounds' },
];

const SIZES = [
  { label: 'iphone-65',     width: 1290, height: 2796 },
  { label: 'iphone-55',     width: 1242, height: 2208 },
  { label: 'ipad-pro',      width: 2048, height: 2732 },
  { label: 'play-phone',    width: 1080, height: 1920 },
];

await mkdir(OUT, { recursive: true });

const browser = await chromium.launch({ headless: true });

async function captureScene(scene, size) {
  const page = await browser.newPage({ viewport: size });

  await page.goto(BASE, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);

  // Seed IndexedDB with profile + set localStorage
  await page.evaluate(async (sceneId) => {
    const DB_NAME = 'poot-party';
    const DB_VERSION = 3;
    const db = await new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });

    if (db.objectStoreNames.contains('profiles')) {
      const tx = db.transaction('profiles', 'readwrite');
      const store = tx.objectStore('profiles');
      const profile = {
        id: 'screenshot-profile',
        name: 'Sam',
        avatar: '💨',
        createdAt: Date.now(),
        lastSceneId: sceneId,
        shareCode: 'SSSS',
      };
      await new Promise((res, rej) => {
        const r = store.put(profile);
        r.onsuccess = res; r.onerror = () => rej(r.error);
      });
    }

    localStorage.setItem('poot-party-kid-settings', JSON.stringify({
      activeProfileId: 'screenshot-profile',
    }));
    localStorage.setItem('poot-party-welcome-seen', '1');
  }, scene.name);

  // Reload so app picks up the seeded profile
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);

  // Click the "Sam" profile button
  const samButton = page.locator('button', { hasText: 'Sam' }).first();
  if (await samButton.isVisible({ timeout: 3000 }).catch(() => false)) {
    await samButton.click();
    await page.waitForTimeout(2000);
  }

  // Navigate to correct scene dot: farm=0, jungle=1, ocean=2, city=3, bedroom=4, bathroom=5
  const dotIndexMap = { farm: 0, jungle: 1, ocean: 2, city: 3, bedroom: 4, bathroom: 5 };
  const dotIdx = dotIndexMap[scene.name];

  // Find all buttons and click the one at bottom of screen corresponding to our dot
  const allButtons = page.locator('button');
  const count = await allButtons.count();
  let clicked = false;
  for (let i = 0; i < count; i++) {
    const btn = allButtons.nth(i);
    const box = await btn.boundingBox();
    if (box && box.y > size.height * 0.65) {
      // This is a bottom-area button — click dots in order
      if (i === 4 + dotIdx) {  // offset by 4 (header buttons etc.)
        await btn.click();
        await page.waitForTimeout(1000);
        clicked = true;
        break;
      }
    }
  }

  // Fallback: swipe left N times to get to the right scene
  if (!clicked) {
    const swipesNeeded = dotIdx;
    for (let i = 0; i < swipesNeeded; i++) {
      await page.mouse.move(size.width * 0.8, size.height * 0.5);
      await page.mouse.down();
      await page.mouse.move(size.width * 0.2, size.height * 0.5, { steps: 10 });
      await page.mouse.up();
      await page.waitForTimeout(500);
    }
  }

  const filename = `${scene.name}-${size.label}.png`;
  await page.screenshot({ path: path.join(OUT, filename), type: 'png' });
  await page.close();
  console.log(`  ✓ ${filename}`);
}

for (const scene of SCENES) {
  console.log(`\nCapturing ${scene.title}...`);
  for (const size of SIZES) {
    await captureScene(scene, size);
  }
}

await browser.close();
console.log('\nAll done!');

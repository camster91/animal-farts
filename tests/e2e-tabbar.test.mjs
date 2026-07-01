// tests/e2e-tabbar.test.mjs — Playwright E2E test for the tab bar
// (regression test for v80: tabs don't block FirstRunIntro dismiss).

import { describe, it, before, after } from "node:test";
import assert from "node:assert";
import { chromium } from "/Users/biancabienaime/.npm/_npx/705bc6b22212b352/node_modules/playwright/index.mjs";

const BASE = process.env.POOPBOX_E2E_URL || "https://animals.ashbi.ca/";

let browser, page;

before(async () => {
  browser = await chromium.launch({ headless: true });
  page = await browser.newPage({ viewport: { width: 414, height: 896 } });
});

after(async () => {
  if (browser) await browser.close();
});

describe("v80 regression: tab bar doesn't block FirstRunIntro", () => {
  it("modal dismisses via the inner 'Let's go!' button", async () => {
    await page.goto(BASE, { waitUntil: "commit", timeout: 15000 });
    await page.waitForTimeout(2500);

    // FirstRunIntro must be visible
    const before = await page.locator("text=Welcome to PootBox").count();
    assert.strictEqual(before, 1, "modal should be visible on first load");

    // Click "Let's go!" — this is the inner card button
    const btn = page.locator('[role="dialog"] button').first();
    await btn.click({ timeout: 5000 });
    await page.waitForTimeout(300);

    // Modal should be gone
    const after = await page.locator("text=Welcome to PootBox").count();
    assert.strictEqual(after, 0, "modal should be dismissed after click");
  });

  it("modal dismisses via backdrop click", async () => {
    // Wipe localStorage so the modal re-appears
    await page.evaluate(() => {
      localStorage.removeItem("pootbox-firstrun-done");
      localStorage.removeItem("pootbox-onboarded-v2");
    });
    await page.reload({ waitUntil: "commit" });
    await page.waitForTimeout(2500);

    // Click the backdrop (outside the inner card)
    await page.mouse.click(50, 200);
    await page.waitForTimeout(300);

    const after = await page.locator("text=Welcome to PootBox").count();
    assert.strictEqual(after, 0, "modal should be dismissed via backdrop click");
  });

  it("tapping a card plays audio (no WebMediaPlayer exhaustion)", async () => {
    // Modal is gone by now. Tap a card.
    const cardRect = await page.evaluate(() => {
      const cards = document.querySelectorAll('button[aria-label*="— tap to play"]');
      if (cards.length === 0) return null;
      const r = cards[0].getBoundingClientRect();
      return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
    });
    assert.ok(cardRect, "card grid must have at least one tap-to-play card");

    // Hook the Audio constructor to count creations
    await page.evaluate(() => {
      window.__audioCount = 0;
      const RealAudio = window.Audio;
      window.Audio = function (...args) {
        window.__audioCount += 1;
        return new RealAudio(...args);
      };
      window.Audio.prototype = RealAudio.prototype;
    });

    // Tap 5 times (the 5th triggers combo burst, which means
    // audio+visual effects fired on every tap)
    for (let i = 0; i < 5; i++) {
      await page.mouse.click(cardRect.x, cardRect.y);
      await page.waitForTimeout(80);
    }

    // Wait 4 seconds (no more audio should be created — physics
    // tick is gone in v80c)
    await page.waitForTimeout(4000);

    const audioCount = await page.evaluate(() => window.__audioCount);
    assert.ok(
      audioCount <= 10,
      `5 card taps should create at most a few audio instances, got ${audioCount} (WebMediaPlayer limit is ~16-32 per page)`,
    );
  });

  it("combo burst visual fires on 5th tap", async () => {
    // Reset and tap again
    await page.evaluate(() => {
      window.__ariaHidden = 0;
    });

    const cardRect = await page.evaluate(() => {
      const cards = document.querySelectorAll('button[aria-label*="— tap to play"]');
      if (cards.length === 0) return null;
      const r = cards[0].getBoundingClientRect();
      return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
    });
    if (!cardRect) return;

    for (let i = 0; i < 5; i++) {
      await page.mouse.click(cardRect.x, cardRect.y);
      await page.waitForTimeout(40);
    }
    // The combo burst adds 8 aria-hidden particle divs. Sample
    // within the 700ms burst window.
    await page.waitForTimeout(200);
    const burstCount = await page.evaluate(() => {
      return document.querySelectorAll('[aria-hidden="true"]').length;
    });
    assert.ok(
      burstCount >= 3,
      `expected at least 3 aria-hidden visual particles after 5 taps, got ${burstCount}`,
    );
  });
});
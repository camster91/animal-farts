// tests/e2e-tabbar.test.mjs — Playwright E2E for the tab bar +
//                    (additional QA pass). Memory says to do a
//                    final visual + functional check.

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
    const before = await page.locator("text=Welcome to PootBox").count();
    assert.strictEqual(before, 1, "modal should be visible on first load");
    const btn = page.locator('[role="dialog"] button').first();
    await btn.click({ timeout: 5000 });
    await page.waitForTimeout(300);
    const after = await page.locator("text=Welcome to PootBox").count();
    assert.strictEqual(after, 0, "modal should be dismissed after click");
  });

  it("modal dismisses via backdrop click", async () => {
    await page.evaluate(() => {
      localStorage.removeItem("pootbox-firstrun-done");
      localStorage.removeItem("pootbox-onboarded-v2");
    });
    await page.reload({ waitUntil: "commit" });
    await page.waitForTimeout(2500);
    await page.mouse.click(50, 200);
    await page.waitForTimeout(300);
    const after = await page.locator("text=Welcome to PootBox").count();
    assert.strictEqual(after, 0, "modal should be dismissed via backdrop click");
  });

  it("tapping a card plays audio (no WebMediaPlayer exhaustion)", async () => {
    const cardRect = await page.evaluate(() => {
      const cards = document.querySelectorAll('button[aria-label*="— tap to play"]');
      if (cards.length === 0) return null;
      const r = cards[0].getBoundingClientRect();
      return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
    });
    assert.ok(cardRect, "card grid must have at least one tap-to-play card");
    await page.evaluate(() => {
      window.__audioCount = 0;
      const RealAudio = window.Audio;
      window.Audio = function (...args) {
        window.__audioCount += 1;
        return new RealAudio(...args);
      };
      window.Audio.prototype = RealAudio.prototype;
    });
    for (let i = 0; i < 5; i++) {
      await page.mouse.click(cardRect.x, cardRect.y);
      await page.waitForTimeout(80);
    }
    await page.waitForTimeout(4000);
    const audioCount = await page.evaluate(() => window.__audioCount);
    assert.ok(
      audioCount <= 10,
      `5 card taps should create at most a few audio instances, got ${audioCount} (WebMediaPlayer limit is ~16-32 per page)`,
    );
  });

  it("combo burst visual fires on 5th tap", async () => {
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
    await page.waitForTimeout(200);
    const burstCount = await page.evaluate(() => {
      return document.querySelectorAll('[aria-hidden="true"]').length;
    });
    assert.ok(burstCount >= 3, `expected at least 3 aria-hidden visual particles after 5 taps, got ${burstCount}`);
  });
});

describe("v80 QA: tab bar functionality (rebuilt in e231d82)", () => {
  it("tab bar renders 3 buttons at the bottom of the viewport", async () => {
    // Force the first-run modal to appear
    await page.evaluate(() => {
      localStorage.clear();
    });
    await page.reload({ waitUntil: "commit" });
    await page.waitForTimeout(2500);
    // Dismiss popup
    await page.locator('[role="dialog"] button').first().click({ timeout: 5000 });
    await page.waitForTimeout(500);

    // Verify tab bar exists and has 3 buttons
    const tabInfo = await page.evaluate(() => {
      const nav = document.querySelector('nav[role="navigation"]');
      if (!nav) return { exists: false };
      const buttons = Array.from(nav.querySelectorAll('button'));
      return {
        exists: true,
        buttonCount: buttons.length,
        labels: buttons.map(b => b.getAttribute('aria-label')),
        bottom: nav.getBoundingClientRect().bottom,
        viewportHeight: window.innerHeight,
      };
    });
    assert.ok(tabInfo.exists, "tab bar nav should exist");
    assert.strictEqual(tabInfo.buttonCount, 3, "tab bar should have 3 buttons");
    assert.deepStrictEqual(
      tabInfo.labels.sort(),
      ["Friends", "Me", "Play"],
      "tab buttons should be Play / Friends / Me",
    );
    // Nav should be at the bottom of the viewport
    assert.ok(
      tabInfo.bottom >= tabInfo.viewportHeight - 80,
      `tab bar should be at viewport bottom, got bottom=${tabInfo.bottom}, viewport=${tabInfo.viewportHeight}`,
    );
  });

  it("tapping Friends tab switches to feed view", async () => {
    await page.evaluate(() => {
      localStorage.clear();
      localStorage.setItem("pootbox-current-view-v1", "play");
    });
    await page.reload({ waitUntil: "commit" });
    await page.waitForTimeout(2500);
    await page.locator('[role="dialog"] button').first().click({ timeout: 5000 });
    await page.waitForTimeout(500);

    // Find the Friends tab button
    await page.locator('button[aria-label="Friends"]').first().click({ timeout: 5000 });
    await page.waitForTimeout(500);

    // The Friends view renders <Feed> with a "Friends" header
    const hasFriendsHeader = await page.locator("h1:has-text('Friends')").count();
    assert.ok(hasFriendsHeader >= 1, "Friends view should render the Friends header");
  });

  it("tapping Me tab switches to profile view", async () => {
    await page.evaluate(() => {
      localStorage.clear();
      localStorage.setItem("pootbox-current-view-v1", "play");
    });
    await page.reload({ waitUntil: "commit" });
    await page.waitForTimeout(2500);
    await page.locator('[role="dialog"] button').first().click({ timeout: 5000 });
    await page.waitForTimeout(500);

    await page.locator('button[aria-label="Me"]').first().click({ timeout: 5000 });
    await page.waitForTimeout(500);

    const hasProfileHeader = await page.locator("h1:has-text('You')").count();
    assert.ok(hasProfileHeader >= 1, "Me view should render the You header");
  });

  it("tapping Play tab returns to play view", async () => {
    // Start in profile view (no modal since dismiss key is set from
    // the previous test)
    await page.evaluate(() => {
      localStorage.setItem("pootbox-firstrun-done", "1");
      localStorage.setItem("pootbox-onboarded-v2", "1");
      localStorage.setItem("pootbox-current-view-v1", "profile");
    });
    await page.reload({ waitUntil: "commit" });
    await page.waitForTimeout(2500);

    await page.locator('button[aria-label="Play"]').first().click({ timeout: 5000 });
    await page.waitForTimeout(500);

    // Should see card grid (tap-to-play buttons)
    const cardCount = await page.locator('button[aria-label*="— tap to play"]').count();
    assert.ok(cardCount > 0, `Play view should render the card grid, got ${cardCount} cards`);
  });
});
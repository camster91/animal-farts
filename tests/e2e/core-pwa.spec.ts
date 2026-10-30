import { expect, test, type Page } from "@playwright/test";
import { BUILT_IN_SOUNDS } from "../../src/pootbox/constants";

async function openFreshApp(page: Page) {
  await page.goto("/");
  const skip = page.getByRole("button", { name: "Skip" });
  await expect(skip).toBeVisible();
  await skip.click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Let's make some noise." })).toBeVisible();
}

async function recordSound(page: Page) {
  await page.getByRole("button", { name: "Add a new sound card" }).click();
  await page.getByRole("button", { name: "Record your own sound" }).click();
  await expect(page.getByRole("button", { name: "Stop recording" })).toBeVisible();
  await page.waitForTimeout(500);
  await page.getByRole("button", { name: "Stop recording" }).click();
  await page.getByRole("button", { name: /Sound emoji/ }).first().click();
  await expect(page.getByRole("button", { name: /My Sound — tap to play/ })).toBeVisible();
  await expect(page.getByText("Sound backed up")).toBeVisible();
}

test("core record, persist, share, and delete journey", async ({ page, browser }) => {
  const pageErrors: string[] = [];
  let stage = "open";
  page.on("pageerror", (error) => pageErrors.push(`${stage}: ${error.message}`));
  await openFreshApp(page);
  await expect(page.getByRole("button", { name: "Friends", exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Me", exact: true })).toHaveCount(0);
  await recordSound(page);
  stage = "rename";
  await page.getByRole("button", { name: "Rename My Sound" }).click();
  await page.getByRole("textbox", { name: "New name for this sound" }).fill("Robot burp");
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByRole("button", { name: /Robot burp — tap to play/ })).toBeVisible();
  await page.reload();
  stage = "share";
  await expect(page.getByRole("button", { name: /Robot burp — tap to play/ })).toBeVisible();
  await page.getByRole("button", { name: "Share" }).click();
  const shareCode = page.locator("div").filter({ hasText: /^[A-Z2-9]{8}$/ }).first();
  await expect(shareCode).toBeVisible();
  const code = (await shareCode.textContent())?.trim();
  expect(code).toMatch(/^[A-Z2-9]{8}$/);
  const receiver = await browser.newContext({
    viewport: { width: 393, height: 851 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
  });
  const receiverPage = await receiver.newPage();
  let receiverStage = "open";
  receiverPage.on("pageerror", (error) => pageErrors.push(`receiver ${receiverStage}: ${error.message}`));
  await openFreshApp(receiverPage);
  receiverStage = "share";
  await receiverPage.getByRole("button", { name: "Share" }).click();
  receiverStage = "lookup mode";
  await receiverPage.getByRole("button", { name: "I have a share code" }).click();
  receiverStage = "lookup request";
  await receiverPage.getByRole("textbox", { name: "Share code" }).fill(code!);
  await receiverPage.getByRole("button", { name: "Look up" }).click();
  await expect(receiverPage.getByRole("button", { name: "Add as new page" })).toBeVisible();
  await receiver.close();
  stage = "delete";
  await page.getByRole("button", { name: "Cancel" }).click();
  await page.getByRole("button", { name: "Delete Robot burp" }).click();
  await expect(page.getByRole("button", { name: /Robot burp — tap to play/ })).toHaveCount(0);
  expect(pageErrors).toEqual([]);
});

test("mobile shell remains usable offline and explains share lookup", async ({ page, context }) => {
  await page.addInitScript(() => {
    class DeterministicAudio extends EventTarget {
      volume = 1;
      play() { return Promise.resolve(); }
      pause() {}
    }
    Object.defineProperty(window, "Audio", { configurable: true, value: DeterministicAudio });
  });
  await openFreshApp(page);
  await page.getByRole("button", { name: /tap to play/ }).first().click();
  await context.setOffline(true);
  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(page.getByText("PootBox")).toBeVisible();
  const cachedSound = page.getByRole("button", { name: /tap to play/ }).first();
  await cachedSound.click();
  await expect(page.getByRole("button", { name: /tap to stop/ }).first()).toBeVisible();
  await page.evaluate(() => {
    Object.defineProperty(navigator, "onLine", { configurable: true, get: () => false });
  });
  await page.getByRole("button", { name: "Share" }).click();
  await page.getByRole("button", { name: "I have a share code" }).click();
  await page.getByRole("textbox", { name: "Share code" }).fill("ABCD2345");
  await page.getByRole("button", { name: "Look up" }).click();
  await expect(page.getByText(/You're offline/)).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(1);
  await context.setOffline(false);
  await page.evaluate(() => {
    Object.defineProperty(navigator, "onLine", { configurable: true, get: () => true });
    window.dispatchEvent(new Event("online"));
  });
  await page.getByRole("button", { name: "Look up" }).click();
  await expect(page.getByText(/You're offline/)).toHaveCount(0);
  await expect(page.getByText(/couldn't find|not found/i)).toBeVisible();
});

test("onboarding, update prompt, and focus flows work from the keyboard", async ({ page }) => {
  await page.goto("/");
  const intro = page.getByRole("dialog", { name: "Tap to play" });
  await expect(intro).toBeVisible();
  const next = page.getByRole("button", { name: "Next" });
  await expect(next).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("dialog", { name: "Make it yours" })).toBeVisible();
  await expect(next).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);

  await page.evaluate(() => {
    navigator.serviceWorker.dispatchEvent(new Event("controllerchange"));
  });
  await expect(page.getByText("New version available")).toBeVisible();
  await page.getByRole("button", { name: "Later" }).focus();
  await page.keyboard.press("Enter");
  await expect(page.getByText("New version available")).toHaveCount(0);
});

test("primary mobile controls meet the minimum touch target", async ({ page }) => {
  await openFreshApp(page);
  const controls = page.getByRole("button");
  const count = await controls.count();
  for (let index = 0; index < count; index += 1) {
    const box = await controls.nth(index).boundingBox();
    if (!box) continue;
    expect.soft(box.width, `button ${index} width`).toBeGreaterThanOrEqual(40);
    expect.soft(box.height, `button ${index} height`).toBeGreaterThanOrEqual(40);
  }
});

test("card labels stay clear of Change controls at supported responsive widths", async ({ page }) => {
  await openFreshApp(page);

  await page.getByRole("button", { name: "Edit sounds", exact: true }).click();
  await page.getByRole("button", { name: /^Change .* sound$/ }).first().click();
  await expect(page.getByText("Pick a sound", { exact: true })).toBeVisible();
  await expect(page.getByRole("textbox", { name: "Search sounds" })).toBeVisible();
  await page.getByRole("button", { name: "Close library" }).click();

  for (const viewport of [
    { width: 320, height: 568 },
    { width: 393, height: 851 },
    { width: 768, height: 1024 },
    { width: 1440, height: 900 },
  ]) {
    await page.setViewportSize(viewport);
    await page.screenshot({ path: `.artifacts/playwright/ui-${viewport.width}.png` });
    const cards = page.locator("[data-bubble-id]");
    await expect(cards.first()).toBeVisible();

    const geometry = await cards.evaluateAll((elements) => elements.map((card) => {
      const label = card.querySelector<HTMLElement>("[data-card-label]");
      const actions = card.querySelector<HTMLElement>("[data-card-actions]");
      if (!label || !actions) return null;
      const labelRect = label.getBoundingClientRect();
      const actionRect = actions.getBoundingClientRect();
      return {
        labelBottom: labelRect.bottom,
        actionsTop: actionRect.top,
        scrollWidth: (card as HTMLElement).scrollWidth,
        clientWidth: (card as HTMLElement).clientWidth,
      };
    }));

    for (const card of geometry) {
      expect(card).not.toBeNull();
      expect.soft(card!.labelBottom, `${viewport.width}px label bottom`).toBeLessThanOrEqual(card!.actionsTop);
      expect.soft(card!.scrollWidth, `${viewport.width}px card width`).toBeLessThanOrEqual(card!.clientWidth + 1);
    }

    const pageOverflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect.soft(pageOverflow, `${viewport.width}px page overflow`).toBeLessThanOrEqual(1);
  }
});

test("soundboard browsing keeps the play surface small and editing intentional", async ({ page }) => {
  await openFreshApp(page);
  await expect(page.getByRole("button", { name: /tap to play/ })).toHaveCount(24);
  await expect(page.getByRole("button", { name: /^Change .* sound$/ })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Play", exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "Farts", exact: true }).click();
  await expect(page.getByRole("button", { name: "Farts", exact: true })).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "All sounds", exact: true }).click();
  await page.getByRole("searchbox", { name: "Find a sound" }).fill("Bear");
  await expect(page.getByRole("button", { name: /Bear — tap to play/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /Cow — tap to play/ })).toHaveCount(0);
  await page.getByRole("searchbox", { name: "Find a sound" }).fill("no-such-sound-123");
  await expect(page.getByRole("heading", { name: "No giggles found. Yet." })).toBeVisible();
  await page.getByRole("button", { name: "See all sounds", exact: true }).click();
  await page.getByRole("button", { name: /Show 24 more sounds/ }).click();
  await expect(page.getByRole("button", { name: /tap to play/ })).toHaveCount(48);
  await page.getByRole("button", { name: "Edit sounds", exact: true }).click();
  await expect(page.getByRole("button", { name: /^Change .* sound$/ })).toHaveCount(48);
  await page.getByRole("button", { name: "✓ Done", exact: true }).click();
  await expect(page.getByRole("button", { name: /^Change .* sound$/ })).toHaveCount(0);
});

test("sound replacements and additions survive a reload", async ({ page }) => {
  await openFreshApp(page);
  await page.getByRole("button", { name: "Edit sounds", exact: true }).click();
  await page.getByRole("button", { name: "Change Bear sound", exact: true }).click();
  await page.getByRole("button", { name: "Cow sound", exact: true }).click();
  const originalCard = page.locator('[data-bubble-id="b:built-in:bear"]');
  await expect(originalCard.getByRole("button", { name: /Cow — tap to play/ })).toBeVisible();
  await page.reload();
  await expect(originalCard.getByRole("button", { name: /Cow — tap to play/ })).toBeVisible();
  await page.getByRole("button", { name: "Add a new sound card" }).click();
  await page.getByRole("button", { name: "Bear sound", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Pick a sound", exact: true })).toHaveCount(0);
  await page.reload();
  await page.getByRole("searchbox", { name: "Find a sound" }).fill("Bear");
  await expect(page.getByRole("button", { name: /Bear — tap to play/ })).toBeVisible();
});

test("every bundled sound loads and decodes in Chromium", async ({ page }) => {
  test.setTimeout(90000);
  await openFreshApp(page);
  const failures = await page.evaluate(async paths => {
    const context = new AudioContext();
    const failed: string[] = [];
    try {
      for (let index = 0; index < paths.length; index += 6) {
        await Promise.all(paths.slice(index, index + 6).map(async path => {
          try {
            const response = await fetch(path);
            if (!response.ok || !response.headers.get("content-type")?.startsWith("audio/")) throw new Error(`HTTP ${response.status}`);
            const audio = await context.decodeAudioData(await response.arrayBuffer());
            if (!(audio.duration > 0 && audio.numberOfChannels > 0)) throw new Error("Empty audio");
          } catch (error) { failed.push(`${path}: ${String(error)}`); }
        }));
      }
    } finally { await context.close(); }
    return failed;
  }, BUILT_IN_SOUNDS.map(sound => sound.file));
  expect(failures).toEqual([]);
});

test("a played sound remains loadable offline through native audio range requests", async ({ page, context }) => {
  await openFreshApp(page);
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
    if (!navigator.serviceWorker.controller) await new Promise<void>(resolve => {
      navigator.serviceWorker.addEventListener("controllerchange", () => resolve(), { once: true });
    });
  });
  await page.getByRole("button", { name: /Bear — tap to play/ }).click();
  await expect.poll(() => page.evaluate(async () => {
    const response = await caches.match("/sounds/bear.mp3");
    return response?.status;
  })).toBe(200);
  await context.setOffline(true);
  const duration = await page.evaluate(() => new Promise<number>((resolve, reject) => {
    const audio = new Audio("/sounds/bear.mp3");
    audio.onloadeddata = () => { const duration = audio.duration; audio.pause(); resolve(duration); };
    audio.onerror = () => reject(new Error("Native audio failed offline"));
    audio.load();
  }));
  expect(duration).toBeGreaterThan(0);
});

test("a recorded sound remains loadable offline after upload", async ({ page, context }) => {
  await openFreshApp(page);
  const uploaded = page.waitForResponse(response => response.url().endsWith('/api/recordings') && response.request().method() === 'POST');
  await recordSound(page);
  const { audioUrl } = await (await uploaded).json() as { audioUrl: string };
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
    if (!navigator.serviceWorker.controller) await new Promise<void>(resolve => {
      navigator.serviceWorker.addEventListener("controllerchange", () => resolve(), { once: true });
    });
  });
  await page.getByRole("button", { name: /My Sound — tap to play/ }).click();
  await expect.poll(() => page.evaluate(async path => (await caches.match(path))?.status, audioUrl)).toBe(200);
  await context.setOffline(true);
  const duration = await page.evaluate(path => new Promise<number>((resolve, reject) => {
    const audio = new Audio(path);
    audio.onloadeddata = () => { const duration = audio.duration; audio.pause(); resolve(duration); };
    audio.onerror = () => reject(new Error("Recording failed offline"));
    audio.load();
  }), audioUrl);
  expect(duration).toBeGreaterThan(0);
});

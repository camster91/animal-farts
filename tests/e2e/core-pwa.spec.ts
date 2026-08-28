import { expect, test, type Page } from "@playwright/test";

async function openFreshApp(page: Page) {
  await page.goto("/");
  const skip = page.getByRole("button", { name: "Skip" });
  await expect(skip).toBeVisible();
  await skip.click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Play", exact: true })).toHaveAttribute("aria-current", "page");
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
  await openFreshApp(page);
  await page.getByRole("button", { name: /tap to play/ }).first().click();
  await context.setOffline(true);
  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(page.getByText("PootBox")).toBeVisible();
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

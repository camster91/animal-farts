import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  outputDir: ".artifacts/playwright/results",
  timeout: 45_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI
    ? [["line"], ["html", { outputFolder: ".artifacts/playwright/report", open: "never" }]]
    : "list",
  use: {
    ...devices["Pixel 5"],
    baseURL: "http://127.0.0.1:5290",
    headless: true,
    permissions: ["microphone"],
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    launchOptions: {
      args: ["--use-fake-device-for-media-stream", "--use-fake-ui-for-media-stream"],
    },
  },
  webServer: {
    command: "node scripts/serve-e2e.mjs",
    url: "http://127.0.0.1:5290/api/health",
    reuseExistingServer: false,
    timeout: 30_000,
  },
});

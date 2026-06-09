// Playwright test suite for PootBox
// Run with: npm run test:e2e
// Requires: npx playwright install --with-deps chromium
//
// For CI/local dev without browser deps, use node --test instead:
//   node --test tests/unit-*.test.mjs

import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  timeout: 30_000,
  retries: 2,
  use: {
    baseURL: 'http://localhost:5173',
    headless: true,
  },
  webServer: {
    command: 'npm run dev',
    port: 5173,
    reuseExistingServer: true,
    timeout: 15_000,
  },
  projects: [
    {
      name: 'local',
      use: { baseURL: 'http://localhost:5173' },
    },
    {
      name: 'production',
      use: { baseURL: 'https://animals.ashbi.ca' },
    },
  ],
});
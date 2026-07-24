import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/smoke',
  testMatch: '**/ml-p1-s8-remediation-mobile-e2e.spec.js',
  timeout: 240 * 1000,
  expect: { timeout: 15 * 1000 },
  reporter: [['list']],
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL || 'https://app.bhfos.com',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  workers: 1,
});

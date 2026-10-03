import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/finance',
  timeout: 120000,
  expect: { timeout: 20000 },
  reporter: [['line']],
  use: {
    baseURL: 'http://127.0.0.1:4173',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'off',
  },
  webServer: {
    command: 'npm run dev -- --host 127.0.0.1 --port 4173',
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: false,
    timeout: 120000,
  },
  workers: 1,
});

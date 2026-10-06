import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/finance',
  testMatch: 'readonly-controls.spec.js',
  timeout: 120000,
  expect: { timeout: 20000 },
  reporter: [['line'], ['json', { outputFile: 'test-results/finance-readonly.json' }]],
  use: {
    baseURL: 'http://127.0.0.1:4174',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'off',
  },
  webServer: {
    command: 'npm run build:local && npx vite preview --host 127.0.0.1 --port 4174 --strictPort',
    url: 'http://127.0.0.1:4174',
    reuseExistingServer: false,
    timeout: 180000,
  },
  workers: 1,
});

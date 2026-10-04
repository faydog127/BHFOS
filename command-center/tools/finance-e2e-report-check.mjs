/**
 * Fail closed when the Finance Playwright JSON report is missing,
 * records a skip, or records fewer than the five Finance specs.
 * test.skip cannot turn the release job green.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const file = path.join(root, 'test-results/finance-playwright.json');

let report;
try {
  report = JSON.parse(readFileSync(file, 'utf8'));
} catch {
  console.error('Finance Playwright JSON report is missing. The gate fails closed.');
  process.exit(1);
}

const skipped = Number(report?.stats?.skipped || 0);
const passed = Number(report?.stats?.expected || 0);
if (skipped > 0 || passed < 5) {
  console.error(`Finance Playwright gate failed closed: passed=${passed} skipped=${skipped}.`);
  process.exit(1);
}

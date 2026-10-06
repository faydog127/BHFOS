/**
 * Production preview keeps Finance writes off. New month and Create plan
 * stay disabled, and a forced click does not write.
 * The loopback mock does not prove server authorization.
 */
import { execFileSync } from 'node:child_process';
import { test, expect } from '@playwright/test';

function resetMock() {
  const raw = process.env.VITE_SUPABASE_URL || '';
  if (!raw) return;
  let url;
  try {
    url = new URL(raw);
  } catch {
    throw new Error('VITE_SUPABASE_URL is not a URL. Do not point it at a remote project.');
  }
  if (!['127.0.0.1', 'localhost', '::1'].includes(url.hostname)) {
    throw new Error('VITE_SUPABASE_URL must be a loopback URL. Do not point it at a remote project.');
  }
  const port = process.env.FINANCE_MOCK_PORT || (url.port === '54921' ? url.port : '');
  if (!port) return;
  execFileSync('curl', ['-sf', '-X', 'POST', `http://127.0.0.1:${port}/mock/reset`], { stdio: 'pipe' });
}

test.beforeAll(() => {
  resetMock();
});

test('read-only build disables New month and plan writes', async ({ page }) => {
  test.setTimeout(120000);
  if (!process.env.FINANCE_CHECKIN_EMAIL || !process.env.FINANCE_CHECKIN_PASSWORD) {
    throw new Error('FINANCE_CHECKIN_EMAIL and FINANCE_CHECKIN_PASSWORD are required. The release gate supplies synthetic local credentials. This spec does not skip.');
  }
  const shots = process.env.FINANCE_NAV_SHOTS || '/opt/cursor/artifacts/finance-gate-s-corrective-r3/playwright';
  const writes = [];
  page.on('request', (request) => {
    const url = request.url();
    if (request.method() === 'POST' && /finance_plans|finance_monthly_actuals|finance_approve|finance_open_draft/.test(url)) {
      writes.push(`${request.method()} ${url}`);
    }
  });
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('/tvg/login?next=%2Ftvg%2Ffinance');
  await page.locator('#email').fill(process.env.FINANCE_CHECKIN_EMAIL);
  await page.locator('#password').fill(process.env.FINANCE_CHECKIN_PASSWORD);
  await page.locator('button[type="submit"]').click();
  await page.waitForURL('**/finance');
  await expect(page.getByTestId('finance-writes-disabled')).toHaveText('Finance writes are disabled. This screen is read-only.');
  const create = page.getByTestId('finance-create-plan');
  await expect(create).toBeDisabled();
  await create.click({ force: true });
  await page.screenshot({ path: `${shots}/readonly-plan.png`, fullPage: true });

  await page.goto('/tvg/finance/checkin');
  await expect(page.getByTestId('finance-checkin')).toBeVisible();
  const newer = page.getByTestId('checkin-new');
  await expect(newer).toBeDisabled();
  await expect(newer).toHaveText('New month');
  await newer.click({ force: true });
  await expect(page.getByTestId('checkin-empty')).toBeVisible();
  expect(writes).toEqual([]);
  await page.screenshot({ path: `${shots}/readonly-new-month.png`, fullPage: true });
});

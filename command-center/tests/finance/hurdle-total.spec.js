/**
 * The screen rejects a hurdle total of exactly 1, including 0.7+0.2+0.1+0.
 * Blank hurdles and a blank required revenue do not exempt the stage.
 * The loopback mock mirrors the client. It does not prove server authorization.
 */
import { execFileSync } from 'node:child_process';
import { test, expect } from '@playwright/test';

function seedBlankDraft() {
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
  execFileSync('curl', ['-sf', '-X', 'POST', `http://127.0.0.1:${port}/mock/seed-blank-draft`], { stdio: 'pipe' });
}

test.beforeAll(() => {
  seedBlankDraft();
});

test('a hurdle total of exactly 1 is refused in plain language', async ({ page }) => {
  test.setTimeout(120000);
  if (!process.env.FINANCE_CHECKIN_EMAIL || !process.env.FINANCE_CHECKIN_PASSWORD) {
    throw new Error('FINANCE_CHECKIN_EMAIL and FINANCE_CHECKIN_PASSWORD are required. The release gate supplies synthetic local credentials. This spec does not skip.');
  }
  const shots = process.env.FINANCE_NAV_SHOTS || '/opt/cursor/artifacts/finance-gate-s-corrective-r3/playwright';
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('/tvg/login?next=%2Ftvg%2Ffinance');
  await page.locator('#email').fill(process.env.FINANCE_CHECKIN_EMAIL);
  await page.locator('#password').fill(process.env.FINANCE_CHECKIN_PASSWORD);
  await page.locator('button[type="submit"]').click();
  await page.waitForURL('**/finance');
  await expect(page.getByTestId('finance-approve')).toBeDisabled();
  await expect(page.getByTestId('finance-approve-block')).toContainText('Enter every retention hurdle on all four stages before approving.');
  await expect(page.getByTestId('finance-validation')).toContainText('must total less than 1');

  await page.getByRole('navigation', { name: 'Planning sections' }).getByRole('link', { name: 'Growth & Protection' }).click();
  await expect(page).toHaveURL(/\/finance\/growth$/);
  const stages = ['stage_0', 'stage_1', 'stage_2', 'stage_3'];
  const fields = ['operating-profit', 'growth-reserve', 'bad-debt', 'contingency'];
  const stage0 = ['0.7', '0.2', '0.1', '0'];
  for (const stage of stages) {
    for (const [index, field] of fields.entries()) {
      const value = stage === 'stage_0' ? stage0[index] : '0';
      await page.getByTestId(`finance-hurdle-${stage}-${field}`).fill(value);
    }
  }
  await expect(page.getByTestId('finance-approve')).toBeDisabled();
  await expect(page.getByTestId('finance-approve-block')).toContainText('exactly 1 is not allowed, even when required revenue is blank');
  await expect(page.getByTestId('finance-approve-block')).not.toContainText('23514');
  await expect(page.getByTestId('finance-growth')).toContainText('Required revenue --');
  await page.screenshot({ path: `${shots}/hurdle-total-exactly-one.png`, fullPage: true });
});

/**
 * The server can refuse an approve the screen thought was allowed.
 * The screen must say so in plain language and leave the draft in place.
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

async function fillZeroRetentionHurdles(page) {
  await page.getByRole('navigation', { name: 'Planning sections' }).getByRole('link', { name: 'Growth & Protection' }).click();
  await expect(page).toHaveURL(/\/finance\/growth$/);
  const stages = ['stage_0', 'stage_1', 'stage_2', 'stage_3'];
  const fields = ['operating-profit', 'growth-reserve', 'bad-debt', 'contingency'];
  for (const stage of stages) {
    for (const field of fields) {
      await page.getByTestId(`finance-hurdle-${stage}-${field}`).fill('0');
    }
  }
}

test('server approve refusal stays a draft and does not show the SQLSTATE', async ({ page }) => {
  test.setTimeout(120000);
  if (!process.env.FINANCE_CHECKIN_EMAIL || !process.env.FINANCE_CHECKIN_PASSWORD) {
    throw new Error('FINANCE_CHECKIN_EMAIL and FINANCE_CHECKIN_PASSWORD are required. The release gate supplies synthetic local credentials. This spec does not skip.');
  }
  const shots = process.env.FINANCE_NAV_SHOTS || '/opt/cursor/artifacts/finance-gate-s-corrective/playwright';
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('/tvg/login?next=%2Ftvg%2Ffinance');
  await page.locator('#email').fill(process.env.FINANCE_CHECKIN_EMAIL);
  await page.locator('#password').fill(process.env.FINANCE_CHECKIN_PASSWORD);
  await page.locator('button[type="submit"]').click();
  await page.waitForURL('**/finance');
  const create = page.getByTestId('finance-create-plan');
  if (await create.count()) await create.click();
  const notes = page.locator('textarea');
  await expect(notes).toBeVisible();
  await notes.fill('refuse-approve');
  await fillZeroRetentionHurdles(page);
  await page.getByTestId('finance-save').click();
  await expect(page.getByTestId('finance-approve')).toBeEnabled();
  await page.getByTestId('finance-approve').click();
  await expect(page.getByTestId('finance-save-error')).toHaveText('Approve is blocked until the validation message is clear.');
  await expect(page.getByTestId('finance-save-error')).not.toContainText('23514');
  await expect(page.getByTestId('plan-banner')).toContainText('draft');
  await expect(notes).toHaveValue('refuse-approve');
  await page.screenshot({ path: `${shots}/server-approve-refusal.png`, fullPage: true });
});

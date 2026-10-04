/**
 * Real key presses plus a browser history traversal (page.goBack), not
 * page.evaluate(history.back()). A canceled traverse never loads, so
 * Playwright's goBack wait times out while the Stay dialog is already up.
 * That timeout is the hold. A traversal that actually leaves Finance fails
 * the dialog and URL assertions below.
 */
import { test, expect } from '@playwright/test';

const note = 'unsaved key note';

async function browserBack(page) {
  const dialog = page.getByTestId('finance-leave-dialog');
  const traversal = page.goBack({ timeout: 2500 }).then(() => 'committed').catch((error) => error);
  await expect(dialog).toBeVisible();
  await expect(page).toHaveURL(/\/tvg\/finance\/?$/);
  const outcome = await traversal;
  if (outcome instanceof Error && !/Timeout/.test(outcome.message)) throw outcome;
}

test('real Back after Esc keeps the unsaved Guided edit', async ({ page }) => {
  test.setTimeout(120000);
  if (!process.env.FINANCE_CHECKIN_EMAIL || !process.env.FINANCE_CHECKIN_PASSWORD) {
    throw new Error('FINANCE_CHECKIN_EMAIL and FINANCE_CHECKIN_PASSWORD are required. The release gate supplies synthetic local credentials. This spec does not skip.');
  }
  const writes = [];
  page.on('request', (request) => {
    const method = request.method();
    if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') return;
    if (request.url().includes('/auth/v1/token')) return;
    if (request.url().includes('/rpc/check_is_superuser')) return;
    writes.push(`${method} ${request.url()}`);
  });

  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('/tvg/login?next=%2Ftvg%2Ffinance');
  await page.locator('#email').fill(process.env.FINANCE_CHECKIN_EMAIL);
  await page.locator('#password').fill(process.env.FINANCE_CHECKIN_PASSWORD);
  await page.locator('button[type="submit"]').click();
  await page.waitForURL('**/finance');
  const create = page.getByTestId('finance-create-plan');
  if (await create.count()) {
    await create.click();
  }
  const notes = page.locator('textarea');
  await expect(notes).toBeVisible();
  await page.evaluate(() => {
    const financeUrl = `${window.location.pathname}${window.location.search}${window.location.hash}`;
    history.pushState({ financeHold: true }, '', '/tvg/crm/dashboard');
    history.pushState({ financeHold: true }, '', financeUrl);
  });
  await notes.click();
  await page.keyboard.press('Control+A');
  await page.keyboard.type(note);
  await expect(notes).toHaveValue(note);
  await expect(page.locator('html')).toHaveAttribute('data-finance-leave-guard', 'on');

  await browserBack(page);
  await expect(page.getByTestId('finance-leave-dialog')).toBeVisible();
  await expect(page).toHaveURL(/\/tvg\/finance\/?$/);
  await expect(notes).toHaveValue(note);
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('finance-leave-dialog')).toHaveCount(0);
  await expect(notes).toHaveValue(note);

  await browserBack(page);
  await expect(page.getByTestId('finance-leave-dialog')).toBeVisible();
  await expect(page).toHaveURL(/\/tvg\/finance\/?$/);
  await expect(notes).toHaveValue(note);
  await page.getByTestId('finance-leave-stay').click();
  await expect(page.getByTestId('finance-leave-dialog')).toHaveCount(0);
  await expect(notes).toHaveValue(note);

  await browserBack(page);
  await expect(page.getByTestId('finance-leave-dialog')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('finance-leave-dialog')).toHaveCount(0);
  await expect(notes).toHaveValue(note);

  await browserBack(page);
  await expect(page.getByTestId('finance-leave-dialog')).toBeVisible();
  await expect(page).toHaveURL(/\/tvg\/finance\/?$/);
  await expect(notes).toHaveValue(note);
  await expect(page.getByTestId('finance-leave-stay')).toBeFocused();
  await page.getByTestId('finance-leave-discard').click();
  await expect(page.getByTestId('finance-leave-dialog')).toHaveCount(0);
  await expect(page.getByTestId('finance-shell')).toHaveCount(0);
  await expect(page).not.toHaveURL(/\/finance/);
  expect(writes).toEqual([]);
});

test('plain anchor Enter is held when the Navigation API is absent', async ({ page }) => {
  test.setTimeout(120000);
  if (!process.env.FINANCE_CHECKIN_EMAIL || !process.env.FINANCE_CHECKIN_PASSWORD) {
    throw new Error('FINANCE_CHECKIN_EMAIL and FINANCE_CHECKIN_PASSWORD are required. The release gate supplies synthetic local credentials. This spec does not skip.');
  }
  const dialogs = [];
  page.on('dialog', (dialog) => {
    dialogs.push(`${dialog.type()}:${dialog.message()}`);
    dialog.accept().catch(() => {});
  });
  const writes = [];
  page.on('request', (request) => {
    const method = request.method();
    if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') return;
    if (request.url().includes('/auth/v1/token')) return;
    if (request.url().includes('/rpc/check_is_superuser')) return;
    writes.push(`${method} ${request.url()}`);
  });
  await page.addInitScript(() => {
    Object.defineProperty(window, 'navigation', { value: undefined, configurable: true });
  });
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
  await notes.click();
  await page.keyboard.press('Control+A');
  await page.keyboard.type(note);
  await expect(notes).toHaveValue(note);
  await expect(page.locator('html')).toHaveAttribute('data-finance-leave-guard', 'on');
  expect(await page.evaluate(() => window.navigation)).toBeUndefined();
  await page.evaluate(() => {
    const anchor = document.createElement('a');
    anchor.href = '/tvg/crm/dashboard';
    anchor.id = 'out-a';
    anchor.textContent = 'out-a';
    anchor.setAttribute('data-testid', 'out-a');
    document.body.appendChild(anchor);
  });
  await page.getByTestId('out-a').focus();
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('finance-leave-dialog')).toBeVisible();
  await expect(page).toHaveURL(/\/tvg\/finance\/?$/);
  expect(dialogs.some((entry) => entry.startsWith('beforeunload'))).toBe(false);
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('finance-leave-dialog')).toHaveCount(0);
  await expect(notes).toHaveValue(note);
  await page.getByTestId('out-a').focus();
  await page.keyboard.press('Control+Enter');
  await expect(page.getByTestId('finance-leave-dialog')).toHaveCount(0);
  await expect(page).toHaveURL(/\/tvg\/finance\/?$/);
  await page.getByTestId('out-a').focus();
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('finance-leave-dialog')).toBeVisible();
  await expect(page.getByTestId('finance-leave-stay')).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(page.getByTestId('finance-leave-discard')).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('finance-leave-dialog')).toHaveCount(0);
  await expect(page).toHaveURL(/\/tvg\/crm\/dashboard/);
  await expect(page.locator('html')).not.toHaveAttribute('data-finance-leave-guard', 'on');
  expect(writes).toEqual([]);
});

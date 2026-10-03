/**
 * Local Monthly Check-In evidence. Synthetic values only.
 * Screenshots are written outside the repository.
 * Requires FINANCE_CHECKIN_EMAIL and FINANCE_CHECKIN_PASSWORD in the environment.
 */
import { test, expect } from '@playwright/test';
import { mkdirSync } from 'node:fs';

const out = process.env.FINANCE_CHECKIN_SHOTS || '/opt/cursor/artifacts/finance-stage-b';

test.beforeAll(() => {
  mkdirSync(out, { recursive: true });
});

async function shot(page, name) {
  await page.screenshot({ path: `${out}/${name}.png`, fullPage: true });
}

async function assertNoDocumentOverflow(page) {
  const widths = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    innerWidth: window.innerWidth,
  }));
  console.log(`CHECKIN_WIDTH scrollWidth=${widths.scrollWidth} innerWidth=${widths.innerWidth}`);
  expect(widths.scrollWidth).toBeLessThanOrEqual(widths.innerWidth);
  return widths;
}

async function assertModeSwitchWritesNothing(page) {
  const writes = [];
  const onRequest = (request) => {
    const method = request.method();
    if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') return;
    const url = request.url();
    if (url.includes('/auth/v1/token')) return;
    writes.push(`${method} ${url}`);
  };
  page.on('request', onRequest);
  await page.getByTestId('finance-mode-executive').click();
  await page.getByTestId('finance-mode-advanced').click();
  await page.getByTestId('finance-mode-guided').click();
  await page.waitForTimeout(400);
  page.off('request', onRequest);
  expect(writes).toEqual([]);
}

async function cycleModes(page, prefix) {
  await page.setViewportSize({ width: 1280, height: 900 });
  await expect(page.getByTestId('finance-mode')).toHaveAttribute('data-mode', 'guided');
  await shot(page, `${prefix}-guided-desktop`);
  await page.getByTestId('finance-mode-executive').click();
  await expect(page.getByTestId('finance-mode')).toHaveAttribute('data-mode', 'executive');
  await expect(page.getByTestId('canonical-required-revenue')).toBeVisible();
  const required = await page.getByTestId('canonical-required-revenue').innerText();
  await shot(page, `${prefix}-executive-desktop`);
  await page.getByTestId('finance-mode-advanced').click();
  await expect(page.getByTestId('finance-mode')).toHaveAttribute('data-mode', 'advanced');
  await expect(page.getByTestId('canonical-required-revenue')).toHaveText(required);
  if (prefix === 'empty') await expect(page.getByTestId('advanced-cost-chart-empty')).toHaveText('No data');
  await shot(page, `${prefix}-advanced-desktop`);
  await page.setViewportSize({ width: 390, height: 844 });
  await shot(page, `${prefix}-advanced-mobile`);
  await page.getByTestId('finance-mode-executive').click();
  await expect(page.getByTestId('canonical-required-revenue')).toHaveText(required);
  const editBox = await page.getByTestId('finance-edit-in-guided').boundingBox();
  expect(editBox.height).toBeGreaterThanOrEqual(44);
  await shot(page, `${prefix}-executive-mobile`);
  await page.getByTestId('finance-mode-guided').click();
  await expect(page.getByTestId('canonical-required-revenue')).toHaveText(required);
  await shot(page, `${prefix}-guided-mobile`);
  await page.setViewportSize({ width: 1280, height: 900 });
  await expect(page.getByRole('tab')).toHaveCount(3);
}

test('monthly check-in entry, history, and comparison basis', async ({ page }) => {
  test.setTimeout(300000);
  test.skip(!process.env.FINANCE_CHECKIN_EMAIL || !process.env.FINANCE_CHECKIN_PASSWORD, 'local check-in credentials were not provided');
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('/tvg/login?next=%2Ftvg%2Ffinance%2Fcheckin');
  await page.locator('#email').fill(process.env.FINANCE_CHECKIN_EMAIL);
  await page.locator('#password').fill(process.env.FINANCE_CHECKIN_PASSWORD);
  await page.locator('button[type="submit"]').click();
  await page.waitForURL('**/finance/checkin');
  await expect(page.getByTestId('finance-checkin')).toBeVisible();
  await expect(page.getByTestId('finance-mode')).toHaveCount(0);
  await expect(page.getByTestId('checkin-empty')).toBeVisible();
  await expect(page.getByTestId('checkin-no-plan')).toBeVisible();
  await expect(page.getByTestId('checkin-revenue-definition')).toContainText('not the invoices issued');
  await page.screenshot({ path: `${out}/desktop-empty-no-plan.png`, fullPage: true });

  await page.getByTestId('checkin-month').fill('2026-01');
  await page.getByTestId('checkin-total-revenue').fill('3.10');
  await page.getByTestId('checkin-direct-residential-revenue').fill('1.00');
  await page.getByTestId('checkin-commercial-direct-revenue').fill('1.05');
  await page.getByTestId('checkin-portal-revenue').fill('1.05');
  await page.getByTestId('checkin-cash-reserve').fill('0.00');
  await page.getByTestId('checkin-total-jobs').fill('2');
  await page.getByTestId('checkin-productive-unit-hours').fill('1.50');
  await page.getByTestId('checkin-source-note').fill('synthetic manual entry');
  await page.getByTestId('checkin-save').click();
  await expect(page.getByTestId('checkin-history-2026-01')).toBeVisible();
  await expect(page.getByTestId('checkin-actual-total-revenue')).toHaveText('$3.10');
  await expect(page.getByTestId('checkin-actual-cash-reserve')).toHaveText('$0.00');
  await expect(page.getByTestId('checkin-actual-field-payroll')).toHaveText('--');
  await expect(page.getByTestId('checkin-plan-total-revenue')).toHaveText('--');
  await expect(page.getByTestId('checkin-variance-total-revenue')).toHaveText('--');
  await page.screenshot({ path: `${out}/desktop-entry-null-zero-cents.png`, fullPage: true });

  await page.reload();
  await page.getByTestId('checkin-history-2026-01').click();
  await expect(page.getByTestId('checkin-total-revenue')).toHaveValue('3.10');
  await expect(page.getByTestId('checkin-cash-reserve')).toHaveValue('0.00');
  await expect(page.getByTestId('checkin-field-payroll')).toHaveValue('');
  await expect(page.getByTestId('checkin-source-note')).toHaveValue('synthetic manual entry');
  await page.screenshot({ path: `${out}/desktop-history.png`, fullPage: true });

  await page.goto('/tvg/finance');
  await expect(page.getByTestId('finance-empty')).toBeVisible();
  await expect(page.getByTestId('finance-mode-guided')).toBeVisible();
  await expect(page.getByTestId('finance-mode-executive')).toBeVisible();
  await expect(page.getByTestId('finance-mode-advanced')).toBeVisible();
  await assertModeSwitchWritesNothing(page);
  await cycleModes(page, 'empty');
  await expect(page.getByTestId('finance-create-plan')).toBeVisible();
  await page.getByTestId('finance-create-plan').click();
  await expect(page.getByTestId('finance-monthly-basis')).toBeVisible();
  await expect(page.getByTestId('finance-guided-brief')).toBeVisible();
  await expect(page.getByTestId('guided-what')).toBeVisible();
  await expect(page.getByTestId('guided-result')).toBeVisible();
  await assertModeSwitchWritesNothing(page);
  await cycleModes(page, 'incomplete');
  await expect(page.getByTestId('finance-monthly-basis')).toBeVisible();
  await expect(page.getByTestId('finance-basis-total-revenue')).toHaveValue('');
  await page.getByTestId('finance-approve').click();
  await expect(page.getByTestId('plan-banner')).toContainText('approved');
  await page.goto('/tvg/finance/checkin');
  await page.getByTestId('checkin-history-2026-01').click();
  await page.getByTestId('checkin-associate').click();
  await expect(page.getByTestId('checkin-basis')).toContainText('locked');
  await expect(page.getByTestId('checkin-plan-total-revenue')).toHaveText('--');
  await expect(page.getByTestId('checkin-variance-total-revenue')).toHaveText('--');
  await expect(page.getByTestId('checkin-partial-basis')).toBeVisible();
  await expect(page.getByTestId('checkin-no-monthly-basis')).toHaveCount(0);
  await page.screenshot({ path: `${out}/desktop-plan-associated.png`, fullPage: true });

  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: `${out}/mobile-checkin.png`, fullPage: true });
  await assertNoDocumentOverflow(page);

  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('/tvg/finance');
  await page.getByTestId('finance-new-draft').click();
  await expect(page.getByTestId('finance-monthly-basis')).toBeVisible();
  const basisRevenue = page.getByTestId('finance-basis-total-revenue');
  await basisRevenue.click();
  await basisRevenue.pressSequentially('10.50');
  await expect(basisRevenue).toHaveValue('10.50');
  const dirtyWrites = [];
  const onDirtyRequest = (request) => {
    const method = request.method();
    if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') return;
    if (request.url().includes('/auth/v1/token')) return;
    dirtyWrites.push(`${method} ${request.url()}`);
  };
  page.on('request', onDirtyRequest);
  await page.getByTestId('finance-mode-executive').click();
  await expect(page.getByTestId('finance-unsaved-in-readonly-mode')).toContainText('These figures include unsaved edits');
  await expect(page.getByTestId('finance-save')).toHaveCount(0);
  await shot(page, 'dirty-executive-desktop');
  await page.setViewportSize({ width: 390, height: 844 });
  await shot(page, 'dirty-executive-mobile');
  const dirtyBanner = await page.getByTestId('finance-unsaved-in-readonly-mode').getByRole('button', { name: 'Open Guided' }).boundingBox();
  expect(dirtyBanner.height).toBeGreaterThanOrEqual(44);
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.getByTestId('finance-mode-advanced').click();
  await expect(page.getByTestId('finance-unsaved-in-readonly-mode')).toContainText('These figures include unsaved edits');
  await page.getByRole('button', { name: 'Open Guided' }).click();
  await expect(page.getByTestId('finance-basis-total-revenue')).toHaveValue(/^10\.50?$/);
  await page.waitForTimeout(400);
  page.off('request', onDirtyRequest);
  expect(dirtyWrites).toEqual([]);
  await page.getByTestId('finance-basis-cash-reserve').fill('0.00');
  const saveDone = page.waitForResponse((res) => res.url().includes('/finance_plans') && res.request().method() === 'PATCH' && res.ok());
  await page.getByTestId('finance-save').click();
  await saveDone;
  await expect(page.getByTestId('finance-save-error')).toHaveCount(0);
  const approveDone = page.waitForResponse((res) => res.url().includes('finance_approve_plan') && res.ok());
  await page.getByTestId('finance-approve').click();
  await approveDone;
  await expect(page.getByTestId('plan-banner')).toContainText('approved');

  await page.goto('/tvg/finance/checkin');
  await page.getByTestId('checkin-new').click();
  await page.getByTestId('checkin-month').fill('2026-02');
  await page.getByTestId('checkin-total-revenue').fill('4.00');
  await page.getByTestId('checkin-cash-reserve').fill('0.00');
  await page.getByTestId('checkin-total-jobs').fill('2');
  await page.getByTestId('checkin-associate-on-create').check();
  await page.getByTestId('checkin-save').click();
  await expect(page.getByTestId('checkin-history-2026-02')).toBeVisible();
  await expect(page.getByTestId('checkin-partial-basis')).toBeVisible();
  await expect(page.getByTestId('checkin-no-monthly-basis')).toHaveCount(0);
  await expect(page.getByTestId('checkin-plan-total-revenue')).toHaveText('$10.50');
  await expect(page.getByTestId('checkin-plan-cash-reserve')).toHaveText('$0.00');
  await expect(page.getByTestId('checkin-plan-total-jobs')).toHaveText('--');
  await expect(page.getByTestId('checkin-variance-total-revenue')).toHaveText('-$6.50');
  await expect(page.getByTestId('checkin-variance-cash-reserve')).toHaveText('$0.00');
  await expect(page.getByTestId('checkin-variance-total-jobs')).toHaveText('--');
  await page.screenshot({ path: `${out}/desktop-partial-basis.png`, fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: `${out}/mobile-partial-basis.png`, fullPage: true });
  await assertNoDocumentOverflow(page);

  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('/tvg/finance');
  await expect(page.getByTestId('finance-shell')).toHaveAttribute('data-mode', 'guided');
  await assertModeSwitchWritesNothing(page);
  await page.getByTestId('finance-mode-executive').click();
  await page.getByRole('navigation', { name: 'Planning sections' }).getByRole('link', { name: 'Monthly Check-In' }).click();
  await expect(page).toHaveURL(/\/finance\/checkin$/);
  await expect(page.getByTestId('finance-mode')).toHaveCount(0);
  await expect(page.getByTestId('finance-header-copy')).toContainText('What this section is, what you can change, and what the formulas return.');
  await expect(page.getByTestId('finance-header-copy')).not.toContainText('Switching mode does not save');
  await shot(page, 'checkin-after-executive-desktop');
  await page.setViewportSize({ width: 390, height: 844 });
  await shot(page, 'checkin-after-executive-mobile');
  await assertNoDocumentOverflow(page);
  await page.locator('aside label select').selectOption('');
  await expect(page).toHaveURL(/\/finance$/);
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.getByTestId('finance-mode-executive').click();
  await expect(page.getByTestId('finance-shell')).toHaveAttribute('data-mode', 'executive');
  await expect(page.getByTestId('finance-save')).toHaveCount(0);
  await expect(page.getByTestId('finance-unsaved-in-readonly-mode')).toHaveCount(0);
  await expect(page.getByTestId('finance-edit-in-guided')).toContainText('approved plan: use New draft to edit');
  await expect(page.getByTestId('finance-approve')).toHaveCount(0);
  await expect(page.getByTestId('decision-latest-month')).toHaveText('2026-02');
  await expect(page.getByTestId('decision-basis-state')).toContainText('blank plan figure is not zero');
  await expect(page.getByTestId('decision-plan-total-revenue')).toHaveText('$10.50');
  await expect(page.getByTestId('decision-actual-total-revenue')).toHaveText('$4.00');
  await expect(page.getByTestId('decision-variance-total-revenue')).toHaveText('-$6.50');
  await expect(page.getByTestId('decision-plan-cash-reserve')).toHaveText('$0.00');
  await expect(page.getByTestId('decision-actual-cash-reserve')).toHaveText('$0.00');
  await expect(page.getByTestId('decision-plan-total-jobs')).toHaveText('--');
  await expect(page.getByTestId('decision-actual-field-payroll')).toHaveText('--');
  await expect(page.getByTestId('finance-unconnected')).toContainText('unavailable / not connected');
  await expect(page.getByTestId('finance-unconnected')).toContainText('not earned operating revenue');
  await page.getByTestId('finance-mode-advanced').click();
  await expect(page.getByTestId('history-2026-02-plan-total-revenue')).toHaveText('$10.50');
  await expect(page.getByTestId('history-2026-02-actual-total-revenue')).toHaveText('$4.00');
  await expect(page.getByTestId('history-2026-02-variance-total-revenue')).toHaveText('-$6.50');
  await expect(page.getByTestId('history-2026-02-plan-cash-reserve')).toHaveText('$0.00');
  await expect(page.getByTestId('history-2026-02-plan-total-jobs')).toHaveText('--');
  await expect(page.getByTestId('history-2026-01-plan-total-revenue')).toHaveText('--');
  await expect(page.getByTestId('history-2026-01-variance-total-revenue')).toHaveText('--');
  await expect(page.getByTestId('history-2026-01-actual-cash-reserve')).toHaveText('$0.00');
  await expect(page.getByTestId('decision-plan-total-revenue')).toHaveCount(0);
  await page.getByTestId('finance-mode-guided').click();
  await expect(page.getByTestId('finance-monthly-basis')).toHaveCount(0);
  await cycleModes(page, 'populated');
  await page.goto('/tvg/finance/checkin');
  await expect(page.getByTestId('finance-mode')).toHaveCount(0);
  await page.getByTestId('checkin-history-2026-01').click();
  await expect(page.getByTestId('checkin-plan-total-revenue')).toHaveText('--');
  await expect(page.getByTestId('checkin-variance-total-revenue')).toHaveText('--');
  await expect(page.getByTestId('checkin-partial-basis')).toBeVisible();
  await expect(page.getByTestId('checkin-no-monthly-basis')).toHaveCount(0);
  await page.screenshot({ path: `${out}/desktop-historical-locked-basis.png`, fullPage: true });

  await page.goto('/tvg/finance');
  await page.getByTestId('finance-new-draft').click();
  await expect(page.getByTestId('finance-save')).toBeVisible();
  const other = await page.context().newPage();
  await other.goto('/tvg/finance');
  await expect(other.getByTestId('finance-save')).toBeVisible();
  await other.locator('textarea').fill('server note');
  const otherSave = other.waitForResponse((res) => res.url().includes('/finance_plans') && res.request().method() === 'PATCH' && res.ok());
  await other.getByTestId('finance-save').click();
  await otherSave;
  await other.close();
  await page.getByTestId('finance-approve').click();
  await expect(page.getByTestId('finance-version-conflict')).toBeVisible();
  await expect(page.getByTestId('finance-version-conflict')).not.toContainText('unsaved edits');
  await page.getByTestId('finance-mode-executive').click();
  await expect(page.getByTestId('finance-unsaved-in-readonly-mode')).toContainText('Return to Guided to reload the latest plan');
  await expect(page.getByTestId('finance-unsaved-in-readonly-mode')).not.toContainText('unsaved edits');
  await shot(page, 'conflict-clean-executive-desktop');
  await page.setViewportSize({ width: 390, height: 844 });
  await shot(page, 'conflict-clean-executive-mobile');
  const cleanBanner = await page.getByTestId('finance-unsaved-in-readonly-mode').getByRole('button', { name: 'Open Guided' }).boundingBox();
  expect(cleanBanner.height).toBeGreaterThanOrEqual(44);
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.getByRole('button', { name: 'Open Guided' }).click();
  await expect(page.getByTestId('finance-version-conflict')).toBeVisible();
  await page.getByTestId('finance-reload').click();
  await expect(page.getByTestId('finance-version-conflict')).toHaveCount(0);
  await expect(page.locator('textarea')).toHaveValue('server note');
  const later = await page.context().newPage();
  await later.goto('/tvg/finance');
  await expect(later.getByTestId('finance-save')).toBeVisible();
  await later.locator('textarea').fill('server note 2');
  const laterSave = later.waitForResponse((res) => res.url().includes('/finance_plans') && res.request().method() === 'PATCH' && res.ok());
  await later.getByTestId('finance-save').click();
  await laterSave;
  await later.close();
  await page.locator('textarea').fill('local note');
  await page.getByTestId('finance-save').click();
  await expect(page.getByTestId('finance-version-conflict')).toBeVisible();
  const conflictWrites = [];
  const onConflictRequest = (request) => {
    const method = request.method();
    if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') return;
    if (request.url().includes('/auth/v1/token')) return;
    conflictWrites.push(`${method} ${request.url()}`);
  };
  page.on('request', onConflictRequest);
  await page.getByTestId('finance-mode-executive').click();
  await expect(page.getByTestId('finance-unsaved-in-readonly-mode')).toContainText('Your unsaved edits are kept in Guided');
  await expect(page.getByTestId('finance-version-conflict')).toHaveCount(0);
  await shot(page, 'conflict-dirty-executive-desktop');
  await page.setViewportSize({ width: 390, height: 844 });
  await shot(page, 'conflict-dirty-executive-mobile');
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.getByTestId('finance-mode-advanced').click();
  await expect(page.getByTestId('finance-unsaved-in-readonly-mode')).toContainText('Your unsaved edits are kept in Guided');
  await page.getByRole('button', { name: 'Open Guided' }).click();
  await expect(page.getByTestId('finance-version-conflict')).toBeVisible();
  await expect(page.locator('textarea')).toHaveValue('local note');
  await page.waitForTimeout(400);
  page.off('request', onConflictRequest);
  expect(conflictWrites).toEqual([]);
});

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

test('monthly check-in entry, history, and comparison basis', async ({ page }) => {
  test.skip(!process.env.FINANCE_CHECKIN_EMAIL || !process.env.FINANCE_CHECKIN_PASSWORD, 'local check-in credentials were not provided');
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('/tvg/login?next=%2Ftvg%2Ffinance%2Fcheckin');
  await page.locator('#email').fill(process.env.FINANCE_CHECKIN_EMAIL);
  await page.locator('#password').fill(process.env.FINANCE_CHECKIN_PASSWORD);
  await page.locator('button[type="submit"]').click();
  await page.waitForURL('**/finance/checkin');
  await expect(page.getByTestId('finance-checkin')).toBeVisible();
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
  await page.getByTestId('finance-create-plan').click();
  await expect(page.getByTestId('finance-monthly-basis')).toBeVisible();
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

  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('/tvg/finance');
  await page.getByTestId('finance-new-draft').click();
  await expect(page.getByTestId('finance-monthly-basis')).toBeVisible();
  const basisRevenue = page.getByTestId('finance-basis-total-revenue');
  await basisRevenue.click();
  await basisRevenue.pressSequentially('10.50');
  await expect(basisRevenue).toHaveValue('10.50');
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

  await page.setViewportSize({ width: 1280, height: 900 });
  await page.getByTestId('checkin-history-2026-01').click();
  await expect(page.getByTestId('checkin-plan-total-revenue')).toHaveText('--');
  await expect(page.getByTestId('checkin-variance-total-revenue')).toHaveText('--');
  await expect(page.getByTestId('checkin-partial-basis')).toBeVisible();
  await expect(page.getByTestId('checkin-no-monthly-basis')).toHaveCount(0);
  await page.screenshot({ path: `${out}/desktop-historical-locked-basis.png`, fullPage: true });
});

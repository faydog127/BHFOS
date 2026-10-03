/**
 * Local Stage D report evidence. Synthetic values only.
 * Screenshots and PDFs are written outside the repository.
 * Run after monthly-checkin.spec.js on a freshly reset local database.
 * Requires FINANCE_CHECKIN_EMAIL and FINANCE_CHECKIN_PASSWORD.
 */
import { test, expect } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';

const out = process.env.FINANCE_REPORT_SHOTS || '/opt/cursor/artifacts/finance-stage-d';
const presets = [
  'monthly-summary',
  'owner-operating',
  'cost-structure',
  'growth-readiness',
  'pricing-economics',
  'working-capital',
  'assumptions',
  'plan-vs-actual',
];

test.beforeAll(() => {
  mkdirSync(out, { recursive: true });
});

async function assertNoDocumentOverflow(page) {
  const widths = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    innerWidth: window.innerWidth,
  }));
  console.log(`REPORT_WIDTH scrollWidth=${widths.scrollWidth} innerWidth=${widths.innerWidth}`);
  expect(widths.scrollWidth).toBeLessThanOrEqual(widths.innerWidth);
}

test('eight finance reports read the screen and do not write', async ({ page }) => {
  test.setTimeout(300000);
  test.skip(!process.env.FINANCE_CHECKIN_EMAIL || !process.env.FINANCE_CHECKIN_PASSWORD, 'local check-in credentials were not provided');
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('/tvg/login?next=%2Ftvg%2Ffinance');
  await page.locator('#email').fill(process.env.FINANCE_CHECKIN_EMAIL);
  await page.locator('#password').fill(process.env.FINANCE_CHECKIN_PASSWORD);
  await page.locator('button[type="submit"]').click();
  await page.waitForURL('**/finance');
  await expect(page.getByTestId('canonical-required-revenue')).toBeVisible();
  const required = await page.getByTestId('canonical-required-revenue').innerText();
  await page.getByTestId('finance-mode-executive').click();
  await expect(page.getByTestId('decision-plan-total-revenue')).toHaveText('$10.50');
  const planRevenue = await page.getByTestId('decision-plan-total-revenue').innerText();
  const actualRevenue = await page.getByTestId('decision-actual-total-revenue').innerText();
  const varianceRevenue = await page.getByTestId('decision-variance-total-revenue').innerText();
  const planCash = await page.getByTestId('decision-plan-cash-reserve').innerText();
  const planJobs = await page.getByTestId('decision-plan-total-jobs').innerText();

  const writes = [];
  page.on('request', (request) => {
    const method = request.method();
    if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') return;
    if (request.url().includes('/auth/v1/token')) return;
    writes.push(`${method} ${request.url()}`);
  });

  await page.getByTestId('finance-open-reports').click();
  await expect(page).toHaveURL(/\/finance\/reports$/);
  await expect(page.getByTestId('finance-report-index')).toBeVisible();
  await expect(page.getByTestId('finance-mode')).toHaveCount(0);
  for (const id of presets) {
    await expect(page.getByTestId(`finance-report-link-${id}`)).toBeVisible();
  }

  await page.getByTestId('finance-report-link-owner-operating').click();
  await expect(page.getByTestId('report-required-revenue')).toHaveText(required);
  await expect(page.getByTestId('finance-report-title')).toHaveText('Owner Operating Report');
  await expect(page.getByTestId('finance-report-generated-at')).not.toHaveText('--');

  await page.getByTestId('finance-report-link-monthly-summary').click();
  await expect(page.getByTestId('report-plan-total-revenue')).toHaveText(planRevenue);
  await expect(page.getByTestId('report-actual-total-revenue')).toHaveText(actualRevenue);
  await expect(page.getByTestId('report-variance-total-revenue')).toHaveText(varianceRevenue);
  await expect(page.getByTestId('report-plan-cash-reserve')).toHaveText(planCash);
  await expect(page.getByTestId('report-plan-total-jobs')).toHaveText(planJobs);
  await expect(page.getByTestId('report-unconnected-invoiced_amount')).toHaveText('unavailable / not connected');
  await expect(page.getByTestId('report-unconnected-cash_collected')).toHaveText('unavailable / not connected');

  await page.getByTestId('finance-report-link-plan-vs-actual').click();
  await expect(page.getByTestId('report-history-2026-01-plan-total-revenue')).toHaveText('--');
  await expect(page.getByTestId('report-history-2026-01-variance-total-revenue')).toHaveText('--');
  await expect(page.getByTestId('report-history-2026-01-basis')).toContainText('blank plan figure is not zero');
  await expect(page.getByTestId('report-history-2026-01-schema')).toHaveText('2');
  await expect(page.getByTestId('report-history-2026-02-plan-total-revenue')).toHaveText('$10.50');
  await expect(page.getByTestId('report-history-2026-02-actual-total-revenue')).toHaveText('$4.00');
  await expect(page.getByTestId('report-history-2026-02-variance-total-revenue')).toHaveText('-$6.50');
  await expect(page.getByTestId('report-history-2026-02-plan-cash-reserve')).toHaveText('$0.00');
  await expect(page.getByTestId('report-history-2026-02-plan-total-jobs')).toHaveText('--');
  const januaryPlan = await page.getByTestId('report-history-2026-01-comparison-plan').innerText();
  const februaryPlan = await page.getByTestId('report-history-2026-02-comparison-plan').innerText();
  expect(januaryPlan).not.toEqual('--');
  expect(februaryPlan).not.toEqual('--');
  expect(januaryPlan).not.toEqual(februaryPlan);

  await page.getByTestId('finance-report-link-growth-readiness').click();
  await expect(page.getByTestId('report-hvac-name')).toHaveText('Future/Licensing Dependent HVAC');
  await expect(page.getByTestId('report-hvac-revenue')).toContainText('not provided');

  for (const id of presets) {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.emulateMedia({ media: 'screen' });
    await page.getByTestId(`finance-report-link-${id}`).click();
    await expect(page.getByTestId(`finance-report-${id}`)).toBeVisible();
    await expect(page.getByTestId('finance-mode')).toHaveCount(0);
    await expect(page.locator('input, textarea, select, button')).toHaveCount(0);
    await expect(page.getByRole('navigation', { name: 'Planning sections' })).toHaveCount(0);
    await page.screenshot({ path: `${out}/${id}-desktop.png`, fullPage: true });
    await page.emulateMedia({ media: 'print' });
    await expect(page.locator('[data-print-hide]')).toBeHidden();
    await expect(page.locator('a:visible')).toHaveCount(0);
    await expect(page.locator('input, textarea, select, button')).toHaveCount(0);
    await expect(page.getByTestId('finance-mode')).toHaveCount(0);
    await expect(page.getByTestId('finance-report-title')).toBeVisible();
    const printLayout = await page.evaluate(() => {
      const hidden = document.querySelector('[data-print-hide]');
      const sheet = document.querySelector('.report-sheet');
      return {
        navDisplay: hidden ? getComputedStyle(hidden).display : 'missing',
        sheetBackground: sheet ? getComputedStyle(sheet).backgroundColor : 'missing',
        pageBreak: sheet ? getComputedStyle(sheet.querySelector('.report-block') || sheet).breakInside : 'missing',
      };
    });
    expect(printLayout.navDisplay).toBe('none');
    writeFileSync(`${out}/${id}-print-layout.json`, JSON.stringify(printLayout, null, 2));
    await page.screenshot({ path: `${out}/${id}-print.png`, fullPage: true });
    await page.pdf({ path: `${out}/${id}.pdf`, printBackground: true });
    await page.emulateMedia({ media: 'screen' });
  }

  await page.setViewportSize({ width: 390, height: 844 });
  for (const id of ['monthly-summary', 'cost-structure', 'plan-vs-actual']) {
    await page.getByTestId(`finance-report-link-${id}`).click();
    await expect(page.getByTestId(`finance-report-${id}`)).toBeVisible();
    await page.screenshot({ path: `${out}/${id}-mobile.png`, fullPage: true });
    await assertNoDocumentOverflow(page);
  }

  expect(writes).toEqual([]);
});

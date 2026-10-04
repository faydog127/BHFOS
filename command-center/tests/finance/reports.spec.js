/**
 * Local Stage D report evidence. Synthetic values only.
 * Screenshots and PDFs are written outside the repository.
 * Run after monthly-checkin.spec.js on a freshly reset local database.
 * Requires FINANCE_CHECKIN_EMAIL and FINANCE_CHECKIN_PASSWORD.
 */
import { test, expect } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

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

function seedHistoricalV1() {
  const db = process.env.FINANCE_LOCAL_DB_URL;
  if (!db) {
    throw new Error('FINANCE_LOCAL_DB_URL is required for the browser v1 historical-plan proof. It is the local Postgres URL from supabase status. Do not point it at a remote project.');
  }
  const seed = path.join(path.dirname(fileURLToPath(import.meta.url)), 'seed-v1-historical.sql');
  execFileSync('psql', [db, '-v', 'ON_ERROR_STOP=1', '-f', seed], { stdio: 'pipe' });
}

function mediaBoxes(file) {
  const raw = readFileSync(file).toString('latin1');
  return [...raw.matchAll(/\/MediaBox\s*\[\s*0\s+0\s+([\d.]+)\s+([\d.]+)\s*\]/g)].map((match) => [Number(match[1]), Number(match[2])]);
}

function assertPaper(file, expectedBox, landscape) {
  const boxes = mediaBoxes(file);
  expect(boxes.length, file).toBeGreaterThan(0);
  for (const box of boxes) {
    expect(Math.abs(box[0] - expectedBox[0]), file).toBeLessThan(3);
    expect(Math.abs(box[1] - expectedBox[1]), file).toBeLessThan(3);
    if (landscape) expect(box[0], file).toBeGreaterThan(box[1]);
  }
}

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
  if (!process.env.FINANCE_CHECKIN_EMAIL || !process.env.FINANCE_CHECKIN_PASSWORD) {
    throw new Error('FINANCE_CHECKIN_EMAIL and FINANCE_CHECKIN_PASSWORD are required. The release gate supplies synthetic local credentials. This spec does not skip.');
  }
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('/tvg/login?next=%2Ftvg%2Ffinance');
  await page.locator('#email').fill(process.env.FINANCE_CHECKIN_EMAIL);
  await page.locator('#password').fill(process.env.FINANCE_CHECKIN_PASSWORD);
  await page.locator('button[type="submit"]').click();
  await page.waitForURL('**/finance');
  seedHistoricalV1();
  await page.reload();
  await expect(page.getByTestId('canonical-required-revenue')).toBeVisible();
  await page.evaluate(() => {
    const financeUrl = `${window.location.pathname}${window.location.search}${window.location.hash}`;
    history.pushState({ financeHold: true }, '', '/tvg/crm/dashboard');
    history.pushState({ financeHold: true }, '', financeUrl);
  });
  await page.locator('textarea').fill('unsaved hardening note');
  await expect(page.locator('textarea')).toHaveValue('unsaved hardening note');
  await expect(page.locator('html')).toHaveAttribute('data-finance-leave-guard', 'on');
  await page.evaluate(() => { window.history.back(); });
  await expect(page.getByTestId('finance-leave-dialog')).toBeVisible();
  await expect(page).toHaveURL(/\/finance\/?$/);
  await expect(page.locator('textarea')).toHaveValue('unsaved hardening note');
  await page.keyboard.press('Escape');
  const dirtyWrites = [];
  const onDirtyRequest = (request) => {
    const method = request.method();
    if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') return;
    if (request.url().includes('/auth/v1/token')) return;
    dirtyWrites.push(`${method} ${request.url()}`);
  };
  page.on('request', onDirtyRequest);
  await page.getByTestId('finance-open-reports').click();
  await expect(page.getByTestId('finance-report-notice')).toContainText('unsaved edits');
  await page.getByRole('link', { name: 'Back to planning' }).click();
  await expect(page.locator('textarea')).toHaveValue('unsaved hardening note');
  await page.evaluate(() => {
    const anchor = document.createElement('a');
    anchor.href = '/tvg/crm/dashboard';
    anchor.dataset.testid = 'finance-leave-probe';
    anchor.textContent = 'CRM';
    document.body.appendChild(anchor);
  });
  await page.getByTestId('finance-leave-probe').click();
  await expect(page.getByTestId('finance-leave-dialog')).toBeVisible();
  await page.getByTestId('finance-leave-stay').click();
  await expect(page).toHaveURL(/\/finance\/?$/);
  await expect(page.locator('textarea')).toHaveValue('unsaved hardening note');
  await page.getByTestId('finance-leave-probe').click();
  await expect(page.getByTestId('finance-leave-dialog')).toBeVisible();
  await expect(page.getByTestId('finance-leave-stay')).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(page.getByTestId('finance-leave-discard')).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(page.getByTestId('finance-leave-stay')).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('finance-leave-dialog')).toHaveCount(0);
  await expect(page).toHaveURL(/\/finance\/?$/);
  await expect(page.locator('textarea')).toHaveValue('unsaved hardening note');
  await page.evaluate(() => {
    history.pushState({}, '', '/tvg/crm/dashboard');
  });
  await expect(page.getByTestId('finance-leave-dialog')).toBeVisible();
  await expect(page).toHaveURL(/\/finance\/?$/);
  await expect(page.locator('textarea')).toHaveValue('unsaved hardening note');
  await page.keyboard.press('Escape');
  await page.getByRole('link', { name: 'Pricing' }).click();
  await expect(page).toHaveURL(/\/finance\/pricing$/);
  await expect(page.getByTestId('finance-leave-dialog')).toHaveCount(0);
  await page.goBack();
  await expect(page.getByTestId('finance-leave-dialog')).toHaveCount(0);
  await expect(page).toHaveURL(/\/finance\/?$/);
  await expect(page.locator('textarea')).toHaveValue('unsaved hardening note');
  expect(dirtyWrites.some((line) => /finance_plans|finance_monthly_actuals|finance_approve|finance_open_draft|finance_upgrade/.test(line))).toBe(false);
  page.off('request', onDirtyRequest);
  page.once('dialog', (dialog) => dialog.accept());
  await page.reload();
  await expect(page.getByTestId('canonical-required-revenue')).toBeVisible();
  await page.getByRole('link', { name: 'Pricing' }).click();
  await expect(page.getByTestId('finance-pricing')).toBeVisible();
  await page.getByTestId('price-row-residential_dryer_vent').locator('input').fill('-1234567.89');
  await page.getByTestId('price-row-duct_12_drop_floor').locator('input').fill('-12345678.89');
  await page.getByRole('link', { name: 'Overview' }).click();
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
  await expect(page.locator('p', { has: page.getByTestId('finance-report-generated-at') })).toContainText('UTC');
  const identity = page.getByTestId('entity-brand-identity');
  await expect(identity.getByTestId('entity-brand-name')).toHaveText('The Vent Guys');
  await expect(identity).toHaveAttribute('data-brand-complete', 'true');
  await expect(identity).toHaveAttribute('data-entity-id', 'tvg');
  await expect(identity.getByTestId('entity-brand-logo')).toHaveAttribute('src', '/assets/finance/tvg-logo-primary.png');
  await expect(page.getByTestId('entity-brand-pending')).toHaveCount(0);

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
  await expect(page.getByTestId('report-history-2025-11-schema')).toHaveText('1');
  await expect(page.getByTestId('report-history-2025-11-plan-total-revenue')).toHaveText('--');
  await expect(page.getByTestId('report-history-2025-11-basis')).toContainText('No declared monthly basis');
  const januaryPlan = await page.getByTestId('report-history-2026-01-comparison-plan').innerText();
  const februaryPlan = await page.getByTestId('report-history-2026-02-comparison-plan').innerText();
  expect(januaryPlan).not.toEqual('--');
  expect(februaryPlan).not.toEqual('--');
  expect(januaryPlan).not.toEqual(februaryPlan);

  await page.getByTestId('finance-report-link-growth-readiness').click();
  await expect(page.getByTestId('report-hvac-name')).toHaveText('Future/Licensing Dependent HVAC');
  await expect(page.getByTestId('report-hvac-revenue')).toContainText('not provided');

  let shippedPrintCss = '';
  for (const id of presets) {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.emulateMedia({ media: 'screen' });
    await page.getByTestId(`finance-report-link-${id}`).click();
    const surface = page.getByTestId('finance-reports');
    await expect(page.getByTestId(`finance-report-${id}`)).toBeVisible();
    await expect(page.getByTestId('finance-mode')).toHaveCount(0);
    await expect(surface.locator('input, textarea, select, button')).toHaveCount(0);
    await expect(page.getByRole('navigation', { name: 'Planning sections' })).toHaveCount(0);
    await page.screenshot({ path: `${out}/${id}-desktop.png`, fullPage: true });
    await page.setViewportSize({ width: 740, height: 1056 });
    await page.emulateMedia({ media: 'print' });
    await page.evaluate(() => document.fonts.ready);
    await expect(page.locator('[data-print-hide]')).toBeHidden();
    await expect(surface.locator('a:visible')).toHaveCount(0);
    await expect(surface.locator('input, textarea, select, button')).toHaveCount(0);
    await expect(page.getByTestId('finance-mode')).toHaveCount(0);
    await expect(page.getByTestId('finance-report-title')).toBeVisible();
    const printLayout = await page.evaluate(() => {
      const hidden = document.querySelector('[data-print-hide]');
      const sheet = document.querySelector('.report-sheet');
      return {
        navDisplay: hidden ? getComputedStyle(hidden).display : 'missing',
        sheetBackground: sheet ? getComputedStyle(sheet).backgroundColor : 'missing',
        pageBreak: sheet ? getComputedStyle(sheet.querySelector('.report-block') || sheet).breakInside : 'missing',
        theadCount: sheet ? sheet.querySelectorAll('thead').length : 0,
        theadDisplay: sheet?.querySelector('thead') ? getComputedStyle(sheet.querySelector('thead')).display : 'absent',
      };
    });
    expect(printLayout.navDisplay).toBe('none');
    if (printLayout.theadCount > 0) {
      expect(printLayout.theadDisplay).toBe('table-header-group');
    }
    if (id === 'pricing-economics' || id === 'cost-structure' || id === 'monthly-summary') {
      expect(printLayout.theadCount).toBeGreaterThan(0);
    }
    const clip = await page.evaluate(() => {
      const sheet = document.querySelector('.report-sheet');
      const sheetRight = sheet.getBoundingClientRect().right;
      return [...sheet.querySelectorAll('.overflow-x-auto')].map((wrap) => {
        const table = wrap.querySelector('table');
        const tableRect = table ? table.getBoundingClientRect() : null;
        return {
          overflow: getComputedStyle(wrap).overflowX,
          tableWidth: tableRect ? Math.ceil(tableRect.width) : 0,
          sheetWidth: Math.ceil(sheet.getBoundingClientRect().width),
          clipped: tableRect ? tableRect.right > sheetRight + 1 : false,
        };
      });
    });
    expect(clip.every((row) => row.overflow === 'visible')).toBe(true);
    expect(clip.every((row) => row.clipped === false)).toBe(true);
    const valueSplit = await page.evaluate(() => {
      const numeric = /^(?:--|-?\$[\d,]+\.\d{2}|-?\d+(?:\.\d+)?%|-?\d+(?:\.\d+)?)$/;
      return [...document.querySelectorAll('.report-value')].filter((el) => {
        const text = (el.textContent || '').trim();
        if (!numeric.test(text)) return false;
        const range = document.createRange();
        range.selectNodeContents(el);
        return range.getClientRects().length > 1 || el.scrollWidth > el.clientWidth + 1;
      }).map((el) => el.textContent);
    });
    expect(valueSplit).toEqual([]);
    writeFileSync(`${out}/${id}-print-layout.json`, JSON.stringify({ ...printLayout, clip }, null, 2));
    if (id === 'pricing-economics') {
      await expect(page.getByRole('columnheader', { name: 'Signed variance' })).toBeVisible();
      await expect(page.getByRole('columnheader', { name: 'Stage 2 capacity' })).toBeVisible();
      shippedPrintCss = await page.evaluate(() => {
        const tag = [...document.querySelectorAll('style')].find((el) => (el.textContent || '').includes('.report-value'));
        return tag ? tag.textContent : '';
      });
    }
    if (id === 'cost-structure') {
      await expect(page.getByRole('columnheader', { name: /Future\/Licensing Dependent HVAC/ })).toBeVisible();
    }
    const printed = await page.getByTestId('finance-reports').innerText();
    expect(printed).not.toContain('NotReady');
    expect(printed).not.toContain('below_near');
    await page.screenshot({ path: `${out}/${id}-print.png`, fullPage: true });
    await page.pdf({ path: `${out}/${id}.pdf`, format: 'Letter', printBackground: true });
    assertPaper(`${out}/${id}.pdf`, [612, 792], false);
    await page.pdf({ path: `${out}/${id}-a4.pdf`, format: 'A4', printBackground: true });
    assertPaper(`${out}/${id}-a4.pdf`, [595, 842], false);
    await page.pdf({ path: `${out}/${id}-landscape.pdf`, format: 'Letter', landscape: true, printBackground: true });
    assertPaper(`${out}/${id}-landscape.pdf`, [792, 612], true);
    await page.pdf({ path: `${out}/${id}-a4-landscape.pdf`, format: 'A4', landscape: true, printBackground: true });
    assertPaper(`${out}/${id}-a4-landscape.pdf`, [842, 595], true);
    await page.emulateMedia({ media: 'screen' });
    await page.setViewportSize({ width: 1280, height: 900 });
  }

  await page.setViewportSize({ width: 390, height: 844 });
  for (const id of ['monthly-summary', 'cost-structure', 'plan-vs-actual']) {
    await page.getByTestId(`finance-report-link-${id}`).click();
    await expect(page.getByTestId(`finance-report-${id}`)).toBeVisible();
    await page.screenshot({ path: `${out}/${id}-mobile.png`, fullPage: true });
    await assertNoDocumentOverflow(page);
  }

  expect(shippedPrintCss).toContain('.report-value');
  const signed7 = '-$1,234,567.89';
  const signed8 = '-$12,345,678.89';
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.emulateMedia({ media: 'screen' });
  await page.getByTestId('finance-report-link-pricing-economics').click();
  await expect(page.getByTestId('finance-report-pricing-economics')).toBeVisible();
  await expect(page.locator('.report-value', { hasText: signed7 })).toHaveCount(1);
  await expect(page.locator('.report-value', { hasText: signed8 })).toHaveCount(1);
  await expect(page.getByTestId('entity-brand-footer')).toBeVisible();
  await expect(page.getByTestId('entity-brand-contact')).toContainText('info@vent-guys.com');
  for (const setup of [
    ['pricing-7digit-letter', { width: 725, height: 960 }, { format: 'Letter' }, [612, 792], false],
    ['pricing-7digit-a4', { width: 703, height: 1000 }, { format: 'A4' }, [595, 842], false],
    ['pricing-7digit-landscape', { width: 965, height: 700 }, { format: 'Letter', landscape: true }, [792, 612], true],
    ['pricing-7digit-a4-landscape', { width: 1000, height: 680 }, { format: 'A4', landscape: true }, [842, 595], true],
  ]) {
    const [name, viewport, pdf, expectedBox, landscape] = setup;
    await page.setViewportSize(viewport);
    await page.emulateMedia({ media: 'print' });
    await page.evaluate(() => document.fonts.ready);
    const fit = await page.evaluate(({ seven, eight }) => {
      const sheet = document.querySelector('.report-sheet');
      const table = document.querySelector('[data-testid="report-services"] table');
      const cellFor = (signed) => [...document.querySelectorAll('.report-value')].find((el) => (el.textContent || '').trim() === signed);
      const measure = (signed) => {
        const signedCell = cellFor(signed);
        const range = document.createRange();
        range.selectNodeContents(signedCell);
        return {
          lines: range.getClientRects().length,
          overflow: signedCell.scrollWidth > signedCell.clientWidth + 1,
          scroll: signedCell.scrollWidth,
          client: signedCell.clientWidth,
          font: getComputedStyle(signedCell).fontSize,
        };
      };
      const sheetBox = sheet.getBoundingClientRect();
      const tableBox = table.getBoundingClientRect();
      return {
        seven: measure(seven),
        eight: measure(eight),
        clipped: tableBox.right > sheetBox.right + 1,
        headers: table.querySelectorAll('thead th').length,
        reportFont: document.fonts.check('400 8px "Finance Report Sans"'),
      };
    }, { seven: signed7, eight: signed8 });
    expect(fit.reportFont).toBe(true);
    console.log(`PRINT_FIT ${name} ${JSON.stringify(fit)}`);
    expect(fit.headers).toBe(10);
    expect(fit.seven.lines).toBe(1);
    expect(fit.eight.lines).toBe(1);
    expect(fit.seven.overflow).toBe(false);
    expect(fit.eight.overflow).toBe(false);
    expect(fit.clipped).toBe(false);
    expect(fit.seven.font).toBe('8px');
    expect(fit.eight.font).toBe('8px');
    writeFileSync(`${out}/${name}-layout.json`, JSON.stringify(fit, null, 2));
    await page.screenshot({ path: `${out}/${name}.png`, fullPage: true });
    await page.pdf({ path: `${out}/${name}.pdf`, printBackground: true, ...pdf });
    assertPaper(`${out}/${name}.pdf`, expectedBox, landscape);
  }

  expect(writes.every((line) => line.includes('/rpc/check_is_superuser'))).toBe(true);
  expect(writes.some((line) => /finance_plans|finance_monthly_actuals|finance_approve|finance_open_draft|finance_upgrade/.test(line))).toBe(false);
});

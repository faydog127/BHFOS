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
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';

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

function assertLoopback(raw, label) {
  let url;
  try {
    url = new URL(raw);
  } catch {
    throw new Error(`${label} is not a URL. Do not point it at a remote project.`);
  }
  if (!['127.0.0.1', 'localhost', '::1'].includes(url.hostname)) {
    throw new Error(`${label} must be a loopback URL. Do not point it at a remote project.`);
  }
  return url;
}

function seedHistoricalV1() {
  const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
  if (!supabaseUrl) {
    throw new Error('VITE_SUPABASE_URL is required for the browser v1 historical-plan proof. It must be a loopback URL.');
  }
  const api = assertLoopback(supabaseUrl, 'VITE_SUPABASE_URL');
  const mockPort = process.env.FINANCE_MOCK_PORT || (api.port === '54921' ? api.port : '');
  if (mockPort) {
    execFileSync('curl', ['-sf', '-X', 'POST', `http://127.0.0.1:${mockPort}/mock/seed-historical-v1`], { stdio: 'pipe' });
    return;
  }
  const db = process.env.FINANCE_LOCAL_DB_URL;
  if (!db) {
    throw new Error('FINANCE_LOCAL_DB_URL is required when the Vite API is not the local finance mock. It is a loopback Postgres URL. Do not point it at a remote project.');
  }
  assertLoopback(db, 'FINANCE_LOCAL_DB_URL');
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

const paperViews = [
  { width: 725, height: 960, name: 'letter' },
  { width: 703, height: 1000, name: 'a4' },
  { width: 965, height: 700, name: 'letter-landscape' },
  { width: 1000, height: 680, name: 'a4-landscape' },
];
const priceLabels = ['residential_dryer_vent', 'duct_plus_ahu_package'];

async function pdfItems(file) {
  const data = new Uint8Array(readFileSync(file));
  const doc = await getDocument({ data, disableWorker: true, isEvalSupported: false }).promise;
  const items = [];
  for (let pageNumber = 1; pageNumber <= doc.numPages; pageNumber += 1) {
    const pdfPage = await doc.getPage(pageNumber);
    const viewport = pdfPage.getViewport({ scale: 1 });
    const content = await pdfPage.getTextContent();
    for (const item of content.items) {
      if (!item.str) continue;
      const height = item.height || Math.hypot(item.transform[2], item.transform[3]);
      items.push({
        str: item.str,
        x: item.transform[4],
        y: item.transform[5],
        w: item.width,
        h: height,
        page: pageNumber,
        pageWidth: viewport.width,
        pageHeight: viewport.height,
      });
    }
  }
  return items;
}

function pdfText(items) {
  const sorted = [...items].sort((a, b) => a.page - b.page || b.y - a.y || a.x - b.x);
  let text = '';
  let prev = null;
  for (const item of sorted) {
    if (prev) {
      const sameLine = prev.page === item.page && Math.abs(item.y - prev.y) < 2;
      const gap = item.x - (prev.x + prev.w);
      if (!sameLine || gap > 0.5) text += ' ';
    }
    text += item.str;
    prev = item;
  }
  return text;
}

function labelFragments(items, label) {
  return items.filter((item) => {
    if (item.str.length < 2 || !label.includes(item.str)) return false;
    const owners = priceLabels.filter((name) => name.includes(item.str));
    return owners.length === 1 && owners[0] === label;
  }).sort((a, b) => a.page - b.page || b.y - a.y || a.x - b.x);
}

function boxesOverlap(left, right) {
  const xOverlap = Math.min(left.x + left.w, right.x + right.w) - Math.max(left.x, right.x);
  const yOverlap = Math.min(left.y + left.h, right.y + right.h) - Math.max(left.y, right.y);
  return xOverlap > 0.5 && yOverlap > 0.5;
}

async function assertPriceLabelsClear(file) {
  const items = await pdfItems(file);
  const planned = items.filter((item) => /^planned(?:\s+price)?$/i.test(item.str.trim()));
  expect(planned.length, file).toBeGreaterThan(0);
  const boundary = Math.min(...planned.map((item) => item.x));
  const labels = items.filter((item) => priceLabels.some((label) => label.includes(item.str) && item.str.length >= 4) && item.x < boundary);
  expect(labels.length, file).toBeGreaterThan(0);
  const nextColumn = items.filter((item) => item.x >= boundary - 0.4);
  const hits = [];
  for (const label of labels) {
    for (const other of nextColumn) {
      if (label.page === other.page && boxesOverlap(label, other)) hits.push(`${label.str} x ${other.str}`);
    }
  }
  expect(hits, file).toEqual([]);
  for (const label of priceLabels) {
    expect(labelFragments(items, label).map((item) => item.str).join(''), file).toContain(label);
  }
}

function squashPdf(value) {
  return value.replace(/[\s\u00ad\u200b]+/g, '');
}

async function assertStage3Note(file, note) {
  const text = squashPdf(pdfText(await pdfItems(file)));
  expect(text, file).toContain(squashPdf('not a readiness input'));
  expect(note.length, file).toBeGreaterThan(80);
  expect(text, file).toContain(squashPdf(note.split(/\s+/).slice(-5).join(' ')));
  expect(text, file).toContain(squashPdf(note));
}

async function assertNoSameLineOverlap(file) {
  const words = (await pdfItems(file)).filter((item) => item.str.trim().length > 0 && item.w > 0);
  expect(words.length, file).toBeGreaterThan(50);
  const hits = [];
  for (let i = 0; i < words.length; i += 1) {
    for (let j = i + 1; j < words.length; j += 1) {
      const a = words[i];
      const b = words[j];
      if (a.page !== b.page) continue;
      const yOverlap = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
      const sameLine = yOverlap > 0.5 * Math.min(a.h, b.h);
      const xOverlap = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
      if (sameLine && xOverlap > 1) hits.push(`'${a.str}' x '${b.str}' ${xOverlap.toFixed(1)}pt`);
      if (hits.length > 4) break;
    }
    if (hits.length > 4) break;
  }
  expect(hits, file).toEqual([]);
}

async function assertInsidePageMargin(file) {
  const items = await pdfItems(file);
  const margin = (12 * 72) / 25.4;
  const past = items.filter((item) => item.x + item.w > item.pageWidth - margin + 1 || item.x < margin - 1);
  expect(past.map((item) => item.str), file).toEqual([]);
}

async function assertWrappedValuesFit(page, label) {
  const overflow = await page.evaluate(() => [...document.querySelectorAll('.report-value')].filter((el) => {
    if (el.closest('table')?.querySelector('th:nth-child(10)')) return false;
    return el.scrollWidth > el.clientWidth + 0.5;
  }).map((el) => (el.textContent || '').trim().slice(0, 80)));
  expect(overflow, label).toEqual([]);
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
    await expect(page.locator('.report-sheet')).toHaveAttribute('data-print-ready', 'yes');
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
    for (const viewport of paperViews) {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.emulateMedia({ media: 'print' });
      await assertWrappedValuesFit(page, `${id} ${viewport.name}`);
    }
    await page.setViewportSize({ width: 740, height: 1056 });
    await page.emulateMedia({ media: 'print' });
    await page.screenshot({ path: `${out}/${id}-print.png`, fullPage: true });
    await page.pdf({ path: `${out}/${id}.pdf`, format: 'Letter', printBackground: true });
    assertPaper(`${out}/${id}.pdf`, [612, 792], false);
    await page.pdf({ path: `${out}/${id}-a4.pdf`, format: 'A4', printBackground: true });
    assertPaper(`${out}/${id}-a4.pdf`, [595, 842], false);
    await page.pdf({ path: `${out}/${id}-landscape.pdf`, format: 'Letter', landscape: true, printBackground: true });
    assertPaper(`${out}/${id}-landscape.pdf`, [792, 612], true);
    await page.pdf({ path: `${out}/${id}-a4-landscape.pdf`, format: 'A4', landscape: true, printBackground: true });
    assertPaper(`${out}/${id}-a4-landscape.pdf`, [842, 595], true);
    if (id === 'growth-readiness') {
      const stage3Note = (await page.getByTestId('report-hvac-caveat').innerText()).trim();
      expect(stage3Note.length).toBeGreaterThan(80);
      for (const suffix of ['', '-a4', '-landscape', '-a4-landscape']) {
        await assertStage3Note(`${out}/${id}${suffix}.pdf`, stage3Note);
      }
    }
    if (id === 'pricing-economics') {
      for (const suffix of ['', '-a4', '-landscape', '-a4-landscape']) {
        const file = `${out}/${id}${suffix}.pdf`;
        await assertPriceLabelsClear(file);
        await assertNoSameLineOverlap(file);
      }
    }
    if (id === 'cost-structure') {
      await assertInsidePageMargin(`${out}/${id}-a4.pdf`);
    }
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
    await expect(page.locator('.report-sheet')).toHaveAttribute('data-print-ready', 'yes');
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
    await assertWrappedValuesFit(page, `${name} wrapped`);
    writeFileSync(`${out}/${name}-layout.json`, JSON.stringify(fit, null, 2));
    await page.screenshot({ path: `${out}/${name}.png`, fullPage: true });
    await page.pdf({ path: `${out}/${name}.pdf`, printBackground: true, ...pdf });
    assertPaper(`${out}/${name}.pdf`, expectedBox, landscape);
    await assertNoSameLineOverlap(`${out}/${name}.pdf`);
  }

  let delayed = false;
  await page.route('**/report-sans.woff2', async (route) => {
    delayed = true;
    await new Promise((resolve) => setTimeout(resolve, 4000));
    await route.continue();
  });
  const client = await page.context().newCDPSession(page);
  await client.send('Network.enable');
  await client.send('Network.setCacheDisabled', { cacheDisabled: true });
  page.once('dialog', (dialog) => dialog.accept());
  await page.reload({ waitUntil: 'domcontentloaded' });
  await expect(page.getByTestId('finance-report-pricing-economics')).toBeVisible();
  await page.setViewportSize({ width: 703, height: 1000 });
  await page.emulateMedia({ media: 'print' });
  const fontStarted = Date.now();
  await page.pdf({ path: `${out}/pricing-delayed-font.pdf`, format: 'A4', printBackground: true });
  expect(Date.now() - fontStarted, 'print must paint before the delayed face arrives').toBeLessThan(3500);
  expect(delayed, 'the report face request must be delayed').toBe(true);
  const delayedItems = await pdfItems(`${out}/pricing-delayed-font.pdf`);
  for (const label of priceLabels) {
    expect(labelFragments(delayedItems, label).map((item) => item.str).join(''), 'pricing-delayed-font.pdf').toContain(label);
  }

  expect(writes.every((line) => line.includes('/rpc/check_is_superuser'))).toBe(true);
  expect(writes.some((line) => /finance_plans|finance_monthly_actuals|finance_approve|finance_open_draft|finance_upgrade/.test(line))).toBe(false);
});

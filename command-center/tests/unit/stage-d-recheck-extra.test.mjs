/**
 * Stage D closeout coverage for labels, pricing columns, timestamps, and print CSS.
 * These tests run under test:finance.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import { blankPlanInputs } from '../../src/lib/finance/blankPlan.js';
import { calculatePlan } from '../../src/lib/finance/calculate.js';
import { buildDecisionSupport } from '../../src/lib/finance/modes.js';
import { TOKEN_LABELS, presentLabel } from '../../src/lib/finance/presentLabel.js';
import { FINANCE_REPORT_PRESETS, buildFinanceReport } from '../../src/lib/finance/reports.js';
import { buildFinanceView } from '../../src/lib/finance/viewModel.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const read = (p) => readFileSync(path.join(root, p), 'utf8');
const IDS = FINANCE_REPORT_PRESETS.map((item) => item.id);
const RAW = ['NotReady', 'below_near', 'near_capacity', 'at_or_over_capacity'];
const TS = '2026-10-03T12:00:00.000Z';

function populated() {
  const i = blankPlanInputs();
  const fill = (o) => {
    for (const k of Object.keys(o)) {
      const v = o[k];
      if (v && typeof v === 'object') fill(v);
      else if (v === null) {
        if (/pct|fraction|burden/.test(k)) o[k] = 0.05;
        else if (/utili/.test(k)) o[k] = 0.6;
        else if (/safety/.test(k)) o[k] = 2;
        else if (/wage/.test(k)) o[k] = 20;
        else if (/hours/.test(k)) o[k] = 8;
        else if (/headcount|units|stops|count/.test(k)) o[k] = 1;
        else if (/days/.test(k)) o[k] = 20;
        else if (/share/.test(k)) o[k] = 0;
        else o[k] = 100;
      }
    }
  };
  fill(i);
  i.structural.weeks_per_year = 52;
  i.structural.months_per_year = 12;
  i.structural.days_per_month_ar = 30;
  i.channels.forEach((c, k) => { c.share = [0.5, 0.3, 0.2][k] ?? 0; c.dso_days = 30; });
  return i;
}

function packet(id, { inputs = populated(), actuals = [], generatedAt = TS } = {}) {
  const rec = inputs ? { id: 'p', schema_version: 2, status: 'draft', notes: null, inputs } : null;
  const result = inputs ? calculatePlan(inputs) : null;
  const view = inputs && result ? buildFinanceView({ meta: { label: 'Stored plan', data_class: 'stored' }, inputs }, result, 'stage_2') : null;
  const support = buildDecisionSupport({ view, result, inputs, actuals, plans: rec ? [rec] : [] });
  return buildFinanceReport({ id, support, view, result, inputs, record: rec, generatedAt, dirty: false, conflict: false });
}

function strings(value, out = []) {
  if (typeof value === 'string') out.push(value);
  else if (Array.isArray(value)) value.forEach((v) => strings(v, out));
  else if (value && typeof value === 'object') Object.values(value).forEach((v) => strings(v, out));
  return out;
}

describe('stage D recheck: presentLabel is faithful, total, and never blanks or zeroes', () => {
  it('maps exactly the engine tokens to their readable words', () => {
    assert.deepEqual(TOKEN_LABELS, {
      NotReady: 'Not ready',
      below_near: 'Below near capacity',
      near_capacity: 'Near capacity',
      at_or_over_capacity: 'At or over capacity',
    });
    for (const [token, label] of Object.entries(TOKEN_LABELS)) assert.equal(presentLabel(token), label);
  });

  it('null, undefined, numbers and empty string come back unchanged (never 0, empty, or --)', () => {
    assert.equal(presentLabel(null), null);
    assert.equal(presentLabel(undefined), undefined);
    assert.equal(presentLabel(''), '');
    assert.equal(presentLabel(0), 0);
    assert.equal(presentLabel(5), 5);
    assert.equal(presentLabel('--'), '--');
  });

  it('unknown strings fall back to a visible, non-empty value', () => {
    assert.equal(presentLabel('Ready'), 'Ready');
    assert.equal(presentLabel('Incomplete / Needs review'), 'Incomplete / Needs review');
    assert.equal(presentLabel('Some new engine state'), 'Some new engine state');
    assert.equal(presentLabel('future_band'), 'Future band');
    assert.notEqual(presentLabel('x9_y'), '');
  });

  it('replaces every occurrence of a token inside prose, not only the first', () => {
    assert.equal(presentLabel('NotReady then NotReady; below_near and below_near'), 'Not ready then Not ready; Below near capacity and Below near capacity');
    assert.equal(presentLabel('Stage 2: NotReady'), 'Stage 2: Not ready');
  });
});

describe('stage D recheck: no raw token reaches any report packet', () => {
  it('all eight reports, populated, blank and no-plan, carry no raw engine token', () => {
    const cases = [populated(), blankPlanInputs(), null];
    for (const inputs of cases) {
      for (const id of IDS) {
        const text = strings(packet(id, { inputs })).join('\n');
        for (const token of RAW) assert.equal(text.includes(token), false, `${id} leaks ${token}`);
      }
    }
  });

  it('the assumptions caveats and owner exceptions read Not ready / Below near capacity', () => {
    const assumptions = packet('assumptions');
    const caveats = assumptions.blocks.find((b) => b.testId === 'report-caveats').items.join('\n');
    assert.match(caveats, /Stage 2: Not ready/);
    assert.match(caveats, /Utilization band: Below near capacity/);
    const owner = packet('owner-operating').blocks.find((b) => b.testId === 'report-exceptions').items.join('\n');
    assert.match(owner, /Not ready/);
    assert.match(owner, /Below near capacity/);
  });

  it('a lowercase source key is shown as words but a comparison plan id stays exactly as stored', () => {
    const actuals = [
      { month: '2026-01-01', comparison_plan_id: 'h1', total_revenue: 5, source: 'manual_entry' },
      { month: '2026-02-01', comparison_plan_id: null, total_revenue: 6, source: 'manual_entry' },
    ];
    const report = packet('plan-vs-actual', { actuals });
    const months = report.blocks.filter((b) => b.type === 'month');
    assert.ok(months.length >= 2);
    const ids = months.map((m) => m.comparisonPlan);
    assert.ok(ids.includes('h1'), `plan id h1 must not be re-cased: ${ids}`);
    assert.ok(ids.includes('--'), `a null plan id must be --, not 0: ${ids}`);
    assert.equal(ids.includes('H1'), false);
    assert.equal(ids.includes('0'), false);
  });
});

describe('stage D recheck: pricing columns, timestamp, print css', () => {
  it('Pricing & Service Economics keeps all ten columns, including Stage 2 capacity and Signed variance', () => {
    const table = packet('pricing-economics').blocks.find((b) => b.type === 'table' && b.columns && b.columns.includes('Signed variance'));
    assert.ok(table, 'service table exists');
    assert.deepEqual(table.columns, ['Service', 'Planned price', 'Direct labor', 'Materials', 'Dispatch', 'Direct job cost', 'Indirect', 'Fully supported', 'Stage 2 capacity', 'Signed variance']);
    for (const row of table.rows) assert.equal(row.cells.length, table.columns.length - 1, 'every row has a cell per column');
  });

  it('every report carries the generated timestamp exactly, and a missing one is -- not blank or 0', () => {
    for (const id of IDS) {
      assert.equal(packet(id).generatedAt, TS, id);
      assert.equal(packet(id, { generatedAt: null }).generatedAt, '--', id);
    }
  });

  it('print css sizes tables to the page, allows wrapping, and fixes the page box', () => {
    const css = read('src/pages/finance/FinanceReports.jsx').match(/const PRINT_CSS = `([\s\S]*?)`;/)[1];
    const tableRule = css.match(/\n\s*table\s*\{([^}]*)\}/)[1];
    assert.match(tableRule, /width:\s*100%/);
    assert.equal(/width:\s*\d+px/.test(tableRule), false, 'no fixed pixel table width in print');
    assert.equal(/min-width/.test(css), false, 'no min-width that could force a clip');
    assert.equal(/nowrap/.test(css), false, 'cells must wrap in print');
    assert.match(css, /white-space:\s*normal/);
    assert.match(css, /overflow-wrap:\s*anywhere|word-break:\s*break-word|overflow-wrap:\s*break-word/);
    assert.match(read('src/pages/finance/FinanceReports.jsx'), /@page\s*\{\s*size:\s*letter;\s*margin:\s*12mm;\s*\}/);
    assert.equal(/font-size:\s*([0-9]|1[0-1])(\.\d+)?px/.test(css) && /font-size:\s*([0-7])(\.\d+)?px/.test(css), false, 'print cells are not below 8px');
    assert.match(css, /font-size:\s*(9|10|11|12)px/);
  });
});

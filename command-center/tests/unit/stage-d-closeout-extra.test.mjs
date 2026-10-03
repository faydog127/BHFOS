/**
 * Stage D closeout coverage for numeric value cells and print scoping.
 * These tests run under test:finance.
 * The wide-table block is the second @media print rule so Letter and A4,
 * portrait and landscape, share the 8px ten-column treatment.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import { blankPlanInputs } from '../../src/lib/finance/blankPlan.js';
import { calculatePlan } from '../../src/lib/finance/calculate.js';
import { buildDecisionSupport } from '../../src/lib/finance/modes.js';
import { FINANCE_REPORT_PRESETS, buildFinanceReport } from '../../src/lib/finance/reports.js';
import { buildFinanceView } from '../../src/lib/finance/viewModel.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const read = (p) => readFileSync(path.join(root, p), 'utf8');
const JSX = read('src/pages/finance/FinanceReports.jsx');
const CSS = JSX.match(/const PRINT_CSS = `([\s\S]*?)`;/)[1];

/** Split a stylesheet into top-level blocks: { prelude, body }. Nested braces are kept inside body. */
function topLevel(css) {
  const out = [];
  let depth = 0;
  let start = 0;
  let open = -1;
  for (let i = 0; i < css.length; i += 1) {
    if (css[i] === '{') {
      if (depth === 0) open = i;
      depth += 1;
    } else if (css[i] === '}') {
      depth -= 1;
      if (depth === 0) {
        out.push({ prelude: css.slice(start, open).trim(), body: css.slice(open + 1, i) });
        start = i + 1;
      }
    }
  }
  return out;
}
const BLOCKS = topLevel(CSS);
const rulesIn = (body) => [...body.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map((m) => ({ sel: m[1].trim(), decl: m[2].trim() }));
const printBlocks = BLOCKS.filter((b) => b.prelude === '@media print');
const printBase = printBlocks[0];
const wideTable = printBlocks[1];

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
function packet(id) {
  const inputs = populated();
  const rec = { id: 'p', schema_version: 2, status: 'draft', notes: null, inputs };
  const result = calculatePlan(inputs);
  const view = buildFinanceView({ meta: { label: 'Stored plan', data_class: 'stored' }, inputs }, result, 'stage_2');
  const support = buildDecisionSupport({ view, result, inputs, actuals: [], plans: [rec] });
  return buildFinanceReport({ id, support, view, result, inputs, record: rec, generatedAt: '2026-10-03T12:00:00.000Z', dirty: false, conflict: false });
}
const IDS = FINANCE_REPORT_PRESETS.map((item) => item.id);

describe('stage D closeout: numeric value cells and print scoping', () => {
  it('every <td> rendered by the report carries the report-value class', () => {
    const tds = [...JSX.matchAll(/<td\b[^>]*>/g)].map((m) => m[0]);
    assert.ok(tds.length >= 6, `expected the 6 shipped td sites, saw ${tds.length}`);
    for (const tag of tds) assert.match(tag, /className="[^"]*\breport-value\b/, tag);
    assert.equal(/<td\b(?![^>]*className)/.test(JSX), false, 'td without className');
  });

  it('print css is entirely inside @media print or @page (nothing leaks to screen)', () => {
    assert.equal(printBlocks.length, 2);
    assert.ok(printBase, '@media print block');
    assert.equal(wideTable.prelude, '@media print');
    for (const b of BLOCKS) assert.match(b.prelude, /^(@media print\b|@page\b)/, `top-level block outside print: ${b.prelude}`);
    assert.equal(/@media\s+(?!print)/.test(CSS), false, 'no non-print media block');
    assert.equal(/@media[^{]*screen/.test(CSS), false);
    assert.equal(CSS.replace(/@media[^{]*\{[\s\S]*?\n\}\n/g, '').replace(/@page[^{]*\{[^}]*\}/g, '').trim(), '', 'no bare rules outside at-rules');
  });

  it('.report-value never breaks inside a token and does not use nowrap', () => {
    const rule = rulesIn(printBase.body).find((r) => r.sel === '.report-value');
    assert.ok(rule, '.report-value rule in @media print');
    assert.match(rule.decl, /overflow-wrap:\s*normal\s*!important/);
    assert.match(rule.decl, /word-break:\s*normal\s*!important/);
    assert.match(rule.decl, /hyphens:\s*manual\s*!important/);
    assert.equal(/anywhere|break-all|break-word|hyphens:\s*auto|nowrap/.test(rule.decl), false);
    assert.equal(/nowrap/.test(CSS), false, 'labels must remain wrappable');
    const cell = rulesIn(printBase.body).find((r) => r.sel === 'th, td');
    assert.match(cell.decl, /white-space:\s*normal\s*!important/);
    assert.match(cell.decl, /overflow-wrap:\s*anywhere/);
    assert.match(CSS, /table\s*\{[^}]*table-layout:\s*fixed/);
  });

  it('base print cell size is 10px and only the second @media print block shrinks the 10-column table to 8px', () => {
    const cell = rulesIn(printBase.body).find((r) => r.sel === 'th, td');
    assert.match(cell.decl, /font-size:\s*10px\s*!important/);
    assert.match(cell.decl, /padding:\s*4px 6px\s*!important/);
    const rs = rulesIn(wideTable.body);
    const sized = rs.filter((r) => /font-size/.test(r.decl));
    assert.equal(sized.length, 1);
    assert.match(sized[0].sel, /table:has\(th:nth-child\(10\)\) th, table:has\(th:nth-child\(10\)\) td/);
    assert.match(sized[0].decl, /font-size:\s*8px\s*!important/);
    assert.match(sized[0].decl, /padding:\s*2px 1px\s*!important/);
    const first = rs.find((r) => /:first-child/.test(r.sel));
    assert.match(first.decl, /width:\s*11%/);
    assert.equal(/nowrap/.test(first.decl), false);
    const head = rs.find((r) => /th:not\(:first-child\)/.test(r.sel));
    assert.match(head.decl, /overflow-wrap:\s*normal\s*!important/);
    assert.match(head.decl, /word-break:\s*normal\s*!important/);
    assert.equal(/orientation:\s*landscape/.test(CSS), false, 'no landscape-only size change');
    const allSizes = [...CSS.matchAll(/font-size:\s*(\d+(?:\.\d+)?)px/g)].map((m) => Number(m[1]));
    assert.deepEqual([...new Set(allSizes)].sort((a, b) => a - b), [8, 10]);
  });

  it('only the Pricing table has 10 columns, so the nth-child(10) selector targets exactly that table', () => {
    const widths = {};
    for (const id of IDS) {
      const max = Math.max(0, ...packet(id).blocks.filter((b) => b.type === 'table').map((b) => b.columns.length));
      widths[id] = max;
    }
    assert.equal(widths['pricing-economics'], 10);
    for (const id of IDS.filter((x) => x !== 'pricing-economics')) assert.ok(widths[id] < 10, `${id} has ${widths[id]} columns`);
    const n = Number(CSS.match(/th:nth-child\((\d+)\)/)[1]);
    assert.equal(n, widths['pricing-economics']);
    const cols = packet('pricing-economics').blocks.find((b) => b.testId === 'report-services').columns;
    assert.equal(cols[8], 'Stage 2 capacity');
    assert.equal(cols[9], 'Signed variance');
  });

  it('currency, percent, and signed value strings contain no internal whitespace that could wrap', () => {
    for (const id of IDS) {
      const p = packet(id);
      const cells = [];
      for (const b of p.blocks) {
        if (b.type === 'table') b.rows.forEach((r) => r.cells.forEach((c) => cells.push(c)));
        if (b.type === 'facts') b.rows.forEach((r) => cells.push(r.value));
        if (b.type === 'comparison') b.rows.forEach((r) => cells.push(r.plan, r.actual, r.variance, r.variancePct));
      }
      for (const c of cells.filter((x) => typeof x === 'string' && /^[-+]?\$|%$/.test(x))) assert.equal(/\s/.test(c), false, `${id}: ${c}`);
    }
  });
});

describe('stage D closeout: the browser smoke spec still asserts the closeout guarantees', () => {
  const spec = read('tests/finance/reports.spec.js');
  it('checks every .report-value on all eight reports and the 7-digit signed case on Letter, A4, and landscape', () => {
    assert.match(spec, /querySelectorAll\('\.report-value'\)/);
    assert.match(spec, /getClientRects\(\)\.length > 1/);
    assert.match(spec, /expect\(valueSplit\)\.toEqual\(\[\]\)/);
    assert.match(spec, /-\$1,234,567\.89/);
    assert.match(spec, /pricing-7digit-letter/);
    assert.match(spec, /pricing-7digit-a4/);
    assert.match(spec, /pricing-7digit-landscape/);
    assert.match(spec, /expect\(fit\.headers\)\.toBe\(10\)/);
    assert.match(spec, /expect\(fit\.lines\)\.toBe\(1\)/);
    assert.match(spec, /expect\(fit\.overflow\)\.toBe\(false\)/);
    assert.match(spec, /expect\(fit\.clipped\)\.toBe\(false\)/);
    assert.match(spec, /name: 'Signed variance'/);
    assert.match(spec, /name: 'Stage 2 capacity'/);
    assert.match(spec, /expect\(shippedPrintCss\)\.toContain\('\.report-value'\)/);
    assert.match(spec, /format: 'A4'/);
    assert.match(spec, /landscape: true/);
    assert.equal(/test\.(fixme|only)\b/.test(spec), false);
    const skips = spec.match(/test\.skip\([^\n]*/g) || [];
    assert.deepEqual(skips.filter((line) => !/FINANCE_CHECKIN_EMAIL/.test(line)), [], 'only the credentials guard may skip');
  });
});

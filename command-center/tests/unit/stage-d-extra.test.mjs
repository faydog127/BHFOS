/**
 * Stage D extra coverage for the report packets and print layout.
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
import { FINANCE_REPORT_PRESETS, buildFinanceReport } from '../../src/lib/finance/reports.js';
import { buildFinanceView, showMoney } from '../../src/lib/finance/viewModel.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const read = (p) => readFileSync(path.join(root, p), 'utf8');
const IDS = FINANCE_REPORT_PRESETS.map((item) => item.id);

function populated(distinct = false) {
  const i = blankPlanInputs();
  let n = 0;
  const fill = (o, key = '') => {
    for (const k of Object.keys(o)) {
      const v = o[k];
      if (v && typeof v === 'object') fill(v, `${key}.${k}`);
      else if (v === null) {
        n += 1;
        if (/pct|fraction|burden/.test(k)) o[k] = 0.05;
        else if (/utili/.test(k)) o[k] = 0.6;
        else if (/safety/.test(k)) o[k] = 2;
        else if (/wage/.test(k)) o[k] = 20;
        else if (/hours/.test(k)) o[k] = 8;
        else if (/headcount|units|stops|count/.test(k)) o[k] = 1;
        else if (/days/.test(k)) o[k] = 20;
        else if (/share/.test(k)) o[k] = 0;
        else o[k] = distinct ? 100 + n * 13 : 100;
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

const FULL = { total_revenue: 100, direct_residential_revenue: 60, commercial_direct_revenue: 30, portal_revenue: 10, total_jobs: 20, dryer_vent_jobs: 10, duct_jobs: 6, ahu_jobs: 4, productive_unit_hours: 40, field_payroll: 35, indirect_cash_costs: 20, ar_ending: 15, cash_reserve: 50 };

function packet(id, { inputs = populated(), actuals = [], plans, record, dirty = false, conflict = false } = {}) {
  const rec = record === undefined ? { id: 'p', schema_version: 2, status: 'draft', notes: null, inputs } : record;
  const list = plans || (rec ? [rec] : []);
  const result = inputs ? calculatePlan(inputs) : null;
  const view = inputs && result ? buildFinanceView({ meta: { label: 'Stored plan', data_class: 'stored' }, inputs }, result, 'stage_2') : null;
  const support = buildDecisionSupport({ view, result, inputs, actuals, plans: list });
  return { support, result, report: buildFinanceReport({ id, support, view, result, inputs, record: rec, generatedAt: '2026-10-03T12:00:00.000Z', dirty, conflict }) };
}

function strings(value, out = []) {
  if (typeof value === 'string') out.push(value);
  else if (Array.isArray(value)) value.forEach((v) => strings(v, out));
  else if (value && typeof value === 'object') Object.values(value).forEach((v) => strings(v, out));
  return out;
}

const stripCode = (src) => src
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/(^|[^:])\/\/.*$/gm, '$1')
  .replace(/`(?:\\.|[^`\\])*`/g, '``')
  .replace(/'(?:\\.|[^'\\\n])*'/g, "''")
  .replace(/"(?:\\.|[^"\\\n])*"/g, '""');

describe('stage D extra: unknown stays -- and notices', () => {
  it('null, empty, and missing plan fields render -- in the assumptions and working-capital reports', () => {
    const { report } = packet('assumptions', { record: { id: 'p', schema_version: null, status: 'draft', notes: '', inputs: populated() } });
    const plan = report.blocks.find((b) => b.title === 'Plan document');
    for (const tid of ['report-plan-notes', 'report-notes', 'report-schema-version']) {
      const row = plan.rows.find((r) => r.testId === tid);
      if (row) assert.equal(row.value, '--', tid);
    }
    const none = packet('working-capital', { actuals: [] }).report;
    const facts = none.blocks.find((b) => b.title === 'Liquidity outputs');
    for (const tid of ['report-actual-ar', 'report-plan-ar', 'report-actual-cash', 'report-plan-cash']) {
      assert.equal(facts.rows.find((r) => r.testId === tid).value, '--', tid);
    }
    assert.equal(packet('monthly-summary', { actuals: [] }).report.context.period, '--');
  });

  it('every report carries the dirty and conflict copy, and clean carries none', () => {
    for (const id of IDS) {
      assert.equal(packet(id).report.notice, null, id);
      assert.match(packet(id, { dirty: true }).report.notice, /include unsaved edits/, id);
      assert.match(packet(id, { conflict: true }).report.notice, /Changed elsewhere/, id);
      const both = packet(id, { dirty: true, conflict: true }).report.notice;
      assert.match(both, /Changed elsewhere/);
      assert.match(both, /unsaved edits are kept in Guided/);
      assert.notEqual(packet(id, { conflict: true }).report.notice, packet(id, { dirty: true }).report.notice);
    }
  });
});

describe('stage D extra: facts that must never become values', () => {
  it('Invoiced Amount and Cash Collected are unavailable / not connected wherever they appear', () => {
    const withActual = [{ month: '2026-01-01', comparison_plan_id: 'p', total_revenue: 5, source: 'manual_entry' }];
    for (const id of IDS) {
      const { report } = packet(id, { actuals: withActual });
      const rows = [];
      const walk = (v) => {
        if (Array.isArray(v)) v.forEach(walk);
        else if (v && typeof v === 'object') {
          if (typeof v.label === 'string' && /invoiced|cash collected/i.test(v.label) && 'value' in v) rows.push(v);
          Object.values(v).forEach(walk);
        }
      };
      walk(report);
      for (const r of rows) assert.equal(r.value, 'unavailable / not connected', `${id} ${r.label}`);
    }
    for (const id of ['monthly-summary', 'owner-operating', 'working-capital']) {
      const { report } = packet(id, { actuals: withActual });
      const block = report.blocks.find((b) => b.title === 'Not connected');
      assert.ok(block, `${id} lacks the Not connected block`);
      assert.deepEqual(block.rows.map((r) => r.value), ['unavailable / not connected', 'unavailable / not connected']);
    }
  });

  it('no actual month means Actual earned revenue stays -- and no appointment price substitutes', () => {
    const { report } = packet('owner-operating', { actuals: [] });
    const row = report.blocks[0].rows.find((r) => r.testId === 'report-actual-earned-revenue');
    assert.equal(row.value, '--');
    const monthly = packet('monthly-summary', { actuals: [] }).report;
    assert.ok(strings(monthly).some((s) => /not earned operating revenue/.test(s)));
    assert.ok(strings(report).some((s) => /not earned operating revenue/.test(s)), 'owner report keeps the appointment boundary');
  });

  it('no report in any state contains a score, grade, rating, health, or advisor word', () => {
    const actuals = [{ month: '2026-01-01', comparison_plan_id: 'p', ...FULL, source: 'manual_entry' }];
    for (const id of IDS) {
      for (const state of [{ inputs: populated(), actuals }, { inputs: blankPlanInputs(), actuals: [] }]) {
        const text = strings(packet(id, state).report).join('\n');
        assert.equal(/\b(score|grade|rating|health|advisor)\b/i.test(text), false, id);
      }
    }
  });
});

describe('stage D extra: derived metrics and table shape', () => {
  it('Plan vs Actual derived rows use the matching source: actual vs the locked plan month, by metric', () => {
    const inputs = populated();
    inputs.monthly_basis = { '2026-01-01': { ...FULL } };
    const rec = { id: 'p', schema_version: 2, status: 'approved', notes: null, inputs };
    const actuals = [{ month: '2026-01-01', comparison_plan_id: 'p', ...FULL, total_revenue: 90, ar_ending: 9, cash_reserve: 45, source: 'manual_entry' }];
    const { report } = packet('plan-vs-actual', { inputs, actuals, record: rec });
    const m = report.blocks.find((b) => b.title === '2026-01');
    const pick = (rows, label) => rows.find((r) => r.label === label).value;
    assert.equal(pick(m.actualDerived, 'Average ticket'), '$4.50');
    assert.equal(pick(m.plannedDerived, 'Average ticket'), '$5.00');
    assert.equal(pick(m.actualDerived, 'AR / revenue'), '10.00%');
    assert.equal(pick(m.plannedDerived, 'AR / revenue'), '15.00%');
    assert.equal(pick(m.actualDerived, 'Cash reserve / revenue'), '50.00%');
    assert.equal(pick(m.plannedDerived, 'Cash reserve / revenue'), '50.00%');
    assert.equal(pick(m.actualDerived, 'Direct share'), '100.00%');
    assert.equal(pick(m.plannedDerived, 'Direct share'), '90.00%');
    assert.equal(pick(m.plannedDerived, 'Jobs per productive hour'), '0.50');
    // plan month with no stored facts: every planned derived metric is --
    const noBasis = packet('plan-vs-actual', { inputs, actuals: [{ ...actuals[0], month: '2026-03-01' }], record: rec }).report.blocks[0];
    for (const r of noBasis.plannedDerived) assert.equal(r.value, '--', r.label);
    // actual with null jobs: jobs per hour and average ticket stay --
    const nulls = packet('plan-vs-actual', { inputs, actuals: [{ ...actuals[0], total_jobs: null }], record: rec }).report.blocks[0];
    assert.equal(pick(nulls.actualDerived, 'Average ticket'), '--');
    assert.equal(pick(nulls.actualDerived, 'Jobs per productive hour'), '--');
  });

  it('every grid table row has one cell per data column, and pricing includes signed variance', () => {
    for (const id of IDS) {
      const { report } = packet(id, { inputs: populated(true) });
      for (const b of report.blocks.filter((x) => x.type === 'table')) {
        for (const r of b.rows) assert.equal(r.cells.length, b.columns.length - 1, `${id} ${b.title} ${r.label}`);
      }
    }
    const pricing = packet('pricing-economics', { inputs: populated(true) }).report.blocks.find((b) => b.testId === 'report-services');
    assert.equal(pricing.columns[pricing.columns.length - 1], 'Signed variance');
    assert.ok(pricing.rows.length > 0);
  });

  it('cost table labels map to the engine field of the same name, per stage', () => {
    const { report, result } = packet('cost-structure', { inputs: populated(true) });
    const table = report.blocks.find((b) => b.testId === 'report-cost-table');
    const map = {
      'Hired field payroll': 'hiredFieldPayroll', 'Support payroll': 'supportPayroll', 'Direct production, non-labor': 'directProductionNonLabor',
      'Indirect field': 'indirectField', 'G&A': 'ga', Sales: 'sales', Insurance: 'insurance', 'Indirect non-labor': 'indirectNonLabor',
      'Owner management compensation': 'ownerManagementComp', 'Owner field reserve': 'ownerFieldReplacement',
      'Cash operating cost': 'cashOperatingCost', 'Economic operating cost': 'economicOperatingCost',
    };
    const stageKeys = ['stage_0', 'stage_1', 'stage_2', 'stage_3', 'stage_3_core', 'stage_3_plus_hvac'];
    assert.equal(table.rows.length, Object.keys(map).length);
    for (const row of table.rows) {
      stageKeys.forEach((sk, idx) => {
        const raw = result.stages[sk][map[row.label]];
        assert.equal(row.cells[idx], showMoney(raw ?? null), `${row.label} ${sk}`);
      });
    }
    assert.notEqual(result.stages.stage_2.ga, result.stages.stage_2.sales, 'precondition: distinct values');
  });

  it('uses the Executive readiness labels and names Stage 3 + HVAC as future licensing dependent', () => {
    const support = {
      latest: { label: '2026-02', basisCopy: 'Only a planned figure has a plan and a variance. A blank plan figure is not zero.', rows: [], comparisonPlanId: 'historical', schemaVersion: 2 },
      stageLabel: 'Stage 2',
      requiredMonthlyRevenue: '--',
      cashOperatingCost: '--',
      economicOperatingCost: '--',
      liquidity: '--',
      readiness: 'NotReady',
      utilizationBand: 'below_near',
      productiveHours: '--',
      perHour: '--',
      fieldHeadcount: '--',
      ownerFieldReserve: '--',
      hiredFieldPayroll: '--',
      exceptions: [{ text: 'Stage 2: NotReady' }, { text: 'Utilization band: below_near' }],
      appointmentBoundary: 'Scheduled appointment price is not earned operating revenue. This screen does not use it.',
      unconnected: [],
      hvacRevenue: 'HVAC revenue: not provided',
      advisory: 'Readiness is advisory planning output only.',
      assumptions: [],
      weightedDso: '--',
      estimatedAr: '--',
      operatingCashFloat: '--',
    };
    const owner = strings(buildFinanceReport({
      id: 'owner-operating', support, view: null, result: null, inputs: null, record: null,
      generatedAt: '2026-10-03T12:00:00.000Z', dirty: false, conflict: false,
    })).join('\n');
    assert.equal(owner.includes('NotReady'), false);
    assert.equal(owner.includes('below_near'), false);
    assert.match(owner, /Not ready/);
    assert.match(owner, /Below near capacity/);
    assert.match(owner, /historical/);
    assert.equal(owner.includes('Historical'), false);
    const growth = buildFinanceReport({
      id: 'growth-readiness',
      support,
      view: {
        stages: [{ label: 'Stage 2', requiredRevenue: '--', cash: '--', economic: '--', liquidity: '--', readiness: 'near_capacity', hurdle: '--' }],
        hvacEnabled: false,
        hvacDisabledCopy: 'Not enabled — HVAC delivery not authorized in plan',
      },
      result: null,
      inputs: null,
      record: null,
      generatedAt: '2026-10-03T12:00:00.000Z',
      dirty: false,
      conflict: false,
    });
    const stage = growth.blocks.find((block) => block.testId === 'report-stage-readiness');
    assert.equal(stage.rows[0].cells[4], 'Near capacity');
    assert.equal(strings(growth).join('\n').includes('near_capacity'), false);
    const cost = packet('cost-structure').report.blocks.find((block) => block.testId === 'report-cost-table');
    assert.match(cost.columns.join('\n'), /Stage 3 \+ HVAC \(Future\/Licensing Dependent HVAC\)/);
  });
});

describe('stage D extra: source-level guards', () => {
  const reports = read('src/lib/finance/reports.js');
  const screen = read('src/pages/finance/FinanceReports.jsx');
  const shell = read('src/pages/finance/FinanceShell.jsx');

  it('no division, network, storage, or raw-HTML primitive appears in report code', () => {
    for (const [name, src] of [['reports.js', reports], ['FinanceReports.jsx', screen]]) {
      const code = stripCode(src);
      assert.equal(/[A-Za-z0-9_)\]]\s*\/\s*[A-Za-z0-9_(]/.test(code.replace(/<\/?[A-Za-z][^>]*>/g, '')), false, `${name} has a division or ratio`);
      for (const bad of ['fetch(', 'XMLHttpRequest', 'localStorage', 'sessionStorage', 'dangerouslySetInnerHTML', 'innerHTML', 'window.open', 'window.print', 'document.write', '.rpc(', '.insert(', '.update(', '.upsert(', '.delete(', 'indexedDB', 'sendBeacon']) {
        assert.equal(code.includes(bad), false, `${name} ${bad}`);
      }
    }
    assert.equal(/\bga\b[^\n]*requiredMonthlyRevenue|requiredMonthlyRevenue[^\n]*\bga\b/.test(stripCode(reports).replace(/\['ga'[^\n]*\]/g, '')), false);
  });

  it('the shell hands the report screen the live dirty and conflict flags', () => {
    const block = shell.match(/<FinanceReportScreen[\s\S]*?\/>/)[0];
    assert.match(block, /dirty=\{dirty\}/);
    assert.match(block, /conflict=\{conflict\}/);
    assert.match(block, /record=\{record\}/);
    assert.match(block, /support=\{support\}/);
  });

  it('print css hides only data-print-hide, and the report navigation carries that attribute', () => {
    const css = screen.match(/const PRINT_CSS = `([\s\S]*?)`;/)[1];
    assert.equal((css.match(/display:\s*none/g) || []).length, 1);
    assert.match(css, /\[data-print-hide\]\s*\{\s*display:\s*none/);
    assert.match(css, /thead\s*\{\s*display:\s*table-header-group/);
    assert.match(css, /\.report-block\s*\{[^}]*break-inside:\s*avoid/);
    assert.equal(/\.report-month[^{]*\{[^}]*break-inside:\s*avoid/.test(css), false);
    assert.match(css, /tr,\s*th,\s*td\s*\{[^}]*break-inside:\s*avoid/);
    // the single element holding Back, All reports, and the preset nav is print-hidden
    assert.match(screen, /<div className="[^"]*" data-print-hide="true">\s*<div className="flex flex-wrap items-center gap-3">/);
    assert.match(screen, /aria-label="Reports"/);
    assert.equal(/report-hvac|Licensing/.test(css), false, 'print css never targets the HVAC flag');
    assert.equal((screen.match(/data-print-hide/g) || []).length, 2, 'only the nav wrapper and the css selector');
  });

  it('the header prints a client-clock timestamp and the notice', () => {
    assert.match(screen, /useState\(\(\) => new Date\(\)\.toISOString\(\)\)/);
    assert.match(screen, /Generated <time[^>]*dateTime=\{report\.generatedAt\}>\{report\.generatedAt\}<\/time>/);
    assert.match(screen, /report\.notice \? <p[^>]*data-testid="finance-report-notice">\{report\.notice\}<\/p> : null/);
    assert.match(screen, /data-testid="finance-report-plan-context"/);
    assert.match(screen, /data-testid="finance-report-basis"/);
    assert.match(screen, /data-testid="finance-report-period"/);
  });

  it('print css lets wide tables fit the page', () => {
    const css = screen.match(/const PRINT_CSS = `([\s\S]*?)`;/)[1];
    assert.match(css, /overflow(-x)?:\s*visible/);
    assert.match(css, /font-size:\s*10px/);
    assert.match(css, /table-layout:\s*fixed/);
  });
});

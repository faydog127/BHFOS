/**
 * Proposed additional Stage C2 tests (Challenge review of 3ff0f04).
 * Drop into command-center/tests/unit/ and append to test:finance.
 * Kills mutants that the shipped finance-modes.test.mjs lets survive.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import { blankPlanInputs } from '../../src/lib/finance/blankPlan.js';
import { calculatePlan } from '../../src/lib/finance/calculate.js';
import { buildDecisionSupport } from '../../src/lib/finance/modes.js';
import { buildFinanceView } from '../../src/lib/finance/viewModel.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const read = (p) => readFileSync(path.join(root, p), 'utf8');
const shell = read('src/pages/finance/FinanceShell.jsx');
const modes = read('src/lib/finance/modes.js');
const ui = read('src/pages/finance/FinanceModes.jsx');
const stripClass = (s) => s.replace(/className=(\{`[^`]*`\}|"[^"]*"|'[^']*')/g, '').replace(/\/\/.*$/gm, '');

function support(basis, actuals, plans) {
  const inputs = { ...blankPlanInputs(), monthly_basis: basis };
  const result = calculatePlan(inputs);
  const view = buildFinanceView({ meta: { label: 'Stored plan', data_class: 'stored' }, inputs }, result, 'stage_2');
  return buildDecisionSupport({ view, result, inputs, actuals, plans });
}

describe('C2 extra: mode invariance is structural, not a tautology', () => {
  it('Shell builds support once, with no mode argument or mode dependency', () => {
    assert.match(shell, /buildDecisionSupport\(\{ view, result, inputs, actuals, plans \}\)/);
    const memo = shell.slice(shell.indexOf('const support = useMemo('), shell.indexOf('function selectFinanceMode'));
    assert.equal(/\bmode\b/.test(memo), false, 'support must not depend on mode');
  });

  it('selectFinanceMode is exactly one setMode call and setMode has no other caller', () => {
    const start = shell.indexOf('function selectFinanceMode');
    const body = shell.slice(start, shell.indexOf('}', start) + 1).replace(/\s+/g, ' ');
    assert.equal(body, 'function selectFinanceMode(next) { setMode(normalizeFinanceMode(next)); }');
    assert.equal((shell.match(/\bsetMode\(/g) || []).length, 1);
  });

  it('support carries no score, rating, grade, or health key at any depth', () => {
    const s = support({}, [], []);
    const keys = [];
    (function walk(v, p) {
      if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) { keys.push(k); walk(x, p + '.' + k); }
    })(s, '');
    assert.deepEqual(keys.filter((k) => /score|health|^rank|^rating$|^grade$/i.test(k)), []);
  });

  it('check-in route renders MonthlyCheckIn unconditionally on mode', () => {
    assert.match(shell, /\{section === 'checkin' \? \(\s*<MonthlyCheckIn/);
  });
});

describe('C2 extra: presentation components stay formatting-only', () => {
  it('no arithmetic, Math, reduce, null-to-zero, or numeric literal passed to a formatter in the new files', () => {
    for (const [name, src] of [['modes.js', modes], ['FinanceModes.jsx', ui]]) {
      const code = stripClass(src).replace(/'[^'\n]*'|"[^"\n]*"|`[^`]*`/g, "''");
      assert.equal(/Math\./.test(code), false, `${name}: Math`);
      assert.equal(/\.reduce\(/.test(code), false, `${name}: reduce`);
      assert.equal(/\?\?\s*0\b|\|\|\s*0\b/.test(code), false, `${name}: null-to-zero`);
      assert.equal(/show(Money|Cents|Hours)\(\s*-?\d/.test(code), false, `${name}: literal into formatter`);
      // binary * and / on identifiers/calls (regex literals and JSX closers excluded by construction)
      assert.equal(/[A-Za-z0-9_)\]]\s[*/]\s[A-Za-z0-9_(]/.test(code), false, `${name}: multiply or divide`);
    }
  });

  it('chart row builders only rename or select fields', () => {
    const rows = ui.split('<SeriesChart').slice(1).map((chunk) => chunk.slice(chunk.indexOf('rows={'), chunk.indexOf('bars=')));
    assert.equal(rows.length, 5);
    for (const r of rows) assert.equal(/[*/+]|\?\?|\|\|/.test(r.replace(/=>/g, '')), false, r);
  });

  it('new files never touch the network, storage, or appointment price', () => {
    for (const src of [modes, ui]) {
      for (const bad of ['fetch(', 'localStorage', 'sessionStorage', 'supabase', 'rpc(', 'scheduled_price', 'pricing_snapshot', 'appointment_price']) {
        assert.equal(src.includes(bad), false, bad);
      }
    }
    assert.match(modes, /APPOINTMENT_PRICE_BOUNDARY/);
  });

  it('Executive and Advanced views contain no editing controls', () => {
    const exec = ui.slice(ui.indexOf('export function ExecutiveView'));
    assert.equal(/<(input|textarea|select)\b/.test(exec), false);
    assert.equal(/<(input|textarea|select)\b/.test(ui.slice(ui.indexOf('function ComparisonTable'), ui.indexOf('export function ExecutiveView'))), false);
  });

  it('Guided still renders every pre-C2 section and the monthly basis editor', () => {
    for (const id of ['people', 'trucks', 'office', 'growth', 'production', 'pricing', 'stages']) {
      assert.match(shell, new RegExp(`section === '${id}' \\?`), id);
    }
    assert.match(shell, /section === 'overview' \? <Overview/);
    assert.match(shell, /<MonthlyBasisEditor inputs=\{inputs\} onPatch=\{patchMonthlyBasis\} \/>/);
    assert.match(shell, /<GuidedBrief section=\{section\} \/>\s*<div className="mb-4 flex/);
  });
});

describe('C2 extra: comparison plan identity', () => {
  const withBasis = { id: 'cur', schema_version: 2, status: 'approved', inputs: { monthly_basis: { '2026-02-01': { total_revenue: 99, cash_reserve: 7 } } } };

  it('an actual whose comparison plan is missing from the list gets no plan, even when other plans have a basis', () => {
    const s = support({}, [{ month: '2026-02-01', comparison_plan_id: 'gone', total_revenue: 4 }], [withBasis]);
    assert.equal(s.latest.basisKind, 'no_comparison_plan');
    assert.equal(s.latest.rows.find((r) => r.key === 'total_revenue').plan.display, '--');
    assert.equal(s.plannedDerived, null);
  });

  it('an unassociated actual never borrows the newest plan', () => {
    const s = support({}, [{ month: '2026-02-01', comparison_plan_id: null, total_revenue: 4 }], [withBasis]);
    assert.equal(s.latest.basisKind, 'no_comparison_plan');
    assert.equal(s.latest.rows.every((r) => r.plan.display === '--' && r.variance.display === '--'), true);
  });

  it('planned derived metrics come from the associated plan, not the first plan in the list', () => {
    const mine = { id: 'mine', schema_version: 2, status: 'superseded', inputs: { monthly_basis: { '2026-02-01': { total_revenue: 10, productive_unit_hours: 2 } } } };
    const other = { id: 'other', schema_version: 2, status: 'approved', inputs: { monthly_basis: { '2026-02-01': { total_revenue: 1000, productive_unit_hours: 2 } } } };
    const s = support({}, [{ month: '2026-02-01', comparison_plan_id: 'mine', total_revenue: 4 }], [other, mine]);
    assert.equal(s.plannedDerived.revenuePerHour, '$5.00');
  });

  it('a v2 plan with an empty basis shows -- for plan and variance and keeps the actual', () => {
    const empty = { id: 'e', schema_version: 2, status: 'draft', inputs: { monthly_basis: {} } };
    const s = support({}, [{ month: '2026-02-01', comparison_plan_id: 'e', total_revenue: '4.00', cash_reserve: '0.00' }], [empty]);
    const rev = s.latest.rows.find((r) => r.key === 'total_revenue');
    assert.deepEqual([rev.plan.display, rev.actual.display, rev.variance.display], ['--', '$4.00', '--']);
    const cash = s.latest.rows.find((r) => r.key === 'cash_reserve');
    assert.deepEqual([cash.plan.display, cash.actual.display, cash.variance.display], ['--', '$0.00', '--']);
  });

  it('charts receive null, not zero, for an unplanned or missing month figure', () => {
    const p = { id: 'p', schema_version: 2, status: 'approved', inputs: { monthly_basis: { '2026-02-01': { cash_reserve: 0 } } } };
    const s = support({}, [{ month: '2026-02-01', comparison_plan_id: 'p', total_revenue: null }, { month: '2026-03-01', comparison_plan_id: 'p', total_revenue: 5 }], [p]);
    assert.deepEqual(s.revenueHistory.map((r) => [r.plan, r.actual]), [[null, null], [null, 5]]);
    assert.equal(s.channelActuals.every((c) => c.value === null), true);
  });

  it('unconnected facts never show a number', () => {
    const s = support({}, [], []);
    assert.deepEqual(s.unconnected.map((u) => u.display), ['unavailable / not connected', 'unavailable / not connected']);
    assert.equal(s.unconnected.some((u) => /\d/.test(u.display)), false);
  });
});

describe('C2 extra: unsaved edits and conflict are visible outside Guided (finding F1)', () => {
  it('Executive and Advanced show a notice when dirty or conflict is set', () => {
    assert.match(shell, /mode !== 'guided' && \(dirty \|\| conflict\)/);
    assert.match(shell, /finance-unsaved-in-readonly-mode/);
  });
});

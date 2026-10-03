/**
 * Proposed Stage C2 RECHECK tests (Challenge re-check of 7f4bce3a / impl 122a000c).
 * Drop into command-center/tests/unit/ and append to test:finance.
 * Kills the F1/F4/F5/F6/F7 mutants that the shipped unit tests let survive
 * (they were covered only by the Playwright spec, which is not in CI).
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import { buildDecisionSupport } from '../../src/lib/finance/modes.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const read = (p) => readFileSync(path.join(root, p), 'utf8');
const shell = read('src/pages/finance/FinanceShell.jsx');
const ui = read('src/pages/finance/FinanceModes.jsx');

function bannerBlock() {
  const start = shell.indexOf('data-testid="finance-unsaved-in-readonly-mode"');
  assert.ok(start > 0, 'banner exists');
  const open = shell.lastIndexOf('<div', start);
  const close = shell.indexOf('</div>', start);
  return shell.slice(open, close + 6);
}

describe('C2 recheck extra: F1 banner is a pointer back, never an action', () => {
  it('banner has exactly one button, which only selects Guided', () => {
    const block = bannerBlock();
    assert.equal((block.match(/<button/g) || []).length, 1);
    assert.match(block, /min-h-11/);
    assert.match(block, /onClick=\{\(\) => selectFinanceMode\('guided'\)\}>Open Guided<\/button>/);
    assert.match(block, /'Changed elsewhere\. Your unsaved edits are kept in Guided\. These figures include them\.'/);
    assert.match(block, /'Changed elsewhere\. Return to Guided to reload the latest plan\.'/);
    assert.match(block, /'These figures include unsaved edits\. Return to Guided to save or discard them\.'/);
    for (const forbidden of [/onSave/, /onReload/, /onDiscard/, /onApprove/, /setConflict/, /setDirty/, /finance-save/, /Save</, /Discard</, /Reload</]) {
      assert.equal(forbidden.test(block), false, `banner must not contain ${forbidden}`);
    }
  });

  it('banner is gated on a plan being ready, not Check-In, a non-Guided mode, and dirty OR conflict', () => {
    const gate = shell.slice(shell.lastIndexOf('{planReady', shell.indexOf('data-testid="finance-unsaved-in-readonly-mode"')), shell.indexOf('data-testid="finance-unsaved-in-readonly-mode"'));
    assert.match(gate, /planReady && section !== 'checkin' && mode !== 'guided' && \(dirty \|\| conflict\)/);
  });

  it('header copy never says the figures are the stored plan outside Guided', () => {
    assert.match(shell, /mode === 'guided' \|\| section === 'checkin' \? 'What this section is, what you can change, and what the formulas return\.' : 'Read from the plan on this screen and Monthly Check-In\. Switching mode does not save\.'/);
    assert.equal(/Read from the stored plan/.test(shell), false);
  });
});

describe('C2 recheck extra: F4 mode switch and Back/Next placement', () => {
  it('ModeSwitch in the main header is hidden on Check-In', () => {
    assert.match(shell, /\{section !== 'checkin' \? <ModeSwitch mode=\{mode\} onMode=\{selectFinanceMode\} \/> : null\}/);
  });

  it('Back and Next render only in Guided', () => {
    const at = shell.indexOf('label="Back"');
    assert.ok(at > 0);
    const before = shell.slice(Math.max(0, at - 400), at);
    assert.match(before, /\{mode === 'guided' \|\| section === 'checkin' \? \(\s*<div className="mt-8 flex justify-between text-sm">\s*<SectionLink[^>]*$/);
  });
});

describe('C2 recheck extra: F5/F7 presentation guards', () => {
  it('every SeriesChart is wrapped with a No data caption keyed on all-null or empty rows', () => {
    assert.match(ui, /const empty = !rows\.length \|\| rows\.every\(\(row\) => bars\.every\(\(bar\) => row\[bar\.key\] === null \|\| row\[bar\.key\] === undefined\)\);/);
    assert.match(ui, /\{empty \? <p [^>]*data-testid=\{`\$\{testId\}-empty`\}>No data<\/p> : null\}/);
  });

  it('money charts built from cents use showCents tooltips; stage charts keep whole-dollar default', () => {
    for (const id of ['advanced-price-chart', 'advanced-history-chart', 'advanced-channel-chart']) {
      const at = ui.indexOf(`testId="${id}"`);
      if (at < 0) continue;
      const chart = ui.slice(at, ui.indexOf('/>', at));
      assert.match(chart, /formatValue=\{showCents\}/, `${id} formats tooltip in cents`);
    }
    const hist = ui.indexOf("name: 'Plan revenue'");
    assert.ok(hist > 0);
    assert.match(ui.slice(hist, ui.indexOf('/>', hist)), /formatValue=\{showCents\}/);
    assert.match(ui, /formatValue = showMoney/);
    assert.match(ui, /<Tooltip formatter=\{\(value\) => formatValue\(value\)\} \/>/);
  });

  it('edit-in-Guided button is at least 44px and approved plans say New draft', () => {
    const at = ui.indexOf('function EditInGuided');
    const body = ui.slice(at, ui.indexOf('\n}\n', at));
    assert.match(body, /min-h-11/);
    assert.match(body, /Open Guided — approved plan: use New draft to edit/);
    assert.match(body, /planStatus === 'draft'/);
  });

  it('presentLabel is applied to readiness, utilization, labels and exception text, and maps the raw tokens', () => {
    for (const token of ['NotReady', 'below_near', 'near_capacity', 'at_or_over_capacity']) assert.match(ui, new RegExp(token));
    assert.match(ui, /presentLabel\(support\.readiness\)/);
    assert.match(ui, /presentLabel\(support\.utilizationBand\)/);
    assert.match(ui, /presentLabel\(item\.text\)/);
    assert.match(ui, /presentLabel\(row\.readiness\)/);
    assert.match(ui, /function presentLabel\(value\) \{\s*if \(typeof value !== 'string'/);
  });
});

describe('C2 recheck extra: F6 measure() never turns a non-number into zero', () => {
  const unknown = [' ', '   ', '', [], [5], false, true, {}, null, undefined, Number.NaN, 'NaN', Infinity, -Infinity, 'Infinity', '-Infinity', 'abc'];
  const known = [['5', 5, '$5.00'], [5, 5, '$5.00'], [0, 0, '$0.00'], ['0', 0, '$0.00'], ['4.00', 4, '$4.00'], [' 4.00 ', 4, '$4.00']];
  function rowFor(v) {
    const actual = { month: '2026-02-01', comparison_plan_id: 'p', total_revenue: v };
    const plan = { id: 'p', schema_version: 2, status: 'approved', inputs: { monthly_basis: { '2026-02-01': { total_revenue: v } } } };
    const s = buildDecisionSupport({ view: null, result: null, inputs: null, plans: [plan], actuals: [actual] });
    return s.latest.rows.find((r) => r.key === 'total_revenue');
  }
  it('unknown inputs show -- and a null value on both actual and plan', () => {
    for (const v of unknown) {
      const row = rowFor(v);
      assert.equal(row.actual.display, '--', `actual ${String(v)}`);
      assert.equal(row.plan.display, '--', `plan ${String(v)}`);
      assert.equal(row.actual.value, null);
      assert.equal(row.plan.value, null);
    }
  });
  it('real numbers, including a real zero, still display', () => {
    for (const [v, n, shown] of known) {
      const row = rowFor(v);
      assert.equal(row.actual.value, n);
      assert.equal(row.actual.display, shown);
      assert.equal(row.plan.display, shown);
    }
  });
});

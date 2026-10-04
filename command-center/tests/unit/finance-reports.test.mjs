/**
 * Stage D reports. Packets copy the existing selectors.
 * Run with: npm run test:finance
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import { blankPlanInputs } from '../../src/lib/finance/blankPlan.js';
import { calculatePlan } from '../../src/lib/finance/calculate.js';
import { FINANCE_MODES, buildDecisionSupport } from '../../src/lib/finance/modes.js';
import { FINANCE_REPORT_PRESETS, HVAC_REPORT_HEADING, buildFinanceReport } from '../../src/lib/finance/reports.js';
import { buildFinanceView } from '../../src/lib/finance/viewModel.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const read = (p) => readFileSync(path.join(root, p), 'utf8');

function packetFor(inputs, actuals, plans, record, id) {
  const result = inputs ? calculatePlan(inputs) : null;
  const view = inputs && result
    ? buildFinanceView({ meta: { label: 'Stored plan', data_class: 'stored' }, inputs }, result, 'stage_2')
    : null;
  const support = buildDecisionSupport({ view, result, inputs, actuals, plans });
  return {
    support,
    report: buildFinanceReport({
      id,
      support,
      view,
      result,
      inputs,
      record,
      generatedAt: '2026-10-03T12:00:00.000Z',
      dirty: false,
      conflict: false,
    }),
  };
}

function walkText(value, out = []) {
  if (typeof value === 'string') out.push(value);
  else if (Array.isArray(value)) value.forEach((item) => walkText(item, out));
  else if (value && typeof value === 'object') Object.values(value).forEach((item) => walkText(item, out));
  return out;
}

function cell(report, tableId, rowLabel, columnIndex) {
  const table = report.blocks.find((block) => block.testId === tableId);
  const row = table.rows.find((item) => item.label === rowLabel);
  return row.cells[columnIndex];
}

describe('finance reports', () => {
  it('defines exactly eight presets and does not add a mode', () => {
    assert.deepEqual(FINANCE_REPORT_PRESETS.map((item) => item.title), [
      'Monthly Financial Summary',
      'Owner Operating Report',
      'Cost Structure Report',
      'Growth Readiness Report',
      'Pricing & Service Economics',
      'Working Capital Report',
      'Assumptions Report',
      'Plan vs. Actual',
    ]);
    assert.equal(new Set(FINANCE_REPORT_PRESETS.map((item) => item.id)).size, 8);
    assert.deepEqual(FINANCE_MODES.map((mode) => mode.id), ['guided', 'executive', 'advanced']);
    assert.equal(buildFinanceReport({ id: 'advisor', support: {} }), null);
  });

  it('keeps a version 1 month unknown, a planned zero, and a partial version 2 month', () => {
    const unused = { id: 'newer', schema_version: 2, status: 'approved', inputs: { monthly_basis: { '2026-03-01': { total_revenue: 99 } } } };
    const v1 = { id: 'historical', schema_version: 1, status: 'superseded', inputs: blankPlanInputs() };
    const partial = {
      id: 'partial',
      schema_version: 2,
      status: 'approved',
      inputs: { monthly_basis: { '2026-02-01': { total_revenue: 10.5, cash_reserve: 0 } } },
    };
    const actuals = [
      { month: '2026-01-01', comparison_plan_id: 'historical', total_revenue: 3.1, cash_reserve: 0, source: 'manual_entry' },
      { month: '2026-02-01', comparison_plan_id: 'partial', total_revenue: 4, cash_reserve: 0, total_jobs: 2 },
    ];
    const { support, report } = packetFor(null, actuals, [unused, v1, partial], null, 'plan-vs-actual');
    const january = report.blocks.find((block) => block.title === '2026-01');
    const february = report.blocks.find((block) => block.title === '2026-02');
    const januaryRevenue = january.comparison.rows.find((row) => row.key === 'total_revenue');
    const februaryRevenue = february.comparison.rows.find((row) => row.key === 'total_revenue');
    const februaryCash = february.comparison.rows.find((row) => row.key === 'cash_reserve');
    const februaryJobs = february.comparison.rows.find((row) => row.key === 'total_jobs');
    assert.equal(january.basisKind, 'no_monthly_basis');
    assert.equal(january.basis, 'No declared monthly basis. Plan and variance are not zero.');
    assert.equal(january.comparisonPlan, 'historical');
    assert.equal(january.schemaVersion, '1');
    assert.equal(januaryRevenue.plan, '--');
    assert.equal(januaryRevenue.variance, '--');
    assert.equal(january.comparison.rows.find((row) => row.key === 'cash_reserve').actual, '$0.00');
    assert.equal(february.comparisonPlan, 'partial');
    assert.equal(february.schemaVersion, '2');
    assert.equal(februaryRevenue.plan, '$10.50');
    assert.equal(februaryRevenue.actual, '$4.00');
    assert.equal(februaryRevenue.variance, '-$6.50');
    assert.equal(februaryCash.plan, '$0.00');
    assert.equal(februaryCash.variance, '$0.00');
    assert.equal(februaryJobs.plan, '--');
    assert.equal(februaryJobs.variance, '--');
    assert.equal(january.plannedDerived.find((row) => row.label === 'Revenue per productive hour').value, '--');
    assert.equal(JSON.stringify(report).includes('99'), false);
    assert.equal(support.history[0].comparisonPlanId, 'historical');
    assert.equal(support.history[1].comparisonPlanId, 'partial');
  });

  it('matches the screen strings and does not turn a blank engine value into zero', () => {
    const inputs = blankPlanInputs();
    const record = { id: 'blank', schema_version: 2, status: 'approved', notes: '', inputs };
    const { support, report } = packetFor(inputs, [], [record], record, 'owner-operating');
    const required = report.blocks[0].rows.find((row) => row.testId === 'report-required-revenue');
    assert.equal(required.value, support.requiredMonthlyRevenue);
    assert.equal(required.value, '--');
    const cost = packetFor(inputs, [], [record], record, 'cost-structure').report;
    assert.equal(cell(cost, 'report-cost-table', 'Cash operating cost', 2), '--');
    assert.equal(cell(cost, 'report-cost-table', 'Economic operating cost', 2), '--');
    const text = walkText(report).join('\n');
    assert.equal(/health|score|advisor/i.test(text), false);
    assert.equal(text.includes('Share of required revenue'), false);
  });

  it('shows a planned engine zero as zero and leaves an unstored basis figure blank', () => {
    const inputs = blankPlanInputs();
    inputs.monthly_basis = { '2026-02-01': { total_revenue: 10.5, cash_reserve: 0 } };
    inputs.structural.weeks_per_year = 52;
    inputs.structural.months_per_year = 12;
    inputs.structural.days_per_month_ar = 30;
    for (const stage of Object.values(inputs.stages)) {
      stage.owner_management_comp = 0;
      stage.owner_shadow_hours = 0;
      stage.true_operating_profit_pct = 0;
      stage.growth_reserve_pct = 0;
      stage.bad_debt_warranty_pct = 0;
      stage.unidentified_cost_contingency_pct = 0;
      stage.safety_months = 0;
    }
    inputs.owner_field_replacement = { wage: 0, burden: 0 };
    for (const role of inputs.staffing) {
      role.wage = 0;
      role.burden = 0;
      role.weekly_hours = 0;
      for (const key of Object.keys(role.headcount)) role.headcount[key] = 0;
    }
    for (const group of Object.values(inputs.cost_pools)) {
      for (const line of Object.values(group)) {
        for (const key of Object.keys(line)) line[key] = 0;
      }
    }
    const record = { id: 'zero', schema_version: 2, status: 'approved', inputs };
    const cost = packetFor(inputs, [], [record], record, 'cost-structure').report;
    assert.equal(cell(cost, 'report-cost-table', 'Cash operating cost', 2), '$0');
    const assumptions = packetFor(inputs, [], [record], record, 'assumptions').report;
    const month = assumptions.blocks.find((block) => block.testId === 'report-stored-basis').months[0];
    assert.equal(month.label, '2026-02');
    assert.equal(month.rows.find((row) => row.key === 'total_revenue').value, '$10.50');
    assert.equal(month.rows.find((row) => row.key === 'cash_reserve').value, '$0.00');
    assert.equal(month.rows.find((row) => row.key === 'total_jobs').value, '--');
    assert.equal(JSON.stringify(assumptions).includes('2026-03'), false);
    const v1 = packetFor(blankPlanInputs(), [], [], { id: 'v1', schema_version: 1, status: 'superseded', inputs: { monthly_basis: { '2026-02-01': { total_revenue: 10.5 } } } }, 'assumptions').report;
    const stored = v1.blocks.find((block) => block.testId === 'report-stored-basis');
    assert.equal(stored.months.length, 0);
    assert.equal(walkText(v1).join('\n').includes('No declared monthly basis'), true);
    assert.equal(JSON.stringify(v1).includes('10.5'), false);
    assert.equal(JSON.stringify(v1).includes('$10.50'), false);
  });

  it('names future HVAC and keeps invoiced amount and cash collected unconnected', () => {
    const inputs = blankPlanInputs();
    const record = { id: 'blank', schema_version: 2, status: 'draft', inputs };
    const growth = packetFor(inputs, [], [record], record, 'growth-readiness').report;
    const hvac = growth.blocks.find((block) => block.testId === 'report-hvac');
    assert.equal(hvac.title, HVAC_REPORT_HEADING);
    assert.equal(hvac.rows.find((row) => row.testId === 'report-hvac-name').value, 'Future/Licensing Dependent HVAC');
    assert.equal(hvac.rows.find((row) => row.testId === 'report-hvac-revenue').value, 'HVAC revenue: not provided');
    assert.match(hvac.rows.find((row) => row.testId === 'report-hvac-authorization').value, /HVAC delivery not authorized/);
    const capital = packetFor(inputs, [], [record], record, 'working-capital').report;
    const unconnected = capital.blocks.find((block) => block.title === 'Not connected');
    assert.equal(unconnected.rows.find((row) => row.testId === 'report-unconnected-invoiced_amount').value, 'unavailable / not connected');
    assert.equal(unconnected.rows.find((row) => row.testId === 'report-unconnected-cash_collected').value, 'unavailable / not connected');
    const summary = packetFor(inputs, [], [record], record, 'monthly-summary').report;
    assert.equal(walkText(summary).some((line) => line.includes('not the invoices issued this month')), true);
    assert.equal(walkText(summary).some((line) => line.includes('not earned operating revenue')), true);
  });

  it('does not calculate, write, or duplicate the office share', () => {
    const reports = read('src/lib/finance/reports.js');
    const screen = read('src/pages/finance/FinanceReports.jsx');
    const shell = read('src/pages/finance/FinanceShell.jsx');
    for (const forbidden of ['calculatePlan', 'variance(', 'div(', 'Share of required revenue', 'function share', 'healthScore', 'Advisor', 'supabase', 'saveDraft', 'createMonthlyActual']) {
      assert.equal(reports.includes(forbidden), false, forbidden);
      assert.equal(screen.includes(forbidden), false, `screen ${forbidden}`);
    }
    for (const forbidden of ['<input', '<textarea', '<select', 'ModeSwitch', 'showMoney', 'showCents', 'formatCurrency']) {
      assert.equal(screen.includes(forbidden), false, forbidden);
    }
    assert.match(screen, /@media print/);
    assert.match(screen, /\[data-print-hide\]/);
    assert.match(screen, /break-inside:\s*avoid/);
    assert.match(shell, /reportIdFromPath/);
    assert.match(shell, /if \(reportId\)/);
    assert.equal(shell.includes("id: 'reports'"), false);
    assert.equal((shell.match(/\bsetMode\(/g) || []).length, 1);
  });
});

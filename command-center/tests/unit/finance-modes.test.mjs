/**
 * Stage C2 presentation. Modes do not change figures or write.
 * Run with: npm run test:finance
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import { blankPlanInputs } from '../../src/lib/finance/blankPlan.js';
import { calculatePlan } from '../../src/lib/finance/calculate.js';
import {
  FINANCE_MODES,
  buildDecisionSupport,
  factsForMode,
  normalizeFinanceMode,
} from '../../src/lib/finance/modes.js';
import { buildFinanceView } from '../../src/lib/finance/viewModel.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

function zeroPlan() {
  const inputs = { ...blankPlanInputs(), monthly_basis: { '2026-02-01': { total_revenue: 10.5, cash_reserve: 0 } } };
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
    stage.revenue_producing_units = 0;
    stage.working_days_per_month = 20;
    stage.utilization = 0;
    stage.productive_hours_per_realized_day = 0;
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
  return inputs;
}

function supportFor(inputs, actuals, plans) {
  const result = calculatePlan(inputs);
  const view = buildFinanceView({ meta: { label: 'Stored plan', data_class: 'stored' }, inputs }, result, 'stage_2');
  return buildDecisionSupport({ view, result, inputs, actuals, plans });
}

describe('finance presentation modes', () => {
  it('defines exactly three modes and no advisor mode', () => {
    assert.deepEqual(FINANCE_MODES.map((mode) => mode.id), ['guided', 'executive', 'advanced']);
    assert.equal(FINANCE_MODES.some((mode) => /advisor/i.test(mode.id) || /advisor/i.test(mode.label)), false);
    assert.equal(normalizeFinanceMode('executive'), 'executive');
    assert.equal(normalizeFinanceMode('advisor'), 'guided');
    assert.equal(normalizeFinanceMode(''), 'guided');
  });

  it('keeps the same support object in every mode', () => {
    const inputs = zeroPlan();
    const plans = [
      { id: 'old', schema_version: 2, status: 'superseded', inputs: { ...inputs, monthly_basis: { '2026-01-01': {} } } },
      { id: 'new', schema_version: 2, status: 'approved', inputs },
    ];
    const actuals = [
      { month: '2026-01-01', comparison_plan_id: 'old', total_revenue: '3.10', cash_reserve: '0.00', total_jobs: 2, productive_unit_hours: '1.50' },
      { month: '2026-02-01', comparison_plan_id: 'new', total_revenue: '4.00', cash_reserve: '0.00', total_jobs: 2 },
    ];
    const support = supportFor(inputs, actuals, plans);
    const before = JSON.stringify(support);
    assert.equal(factsForMode(support, 'guided'), support);
    assert.equal(factsForMode(support, 'executive'), support);
    assert.equal(factsForMode(support, 'advanced'), support);
    assert.equal(factsForMode(support, 'advisor'), support);
    assert.equal(JSON.stringify(support), before);
    assert.equal(support.requiredMonthlyRevenue, '$0');
    const stage2 = support.stageSeries.find((row) => row.key === 'stage_2');
    assert.equal(stage2.requiredMonthlyRevenue, 0);
    assert.equal(stage2.requiredDisplay, '$0');
    assert.equal(stage2.cashDisplay, '$0');
  });

  it('keeps planned zero and leaves an unplanned figure blank', () => {
    const inputs = zeroPlan();
    const plans = [{ id: 'new', schema_version: 2, inputs }];
    const support = supportFor(inputs, [
      { month: '2026-02-01', comparison_plan_id: 'new', total_revenue: 4, cash_reserve: 0, total_jobs: 2 },
    ], plans);
    const revenue = support.latest.rows.find((row) => row.key === 'total_revenue');
    const cash = support.latest.rows.find((row) => row.key === 'cash_reserve');
    const jobs = support.latest.rows.find((row) => row.key === 'total_jobs');
    const payroll = support.latest.rows.find((row) => row.key === 'field_payroll');
    assert.equal(revenue.plan.display, '$10.50');
    assert.equal(revenue.actual.display, '$4.00');
    assert.equal(revenue.variance.display, '-$6.50');
    assert.equal(revenue.plan.value, 10.5);
    assert.equal(cash.plan.display, '$0.00');
    assert.equal(cash.plan.value, 0);
    assert.equal(cash.variance.display, '$0.00');
    assert.equal(jobs.plan.display, '--');
    assert.equal(jobs.plan.value, null);
    assert.equal(jobs.variance.display, '--');
    assert.equal(payroll.actual.display, '--');
    assert.equal(payroll.actual.value, null);
    assert.equal(support.latest.basisKind, 'declared_monthly_basis');
  });

  it('uses the associated comparison plan, including a version 1 plan with no monthly basis', () => {
    const unused = { id: 'newer', schema_version: 2, status: 'approved', inputs: { monthly_basis: { '2026-03-01': { total_revenue: 99 } } } };
    const v1 = { id: 'historical', schema_version: 1, status: 'superseded', inputs: blankPlanInputs() };
    const partial = { id: 'partial', schema_version: 2, status: 'approved', inputs: { monthly_basis: { '2026-02-01': { total_revenue: 10.5, cash_reserve: 0 } } } };
    const support = buildDecisionSupport({
      view: null,
      result: null,
      inputs: null,
      plans: [unused, v1, partial],
      actuals: [
        { month: '2026-01-01', comparison_plan_id: 'historical', total_revenue: 3.1, cash_reserve: 0 },
        { month: '2026-02-01', comparison_plan_id: 'partial', total_revenue: 4, cash_reserve: 0, total_jobs: 2 },
      ],
    });
    assert.equal(support.latest.label, '2026-02');
    assert.equal(support.latest.comparisonPlanId, 'partial');
    assert.equal(support.latest.schemaVersion, 2);
    const january = support.history.find((row) => row.label === '2026-01');
    const february = support.history.find((row) => row.label === '2026-02');
    assert.equal(january.basisKind, 'no_monthly_basis');
    assert.equal(january.comparisonPlanId, 'historical');
    assert.equal(january.rows.find((row) => row.key === 'total_revenue').plan.display, '--');
    assert.equal(january.rows.find((row) => row.key === 'total_revenue').variance.display, '--');
    assert.equal(january.rows.find((row) => row.key === 'cash_reserve').actual.display, '$0.00');
    assert.equal(february.rows.find((row) => row.key === 'total_revenue').plan.value, 10.5);
    assert.equal(february.rows.find((row) => row.key === 'total_revenue').variance.display, '-$6.50');
    assert.equal(JSON.stringify(support).includes('99'), false);
    assert.equal(support.revenueHistory[0].plan, null);
    assert.equal(support.revenueHistory[1].plan, 10.5);
    assert.equal(support.revenueHistory[1].actual, 4);
    assert.equal(support.unconnected.map((item) => item.display).join(), 'unavailable / not connected,unavailable / not connected');
  });

  it('does not invent a monthly series for an empty plan', () => {
    const inputs = blankPlanInputs();
    const support = supportFor({ ...inputs, monthly_basis: {} }, [], []);
    assert.equal(support.requiredMonthlyRevenue, '--');
    assert.equal(support.latest.basisKind, 'no_actual');
    assert.equal(support.latest.rows.every((row) => row.plan.display === '--' && row.actual.display === '--'), true);
    assert.equal(support.history.length, 0);
    assert.equal(support.revenueHistory.length, 0);
    assert.equal(support.exceptions.some((item) => item.id === 'inputs'), true);
    assert.equal(support.assumptions.every((item) => item.display === '--'), true);
  });

  it('keeps mode switching out of the write path and out of chart formulas', () => {
    const shell = readFileSync(path.join(root, 'src/pages/finance/FinanceShell.jsx'), 'utf8');
    const modes = readFileSync(path.join(root, 'src/lib/finance/modes.js'), 'utf8');
    const ui = readFileSync(path.join(root, 'src/pages/finance/FinanceModes.jsx'), 'utf8');
    const start = shell.indexOf('function selectFinanceMode');
    const end = shell.indexOf('function patchStage');
    const body = shell.slice(start, end);
    assert.ok(start > -1 && end > start);
    assert.match(body, /setMode\(normalizeFinanceMode\(next\)\)/);
    for (const forbidden of ['saveDraft', 'approvePlan', 'createBlankPlan', 'createMonthlyActual', 'supabase', 'setInputs', 'setDirty', 'setNotes', 'rpc', 'editInputs']) {
      assert.equal(body.includes(forbidden), false, forbidden);
    }
    assert.match(shell, /record\?\.schema_version === 2 && record\.status === 'draft' && section === 'overview'/);
    assert.match(ui, /FINANCE_MODES\.map/);
    assert.equal(ui.includes('Advisor'), false);
    assert.equal(ui.includes('healthScore'), false);
    assert.equal(ui.includes('composite'), false);
    assert.equal(modes.includes('healthScore'), false);
    assert.equal(modes.includes('Advisor'), false);
    assert.equal(/\$\d/.test(modes), false);
    assert.equal(/\$\d/.test(ui), false);
    assert.equal(ui.includes('|| 0'), false);
    assert.equal(modes.includes('|| 0'), false);
    assert.equal(/variance\(/.test(ui), false);
    assert.equal(ui.includes('calculatePlan'), false);
    assert.equal(ui.includes('derivedActualMetrics'), false);
    assert.equal(ui.includes('pricing_snapshot'), false);
    assert.equal(ui.includes('appointments'), false);
    assert.equal(modes.includes('pricing_snapshot'), false);
    assert.equal(modes.includes('appointments'), false);
    assert.equal(ui.includes('persistence'), false);
    assert.equal(modes.includes('supabase'), false);
    assert.match(modes, /plannedFactsForMonth/);
    assert.match(modes, /comparison_plan_id/);
    assert.match(ui, /dataKey=\{bar\.key\}/);
  });
});

/**
 * Private Section 15 check.
 * Loads a JSON planning document from an explicit path and compares the engine
 * to that file's expected block. Prints test identity, PASS/FAIL, and tolerances only.
 *
 * Usage: node tools/finance-verify.mjs <path-to-json>
 */
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';

const CURRENCY = 0.01;
const RATIO = 0.0001;
const HOURS = 0.01;

const HOURS_KEYS = new Set([
  'productive_unit_hours',
  'field_headcount',
  'weighted_dso',
  'travel_hours',
  'site_clock_hours',
  'production_unit_hours',
  'stops',
]);

function kindFor(key) {
  if (HOURS_KEYS.has(key)) return 'hours';
  if (key.endsWith('_pct') || key.includes('share')) return 'ratio';
  return 'currency';
}

function toleranceFor(kind) {
  if (kind === 'hours') return HOURS;
  if (kind === 'ratio') return RATIO;
  return CURRENCY;
}

function valuesMatch(actual, expected, key) {
  if (expected === null || actual === null) return actual === expected;
  if (typeof expected === 'string' || typeof actual === 'string') return actual === expected;
  if (typeof expected !== 'number' || typeof actual !== 'number') return false;
  if (!Number.isFinite(expected) || !Number.isFinite(actual)) return false;
  return Math.abs(actual - expected) <= toleranceFor(kindFor(key));
}

function stageActual(stage) {
  if (!stage) return null;
  return {
    cash_operating_cost: stage.cashOperatingCost,
    economic_operating_cost: stage.economicOperatingCost,
    required_monthly_revenue: stage.requiredMonthlyRevenue,
    revenue_per_available_unit_day: stage.revenuePerAvailableUnitDay,
    revenue_per_realized_day: stage.revenuePerRealizedDay,
    revenue_per_productive_unit_hour: stage.revenuePerProductiveUnitHour,
    productive_unit_hours: stage.productiveUnitHours,
    liquidity_planning_target: stage.liquidityPlanningTarget,
    field_headcount: stage.fieldHeadcount,
    owner_field_replacement: stage.ownerFieldReplacement,
    weighted_dso: stage.weightedDso,
    readiness: stage.readiness,
  };
}

const lines = [];
let failed = 0;

function report(id, pass) {
  lines.push(`${id} ${pass ? 'PASS' : 'FAIL'}`);
  if (!pass) failed += 1;
}

async function main() {
  const filePath = process.argv[2];
  lines.push('finance:verify');
  lines.push(`tolerance.currency=${CURRENCY}`);
  lines.push(`tolerance.ratio=${RATIO}`);
  lines.push(`tolerance.hours=${HOURS}`);
  if (!filePath) {
    report('section15.input_path', false);
    process.stdout.write(`${lines.join('\n')}\n`);
    process.exit(1);
  }
  let document;
  try {
    document = JSON.parse(readFileSync(filePath, 'utf8'));
  } catch {
    report('section15.input_parse', false);
    process.stdout.write(`${lines.join('\n')}\n`);
    process.exit(1);
  }
  if (!document || typeof document !== 'object' || !document.inputs || !document.expected) {
    report('section15.document_shape', false);
    process.stdout.write(`${lines.join('\n')}\n`);
    process.exit(1);
  }
  const require = createRequire(import.meta.url);
  const calculateUrl = pathToFileURL(require.resolve('../src/lib/finance/calculate.js')).href;
  const { calculatePlan } = await import(calculateUrl);
  const result = calculatePlan(document.inputs);
  const expected = document.expected;

  const stageMap = {
    stage_0: result.stages.stage_0,
    stage_1: result.stages.stage_1,
    stage_2: result.stages.stage_2,
    stage_3: result.stages.stage_3,
    stage_3_core: result.stages.stage_3_core,
  };
  for (const [stageKey, expectedStage] of Object.entries(expected.stages || {})) {
    const actual = stageActual(stageMap[stageKey]);
    if (!actual || !expectedStage || typeof expectedStage !== 'object') {
      report(`section15.${stageKey}`, false);
      continue;
    }
    for (const [metric, expectedValue] of Object.entries(expectedStage)) {
      report(`section15.${stageKey}.${metric}`, valuesMatch(actual[metric], expectedValue, metric));
    }
  }
  for (const [serviceKey, expectedService] of Object.entries(expected.services || {})) {
    const service = result.services[serviceKey];
    const actual = service && {
      direct_labor: service.directLabor,
      direct_job_cost: service.directJobCost,
      stage2_indirect_allocation: service.indirectAllocation,
      fully_supported: service.fullySupportedCost,
      stage1_capacity_price: service.stage1CapacityPrice,
      stage2_capacity_price: service.stage2CapacityPrice,
      price_vs_stage2: service.priceVarianceVsStage2,
      travel_hours: service.travelHours,
      site_clock_hours: service.siteClockHours,
      production_unit_hours: service.productionUnitHours,
    };
    if (!actual) {
      report(`section15.service.${serviceKey}`, false);
      continue;
    }
    for (const [metric, expectedValue] of Object.entries(expectedService)) {
      report(`section15.service.${serviceKey}.${metric}`, valuesMatch(actual[metric], expectedValue, metric));
    }
  }
  const controls = {
    stage2_indirect_per_productive_unit_hour: result.stage2IndirectPerProductiveUnitHour,
    stage2_required_duct_per_drop_target: result.routes.stage2RequiredDuctPerDropTarget,
    stage2_required_duct_per_drop_stress: result.routes.stage2RequiredDuctPerDropStress,
    suggested_stress_book_price_per_drop: result.routes.suggestedStressBookPricePerDrop,
    stage1_required_avg_dryer_ticket: result.routes.stage1RequiredAvgDryerTicket,
    stage2_required_avg_dryer_ticket: result.routes.stage2RequiredAvgDryerTicket,
  };
  for (const [metric, expectedValue] of Object.entries(expected.controls || {})) {
    report(`section15.control.${metric}`, valuesMatch(controls[metric], expectedValue, metric));
  }
  report('section15.summary', failed === 0);
  process.stdout.write(`${lines.join('\n')}\n`);
  process.exit(failed === 0 ? 0 : 1);
}

main();

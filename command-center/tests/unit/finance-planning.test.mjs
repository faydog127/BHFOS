/**
 * Synthetic planning checks. Values are the illustration fixture, not workbook seeds.
 * Run: npm run test:finance
 */
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import { jwtDecode } from 'jwt-decode';
import { calculatePlan, monthlyPayroll, retentionHurdle } from '../../src/lib/finance/calculate.js';
import { div, num, roundUpToIncrement } from '../../src/lib/finance/nullMath.js';
import { nearCapacityBand, stageReadiness, READINESS_INCOMPLETE, READINESS_NOT_READY, READINESS_READY } from '../../src/lib/finance/readiness.js';
import { variance, variancePct } from '../../src/lib/finance/variance.js';
import { evaluateFinanceAccess, roleHasFinanceCapability, FINANCE_ALLOWED_ROLES, FINANCE_CAPABILITIES } from '../../src/lib/finance/authz.js';
import { blankPlanInputs, validateNotes, validatePlanInputs } from '../../src/lib/finance/blankPlan.js';
import { approvePlan, associateComparisonPlan, correctMonthlyActual, createBlankPlan, createMonthlyActual, isFinanceVersionConflict, openDraftFromApproved, readPlan, saveDraft, selectVisiblePlan, STORED_PLAN_INVALID_COPY, storedPlanDecision, upgradeDraftSchema } from '../../src/lib/finance/persistence.js';
import { actualFactsFromForm, channelRevenueIssue, comparisonPlanForCheckin, declaredMonthlyBasis, derivedActualMetrics, plannedFactsForMonth, typeBasisAmount, validateMonthlyBasis } from '../../src/lib/finance/actuals.js';
import { formatStoredDecimal, parseActualDecimal, parseActualInteger } from '../../src/lib/finance/actuals.js';
import { FINANCE_WRITES_DISABLED, financeWritesEnabled } from '../../src/lib/finance/writeGate.js';
import { CHECKIN_CONFLICT_COPY, nextCheckinCorrection, reloadCheckinFromServer } from '../../src/lib/finance/checkinConflict.js';
import { getSyntheticPlanningFixture } from '../../src/lib/finance/syntheticFixture.js';
import { buildFinanceView } from '../../src/lib/finance/viewModel.js';
import { HVAC_REVENUE_MISSING_COPY } from '../../src/lib/finance/calculate.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const fixture = getSyntheticPlanningFixture({ routeTenant: 'tvg', sessionTenant: 'tvg' });
const inputs = fixture.inputs;

function payroll(headcount, wage, hours, burden) {
  return headcount * wage * hours * 52 / 12 * (1 + burden);
}

function close(actual, expected, tolerance = 0.01) {
  assert.equal(typeof actual, 'number');
  assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} vs ${expected}`);
}

describe('null and hurdle rules', () => {
  it('keeps empty inputs null and returns null on divide-by-zero', () => {
    assert.equal(num(''), null);
    assert.equal(num(null), null);
    assert.equal(num(undefined), null);
    assert.equal(div(0, 4), 0);
    assert.equal(div(4, 0), null);
    assert.equal(div(null, 4), null);
  });

  it('rejects retention hurdles outside 0 <= value < 1', () => {
    assert.equal(retentionHurdle({
      true_operating_profit_pct: 1,
      growth_reserve_pct: 0,
      bad_debt_warranty_pct: 0,
      unidentified_cost_contingency_pct: 0,
    }).valid, false);
    assert.equal(retentionHurdle({
      true_operating_profit_pct: -0.01,
      growth_reserve_pct: 0,
      bad_debt_warranty_pct: 0,
      unidentified_cost_contingency_pct: 0,
    }).valid, false);
    assert.equal(retentionHurdle({
      true_operating_profit_pct: Number.NaN,
      growth_reserve_pct: 0,
      bad_debt_warranty_pct: 0,
      unidentified_cost_contingency_pct: 0,
    }).value, null);
    const zero = retentionHurdle({
      true_operating_profit_pct: 0,
      growth_reserve_pct: 0,
      bad_debt_warranty_pct: 0,
      unidentified_cost_contingency_pct: 0,
    });
    assert.equal(zero.valid, true);
    assert.equal(zero.value, 0);
  });

  it('rounds the stress book price up to the injected increment', () => {
    assert.equal(roundUpToIncrement(20, 10), 20);
    assert.equal(roundUpToIncrement(20.01, 10), 30);
    assert.equal(roundUpToIncrement(23.285714285714285, 10), 30);
  });
});

describe('synthetic section 15 identities', () => {
  const result = calculatePlan(inputs);

  it('matches an independent stage-0 rollup', () => {
    const direct = 10 + 0 + 0;
    const indirect = (10 + 0 + 0 + 0 + 0) + (0 + 0 + 0 + 0 + 10) + 0 + (10 + 0 + 0 + 0 + 0);
    const cash = 0 + direct + indirect + 0 + 0;
    const reserve = 2 * 10 * 1.5;
    const economic = cash + reserve;
    close(result.stages.stage_0.cashOperatingCost, cash);
    close(result.stages.stage_0.economicOperatingCost, economic);
    close(result.stages.stage_0.requiredMonthlyRevenue, economic);
    close(result.stages.stage_0.revenuePerAvailableUnitDay, economic / 10);
    close(result.stages.stage_0.revenuePerRealizedDay, economic / 5);
    close(result.stages.stage_0.revenuePerProductiveUnitHour, economic / 20);
    close(result.stages.stage_0.productiveUnitHours, 20, 0.01);
    assert.equal(result.stages.stage_0.fieldHeadcount, 0);
  });

  it('matches an independent stage-1 and stage-2 rollup', () => {
    const support = payroll(1, 2, 10, 0.25);
    const lead = payroll(1, 10, 10, 0.5);
    const duct = payroll(1, 7, 10, 0.5);
    const helper = payroll(1, 8, 10, 0.5);
    const stage1Indirect = (20 + 5 + 5 + 5 + 10) + (10 + 5 + 5 + 5 + 5) + (10 + 5 + 5) + (15 + 10 + 5 + 0 + 5);
    const stage1Cash = lead + (20 + 5 + 0) + stage1Indirect + support + 100;
    const stage1Economic = stage1Cash + (2 * 10 * 1.5);
    close(result.stages.stage_1.cashOperatingCost, stage1Cash);
    close(result.stages.stage_1.requiredMonthlyRevenue, stage1Economic / 0.7);
    close(result.stages.stage_1.productiveUnitHours, 40, 0.01);
    const stage2Cash = (lead + duct + helper) + (30 + 10 + 5)
      + ((20 + 10 + 10 + 5 + 15) + (20 + 5 + 10 + 5 + 5) + (20 + 5 + 5) + (20 + 15 + 5 + 0 + 5))
      + support + 200;
    const stage2Economic = stage2Cash + (1 * 10 * 1.5);
    close(result.stages.stage_2.cashOperatingCost, stage2Cash);
    close(result.stages.stage_2.economicOperatingCost, stage2Economic);
    close(result.stages.stage_2.requiredMonthlyRevenue, stage2Economic / 0.7);
    assert.equal(result.stages.stage_2.revenueProducingUnits, 2);
    assert.equal(result.stages.stage_2.fieldHeadcount, 3);
    close(result.stages.stage_2.productiveUnitHours, 40, 0.01);
  });

  it('keeps stage-2 shadow hours out of headcount, units, and productive hours', () => {
    const cleared = structuredClone(inputs);
    cleared.stages.stage_2.owner_shadow_hours = 0;
    const next = calculatePlan(cleared);
    const reserve = 1 * 10 * (1 + 0.5);
    close(result.stages.stage_2.economicOperatingCost - next.stages.stage_2.economicOperatingCost, reserve);
    assert.notEqual(result.stages.stage_2.requiredMonthlyRevenue, next.stages.stage_2.requiredMonthlyRevenue);
    close(result.stages.stage_2.cashOperatingCost, next.stages.stage_2.cashOperatingCost);
    assert.equal(next.stages.stage_2.revenueProducingUnits, 2);
    assert.equal(next.stages.stage_2.fieldHeadcount, 3);
    close(next.stages.stage_2.productiveUnitHours, 40, 0.01);
  });

  it('prices services from crew rates and package max/sum rules', () => {
    const routeRate = 6 * 1.5;
    const crew = (10 + 7 + 8) * 1.5;
    const hvac = 4 * 1.5;
    close(result.services.residential_dryer_vent.directLabor, 2 * routeRate);
    close(result.services.duct_12_drop_floor.directLabor, 2 * crew);
    close(result.services.ahu_future.directLabor, 2 * hvac);
    close(result.services.duct_plus_ahu_package.directLabor, 2 * crew + 2 * hvac);
    close(result.services.duct_plus_ahu_package.siteClockHours, 2, 0.01);
    close(result.services.duct_plus_ahu_package.productionUnitHours, 4, 0.01);
    assert.equal(result.services.residential_dryer_vent.travelHours, null);
    const hour = result.stages.stage_2.revenuePerProductiveUnitHour;
    close(result.services.residential_dryer_vent.stage2CapacityPrice, 2 * hour);
    close(result.services.residential_dryer_vent.priceVarianceVsStage2, 100 - (2 * hour));
  });

  it('does not produce Ready from the illustration alone', () => {
    for (const key of ['stage_0', 'stage_1', 'stage_2', 'stage_3', 'stage_3_core']) {
      assert.equal(result.stages[key].readiness, READINESS_INCOMPLETE);
    }
    assert.equal(result.stages.stage_3_core.revenuePerProductiveUnitHour, null);
    assert.equal(result.stages.stage_3_core.productiveUnitHours, null);
    assert.ok(result.stages.stage_3_core.requiredMonthlyRevenue < result.stages.stage_3.requiredMonthlyRevenue);
  });

  it('returns null revenue when the hurdle is invalid or units are zero', () => {
    const invalid = structuredClone(inputs);
    invalid.stages.stage_1.true_operating_profit_pct = 0.9;
    const invalidResult = calculatePlan(invalid);
    assert.equal(invalidResult.stages.stage_1.requiredMonthlyRevenue, null);
    assert.equal(invalidResult.stages.stage_1.retentionHurdleValid, false);
    const zeroUnits = structuredClone(inputs);
    zeroUnits.stages.stage_0.revenue_producing_units = 0;
    const zeroResult = calculatePlan(zeroUnits);
    assert.equal(zeroResult.stages.stage_0.revenuePerAvailableUnitDay, null);
    const emptyFuel = structuredClone(inputs);
    emptyFuel.cost_pools.direct_production.fuel.stage_0 = null;
    const emptyResult = calculatePlan(emptyFuel);
    assert.equal(emptyResult.stages.stage_0.cashOperatingCost, null);
    assert.notEqual(emptyResult.stages.stage_0.cashOperatingCost, 0);
  });

  it('locks the committed expected block to the engine within tolerance', () => {
    const json = JSON.parse(readFileSync(path.join(root, 'src/lib/finance/synthetic-planning.json'), 'utf8'));
    assert.deepEqual(json.inputs, fixture.inputs);
    assert.equal(json.meta.label, fixture.meta.label);
    const stage = result.stages.stage_2;
    close(stage.requiredMonthlyRevenue, json.expected.stages.stage_2.required_monthly_revenue);
    close(result.services.duct_12_drop_stress.directLabor, json.expected.services.duct_12_drop_stress.direct_labor);
  });
});

describe('readiness and variance', () => {
  it('classifies the utilization band at the stated boundaries', () => {
    assert.equal(nearCapacityBand(0.8499), 'below_near');
    assert.equal(nearCapacityBand(0.85), 'near_capacity');
    assert.equal(nearCapacityBand(0.9999), 'near_capacity');
    assert.equal(nearCapacityBand(1), 'at_or_over_capacity');
    assert.equal(nearCapacityBand(1.2), 'at_or_over_capacity');
    assert.equal(nearCapacityBand(null), null);
    assert.equal(nearCapacityBand(Number.NaN), null);
  });

  it('is Ready only when every required input is present and all four conditions hold', () => {
    const complete = {
      projectedContribution: 1,
      cashCoverageMonths: 2,
      safetyMonths: 1,
      projectedBillableUtilization: 0.85,
      practicalBillableCapacity: 10,
      projectedRevenue: 50,
      modeledLaborAndFixedLoad: 40,
    };
    assert.equal(stageReadiness(complete), READINESS_READY);
    assert.equal(stageReadiness({ ...complete, projectedContribution: 0 }), READINESS_NOT_READY);
    assert.equal(stageReadiness({ ...complete, practicalBillableCapacity: null }), READINESS_INCOMPLETE);
    assert.equal(stageReadiness({}), READINESS_INCOMPLETE);
  });

  it('returns null variance when either side is missing or the plan is zero', () => {
    assert.equal(variance(null, 10), null);
    assert.equal(variance(5, null), null);
    assert.equal(variance(8, 5), 3);
    assert.equal(variancePct(8, 0), null);
    assert.equal(variancePct(8, 4), 1);
  });
});

describe('finance authorization', () => {
  function token(appRole, appTenant, userRole, userTenant) {
    const encode = (value) => Buffer.from(JSON.stringify(value)).toString('base64url');
    const appMetadata = {};
    if (appRole !== undefined) appMetadata.role = appRole;
    if (appTenant !== undefined) appMetadata.tenant_id = appTenant;
    const userMetadata = {};
    if (userRole !== undefined) userMetadata.role = userRole;
    if (userTenant !== undefined) userMetadata.tenant_id = userTenant;
    return `${encode({ alg: 'none', typ: 'JWT' })}.${encode({
      app_metadata: appMetadata,
      user_metadata: userMetadata,
    })}.sig`;
  }

  it('allows only admin and super_admin on the tvg route and session', () => {
    assert.equal(roleHasFinanceCapability('admin', FINANCE_CAPABILITIES.READ), true);
    assert.equal(roleHasFinanceCapability('super_admin', FINANCE_CAPABILITIES.WRITE), true);
    assert.equal(roleHasFinanceCapability('owner', FINANCE_CAPABILITIES.READ), false);
    for (const role of ['owner', 'manager', 'office', 'csr', 'technician', 'tech', 'viewer', 'customer', 'partner']) {
      const access = evaluateFinanceAccess({ accessToken: token(role, 'tvg', 'admin'), routeTenantId: 'tvg' });
      assert.equal(access.allowed, false, role);
    }
    assert.equal(evaluateFinanceAccess({ accessToken: token('admin', 'tvg', 'viewer'), routeTenantId: 'tvg' }).allowed, true);
    assert.equal(evaluateFinanceAccess({ accessToken: token('super_admin', 'tvg', 'owner'), routeTenantId: 'tvg' }).allowed, true);
    assert.equal(evaluateFinanceAccess({ accessToken: token('admin', 'other', 'admin'), routeTenantId: 'tvg' }).allowed, false);
    assert.equal(evaluateFinanceAccess({ accessToken: token('admin', 'TVG', 'viewer'), routeTenantId: 'TVG' }).allowed, true);
    assert.equal(evaluateFinanceAccess({ accessToken: token('admin', ' tvg ', 'viewer'), routeTenantId: ' tvg ' }).allowed, true);
    assert.equal(evaluateFinanceAccess({ accessToken: token('admin', 'tvg', 'admin'), routeTenantId: 'other' }).allowed, false);
    assert.equal(evaluateFinanceAccess({ accessToken: null, routeTenantId: 'tvg' }).allowed, false);
    const decoded = jwtDecode(token('owner', 'tvg', 'admin'));
    assert.equal(decoded.user_metadata.role, 'admin');
    assert.equal(evaluateFinanceAccess({ accessToken: token('owner', 'tvg', 'admin'), routeTenantId: 'tvg' }).allowed, false);
  });

  it('does not fall back to user_metadata.role', () => {
    for (const appRole of [undefined, '']) {
      const access = evaluateFinanceAccess({
        accessToken: token(appRole, 'tvg', 'admin'),
        routeTenantId: 'tvg',
      });
      assert.equal(access.allowed, false);
      assert.notEqual(access.role, 'admin');
    }
  });

  it('does not fall back to user_metadata.tenant_id', () => {
    for (const appTenant of [undefined, '']) {
      const access = evaluateFinanceAccess({
        accessToken: token('admin', appTenant, 'viewer', 'tvg'),
        routeTenantId: 'tvg',
      });
      assert.equal(access.allowed, false);
      assert.notEqual(access.sessionTenantId, 'tvg');
    }
  });

  it('denies a token with no app_metadata', () => {
    const encode = (value) => Buffer.from(JSON.stringify(value)).toString('base64url');
    const accessToken = `${encode({ alg: 'none', typ: 'JWT' })}.${encode({
      user_metadata: { role: 'admin', tenant_id: 'tvg' },
    })}.sig`;
    const access = evaluateFinanceAccess({ accessToken, routeTenantId: 'tvg' });
    assert.equal(access.allowed, false);
    assert.equal(access.role, null);
  });

  it('rejects an array-valued role', () => {
    for (const appRole of [['admin'], ['super_admin', 'admin']]) {
      const access = evaluateFinanceAccess({
        accessToken: token(appRole, 'tvg', 'viewer'),
        routeTenantId: 'tvg',
      });
      assert.equal(access.allowed, false);
      assert.notEqual(access.role, 'admin');
      assert.notEqual(access.role, 'super_admin');
    }
  });

  it('refuses the illustration unless both tenants are tvg', () => {
    assert.throws(() => getSyntheticPlanningFixture({ routeTenant: 'other', sessionTenant: 'tvg' }));
    assert.throws(() => getSyntheticPlanningFixture({ routeTenant: 'tvg', sessionTenant: 'other' }));
  });
});

describe('missing-item display', () => {
  it('renders missing planning inputs as dashes or Not provided and never Ready', () => {
    const result = calculatePlan(inputs);
    const view = buildFinanceView(fixture, result, 'stage_2');
    assert.equal(view.label, 'SYNTHETIC — NOT TVG DATA');
    assert.equal(view.missing.hvacRevenue, HVAC_REVENUE_MISSING_COPY);
    assert.equal(HVAC_REVENUE_MISSING_COPY.includes('not provided'), true);
    assert.equal(view.missing.stage3CoreUnits, 'Not provided');
    assert.equal(view.missing.stage3CoreUtilization, 'Not provided');
    assert.equal(view.missing.stage3CoreProductiveHoursPerDay, 'Not provided');
    assert.equal(view.missing.hvacNonLaborShare, 'Not provided');
    assert.equal(view.missing.practicalBillableCapacity, 'Not provided');
    assert.equal(view.missing.actualsSource, 'Not provided');
    assert.equal(view.missing.readiness, READINESS_INCOMPLETE);
    for (const row of view.missing.travelHours) {
      assert.equal(row.display, '--');
      assert.notEqual(row.display, '0');
    }
    for (const row of view.checkin) {
      assert.equal(row.plan, '--');
      assert.equal(row.actual, '--');
      assert.equal(row.variance, '--');
    }
    const blob = JSON.stringify(view.missing) + JSON.stringify(view.checkin) + view.stage3Headline.readiness;
    assert.equal(blob.includes('Ready'), false);
    assert.equal(view.stage3Core.caveat.includes('Informational; not a readiness input.'), true);
    assert.equal(view.services.some((service) => service.variance === 'Near'), false);
  });
});

describe('verify script and source guards', () => {
  it('prints PASS/FAIL for the synthetic json without echoing a result value', () => {
    const script = path.join(root, 'tools/finance-verify.mjs');
    const file = path.join(root, 'src/lib/finance/synthetic-planning.json');
    const run = spawnSync(process.execPath, [script, file], { encoding: 'utf8' });
    assert.equal(run.status, 0);
    assert.match(run.stdout, /section15\.stage_0\.cash_operating_cost PASS/);
    assert.match(run.stdout, /tolerance\.currency=0\.01/);
    assert.match(run.stdout, /section15\.summary PASS/);
    assert.equal(run.stdout.includes('1490.476'), false);
    assert.equal(run.stdout.includes('3104.761'), false);
  });

  it('fails when expectations are empty or missing', () => {
    const script = path.join(root, 'tools/finance-verify.mjs');
    const source = JSON.parse(readFileSync(path.join(root, 'src/lib/finance/synthetic-planning.json'), 'utf8'));
    const dir = mkdtempSync(path.join(tmpdir(), 'finance-verify-'));
    const cases = [
      { name: 'missing', document: { inputs: source.inputs } },
      { name: 'empty', document: { inputs: source.inputs, expected: {} } },
      { name: 'empty-groups', document: { inputs: source.inputs, expected: { stages: {}, services: {}, controls: {} } } },
      { name: 'empty-stage', document: { inputs: source.inputs, expected: { stages: { stage_0: {} } } } },
    ];
    try {
      for (const item of cases) {
        const file = path.join(dir, `${item.name}.json`);
        writeFileSync(file, JSON.stringify(item.document));
        const run = spawnSync(process.execPath, [script, file], { encoding: 'utf8' });
        assert.notEqual(run.status, 0, item.name);
        assert.match(run.stdout, /section15\.expected_nonempty FAIL/, item.name);
        assert.match(run.stdout, /reason=empty_or_missing/, item.name);
        assert.equal(run.stdout.includes('section15.summary PASS'), false, item.name);
      }
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('keeps finance authority off client role and tenant helpers', () => {
    const guard = readFileSync(path.join(root, 'src/components/finance/FinanceGuard.jsx'), 'utf8');
    const shell = readFileSync(path.join(root, 'src/pages/finance/FinanceShell.jsx'), 'utf8');
    const app = readFileSync(path.join(root, 'src/App.jsx'), 'utf8');
    const authz = readFileSync(path.join(root, 'src/lib/finance/authz.js'), 'utf8');
    assert.equal(guard.includes('user_metadata'), false);
    assert.equal(guard.includes('getSelectedTenantId'), false);
    assert.equal(guard.includes('activeTenantId'), false);
    assert.equal(authz.includes('user_metadata.role'), false);
    assert.equal(authz.includes('.role'), true);
    assert.equal(shell.includes('localStorage'), false);
    assert.equal(shell.includes('sessionStorage'), false);
    assert.equal(shell.includes('indexedDB'), false);
    assert.match(app, /path="\/:tenantId\/finance\/\*"/);
    assert.match(app, /<TenantGuard>[\s\S]*<FinanceGuard \/>/);
    assert.equal(app.includes('crm/finance'), false);
    assert.equal(monthlyPayroll({
      headcount: 1, hourlyWage: 10, weeklyHours: 10, burdenPct: 0.5, weeksPerYear: 52, monthsPerYear: 12,
    }), payroll(1, 10, 10, 0.5));
  });

  it('keeps a blank plan free of numeric assumptions', () => {
    const numbers = [];
    const walk = (value) => {
      if (typeof value === 'number') numbers.push(value);
      else if (Array.isArray(value)) value.forEach(walk);
      else if (value && typeof value === 'object') Object.values(value).forEach(walk);
    };
    const inputs = blankPlanInputs();
    walk(inputs);
    assert.deepEqual(numbers, []);
    assert.equal(JSON.stringify(inputs).includes('SYNTHETIC'), false);
    assert.equal(validatePlanInputs(inputs).ok, true);
    const unknown = blankPlanInputs();
    unknown.extra = null;
    assert.equal(validatePlanInputs(unknown).code, 'invalid_inputs');
    const negative = blankPlanInputs();
    negative.structural.weeks_per_year = -1;
    assert.equal(validatePlanInputs(negative).code, 'invalid_inputs');
    const nonFinite = blankPlanInputs();
    nonFinite.hvac_revenue = Number.NaN;
    assert.equal(validatePlanInputs(nonFinite).code, 'invalid_inputs');
    assert.equal(validateNotes('x'.repeat(2001)).code, 'invalid_notes');
    assert.equal(validateNotes(null).notes, null);
  });

  it('reports a version conflict without mutating the caller inputs', async () => {
    const inputs = blankPlanInputs();
    inputs.structural.weeks_per_year = 1;
    const before = structuredClone(inputs);
    const row = {
      update() { return row; },
      eq() { return row; },
      select() { return row; },
      maybeSingle: async () => ({ data: null, error: null }),
    };
    const result = await saveDraft({ from: () => row }, {
      id: '11111111-1111-4111-8111-111111111111',
      expectedVersion: 1,
      inputs,
      notes: null,
    }, { MODE: 'test' });
    assert.equal(result.ok, false);
    assert.equal(result.code, 'version_conflict');
    assert.deepEqual(inputs, before);
    assert.deepEqual(selectVisiblePlan([]), { approved: null, draft: null, visible: null });
  });

  it('disables finance writes unless the build is local or approved synthetic', async () => {
    const preview = { DEV: false, MODE: 'production' };
    assert.equal(financeWritesEnabled(preview), false);
    assert.equal(financeWritesEnabled({ DEV: true, MODE: 'production' }), true);
    assert.equal(financeWritesEnabled({ DEV: false, MODE: 'development' }), true);
    assert.equal(financeWritesEnabled({ DEV: false, MODE: 'test' }), true);
    assert.equal(financeWritesEnabled({ local: true, DEV: false, MODE: 'production' }), true);
    assert.equal(financeWritesEnabled({
      DEV: false,
      MODE: 'production',
      VITE_FINANCE_SYNTHETIC_ONLY: 'approved-synthetic',
    }), true);
    assert.equal(financeWritesEnabled({
      DEV: false,
      MODE: 'production',
      VITE_FINANCE_SYNTHETIC_ONLY: 'true',
    }), false);
    let called = false;
    const client = {
      from() { called = true; return {}; },
      rpc() { called = true; return {}; },
    };
    const saved = await saveDraft(client, {
      id: '11111111-1111-4111-8111-111111111111',
      expectedVersion: 1,
      inputs: blankPlanInputs(),
      notes: null,
    }, preview);
    const created = await createBlankPlan(client, preview);
    const approved = await approvePlan(client, { id: '11111111-1111-4111-8111-111111111111', expectedVersion: 1 }, preview);
    const opened = await openDraftFromApproved(client, { id: '11111111-1111-4111-8111-111111111111' }, preview);
    const upgraded = await upgradeDraftSchema(client, { id: '11111111-1111-4111-8111-111111111111', expectedVersion: 1 }, preview);
    const month = await createMonthlyActual(client, { month: '2026-01-01', facts: {} }, preview);
    const linked = await associateComparisonPlan(client, {
      id: '11111111-1111-4111-8111-111111111111',
      expectedVersion: 1,
      comparisonPlanId: '22222222-2222-4222-8222-222222222222',
    }, preview);
    assert.equal(saved.code, FINANCE_WRITES_DISABLED);
    assert.equal(created.code, FINANCE_WRITES_DISABLED);
    assert.equal(approved.code, FINANCE_WRITES_DISABLED);
    assert.equal(opened.code, FINANCE_WRITES_DISABLED);
    assert.equal(upgraded.code, FINANCE_WRITES_DISABLED);
    assert.equal(month.code, FINANCE_WRITES_DISABLED);
    assert.equal(linked.code, FINANCE_WRITES_DISABLED);
    assert.equal(called, false);
    assert.equal(financeWritesEnabled(), false);
    assert.equal(financeWritesEnabled({ MODE: 'test' }), true);
  });

  it('keeps a stale actual correction from writing or mutating the caller', async () => {
    const facts = { total_revenue: null, cash_reserve: 0, comparison_plan_id: 'should-not-send', month: '2026-01-01' };
    const before = structuredClone(facts);
    const calls = [];
    const row = {
      update(patch) { calls.push(patch); return row; },
      eq() { return row; },
      select() { return row; },
      maybeSingle: async () => ({ data: null, error: null }),
    };
    const result = await correctMonthlyActual({ from: () => row }, {
      id: '11111111-1111-4111-8111-111111111111',
      expectedVersion: 1,
      facts,
    }, { MODE: 'test' });
    assert.equal(result.code, 'version_conflict');
    assert.deepEqual(facts, before);
    assert.equal(Object.prototype.hasOwnProperty.call(calls[0], 'comparison_plan_id'), false);
    assert.equal(Object.prototype.hasOwnProperty.call(calls[0], 'month'), false);
    assert.equal(calls[0].total_revenue, null);
    assert.equal(calls[0].cash_reserve, 0);
  });

  it('keeps a blank channel null, rejects a known channel above total, and omits an unrequested plan', async () => {
    assert.equal(parseActualDecimal('', 2).value, null);
    assert.equal(parseActualDecimal('0.00', 2).value, 0);
    assert.equal(parseActualDecimal('1.01', 2).value, 1.01);
    assert.equal(parseActualDecimal('999999999999.99', 2, 12).ok, true);
    assert.equal(parseActualDecimal('1000000000000.00', 2, 12).code, 'amount_too_large');
    assert.equal(parseActualDecimal('99999999.99', 2, 8).ok, true);
    assert.equal(parseActualDecimal('100000000.00', 2, 8).code, 'amount_too_large');
    assert.equal(parseActualInteger('2147483647').value, 2147483647);
    assert.equal(parseActualInteger('2147483648').code, 'count_too_large');
    assert.equal(actualFactsFromForm({ total_revenue: '1000000000000' }).field, 'total_revenue');
    assert.equal(actualFactsFromForm({ productive_unit_hours: '100000000' }).code, 'amount_too_large');
    assert.equal(actualFactsFromForm({ total_jobs: '2147483648' }).code, 'count_too_large');
    assert.equal(formatStoredDecimal('0', 2), '0.00');
    assert.equal(formatStoredDecimal(null, 2), '');
    assert.equal(channelRevenueIssue({
      total_revenue: 4,
      direct_residential_revenue: 5,
      commercial_direct_revenue: null,
      portal_revenue: null,
    }), 'known_channels_exceed_total');
    assert.equal(channelRevenueIssue({
      total_revenue: 4,
      direct_residential_revenue: 1,
      commercial_direct_revenue: null,
      portal_revenue: null,
    }), null);
    assert.equal(channelRevenueIssue({
      total_revenue: 3.1,
      direct_residential_revenue: 1,
      commercial_direct_revenue: 1.05,
      portal_revenue: 1.05,
    }), null);
    assert.equal(channelRevenueIssue({
      total_revenue: null,
      direct_residential_revenue: 1,
      commercial_direct_revenue: 1,
      portal_revenue: 1,
    }), 'channels_require_total');
    assert.equal(declaredMonthlyBasis({
      schema_version: 1,
      inputs: { stages: { stage_2: { scenario: { projected_revenue: 100 } } } },
    }), null);
    const derived = derivedActualMetrics({
      total_revenue: 3.1,
      total_jobs: 2,
      productive_unit_hours: 1.5,
      portal_revenue: 1.05,
      direct_residential_revenue: 1,
      commercial_direct_revenue: null,
      field_payroll: null,
      indirect_cash_costs: 0,
      ar_ending: null,
      cash_reserve: 0,
    });
    assert.equal(derived.direct_share, null);
    assert.equal(derived.portal_share, null);
    assert.equal(derivedActualMetrics({ total_revenue: 10, portal_revenue: 4 }).portal_share, null);
    const completeShares = derivedActualMetrics({
      total_revenue: 10,
      direct_residential_revenue: 3,
      commercial_direct_revenue: 3,
      portal_revenue: 4,
    });
    assert.equal(completeShares.portal_share, 0.4);
    assert.equal(completeShares.direct_share, 0.6);
    assert.equal(derived.field_payroll_pct_of_revenue, null);
    assert.equal(derived.cash_reserve_over_revenue, 0);
    assert.equal(derived.indirect_cost_pct_of_revenue, 0);
    const inserts = [];
    const row = {
      insert(payload) { inserts.push(payload); return row; },
      select() { return row; },
      maybeSingle: async () => ({ data: { id: 'a', version: 1 }, error: null }),
    };
    const facts = {
      total_revenue: null,
      direct_residential_revenue: null,
      commercial_direct_revenue: null,
      portal_revenue: null,
      cash_reserve: 0,
    };
    const created = await createMonthlyActual({ from: () => row }, {
      month: '2026-01-01',
      facts,
      comparisonPlanId: null,
    }, { MODE: 'test' });
    assert.equal(created.ok, true);
    assert.equal(Object.prototype.hasOwnProperty.call(inserts[0], 'comparison_plan_id'), false);
    assert.equal(inserts[0].source, 'manual_entry');
    assert.equal(inserts[0].total_revenue, null);
    assert.equal(inserts[0].cash_reserve, 0);
    const blocked = await createMonthlyActual({ from: () => row }, {
      month: '2026-02-01',
      facts: {
        total_revenue: 4,
        direct_residential_revenue: 5,
        commercial_direct_revenue: null,
        portal_revenue: null,
      },
    }, { MODE: 'test' });
    assert.equal(blocked.code, 'known_channels_exceed_total');
    assert.equal(inserts.length, 1);
    const updates = [];
    const updateRow = {
      update(payload) { updates.push(payload); return updateRow; },
      eq() { return updateRow; },
      select() { return updateRow; },
      maybeSingle: async () => ({ data: { id: 'a', version: 2, comparison_plan_id: 'plan-1' }, error: null }),
    };
    const linked = await associateComparisonPlan({ from: () => updateRow }, {
      id: 'a',
      expectedVersion: 1,
      comparisonPlanId: 'plan-1',
    }, { MODE: 'test' });
    assert.equal(linked.ok, true);
    assert.deepEqual(updates[0], { comparison_plan_id: 'plan-1' });
  });

  it('matches the SQL role list and blocks the preview harness', () => {
    const migrationDir = path.join(root, 'supabase/migrations');
    const migrationNames = readdirSync(migrationDir).filter((name) => name.includes('finance') && name.endsWith('.sql')).sort();
    let roleList = null;
    const allowed = new Set(['0', '1', '2', '10', '14', '2000']);
    for (const name of migrationNames) {
      const migration = readFileSync(path.join(migrationDir, name), 'utf8');
      const match = migration.match(/lower\(btrim\(auth\.jwt\(\) -> 'app_metadata' ->> 'role'\)\) in \(([^)]+)\)/);
      if (match) {
        roleList = [...match[1].matchAll(/'([^']+)'/g)].map((item) => item[1]);
      }
      const stripped = migration.replace(/\$\$[\s\S]*?\$\$/g, '').replace(/--.*$/gm, '');
      assert.equal(/\binsert\s+into\b/i.test(stripped), false, name);
      assert.equal(/\bcopy\s+/i.test(stripped), false, name);
      for (const value of stripped.match(/\d+/g) || []) assert.equal(allowed.has(value), true, `${name}:${value}`);
      assert.equal(migration.includes('user_metadata'), false, name);
    }
    assert.deepEqual(roleList, [...FINANCE_ALLOWED_ROLES]);
    for (const relative of [
      'src/lib/finance/authz.js',
      'src/lib/finance/persistence.js',
      'src/lib/finance/writeGate.js',
      'src/lib/finance/blankPlan.js',
      'src/pages/finance/FinanceShell.jsx',
      'src/pages/finance/MonthlyCheckIn.jsx',
      'src/lib/finance/actuals.js',
      'src/lib/finance/checkinConflict.js',
      'src/components/finance/FinanceGuard.jsx',
    ]) {
      assert.equal(readFileSync(path.join(root, relative), 'utf8').includes('user_metadata'), false, relative);
    }
    const shell = readFileSync(path.join(root, 'src/pages/finance/FinanceShell.jsx'), 'utf8');
    const guard = readFileSync(path.join(root, 'src/components/finance/FinanceGuard.jsx'), 'utf8');
    assert.equal(shell.includes('syntheticFixture'), false);
    assert.equal(shell.includes('getSyntheticPlanningFixture'), false);
    assert.match(shell, /grantedAccess\?\.allowed === true/);
    assert.match(shell, /No plan yet/);
    assert.match(shell, /MonthlyCheckIn/);
    const checkin = readFileSync(path.join(root, 'src/pages/finance/MonthlyCheckIn.jsx'), 'utf8');
    const actuals = readFileSync(path.join(root, 'src/lib/finance/actuals.js'), 'utf8');
    assert.match(checkin, /does not invent a monthly plan series/);
    assert.match(actuals, /not the invoices issued this month/);
    assert.match(checkin, /checkin-no-plan/);
    assert.match(checkin, /nextCheckinCorrection/);
    assert.match(checkin, /reloadCheckinFromServer/);
    assert.match(checkin, /disabled=\{!writesEnabled \|\| saving \|\| conflict\}/);
    assert.match(checkin, /CHECKIN_CONFLICT_COPY/);
    assert.equal(checkin.includes('Housecall'), false);
    assert.match(shell, /finance-writes-disabled/);
    assert.match(shell, /Finance writes are disabled/);
    assert.match(shell, /disabled=\{!writesEnabled\}/);
    assert.match(guard, /<FinanceShell grantedAccess=\{access\} \/>/);
    assert.equal(existsSync(path.join(root, 'finance-preview.html')), false);
    assert.equal(existsSync(path.join(root, 'src/financePreviewMain.jsx')), false);
  });
});

describe('check-in conflict reload', () => {
  const id = '11111111-1111-4111-8111-111111111111';

  it('blocks save after a stale conflict until reload replaces the form with the server row', async () => {
    const staleFacts = { total_revenue: 99, cash_reserve: 1, total_jobs: 7 };
    const calls = [];
    const row = {
      update(patch) { calls.push(patch); return row; },
      eq() { return row; },
      select() { return row; },
      maybeSingle: async () => ({ data: null, error: null }),
    };
    const conflict = await correctMonthlyActual({ from: () => row }, {
      id,
      expectedVersion: 1,
      facts: staleFacts,
    }, { MODE: 'test' });
    assert.equal(conflict.code, 'version_conflict');
    assert.equal(calls[0].total_revenue, 99);

    const staleForm = {
      total_revenue: '99.00',
      cash_reserve: '1.00',
      total_jobs: '7',
      notes: 'local edit',
      source_note: '',
    };
    const selected = { id, version: 1, month: '2026-01-01' };
    const blocked = nextCheckinCorrection({
      conflict: true,
      saving: false,
      writesEnabled: true,
      selected: { ...selected, version: 2 },
      form: staleForm,
    });
    assert.equal(blocked.code, 'conflict_unresolved');

    const serverRow = {
      id,
      version: 2,
      month: '2026-01-01',
      total_revenue: 9,
      direct_residential_revenue: null,
      commercial_direct_revenue: null,
      portal_revenue: null,
      total_jobs: 2,
      dryer_vent_jobs: null,
      duct_jobs: null,
      ahu_jobs: null,
      productive_unit_hours: 1.5,
      field_payroll: null,
      indirect_cash_costs: null,
      ar_ending: null,
      cash_reserve: 0,
      notes: 'server note',
      source_note: 'server source',
    };
    const listed = { ok: true, actuals: [serverRow] };
    const applied = reloadCheckinFromServer(listed.actuals, id);
    assert.equal(applied.ok, true);
    assert.equal(applied.expectedVersion, 2);
    assert.equal(applied.form.total_revenue, '9.00');
    assert.equal(applied.form.cash_reserve, '0.00');
    assert.equal(applied.form.total_jobs, '2');
    assert.equal(applied.form.notes, 'server note');
    assert.equal(applied.form.total_revenue === staleForm.total_revenue, false);

    const saved = nextCheckinCorrection({
      conflict: false,
      saving: false,
      writesEnabled: true,
      selected: applied.actual,
      form: applied.form,
    });
    assert.equal(saved.ok, true);
    assert.equal(saved.payload.expectedVersion, 2);
    assert.equal(saved.payload.facts.total_revenue, 9);
    assert.equal(saved.payload.facts.cash_reserve, 0);
    assert.equal(saved.payload.facts.total_jobs, 2);
    assert.equal(saved.payload.facts.notes, 'server note');
    assert.equal(saved.payload.facts.total_revenue === staleFacts.total_revenue, false);
    assert.match(CHECKIN_CONFLICT_COPY, /discards the unsaved edits/);
    assert.match(CHECKIN_CONFLICT_COPY, /no merge/i);
  });
});

describe('monthly plan basis', () => {
  const id = '11111111-1111-4111-8111-111111111111';
  const olderId = '22222222-2222-4222-8222-222222222222';
  const newerId = '33333333-3333-4333-8333-333333333333';

  it('keeps version 1 free of a monthly basis and accepts a partial version 2 map', () => {
    const v1 = blankPlanInputs();
    v1.monthly_basis = {};
    assert.equal(validatePlanInputs(v1).code, 'invalid_inputs');
    assert.equal(validatePlanInputs(blankPlanInputs(), 1).ok, true);
    assert.equal(validatePlanInputs(blankPlanInputs(), 3).code, 'finance_schema_unsupported');
    const empty = blankPlanInputs();
    empty.monthly_basis = {};
    const accepted = validatePlanInputs(empty, 2);
    assert.equal(accepted.ok, true);
    assert.deepEqual(accepted.inputs.monthly_basis, {});
    const partial = blankPlanInputs();
    partial.monthly_basis = {
      '2026-02-01': { total_revenue: 10, cash_reserve: 0, total_jobs: null },
    };
    const before = structuredClone(partial);
    const normalized = validatePlanInputs(partial, 2);
    assert.equal(normalized.ok, true);
    assert.equal(normalized.inputs.monthly_basis['2026-02-01'].total_revenue, 10);
    assert.equal(normalized.inputs.monthly_basis['2026-02-01'].cash_reserve, 0);
    assert.equal(normalized.inputs.monthly_basis['2026-02-01'].total_jobs, null);
    assert.equal(Object.prototype.hasOwnProperty.call(normalized.inputs.monthly_basis['2026-02-01'], 'dryer_vent_jobs'), false);
    assert.deepEqual(partial, before);
    const missing = blankPlanInputs();
    assert.equal(validatePlanInputs(missing, 2).code, 'invalid_monthly_basis');
    assert.equal(validateMonthlyBasis({ '2026-02-15': { total_revenue: 1 } }).ok, false);
    assert.equal(validateMonthlyBasis({ '2026-02-01': { note: 1 } }).ok, false);
    assert.equal(validateMonthlyBasis({ '2026-02-01': { total_revenue: -1 } }).ok, false);
    assert.equal(validateMonthlyBasis({ '2026-02-01': { total_jobs: 1.5 } }).ok, false);
    assert.equal(validateMonthlyBasis({
      '2026-02-01': { total_revenue: 4, direct_residential_revenue: 5 },
    }).code, 'known_channels_exceed_total');
    assert.equal(validateMonthlyBasis({
      '2026-02-01': {
        total_revenue: 4,
        direct_residential_revenue: 1,
        commercial_direct_revenue: 1,
        portal_revenue: 1,
      },
    }).code, 'channels_must_equal_total');
    assert.equal(validateMonthlyBasis({
      '2026-02-01': {
        direct_residential_revenue: 1,
        commercial_direct_revenue: 1,
        portal_revenue: 1,
      },
    }).code, 'channels_require_total');
    assert.equal(validateMonthlyBasis({
      '2026-02-01': {
        total_revenue: 3,
        direct_residential_revenue: 1,
        commercial_direct_revenue: 1,
        portal_revenue: 1,
      },
    }).ok, true);
  });

  it('shows plan and variance only for an explicit figure on the associated plan', () => {
    const v1 = {
      id: olderId,
      schema_version: 1,
      status: 'approved',
      inputs: { stages: { stage_2: { scenario: { projected_revenue: 100 } } } },
    };
    assert.equal(declaredMonthlyBasis(v1), null);
    assert.equal(plannedFactsForMonth(v1, '2026-02'), null);
    const v2 = {
      id: newerId,
      schema_version: 2,
      status: 'approved',
      inputs: {
        monthly_basis: {
          '2026-02-01': { total_revenue: 10, cash_reserve: 0 },
          '2026-03-01': { total_revenue: 0, total_jobs: 2, cash_reserve: null },
        },
      },
    };
    const february = plannedFactsForMonth(v2, '2026-02-01');
    assert.equal(february.total_revenue, 10);
    assert.equal(february.cash_reserve, 0);
    assert.equal(february.total_jobs, null);
    const februaryDerived = derivedActualMetrics(february);
    assert.equal(februaryDerived.average_ticket, null);
    assert.equal(februaryDerived.cash_reserve_over_revenue, 0);
    assert.equal(februaryDerived.portal_share, null);
    const march = plannedFactsForMonth(v2, '2026-03');
    assert.equal(march.total_revenue, 0);
    assert.equal(march.total_jobs, 2);
    assert.equal(march.cash_reserve, null);
    assert.equal(derivedActualMetrics(march).average_ticket, 0);
    const full = plannedFactsForMonth({
      schema_version: 2,
      inputs: {
        monthly_basis: {
          '2026-04-01': {
            total_revenue: 10,
            direct_residential_revenue: 3,
            commercial_direct_revenue: 3,
            portal_revenue: 4,
            total_jobs: 2,
            productive_unit_hours: 1.5,
            field_payroll: 1,
            indirect_cash_costs: 0,
            ar_ending: 0,
            cash_reserve: 0,
          },
        },
      },
    }, '2026-04-01');
    assert.equal(derivedActualMetrics(full).portal_share, 0.4);
    assert.equal(derivedActualMetrics(full).average_ticket, 5);
    assert.equal(variance(4, february.total_revenue), -6);
    assert.equal(variance(0, february.cash_reserve), 0);
    assert.equal(variance(2, february.total_jobs), null);
    assert.equal(variance(4, null), null);
    const historical = {
      comparison_plan_id: olderId,
      month: '2026-01-01',
    };
    const plans = [v2, v1];
    assert.equal(comparisonPlanForCheckin({
      selected: historical,
      plans,
      approved: v2,
      associateOnCreate: true,
    }).id, olderId);
    assert.equal(comparisonPlanForCheckin({
      selected: { comparison_plan_id: 'missing', month: '2026-01-01' },
      plans,
      approved: v2,
      associateOnCreate: true,
    }), null);
    assert.equal(comparisonPlanForCheckin({
      selected: null,
      plans,
      approved: v2,
      associateOnCreate: true,
    }).id, newerId);
    assert.equal(comparisonPlanForCheckin({
      selected: null,
      plans,
      approved: v2,
      associateOnCreate: false,
    }), null);
  });

  it('persists version 2 only when the caller names that schema', async () => {
    const updates = [];
    const row = {
      update(payload) { updates.push(payload); return row; },
      eq() { return row; },
      select() { return row; },
      maybeSingle: async () => ({ data: { id, schema_version: 2, version: 2 }, error: null }),
    };
    const inputs = blankPlanInputs();
    inputs.monthly_basis = { '2026-02-01': { total_revenue: 10, cash_reserve: 0 } };
    const saved = await saveDraft({ from: () => row }, {
      id,
      expectedVersion: 1,
      inputs,
      notes: 'keep',
      schemaVersion: 2,
    }, { MODE: 'test' });
    assert.equal(saved.ok, true);
    assert.equal(updates[0].inputs.monthly_basis['2026-02-01'].total_revenue, 10);
    assert.equal(updates[0].inputs.monthly_basis['2026-02-01'].cash_reserve, 0);
    assert.equal(updates[0].notes, 'keep');
    let called = false;
    const rejected = await saveDraft({
      from() { called = true; return {}; },
    }, {
      id,
      expectedVersion: 1,
      inputs,
      notes: null,
    }, { MODE: 'test' });
    assert.equal(rejected.code, 'invalid_inputs');
    assert.equal(called, false);
    const inserts = [];
    const insertRow = {
      insert(payload) { inserts.push(payload); return insertRow; },
      select() { return insertRow; },
      maybeSingle: async () => ({ data: { id, schema_version: 1 }, error: null }),
    };
    const created = await createBlankPlan({ from: () => insertRow }, { MODE: 'test' });
    assert.equal(created.ok, true);
    assert.equal(inserts[0].schema_version, 2);
    assert.deepEqual(inserts[0].inputs.monthly_basis, {});
    const structural = blankPlanInputs();
    for (const key of Object.keys(structural)) {
      assert.deepEqual(inserts[0].inputs[key], structural[key]);
    }
  });

  it('reads version 2 and upgrades a draft only through the server RPC', async () => {
    function reader(data) {
      const row = {
        select() { return row; },
        eq() { return row; },
        maybeSingle: async () => ({ data, error: null }),
      };
      return { from: () => row };
    }
    const inputs = blankPlanInputs();
    inputs.monthly_basis = { '2026-02-01': { cash_reserve: 0 } };
    const read = await readPlan(reader({ id, schema_version: 2, inputs }), id);
    assert.equal(read.ok, true);
    assert.equal(read.plan.inputs.monthly_basis['2026-02-01'].cash_reserve, 0);
    const unsupported = await readPlan(reader({ id, schema_version: 3, inputs: blankPlanInputs() }), id);
    assert.equal(unsupported.code, 'finance_schema_unsupported');
    const invalid = await readPlan(reader({
      id,
      schema_version: 2,
      inputs: { monthly_basis: { '2026-02-01': { total_revenue: -1 } } },
    }), id);
    assert.equal(invalid.code, 'finance_schema_unsupported');
    const v1 = await readPlan(reader({ id, schema_version: 1, inputs: blankPlanInputs() }), id);
    assert.equal(v1.ok, true);
    const calls = [];
    const upgraded = await upgradeDraftSchema({
      rpc(name, args) {
        calls.push({ name, args });
        return { data: { id, schema_version: 2, version: 5 }, error: null };
      },
    }, { id, expectedVersion: 4 }, { MODE: 'test' });
    assert.equal(upgraded.ok, true);
    assert.equal(calls[0].name, 'finance_upgrade_draft_schema');
    assert.deepEqual(calls[0].args, { p_plan_id: id, p_expected_version: 4 });
    const conflict = await upgradeDraftSchema({
      rpc() { return { data: null, error: { code: '40001', message: 'finance_version_conflict' } }; },
    }, { id, expectedVersion: 1 }, { MODE: 'test' });
    assert.equal(conflict.code, 'version_conflict');
  });

  it('maps PT409 and the stable identifier onto the version-conflict banner without treating every 409 as one', async () => {
    function client(error) {
      return { rpc() { return { data: null, error }; } };
    }
    const identified = {
      code: 'PT409',
      message: 'finance_version_conflict',
      details: 'finance_version_conflict',
      hint: 'finance_version_conflict',
    };
    const plan = { id, expectedVersion: 1 };
    const env = { MODE: 'test' };
    assert.equal((await approvePlan(client(identified), plan, env)).code, 'version_conflict');
    assert.equal((await upgradeDraftSchema(client(identified), plan, env)).code, 'version_conflict');
    assert.equal((await openDraftFromApproved(client(identified), { id }, env)).code, 'version_conflict');
    assert.equal((await approvePlan(client({ code: '40001' }), plan, env)).code, 'version_conflict');
    assert.equal((await upgradeDraftSchema(client({ hint: 'finance_version_conflict' }), plan, env)).code, 'version_conflict');
    assert.equal((await approvePlan(client({ details: 'finance_version_conflict' }), plan, env)).code, 'version_conflict');
    assert.equal((await approvePlan(client({ status: 409, message: 'conflict' }), plan, env)).code, 'finance_approve_failed');
    assert.equal((await upgradeDraftSchema(client({ status: 409, message: 'conflict' }), plan, env)).code, 'finance_schema_upgrade_failed');
    assert.equal((await upgradeDraftSchema(client({ code: '23514', message: 'finance_plan_locked' }), plan, env)).code, '23514');
    assert.equal((await openDraftFromApproved(client({ code: '02000', message: 'finance_no_approved_plan' }), { id }, env)).code, '02000');
    assert.equal(isFinanceVersionConflict({ status: 409 }), false);
    assert.equal(isFinanceVersionConflict(null), false);
    const shell = readFileSync(path.join(root, 'src/pages/finance/FinanceShell.jsx'), 'utf8');
    assert.match(shell, /async function onSave\(\) \{\n    if \(conflict\) return;/);
    assert.match(shell, /async function onUpgradeSchema\(\) \{\n    if \(conflict\) return;/);
    assert.match(shell, /async function onApprove\(\) \{\n    if \(conflict\) return;/);
    assert.match(shell, /async function onNewDraft\(\) \{\n    if \(conflict\) return;/);
    assert.match(shell, /data-testid="finance-save" onClick=\{onSave\} disabled=\{!writesEnabled \|\| conflict\}/);
    assert.match(shell, /data-testid="finance-approve" onClick=\{onApprove\} disabled=\{!writesEnabled \|\| conflict \|\| planNotApprovable\}/);
    assert.match(shell, /data-testid="finance-new-draft" onClick=\{onNewDraft\} disabled=\{!writesEnabled \|\| conflict\}/);
    assert.match(shell, /data-testid="finance-upgrade-schema" onClick=\{onUpgradeSchema\} disabled=\{!writesEnabled \|\| dirty \|\| conflict\}/);
    assert.match(shell, /disabled=\{!writesEnabled\}/);
    const checkin = readFileSync(path.join(root, 'src/pages/finance/MonthlyCheckIn.jsx'), 'utf8');
    assert.match(checkin, /finally \{\n      setSaving\(false\);\n    \}/);
    const gate = readFileSync(path.join(root, 'tools/finance-release-gate.mjs'), 'utf8');
    assert.match(gate, /finance-version-conflict-http\.mjs/);
    assert.equal(/SERVICE_ROLE_KEY:\s*serviceRole/.test(gate), false);
  });

  it('a stored plan whose inputs are only an empty monthly basis does not throw and the shell shows a repair state', () => {
    const plan = {
      id,
      schema_version: 2,
      status: 'approved',
      inputs: { monthly_basis: {} },
    };
    const decision = storedPlanDecision(plan);
    assert.equal(decision.ok, false);
    assert.equal(decision.code, 'finance_schema_unsupported');
    assert.equal(Object.prototype.hasOwnProperty.call(decision, 'inputs'), false);
    assert.equal(JSON.stringify(decision).includes('monthly_basis'), false);
    assert.throws(() => {
      void plan.inputs.stages.stage_0.label;
    });
    const shell = readFileSync(path.join(root, 'src/pages/finance/FinanceShell.jsx'), 'utf8');
    const applyStart = shell.indexOf('function applyPlan');
    const applyEnd = shell.indexOf('async function refreshPlans');
    const apply = shell.slice(applyStart, applyEnd);
    const gate = apply.indexOf('storedPlanDecision(plan)');
    const write = apply.indexOf('setInputs(held.inputs)');
    assert.ok(gate > -1 && write > gate);
    assert.ok(apply.indexOf('resolveStoredPlan(plan)') > gate);
    assert.match(apply, /if \(!decision\.ok\) \{[\s\S]*setInputs\(null\)[\s\S]*return;/);
    assert.equal(/console\./.test(apply), false);
    assert.match(shell, /loadErrorCopy\(loadCode\)/);
    assert.match(shell, /STORED_PLAN_INVALID_COPY/);
    assert.match(shell, /data-testid="finance-load-error"/);
    assert.match(shell, /Stored plan needs repair/);
    assert.equal(shell.includes(STORED_PLAN_INVALID_COPY), false);
    const valid = storedPlanDecision({ schema_version: 1, inputs: blankPlanInputs() });
    assert.equal(valid.ok, true);
  });

  it('typing a decimal monthly basis keeps the point until the amount is complete', () => {
    function typeSequence(chars) {
      let text = '';
      let value = null;
      const seen = [];
      for (const ch of chars) {
        const next = typeBasisAmount(text, text + ch);
        text = next.text;
        seen.push(text);
        if (next.commit === 'set') value = next.value;
        if (next.commit === 'clear') value = null;
      }
      return { text, value, seen };
    }
    const five = typeSequence('10.5');
    assert.deepEqual(five.seen, ['1', '10', '10.', '10.5']);
    assert.equal(five.text, '10.5');
    assert.equal(five.value, 10.5);
    assert.equal(five.seen.includes('105'), false);
    const fiveCents = typeSequence('10.05');
    assert.deepEqual(fiveCents.seen, ['1', '10', '10.', '10.0', '10.05']);
    assert.equal(fiveCents.text, '10.05');
    assert.equal(fiveCents.value, 10.05);
    assert.equal(fiveCents.seen.includes('1005'), false);
    const shell = readFileSync(path.join(root, 'src/pages/finance/FinanceShell.jsx'), 'utf8');
    assert.match(shell, /basisAmountDraft/);
    assert.match(shell, /draft\[field\.key\]/);
    assert.match(shell, /blurAmount/);
  });
});

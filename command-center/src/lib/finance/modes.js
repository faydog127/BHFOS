/**
 * Presentation selectors for the three Finance modes.
 * Numbers come from calculatePlan, buildFinanceView, plannedFactsForMonth,
 * variance, and derivedActualMetrics. This module does not define a metric.
 * Mode is not an input to the figures: factsForMode returns the same object.
 */
import { CHECKIN_FIELDS, derivedActualMetrics, plannedFactsForMonth } from './actuals.js';
import { formatNumber, formatPercentFromFraction } from './format.js';
import { READINESS_INCOMPLETE, READINESS_READY } from './readiness.js';
import { variance, variancePct } from './variance.js';
import { EXPLANATIONS, MISSING_MARK, NOT_PROVIDED, showCents, showHours, showMoney } from './viewModel.js';

export const FINANCE_MODES = Object.freeze([
  { id: 'guided', label: 'Guided' },
  { id: 'executive', label: 'Executive' },
  { id: 'advanced', label: 'Advanced Analytics' },
]);

export const UNCONNECTED_FACTS = Object.freeze([
  { key: 'invoiced_amount', label: 'Invoiced amount', display: 'unavailable / not connected' },
  { key: 'cash_collected', label: 'Cash collected', display: 'unavailable / not connected' },
]);

export const APPOINTMENT_PRICE_BOUNDARY =
  'Scheduled appointment price is not earned operating revenue. This screen does not use it.';

const BASIS_COPY = Object.freeze({
  no_actual: 'No monthly actual yet. Plan and variance stay blank.',
  no_comparison_plan: 'No comparison plan. Plan and variance stay blank.',
  no_monthly_basis: 'No declared monthly basis. Plan and variance are not zero.',
  declared_monthly_basis: 'Only a planned figure has a plan and a variance. A blank plan figure is not zero.',
});

export const GUIDED_BRIEFS = Object.freeze({
  overview: {
    what: 'The stored plan, the stage illustration, and any monthly figures you declare for later comparison.',
    enter: 'Monthly plan basis for one month at a time. Leave a figure blank when it is not planned. Enter zero only when zero is the plan.',
    why: 'Monthly Check-In compares an actual with the month stored on the plan that was associated. A stage total is not that month.',
    affects: 'Plan and variance for that month after the plan is approved and associated. It does not fill actuals.',
    result: 'Stage results are below. Actuals are entered on Monthly Check-In.',
  },
  people: {
    what: 'Roles, wages, burden, hours, and headcount that feed field payroll and the owner field reserve.',
    enter: 'Wage, burden, weekly hours, and headcount by stage. Management compensation and shadow field hours sit with the owner block.',
    why: `${EXPLANATIONS.laborBurden} ${EXPLANATIONS.ownerManagement}`,
    affects: 'Field payroll, support payroll, economic operating cost, and required monthly revenue.',
    result: 'Loaded stage payroll and the owner field reserve use the calculator. Empty inputs stay blank.',
  },
  trucks: {
    what: 'Direct production costs and the field overhead that keeps trucks and tools available.',
    enter: 'Each cost-pool line by stage. Debt service and the replacement sinking fund stay on their own lines.',
    why: `${EXPLANATIONS.directProduction} ${EXPLANATIONS.fieldOverhead}`,
    affects: 'Cash operating cost and the revenue required to cover it.',
    result: 'The stage cost totals are calculator output. A blank line is not zero.',
  },
  office: {
    what: 'General and administrative cost of running the company, plus support payroll calculated from People.',
    enter: 'Office and G&A lines by stage. Support wages are edited on People & Payroll.',
    why: EXPLANATIONS.ga,
    affects: 'Cash operating cost. Stage 0 office miscellaneous is a balancing planning amount, not a verified cost.',
    result: 'G&A by stage is the calculator total for those lines.',
  },
  growth: {
    what: 'The retention hurdle, safety months, and the channel mix used for the weighted DSO assumption.',
    enter: 'Operating profit, growth reserve, bad debt, and contingency fractions, plus channel share and DSO days.',
    why: `${EXPLANATIONS.growthReserve} ${EXPLANATIONS.badDebt} ${EXPLANATIONS.contingency} ${EXPLANATIONS.workingCapital}`,
    affects: 'Required monthly revenue and the liquidity illustration. Channel shares are not renormalized.',
    result: 'The hurdle and weighted DSO are shown from the calculator. An invalid hurdle blanks required revenue.',
  },
  production: {
    what: 'How many revenue-producing units the illustration expects to sell, and the HVAC authorization flag.',
    enter: 'Route density and the site clocks you are willing to plan. HVAC delivery is an explicit authorization, not a forecast.',
    why: `${EXPLANATIONS.productionUnit} ${EXPLANATIONS.utilization} ${EXPLANATIONS.hvac}`,
    affects: 'Capacity prices, route gaps, and whether Stage 3 headline includes HVAC payroll.',
    result: 'Travel hours stay not provided. HVAC revenue stays not provided.',
  },
  pricing: {
    what: 'Planned prices next to capacity prices. The variance is a diagnostic, not a pricing policy.',
    enter: 'The planned price for each service. The other columns are results.',
    why: EXPLANATIONS.pricing,
    affects: 'The signed variance against the stage 2 capacity price.',
    result: 'A missing price or a missing capacity stays blank. It is not treated as zero.',
  },
  stages: {
    what: 'The four growth stages, with Stage 3 shown as the authorized headline.',
    enter: 'Stage counts and hours are edited on the earlier sections. This section reads the results.',
    why: EXPLANATIONS.workingCapital,
    affects: 'Which stage you are judging for readiness. Readiness does not authorize hiring or spending.',
    result: 'Cash cost, economic cost, required revenue, and readiness come from the calculator.',
  },
  checkin: {
    what: 'The month’s earned operating revenue and the other check-in facts.',
    enter: 'Actuals on Monthly Check-In. This planning screen does not save them.',
    why: 'Plan and variance use the associated comparison plan only.',
    affects: 'The month row and its history. Association is one-time.',
    result: 'A blank plan figure stays blank. A planned zero stays zero.',
  },
});

export function normalizeFinanceMode(value) {
  return FINANCE_MODES.some((mode) => mode.id === value) ? value : 'guided';
}

export function factsForMode(support, mode) {
  normalizeFinanceMode(mode);
  return support;
}

function measure(value) {
  if (value === null || value === undefined || value === '') return null;
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function showCount(value) {
  if (value === null || value === undefined) return MISSING_MARK;
  return String(value);
}

function showFraction(value) {
  return formatPercentFromFraction(value);
}

function showPlainNumber(value) {
  if (value === null || value === undefined) return MISSING_MARK;
  return formatNumber(value, 2);
}

function factCell(kind, value) {
  const measured = measure(value);
  if (measured === null) return { value: null, display: MISSING_MARK };
  if (kind === 'money') return { value: measured, display: showCents(measured) };
  if (kind === 'hours') return { value: measured, display: showHours(measured) };
  return { value: measured, display: showCount(measured) };
}

function basisKind(actual, plan) {
  if (!actual) return 'no_actual';
  if (!plan) return 'no_comparison_plan';
  if (plan.schema_version !== 2) return 'no_monthly_basis';
  return 'declared_monthly_basis';
}

function comparisonPlan(actual, plans) {
  if (!actual?.comparison_plan_id) return null;
  return (Array.isArray(plans) ? plans : []).find((plan) => plan.id === actual.comparison_plan_id) || null;
}

function comparisonRows(actual, plan) {
  const planned = plan ? plannedFactsForMonth(plan, actual?.month) : null;
  return CHECKIN_FIELDS.map((field) => {
    const actualValue = actual ? measure(actual[field.key]) : null;
    const planValue = planned ? measure(planned[field.key]) : null;
    const delta = variance(actualValue, planValue);
    const pct = variancePct(actualValue, planValue);
    return {
      key: field.key,
      label: field.technical,
      guided: field.guided,
      kind: field.kind,
      plan: factCell(field.kind, planValue),
      actual: factCell(field.kind, actualValue),
      variance: factCell(field.kind, delta),
      variancePct: pct === null ? MISSING_MARK : showFraction(pct),
    };
  });
}

function monthStamp(value) {
  return String(value || '').slice(0, 7);
}

export function buildDecisionSupport({ view, result, inputs, actuals, plans }) {
  const planRows = Array.isArray(plans) ? plans : [];
  const actualRows = (Array.isArray(actuals) ? actuals : [])
    .filter((row) => row && row.month)
    .slice()
    .sort((a, b) => String(a.month).localeCompare(String(b.month)));
  const latest = actualRows.length ? actualRows[actualRows.length - 1] : null;
  const latestPlan = comparisonPlan(latest, planRows);
  const latestKind = basisKind(latest, latestPlan);
  const latestRows = comparisonRows(latest, latestPlan);
  const history = actualRows.map((row) => {
    const plan = comparisonPlan(row, planRows);
    const kind = basisKind(row, plan);
    return {
      month: String(row.month),
      label: monthStamp(row.month),
      comparisonPlanId: row.comparison_plan_id || null,
      schemaVersion: plan ? plan.schema_version : null,
      basisKind: kind,
      basisCopy: BASIS_COPY[kind],
      rows: comparisonRows(row, plan),
    };
  });

  const selectedKey = view?.selectedStageKey || null;
  const selectedCard = view?.stages?.find((stage) => stage.key === selectedKey) || null;
  const selectedRaw = selectedKey ? result?.stages?.[selectedKey] || null : null;
  const scenario = inputs?.stages?.[selectedKey]?.scenario || null;

  const stageSeries = [];
  if (result?.stages && view?.chart) {
    for (const item of view.chart) {
      const match = [...view.stages, view.stage3Headline].find((stage) => stage.label === item.label);
      const rawKey = match?.key === 'stage_3_plus_hvac' || match?.key === 'stage_3_core'
        ? match.key
        : match?.key;
      const raw = rawKey ? result.stages[rawKey] : null;
      const requiredMonthlyRevenue = item.value ?? null;
      const cashOperatingCost = raw ? raw.cashOperatingCost ?? null : null;
      const economicOperatingCost = raw ? raw.economicOperatingCost ?? null : null;
      stageSeries.push({
        key: rawKey || item.label,
        label: item.label,
        requiredMonthlyRevenue,
        requiredDisplay: showMoney(requiredMonthlyRevenue),
        cashOperatingCost,
        cashDisplay: showMoney(cashOperatingCost),
        economicOperatingCost,
        economicDisplay: showMoney(economicOperatingCost),
        readiness: match?.readiness || READINESS_INCOMPLETE,
      });
    }
  }

  const measuredLatest = {};
  for (const field of CHECKIN_FIELDS) {
    measuredLatest[field.key] = latest ? measure(latest[field.key]) : null;
  }
  const actualDerived = derivedActualMetrics(measuredLatest);
  const plannedDerived = latestPlan && latest
    ? derivedActualMetrics(plannedFactsForMonth(latestPlan, latest.month) || {})
    : null;

  const exceptions = [];
  if (!view) {
    exceptions.push({ id: 'no_plan', text: 'No stored plan.' });
  } else {
    if (view.errors.length > 0) {
      exceptions.push({
        id: 'inputs',
        text: 'Some inputs are incomplete or invalid. Affected results show --.',
      });
    }
    for (const stage of view.stages) {
      if (stage.readiness !== READINESS_READY) {
        exceptions.push({ id: `readiness-${stage.key}`, text: `${stage.label}: ${stage.readiness}` });
      }
    }
    if (view.channelShareWarning === true) {
      exceptions.push({
        id: 'channels',
        text: `Channel shares do not total 100%. Shown total ${view.channelShareTotalDisplay}. The weighted DSO is not renormalized.`,
      });
    }
    if (view.hvacEnabled !== true) {
      exceptions.push({ id: 'hvac', text: view.hvacDisabledCopy });
    }
    exceptions.push({
      id: 'capacity',
      text: `Practical billable capacity: ${view.missing.practicalBillableCapacity}. Utilization band: ${view.utilizationBand}.`,
    });
  }

  const channels = (inputs?.channels || []).map((channel) => ({
    key: channel.key,
    label: channel.label,
    share: showFraction(measure(channel.share)),
    dso: channel.dso_days === null || channel.dso_days === undefined ? MISSING_MARK : showPlainNumber(measure(channel.dso_days)),
  }));

  const assumptions = scenario ? [
    { key: 'practical_billable_capacity', label: 'Practical billable capacity', display: showPlainNumber(measure(scenario.practical_billable_capacity)) },
    { key: 'projected_billable_utilization', label: 'Projected billable utilization', display: showFraction(measure(scenario.projected_billable_utilization)) },
    { key: 'projected_contribution', label: 'Projected contribution', display: showCents(measure(scenario.projected_contribution)) },
    { key: 'cash_reserve', label: 'Scenario cash reserve', display: showCents(measure(scenario.cash_reserve)) },
    { key: 'projected_revenue', label: 'Projected revenue', display: showCents(measure(scenario.projected_revenue)) },
    { key: 'modeled_labor_and_fixed_load', label: 'Modeled labor and fixed load', display: showCents(measure(scenario.modeled_labor_and_fixed_load)) },
    { key: 'utilization', label: 'Utilization', display: showFraction(measure(inputs?.stages?.[selectedKey]?.utilization)) },
  ] : [];

  const burden = (inputs?.staffing || []).map((role) => ({
    key: role.key,
    label: role.label,
    burden: showFraction(measure(role.burden)),
    wage: showCents(measure(role.wage)),
  }));

  return {
    hasPlan: Boolean(view),
    selectedStageKey: selectedKey,
    stageLabel: selectedCard?.label || MISSING_MARK,
    requiredMonthlyRevenue: selectedCard?.requiredRevenue || MISSING_MARK,
    cashOperatingCost: selectedCard?.cash || MISSING_MARK,
    economicOperatingCost: selectedCard?.economic || MISSING_MARK,
    liquidity: selectedCard?.liquidity || MISSING_MARK,
    fieldHeadcount: selectedCard?.fieldHeadcount || NOT_PROVIDED,
    ownerFieldReserve: selectedCard?.ownerFieldReserve || MISSING_MARK,
    productiveHours: selectedCard?.productiveHours || MISSING_MARK,
    perHour: selectedCard?.perHour || MISSING_MARK,
    readiness: selectedCard?.readiness || READINESS_INCOMPLETE,
    utilizationBand: view?.utilizationBand || NOT_PROVIDED,
    hiredFieldPayroll: showCents(selectedRaw?.hiredFieldPayroll ?? null),
    weightedDso: selectedCard?.weightedDso || MISSING_MARK,
    estimatedAr: showMoney(selectedRaw?.estimatedAr ?? null),
    operatingCashFloat: showMoney(selectedRaw?.operatingCashFloat ?? null),
    advisory: view?.advisory || '',
    hvacRevenue: view?.missing?.hvacRevenue || NOT_PROVIDED,
    stage3Caveat: view?.stage3Headline?.caveat || null,
    stageSeries,
    services: view?.services || [],
    routes: view?.routes || [],
    channels,
    channelShareTotal: view?.channelShareTotalDisplay || MISSING_MARK,
    assumptions,
    burden,
    actualDerived: {
      revenuePerHour: showCents(actualDerived.revenue_per_productive_hour),
      jobsPerHour: actualDerived.jobs_per_productive_hour === null ? MISSING_MARK : showPlainNumber(actualDerived.jobs_per_productive_hour),
      fieldPayrollShare: showFraction(actualDerived.field_payroll_pct_of_revenue),
      portalShare: showFraction(actualDerived.portal_share),
      directShare: showFraction(actualDerived.direct_share),
    },
    plannedDerived: plannedDerived ? {
      revenuePerHour: showCents(plannedDerived.revenue_per_productive_hour),
      portalShare: showFraction(plannedDerived.portal_share),
      directShare: showFraction(plannedDerived.direct_share),
    } : null,
    latest: {
      month: latest ? String(latest.month) : null,
      label: latest ? monthStamp(latest.month) : null,
      comparisonPlanId: latest?.comparison_plan_id || null,
      schemaVersion: latestPlan ? latestPlan.schema_version : null,
      basisKind: latestKind,
      basisCopy: BASIS_COPY[latestKind],
      rows: latestRows,
    },
    history,
    revenueHistory: history.map((row) => {
      const revenue = row.rows.find((item) => item.key === 'total_revenue');
      return {
        label: row.label,
        plan: revenue.plan.value,
        actual: revenue.actual.value,
      };
    }),
    channelActuals: ['direct_residential_revenue', 'commercial_direct_revenue', 'portal_revenue'].map((key) => {
      const row = latestRows.find((item) => item.key === key);
      return { key, label: row?.label || key, value: row?.actual.value ?? null };
    }),
    exceptions,
    unconnected: UNCONNECTED_FACTS,
    appointmentBoundary: APPOINTMENT_PRICE_BOUNDARY,
  };
}

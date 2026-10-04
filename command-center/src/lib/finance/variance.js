/**
 * Plan vs actual. Either side null → null. plan === 0 → variance percent null.
 * Favorable direction is declared only for the metrics Command Center classified.
 */

export function variance(actual, plan) {
  if (actual === null || actual === undefined || plan === null || plan === undefined) return null;
  if (typeof actual !== 'number' || typeof plan !== 'number') return null;
  if (!Number.isFinite(actual) || !Number.isFinite(plan)) return null;
  return actual - plan;
}

export function variancePct(actual, plan) {
  const delta = variance(actual, plan);
  if (delta === null) return null;
  if (plan === 0) return null;
  return delta / Math.abs(plan);
}

/** higher = larger actual is favorable. lower = smaller actual is favorable. null = undeclared. */
export const FAVORABLE_DIRECTION = Object.freeze({
  total_revenue: 'higher',
  direct_residential_revenue: 'higher',
  commercial_direct_revenue: 'higher',
  portal_revenue: 'higher',
  gross_profit: 'higher',
  contribution: 'higher',
  cash_reserve: 'higher',
  field_payroll: 'lower',
  indirect_cash_costs: 'lower',
  cost: 'lower',
  dso: 'lower',
  overtime: 'lower',
  excess_labor_hours: 'lower',
  total_jobs: null,
  dryer_vent_jobs: null,
  duct_jobs: null,
  ahu_jobs: null,
  productive_unit_hours: null,
  ar_ending: null,
  average_ticket: null,
  revenue_per_productive_hour: null,
  portal_share: null,
  direct_share: null,
  jobs_per_productive_hour: null,
  field_payroll_pct_of_revenue: null,
  indirect_cost_pct_of_revenue: null,
  ar_over_revenue: null,
  cash_reserve_over_revenue: null,
});

export const MONTHLY_CHECKIN_METRICS = Object.freeze([
  { key: 'total_revenue', label: 'Total revenue', direction: 'higher' },
  { key: 'direct_residential_revenue', label: 'Direct residential revenue', direction: 'higher' },
  { key: 'commercial_direct_revenue', label: 'Commercial direct revenue', direction: 'higher' },
  { key: 'portal_revenue', label: 'Portal revenue', direction: 'higher' },
  { key: 'total_jobs', label: 'Total jobs', direction: null },
  { key: 'dryer_vent_jobs', label: 'Dryer vent jobs', direction: null },
  { key: 'duct_jobs', label: 'Duct jobs', direction: null },
  { key: 'ahu_jobs', label: 'AHU jobs', direction: null },
  { key: 'productive_unit_hours', label: 'Productive unit-hours', direction: null },
  { key: 'field_payroll', label: 'Field payroll', direction: 'lower' },
  { key: 'indirect_cash_costs', label: 'Indirect cash costs', direction: 'lower' },
  { key: 'ar_ending', label: 'AR ending', direction: null },
  { key: 'cash_reserve', label: 'Cash reserve', direction: 'higher' },
]);

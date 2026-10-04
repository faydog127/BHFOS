/**
 * Advisory readiness. Missing inputs are Incomplete / Needs review, never a false zero.
 * Ready is possible only when every required scenario input is present and all four
 * conditions hold. Seed data leaves the practical-capacity denominator empty, so
 * Ready cannot appear from the fixture alone.
 */

export const READINESS_READY = 'Ready';
export const READINESS_NOT_READY = 'NotReady';
export const READINESS_INCOMPLETE = 'Incomplete / Needs review';

export const READINESS_ADVISORY_COPY =
  'Readiness is advisory planning output only. It does not authorize hiring, payroll, purchasing, licensing, or customer commitments.';

export function nearCapacityBand(utilization) {
  if (utilization === null || utilization === undefined) return null;
  if (typeof utilization !== 'number' || !Number.isFinite(utilization)) return null;
  if (utilization < 0.85) return 'below_near';
  if (utilization < 1) return 'near_capacity';
  return 'at_or_over_capacity';
}

function presentNumber(value) {
  return typeof value === 'number' && Number.isFinite(value);
}

/**
 * inputs:
 * - projectedContribution
 * - cashCoverageMonths
 * - safetyMonths
 * - projectedBillableUtilization (of practical billable capacity)
 * - practicalBillableCapacity
 * - projectedRevenue
 * - modeledLaborAndFixedLoad
 */
export function stageReadiness(inputs) {
  const source = inputs || {};
  const required = [
    source.projectedContribution,
    source.cashCoverageMonths,
    source.safetyMonths,
    source.projectedBillableUtilization,
    source.practicalBillableCapacity,
    source.projectedRevenue,
    source.modeledLaborAndFixedLoad,
  ];
  if (!required.every(presentNumber)) return READINESS_INCOMPLETE;
  if (source.practicalBillableCapacity <= 0) return READINESS_INCOMPLETE;
  if (!(source.safetyMonths >= 0)) return READINESS_INCOMPLETE;

  const contributionPositive = source.projectedContribution > 0;
  const cashCovers = source.cashCoverageMonths >= source.safetyMonths;
  const reachedNearCapacity = source.projectedBillableUtilization >= 0.85;
  const revenueSupportsLoad = source.projectedRevenue >= source.modeledLaborAndFixedLoad;
  if (contributionPositive && cashCovers && reachedNearCapacity && revenueSupportsLoad) {
    return READINESS_READY;
  }
  return READINESS_NOT_READY;
}

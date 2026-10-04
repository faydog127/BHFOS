/**
 * Display model for the planning screens.
 * Null stays "--" or "Not provided". It is never rendered as zero.
 */
import {
  HVAC_REVENUE_MISSING_COPY,
  OWNER_FIELD_RESERVE_LABEL,
  STAGE_3_CORE_CAVEAT,
  STAGE_KEYS,
} from './calculate.js';
import { formatCurrencyCents, formatCurrencyWhole, formatHours, formatPercentFromFraction } from './format.js';
import { READINESS_INCOMPLETE, READINESS_ADVISORY_COPY, nearCapacityBand } from './readiness.js';
import { MONTHLY_CHECKIN_METRICS } from './variance.js';

export const NOT_PROVIDED = 'Not provided';
export const MISSING_MARK = '--';

export function showMoney(value) {
  return formatCurrencyWhole(value);
}

export function showCents(value) {
  return formatCurrencyCents(value);
}

export function showHours(value) {
  if (value === null || value === undefined) return MISSING_MARK;
  return formatHours(value);
}

function stageCard(stage, options = {}) {
  return {
    key: stage.key,
    label: stage.label,
    cash: showMoney(stage.cashOperatingCost),
    economic: showMoney(stage.economicOperatingCost),
    requiredRevenue: showMoney(stage.requiredMonthlyRevenue),
    perAvailableDay: showMoney(stage.revenuePerAvailableUnitDay),
    perRealizedDay: showMoney(stage.revenuePerRealizedDay),
    perHour: showMoney(stage.revenuePerProductiveUnitHour),
    productiveHours: showHours(stage.productiveUnitHours),
    units: stage.revenueProducingUnits === null || stage.revenueProducingUnits === undefined ? NOT_PROVIDED : String(stage.revenueProducingUnits),
    liquidity: showMoney(stage.liquidityPlanningTarget),
    fieldHeadcount: stage.fieldHeadcount === null || stage.fieldHeadcount === undefined ? NOT_PROVIDED : String(stage.fieldHeadcount),
    ownerFieldReserve: showMoney(stage.ownerFieldReplacement),
    hurdle: formatPercentFromFraction(stage.retentionHurdle),
    weightedDso: stage.weightedDso === null || stage.weightedDso === undefined ? MISSING_MARK : `${formatHours(stage.weightedDso)} days`,
    readiness: stage.readiness || READINESS_INCOMPLETE,
    derived: Boolean(options.derived),
    caveat: options.caveat || null,
    rawRequiredRevenue: stage.requiredMonthlyRevenue,
  };
}

export function buildFinanceView(document, result, selectedStageKey) {
  const selectedKey = STAGE_KEYS.includes(selectedStageKey) ? selectedStageKey : 'stage_2';
  const headlineIsCore = result.hvacDeliveryAuthorized !== true;
  const headline = headlineIsCore ? result.stages.stage_3_core : result.stages.stage_3_plus_hvac;
  const services = Object.values(result.services || {}).map((service) => ({
    key: service.key,
    label: service.label,
    plannedPrice: showCents(service.plannedPrice),
    siteClock: showHours(service.siteClockHours),
    unitHours: showHours(service.productionUnitHours),
    travelHours: showHours(service.travelHours),
    directLabor: showCents(service.directLabor),
    materials: showCents(service.materialCost),
    dispatch: showCents(service.dispatchDollars),
    directJobCost: showCents(service.directJobCost),
    indirect: showCents(service.indirectAllocation),
    fullySupported: showCents(service.fullySupportedCost),
    stage1Capacity: showCents(service.stage1CapacityPrice),
    stage2Capacity: showCents(service.stage2CapacityPrice),
    variance: showCents(service.priceVarianceVsStage2),
    varianceRaw: service.priceVarianceVsStage2,
  }));

  const missing = {
    travelHours: services.map((service) => ({ key: service.key, display: service.travelHours })),
    stage3CoreUnits: NOT_PROVIDED,
    stage3CoreUtilization: NOT_PROVIDED,
    stage3CoreProductiveHoursPerDay: NOT_PROVIDED,
    hvacNonLaborShare: NOT_PROVIDED,
    hvacRevenue: HVAC_REVENUE_MISSING_COPY,
    practicalBillableCapacity: NOT_PROVIDED,
    actualsSource: NOT_PROVIDED,
    monthlyPlanSeries: NOT_PROVIDED,
    readiness: READINESS_INCOMPLETE,
  };

  const checkin = MONTHLY_CHECKIN_METRICS.map((metric) => ({
    key: metric.key,
    label: metric.label,
    direction: metric.direction,
    plan: MISSING_MARK,
    actual: MISSING_MARK,
    variance: MISSING_MARK,
    variancePct: MISSING_MARK,
  }));

  const selected = result.stages[selectedKey];
  const utilizationBand = nearCapacityBand(numOrNull(document.inputs?.stages?.[selectedKey]?.scenario?.projected_billable_utilization));

  return {
    label: document.meta?.label,
    advisory: READINESS_ADVISORY_COPY,
    ownerFieldReserveLabel: OWNER_FIELD_RESERVE_LABEL,
    stage3CoreCaveat: STAGE_3_CORE_CAVEAT,
    selectedStageKey: selectedKey,
    selected,
    stages: STAGE_KEYS.map((key) => stageCard(result.stages[key])),
    stage3Headline: stageCard(headline, {
      derived: headlineIsCore,
      caveat: headlineIsCore ? STAGE_3_CORE_CAVEAT : null,
    }),
    stage3Plus: stageCard(result.stages.stage_3_plus_hvac),
    stage3Core: stageCard(result.stages.stage_3_core, { derived: true, caveat: STAGE_3_CORE_CAVEAT }),
    hvacEnabled: result.hvacDeliveryAuthorized === true,
    hvacDisabledCopy: 'Not enabled — HVAC delivery not authorized in plan',
    services,
    routes: (result.routes?.rows || []).map((row) => ({
      stops: row.stops === null ? MISSING_MARK : String(row.stops),
      daily: showMoney(row.dailyRevenue),
      stage1Gap: showMoney(row.stage1Gap),
      stage2Gap: showMoney(row.stage2Gap),
      ticketStage2: showMoney(row.requiredAverageTicketStage2),
    })),
    controls: {
      indirectPerHour: showCents(result.stage2IndirectPerProductiveUnitHour),
      ductTargetPerDrop: showCents(result.routes?.stage2RequiredDuctPerDropTarget),
      ductStressPerDrop: showCents(result.routes?.stage2RequiredDuctPerDropStress),
      suggestedStressBook: showMoney(result.routes?.suggestedStressBookPricePerDrop),
    },
    channelShareWarning: result.channelShareWarning === true,
    channelShareTotal: result.channelShareTotal,
    channelShareTotalDisplay: result.channelShareTotal === null ? MISSING_MARK : formatPercentFromFraction(result.channelShareTotal),
    weightedDsoAssumption: 'Weighted DSO is an assumption from one channel mix applied to every stage, not an independently calculated per-stage value.',
    missing,
    checkin,
    utilizationBand: utilizationBand === null ? NOT_PROVIDED : utilizationBand,
    errors: result.errors || [],
    chart: [
      ...STAGE_KEYS.filter((key) => key !== 'stage_3').map((key) => ({
        label: result.stages[key].label,
        value: result.stages[key].requiredMonthlyRevenue,
      })),
      {
        label: headlineIsCore ? 'Stage 3 Core' : 'Stage 3 + HVAC',
        value: headline.requiredMonthlyRevenue,
      },
    ],
  };
}

function numOrNull(value) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

export const FINANCE_SECTIONS = Object.freeze([
  { id: 'overview', label: 'Overview', path: '' },
  { id: 'people', label: 'People & Payroll', path: 'people' },
  { id: 'trucks', label: 'Trucks & Equipment', path: 'trucks' },
  { id: 'office', label: 'Office & G&A', path: 'office' },
  { id: 'growth', label: 'Growth & Protection', path: 'growth' },
  { id: 'production', label: 'Production', path: 'production' },
  { id: 'pricing', label: 'Pricing', path: 'pricing' },
  { id: 'stages', label: 'Growth Stages', path: 'stages' },
  { id: 'checkin', label: 'Monthly Check-In', path: 'checkin' },
]);

export const EXPLANATIONS = Object.freeze({
  directProduction: 'Costs that increase because a job is performed: production wages, job materials, fuel, rentals.',
  laborBurden: 'Employer costs above base wage, such as payroll taxes and other employment burden. Stored as a fraction.',
  fieldOverhead: 'Costs required to keep trucks, tools, and equipment available even when they cannot be tied to one invoice.',
  ga: 'General and administrative costs needed to run the company: office or shop, software, accounting, legal, phone, and administration.',
  ownerManagement: 'Compensation for running the company. Profit in this model is measured after this cost. It is not profit.',
  ownerField: OWNER_FIELD_RESERVE_LABEL,
  growthReserve: 'Money illustrated as retained for equipment, capacity, and expansion instead of being treated as spendable profit.',
  badDebt: 'Protection for invoices that may not be collected and for callback or warranty drag.',
  contingency: 'Room for costs the illustration has not identified, so those surprises do not silently consume the profit target.',
  workingCapital: 'Cash needed to keep paying costs while customers have not yet paid. This is separate from the bad-debt reserve.',
  dso: 'Days sales outstanding: days between invoicing and collecting cash.',
  productionUnit: 'A revenue-producing service lane. It is not the same thing as one truck or one employee.',
  utilization: 'The portion of available production capacity the illustration expects to sell after downtime and nonbillable work.',
  balancing: 'Stage 0 office/admin miscellaneous is a balancing planning amount in this illustration, not a verified cost.',
  pricing: 'Capacity prices are diagnostics. They are not a customer pricing policy, and a single comparison is not a profit verdict.',
  hvac: 'HVAC is future and licensing-dependent. The model cannot activate HVAC operations.',
});

/**
 * Pure planning calculator. Callers inject a document of inputs.
 * Empty monthly inputs stay null. Divide-by-zero returns null.
 * Invalid retention hurdles produce null revenue, never a phantom zero or negative.
 * No intermediate rounding.
 */
import { div, maxNullable, num, roundUpToIncrement, sumNullable } from './nullMath.js';
import { stageReadiness } from './readiness.js';

export const STAGE_KEYS = Object.freeze(['stage_0', 'stage_1', 'stage_2', 'stage_3']);

export const STAGE_3_CORE_CAVEAT =
  'Derived: v4 Stage 3 minus HVAC technician payroll only. HVAC-related non-labor/indirect costs and the third unit\'s capacity are not separated in the workbook. Informational; not a readiness input.';

export const OWNER_FIELD_RESERVE_LABEL =
  'Owner field reserve / surge — priced as replacement cost; not permanent production labor.';

export const HVAC_REVENUE_MISSING_COPY = 'HVAC revenue: not provided';

export const POOL_GROUPS = Object.freeze({
  direct_production: ['fuel', 'consumables', 'job_rentals'],
  indirect_field: ['vehicle_payments', 'maintenance', 'equipment_financing', 'tooling_ppe', 'replacement_sinking_fund'],
  ga: ['office_shop', 'utilities', 'software', 'accounting_legal', 'office_misc'],
  sales: ['marketing', 'memberships', 'collateral'],
  insurance: ['gl_package', 'commercial_auto', 'umbrella', 'workers_comp_fixed', 'licensing'],
});

const HURDLE_KEYS = [
  'true_operating_profit_pct',
  'growth_reserve_pct',
  'bad_debt_warranty_pct',
  'unidentified_cost_contingency_pct',
];

export function retentionHurdle(stage) {
  const errors = [];
  const values = [];
  for (const key of HURDLE_KEYS) {
    const value = num(stage?.[key]);
    if (value === null) {
      errors.push(`${key}:missing`);
      continue;
    }
    if (!(value >= 0 && value < 1)) errors.push(`${key}:invalid`);
    else values.push(value);
  }
  if (errors.length) return { value: null, valid: false, errors };
  const total = values.reduce((sum, value) => sum + value, 0);
  if (!(total >= 0 && total < 1)) {
    return { value: null, valid: false, errors: ['retention_hurdle:invalid'] };
  }
  return { value: total, valid: true, errors: [] };
}

export function monthlyPayroll(parts) {
  const headcount = num(parts.headcount);
  const hourlyWage = num(parts.hourlyWage);
  const weeklyHours = num(parts.weeklyHours);
  const burdenPct = num(parts.burdenPct);
  const weeksPerYear = num(parts.weeksPerYear);
  const monthsPerYear = num(parts.monthsPerYear);
  if ([headcount, hourlyWage, weeklyHours, burdenPct, weeksPerYear, monthsPerYear].some((v) => v === null)) {
    return null;
  }
  if (headcount < 0 || hourlyWage < 0 || weeklyHours < 0 || burdenPct < 0 || weeksPerYear < 0 || monthsPerYear <= 0) {
    return null;
  }
  return headcount * hourlyWage * weeklyHours * weeksPerYear / monthsPerYear * (1 + burdenPct);
}

export function ownerFieldReplacement(shadowHours, wage, burdenPct) {
  const hours = num(shadowHours);
  const hourly = num(wage);
  const burden = num(burdenPct);
  if (hours === null || hourly === null || burden === null) return null;
  if (hours < 0 || hourly < 0 || burden < 0) return null;
  return hours * hourly * (1 + burden);
}

function burdenedHourly(role) {
  const wage = num(role?.wage);
  const burden = num(role?.burden);
  if (wage === null || burden === null) return null;
  if (wage < 0 || burden < 0) return null;
  return wage * (1 + burden);
}

function poolTotal(pools, groupKey, stageKey) {
  const lines = POOL_GROUPS[groupKey];
  const group = pools?.[groupKey] || {};
  return sumNullable(lines.map((line) => num(group?.[line]?.[stageKey])));
}

function findRole(staffing, key) {
  return (staffing || []).find((role) => role.key === key) || null;
}

function rolePayroll(role, stageKey, structural, headcountOverride) {
  const headcount = headcountOverride === undefined ? role?.headcount?.[stageKey] : headcountOverride;
  return monthlyPayroll({
    headcount,
    hourlyWage: role?.wage,
    weeklyHours: role?.weekly_hours,
    burdenPct: role?.burden,
    weeksPerYear: structural.weeks_per_year,
    monthsPerYear: structural.months_per_year,
  });
}

export function weightedDso(channels) {
  if (!Array.isArray(channels) || channels.length === 0) {
    return { value: null, shareTotal: null };
  }
  const shares = [];
  const weighted = [];
  for (const channel of channels) {
    const share = num(channel?.share);
    const dso = num(channel?.dso_days);
    if (share === null || dso === null || share < 0 || dso < 0) {
      return { value: null, shareTotal: null };
    }
    shares.push(share);
    weighted.push(share * dso);
  }
  return { value: sumNullable(weighted), shareTotal: sumNullable(shares) };
}

function capacityMetrics(stage, requiredMonthlyRevenue) {
  const units = num(stage?.revenue_producing_units);
  const days = num(stage?.working_days_per_month);
  const utilization = num(stage?.utilization);
  const hoursPerDay = num(stage?.productive_hours_per_realized_day);
  if ([units, days, utilization, hoursPerDay].some((v) => v === null)) {
    return {
      availableUnitDays: null,
      realizedProductionDays: null,
      productiveUnitHours: null,
      revenuePerAvailableUnitDay: null,
      revenuePerRealizedDay: null,
      revenuePerProductiveUnitHour: null,
    };
  }
  if (units < 0 || days < 0 || hoursPerDay < 0 || utilization < 0 || utilization > 1) {
    return {
      availableUnitDays: null,
      realizedProductionDays: null,
      productiveUnitHours: null,
      revenuePerAvailableUnitDay: null,
      revenuePerRealizedDay: null,
      revenuePerProductiveUnitHour: null,
    };
  }
  const availableUnitDays = units * days;
  const realizedProductionDays = availableUnitDays * utilization;
  const productiveUnitHours = realizedProductionDays * hoursPerDay;
  return {
    availableUnitDays,
    realizedProductionDays,
    revenuePerAvailableUnitDay: div(requiredMonthlyRevenue, availableUnitDays),
    revenuePerRealizedDay: div(requiredMonthlyRevenue, realizedProductionDays),
    productiveUnitHours,
    revenuePerProductiveUnitHour: div(requiredMonthlyRevenue, productiveUnitHours),
  };
}

function computeStageEconomics(inputs, stageKey, options = {}) {
  const stage = inputs.stages?.[stageKey] || {};
  const structural = inputs.structural || {};
  const staffing = inputs.staffing || [];
  const errors = [];

  const fieldPay = [];
  const supportPay = [];
  let fieldHeadcount = 0;
  let fieldHeadcountKnown = true;
  let hvacPayroll = null;

  for (const role of staffing) {
    const payroll = rolePayroll(role, stageKey, structural);
    if (role.hvac_specific) hvacPayroll = payroll;
    if (role.classification === 'direct_field') {
      fieldPay.push(payroll);
      const hc = num(role.headcount?.[stageKey]);
      if (hc === null || hc < 0) fieldHeadcountKnown = false;
      else fieldHeadcount += hc;
    } else if (role.classification === 'indirect_support') {
      supportPay.push(payroll);
    }
  }

  const hiredFieldPayroll = sumNullable(fieldPay);
  const supportPayroll = sumNullable(supportPay);
  const directProductionNonLabor = poolTotal(inputs.cost_pools, 'direct_production', stageKey);
  const indirectField = poolTotal(inputs.cost_pools, 'indirect_field', stageKey);
  const ga = poolTotal(inputs.cost_pools, 'ga', stageKey);
  const sales = poolTotal(inputs.cost_pools, 'sales', stageKey);
  const insurance = poolTotal(inputs.cost_pools, 'insurance', stageKey);
  const indirectNonLabor = sumNullable([indirectField, ga, sales, insurance]);
  const ownerManagementComp = num(stage.owner_management_comp);
  if (ownerManagementComp !== null && ownerManagementComp < 0) errors.push(`${stageKey}:owner_management_comp:invalid`);

  const cashOperatingCost = sumNullable([
    hiredFieldPayroll,
    directProductionNonLabor,
    indirectNonLabor,
    supportPayroll,
    ownerManagementComp !== null && ownerManagementComp < 0 ? null : ownerManagementComp,
  ]);

  const replacement = ownerFieldReplacement(
    stage.owner_shadow_hours,
    inputs.owner_field_replacement?.wage,
    inputs.owner_field_replacement?.burden,
  );
  const economicOperatingCost = sumNullable([cashOperatingCost, replacement]);
  const hurdle = retentionHurdle(stage);
  errors.push(...hurdle.errors.map((error) => `${stageKey}:${error}`));

  let requiredMonthlyRevenue = null;
  if (hurdle.valid && economicOperatingCost !== null) {
    if (economicOperatingCost < 0) {
      errors.push(`${stageKey}:negative_economic_cost`);
    } else {
      requiredMonthlyRevenue = div(economicOperatingCost, 1 - hurdle.value);
      if (requiredMonthlyRevenue !== null && requiredMonthlyRevenue < 0) {
        requiredMonthlyRevenue = null;
        errors.push(`${stageKey}:negative_revenue`);
      }
    }
  }

  const capacity = options.suppressCapacity
    ? {
        availableUnitDays: null,
        realizedProductionDays: null,
        productiveUnitHours: null,
        revenuePerAvailableUnitDay: null,
        revenuePerRealizedDay: null,
        revenuePerProductiveUnitHour: null,
      }
    : capacityMetrics(stage, requiredMonthlyRevenue);

  const dso = weightedDso(inputs.channels);
  const safetyMonths = num(stage.safety_months);
  const estimatedAr = div(
    requiredMonthlyRevenue === null || dso.value === null ? null : requiredMonthlyRevenue * dso.value,
    num(structural.days_per_month_ar),
  );
  const operatingCashFloat = div(
    cashOperatingCost === null || dso.value === null ? null : cashOperatingCost * dso.value,
    num(structural.days_per_month_ar),
  );
  const safetyReserve = cashOperatingCost === null || safetyMonths === null || safetyMonths < 0
    ? null
    : cashOperatingCost * safetyMonths;
  const liquidityPlanningTarget = maxNullable(operatingCashFloat, safetyReserve);

  const scenario = stage.scenario || {};
  const cashCoverageMonths = div(num(scenario.cash_reserve), cashOperatingCost);
  const readiness = stageReadiness({
    projectedContribution: num(scenario.projected_contribution),
    cashCoverageMonths,
    safetyMonths,
    projectedBillableUtilization: num(scenario.projected_billable_utilization),
    practicalBillableCapacity: num(scenario.practical_billable_capacity),
    projectedRevenue: num(scenario.projected_revenue),
    modeledLaborAndFixedLoad: num(scenario.modeled_labor_and_fixed_load),
  });

  return {
    key: stageKey,
    label: stage.label || stageKey,
    hiredFieldPayroll,
    supportPayroll,
    directProductionNonLabor,
    indirectField,
    ga,
    sales,
    insurance,
    indirectNonLabor,
    ownerManagementComp: ownerManagementComp !== null && ownerManagementComp < 0 ? null : ownerManagementComp,
    cashOperatingCost,
    ownerFieldReplacement: replacement,
    economicOperatingCost,
    retentionHurdle: hurdle.value,
    retentionHurdleValid: hurdle.valid,
    requiredMonthlyRevenue,
    fieldHeadcount: fieldHeadcountKnown ? fieldHeadcount : null,
    hvacPayroll,
    revenueProducingUnits: options.suppressCapacity ? null : num(stage.revenue_producing_units),
    ...capacity,
    weightedDso: dso.value,
    channelShareTotal: dso.shareTotal,
    safetyMonths,
    estimatedAr,
    operatingCashFloat,
    safetyReserve,
    liquidityPlanningTarget,
    readiness,
    errors,
  };
}

function directLaborForService(service, rates) {
  const model = service?.labor_model;
  if (model === 'route_tech') {
    const clock = num(service.site_clock_hours);
    if (clock === null || rates.route === null || clock < 0) return null;
    return clock * rates.route;
  }
  if (model === 'duct_crew') {
    const clock = num(service.site_clock_hours);
    if (clock === null || rates.ductCrew === null || clock < 0) return null;
    return clock * rates.ductCrew;
  }
  if (model === 'hvac_tech') {
    const clock = num(service.site_clock_hours);
    if (clock === null || rates.hvac === null || clock < 0) return null;
    return clock * rates.hvac;
  }
  if (model === 'package') {
    const ductClock = num(service.duct_clock_hours);
    const ahuClock = num(service.ahu_clock_hours);
    if (ductClock === null || ahuClock === null || rates.ductCrew === null || rates.hvac === null) return null;
    if (ductClock < 0 || ahuClock < 0) return null;
    return ductClock * rates.ductCrew + ahuClock * rates.hvac;
  }
  return null;
}

function serviceHours(service) {
  if (service?.labor_model === 'package') {
    const ductClock = num(service.duct_clock_hours);
    const ahuClock = num(service.ahu_clock_hours);
    return {
      siteClockHours: maxNullable(ductClock, ahuClock),
      productionUnitHours: ductClock === null || ahuClock === null ? null : ductClock + ahuClock,
      travelHours: num(service.travel_hours),
    };
  }
  return {
    siteClockHours: num(service?.site_clock_hours),
    productionUnitHours: num(service?.production_unit_hours),
    travelHours: num(service?.travel_hours),
  };
}

function computeServices(inputs, stage1, stage2) {
  const staffing = inputs.staffing || [];
  const lead = burdenedHourly(findRole(staffing, 'lead'));
  const duct = burdenedHourly(findRole(staffing, 'duct_tech'));
  const helper = burdenedHourly(findRole(staffing, 'helper'));
  const route = burdenedHourly(findRole(staffing, 'route_tech'));
  const hvac = burdenedHourly(findRole(staffing, 'hvac_tech'));
  const ductCrew = sumNullable([lead, duct, helper]);
  const rates = { route, ductCrew, hvac };
  const indirectPerHour = div(
    sumNullable([stage2.indirectNonLabor, stage2.supportPayroll, stage2.ownerManagementComp]),
    stage2.productiveUnitHours,
  );
  const services = {};
  for (const [key, service] of Object.entries(inputs.services || {})) {
    const hours = serviceHours(service);
    const directLabor = directLaborForService(service, rates);
    const materials = num(service.material_cost);
    const dispatch = num(service.dispatch_dollars);
    const directJobCost = sumNullable([directLabor, materials, dispatch]);
    const indirectAllocation = hours.productionUnitHours === null || indirectPerHour === null
      ? null
      : hours.productionUnitHours * indirectPerHour;
    const fullySupported = sumNullable([directJobCost, indirectAllocation]);
    const stage1Capacity = hours.productionUnitHours === null || stage1.revenuePerProductiveUnitHour === null
      ? null
      : hours.productionUnitHours * stage1.revenuePerProductiveUnitHour;
    const stage2Capacity = hours.productionUnitHours === null || stage2.revenuePerProductiveUnitHour === null
      ? null
      : hours.productionUnitHours * stage2.revenuePerProductiveUnitHour;
    const plannedPrice = num(service.planned_price);
    const priceVariance = plannedPrice === null || stage2Capacity === null ? null : plannedPrice - stage2Capacity;
    services[key] = {
      key,
      label: service.label || key,
      laborModel: service.labor_model,
      plannedPrice,
      materialCost: materials,
      dispatchDollars: dispatch,
      travelHours: hours.travelHours,
      siteClockHours: hours.siteClockHours,
      productionUnitHours: hours.productionUnitHours,
      directLabor,
      directJobCost,
      indirectAllocation,
      fullySupportedCost: fullySupported,
      stage1CapacityPrice: stage1Capacity,
      stage2CapacityPrice: stage2Capacity,
      priceVarianceVsStage2: priceVariance,
    };
  }
  return { services, stage2IndirectPerProductiveUnitHour: indirectPerHour };
}

function computeRoutes(inputs, stage1, stage2, services) {
  const stops = inputs.route?.stop_counts;
  const ticket = num(inputs.route?.average_ticket);
  const rows = [];
  if (!Array.isArray(stops)) return rows;
  for (const stopCount of stops) {
    const stopsNum = num(stopCount);
    const daily = stopsNum === null || ticket === null ? null : stopsNum * ticket;
    rows.push({
      stops: stopsNum,
      dailyRevenue: daily,
      stage1Gap: daily === null ? null : (stage1.revenuePerAvailableUnitDay === null ? null : daily - stage1.revenuePerAvailableUnitDay),
      stage2Gap: daily === null ? null : (stage2.revenuePerAvailableUnitDay === null ? null : daily - stage2.revenuePerAvailableUnitDay),
      requiredAverageTicketStage1: div(stage1.revenuePerAvailableUnitDay, stopsNum),
      requiredAverageTicketStage2: div(stage2.revenuePerAvailableUnitDay, stopsNum),
    });
  }
  const target = services.duct_12_drop_floor || null;
  const stress = services.duct_12_drop_stress || null;
  const dropsTarget = num(inputs.services?.duct_12_drop_floor?.drops);
  const dropsStress = num(inputs.services?.duct_12_drop_stress?.drops);
  const increment = num(inputs.structural?.rounding_increment_usd);
  const stressPerDrop = div(stress?.stage2CapacityPrice, dropsStress);
  return {
    rows,
    stage2RequiredDuctPerDropTarget: div(target?.stage2CapacityPrice, dropsTarget),
    stage2RequiredDuctPerDropStress: stressPerDrop,
    suggestedStressBookPricePerDrop: roundUpToIncrement(stressPerDrop, increment),
    stage1RequiredAvgDryerTicket: rows.find((row) => row.stops === num(inputs.route?.dense_stops))?.requiredAverageTicketStage1 ?? null,
    stage2RequiredAvgDryerTicket: rows.find((row) => row.stops === num(inputs.route?.dense_stops))?.requiredAverageTicketStage2 ?? null,
  };
}

function coreFromPlus(plus, hvacPayroll) {
  if (hvacPayroll === null || plus.cashOperatingCost === null || plus.economicOperatingCost === null) {
    return {
      ...plus,
      key: 'stage_3_core',
      label: 'Stage 3 Core',
      cashOperatingCost: null,
      economicOperatingCost: null,
      requiredMonthlyRevenue: null,
      derived: true,
      perUnitIncomplete: true,
      availableUnitDays: null,
      realizedProductionDays: null,
      productiveUnitHours: null,
      revenuePerAvailableUnitDay: null,
      revenuePerRealizedDay: null,
      revenuePerProductiveUnitHour: null,
      revenueProducingUnits: null,
      estimatedAr: null,
      operatingCashFloat: null,
      safetyReserve: null,
      liquidityPlanningTarget: null,
      readiness: 'Incomplete / Needs review',
    };
  }
  const cash = plus.cashOperatingCost - hvacPayroll;
  const economic = plus.economicOperatingCost - hvacPayroll;
  const hurdle = plus.retentionHurdle;
  const required = plus.retentionHurdleValid && economic !== null && economic >= 0 && hurdle !== null
    ? div(economic, 1 - hurdle)
    : null;
  const safetyMonths = plus.safetyMonths;
  const dso = plus.weightedDso;
  const days = null;
  const estimatedAr = null;
  const operatingCashFloat = div(cash === null || dso === null ? null : cash * dso, days);
  const safetyReserve = cash === null || safetyMonths === null ? null : cash * safetyMonths;
  return {
    ...plus,
    key: 'stage_3_core',
    label: 'Stage 3 Core',
    hiredFieldPayroll: plus.hiredFieldPayroll === null ? null : plus.hiredFieldPayroll - hvacPayroll,
    cashOperatingCost: cash,
    economicOperatingCost: economic,
    requiredMonthlyRevenue: required,
    hvacPayrollRemoved: hvacPayroll,
    derived: true,
    perUnitIncomplete: true,
    revenueProducingUnits: null,
    availableUnitDays: null,
    realizedProductionDays: null,
    productiveUnitHours: null,
    revenuePerAvailableUnitDay: null,
    revenuePerRealizedDay: null,
    revenuePerProductiveUnitHour: null,
    fieldHeadcount: null,
    estimatedAr,
    operatingCashFloat,
    safetyReserve,
    liquidityPlanningTarget: maxNullable(operatingCashFloat, safetyReserve),
    readiness: 'Incomplete / Needs review',
  };
}

export function calculatePlan(inputs) {
  if (!inputs || typeof inputs !== 'object') {
    return { ok: false, errors: ['inputs:missing'], stages: {}, services: {} };
  }
  const stages = {};
  const errors = [];
  for (const key of STAGE_KEYS) {
    const stage = computeStageEconomics(inputs, key);
    stages[key] = stage;
    errors.push(...stage.errors);
  }
  const hvacPayroll = stages.stage_3.hvacPayroll;
  const core = coreFromPlus(stages.stage_3, hvacPayroll);
  // Core liquidity uses the same day-count constant as the other stages.
  const daysAr = num(inputs.structural?.days_per_month_ar);
  core.operatingCashFloat = div(
    core.cashOperatingCost === null || core.weightedDso === null || daysAr === null
      ? null
      : core.cashOperatingCost * core.weightedDso,
    daysAr,
  );
  core.estimatedAr = div(
    core.requiredMonthlyRevenue === null || core.weightedDso === null || daysAr === null
      ? null
      : core.requiredMonthlyRevenue * core.weightedDso,
    daysAr,
  );
  core.liquidityPlanningTarget = maxNullable(core.operatingCashFloat, core.safetyReserve);
  stages.stage_3_core = core;
  stages.stage_3_plus_hvac = {
    ...stages.stage_3,
    key: 'stage_3_plus_hvac',
    label: 'Stage 3 + HVAC',
  };

  const { services, stage2IndirectPerProductiveUnitHour } = computeServices(inputs, stages.stage_1, stages.stage_2);
  const routes = computeRoutes(inputs, stages.stage_1, stages.stage_2, services);
  const shareTotal = stages.stage_0.channelShareTotal;
  const channelShareWarning = shareTotal === null
    ? null
    : Math.abs(shareTotal - 1) > 0.000000001;

  return {
    ok: errors.length === 0,
    errors,
    stages,
    services,
    routes,
    stage2IndirectPerProductiveUnitHour,
    channelShareTotal: shareTotal,
    channelShareWarning,
    hvacDeliveryAuthorized: inputs.hvac_delivery_authorized === true,
    hvacRevenue: num(inputs.hvac_revenue),
  };
}

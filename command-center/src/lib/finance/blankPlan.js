/**
 * Neutral plan inputs. Every amount, hour, count, and fraction is null.
 * Structural keys match the calculator. This is not the synthetic fixture.
 */
import { POOL_GROUPS, STAGE_KEYS } from './calculate.js';

export const FINANCE_PLAN_SCHEMA_VERSION = 1;
export const FINANCE_NOTES_MAX = 2000;

const STAGE_NUMBER_FIELDS = [
  'revenue_producing_units',
  'working_days_per_month',
  'utilization',
  'productive_hours_per_realized_day',
  'safety_months',
  'owner_management_comp',
  'owner_shadow_hours',
  'true_operating_profit_pct',
  'growth_reserve_pct',
  'bad_debt_warranty_pct',
  'unidentified_cost_contingency_pct',
];

const SCENARIO_FIELDS = [
  'practical_billable_capacity',
  'projected_billable_utilization',
  'projected_contribution',
  'cash_reserve',
  'projected_revenue',
  'modeled_labor_and_fixed_load',
];

const STAFF_ROLES = [
  ['lead', 'direct_field'],
  ['duct_tech', 'direct_field'],
  ['helper', 'direct_field'],
  ['route_tech', 'direct_field'],
  ['hvac_tech', 'direct_field'],
  ['admin', 'indirect_support'],
];

const CHANNEL_KEYS = ['direct', 'commercial', 'portal'];

const SERVICES = [
  ['residential_dryer_vent', 'route_tech'],
  ['duct_12_drop_floor', 'duct_crew'],
  ['duct_12_drop_book', 'duct_crew'],
  ['duct_12_drop_stress', 'duct_crew'],
  ['ahu_future', 'hvac_tech'],
  ['duct_plus_ahu_package', 'package'],
];

function nullStageMap() {
  return {
    stage_0: null,
    stage_1: null,
    stage_2: null,
    stage_3: null,
  };
}

function blankStage(key) {
  const stage = {
    label: `Stage ${key.slice(-1)}`,
    operating_model: '',
  };
  if (key === 'stage_2') stage.production_units_definition = '';
  for (const field of STAGE_NUMBER_FIELDS) stage[field] = null;
  stage.scenario = {};
  for (const field of SCENARIO_FIELDS) stage.scenario[field] = null;
  return stage;
}

function blankService(key, laborModel) {
  const service = {
    label: key,
    labor_model: laborModel,
    planned_price: null,
    material_cost: null,
    dispatch_dollars: null,
    travel_hours: null,
  };
  if (laborModel === 'package') {
    service.duct_clock_hours = null;
    service.ahu_clock_hours = null;
    service.dispatch_note = '';
  } else {
    service.site_clock_hours = null;
    service.production_unit_hours = null;
  }
  if (laborModel === 'duct_crew') {
    service.drops = null;
    service.price_per_drop = null;
  }
  return service;
}

export function blankPlanInputs() {
  const stages = {};
  for (const key of STAGE_KEYS) stages[key] = blankStage(key);
  const costPools = {};
  for (const [group, lines] of Object.entries(POOL_GROUPS)) {
    costPools[group] = {};
    for (const line of lines) costPools[group][line] = nullStageMap();
  }
  const services = {};
  for (const [key, laborModel] of SERVICES) services[key] = blankService(key, laborModel);
  return {
    structural: {
      weeks_per_year: null,
      months_per_year: null,
      days_per_month_ar: null,
      rounding_increment_usd: null,
    },
    hvac_delivery_authorized: false,
    hvac_revenue: null,
    stage_3_core_capacity: {
      revenue_producing_units: null,
      utilization: null,
      productive_hours_per_realized_day: null,
      hvac_share_of_direct_nonlabor_and_indirect_costs: null,
    },
    authoritative_actuals_source: null,
    stages,
    staffing: STAFF_ROLES.map(([key, classification]) => ({
      key,
      label: key,
      classification,
      wage: null,
      burden: null,
      weekly_hours: null,
      headcount: nullStageMap(),
    })),
    owner_field_replacement: { wage: null, burden: null },
    cost_pools: costPools,
    channels: CHANNEL_KEYS.map((key) => ({
      key,
      label: key,
      share: null,
      dso_days: null,
      acquisition_pct: null,
      vent_price: null,
    })),
    route: {
      average_ticket: null,
      dense_stops: null,
      stop_counts: [],
    },
    production_copy: {
      route_crew: '',
      duct_technical_minimum_crew: '',
      duct_preferred_crew: '',
      floor_per_drop: '',
      book_per_drop: '',
      typical_drops: '',
    },
    services,
  };
}

function fail() {
  const error = new Error('invalid_inputs');
  error.code = 'invalid_inputs';
  throw error;
}

function isBlankNumber(value, integer) {
  if (value === null) return true;
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) return false;
  if (integer && !Number.isInteger(value)) return false;
  return true;
}

function assertShape(template, value, path) {
  if (path === 'inputs.route.stop_counts' || path.endsWith('.stop_counts')) {
    if (!Array.isArray(value)) fail();
    for (const item of value) {
      if (!isBlankNumber(item, true)) fail();
    }
    return;
  }
  if (typeof template === 'string') {
    if (typeof value !== 'string' || value.length > 500) fail();
    return;
  }
  if (typeof template === 'boolean') {
    if (typeof value !== 'boolean') fail();
    return;
  }
  if (template === null) {
    const integer = path.includes('.headcount.') || path.endsWith('.drops') || path.endsWith('.dense_stops');
    if (!isBlankNumber(value, integer)) fail();
    return;
  }
  if (Array.isArray(template)) {
    if (!Array.isArray(value) || value.length !== template.length) fail();
    for (let index = 0; index < template.length; index += 1) {
      if (value[index]?.key !== template[index].key) fail();
      assertShape(template[index], value[index], `${path}[]`);
    }
    return;
  }
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail();
  const templateKeys = Object.keys(template);
  const valueKeys = Object.keys(value);
  if (templateKeys.length !== valueKeys.length) fail();
  for (const key of templateKeys) {
    if (!Object.prototype.hasOwnProperty.call(value, key)) fail();
    assertShape(template[key], value[key], `${path}.${key}`);
  }
}

export function validatePlanInputs(inputs) {
  try {
    assertShape(blankPlanInputs(), inputs, 'inputs');
    return { ok: true, inputs };
  } catch {
    return { ok: false, code: 'invalid_inputs' };
  }
}

export function validateNotes(notes) {
  if (notes === null || notes === undefined || notes === '') return { ok: true, notes: notes ? notes : null };
  if (typeof notes !== 'string' || notes.length > FINANCE_NOTES_MAX) return { ok: false, code: 'invalid_notes' };
  return { ok: true, notes };
}

/**
 * Approvability contract for TVG Finance. Command Center glkry-9.
 * The UI blocks approval on these business-rule errors. The server
 * function finance_plan_approvable enforces the same rules.
 * Unsaved edits, read-only mode, and version conflicts are not in this list.
 *
 * Rates (hurdles, burden) normalize to 4 decimal places.
 * Money normalizes to cents (2 decimal places).
 * Rounding is half away from zero. A hurdle total of exactly 1 is valid.
 * 0.7+0.2+0.1+0 normalizes to 1. There is no extra epsilon.
 */
/* global BigInt */

export const STAGE_KEYS = Object.freeze(['stage_0', 'stage_1', 'stage_2', 'stage_3']);

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

const RATE_SCALE = 4;
const MONEY_SCALE = 2;
const RATE_ONE = 10n ** BigInt(RATE_SCALE);

export const APPROVE_BLOCKED_COPY = 'Approve is blocked until the validation message is clear.';

function parseDecimal(value) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  if (Object.is(value, -0)) return { n: 0n, d: 1n };
  return parseDecimalText(JSON.stringify(value));
}

function parseDecimalText(text) {
  if (/[eE]/.test(text)) {
    const scientific = /^(-?)(\d+)(?:\.(\d+))?[eE]([+-]?\d+)$/.exec(text);
    if (!scientific) return null;
    const sign = scientific[1] === '-' ? -1n : 1n;
    const digits = `${scientific[2]}${scientific[3] || ''}`;
    const scale = (scientific[3] || '').length - Number(scientific[4]);
    const n = sign * BigInt(digits);
    if (scale >= 0) return { n, d: 10n ** BigInt(scale) };
    return { n: n * (10n ** BigInt(-scale)), d: 1n };
  }
  const plain = /^(-?)(\d+)(?:\.(\d+))?$/.exec(text);
  if (!plain) return null;
  const fraction = plain[3] || '';
  const sign = plain[1] === '-' ? -1n : 1n;
  return { n: sign * BigInt(`${plain[2]}${fraction}`), d: 10n ** BigInt(fraction.length || 0) };
}

function isNegative(part) {
  if (!part || part.d === 0n) return false;
  return (part.n < 0n) !== (part.d < 0n) && part.n !== 0n;
}

function roundUnits(part, scale) {
  if (!part || part.d === 0n) return null;
  let n = part.n;
  let d = part.d;
  if (d < 0n) {
    n = -n;
    d = -d;
  }
  const num = n * (10n ** BigInt(scale));
  const neg = num < 0n;
  const abs = neg ? -num : num;
  const q = abs / d;
  const rem = abs % d;
  const rounded = rem * 2n >= d ? q + 1n : q;
  return neg ? -rounded : rounded;
}

function scaledNumber(units, scale) {
  const negative = units < 0n;
  const abs = (negative ? -units : units).toString().padStart(scale + 1, '0');
  const whole = abs.slice(0, abs.length - scale);
  const fraction = abs.slice(abs.length - scale).replace(/0+$/, '');
  const text = fraction ? `${whole}.${fraction}` : whole;
  return Number(negative ? `-${text}` : text);
}

function jsonNumber(value) {
  if (value === null || value === undefined) return null;
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  return parseDecimal(value);
}

function payrollCents(role, stageKey, structural) {
  const headcount = jsonNumber(role?.headcount?.[stageKey]);
  const wage = jsonNumber(role?.wage);
  const hours = jsonNumber(role?.weekly_hours);
  const burden = jsonNumber(role?.burden);
  const weeks = jsonNumber(structural?.weeks_per_year);
  const months = jsonNumber(structural?.months_per_year);
  const parts = [headcount, wage, hours, burden, weeks, months];
  if (parts.some((part) => !part)) return null;
  if (parts.some((part) => isNegative(part))) return null;
  if (months.n <= 0n) return null;
  const burdened = { n: burden.n + burden.d, d: burden.d };
  let n = headcount.n * wage.n * hours.n * weeks.n * burdened.n * months.d;
  let d = headcount.d * wage.d * hours.d * weeks.d * burdened.d * months.n;
  return roundUnits({ n, d }, MONEY_SCALE);
}

function roleGroupCents(staffing, classification, stageKey, structural) {
  const list = staffing == null ? [] : staffing;
  const roles = Array.isArray(list) ? list.filter((role) => role?.classification === classification) : null;
  if (!roles) return null;
  let total = 0n;
  for (const role of roles) {
    const pay = payrollCents(role, stageKey, structural);
    if (pay === null) return null;
    total += pay;
  }
  return total;
}

function poolCents(pools, groupKey, lines, stageKey) {
  const group = pools?.[groupKey];
  let total = 0n;
  for (const line of lines) {
    const part = jsonNumber(group?.[line]?.[stageKey]);
    if (!part) return null;
    const cents = roundUnits(part, MONEY_SCALE);
    if (cents === null) return null;
    total += cents;
  }
  return total;
}

function replacementCents(stage, owner) {
  const hours = jsonNumber(stage?.owner_shadow_hours);
  const wage = jsonNumber(owner?.wage);
  const burden = jsonNumber(owner?.burden);
  if (!hours || !wage || !burden) return null;
  if (isNegative(hours) || isNegative(wage) || isNegative(burden)) return null;
  const burdened = { n: burden.n + burden.d, d: burden.d };
  return roundUnits({
    n: hours.n * wage.n * burdened.n,
    d: hours.d * wage.d * burdened.d,
  }, MONEY_SCALE);
}

export function retentionHurdle(stage) {
  const errors = [];
  const values = [];
  for (const key of HURDLE_KEYS) {
    const part = jsonNumber(stage?.[key]);
    if (!part) {
      errors.push(`${key}:missing`);
      continue;
    }
    const units = roundUnits(part, RATE_SCALE);
    if (units === null || units < 0n || units >= RATE_ONE) errors.push(`${key}:invalid`);
    else values.push(units);
  }
  if (errors.length) return { value: null, valid: false, errors };
  const total = values.reduce((sum, units) => sum + units, 0n);
  if (total > RATE_ONE) {
    return { value: null, valid: false, errors: ['retention_hurdle:invalid'] };
  }
  return { value: scaledNumber(total, RATE_SCALE), valid: true, errors: [] };
}

/**
 * True only when the normalized hurdle total is greater than 1.
 * A total of exactly 1, including 0.7+0.2+0.1+0, is false.
 */
export function hurdleSumExceedsOne(values) {
  let total = 0n;
  for (const value of values) {
    const part = jsonNumber(value);
    if (!part) return true;
    const units = roundUnits(part, RATE_SCALE);
    if (units === null) return true;
    total += units;
  }
  return total > RATE_ONE;
}

export function stageApprovabilityErrors(inputs, stageKey) {
  const stage = inputs?.stages?.[stageKey];
  const errors = [];
  const hurdle = retentionHurdle(stage);
  errors.push(...hurdle.errors.map((error) => `${stageKey}:${error}`));

  const ownerPart = jsonNumber(stage?.owner_management_comp);
  const ownerNegative = ownerPart ? roundUnits(ownerPart, MONEY_SCALE) < 0n : false;
  if (ownerNegative) errors.push(`${stageKey}:owner_management_comp:invalid`);
  if (!hurdle.valid) return errors;

  const hired = roleGroupCents(inputs?.staffing, 'direct_field', stageKey, inputs?.structural);
  const support = roleGroupCents(inputs?.staffing, 'indirect_support', stageKey, inputs?.structural);
  const direct = poolCents(inputs?.cost_pools, 'direct_production', POOL_GROUPS.direct_production, stageKey);
  const indirectParts = ['indirect_field', 'ga', 'sales', 'insurance'].map((key) => (
    poolCents(inputs?.cost_pools, key, POOL_GROUPS[key], stageKey)
  ));
  const indirect = indirectParts.some((part) => part === null) ? null : indirectParts.reduce((sum, part) => sum + part, 0n);
  const ownerCents = ownerPart && !ownerNegative ? roundUnits(ownerPart, MONEY_SCALE) : null;
  const cash = [hired, direct, indirect, support, ownerCents].some((part) => part === null)
    ? null
    : hired + direct + indirect + support + ownerCents;
  const replacement = replacementCents(stage, inputs?.owner_field_replacement);
  const economic = cash === null || replacement === null ? null : cash + replacement;
  if (economic !== null && economic < 0n) {
    errors.push(`${stageKey}:negative_economic_cost`);
    return errors;
  }
  if (economic !== null && economic >= 0n && hurdle.value !== null && hurdle.value < 1) {
    const hurdleUnits = roundUnits(parseDecimal(hurdle.value), RATE_SCALE);
    const revenue = roundUnits({ n: economic * RATE_ONE, d: RATE_ONE - hurdleUnits }, 0);
    if (revenue !== null && revenue < 0n) errors.push(`${stageKey}:negative_revenue`);
  }
  return errors;
}

export function planApprovabilityErrors(inputs) {
  if (!inputs || typeof inputs !== 'object' || Array.isArray(inputs)) return ['inputs:missing'];
  return STAGE_KEYS.flatMap((stageKey) => stageApprovabilityErrors(inputs, stageKey));
}

export function approvabilityCopy(errors) {
  const sentences = [];
  const add = (text) => {
    if (!sentences.includes(text)) sentences.push(text);
  };
  for (const error of Array.isArray(errors) ? errors : []) {
    if (typeof error !== 'string') continue;
    if (error.endsWith(':missing')) add('Enter every retention hurdle on all four stages before approving.');
    else if (error.includes('retention_hurdle') || (error.endsWith(':invalid') && error.includes('_pct:'))) {
      add('Each retention hurdle must be at least 0 and less than 1, and the four hurdles on a stage cannot total more than 1.');
    } else if (error.includes('owner_management_comp')) add('Management compensation cannot be negative.');
    else if (error.includes('negative_economic_cost')) add('Economic operating cost cannot be negative. Check the cost pools and compensation.');
    else if (error.includes('negative_revenue')) add('Required revenue cannot be negative.');
  }
  if (!sentences.length) return APPROVE_BLOCKED_COPY;
  return sentences.join(' ');
}

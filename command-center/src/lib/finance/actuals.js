/**
 * Monthly actual facts for check-in.
 * Blank stays null. Zero stays zero. Stage revenue is not a monthly plan basis.
 */
import { div } from './nullMath.js';

export const ACTUAL_MONEY_KEYS = Object.freeze([
  'total_revenue',
  'direct_residential_revenue',
  'commercial_direct_revenue',
  'portal_revenue',
  'field_payroll',
  'indirect_cash_costs',
  'ar_ending',
  'cash_reserve',
]);

export const ACTUAL_COUNT_KEYS = Object.freeze([
  'total_jobs',
  'dryer_vent_jobs',
  'duct_jobs',
  'ahu_jobs',
]);

export const ACTUAL_HOUR_KEYS = Object.freeze(['productive_unit_hours']);

export const ACTUAL_TEXT_KEYS = Object.freeze(['notes', 'source_note']);

export const CHECKIN_FIELDS = Object.freeze([
  {
    key: 'total_revenue',
    guided: 'Money earned for work completed this month',
    technical: 'Total Revenue',
    kind: 'money',
  },
  {
    key: 'direct_residential_revenue',
    guided: 'Direct residential work completed this month',
    technical: 'Direct Residential',
    kind: 'money',
  },
  {
    key: 'commercial_direct_revenue',
    guided: 'Commercial direct work completed this month',
    technical: 'Commercial Direct',
    kind: 'money',
  },
  {
    key: 'portal_revenue',
    guided: 'Portal work completed this month',
    technical: 'Portal',
    kind: 'money',
  },
  {
    key: 'total_jobs',
    guided: 'Jobs completed',
    technical: 'Total jobs',
    kind: 'count',
  },
  {
    key: 'dryer_vent_jobs',
    guided: 'Dryer vent jobs completed',
    technical: 'Dryer vent jobs',
    kind: 'count',
  },
  {
    key: 'duct_jobs',
    guided: 'Duct jobs completed',
    technical: 'Duct jobs',
    kind: 'count',
  },
  {
    key: 'ahu_jobs',
    guided: 'AHU jobs completed',
    technical: 'AHU jobs',
    kind: 'count',
  },
  {
    key: 'productive_unit_hours',
    guided: 'Hours the production units actually worked',
    technical: 'Productive unit-hours',
    kind: 'hours',
  },
  {
    key: 'field_payroll',
    guided: 'Cash paid to field crews',
    technical: 'Field payroll',
    kind: 'money',
  },
  {
    key: 'indirect_cash_costs',
    guided: 'Other cash costs that are not field payroll',
    technical: 'Indirect cash costs',
    kind: 'money',
  },
  {
    key: 'ar_ending',
    guided: 'Unpaid invoices at month end',
    technical: 'Ending AR',
    kind: 'money',
  },
  {
    key: 'cash_reserve',
    guided: 'Cash on hand at month end',
    technical: 'Cash reserve',
    kind: 'money',
  },
]);

export const REVENUE_DEFINITION = 'Total Revenue is money earned for work completed in this month. It is not the invoices issued this month, the cash collected, or a quoted or scheduled price. Direct Residential, Commercial Direct, and Portal use that same meaning. Unpaid invoices and cash on hand stay separate.';

export const CHANNEL_ISSUE_COPY = Object.freeze({
  channels_require_total: 'Direct Residential, Commercial Direct, and Portal are all filled in, so Total Revenue is required and must equal their sum. A blank channel is not treated as zero.',
  channels_must_equal_total: 'Those three channel amounts must add up exactly to Total Revenue. Nothing is filled in for you.',
  known_channels_exceed_total: 'The channel amounts you entered add up to more than Total Revenue. Leave a channel blank if you do not know it. Do not enter zero unless the amount really is zero.',
});

function toCents(value) {
  return Math.round(value * 100 + 1e-8);
}

export function channelRevenueIssue(facts) {
  const direct = facts?.direct_residential_revenue ?? null;
  const commercial = facts?.commercial_direct_revenue ?? null;
  const portal = facts?.portal_revenue ?? null;
  const total = facts?.total_revenue ?? null;
  const known = [direct, commercial, portal].filter((value) => value !== null && value !== undefined);
  if (direct !== null && direct !== undefined && commercial !== null && commercial !== undefined && portal !== null && portal !== undefined) {
    if (total === null || total === undefined) return 'channels_require_total';
    if (toCents(direct + commercial + portal) !== toCents(total)) return 'channels_must_equal_total';
  }
  if (total !== null && total !== undefined && toCents(known.reduce((sum, value) => sum + value, 0)) > toCents(total)) {
    return 'known_channels_exceed_total';
  }
  return null;
}

/**
 * Schema version 1 stores no monthly check-in series.
 * Stage required revenue and scenario figures are not used.
 * This helper stays null. Version 2 values are read by plannedFactsForMonth.
 */
const MONTH_KEY = /^(\d{4})-(0[1-9]|1[0-2])-01$/;

export function declaredMonthlyBasis(plan) {
  if (!plan || plan.schema_version !== 1) return null;
  return null;
}

export function normalizeActualMonth(value) {
  const text = String(value || '').trim();
  if (MONTH_KEY.test(text.slice(0, 10)) && text.slice(0, 10) === text) return text;
  const match = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(text);
  if (!match) return null;
  return `${match[1]}-${match[2]}-01`;
}

function hasAtMostTwoDecimals(value) {
  const scaled = value * 100;
  return Math.abs(scaled - Math.round(scaled)) < 1e-8;
}

function wholeDigitCount(value) {
  const whole = Math.trunc(Math.abs(value));
  if (whole === 0) return 1;
  // numeric(14,2) rejects 13+ whole digits. At 1e21, String() becomes "1e+21".
  if (whole >= 1e21) return 99;
  return String(whole).length;
}

/**
 * Keep typed money/hour text until it is a complete amount.
 * A trailing decimal point is held so the next digit is not concatenated onto the whole number.
 * A leading decimal point is held, then ".5" commits as 0.5.
 */
export function basisAmountDraft(raw) {
  const text = String(raw ?? '');
  if (text.trim() === '') return { text: '', commit: 'clear', value: null };
  if (/^\d+(\.\d{1,2})?$/.test(text)) return { text, commit: 'set', value: Number(text) };
  if (/^\d*\.$/.test(text)) return { text, commit: 'hold' };
  if (/^\.\d{1,2}$/.test(text)) return { text, commit: 'set', value: Number(`0${text}`) };
  return { commit: 'reject' };
}

export function typeBasisAmount(previousText, nextText) {
  const decision = basisAmountDraft(nextText);
  if (decision.commit === 'reject') return { text: previousText, commit: 'reject' };
  return { text: decision.text, commit: decision.commit, value: decision.value };
}

export function validateMonthlyBasis(basis) {
  if (!basis || typeof basis !== 'object' || Array.isArray(basis)) {
    return { ok: false, code: 'invalid_monthly_basis' };
  }
  const normalized = {};
  for (const [month, row] of Object.entries(basis)) {
    if (!MONTH_KEY.test(month)) return { ok: false, code: 'invalid_monthly_basis' };
    if (!row || typeof row !== 'object' || Array.isArray(row)) return { ok: false, code: 'invalid_monthly_basis' };
    const facts = {};
    for (const [key, value] of Object.entries(row)) {
      const field = CHECKIN_FIELDS.find((item) => item.key === key);
      if (!field) return { ok: false, code: 'invalid_monthly_basis' };
      if (value === null) {
        facts[key] = null;
        continue;
      }
      if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
        return { ok: false, code: 'invalid_monthly_basis' };
      }
      if (field.kind === 'count') {
        if (!Number.isInteger(value) || value > 2147483647) return { ok: false, code: 'invalid_monthly_basis' };
      } else if (!hasAtMostTwoDecimals(value) || wholeDigitCount(value) > (field.kind === 'hours' ? 8 : 12)) {
        return { ok: false, code: 'invalid_monthly_basis' };
      }
      facts[key] = value;
    }
    const issue = channelRevenueIssue({
      total_revenue: facts.total_revenue ?? null,
      direct_residential_revenue: facts.direct_residential_revenue ?? null,
      commercial_direct_revenue: facts.commercial_direct_revenue ?? null,
      portal_revenue: facts.portal_revenue ?? null,
    });
    if (issue) return { ok: false, code: issue };
    normalized[month] = facts;
  }
  return { ok: true, basis: normalized };
}

export function plannedFactsForMonth(plan, month) {
  if (!plan || plan.schema_version !== 2) return null;
  const key = normalizeActualMonth(month);
  const row = key ? plan.inputs?.monthly_basis?.[key] : null;
  const facts = {};
  for (const field of CHECKIN_FIELDS) {
    const value = row?.[field.key];
    facts[field.key] = value === null || value === undefined ? null : value;
  }
  return facts;
}

export function comparisonPlanForCheckin({ selected, plans, approved, associateOnCreate }) {
  if (selected?.comparison_plan_id) {
    return (Array.isArray(plans) ? plans : []).find((plan) => plan.id === selected.comparison_plan_id) || null;
  }
  if (!selected && associateOnCreate && approved?.status === 'approved') return approved;
  return null;
}

export function derivedActualMetrics(facts) {
  const revenue = facts?.total_revenue ?? null;
  const jobs = facts?.total_jobs ?? null;
  const hours = facts?.productive_unit_hours ?? null;
  const portal = facts?.portal_revenue ?? null;
  const direct = facts?.direct_residential_revenue ?? null;
  const commercial = facts?.commercial_direct_revenue ?? null;
  const directSum = direct !== null && direct !== undefined && commercial !== null && commercial !== undefined
    ? direct + commercial
    : null;
  const channelsComplete = [direct, commercial, portal].every(v => v !== null && v !== undefined);
  return {
    average_ticket: div(revenue, jobs),
    revenue_per_productive_hour: div(revenue, hours),
    portal_share: channelsComplete ? div(portal, revenue) : null,
    direct_share: channelsComplete ? div(directSum, revenue) : null,
    jobs_per_productive_hour: div(jobs, hours),
    field_payroll_pct_of_revenue: div(facts?.field_payroll ?? null, revenue),
    indirect_cost_pct_of_revenue: div(facts?.indirect_cash_costs ?? null, revenue),
    ar_over_revenue: div(facts?.ar_ending ?? null, revenue),
    cash_reserve_over_revenue: div(facts?.cash_reserve ?? null, revenue),
  };
}

export function parseActualDecimal(raw, scale, wholeDigits) {
  if (raw === null || raw === undefined) return { ok: true, value: null };
  const text = String(raw).trim();
  if (text === '') return { ok: true, value: null };
  if (!/^\d+(\.\d+)?$/.test(text)) return { ok: false, code: 'invalid_amount' };
  const fraction = text.split('.')[1] || '';
  if (fraction.length > scale) return { ok: false, code: 'invalid_amount' };
  const whole = text.split('.')[0].replace(/^0+/, '');
  if (wholeDigits !== undefined && whole.length > wholeDigits) return { ok: false, code: 'amount_too_large' };
  const value = Number(text);
  if (!Number.isFinite(value)) return { ok: false, code: 'invalid_amount' };
  return { ok: true, value };
}

export function parseActualInteger(raw) {
  if (raw === null || raw === undefined) return { ok: true, value: null };
  const text = String(raw).trim();
  if (text === '') return { ok: true, value: null };
  if (!/^\d+$/.test(text)) return { ok: false, code: 'invalid_amount' };
  const value = Number(text);
  if (!Number.isSafeInteger(value)) return { ok: false, code: 'invalid_amount' };
  if (value > 2147483647) return { ok: false, code: 'count_too_large' };
  return { ok: true, value };
}

export function parseActualMonth(raw) {
  const text = String(raw || '').trim();
  const match = /^(\d{4})-(\d{2})$/.exec(text);
  if (!match) return { ok: false, code: 'invalid_month' };
  const month = Number(match[2]);
  if (month < 1 || month > 12) return { ok: false, code: 'invalid_month' };
  return { ok: true, value: `${match[1]}-${match[2]}-01` };
}

export function formatStoredDecimal(value, scale) {
  if (value === null || value === undefined || value === '') return '';
  const text = String(value).trim();
  if (!/^\d+(\.\d+)?$/.test(text)) return '';
  const [whole, fraction = ''] = text.split('.');
  if (scale === 0) return String(Number(whole));
  return `${whole}.${fraction.padEnd(scale, '0').slice(0, scale)}`;
}

export function actualFactsFromForm(form) {
  const facts = {};
  for (const field of CHECKIN_FIELDS) {
    const parsed = field.kind === 'count'
      ? parseActualInteger(form[field.key])
      : parseActualDecimal(form[field.key], 2, field.kind === 'hours' ? 8 : 12);
    if (!parsed.ok) return { ...parsed, field: field.key };
    facts[field.key] = parsed.value;
  }
  for (const key of ACTUAL_TEXT_KEYS) {
    const text = form[key] == null ? '' : String(form[key]);
    if (text.length > 2000) return { ok: false, code: 'invalid_notes' };
    facts[key] = text.trim() === '' ? null : text;
  }
  const issue = channelRevenueIssue(facts);
  if (issue) return { ok: false, code: issue };
  return { ok: true, facts };
}

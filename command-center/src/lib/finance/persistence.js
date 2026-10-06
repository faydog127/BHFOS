/**
 * Finance persistence. Callers pass the anon/authenticated client.
 * Errors return codes only. A version conflict does not mutate the caller's inputs.
 */
import { channelRevenueIssue } from './actuals.js';
import { FINANCE_ROUTE_TENANT } from './authz.js';
import { blankPlanInputs, validateNotes, validatePlanInputs } from './blankPlan.js';
import { isSupportedPlanSchema, planHasMonthlyBasis } from './schemaContract.js';
import { FINANCE_WRITES_DISABLED, financeWritesEnabled } from './writeGate.js';

const PLAN_COLUMNS = 'id, version, status, schema_version, inputs, notes, approved_at, approved_by, updated_at';
const ACTUAL_COLUMNS = 'id, version, comparison_plan_id, month, source, source_note, total_revenue, direct_residential_revenue, commercial_direct_revenue, portal_revenue, field_payroll, indirect_cash_costs, ar_ending, cash_reserve, total_jobs, dryer_vent_jobs, duct_jobs, ahu_jobs, productive_unit_hours, notes, updated_at';
const ACTUAL_FACT_KEYS = [
  'total_revenue',
  'direct_residential_revenue',
  'commercial_direct_revenue',
  'portal_revenue',
  'field_payroll',
  'indirect_cash_costs',
  'ar_ending',
  'cash_reserve',
  'total_jobs',
  'dryer_vent_jobs',
  'duct_jobs',
  'ahu_jobs',
  'productive_unit_hours',
  'notes',
  'source_note',
];

const REVENUE_KEYS = [
  'total_revenue',
  'direct_residential_revenue',
  'commercial_direct_revenue',
  'portal_revenue',
];

function codeFrom(error, fallback) {
  if (!error) return fallback;
  return error.code || fallback;
}

const FINANCE_VERSION_CONFLICT_ID = 'finance_version_conflict';

export function isFinanceVersionConflict(error) {
  if (!error || typeof error !== 'object') return false;
  const identified = ['message', 'details', 'detail', 'hint'].some((key) => (
    typeof error[key] === 'string' && error[key].includes(FINANCE_VERSION_CONFLICT_ID)
  ));
  if (identified) return true;
  return error.code === '40001' || error.code === 'PT409';
}

function failure(error, fallback) {
  return { ok: false, code: codeFrom(error, fallback), detail: error?.message || '' };
}

function factPatch(facts) {
  const patch = {};
  const sourceFacts = facts && typeof facts === 'object' ? facts : {};
  for (const key of ACTUAL_FACT_KEYS) {
    if (Object.prototype.hasOwnProperty.call(sourceFacts, key)) patch[key] = sourceFacts[key];
  }
  if (REVENUE_KEYS.every((key) => Object.prototype.hasOwnProperty.call(patch, key))) {
    const issue = channelRevenueIssue(patch);
    if (issue) return { ok: false, code: issue };
  }
  return { ok: true, patch };
}

export function selectVisiblePlan(plans) {
  const rows = Array.isArray(plans) ? plans : [];
  const approved = rows.find((row) => row.status === 'approved') || null;
  const draft = rows.find((row) => row.status === 'draft') || null;
  return { approved, draft, visible: draft || approved || null };
}

export const STORED_PLAN_INVALID_COPY = 'A stored plan failed validation. An administrator must repair the draft.';

export function storedPlanDecision(plan) {
  if (!plan) return { ok: true };
  try {
    const validated = validatePlanInputs(plan.inputs, plan.schema_version);
    if (!validated.ok) return { ok: false, code: 'finance_schema_unsupported' };
    return { ok: true };
  } catch {
    return { ok: false, code: 'finance_schema_unsupported' };
  }
}

export async function listPlans(client) {
  const { data, error } = await client
    .from('finance_plans')
    .select(PLAN_COLUMNS)
    .order('updated_at', { ascending: false });
  if (error) return { ok: false, code: codeFrom(error, 'finance_read_failed') };
  return { ok: true, plans: data || [] };
}

export async function createBlankPlan(client, env) {
  if (!financeWritesEnabled(env)) return { ok: false, code: FINANCE_WRITES_DISABLED };
  const validated = validatePlanInputs({ ...blankPlanInputs(), monthly_basis: {} }, 2);
  if (!validated.ok) return { ok: false, code: validated.code };
  const { data, error } = await client
    .from('finance_plans')
    .insert({
      tenant_id: FINANCE_ROUTE_TENANT,
      schema_version: 2,
      inputs: validated.inputs,
      notes: null,
    })
    .select(PLAN_COLUMNS)
    .maybeSingle();
  if (error) return { ok: false, code: codeFrom(error, 'finance_create_failed') };
  if (!data) return { ok: false, code: 'finance_create_failed' };
  return { ok: true, plan: data };
}

export async function saveDraft(client, { id, expectedVersion, inputs, notes, schemaVersion = 1 }, env) {
  if (!financeWritesEnabled(env)) return { ok: false, code: FINANCE_WRITES_DISABLED };
  const validated = validatePlanInputs(inputs, schemaVersion);
  if (!validated.ok) return { ok: false, code: validated.code };
  const noteResult = validateNotes(notes);
  if (!noteResult.ok) return { ok: false, code: noteResult.code };
  const { data, error } = await client
    .from('finance_plans')
    .update({
      inputs: validated.inputs,
      notes: noteResult.notes,
    })
    .eq('id', id)
    .eq('version', expectedVersion)
    .eq('status', 'draft')
    .select(PLAN_COLUMNS)
    .maybeSingle();
  if (error) return { ok: false, code: codeFrom(error, 'finance_save_failed') };
  if (!data) return { ok: false, code: 'version_conflict' };
  return { ok: true, plan: data };
}

export async function approvePlan(client, { id, expectedVersion }, env) {
  if (!financeWritesEnabled(env)) return { ok: false, code: FINANCE_WRITES_DISABLED };
  const { data, error } = await client.rpc('finance_approve_plan', {
    p_plan_id: id,
    p_expected_version: expectedVersion,
  });
  if (error) {
    if (isFinanceVersionConflict(error)) return { ok: false, code: 'version_conflict' };
    const text = ['message', 'details', 'detail', 'hint']
      .map((key) => error[key])
      .filter((value) => typeof value === 'string')
      .join(' ');
    if (text.includes('finance_plan_not_approvable')) return { ok: false, code: 'finance_plan_not_approvable' };
    return { ok: false, code: error.code || 'finance_approve_failed' };
  }
  if (!data) return { ok: false, code: 'version_conflict' };
  return { ok: true, plan: data };
}

export async function openDraftFromApproved(client, { id }, env) {
  if (!financeWritesEnabled(env)) return { ok: false, code: FINANCE_WRITES_DISABLED };
  const { data, error } = await client.rpc('finance_open_draft', { p_plan_id: id });
  if (error) {
    if (isFinanceVersionConflict(error)) return { ok: false, code: 'version_conflict' };
    return { ok: false, code: error.code || 'finance_draft_failed' };
  }
  if (!data) return { ok: false, code: 'finance_draft_failed' };
  return { ok: true, plan: data };
}

export async function upgradeDraftSchema(client, { id, expectedVersion }, env) {
  if (!financeWritesEnabled(env)) return { ok: false, code: FINANCE_WRITES_DISABLED };
  const { data, error } = await client.rpc('finance_upgrade_draft_schema', {
    p_plan_id: id,
    p_expected_version: expectedVersion,
  });
  if (error) {
    if (isFinanceVersionConflict(error)) return { ok: false, code: 'version_conflict' };
    return { ok: false, code: error.code || 'finance_schema_upgrade_failed' };
  }
  if (!data) return { ok: false, code: 'version_conflict' };
  return { ok: true, plan: data };
}

export async function listMonthlyActuals(client) {
  const { data, error } = await client
    .from('finance_monthly_actuals')
    .select(ACTUAL_COLUMNS)
    .order('month', { ascending: false });
  if (error) return { ok: false, code: codeFrom(error, 'finance_read_failed') };
  return { ok: true, actuals: data || [] };
}

export async function correctMonthlyActual(client, { id, expectedVersion, facts }, env) {
  if (!financeWritesEnabled(env)) return { ok: false, code: FINANCE_WRITES_DISABLED };
  const prepared = factPatch(facts);
  if (!prepared.ok) return prepared;
  const { data, error } = await client
    .from('finance_monthly_actuals')
    .update(prepared.patch)
    .eq('id', id)
    .eq('version', expectedVersion)
    .select(ACTUAL_COLUMNS)
    .maybeSingle();
  if (error) return failure(error, 'finance_save_failed');
  if (!data) return { ok: false, code: 'version_conflict' };
  return { ok: true, actual: data };
}

export async function createMonthlyActual(client, { month, facts, comparisonPlanId }, env) {
  if (!financeWritesEnabled(env)) return { ok: false, code: FINANCE_WRITES_DISABLED };
  const prepared = factPatch(facts);
  if (!prepared.ok) return prepared;
  const row = {
    tenant_id: FINANCE_ROUTE_TENANT,
    month,
    schema_version: 1,
    source: 'manual_entry',
    ...prepared.patch,
  };
  if (comparisonPlanId) row.comparison_plan_id = comparisonPlanId;
  const { data, error } = await client
    .from('finance_monthly_actuals')
    .insert(row)
    .select(ACTUAL_COLUMNS)
    .maybeSingle();
  if (error) return failure(error, 'finance_create_failed');
  if (!data) return { ok: false, code: 'finance_create_failed' };
  return { ok: true, actual: data };
}

export async function associateComparisonPlan(client, { id, expectedVersion, comparisonPlanId }, env) {
  if (!financeWritesEnabled(env)) return { ok: false, code: FINANCE_WRITES_DISABLED };
  if (!comparisonPlanId) return { ok: false, code: 'comparison_plan_required' };
  const { data, error } = await client
    .from('finance_monthly_actuals')
    .update({ comparison_plan_id: comparisonPlanId })
    .eq('id', id)
    .eq('version', expectedVersion)
    .select(ACTUAL_COLUMNS)
    .maybeSingle();
  if (error) return failure(error, 'finance_save_failed');
  if (!data) return { ok: false, code: 'version_conflict' };
  return { ok: true, actual: data };
}

export async function readPlan(client, id) {
  const { data, error } = await client
    .from('finance_plans')
    .select(PLAN_COLUMNS)
    .eq('id', id)
    .maybeSingle();
  if (error) return { ok: false, code: codeFrom(error, 'finance_read_failed') };
  if (!data) return { ok: false, code: 'finance_not_found' };
  if (!isSupportedPlanSchema(data.schema_version)) return { ok: false, code: 'finance_schema_unsupported' };
  if (planHasMonthlyBasis(data.schema_version)) {
    const basis = validatePlanInputs(data.inputs, 2);
    if (!basis.ok) return { ok: false, code: 'finance_schema_unsupported' };
  }
  return { ok: true, plan: data };
}

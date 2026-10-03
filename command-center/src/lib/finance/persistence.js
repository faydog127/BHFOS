/**
 * Finance persistence. Callers pass the anon/authenticated client.
 * Errors return codes only. A version conflict does not mutate the caller's inputs.
 */
import { FINANCE_ROUTE_TENANT } from './authz.js';
import { FINANCE_PLAN_SCHEMA_VERSION, blankPlanInputs, validateNotes, validatePlanInputs } from './blankPlan.js';
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

function codeFrom(error, fallback) {
  if (!error) return fallback;
  return error.code || fallback;
}

export function selectVisiblePlan(plans) {
  const rows = Array.isArray(plans) ? plans : [];
  const approved = rows.find((row) => row.status === 'approved') || null;
  const draft = rows.find((row) => row.status === 'draft') || null;
  return { approved, draft, visible: draft || approved || null };
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
  const inputs = blankPlanInputs();
  const { data, error } = await client
    .from('finance_plans')
    .insert({
      tenant_id: FINANCE_ROUTE_TENANT,
      schema_version: FINANCE_PLAN_SCHEMA_VERSION,
      inputs,
      notes: null,
    })
    .select(PLAN_COLUMNS)
    .maybeSingle();
  if (error) return { ok: false, code: codeFrom(error, 'finance_create_failed') };
  if (!data) return { ok: false, code: 'finance_create_failed' };
  return { ok: true, plan: data };
}

export async function saveDraft(client, { id, expectedVersion, inputs, notes }, env) {
  if (!financeWritesEnabled(env)) return { ok: false, code: FINANCE_WRITES_DISABLED };
  const validated = validatePlanInputs(inputs);
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
    if (error.code === '40001' || error.message === 'finance_version_conflict') {
      return { ok: false, code: 'version_conflict' };
    }
    return { ok: false, code: error.code || 'finance_approve_failed' };
  }
  if (!data) return { ok: false, code: 'version_conflict' };
  return { ok: true, plan: data };
}

export async function openDraftFromApproved(client, { id }, env) {
  if (!financeWritesEnabled(env)) return { ok: false, code: FINANCE_WRITES_DISABLED };
  const { data, error } = await client.rpc('finance_open_draft', { p_plan_id: id });
  if (error) return { ok: false, code: error.code || 'finance_draft_failed' };
  if (!data) return { ok: false, code: 'finance_draft_failed' };
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
  const patch = {};
  const sourceFacts = facts && typeof facts === 'object' ? facts : {};
  for (const key of ACTUAL_FACT_KEYS) {
    if (Object.prototype.hasOwnProperty.call(sourceFacts, key)) patch[key] = sourceFacts[key];
  }
  const { data, error } = await client
    .from('finance_monthly_actuals')
    .update(patch)
    .eq('id', id)
    .eq('version', expectedVersion)
    .select(ACTUAL_COLUMNS)
    .maybeSingle();
  if (error) return { ok: false, code: codeFrom(error, 'finance_save_failed') };
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
  if (data.schema_version !== FINANCE_PLAN_SCHEMA_VERSION) return { ok: false, code: 'finance_schema_unsupported' };
  return { ok: true, plan: data };
}

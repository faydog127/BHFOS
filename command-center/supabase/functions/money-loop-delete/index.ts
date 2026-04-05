import { supabaseAdmin } from '../_lib/supabaseAdmin.ts';
import { getTenantIdFromClaims, getVerifiedClaims } from '../_shared/auth.ts';
import { buildCorsHeaders, readJson } from '../_shared/publicUtils.ts';

const ADMIN_ROLES = new Set(['admin', 'super_admin']);
const ALLOWED_ENTITY_TYPES = new Set(['quote', 'job', 'invoice']);

const respondJson = (body: Record<string, unknown>, status: number, headers: Record<string, string>) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...headers, 'Content-Type': 'application/json' },
  });

const asString = (value: unknown): string => (typeof value === 'string' ? value.trim() : '');

const normalizeIds = (value: unknown): string[] =>
  Array.from(
    new Set((Array.isArray(value) ? value : [value]).map((entry) => asString(entry)).filter(Boolean)),
  );

const ensureAdminRole = async (userId: string | null) => {
  if (!userId) return false;

  const { data, error } = await supabaseAdmin.from('app_user_roles').select('role').eq('user_id', userId);
  if (error) throw error;

  return (data ?? []).some((row: { role?: string | null }) => ADMIN_ROLES.has(asString(row?.role).toLowerCase()));
};

const runDelete = async (table: string, apply: (query: any) => any) => {
  const { error } = await apply(supabaseAdmin.from(table).delete());
  if (error) throw error;
};

const runUpdate = async (
  table: string,
  patch: Record<string, unknown>,
  apply: (query: any) => any,
) => {
  const { error } = await apply(supabaseAdmin.from(table).update(patch));
  if (error) throw error;
};

const selectScopedIds = async (table: string, ids: string[], tenantId: string) => {
  const { data, error } = await supabaseAdmin
    .from(table)
    .select('id')
    .eq('tenant_id', tenantId)
    .in('id', ids);

  if (error) throw error;
  return (data ?? []).map((row: { id?: string | null }) => asString(row?.id)).filter(Boolean);
};

const selectInvoiceIdsForJobs = async (jobIds: string[], tenantId: string) => {
  const { data, error } = await supabaseAdmin
    .from('invoices')
    .select('id')
    .eq('tenant_id', tenantId)
    .in('job_id', jobIds);

  if (error) throw error;
  return (data ?? []).map((row: { id?: string | null }) => asString(row?.id)).filter(Boolean);
};

const cleanupQuoteRows = async (ids: string[], tenantId: string) => {
  const nowIso = new Date().toISOString();

  await runDelete('email_logs', (query) => query.in('quote_id', ids));
  await runDelete('crm_tasks', (query) => query.eq('tenant_id', tenantId).eq('source_type', 'quote').in('source_id', ids));
  await runDelete('events', (query) => query.eq('tenant_id', tenantId).eq('entity_type', 'quote').in('entity_id', ids));
  await runDelete('automation_suspensions', (query) =>
    query.eq('tenant_id', tenantId).eq('entity_type', 'quote').in('entity_id', ids),
  );
  await runUpdate('jobs', { quote_id: null, updated_at: nowIso }, (query) =>
    query.eq('tenant_id', tenantId).in('quote_id', ids),
  );
  await runUpdate('invoices', { quote_id: null, updated_at: nowIso }, (query) =>
    query.eq('tenant_id', tenantId).in('quote_id', ids),
  );
};

const cleanupJobRows = async (ids: string[], tenantId: string) => {
  await runDelete('email_logs', (query) => query.in('job_id', ids));
  await runDelete('job_surveys', (query) => query.in('job_id', ids));
  await runDelete('crm_tasks', (query) => query.eq('tenant_id', tenantId).in('source_type', ['job', 'work_order']).in('source_id', ids));
  await runDelete('events', (query) => query.eq('tenant_id', tenantId).eq('entity_type', 'job').in('entity_id', ids));
  await runDelete('automation_suspensions', (query) =>
    query.eq('tenant_id', tenantId).eq('entity_type', 'job').in('entity_id', ids),
  );
  await runUpdate('customer_discounts', { redeemed_job_id: null }, (query) => query.in('redeemed_job_id', ids));

  const invoiceIds = await selectInvoiceIdsForJobs(ids, tenantId);
  if (invoiceIds.length > 0) {
    await cleanupInvoiceRows(invoiceIds, tenantId);
    await runDelete('invoices', (query) => query.eq('tenant_id', tenantId).in('id', invoiceIds));
  }
};

const cleanupInvoiceRows = async (ids: string[], tenantId: string) => {
  await runDelete('invoice_items', (query) => query.in('invoice_id', ids));
  await runDelete('email_logs', (query) => query.in('invoice_id', ids));
  await runDelete('crm_tasks', (query) => query.eq('tenant_id', tenantId).eq('source_type', 'invoice').in('source_id', ids));
  await runDelete('events', (query) => query.eq('tenant_id', tenantId).eq('entity_type', 'invoice').in('entity_id', ids));
  await runDelete('events', (query) => query.eq('tenant_id', tenantId).eq('entity_type', 'payment').in('entity_id', ids));
  await runDelete('automation_suspensions', (query) =>
    query.eq('tenant_id', tenantId).eq('entity_type', 'invoice').in('entity_id', ids),
  );
  await runDelete('stripe_webhook_events', (query) => query.in('invoice_id', ids));
  await runDelete('transactions', (query) => query.eq('tenant_id', tenantId).in('invoice_id', ids));
};

const cleanupDependencies = async (entityType: string, ids: string[], tenantId: string) => {
  if (entityType === 'quote') {
    await cleanupQuoteRows(ids, tenantId);
    return 'quotes';
  }
  if (entityType === 'job') {
    await cleanupJobRows(ids, tenantId);
    return 'jobs';
  }
  await cleanupInvoiceRows(ids, tenantId);
  return 'invoices';
};

Deno.serve(async (req) => {
  const origin = req.headers.get('origin');
  const cors = buildCorsHeaders(origin);

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: cors.headers });
  }

  if (req.method !== 'POST') {
    return respondJson({ error: 'Method not allowed' }, 405, cors.headers);
  }

  let claims;
  try {
    ({ claims } = await getVerifiedClaims(req));
  } catch (error) {
    return respondJson({ error: String(error?.message ?? error) }, 401, cors.headers);
  }

  const tenantId = getTenantIdFromClaims(claims);
  if (!tenantId) {
    return respondJson({ error: 'Unauthorized: missing tenant claim' }, 403, cors.headers);
  }

  const isAdmin = await ensureAdminRole(asString(claims?.sub));
  if (!isAdmin) {
    return respondJson({ error: 'Admin role required' }, 403, cors.headers);
  }

  const body = await readJson(req);
  const entityType = asString(body?.entity_type).toLowerCase();
  const bodyTenantId = asString(body?.tenant_id);
  const ids = normalizeIds(body?.ids);

  if (bodyTenantId && bodyTenantId !== tenantId) {
    return respondJson({ error: 'Tenant mismatch' }, 403, cors.headers);
  }

  if (!ALLOWED_ENTITY_TYPES.has(entityType)) {
    return respondJson({ error: 'entity_type must be quote, job, or invoice' }, 400, cors.headers);
  }

  if (ids.length === 0) {
    return respondJson({ error: 'At least one id is required' }, 400, cors.headers);
  }

  try {
    const scopedIds = await selectScopedIds(`${entityType === 'quote' ? 'quotes' : entityType === 'job' ? 'jobs' : 'invoices'}`, ids, tenantId);

    if (scopedIds.length === 0) {
      return respondJson({ deleted_count: 0, matched_count: 0, requested_count: ids.length, deleted_ids: [] }, 200, cors.headers);
    }

    const table = await cleanupDependencies(entityType, scopedIds, tenantId);

    const { data: deletedRows, error: deleteError } = await supabaseAdmin
      .from(table)
      .delete()
      .eq('tenant_id', tenantId)
      .in('id', scopedIds)
      .select('id');

    if (deleteError) throw deleteError;

    return respondJson(
      {
        deleted_count: deletedRows?.length ?? 0,
        matched_count: scopedIds.length,
        requested_count: ids.length,
        deleted_ids: (deletedRows ?? []).map((row: { id?: string | null }) => asString(row?.id)).filter(Boolean),
      },
      200,
      cors.headers,
    );
  } catch (error) {
    return respondJson({ error: String(error?.message ?? error) }, 500, cors.headers);
  }
});

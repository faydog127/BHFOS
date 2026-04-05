import { supabaseAdmin } from '../_lib/supabaseAdmin.ts';
import { getTenantIdFromClaims, getVerifiedClaims } from '../_shared/auth.ts';
import { buildCorsHeaders, readJson } from '../_shared/publicUtils.ts';

const respondJson = (body: Record<string, unknown>, status: number, headers: Record<string, string>) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...headers, 'Content-Type': 'application/json' },
  });

const normalizeStatusFilter = (value: unknown) => {
  if (!value) return 'all';
  if (Array.isArray(value)) return value.map((entry) => String(entry)).filter(Boolean);
  return String(value);
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

  let claims = null;
  let jwtTenantId: string | null = null;
  let jwtError: string | null = null;

  try {
    ({ claims } = await getVerifiedClaims(req));
    jwtTenantId = getTenantIdFromClaims(claims);
  } catch (error) {
    jwtError = String(error?.message ?? error);
  }

  const body = await readJson(req);
  const bodyTenantId = typeof body?.tenant_id === 'string' && body.tenant_id.trim() ? body.tenant_id : null;
  const statusFilter = normalizeStatusFilter(body?.status);
  const effectiveTenantId = bodyTenantId ?? jwtTenantId;

  if (!effectiveTenantId) {
    return respondJson(
      { error: 'Unauthorized: missing tenant context', details: jwtError ?? 'Missing tenant claim' },
      403,
      cors.headers
    );
  }

  if (bodyTenantId && jwtTenantId && bodyTenantId !== jwtTenantId) {
    return respondJson({ error: 'Tenant mismatch' }, 403, cors.headers);
  }

  let query = supabaseAdmin
    .from('invoices')
    .select(
      [
        'id',
        'tenant_id',
        'status',
        'invoice_number',
        'issue_date',
        'due_date',
        'total_amount',
        'amount_paid',
        'balance_due',
        'public_token',
        'quickbooks_id',
        'quickbooks_sync_status',
        'lead_id',
        'job_id',
        'quote_id',
        'created_at',
        'updated_at',
        'lead:leads(first_name,last_name,company,email)',
      ].join(',')
    )
    .eq('tenant_id', effectiveTenantId)
    .order('created_at', { ascending: false });

  if (Array.isArray(statusFilter) && statusFilter.length) {
    query = query.in('status', statusFilter);
  } else if (typeof statusFilter === 'string' && statusFilter !== 'all') {
    query = query.eq('status', statusFilter);
  }

  const { data, error } = await query;

  if (error) {
    return respondJson({ error: error.message }, 500, cors.headers);
  }

  return respondJson({ invoices: data ?? [] }, 200, cors.headers);
});

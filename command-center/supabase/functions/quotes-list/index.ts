import { supabaseAdmin } from '../_lib/supabaseAdmin.ts';
import { getTenantIdFromClaims, getVerifiedClaims } from '../_shared/auth.ts';
import { buildCorsHeaders, readJson } from '../_shared/publicUtils.ts';

const respondJson = (body: Record<string, unknown>, status: number, headers: Record<string, string>) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...headers, 'Content-Type': 'application/json' },
  });

const isMissingColumnError = (error: { code?: string; message?: string } | null | undefined) => {
  if (!error) return false;
  const message = String(error.message || '').toLowerCase();
  if (error.code === 'PGRST204' || error.code === '42703') return true;
  return message.includes('column') && (message.includes('does not exist') || message.includes('could not find'));
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
  const status = body?.status ?? 'all';
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

  const runQuotesQuery = async (leadSelect: string) => {
    let query = supabaseAdmin
      .from('quotes')
      .select(`*, leads(${leadSelect})`)
      .eq('tenant_id', effectiveTenantId)
      .order('created_at', { ascending: false });

    if (status && status !== 'all') {
      query = query.eq('status', status);
    }

    return query;
  };

  let result = await runQuotesQuery('first_name, last_name, company, email, phone, preferred_document_delivery, sms_opt_out');
  if (result.error && isMissingColumnError(result.error)) {
    result = await runQuotesQuery('first_name, last_name, company, email, phone');
  }
  if (result.error && isMissingColumnError(result.error)) {
    result = await runQuotesQuery('first_name, last_name, company');
  }

  const { data, error } = result;

  if (error) {
    return respondJson({ error: error.message }, 500, cors.headers);
  }

  return respondJson({ quotes: data ?? [] }, 200, cors.headers);
});

import { supabaseAdmin } from '../_lib/supabaseAdmin.ts';
import { getTenantIdFromClaims, getVerifiedClaims } from '../_shared/auth.ts';
import { buildCorsHeaders, readJson } from '../_shared/publicUtils.ts';
import { closeFollowUpTasks } from '../_shared/taskUtils.ts';

const respondJson = (body: Record<string, unknown>, status: number, headers: Record<string, string>) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...headers, 'Content-Type': 'application/json' },
  });

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

  const jwtTenantId = getTenantIdFromClaims(claims);
  if (!jwtTenantId) {
    return respondJson({ error: 'Unauthorized: missing tenant claim' }, 403, cors.headers);
  }

  const body = await readJson(req);
  const quoteId = body?.quote_id || null;
  const bodyTenantId = body?.tenant_id || null;
  const status = body?.status || null;
  const rejectionReason = body?.rejection_reason || null;

  if (bodyTenantId && bodyTenantId !== jwtTenantId) {
    return respondJson({ error: 'Tenant mismatch' }, 403, cors.headers);
  }

  if (!quoteId || !status) {
    return respondJson({ error: 'quote_id and status are required' }, 400, cors.headers);
  }

  const normalizedStatus = String(status).toLowerCase();
  const updateData: Record<string, unknown> = { status };

  if (['accepted', 'approved'].includes(normalizedStatus)) {
    updateData.accepted_at = new Date().toISOString();
  }

  if (['rejected', 'declined'].includes(normalizedStatus)) {
    updateData.rejected_at = new Date().toISOString();
    if (rejectionReason) updateData.rejection_reason = rejectionReason;
  }

  const { data: quote, error } = await supabaseAdmin
    .from('quotes')
    .update(updateData)
    .eq('id', quoteId)
    .eq('tenant_id', jwtTenantId)
    .select('id, status, tenant_id')
    .maybeSingle();

  if (error || !quote) {
    return respondJson({ error: error?.message || 'Quote not found' }, 404, cors.headers);
  }

  if (['accepted', 'approved'].includes(normalizedStatus)) {
    await closeFollowUpTasks({
      tenantId: quote.tenant_id || jwtTenantId,
      sourceType: 'quote',
      sourceId: quote.id,
    });
  }

  return respondJson({ quote }, 200, cors.headers);
});

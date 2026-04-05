import { supabaseAdmin } from '../_lib/supabaseAdmin.ts';
import { getTenantIdFromClaims, getVerifiedClaims } from '../_shared/auth.ts';
import { buildCorsHeaders, readJson } from '../_shared/publicUtils.ts';
import { logMoneyLoopEvent } from '../_shared/moneyLoopUtils.ts';

const respondJson = (body: Record<string, unknown>, status: number, headers: Record<string, string>) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...headers, 'Content-Type': 'application/json' },
  });

type ManualConvertPayload = {
  contact_id?: string | null;
  lead_id?: string | null;
  manual_convert_reason?: string | null;
};

Deno.serve(async (req) => {
  const origin = req.headers.get('origin');
  const cors = buildCorsHeaders(origin);

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: cors.headers });
  }

  if (!cors.allowed && origin) {
    return respondJson({ error: 'Origin not allowed' }, 403, cors.headers);
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

  const body = (await readJson(req)) as ManualConvertPayload | null;
  const contactId = body?.contact_id ?? null;
  const leadId = body?.lead_id ?? null;
  const reason = body?.manual_convert_reason ?? null;

  if (!contactId && !leadId) {
    return respondJson({ error: 'contact_id or lead_id is required' }, 400, cors.headers);
  }

  let resolvedContactId = contactId;

  if (!resolvedContactId && leadId) {
    const { data: lead, error: leadError } = await supabaseAdmin
      .from('leads')
      .select('contact_id')
      .eq('id', leadId)
      .eq('tenant_id', tenantId)
      .maybeSingle();

    if (leadError) {
      return respondJson({ error: leadError.message }, 400, cors.headers);
    }

    resolvedContactId = lead?.contact_id ?? null;
    if (!resolvedContactId) {
      return respondJson({ error: 'Contact for lead not found' }, 404, cors.headers);
    }
  }

  const { data: existingContact, error: existingContactError } = await supabaseAdmin
    .from('contacts')
    .select('is_customer, customer_created_at')
    .eq('id', resolvedContactId)
    .maybeSingle();

  if (existingContactError) {
    return respondJson({ error: existingContactError.message }, 500, cors.headers);
  }

  const updateData: Record<string, unknown> = {
    is_customer: true,
    manual_convert_reason: reason,
  };

  if (!existingContact?.is_customer || !existingContact?.customer_created_at) {
    updateData.customer_created_at = new Date().toISOString();
  }

  const { error: contactError } = await supabaseAdmin
    .from('contacts')
    .update(updateData)
    .eq('id', resolvedContactId);

  if (contactError) {
    return respondJson({ error: contactError.message }, 500, cors.headers);
  }

  // Gap 8: Entity type standardization - use 'customer' not 'contact'
  await logMoneyLoopEvent({
    tenantId,
    entityType: 'customer',
    entityId: resolvedContactId,
    eventType: 'CustomerConvertedManual',
    actorType: 'user',
    actorId: claims.sub ?? null,
    payload: { lead_id: leadId, reason },
  });

  return respondJson(
    {
      ok: true,
      contact_id: resolvedContactId,
      lead_id: leadId,
    },
    200,
    cors.headers
  );
});

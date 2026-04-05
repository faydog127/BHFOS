import { supabaseAdmin } from '../_lib/supabaseAdmin.ts';
import { getTenantIdFromClaims, getVerifiedClaims } from '../_shared/auth.ts';
import { buildCorsHeaders, readJson } from '../_shared/publicUtils.ts';
import { closeFollowUpTasks } from '../_shared/taskUtils.ts';

const respondJson = (body: Record<string, unknown>, status: number, headers: Record<string, string>) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...headers, 'Content-Type': 'application/json' },
  });

const stageMap: Record<string, string> = {
  col_new: 'new',
  col_contacted: 'working',
  col_visit_scheduled: 'scheduled',
  col_quote_sent: 'quoted',
  col_dormant: 'dormant',
  col_ready_to_book: 'qualified',
  col_in_progress: 'in_progress',
  col_ready_to_invoice: 'ready_to_invoice',
  col_lost: 'lost',
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

  const jwtTenantId = getTenantIdFromClaims(claims);
  if (!jwtTenantId) {
    return respondJson({ error: 'Unauthorized: missing tenant claim' }, 403, cors.headers);
  }

  const actorId = typeof claims.sub === 'string' ? claims.sub : null;

  const body = await readJson(req);
  const leadId = body?.lead_id || null;
  const bodyTenantId = body?.tenant_id || null;
  const currentStage = body?.current_stage || null;
  const targetStage = body?.target_stage || null;
  const notes = body?.notes || null;

  if (bodyTenantId && bodyTenantId !== jwtTenantId) {
    return respondJson({ error: 'Tenant mismatch' }, 403, cors.headers);
  }

  if (!leadId || !targetStage) {
    return respondJson({ error: 'lead_id and target_stage are required' }, 400, cors.headers);
  }

  const updateData: Record<string, unknown> = {
    pipeline_stage: stageMap[targetStage] || 'working',
    last_touch_at: new Date().toISOString(),
  };

  if (targetStage === 'col_dormant' || targetStage === 'col_lost') {
    updateData.status = 'archived';
  }

  const { data: lead, error } = await supabaseAdmin
    .from('leads')
    .update(updateData)
    .eq('id', leadId)
    .eq('tenant_id', jwtTenantId)
    .select('id, pipeline_stage, status, tenant_id')
    .maybeSingle();

  if (error || !lead) {
    return respondJson({ error: error?.message || 'Lead not found' }, 404, cors.headers);
  }

  await supabaseAdmin.from('kanban_status_events').insert({
    entity_type: 'lead',
    entity_id: leadId,
    from_stage: currentStage,
    to_stage: targetStage,
    actor_id: actorId,
    metadata: { notes, source: 'manual_progression_modal' },
  });

  if (targetStage === 'col_lost') {
    await closeFollowUpTasks({
      tenantId: lead.tenant_id || jwtTenantId,
      leadId,
    });
  }

  return respondJson({ lead }, 200, cors.headers);
});

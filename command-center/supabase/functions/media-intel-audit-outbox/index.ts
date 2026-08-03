/**
 * MIL audit outbox worker (Phase 2A remediation).
 * Claims pending/failed rows with SKIP LOCKED, projects into mil_audit_events.
 * Authorized by MIL_RECONCILE_KEY (same class as upload-reconcile) — not a
 * general event platform.
 *
 * Actions: health | run
 */
import { milCorsHeaders, milCorsPreflight } from '../_shared/milCors.ts'
import { supabaseAdmin } from '../_shared/supabaseAdmin.ts'
import { newCorrelationId, redactErrorForClient } from '../_shared/milSafeErrors.ts'

function keysMatch(a: string, b: string) {
  if (!a || !b || a.length !== b.length) return false
  let out = 0
  for (let i = 0; i < a.length; i += 1) out |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return out === 0
}

Deno.serve(async (req) => {
  const cors = milCorsHeaders(req)
  if (req.method === 'OPTIONS') return milCorsPreflight(req)
  const correlationId = req.headers.get('x-correlation-id') || newCorrelationId()
  const json = (body: Record<string, unknown>, status = 200) =>
    new Response(JSON.stringify({ ...body, correlationId }), {
      status,
      headers: {
        ...cors,
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store',
        'x-correlation-id': correlationId,
      },
    })

  try {
    const expected = Deno.env.get('MIL_RECONCILE_KEY') || ''
    if (!expected) return json({ error: 'Outbox worker not configured' }, 503)
    const provided = req.headers.get('x-mil-reconcile-key') || ''
    if (!keysMatch(expected, provided)) return json({ error: 'Forbidden' }, 403)

    const body = await req.json().catch(() => ({}))
    const action = String(body.action || 'health')

    if (action === 'health') {
      const { count, error } = await supabaseAdmin
        .from('mil_audit_outbox')
        .select('id', { count: 'exact', head: true })
        .in('status', ['pending', 'failed', 'terminal_failed'])
      if (error) throw error
      return json({ ok: true, openRows: count || 0 })
    }

    if (action === 'run') {
      const limit = Math.min(Number(body.limit) || 20, 100)
      const { data: claimed, error: claimErr } = await supabaseAdmin.rpc('mil_outbox_claim_batch', {
        p_limit: limit,
        p_worker_id: `audit-outbox-${crypto.randomUUID().slice(0, 8)}`,
        p_max_attempts: 8,
        p_lease_seconds: 300,
      })
      if (claimErr) throw claimErr
      const rows = Array.isArray(claimed) ? claimed : []
      let delivered = 0
      let failed = 0
      for (const row of rows) {
        const { data, error } = await supabaseAdmin.rpc('mil_outbox_project_one', { p_id: row.id })
        if (error || !(data as { ok?: boolean })?.ok) failed += 1
        else delivered += 1
      }
      return json({ ok: true, claimed: rows.length, delivered, failed })
    }

    return json({ error: 'Unknown action' }, 400)
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    console.error('media-intel-audit-outbox', { correlationId, msg })
    const redacted = redactErrorForClient(error, { correlationId, fallbackCode: 'INTERNAL_ERROR' })
    return json({ error: redacted.error, code: redacted.code }, 500)
  }
})

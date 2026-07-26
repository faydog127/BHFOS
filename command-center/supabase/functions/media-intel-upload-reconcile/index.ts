/**
 * Upload finalization reconciler (single-company).
 *
 * Phone uploads can be interrupted between "bytes are in storage" and "the row
 * exists in the library". This function resolves those stranded grants using the
 * only two honest outcomes available:
 *
 *   - storage can confirm the final object  -> finish the commit
 *   - it cannot, and the deadline has passed -> record failure or abandonment
 *
 * It never invents a success. It also performs the delayed quarantine sweep:
 * quarantine bytes are only deleted once the signed upload token that could
 * still write to that path has expired (plus a margin), so a slow client cannot
 * have its in-flight upload deleted out from under it.
 *
 * Access: `verify_jwt` stays on AND a shared reconcile key is required. Without
 * `MIL_RECONCILE_KEY` configured the function refuses to run (503) rather than
 * silently running unauthenticated sweeps. There is no scheduler attached to
 * this function in this slice — invocation is explicit (the upload session
 * function calls it directly for a single grant, and an operator may call
 * `run`). Enabling a scheduler is a separate, staging-gated decision.
 */
import { milCorsHeaders, milCorsPreflight } from '../_shared/milCors.ts'
import { supabaseAdmin } from '../_shared/supabaseAdmin.ts'

const DEFAULT_RUN_LIMIT = 25
const MAX_RUN_LIMIT = 200
const DEFAULT_ABANDON_LIMIT = 200
const DEFAULT_CLEANUP_LIMIT = 50
const MAX_CLEANUP_LIMIT = 500

function jsonWith(headers: Record<string, string>, body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...headers, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  })
}

/** Constant-time comparison so a wrong key cannot be discovered byte by byte. */
function secretsMatch(a: string, b: string) {
  const enc = new TextEncoder()
  const left = enc.encode(a)
  const right = enc.encode(b)
  if (left.length !== right.length) return false
  let diff = 0
  for (let i = 0; i < left.length; i += 1) diff |= left[i] ^ right[i]
  return diff === 0
}

function boundedInt(value: unknown, fallback: number, max: number) {
  const n = Number(value)
  if (!Number.isFinite(n) || n <= 0) return fallback
  return Math.min(Math.floor(n), max)
}

/**
 * Delete quarantine copies whose bytes are already safely represented in the
 * library, and only after the upload token that could still write to that path
 * has expired. Failed and abandoned grants are deliberately NOT swept: their
 * bytes are the only server-side copy of media the phone may already consider
 * transferred.
 */
async function sweepQuarantine(limit: number) {
  const { data: due, error } = await supabaseAdmin
    .from('mil_upload_grants')
    .select('id, bucket, object_path, batch_id, asset_id, finalize_state, quarantine_cleanup_after')
    .in('finalize_state', ['committed', 'duplicate'])
    .is('quarantine_cleaned_at', null)
    .not('quarantine_cleanup_after', 'is', null)
    .lte('quarantine_cleanup_after', new Date().toISOString())
    .order('quarantine_cleanup_after', { ascending: true })
    .limit(limit)
  if (error) throw error

  let cleaned = 0
  const failures: Array<{ grantId: string; error: string }> = []

  for (const grant of due || []) {
    const removal = await supabaseAdmin.storage.from(grant.bucket).remove([grant.object_path])
    if (removal.error) {
      failures.push({ grantId: grant.id, error: removal.error.message })
      continue
    }
    const { error: markErr } = await supabaseAdmin
      .from('mil_upload_grants')
      .update({ quarantine_cleaned_at: new Date().toISOString() })
      .eq('id', grant.id)
    if (markErr) {
      failures.push({ grantId: grant.id, error: markErr.message })
      continue
    }
    cleaned += 1
  }

  return { examined: (due || []).length, cleaned, failures }
}

Deno.serve(async (req) => {
  const cors = milCorsHeaders(req)
  if (req.method === 'OPTIONS') return milCorsPreflight(req)
  const json = (body: unknown, status = 200) => jsonWith(cors, body, status)

  const configuredKey = Deno.env.get('MIL_RECONCILE_KEY') || ''
  const presentedKey = req.headers.get('x-mil-reconcile-key') || ''

  if (!configuredKey) {
    return json({
      error: 'Reconciliation is not configured on this deployment (MIL_RECONCILE_KEY is unset).',
      code: 'not_configured',
    }, 503)
  }
  if (!presentedKey || !secretsMatch(configuredKey, presentedKey)) {
    return json({ error: 'Reconciliation is unavailable.', code: 'not_available' }, 503)
  }

  try {
    const body = await req.json().catch(() => ({}))
    const action = String(body.action || 'health')

    if (action === 'health') {
      const { count: pending, error: pendingErr } = await supabaseAdmin
        .from('mil_upload_grants')
        .select('id', { count: 'exact', head: true })
        .in('finalize_state', ['minted', 'placing', 'placed'])
      if (pendingErr) throw pendingErr

      const { count: openAlerts, error: alertErr } = await supabaseAdmin
        .from('mil_integrity_alerts')
        .select('id', { count: 'exact', head: true })
        .is('acknowledged_at', null)
      if (alertErr) throw alertErr

      const { count: cleanupDue, error: cleanupErr } = await supabaseAdmin
        .from('mil_upload_grants')
        .select('id', { count: 'exact', head: true })
        .in('finalize_state', ['committed', 'duplicate'])
        .is('quarantine_cleaned_at', null)
        .not('quarantine_cleanup_after', 'is', null)
        .lte('quarantine_cleanup_after', new Date().toISOString())
      if (cleanupErr) throw cleanupErr

      return json({
        ok: true,
        configured: true,
        scheduler: 'none — invocation is explicit in this slice',
        pendingGrants: pending || 0,
        openIntegrityAlerts: openAlerts || 0,
        quarantineCleanupDue: cleanupDue || 0,
      })
    }

    if (action === 'grant') {
      const grantId = String(body.grantId || '').trim()
      if (!grantId) return json({ error: 'grantId is required' }, 400)

      const { data: result, error } = await supabaseAdmin.rpc('mil_reconcile_upload_finalization', {
        p_grant_id: grantId,
        p_limit: 1,
        p_lease_owner: `reconcile-edge:${crypto.randomUUID()}`,
      })
      if (error) throw error

      return json({ ok: true, action: 'grant', grantId, reconcile: result })
    }

    if (action === 'run') {
      const runLimit = boundedInt(body.limit, DEFAULT_RUN_LIMIT, MAX_RUN_LIMIT)
      const cleanupLimit = boundedInt(body.cleanupLimit, DEFAULT_CLEANUP_LIMIT, MAX_CLEANUP_LIMIT)

      const { data: reconciled, error: reconcileErr } = await supabaseAdmin.rpc(
        'mil_reconcile_upload_finalization',
        {
          p_grant_id: null,
          p_limit: runLimit,
          p_lease_owner: `reconcile-edge:${crypto.randomUUID()}`,
        },
      )
      if (reconcileErr) throw reconcileErr

      // Abandonment runs after reconciliation so anything storage could still
      // prove is committed first and never mis-labelled as abandoned.
      const { data: abandoned, error: abandonErr } = await supabaseAdmin.rpc(
        'mil_abandon_expired_upload_grants',
        { p_limit: boundedInt(body.abandonLimit, DEFAULT_ABANDON_LIMIT, 1000) },
      )
      if (abandonErr) throw abandonErr

      const cleanup = await sweepQuarantine(cleanupLimit)

      return json({
        ok: true,
        action: 'run',
        reconcile: reconciled,
        abandon: abandoned,
        quarantineCleanup: cleanup,
      })
    }

    return json({ error: 'Unknown action' }, 400)
  } catch (error) {
    console.error('media-intel-upload-reconcile', error instanceof Error ? error.message : error)
    return json({ error: error instanceof Error ? error.message : 'Reconcile error' }, 500)
  }
})

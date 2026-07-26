/**
 * Scoped phone upload sessions (single-company).
 *
 * Opaque token hash only; completion is bound to server-minted grants; the server
 * re-verifies every stored object (size/MIME/SHA-256) before an asset row can
 * exist — client-declared values are advisory only.
 *
 * Finalization is a durable state machine, not a single call:
 *
 *   begin  -> lease the grant (minted|failed|placing -> placing)
 *   hash   -> re-read the quarantine bytes and re-hash them, every attempt
 *   place  -> copy to the canonical final path with upsert:false
 *   placed -> record the verified checksum/mime/size against the final path
 *   commit -> the database proves the final object is visible in the storage
 *             catalog inside the same transaction that inserts mil_assets
 *
 * The reason for the extra states: the previous one-shot finalize inserted the
 * asset row first and then asked storage to place the bytes, so an interruption
 * between the two produced a library entry for media that did not exist, and the
 * phone had already been told "uploaded". Every intermediate state is now
 * persisted so an interrupted transfer can be reconciled instead of guessed at.
 *
 * Honesty note: MAX_UPLOAD_BYTES defaults to 250 MB. Large phone videos can
 * exceed that; this cap is intentionally conservative because edge functions
 * must download the full object into memory to verify its SHA-256, and we do
 * not claim a "2 GB practical" limit like the old client-only validator did.
 * Raise via MIL_MAX_UPLOAD_BYTES only after confirming edge memory headroom.
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4'
import { milCorsHeaders, milCorsPreflight } from '../_shared/milCors.ts'
import { supabaseAdmin } from '../_shared/supabaseAdmin.ts'
import { isMilOwnerAdmin } from '../_shared/milRoles.ts'

function envInt(name: string, fallback: number) {
  const raw = Deno.env.get(name)
  if (!raw) return fallback
  const n = Number(raw)
  return Number.isFinite(n) && n > 0 ? n : fallback
}

const MAX_UPLOAD_BYTES = envInt('MIL_MAX_UPLOAD_BYTES', 250 * 1024 * 1024)
const GRANT_TTL_MS = 60 * 60 * 1000
const MAX_FILES_PER_SESSION = 200
const MAX_CUMULATIVE_BYTES_PER_SESSION = 5 * 1024 * 1024 * 1024
const MAX_CONCURRENT_INCOMPLETE_GRANTS = 5
/** Lease must outlive one placement attempt but expire fast enough that a dead
 *  worker does not block the grant for long. */
const FINALIZE_LEASE_SECONDS = 180
/** After this, an unfinished grant becomes eligible for abandonment. */
const FINALIZE_COMMIT_SECONDS = 900
const RECONCILE_INVOKE_TIMEOUT_MS = 5000

const ALLOWED_MIME = new Set([
  'image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/heic', 'image/heif', 'image/gif',
  'video/mp4', 'video/quicktime', 'video/webm', 'video/x-m4v',
])

function jsonWith(headers: Record<string, string>, body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...headers, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  })
}

async function sha256Hex(value: string) {
  const data = new TextEncoder().encode(value)
  const digest = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

function bytesToHex(digest: ArrayBuffer) {
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

async function sha256Bytes(bytes: Uint8Array) {
  return bytesToHex(await crypto.subtle.digest('SHA-256', bytes))
}

function randomToken() {
  const bytes = new Uint8Array(32)
  crypto.getRandomValues(bytes)
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('')
}

function safeFilename(name: string) {
  return String(name || 'file')
    .replace(/[/\\?%*:|"<>]/g, '_')
    .replace(/\.\./g, '_')
    .slice(0, 180) || 'file'
}

/** image/jpg and image/jpeg are the same format; every other pair must match exactly. */
function normalizeMime(m: string) {
  const v = String(m || '').trim().toLowerCase()
  return v === 'image/jpg' ? 'image/jpeg' : v
}

function mimeEquivalent(a: string, b: string) {
  return normalizeMime(a) === normalizeMime(b)
}

/**
 * exp of the signed upload token, so quarantine bytes are never deleted while a
 * client could still legitimately be writing to that path.
 */
function jwtExpiryIso(token?: string | null): string | null {
  if (!token) return null
  const parts = String(token).split('.')
  if (parts.length < 2) return null
  try {
    const b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/')
    const padded = b64 + '='.repeat((4 - (b64.length % 4)) % 4)
    const payload = JSON.parse(atob(padded))
    const exp = Number(payload?.exp)
    if (!Number.isFinite(exp) || exp <= 0) return null
    return new Date(exp * 1000).toISOString()
  } catch {
    return null
  }
}

/** Canonical final path. Constructed from bound grant columns — never a replace()
 *  on a client-influenced string. Mirrors public.mil_original_object_path. */
function canonicalOriginalPath(batchId: string, assetId: string, filename: string) {
  return `mil/originals/${batchId}/${assetId}/${filename}`
}

function canonicalQuarantinePath(batchId: string, assetId: string, filename: string) {
  return `mil/quarantine/${batchId}/${assetId}/${filename}`
}

async function requireUser(req: Request) {
  const authHeader = req.headers.get('Authorization') || ''
  const authClient = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: authHeader } },
  })
  const { data: { user }, error } = await authClient.auth.getUser()
  if (error || !user) return { error: true as const, status: 401, message: 'Sign in required' }
  return { user, authClient }
}

async function loadActiveSession(token: string) {
  const tokenHash = await sha256Hex(token)
  const { data, error } = await supabaseAdmin
    .from('mil_upload_sessions')
    .select('*')
    .eq('token_hash', tokenHash)
    .maybeSingle()
  if (error) throw error
  if (!data) return null
  if (data.revoked_at) return { session: data, active: false, reason: 'revoked' }
  if (new Date(data.expires_at).getTime() <= Date.now()) {
    return { session: data, active: false, reason: 'expired' }
  }
  return { session: data, active: true as const }
}

/** Storage catalog view as the edge sees it. Advisory: the database repeats this
 *  check inside the commit transaction and its answer is the authoritative one. */
async function catalogStat(bucket: string, objectPath: string) {
  const dir = objectPath.split('/').slice(0, -1).join('/')
  const leaf = objectPath.split('/').pop() as string
  const { data, error } = await supabaseAdmin.storage.from(bucket).list(dir, { limit: 100, search: leaf })
  if (error) return { available: false, present: false, bytes: null as number | null, mime: '' }
  const hit = (data || []).find((o) => o.name === leaf)
  if (!hit) return { available: true, present: false, bytes: null as number | null, mime: '' }
  const bytes = Number(hit.metadata?.size ?? hit.metadata?.contentLength ?? 0)
  const mime = String(hit.metadata?.mimetype || hit.metadata?.contentType || '').toLowerCase()
  return { available: true, present: true, bytes: Number.isFinite(bytes) ? bytes : null, mime }
}

function storageObjectExistsError(error: { message?: string; statusCode?: string } | null) {
  if (!error) return false
  const msg = String(error.message || '').toLowerCase()
  const code = String((error as { statusCode?: string }).statusCode || '')
  return code === '409' || msg.includes('already exists') || msg.includes('duplicate')
}

async function raiseIntegrityAlert(payload: {
  alertKey: string
  severity?: 'info' | 'warning' | 'critical'
  grantId?: string | null
  batchId?: string | null
  assetId?: string | null
  bucket?: string | null
  objectPath?: string | null
  details?: Record<string, unknown>
}) {
  const { error } = await supabaseAdmin.rpc('mil_raise_integrity_alert', {
    p_alert_key: payload.alertKey,
    p_severity: payload.severity || 'critical',
    p_grant_id: payload.grantId || null,
    p_batch_id: payload.batchId || null,
    p_asset_id: payload.assetId || null,
    p_bucket: payload.bucket || null,
    p_object_path: payload.objectPath || null,
    p_details: payload.details || {},
  })
  if (error) console.error('media-intel-upload-session integrity alert failed', error.message)
}

async function failGrant(grantId: string, leaseOwner: string, reason: string) {
  const { error } = await supabaseAdmin.rpc('mil_fail_upload_finalize', {
    p_grant_id: grantId,
    p_lease_owner: leaseOwner,
    p_reason: reason,
    p_release_lease: true,
  })
  if (error) console.error('media-intel-upload-session fail RPC error', error.message)
}

/**
 * Hand an indeterminate grant to the reconcile worker and stop waiting quickly.
 * The client is told "pending_reconcile" either way — a reconcile that did not
 * answer in time must never be reported as a completed upload.
 */
async function requestReconcile(grantId: string) {
  const url = Deno.env.get('SUPABASE_URL')
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  const reconcileKey = Deno.env.get('MIL_RECONCILE_KEY')
  if (!url || !serviceKey || !reconcileKey) {
    console.error('media-intel-upload-session reconcile not invoked: MIL_RECONCILE_KEY or runtime env missing')
    return { invoked: false, reason: 'reconcile_not_configured' }
  }
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), RECONCILE_INVOKE_TIMEOUT_MS)
  try {
    const res = await fetch(`${url}/functions/v1/media-intel-upload-reconcile`, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${serviceKey}`,
        'x-mil-reconcile-key': reconcileKey,
      },
      body: JSON.stringify({ action: 'grant', grantId }),
    })
    return { invoked: true, status: res.status }
  } catch (err) {
    console.error('media-intel-upload-session reconcile invoke failed', err instanceof Error ? err.message : err)
    return { invoked: false, reason: 'reconcile_unreachable' }
  } finally {
    clearTimeout(timer)
  }
}

Deno.serve(async (req) => {
  const cors = milCorsHeaders(req)
  if (req.method === 'OPTIONS') return milCorsPreflight(req)
  const json = (body: unknown, status = 200) => jsonWith(cors, body, status)

  try {
    const body = await req.json().catch(() => ({}))
    const action = String(body.action || '')

    if (action === 'create') {
      const auth = await requireUser(req)
      if ('error' in auth) return json({ error: auth.message }, auth.status)
      if (!(await isMilOwnerAdmin(auth.user.id))) {
        return json({ error: 'Only owner/admin may create upload sessions' }, 403)
      }

      const hours = Math.min(Math.max(Number(body.expiresHours) || 12, 1), 72)
      const token = randomToken()
      const tokenHash = await sha256Hex(token)
      const expiresAt = new Date(Date.now() + hours * 3600_000).toISOString()

      const { data: batch, error: batchErr } = await supabaseAdmin
        .from('mil_upload_batches')
        .insert({
          source_label: body.label || 'Phone upload session',
          source_phone: body.sourcePhone || null,
          source_person: body.sourcePerson || null,
          uploader_user_id: auth.user.id,
          status: 'open',
          client_session_key: `upload-session:${crypto.randomUUID()}`,
        })
        .select('*')
        .single()
      if (batchErr) throw batchErr

      const { data: session, error: sessErr } = await supabaseAdmin
        .from('mil_upload_sessions')
        .insert({
          batch_id: batch.id,
          token_hash: tokenHash,
          label: body.label || null,
          source_phone: body.sourcePhone || null,
          source_person: body.sourcePerson || null,
          created_by: auth.user.id,
          expires_at: expiresAt,
        })
        .select('*')
        .single()
      if (sessErr) throw sessErr

      await supabaseAdmin.from('mil_audit_events').insert({
        actor_user_id: auth.user.id,
        action: 'upload_session_created',
        target_type: 'mil_upload_sessions',
        target_id: session.id,
        details: { batchId: batch.id, expiresAt, hours },
      })

      // Token travels in a URL fragment (never a query string) so it is never sent to the
      // server in a request line, never captured by access/referrer logs, and never persisted
      // in browser history sync as a queryable param.
      return json({
        sessionId: session.id,
        batchId: batch.id,
        expiresAt,
        path: `/media/upload#session=${token}`,
        token,
        notice:
          'Keep phone originals until transfer is reconciled and an independent backup is confirmed. This link is upload-only and expires.',
      })
    }

    if (action === 'validate') {
      const token = String(body.token || '').trim()
      if (!token) return json({ error: 'Missing session token' }, 400)
      const loaded = await loadActiveSession(token)
      if (!loaded) return json({ error: 'Upload session not found', code: 'not_found' }, 404)
      if (!loaded.active) {
        return json({
          error: loaded.reason === 'revoked' ? 'This upload link was revoked.' : 'This upload link has expired.',
          code: loaded.reason,
        }, loaded.reason === 'revoked' ? 403 : 410)
      }

      await supabaseAdmin
        .from('mil_upload_sessions')
        .update({
          last_used_at: new Date().toISOString(),
          use_count: (loaded.session.use_count || 0) + 1,
        })
        .eq('id', loaded.session.id)

      const { data: batch } = await supabaseAdmin
        .from('mil_upload_batches')
        .select(
          'id, status, success_count, failed_count, skipped_count, duplicate_count, abandoned_count, source_label, started_at',
        )
        .eq('id', loaded.session.batch_id)
        .maybeSingle()

      return json({
        ok: true,
        scope: 'upload_only',
        sessionId: loaded.session.id,
        batchId: loaded.session.batch_id,
        expiresAt: loaded.session.expires_at,
        batch,
        capabilities: {
          upload: true,
          browseLibrary: false,
          downloadExisting: false,
          verifyAi: false,
          approve: false,
          crm: false,
        },
        notice:
          'Keep original media on the phone until this transfer is verified and an independent backup is confirmed.',
      })
    }

    if (action === 'mint_upload') {
      const token = String(body.token || '').trim()
      const filename = safeFilename(body.filename || 'file')
      const contentType = String(body.contentType || 'application/octet-stream').toLowerCase()
      const declaredBytes = Number(body.byteSize || 0)
      if (!token) return json({ error: 'Missing session token' }, 400)
      if (!ALLOWED_MIME.has(contentType)) {
        return json({ error: `Unsupported content type: ${contentType}` }, 400)
      }
      if (declaredBytes > MAX_UPLOAD_BYTES) {
        return json({ error: `File exceeds maximum allowed size (${Math.floor(MAX_UPLOAD_BYTES / (1024 * 1024))} MB)` }, 400)
      }

      const loaded = await loadActiveSession(token)
      if (!loaded?.active) {
        return json(
          { error: 'Upload session is not active', code: loaded?.reason || 'invalid' },
          loaded?.reason === 'expired' ? 410 : 403,
        )
      }

      // Session quotas — enforced server-side, not just documented client-side.
      const { count: totalGrants, error: totalErr } = await supabaseAdmin
        .from('mil_upload_grants')
        .select('id', { count: 'exact', head: true })
        .eq('session_id', loaded.session.id)
      if (totalErr) throw totalErr
      if ((totalGrants || 0) >= MAX_FILES_PER_SESSION) {
        return json({ error: `This session has reached its ${MAX_FILES_PER_SESSION}-file limit. Start a new session.` }, 400)
      }

      const { count: incompleteCount, error: incErr } = await supabaseAdmin
        .from('mil_upload_grants')
        .select('id', { count: 'exact', head: true })
        .eq('session_id', loaded.session.id)
        .in('finalize_state', ['minted', 'placing', 'placed'])
        .gt('expires_at', new Date().toISOString())
      if (incErr) throw incErr
      if ((incompleteCount || 0) >= MAX_CONCURRENT_INCOMPLETE_GRANTS) {
        return json({ error: 'Too many uploads in progress for this session. Finish or wait for one to expire before starting another.' }, 429)
      }

      const { data: existingGrants, error: sumErr } = await supabaseAdmin
        .from('mil_upload_grants')
        .select('max_bytes')
        .eq('session_id', loaded.session.id)
      if (sumErr) throw sumErr
      const cumulative = (existingGrants || []).reduce((sum, r) => sum + Number(r.max_bytes || 0), 0)
      const requestedMax = Math.min(declaredBytes > 0 ? declaredBytes : MAX_UPLOAD_BYTES, MAX_UPLOAD_BYTES)
      if (cumulative + requestedMax > MAX_CUMULATIVE_BYTES_PER_SESSION) {
        return json({ error: 'This session has reached its 5 GB cumulative upload quota. Start a new session.' }, 400)
      }

      const assetId = crypto.randomUUID()
      const objectPath = canonicalQuarantinePath(loaded.session.batch_id, assetId, filename)
      const grantExpires = new Date(Date.now() + GRANT_TTL_MS).toISOString()

      const { data: grant, error: grantErr } = await supabaseAdmin
        .from('mil_upload_grants')
        .insert({
          session_id: loaded.session.id,
          batch_id: loaded.session.batch_id,
          asset_id: assetId,
          object_path: objectPath,
          bucket: 'media-intel-originals',
          content_type: contentType,
          max_bytes: requestedMax,
          original_filename: filename,
          expires_at: grantExpires,
          finalize_state: 'minted',
        })
        .select('*')
        .single()
      if (grantErr) throw grantErr

      const { data: signed, error: signErr } = await supabaseAdmin.storage
        .from('media-intel-originals')
        .createSignedUploadUrl(objectPath)
      if (signErr) throw signErr

      // Record when the upload credential itself dies. Quarantine cleanup is
      // never scheduled before that instant plus a margin.
      const tokenExpiresAt = jwtExpiryIso(signed?.token)
      if (tokenExpiresAt) {
        await supabaseAdmin
          .from('mil_upload_grants')
          .update({ upload_token_expires_at: tokenExpiresAt })
          .eq('id', grant.id)
      }

      await supabaseAdmin.from('mil_audit_events').insert({
        actor_user_id: loaded.session.created_by,
        action: 'upload_session_mint',
        target_type: 'mil_upload_grants',
        target_id: grant.id,
        details: { sessionId: loaded.session.id, assetId, objectPath, contentType, tokenExpiresAt },
      })

      return json({
        grantId: grant.id,
        assetId,
        objectPath,
        bucket: 'media-intel-originals',
        token: signed?.token,
        path: signed?.path || objectPath,
        signedUrl: signed?.signedUrl,
        batchId: loaded.session.batch_id,
        expiresAt: grantExpires,
        uploadTokenExpiresAt: tokenExpiresAt,
        maxBytes: grant.max_bytes,
      })
    }

    if (action === 'complete_file') {
      const token = String(body.token || '').trim()
      if (!token) return json({ error: 'Missing session token' }, 400)
      const loaded = await loadActiveSession(token)
      if (!loaded) return json({ error: 'Upload session not found', code: 'not_found' }, 404)
      if (!loaded.active) {
        return loaded.reason === 'revoked'
          ? json({ error: 'This upload link was revoked.', code: 'revoked' }, 403)
          : json({ error: 'This upload link has expired.', code: 'expired' }, 410)
      }

      const grantId = String(body.grantId || '').trim()
      const assetId = String(body.assetId || '').trim()
      const objectPath = String(body.objectPath || '').trim()
      // Client checksum is ADVISORY ONLY (recorded for debugging/telemetry). The
      // asset checksum used for dedupe and stored on mil_assets is always the
      // server-computed digest of the bytes we actually downloaded below.
      const clientChecksum = String(body.checksumSha256 || '').trim().toLowerCase()
      if (!grantId || !assetId || !objectPath) {
        return json({ error: 'Missing grant fields' }, 400)
      }

      const { data: grant, error: grantErr } = await supabaseAdmin
        .from('mil_upload_grants')
        .select('*')
        .eq('id', grantId)
        .eq('session_id', loaded.session.id)
        .maybeSingle()
      if (grantErr) throw grantErr
      if (!grant) return json({ error: 'Upload grant not found for this session' }, 403)
      if (grant.asset_id !== assetId || grant.object_path !== objectPath) {
        return json({ error: 'Grant mismatch: asset or path does not match mint', code: 'integrity' }, 409)
      }
      if (grant.batch_id !== loaded.session.batch_id) {
        return json({ error: 'Grant batch mismatch', code: 'integrity' }, 409)
      }

      const expectedQuarantine = canonicalQuarantinePath(grant.batch_id, grant.asset_id, grant.original_filename)
      if (grant.object_path !== expectedQuarantine) {
        await raiseIntegrityAlert({
          alertKey: 'quarantine_path_not_canonical',
          grantId: grant.id,
          batchId: grant.batch_id,
          assetId: grant.asset_id,
          bucket: grant.bucket,
          objectPath: grant.object_path,
          details: { expected: expectedQuarantine },
        })
        return json({ error: 'Grant path is not a canonical quarantine path', code: 'integrity' }, 409)
      }

      const leaseOwner = `upload-session:${crypto.randomUUID()}`
      const { data: begun, error: beginErr } = await supabaseAdmin.rpc('mil_begin_upload_finalize', {
        p_grant_id: grant.id,
        p_lease_owner: leaseOwner,
        p_lease_seconds: FINALIZE_LEASE_SECONDS,
        p_commit_seconds: FINALIZE_COMMIT_SECONDS,
      })
      if (beginErr) throw beginErr

      if (!begun?.ok) {
        switch (begun?.status) {
          case 'lease_held':
            return json({
              status: 'in_progress',
              code: 'in_progress',
              error: 'This file is already being finalized. Wait a moment and check the manifest.',
            }, 409)
          case 'expired':
          case 'abandoned':
            return json({
              status: 'expired',
              code: 'expired',
              error: 'This upload grant expired before the transfer was confirmed. Keep the phone original and start a new upload.',
            }, 410)
          case 'revoked':
            return json({ status: 'revoked', code: 'revoked', error: 'This upload link was revoked.' }, 403)
          case 'grant_not_found':
            return json({ error: 'Upload grant not found for this session' }, 403)
          default:
            return json({ error: `Could not start finalization (${begun?.status || 'unknown'})`, code: 'retryable' }, 503)
        }
      }

      if (begun.status === 'already_committed') {
        return json({ status: 'uploaded', assetId: begun.asset_id, replay: true })
      }
      if (begun.status === 'already_duplicate') {
        return json({ status: 'duplicate', existingAssetId: begun.existing_asset_id, replay: true })
      }

      const bucket: string = begun.bucket
      const finalPath = canonicalOriginalPath(grant.batch_id, grant.asset_id, grant.original_filename)
      if (begun.final_object_path !== finalPath) {
        await failGrant(grant.id, leaseOwner, 'final_path_disagreement')
        await raiseIntegrityAlert({
          alertKey: 'final_path_disagreement',
          grantId: grant.id,
          batchId: grant.batch_id,
          assetId: grant.asset_id,
          bucket,
          objectPath: finalPath,
          details: { db: begun.final_object_path, edge: finalPath },
        })
        return json({ error: 'Final storage path could not be agreed', code: 'integrity' }, 409)
      }

      // ------------------------------------------------------------- placement
      if (begun.status !== 'resume_placed') {
        const stat = await catalogStat(bucket, grant.object_path)
        if (!stat.available) {
          await failGrant(grant.id, leaseOwner, 'quarantine_catalog_unavailable')
          return json({ error: 'Storage is not reachable right now. Try again.', code: 'retryable' }, 503)
        }
        if (!stat.present) {
          await failGrant(grant.id, leaseOwner, 'quarantine_object_missing')
          return json({
            error: 'The uploaded file is not in quarantine storage. Nothing was saved — upload it again.',
            code: 'integrity',
          }, 409)
        }
        if (!stat.bytes || stat.bytes <= 0) {
          await failGrant(grant.id, leaseOwner, 'quarantine_object_empty')
          return json({ error: 'Stored object has an invalid or missing size', code: 'integrity' }, 409)
        }
        if (stat.bytes > Number(grant.max_bytes)) {
          await failGrant(grant.id, leaseOwner, 'quarantine_object_exceeds_grant')
          return json({ error: 'Stored object exceeds grant size limit', code: 'integrity' }, 409)
        }
        if (!stat.mime || !ALLOWED_MIME.has(stat.mime)) {
          await failGrant(grant.id, leaseOwner, 'quarantine_mime_not_allowed')
          return json({ error: 'Stored object type is missing or not allowed', code: 'integrity' }, 409)
        }
        if (!mimeEquivalent(stat.mime, grant.content_type)) {
          await failGrant(grant.id, leaseOwner, 'quarantine_mime_mismatch')
          return json({
            error: `Stored object type (${stat.mime}) does not match the granted type (${grant.content_type})`,
            code: 'integrity',
          }, 409)
        }

        // Re-hash on every attempt. A retry must not inherit a previous attempt's
        // trust: the bytes under the grant path could have been replaced.
        const { data: blob, error: dlErr } = await supabaseAdmin.storage.from(bucket).download(grant.object_path)
        if (dlErr || !blob) {
          await failGrant(grant.id, leaseOwner, 'quarantine_download_failed')
          return json({ error: 'Could not read the stored object to verify it. Try again.', code: 'retryable' }, 503)
        }
        const bytes = new Uint8Array(await blob.arrayBuffer())
        if (!bytes.byteLength || bytes.byteLength > Number(grant.max_bytes)) {
          await failGrant(grant.id, leaseOwner, 'quarantine_size_verification_failed')
          return json({ error: 'Stored object size verification failed', code: 'integrity' }, 409)
        }
        const verifiedChecksum = await sha256Bytes(bytes)
        const verifiedMime = normalizeMime(stat.mime)

        if (begun.prior_verified_sha256 && begun.prior_verified_sha256 !== verifiedChecksum) {
          await raiseIntegrityAlert({
            alertKey: 'quarantine_bytes_changed',
            grantId: grant.id,
            batchId: grant.batch_id,
            assetId: grant.asset_id,
            bucket,
            objectPath: grant.object_path,
            details: { previous: begun.prior_verified_sha256, current: verifiedChecksum },
          })
          await failGrant(grant.id, leaseOwner, 'quarantine_bytes_changed')
          return json({
            error: 'The file in quarantine changed between attempts. Nothing was committed — upload it again.',
            code: 'bytes_changed',
          }, 409)
        }

        if (clientChecksum && clientChecksum !== verifiedChecksum) {
          await supabaseAdmin.from('mil_audit_events').insert({
            actor_user_id: loaded.session.created_by,
            action: 'upload_client_checksum_mismatch',
            target_type: 'mil_upload_grants',
            target_id: grant.id,
            details: { clientChecksum, verifiedChecksum },
          })
        }

        // Duplicate detection before placement: identical bytes must not be
        // written to a second final path.
        const { data: dup, error: dupErr } = await supabaseAdmin
          .from('mil_assets')
          .select('id, original_filename')
          .eq('checksum_sha256', verifiedChecksum)
          .is('archived_at', null)
          .limit(1)
          .maybeSingle()
        if (dupErr) throw dupErr

        if (dup) {
          const { data: dupCommit, error: dupCommitErr } = await supabaseAdmin.rpc('mil_commit_upload_finalize', {
            p_grant_id: grant.id,
            p_lease_owner: leaseOwner,
            p_outcome: 'duplicate',
            p_duplicate_asset_id: dup.id,
            p_verified_sha256: verifiedChecksum,
            p_verified_mime: verifiedMime,
            p_verified_bytes: bytes.byteLength,
          })
          if (dupCommitErr) throw dupCommitErr
          if (!dupCommit?.ok) {
            await failGrant(grant.id, leaseOwner, `duplicate_commit_rejected:${dupCommit?.status || 'unknown'}`)
            return json({ error: 'Duplicate could not be recorded', code: 'integrity' }, 409)
          }
          return json({ status: 'duplicate', existingAssetId: dupCommit.existing_asset_id })
        }

        // Place with upsert:false. One in-request retry, then hand off.
        let placed = false
        let placementError: string | null = null
        for (let attempt = 0; attempt < 2 && !placed; attempt += 1) {
          const up = await supabaseAdmin.storage
            .from(bucket)
            .upload(finalPath, bytes, { contentType: verifiedMime, upsert: false })
          if (!up.error) {
            placed = true
            break
          }
          if (storageObjectExistsError(up.error)) {
            // Something is already at the canonical path. It is only acceptable
            // if it is byte-identical to what we are placing (our own earlier
            // attempt); otherwise this is a collision a human must see.
            const { data: existingBlob, error: exErr } = await supabaseAdmin.storage.from(bucket).download(finalPath)
            if (exErr || !existingBlob) {
              placementError = 'final_object_exists_unreadable'
              break
            }
            const existingChecksum = await sha256Bytes(new Uint8Array(await existingBlob.arrayBuffer()))
            if (existingChecksum === verifiedChecksum) {
              placed = true
              break
            }
            await raiseIntegrityAlert({
              alertKey: 'final_path_occupied_by_different_bytes',
              grantId: grant.id,
              batchId: grant.batch_id,
              assetId: grant.asset_id,
              bucket,
              objectPath: finalPath,
              details: { expected: verifiedChecksum, found: existingChecksum },
            })
            await failGrant(grant.id, leaseOwner, 'final_path_occupied_by_different_bytes')
            return json({
              error: 'A different file already occupies the destination path. Nothing was overwritten.',
              code: 'integrity',
            }, 409)
          }
          placementError = up.error.message || 'placement_failed'
        }

        if (!placed) {
          // We may or may not have written bytes. Do not guess — record the
          // failure and let reconcile decide from the catalog.
          await failGrant(grant.id, leaseOwner, `placement_failed:${placementError || 'unknown'}`)
          const reconcile = await requestReconcile(grant.id)
          return json({
            status: 'pending_reconcile',
            code: 'pending_reconcile',
            grantId: grant.id,
            reconcileInvoked: reconcile.invoked,
            error: 'The file could not be confirmed in final storage yet. Keep the phone original; this transfer is being reconciled.',
          }, 202)
        }

        const { data: markResult, error: markErr } = await supabaseAdmin.rpc('mil_mark_upload_placed', {
          p_grant_id: grant.id,
          p_lease_owner: leaseOwner,
          p_final_object_path: finalPath,
          p_verified_sha256: verifiedChecksum,
          p_verified_mime: verifiedMime,
          p_verified_bytes: bytes.byteLength,
          p_lease_seconds: FINALIZE_LEASE_SECONDS,
        })
        if (markErr) throw markErr
        if (!markResult?.ok) {
          if (markResult?.status === 'bytes_changed') {
            return json({
              error: 'The file changed between attempts. Nothing was committed — upload it again.',
              code: 'bytes_changed',
            }, 409)
          }
          if (markResult?.status === 'lease_lost') {
            const reconcile = await requestReconcile(grant.id)
            return json({
              status: 'pending_reconcile',
              code: 'pending_reconcile',
              grantId: grant.id,
              reconcileInvoked: reconcile.invoked,
              error: 'Another worker took over this file. It is being reconciled.',
            }, 202)
          }
          await failGrant(grant.id, leaseOwner, `mark_placed_rejected:${markResult?.status || 'unknown'}`)
          return json({ error: `Placement could not be recorded (${markResult?.status || 'unknown'})`, code: 'integrity' }, 409)
        }
      }

      // ---------------------------------------------------------------- commit
      const finalStat = await catalogStat(bucket, finalPath)
      const { data: committed, error: commitErr } = await supabaseAdmin.rpc('mil_commit_upload_finalize', {
        p_grant_id: grant.id,
        p_lease_owner: leaseOwner,
        p_outcome: 'placed',
        p_catalog_present: finalStat.available ? finalStat.present : null,
        p_catalog_bytes: finalStat.bytes,
        p_catalog_mime: finalStat.mime || null,
      })
      if (commitErr) throw commitErr

      if (committed?.ok) {
        if (committed.status === 'already_duplicate') {
          return json({ status: 'duplicate', existingAssetId: committed.existing_asset_id, replay: true })
        }
        return json({
          status: 'uploaded',
          assetId: committed.asset_id,
          originalPath: committed.original_path,
          replay: committed.status === 'already_committed',
        })
      }

      switch (committed?.status) {
        case 'catalog_unavailable': {
          const reconcile = await requestReconcile(grant.id)
          return json({
            status: 'pending_reconcile',
            code: 'pending_reconcile',
            grantId: grant.id,
            reconcileInvoked: reconcile.invoked,
            error: 'Storage could not confirm the file yet. Keep the phone original; this transfer is being reconciled.',
          }, 202)
        }
        case 'catalog_absent':
        case 'catalog_mismatch':
          return json({
            error: 'The file could not be confirmed in final storage, so it was not added to the library. Keep the phone original.',
            code: 'integrity',
            grantId: grant.id,
          }, 409)
        case 'checksum_conflict':
          return json({
            error: 'Another upload committed the same file at the same moment. This copy was not added twice.',
            code: 'integrity',
            grantId: grant.id,
          }, 409)
        case 'lease_lost': {
          const reconcile = await requestReconcile(grant.id)
          return json({
            status: 'pending_reconcile',
            code: 'pending_reconcile',
            grantId: grant.id,
            reconcileInvoked: reconcile.invoked,
            error: 'Another worker took over this file. It is being reconciled.',
          }, 202)
        }
        default: {
          const reconcile = await requestReconcile(grant.id)
          return json({
            status: 'pending_reconcile',
            code: 'pending_reconcile',
            grantId: grant.id,
            reconcileInvoked: reconcile.invoked,
            error: `Finalization did not complete (${committed?.status || 'unknown'}). This transfer is being reconciled.`,
          }, 202)
        }
      }
    }

    if (action === 'manifest') {
      const token = String(body.token || '').trim()
      const loaded = await loadActiveSession(token)
      if (!loaded?.session) return json({ error: 'Not found' }, 404)
      if (!loaded.active) {
        return json(
          { error: 'Session inactive', code: loaded.reason },
          loaded.reason === 'revoked' ? 403 : 410,
        )
      }

      const [{ data: batch }, { data: entries }] = await Promise.all([
        supabaseAdmin.from('mil_upload_batches').select('*').eq('id', loaded.session.batch_id).single(),
        supabaseAdmin
          .from('mil_manifest_entries')
          .select('id, original_filename, byte_size, checksum_sha256, upload_status, duplicate_status, error_message, created_at')
          .eq('batch_id', loaded.session.batch_id)
          .order('created_at', { ascending: true }),
      ])

      // Grants still mid-lifecycle are reported as pending rather than folded
      // into a success/failure count.
      const { count: pendingCount } = await supabaseAdmin
        .from('mil_upload_grants')
        .select('id', { count: 'exact', head: true })
        .eq('batch_id', loaded.session.batch_id)
        .in('finalize_state', ['minted', 'placing', 'placed'])

      return json({ batch, entries: entries || [], pendingCount: pendingCount || 0 })
    }

    if (action === 'revoke') {
      const auth = await requireUser(req)
      if ('error' in auth) return json({ error: auth.message }, auth.status)
      if (!(await isMilOwnerAdmin(auth.user.id))) return json({ error: 'Forbidden' }, 403)
      const sessionId = String(body.sessionId || '')
      const { error } = await supabaseAdmin
        .from('mil_upload_sessions')
        .update({ revoked_at: new Date().toISOString() })
        .eq('id', sessionId)
      if (error) throw error
      await supabaseAdmin.from('mil_audit_events').insert({
        actor_user_id: auth.user.id,
        action: 'upload_session_revoked',
        target_type: 'mil_upload_sessions',
        target_id: sessionId,
        details: {},
      })
      return json({ ok: true })
    }

    if (action === 'list') {
      const auth = await requireUser(req)
      if ('error' in auth) return json({ error: auth.message }, auth.status)
      if (!(await isMilOwnerAdmin(auth.user.id))) return json({ error: 'Forbidden' }, 403)
      const { data, error } = await supabaseAdmin
        .from('mil_upload_sessions')
        .select('id, batch_id, label, source_phone, source_person, expires_at, revoked_at, last_used_at, use_count, created_at')
        .order('created_at', { ascending: false })
        .limit(50)
      if (error) throw error
      return json({ sessions: data || [] })
    }

    return json({ error: 'Unknown action' }, 400)
  } catch (error) {
    // Never log request bodies here — tokens must never reach logs.
    console.error('media-intel-upload-session', error instanceof Error ? error.message : error)
    return json({ error: error instanceof Error ? error.message : 'Session error' }, 500)
  }
})

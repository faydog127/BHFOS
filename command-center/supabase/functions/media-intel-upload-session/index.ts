/**
 * Scoped phone upload sessions (single-company).
 * Opaque token hash only; completion bound to server-minted grants; server
 * re-verifies every stored object (size/MIME/checksum) before an asset is
 * ever created — client-declared values are advisory only.
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
function mimeEquivalent(a: string, b: string) {
  const norm = (m: string) => (m === 'image/jpg' ? 'image/jpeg' : m)
  return norm(a) === norm(b)
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
        }, 403)
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
        .select('id, status, success_count, failed_count, skipped_count, duplicate_count, source_label, started_at')
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
        return json({ error: 'Upload session is not active', code: loaded?.reason || 'invalid' }, 403)
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
        .is('completed_at', null)
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
      const objectPath = `mil/quarantine/${loaded.session.batch_id}/${assetId}/${filename}`
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
        })
        .select('*')
        .single()
      if (grantErr) throw grantErr

      const { data: signed, error: signErr } = await supabaseAdmin.storage
        .from('media-intel-originals')
        .createSignedUploadUrl(objectPath)
      if (signErr) throw signErr

      await supabaseAdmin.from('mil_audit_events').insert({
        actor_user_id: loaded.session.created_by,
        action: 'upload_session_mint',
        target_type: 'mil_upload_grants',
        target_id: grant.id,
        details: { sessionId: loaded.session.id, assetId, objectPath, contentType },
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
        maxBytes: grant.max_bytes,
      })
    }

    if (action === 'complete_file') {
      const token = String(body.token || '').trim()
      const loaded = await loadActiveSession(token)
      if (!loaded?.active) return json({ error: 'Upload session is not active' }, 403)

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
      if (grant.completed_at) return json({ error: 'Upload grant already completed', code: 'replay' }, 409)
      if (new Date(grant.expires_at).getTime() <= Date.now()) {
        return json({ error: 'Upload grant expired' }, 403)
      }
      if (grant.asset_id !== assetId || grant.object_path !== objectPath) {
        return json({ error: 'Grant mismatch: asset or path does not match mint' }, 403)
      }
      if (grant.batch_id !== loaded.session.batch_id) {
        return json({ error: 'Grant batch mismatch' }, 403)
      }
      if (!String(grant.object_path).startsWith('mil/quarantine/')) {
        return json({ error: 'Grant path is not a quarantine path' }, 400)
      }

      const quarantineDir = grant.object_path.split('/').slice(0, -1).join('/')
      const leaf = grant.object_path.split('/').pop() as string
      const { data: listed, error: listErr } = await supabaseAdmin.storage
        .from(grant.bucket)
        .list(quarantineDir, { limit: 10, search: leaf })
      if (listErr) throw listErr
      const meta = (listed || []).find((o) => o.name === leaf)
      if (!meta) return json({ error: 'Uploaded object not found for grant path' }, 400)

      const declaredSize = Number(meta.metadata?.size ?? meta.metadata?.contentLength ?? 0)
      if (!declaredSize || declaredSize <= 0) {
        await supabaseAdmin.storage.from(grant.bucket).remove([grant.object_path]).catch(() => {})
        return json({ error: 'Stored object has an invalid or missing size' }, 400)
      }
      if (declaredSize > Number(grant.max_bytes)) {
        await supabaseAdmin.storage.from(grant.bucket).remove([grant.object_path]).catch(() => {})
        return json({ error: 'Stored object exceeds grant size limit' }, 400)
      }

      const storedMime = String(meta.metadata?.mimetype || meta.metadata?.contentType || '').toLowerCase()
      if (!storedMime || !ALLOWED_MIME.has(storedMime)) {
        await supabaseAdmin.storage.from(grant.bucket).remove([grant.object_path]).catch(() => {})
        return json({ error: 'Stored object type is missing or not allowed' }, 400)
      }
      if (!mimeEquivalent(storedMime, grant.content_type)) {
        await supabaseAdmin.storage.from(grant.bucket).remove([grant.object_path]).catch(() => {})
        return json({ error: `Stored object type (${storedMime}) does not match the granted type (${grant.content_type})` }, 400)
      }

      // Download the quarantined bytes once: authoritative size + SHA-256. Bounded by
      // MAX_UPLOAD_BYTES (250 MB default) — see file header honesty note.
      const { data: blob, error: dlErr } = await supabaseAdmin.storage
        .from(grant.bucket)
        .download(grant.object_path)
      if (dlErr || !blob) {
        return json({ error: 'Could not read stored object to verify it' }, 500)
      }
      const bytes = new Uint8Array(await blob.arrayBuffer())
      if (!bytes.byteLength || bytes.byteLength > Number(grant.max_bytes)) {
        await supabaseAdmin.storage.from(grant.bucket).remove([grant.object_path]).catch(() => {})
        return json({ error: 'Stored object size verification failed' }, 400)
      }
      const verifiedChecksum = bytesToHex(await crypto.subtle.digest('SHA-256', bytes))

      const { data: dup } = await supabaseAdmin
        .from('mil_assets')
        .select('id, original_filename')
        .eq('checksum_sha256', verifiedChecksum)
        .is('archived_at', null)
        .limit(1)
        .maybeSingle()

      const { data: finalizeResult, error: finalizeErr } = await supabaseAdmin.rpc('mil_finalize_upload_grant', {
        p_grant_id: grant.id,
        p_verified_checksum: verifiedChecksum,
        p_stored_mime: storedMime,
        p_stored_bytes: bytes.byteLength,
        p_is_duplicate: Boolean(dup),
        p_duplicate_asset_id: dup?.id || null,
      })
      if (finalizeErr) throw finalizeErr
      if (!finalizeResult?.ok) {
        return json({ error: finalizeResult?.error || 'Upload finalize failed' }, 400)
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

      if (finalizeResult.status === 'already_completed') {
        return json({ status: 'uploaded', assetId: finalizeResult.asset_id, replay: true })
      }

      if (finalizeResult.status === 'duplicate') {
        await supabaseAdmin.storage.from(grant.bucket).remove([grant.object_path]).catch(() => {})
        return json({ status: 'duplicate', existingAssetId: finalizeResult.existing_asset_id })
      }

      // status === 'uploaded': move verified bytes from quarantine to the final path
      // the RPC computed, then remove the quarantine copy. If the move fails, the DB
      // already recorded the asset — do NOT delete quarantine bytes (keep them for
      // recovery) and report the failure honestly instead of a false success.
      const finalPath = String(finalizeResult.original_path || '')
      const moveUp = await supabaseAdmin.storage
        .from(grant.bucket)
        .upload(finalPath, bytes, { contentType: storedMime, upsert: false })
      if (moveUp.error) {
        await supabaseAdmin
          .from('mil_assets')
          .update({ processing_status: 'processing_failed' })
          .eq('id', finalizeResult.asset_id)
        await supabaseAdmin.from('mil_audit_events').insert({
          actor_user_id: loaded.session.created_by,
          action: 'upload_finalize_storage_move_failed',
          target_type: 'mil_assets',
          target_id: finalizeResult.asset_id,
          details: { grantId: grant.id, finalPath, error: moveUp.error.message },
        })
        return json({
          error: 'Upload was verified but could not be placed in final storage. The original is retained in quarantine; support has been notified.',
          assetId: finalizeResult.asset_id,
        }, 500)
      }

      await supabaseAdmin.storage.from(grant.bucket).remove([grant.object_path]).catch((err) => {
        console.error('media-intel-upload-session quarantine cleanup failed', err)
      })

      return json({ status: 'uploaded', assetId: finalizeResult.asset_id })
    }

    if (action === 'manifest') {
      const token = String(body.token || '').trim()
      const loaded = await loadActiveSession(token)
      if (!loaded?.session) return json({ error: 'Not found' }, 404)
      if (!loaded.active) return json({ error: 'Session inactive', code: loaded.reason }, 403)

      const [{ data: batch }, { data: entries }] = await Promise.all([
        supabaseAdmin.from('mil_upload_batches').select('*').eq('id', loaded.session.batch_id).single(),
        supabaseAdmin
          .from('mil_manifest_entries')
          .select('id, original_filename, byte_size, checksum_sha256, upload_status, duplicate_status, error_message, created_at')
          .eq('batch_id', loaded.session.batch_id)
          .order('created_at', { ascending: true }),
      ])
      return json({ batch, entries: entries || [] })
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

/**
 * Scoped phone upload sessions (single-company).
 * Opaque token hash only; completion bound to server-minted grants.
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4'
import { corsHeaders } from '../_shared/cors.ts'
import { supabaseAdmin } from '../_shared/supabaseAdmin.ts'

const MAX_UPLOAD_BYTES = 2 * 1024 * 1024 * 1024
const GRANT_TTL_MS = 60 * 60 * 1000
const ALLOWED_MIME = new Set([
  'image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/heic', 'image/heif', 'image/gif',
  'video/mp4', 'video/quicktime', 'video/webm', 'video/x-m4v',
])

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })

async function sha256Hex(value: string) {
  const data = new TextEncoder().encode(value)
  const digest = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

function randomToken() {
  const bytes = new Uint8Array(32)
  crypto.getRandomValues(bytes)
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('')
}

function normalizeRole(role: string) {
  const r = role.toLowerCase().trim()
  if (['admin', 'super_admin', 'owner'].includes(r)) return 'admin'
  if (r === 'manager') return 'manager'
  return r
}

function safeFilename(name: string) {
  return String(name || 'file')
    .replace(/[/\\?%*:|"<>]/g, '_')
    .replace(/\.\./g, '_')
    .slice(0, 180) || 'file'
}

async function requireUser(req: Request) {
  const authHeader = req.headers.get('Authorization') || ''
  const authClient = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: authHeader } },
  })
  const { data: { user }, error } = await authClient.auth.getUser()
  if (error || !user) return { error: json({ error: 'Sign in required' }, 401) }
  return { user, authClient }
}

async function isOwnerAdmin(userId: string) {
  const { data } = await supabaseAdmin
    .from('app_user_roles')
    .select('role')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  const role = normalizeRole(String(data?.role || ''))
  return role === 'admin' || role === 'manager'
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
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  try {
    const body = await req.json().catch(() => ({}))
    const action = String(body.action || '')

    if (action === 'create') {
      const auth = await requireUser(req)
      if ('error' in auth) return auth.error
      if (!(await isOwnerAdmin(auth.user.id))) {
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

      return json({
        sessionId: session.id,
        batchId: batch.id,
        expiresAt,
        path: `/media/upload?session=${token}`,
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
        return json({ error: 'File exceeds maximum allowed size' }, 400)
      }

      const loaded = await loadActiveSession(token)
      if (!loaded?.active) {
        return json({ error: 'Upload session is not active', code: loaded?.reason || 'invalid' }, 403)
      }

      const assetId = crypto.randomUUID()
      const objectPath = `mil/uploads/${loaded.session.batch_id}/originals/${assetId}/${filename}`
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
          max_bytes: Math.min(declaredBytes > 0 ? declaredBytes : MAX_UPLOAD_BYTES, MAX_UPLOAD_BYTES),
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
      const checksum = String(body.checksumSha256 || '').trim().toLowerCase()
      if (!grantId || !assetId || !objectPath || !checksum) {
        return json({ error: 'Missing grant fields' }, 400)
      }
      if (!/^[a-f0-9]{64}$/.test(checksum)) {
        return json({ error: 'Invalid checksum' }, 400)
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

      const { data: listed, error: listErr } = await supabaseAdmin.storage
        .from(grant.bucket)
        .list(`mil/uploads/${grant.batch_id}/originals/${grant.asset_id}`, { limit: 20 })
      if (listErr) throw listErr
      const leaf = grant.object_path.split('/').pop()
      const meta = (listed || []).find((o) => o.name === leaf)
      if (!meta) return json({ error: 'Uploaded object not found for grant path' }, 400)
      const storedSize = Number(meta.metadata?.size ?? meta.metadata?.contentLength ?? 0)
      if (storedSize > 0 && storedSize > Number(grant.max_bytes)) {
        await supabaseAdmin.storage.from(grant.bucket).remove([grant.object_path])
        return json({ error: 'Stored object exceeds grant size limit' }, 400)
      }
      const storedType = String(meta.metadata?.mimetype || meta.metadata?.contentType || grant.content_type).toLowerCase()
      if (!ALLOWED_MIME.has(storedType) && !ALLOWED_MIME.has(grant.content_type)) {
        await supabaseAdmin.storage.from(grant.bucket).remove([grant.object_path])
        return json({ error: 'Stored object type not allowed' }, 400)
      }

      const mime = ALLOWED_MIME.has(storedType) ? storedType : grant.content_type
      const byteSize = storedSize > 0 ? storedSize : Number(body.byteSize || 0)

      const { data: dup } = await supabaseAdmin
        .from('mil_assets')
        .select('id, original_filename')
        .eq('checksum_sha256', checksum)
        .is('archived_at', null)
        .limit(1)
        .maybeSingle()

      if (dup) {
        await supabaseAdmin.from('mil_manifest_entries').insert({
          batch_id: grant.batch_id,
          asset_id: dup.id,
          original_filename: grant.original_filename,
          mime_type: mime,
          byte_size: byteSize,
          checksum_sha256: checksum,
          upload_status: 'duplicate',
          duplicate_status: 'exact',
        })
        // Only delete the verified grant path
        await supabaseAdmin.storage.from(grant.bucket).remove([grant.object_path])
        await supabaseAdmin
          .from('mil_upload_grants')
          .update({ completed_at: new Date().toISOString() })
          .eq('id', grant.id)
          .is('completed_at', null)
        return json({ status: 'duplicate', existingAssetId: dup.id })
      }

      const mediaKind = mime.startsWith('video/') ? 'video' : mime.startsWith('image/') ? 'photo' : 'other'
      const { error: assetErr } = await supabaseAdmin.from('mil_assets').insert({
        id: grant.asset_id,
        batch_id: grant.batch_id,
        media_kind: mediaKind,
        mime_type: mime,
        byte_size: byteSize,
        checksum_sha256: checksum,
        original_filename: grant.original_filename,
        original_bucket: grant.bucket,
        original_path: grant.object_path,
        processing_status: 'queued',
        human_review_status: 'pending',
        privacy_status: 'needs_review',
        created_by_user_id: loaded.session.created_by,
      })
      if (assetErr) throw assetErr

      await supabaseAdmin.from('mil_manifest_entries').insert({
        batch_id: grant.batch_id,
        asset_id: grant.asset_id,
        original_filename: grant.original_filename,
        mime_type: mime,
        byte_size: byteSize,
        checksum_sha256: checksum,
        upload_status: 'uploaded',
        processing_status: 'queued',
      })

      await supabaseAdmin.from('mil_processing_jobs').insert({
        asset_id: grant.asset_id,
        batch_id: grant.batch_id,
        job_type: 'ai_analyze',
        status: 'queued',
      })

      const { data: marked, error: markErr } = await supabaseAdmin
        .from('mil_upload_grants')
        .update({ completed_at: new Date().toISOString() })
        .eq('id', grant.id)
        .is('completed_at', null)
        .select('id')
        .maybeSingle()
      if (markErr) throw markErr
      if (!marked) return json({ error: 'Upload grant already completed', code: 'replay' }, 409)

      await supabaseAdmin.from('mil_audit_events').insert({
        actor_user_id: loaded.session.created_by,
        action: 'upload',
        target_type: 'mil_assets',
        target_id: grant.asset_id,
        details: {
          via: 'upload_session',
          batchId: grant.batch_id,
          sessionId: loaded.session.id,
          grantId: grant.id,
        },
      })

      return json({ status: 'uploaded', assetId: grant.asset_id })
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
      if ('error' in auth) return auth.error
      if (!(await isOwnerAdmin(auth.user.id))) return json({ error: 'Forbidden' }, 403)
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
      if ('error' in auth) return auth.error
      if (!(await isOwnerAdmin(auth.user.id))) return json({ error: 'Forbidden' }, 403)
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
    console.error('media-intel-upload-session', error)
    return json({ error: error instanceof Error ? error.message : 'Session error' }, 500)
  }
})

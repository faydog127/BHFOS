/**
 * Scoped phone upload sessions (single-company).
 * Opaque token hash only; no tenant identity.
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4'
import { corsHeaders } from '../_shared/cors.ts'
import { supabaseAdmin } from '../_shared/supabaseAdmin.ts'

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
      const filename = String(body.filename || 'file').replace(/[/\\?%*:|"<>]/g, '_').slice(0, 180)
      const contentType = String(body.contentType || 'application/octet-stream')
      const assetId = String(body.assetId || crypto.randomUUID())
      if (!token) return json({ error: 'Missing session token' }, 400)

      const loaded = await loadActiveSession(token)
      if (!loaded?.active) {
        return json({ error: 'Upload session is not active', code: loaded?.reason || 'invalid' }, 403)
      }

      const objectPath = `mil/uploads/${loaded.session.batch_id}/originals/${assetId}/${filename}`
      const { data: signed, error: signErr } = await supabaseAdmin.storage
        .from('media-intel-originals')
        .createSignedUploadUrl(objectPath)
      if (signErr) throw signErr

      await supabaseAdmin.from('mil_audit_events').insert({
        actor_user_id: loaded.session.created_by,
        action: 'upload_session_mint',
        target_type: 'mil_upload_sessions',
        target_id: loaded.session.id,
        details: { assetId, objectPath, contentType },
      })

      return json({
        assetId,
        objectPath,
        bucket: 'media-intel-originals',
        token: signed?.token,
        path: signed?.path || objectPath,
        signedUrl: signed?.signedUrl,
        batchId: loaded.session.batch_id,
      })
    }

    if (action === 'complete_file') {
      const token = String(body.token || '').trim()
      const loaded = await loadActiveSession(token)
      if (!loaded?.active) return json({ error: 'Upload session is not active' }, 403)

      const batchId = loaded.session.batch_id
      const assetId = String(body.assetId || '')
      const objectPath = String(body.objectPath || '')
      const checksum = String(body.checksumSha256 || '')
      const mime = String(body.mimeType || 'application/octet-stream')
      const byteSize = Number(body.byteSize || 0)
      const originalFilename = String(body.originalFilename || 'file')
      if (!assetId || !objectPath || !checksum) return json({ error: 'Missing file fields' }, 400)
      if (!objectPath.startsWith('mil/')) return json({ error: 'Invalid storage path' }, 400)

      const { data: dup } = await supabaseAdmin
        .from('mil_assets')
        .select('id, original_filename')
        .eq('checksum_sha256', checksum)
        .is('archived_at', null)
        .limit(1)
        .maybeSingle()

      if (dup) {
        await supabaseAdmin.from('mil_manifest_entries').insert({
          batch_id: batchId,
          asset_id: dup.id,
          original_filename: originalFilename,
          mime_type: mime,
          byte_size: byteSize,
          checksum_sha256: checksum,
          upload_status: 'duplicate',
          duplicate_status: 'exact',
        })
        await supabaseAdmin.storage.from('media-intel-originals').remove([objectPath])
        return json({ status: 'duplicate', existingAssetId: dup.id })
      }

      const mediaKind = mime.startsWith('video/') ? 'video' : mime.startsWith('image/') ? 'photo' : 'other'
      const { error: assetErr } = await supabaseAdmin.from('mil_assets').insert({
        id: assetId,
        batch_id: batchId,
        media_kind: mediaKind,
        mime_type: mime,
        byte_size: byteSize,
        checksum_sha256: checksum,
        original_filename: originalFilename,
        original_bucket: 'media-intel-originals',
        original_path: objectPath,
        processing_status: 'queued',
        human_review_status: 'pending',
        privacy_status: 'needs_review',
        created_by_user_id: loaded.session.created_by,
      })
      if (assetErr) throw assetErr

      await supabaseAdmin.from('mil_manifest_entries').insert({
        batch_id: batchId,
        asset_id: assetId,
        original_filename: originalFilename,
        mime_type: mime,
        byte_size: byteSize,
        checksum_sha256: checksum,
        upload_status: 'uploaded',
        processing_status: 'queued',
      })

      await supabaseAdmin.from('mil_processing_jobs').insert({
        asset_id: assetId,
        batch_id: batchId,
        job_type: 'ai_analyze',
        status: 'queued',
      })

      await supabaseAdmin.from('mil_audit_events').insert({
        actor_user_id: loaded.session.created_by,
        action: 'upload',
        target_type: 'mil_assets',
        target_id: assetId,
        details: { via: 'upload_session', batchId, sessionId: loaded.session.id },
      })

      return json({ status: 'uploaded', assetId })
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

/**
 * Server-minted reel upload grants (single-company).
 *
 * Creators must NOT write storage directly under mil/reels/% (see
 * 20260725140000_media_intel_pre_staging_hardening.sql — that migration
 * dropped the broad "creator reel upload" storage policy). This function is
 * the replacement path: mint a scoped, one-time upload grant into a
 * quarantine path, then verify + move on completion, exactly like the phone
 * upload-session flow for originals.
 *
 * FK note: mil_reel_upload_grants.version_id is NOT NULL, so the
 * mil_reel_versions row is always created first (as a draft with its
 * anticipated quarantine path), then the grant references it.
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4'
import { milCorsHeaders, milCorsPreflight } from '../_shared/milCors.ts'
import { supabaseAdmin } from '../_shared/supabaseAdmin.ts'
import { isMilCreator, isMilOwnerAdmin } from '../_shared/milRoles.ts'

function envInt(name: string, fallback: number) {
  const raw = Deno.env.get(name)
  if (!raw) return fallback
  const n = Number(raw)
  return Number.isFinite(n) && n > 0 ? n : fallback
}

const MAX_REEL_BYTES = envInt('MIL_MAX_REEL_BYTES', 250 * 1024 * 1024)
const GRANT_TTL_MS = 60 * 60 * 1000
const REEL_ALLOWED_MIME = new Set(['video/mp4', 'video/quicktime', 'video/webm', 'video/x-m4v'])

function bytesToHex(digest: ArrayBuffer) {
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('')
}

async function creatorAssignedToCollection(userId: string, collectionId: string) {
  const { data } = await supabaseAdmin
    .from('mil_creator_assignments')
    .select('id')
    .eq('creator_user_id', userId)
    .eq('collection_id', collectionId)
    .eq('status', 'active')
    .is('revoked_at', null)
    .maybeSingle()
  return Boolean(data)
}

Deno.serve(async (req) => {
  const cors = milCorsHeaders(req)
  if (req.method === 'OPTIONS') return milCorsPreflight(req)
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } })

  try {
    const authHeader = req.headers.get('Authorization') || ''
    const authClient = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authHeader } },
    })
    const { data: { user }, error: authError } = await authClient.auth.getUser()
    if (authError || !user) return json({ error: 'Sign in required' }, 401)

    const [isCreator, isOwnerAdmin] = await Promise.all([
      isMilCreator(user.id),
      isMilOwnerAdmin(user.id),
    ])
    if (!isCreator && !isOwnerAdmin) return json({ error: 'Only reel creators (or owner/admin) may upload reels' }, 403)

    const body = await req.json().catch(() => ({}))
    // Accept both the canonical action names and the short mint/complete aliases
    // already wired into src/pages/crm/media/MediaCreatorWorkspace.jsx.
    const rawAction = String(body.action || '')
    const action = rawAction === 'mint' ? 'mint_reel_grant' : rawAction === 'complete' ? 'complete_reel' : rawAction

    if (action === 'mint_reel_grant') {
      const contentType = String(body.contentType || 'video/mp4').toLowerCase()
      const declaredBytes = Number(body.byteSize || 0)
      const notes = body.creatorNotes ? String(body.creatorNotes) : (body.notes ? String(body.notes) : null)
      if (!REEL_ALLOWED_MIME.has(contentType)) {
        return json({ error: `Unsupported reel content type: ${contentType}` }, 400)
      }
      if (declaredBytes > MAX_REEL_BYTES) {
        return json({ error: `Reel exceeds maximum allowed size (${Math.floor(MAX_REEL_BYTES / (1024 * 1024))} MB)` }, 400)
      }

      let projectId = body.projectId ? String(body.projectId).trim() : null
      let project: { id: string; creator_user_id: string; collection_id: string | null } | null = null

      if (projectId) {
        const { data: existing, error: projErr } = await supabaseAdmin
          .from('mil_reel_projects')
          .select('id, creator_user_id, collection_id')
          .eq('id', projectId)
          .maybeSingle()
        if (projErr) throw projErr
        if (!existing) return json({ error: 'Reel project not found' }, 404)
        if (isCreator && !isOwnerAdmin && existing.creator_user_id !== user.id) {
          return json({ error: 'This reel project belongs to another creator.' }, 403)
        }
        project = existing
      } else {
        const title = String(body.title || 'Untitled reel').trim().slice(0, 200) || 'Untitled reel'
        const creatorUserId = isCreator ? user.id : String(body.creatorUserId || user.id)
        const collectionId = body.collectionId ? String(body.collectionId).trim() : null
        const { data: created, error: createErr } = await supabaseAdmin
          .from('mil_reel_projects')
          .insert({ title, creator_user_id: creatorUserId, collection_id: collectionId, status: 'creator_draft' })
          .select('id, creator_user_id, collection_id')
          .single()
        if (createErr) throw createErr
        project = created
        projectId = created.id
      }

      // Validate collection assignment when the project is tied to a source collection —
      // eligibility to browse assigned assets does not by itself authorize reel creation
      // outside that assignment.
      if (project.collection_id && isCreator && !isOwnerAdmin) {
        const ok = await creatorAssignedToCollection(user.id, project.collection_id)
        if (!ok) return json({ error: 'You are not assigned to this collection.' }, 403)
      }

      const { data: existingVersions, error: verErr } = await supabaseAdmin
        .from('mil_reel_versions')
        .select('version_number')
        .eq('project_id', projectId)
        .order('version_number', { ascending: false })
        .limit(1)
      if (verErr) throw verErr
      const nextVersionNumber = (existingVersions?.[0]?.version_number || 0) + 1

      const versionId = crypto.randomUUID()
      const quarantinePath = `mil/quarantine/reels/${projectId}/${versionId}.mp4`

      const { data: version, error: insVerErr } = await supabaseAdmin
        .from('mil_reel_versions')
        .insert({
          id: versionId,
          project_id: projectId,
          version_number: nextVersionNumber,
          status: 'creator_draft',
          storage_bucket: 'media-intel-derivatives',
          storage_path: quarantinePath,
          mime_type: contentType,
          creator_notes: notes,
        })
        .select('*')
        .single()
      if (insVerErr) throw insVerErr

      const grantExpires = new Date(Date.now() + GRANT_TTL_MS).toISOString()
      const { data: grant, error: grantErr } = await supabaseAdmin
        .from('mil_reel_upload_grants')
        .insert({
          creator_user_id: isCreator ? user.id : project.creator_user_id,
          project_id: projectId,
          version_id: versionId,
          version_number: nextVersionNumber,
          object_path: quarantinePath,
          bucket: 'media-intel-derivatives',
          content_type: contentType,
          max_bytes: Math.min(declaredBytes > 0 ? declaredBytes : MAX_REEL_BYTES, MAX_REEL_BYTES),
          expires_at: grantExpires,
        })
        .select('*')
        .single()
      if (grantErr) throw grantErr

      const { data: signed, error: signErr } = await supabaseAdmin.storage
        .from('media-intel-derivatives')
        .createSignedUploadUrl(quarantinePath)
      if (signErr) throw signErr

      await supabaseAdmin.from('mil_audit_events').insert({
        actor_user_id: user.id,
        action: 'reel_upload_grant_minted',
        target_type: 'mil_reel_upload_grants',
        target_id: grant.id,
        details: { projectId, versionId, versionNumber: nextVersionNumber, quarantinePath },
      })

      return json({
        grantId: grant.id,
        projectId,
        versionId,
        versionNumber: nextVersionNumber,
        objectPath: quarantinePath,
        bucket: 'media-intel-derivatives',
        token: signed?.token,
        path: signed?.path || quarantinePath,
        signedUrl: signed?.signedUrl,
        expiresAt: grantExpires,
        maxBytes: grant.max_bytes,
      })
    }

    if (action === 'complete_reel') {
      const grantId = String(body.grantId || '').trim()
      if (!grantId) return json({ error: 'Missing grantId' }, 400)

      const { data: grant, error: grantErr } = await supabaseAdmin
        .from('mil_reel_upload_grants')
        .select('*')
        .eq('id', grantId)
        .maybeSingle()
      if (grantErr) throw grantErr
      if (!grant) return json({ error: 'Reel upload grant not found' }, 404)
      if (isCreator && !isOwnerAdmin && grant.creator_user_id !== user.id) {
        return json({ error: 'This grant belongs to another creator.' }, 403)
      }
      const claimedVersionId = body.versionId ? String(body.versionId).trim() : ''
      if (claimedVersionId && claimedVersionId !== grant.version_id) {
        return json({ error: 'Grant mismatch: versionId does not match this grant' }, 403)
      }
      if (grant.completed_at) return json({ error: 'Reel upload grant already completed', code: 'replay' }, 409)
      if (new Date(grant.expires_at).getTime() <= Date.now()) {
        return json({ error: 'Reel upload grant expired' }, 403)
      }
      if (!String(grant.object_path).startsWith('mil/quarantine/reels/')) {
        return json({ error: 'Grant path is not a quarantine reel path' }, 400)
      }

      const dir = grant.object_path.split('/').slice(0, -1).join('/')
      const leaf = grant.object_path.split('/').pop() as string
      const { data: listed, error: listErr } = await supabaseAdmin.storage
        .from(grant.bucket)
        .list(dir, { limit: 10, search: leaf })
      if (listErr) throw listErr
      const meta = (listed || []).find((o) => o.name === leaf)
      if (!meta) return json({ error: 'Uploaded reel object not found for grant path' }, 400)

      const declaredSize = Number(meta.metadata?.size ?? meta.metadata?.contentLength ?? 0)
      if (!declaredSize || declaredSize <= 0 || declaredSize > Number(grant.max_bytes)) {
        return json({ error: 'Stored reel object has an invalid size or exceeds the grant limit' }, 400)
      }
      const storedMime = String(meta.metadata?.mimetype || meta.metadata?.contentType || '').toLowerCase()
      if (!storedMime || (!REEL_ALLOWED_MIME.has(storedMime) && storedMime !== grant.content_type)) {
        return json({ error: 'Stored reel object type is missing or not allowed' }, 400)
      }

      const { data: blob, error: dlErr } = await supabaseAdmin.storage.from(grant.bucket).download(grant.object_path)
      if (dlErr || !blob) return json({ error: 'Could not read stored reel object to verify it' }, 500)
      const bytes = new Uint8Array(await blob.arrayBuffer())
      if (!bytes.byteLength || bytes.byteLength > Number(grant.max_bytes)) {
        return json({ error: 'Stored reel object size verification failed' }, 400)
      }
      const checksum = bytesToHex(await crypto.subtle.digest('SHA-256', bytes))

      const finalPath = `mil/reels/${grant.project_id}/${grant.version_id}.mp4`
      const moveUp = await supabaseAdmin.storage
        .from(grant.bucket)
        .upload(finalPath, bytes, { contentType: storedMime, upsert: false })
      if (moveUp.error) {
        // Do not mark the grant complete or touch the version row — the quarantine
        // copy is untouched, so the client can safely retry complete_reel.
        return json({ error: 'Reel was verified but could not be placed in final storage. Please retry.' }, 500)
      }

      const { error: verUpdErr } = await supabaseAdmin
        .from('mil_reel_versions')
        .update({ storage_path: finalPath, mime_type: storedMime, byte_size: bytes.byteLength })
        .eq('id', grant.version_id)
      if (verUpdErr) {
        // Storage already moved; best-effort cleanup of the new object to avoid an
        // orphaned file if we cannot record it, then report honestly.
        await supabaseAdmin.storage.from(grant.bucket).remove([finalPath]).catch(() => {})
        throw verUpdErr
      }

      await supabaseAdmin.storage.from(grant.bucket).remove([grant.object_path]).catch((err) => {
        console.error('media-intel-reel-upload quarantine cleanup failed', err)
      })

      await supabaseAdmin
        .from('mil_reel_upload_grants')
        .update({ completed_at: new Date().toISOString() })
        .eq('id', grant.id)

      await supabaseAdmin.from('mil_audit_events').insert({
        actor_user_id: user.id,
        action: 'reel_upload_completed',
        target_type: 'mil_reel_versions',
        target_id: grant.version_id,
        details: { projectId: grant.project_id, versionNumber: grant.version_number, checksum, byteSize: bytes.byteLength },
      })

      return json({ status: 'uploaded', projectId: grant.project_id, versionId: grant.version_id, versionNumber: grant.version_number })
    }

    return json({ error: `Unknown action: ${action}` }, 400)
  } catch (error) {
    console.error('media-intel-reel-upload', error instanceof Error ? error.message : error)
    return json({ error: error instanceof Error ? error.message : 'Reel upload failed' }, 500)
  }
})

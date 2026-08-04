/**
 * Server-minted reel upload grants (single-company).
 *
 * DB mutations + essential audit happen in transactional RPCs:
 *   mil_mint_reel_upload_grant_audited
 *   mil_complete_reel_upload_audited
 * Storage is outside PostgreSQL; completion uses a durable state machine:
 *   verify quarantine → place final object → RPC records final state + audit
 *   → async quarantine cleanup. Retry adopts an already-verified final object.
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4'
import { milCorsHeaders, milCorsPreflight } from '../_shared/milCors.ts'
import { supabaseAdmin } from '../_shared/supabaseAdmin.ts'
import { isMilCreator, isMilOwnerAdmin } from '../_shared/milRoles.ts'
import {
  newCorrelationId,
  PUBLIC_ERROR_CATALOG,
  redactErrorForClient,
} from '../_shared/milSafeErrors.ts'

function envInt(name: string, fallback: number) {
  const raw = Deno.env.get(name)
  if (!raw) return fallback
  const n = Number(raw)
  return Number.isFinite(n) && n > 0 ? n : fallback
}

const MAX_REEL_BYTES = envInt('MIL_MAX_REEL_BYTES', 250 * 1024 * 1024)
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

  const deny = (code: keyof typeof PUBLIC_ERROR_CATALOG | string, status = 403) => {
    const pub = PUBLIC_ERROR_CATALOG[code] ? code : 'INTERNAL_ERROR'
    return json({ error: PUBLIC_ERROR_CATALOG[pub], code: pub }, status)
  }

  try {
    const authHeader = req.headers.get('Authorization') || ''
    const authClient = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authHeader } },
    })
    const { data: { user }, error: authError } = await authClient.auth.getUser()
    if (authError || !user) return deny('SIGN_IN_REQUIRED', 401)

    const [isCreator, isOwnerAdmin] = await Promise.all([
      isMilCreator(user.id),
      isMilOwnerAdmin(user.id),
    ])
    if (!isCreator && !isOwnerAdmin) return deny('MEDIA_ACCESS_DENIED', 403)

    const body = await req.json().catch(() => ({}))
    const rawAction = String(body.action || '')
    const action = rawAction === 'mint' ? 'mint_reel_grant' : rawAction === 'complete' ? 'complete_reel' : rawAction

    if (action === 'mint_reel_grant') {
      const contentType = String(body.contentType || 'video/mp4').toLowerCase()
      const declaredBytes = Number(body.byteSize || 0)
      const notes = body.creatorNotes ? String(body.creatorNotes) : (body.notes ? String(body.notes) : null)
      const operationId = String(body.operationId || '').trim()
      const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
      if (!REEL_ALLOWED_MIME.has(contentType)) return deny('INVALID_REQUEST', 400)
      if (declaredBytes > MAX_REEL_BYTES) return deny('INVALID_REQUEST', 400)
      if (!operationId || !uuidRe.test(operationId)) return deny('INVALID_REQUEST', 400)

      let projectId = body.projectId ? String(body.projectId).trim() : null
      let collectionId = body.collectionId ? String(body.collectionId).trim() : null
      const title = String(body.title || 'Untitled reel').trim().slice(0, 200) || 'Untitled reel'
      const creatorUserId = isCreator ? user.id : String(body.creatorUserId || user.id)

      if (projectId) {
        const { data: existing, error: projErr } = await supabaseAdmin
          .from('mil_reel_projects')
          .select('id, creator_user_id, collection_id')
          .eq('id', projectId)
          .maybeSingle()
        if (projErr) throw projErr
        if (!existing) return deny('MEDIA_NOT_AVAILABLE', 404)
        if (isCreator && !isOwnerAdmin && existing.creator_user_id !== user.id) {
          return deny('MEDIA_ACCESS_DENIED', 403)
        }
        collectionId = existing.collection_id
      }

      if (collectionId && isCreator && !isOwnerAdmin) {
        const ok = await creatorAssignedToCollection(user.id, collectionId)
        if (!ok) return deny('MEDIA_ACCESS_DENIED', 403)
      }

      const maxBytes = Math.min(declaredBytes > 0 ? declaredBytes : MAX_REEL_BYTES, MAX_REEL_BYTES)
      const { data: minted, error: mintErr } = await supabaseAdmin.rpc(
        'mil_mint_reel_upload_grant_audited',
        {
          p_actor_id: user.id,
          p_creator_user_id: creatorUserId,
          p_project_id: projectId,
          p_title: title,
          p_collection_id: collectionId,
          p_content_type: contentType,
          p_max_bytes: maxBytes,
          p_notes: notes,
          p_version_id: null,
          p_idempotency_key: `reel_mint:${creatorUserId}:${projectId || 'new'}:${operationId}`,
          p_operation_id: operationId,
        },
      )
      if (mintErr) throw mintErr
      const grant = minted as {
        ok?: boolean
        grantId?: string
        projectId?: string
        versionId?: string
        versionNumber?: number
        objectPath?: string
        bucket?: string
        expiresAt?: string
        maxBytes?: number
      }
      if (!grant?.ok || !grant.objectPath || !grant.grantId) {
        return deny('INTERNAL_ERROR', 500)
      }

      const { data: signed, error: signErr } = await supabaseAdmin.storage
        .from(grant.bucket || 'media-intel-derivatives')
        .createSignedUploadUrl(grant.objectPath)
      if (signErr) throw signErr

      return json({
        grantId: grant.grantId,
        projectId: grant.projectId,
        versionId: grant.versionId,
        versionNumber: grant.versionNumber,
        objectPath: grant.objectPath,
        bucket: grant.bucket,
        token: signed?.token,
        path: signed?.path || grant.objectPath,
        signedUrl: signed?.signedUrl,
        expiresAt: grant.expiresAt,
        maxBytes: grant.maxBytes,
      })
    }

    if (action === 'complete_reel') {
      const grantId = String(body.grantId || '').trim()
      if (!grantId) return deny('INVALID_REQUEST', 400)

      const { data: grant, error: grantErr } = await supabaseAdmin
        .from('mil_reel_upload_grants')
        .select('*')
        .eq('id', grantId)
        .maybeSingle()
      if (grantErr) throw grantErr
      if (!grant) return deny('MEDIA_NOT_AVAILABLE', 404)
      if (isCreator && !isOwnerAdmin && grant.creator_user_id !== user.id) {
        return deny('MEDIA_ACCESS_DENIED', 403)
      }
      const claimedVersionId = body.versionId ? String(body.versionId).trim() : ''
      if (claimedVersionId && claimedVersionId !== grant.version_id) {
        return deny('MEDIA_ACCESS_DENIED', 403)
      }
      if (new Date(grant.expires_at).getTime() <= Date.now() && !grant.completed_at) {
        return deny('INVALID_REQUEST', 403)
      }
      if (!String(grant.object_path).startsWith('mil/quarantine/reels/')) {
        return deny('INVALID_REQUEST', 400)
      }

      const finalPath = `mil/reels/${grant.project_id}/${grant.version_id}.mp4`

      // Adopt already-placed final object on retry.
      const finalDir = finalPath.split('/').slice(0, -1).join('/')
      const finalLeaf = finalPath.split('/').pop() as string
      const { data: finalListed } = await supabaseAdmin.storage
        .from(grant.bucket)
        .list(finalDir, { limit: 10, search: finalLeaf })
      const finalMeta = (finalListed || []).find((o) => o.name === finalLeaf)

      let byteSize = 0
      let storedMime = String(grant.content_type || 'video/mp4')
      let checksum: string | null = null

      if (finalMeta) {
        byteSize = Number(finalMeta.metadata?.size ?? finalMeta.metadata?.contentLength ?? 0)
        storedMime = String(finalMeta.metadata?.mimetype || finalMeta.metadata?.contentType || storedMime).toLowerCase()
        if (!byteSize || byteSize <= 0 || byteSize > Number(grant.max_bytes)) {
          return deny('INVALID_REQUEST', 400)
        }
      } else {
        const dir = grant.object_path.split('/').slice(0, -1).join('/')
        const leaf = grant.object_path.split('/').pop() as string
        const { data: listed, error: listErr } = await supabaseAdmin.storage
          .from(grant.bucket)
          .list(dir, { limit: 10, search: leaf })
        if (listErr) throw listErr
        const meta = (listed || []).find((o) => o.name === leaf)
        if (!meta) return deny('MEDIA_SOURCE_MISSING', 400)

        const declaredSize = Number(meta.metadata?.size ?? meta.metadata?.contentLength ?? 0)
        if (!declaredSize || declaredSize <= 0 || declaredSize > Number(grant.max_bytes)) {
          return deny('INVALID_REQUEST', 400)
        }
        storedMime = String(meta.metadata?.mimetype || meta.metadata?.contentType || '').toLowerCase()
        if (!storedMime || (!REEL_ALLOWED_MIME.has(storedMime) && storedMime !== grant.content_type)) {
          return deny('INVALID_REQUEST', 400)
        }

        const { data: blob, error: dlErr } = await supabaseAdmin.storage.from(grant.bucket).download(grant.object_path)
        if (dlErr || !blob) return deny('MEDIA_SOURCE_MISSING', 500)
        const bytes = new Uint8Array(await blob.arrayBuffer())
        if (!bytes.byteLength || bytes.byteLength > Number(grant.max_bytes)) {
          return deny('INVALID_REQUEST', 400)
        }
        checksum = bytesToHex(await crypto.subtle.digest('SHA-256', bytes))
        byteSize = bytes.byteLength

        const moveUp = await supabaseAdmin.storage
          .from(grant.bucket)
          .upload(finalPath, bytes, { contentType: storedMime, upsert: false })
        if (moveUp.error) {
          // Race: another retry may have placed the final object.
          const { data: retryList } = await supabaseAdmin.storage
            .from(grant.bucket)
            .list(finalDir, { limit: 10, search: finalLeaf })
          if (!(retryList || []).find((o) => o.name === finalLeaf)) {
            return deny('INTERNAL_ERROR', 500)
          }
        }
      }

      const { data: completed, error: completeErr } = await supabaseAdmin.rpc(
        'mil_complete_reel_upload_audited',
        {
          p_actor_id: user.id,
          p_grant_id: grant.id,
          p_final_path: finalPath,
          p_mime_type: storedMime,
          p_byte_size: byteSize,
          p_checksum: checksum,
          p_idempotency_key: `reel_upload_completed:${grant.version_id}`,
        },
      )
      if (completeErr) throw completeErr
      const result = completed as {
        ok?: boolean
        projectId?: string
        versionId?: string
        versionNumber?: number
      }
      if (!result?.ok) return deny('INTERNAL_ERROR', 500)

      // Quarantine cleanup is asynchronous / best-effort (outside the DB TX).
      supabaseAdmin.storage.from(grant.bucket).remove([grant.object_path]).catch((err) => {
        console.error('media-intel-reel-upload quarantine cleanup failed', { correlationId, err })
      })

      return json({
        status: 'uploaded',
        projectId: result.projectId,
        versionId: result.versionId,
        versionNumber: result.versionNumber,
      })
    }

    return deny('INVALID_REQUEST', 400)
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    console.error('media-intel-reel-upload', { correlationId, msg })
    const redacted = redactErrorForClient(error, { correlationId, fallbackCode: 'INTERNAL_ERROR' })
    return json({ error: redacted.error, code: redacted.code }, 500)
  }
})

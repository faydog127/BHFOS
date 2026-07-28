/**
 * Authorized short-lived signed URLs for MIL private media (single-company).
 * Fail-closed: every branch must explicitly authorize before signing; there
 * is no fallback path that signs "just in case" when a check is ambiguous.
 * Creators never get originals; reel/asset access is assignment- or
 * ownership-bound. Every grant is audited (staff and creator alike).
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4'
import { milCorsHeaders, milCorsPreflight } from '../_shared/milCors.ts'
import { supabaseAdmin } from '../_shared/supabaseAdmin.ts'
import { resolveMilRole } from '../_shared/milRoles.ts'

const PREVIEW_TTL = 300
const DOWNLOAD_TTL = 600
const VALID_PURPOSES = new Set(['preview', 'download'])
const STAFF_ROLES = new Set(['admin', 'manager', 'office', 'media_reviewer'])
const CREATOR_DERIVATIVE_KINDS = new Set(['creator_download', 'detail_preview', 'grid_thumb', 'video_preview', 'video_thumb'])
const STAFF_PREVIEW_DERIVATIVE_KINDS = new Set([
  'detail_preview', 'grid_thumb', 'heic_preview', 'video_thumb', 'video_preview', 'public_safe',
])
const VALID_DERIVATIVE_KINDS = new Set([
  'grid_thumb', 'detail_preview', 'website_optimized', 'creator_download',
  'redacted_public', 'video_thumb', 'video_preview', 'reel_version', 'heic_preview',
  'public_safe', 'ai_safe',
])

/** Assignment-bound creator access. Global reel_creation approval alone is never enough. */
async function creatorCanView(userId: string, assetId: string) {
  const { data: asset } = await supabaseAdmin
    .from('mil_assets')
    .select('id, privacy_status, human_review_status, archived_at, trashed_at')
    .eq('id', assetId)
    .maybeSingle()
  // Mirror SQL mil_creator_can_view_asset: archived or trashed never authorize new URLs.
  if (
    !asset ||
    asset.archived_at ||
    asset.trashed_at ||
    asset.privacy_status !== 'clear' ||
    asset.human_review_status !== 'verified'
  ) {
    return false
  }

  const { data: use } = await supabaseAdmin
    .from('mil_permitted_uses')
    .select('asset_id')
    .eq('asset_id', assetId)
    .eq('use_key', 'reel_creation')
    .eq('approved', true)
    .maybeSingle()
  if (!use) return false

  const { data: assign } = await supabaseAdmin
    .from('mil_creator_assignments')
    .select('id')
    .eq('creator_user_id', userId)
    .eq('status', 'active')
    .is('revoked_at', null)
    .eq('asset_id', assetId)
    .maybeSingle()
  if (assign) return true

  const { data: collAssign } = await supabaseAdmin
    .from('mil_creator_assignments')
    .select('collection_id')
    .eq('creator_user_id', userId)
    .eq('status', 'active')
    .is('revoked_at', null)
    .not('collection_id', 'is', null)
  const collectionIds = (collAssign || []).map((r) => r.collection_id).filter(Boolean)
  if (!collectionIds.length) return false
  const { data: item } = await supabaseAdmin
    .from('mil_collection_items')
    .select('asset_id')
    .in('collection_id', collectionIds)
    .eq('asset_id', assetId)
    .maybeSingle()
  return Boolean(item)
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

    const body = await req.json().catch(() => ({}))
    const assetId = body.assetId ? String(body.assetId).trim() : ''
    const reelVersionId = body.reelVersionId ? String(body.reelVersionId).trim() : ''
    const purpose = String(body.purpose || 'preview')
    const derivativeKind = body.derivativeKind ? String(body.derivativeKind) : null
    const allowOriginal = body.allowOriginal === true

    // Fail closed on malformed input rather than silently defaulting.
    if (!VALID_PURPOSES.has(purpose)) {
      return json({ error: `Invalid purpose: ${purpose}` }, 400)
    }
    if (derivativeKind && !VALID_DERIVATIVE_KINDS.has(derivativeKind)) {
      return json({ error: `Invalid derivative kind: ${derivativeKind}` }, 400)
    }
    if (!assetId && !reelVersionId) {
      return json({ error: 'Missing asset or reel version' }, 400)
    }
    if (assetId && reelVersionId) {
      return json({ error: 'Provide either assetId or reelVersionId, not both' }, 400)
    }

    const role = await resolveMilRole(user.id)
    // Technicians are not MIL library staff for originals/browse signing.
    const isStaff = STAFF_ROLES.has(role)
    const isCreator = role === 'reel_creator'
    if (!isStaff && !isCreator) {
      return json({ error: 'You do not have access to this media.' }, 403)
    }

    const ttl = purpose === 'download' ? DOWNLOAD_TTL : PREVIEW_TTL

    // Reel version preview/download — ownership-bound for creators; staff may review.
    if (reelVersionId) {
      const { data: version } = await supabaseAdmin
        .from('mil_reel_versions')
        .select('id, storage_bucket, storage_path, project_id, mil_reel_projects!inner(id, creator_user_id)')
        .eq('id', reelVersionId)
        .maybeSingle()
      if (!version) return json({ error: 'Reel version not found' }, 404)
      const project = Array.isArray(version.mil_reel_projects)
        ? version.mil_reel_projects[0]
        : version.mil_reel_projects

      // Creator reel signing is only ever for the creator's OWN project versions.
      if (isCreator && (!project || project.creator_user_id !== user.id)) {
        return json({ error: 'This reel is not assigned to you.' }, 403)
      }
      if (!isStaff && !isCreator) return json({ error: 'Forbidden' }, 403)

      const bucket = version.storage_bucket
      const path = version.storage_path
      if (bucket !== 'media-intel-derivatives' || !String(path).startsWith('mil/reels/')) {
        return json({ error: 'Invalid reel storage target' }, 400)
      }

      const { data: signed, error: sErr } = await supabaseAdmin.storage
        .from(bucket)
        .createSignedUrl(path, ttl)
      if (sErr) throw sErr

      await supabaseAdmin.from('mil_audit_events').insert({
        actor_user_id: user.id,
        action: purpose === 'download' ? 'reel_download' : 'reel_preview',
        target_type: 'mil_reel_versions',
        target_id: reelVersionId,
        details: { projectId: version.project_id, bucket, path, ttl, role },
      })
      return json({ url: signed.signedUrl, expiresIn: ttl, kind: 'reel_version' })
    }

    const { data: asset, error: assetErr } = await supabaseAdmin
      .from('mil_assets')
      .select('*')
      .eq('id', assetId)
      .maybeSingle()
    if (assetErr) throw assetErr
    if (!asset) return json({ error: 'Media not found' }, 404)
    if (asset.archived_at) return json({ error: 'Media is archived' }, 403)

    if (isCreator) {
      // Do not allow signing originals for creators — ever — only assigned
      // creator_download (or preview-safe) derivatives.
      if (allowOriginal) return json({ error: 'Creators may never access originals.' }, 403)
      const ok = await creatorCanView(user.id, assetId)
      if (!ok) return json({ error: 'This media is not shared with you.' }, 403)
      if (derivativeKind && !CREATOR_DERIVATIVE_KINDS.has(derivativeKind)) {
        return json({ error: 'That derivative type is not available to creators.' }, 403)
      }
      const derQuery = supabaseAdmin
        .from('mil_derivatives')
        .select('*')
        .eq('asset_id', assetId)
        .order('created_at', { ascending: false })
        .limit(1)
      const { data: der } = derivativeKind
        ? await derQuery.eq('kind', derivativeKind).maybeSingle()
        : await derQuery.in('kind', Array.from(CREATOR_DERIVATIVE_KINDS)).maybeSingle()
      if (!der) return json({ error: 'No approved downloadable copy is available yet.' }, 403)
      const { data: signed, error: sErr } = await supabaseAdmin.storage
        .from(der.bucket)
        .createSignedUrl(der.object_path, ttl)
      if (sErr) throw sErr
      await supabaseAdmin.from('mil_audit_events').insert({
        actor_user_id: user.id,
        action: purpose === 'download' ? 'creator_download' : 'creator_preview',
        target_type: 'mil_assets',
        target_id: assetId,
        details: { derivativeId: der.id, kind: der.kind, ttl },
      })
      return json({ url: signed.signedUrl, expiresIn: ttl, bucket: der.bucket, kind: der.kind })
    }

    // Staff branch below. isStaff is guaranteed true here (isCreator handled above,
    // and the top-level check already rejected anyone who is neither).
    let bucket = asset.original_bucket
    let path = asset.original_path
    let kind = 'original'

    if (derivativeKind) {
      // Staff public_safe access requires privacy to be explicitly clear —
      // never assume a derivative existing means it is safe to hand out.
      if (derivativeKind === 'public_safe' && asset.privacy_status !== 'clear') {
        return json({ error: 'Privacy is not clear for this asset; public_safe cannot be signed.' }, 403)
      }
      const { data: der } = await supabaseAdmin
        .from('mil_derivatives')
        .select('*')
        .eq('asset_id', assetId)
        .eq('kind', derivativeKind)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      if (!der) return json({ error: 'Derivative not found' }, 404)
      bucket = der.bucket
      path = der.object_path
      kind = der.kind
    } else if (!allowOriginal) {
      const { data: der } = await supabaseAdmin
        .from('mil_derivatives')
        .select('*')
        .eq('asset_id', assetId)
        .in('kind', Array.from(STAFF_PREVIEW_DERIVATIVE_KINDS))
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      if (der) {
        if (der.kind === 'public_safe' && asset.privacy_status !== 'clear') {
          // Fall through to original/no-derivative rather than serve an unsafe public_safe copy.
        } else {
          bucket = der.bucket
          path = der.object_path
          kind = der.kind
        }
      }
    }

    if (!['media-intel-originals', 'media-intel-derivatives'].includes(bucket)) {
      return json({ error: 'Invalid storage target' }, 400)
    }
    if (!String(path).startsWith('mil/')) {
      return json({ error: 'Invalid storage path' }, 400)
    }

    const { data: signed, error: sErr } = await supabaseAdmin.storage
      .from(bucket)
      .createSignedUrl(path, ttl)
    if (sErr) throw sErr

    await supabaseAdmin.from('mil_audit_events').insert({
      actor_user_id: user.id,
      action: purpose === 'download' ? 'media_download' : 'media_preview',
      target_type: 'mil_assets',
      target_id: assetId,
      details: { bucket, kind, ttl, role },
    })

    return json({ url: signed.signedUrl, expiresIn: ttl, kind })
  } catch (error) {
    console.error('media-intel-sign', error instanceof Error ? error.message : error)
    return json({ error: error instanceof Error ? error.message : 'Sign failed' }, 500)
  }
})

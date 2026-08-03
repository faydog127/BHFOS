/**
 * Authorized short-lived signed URLs for MIL private media.
 * Phase 2A remediation: redacted errors, public-derivative matrix,
 * current reel-version enforcement, access-audit durability.
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4'
import { milCorsHeaders, milCorsPreflight } from '../_shared/milCors.ts'
import { supabaseAdmin } from '../_shared/supabaseAdmin.ts'
import { resolveMilRole } from '../_shared/milRoles.ts'
import { persistAccessAudit } from '../_shared/milAudit.ts'
import {
  CREATOR_DERIVATIVE_KINDS,
  STAFF_ROLES,
  OWN_UPLOAD_EXCEPTION,
  staffAssetSignDecision,
  creatorAssetSignDecision,
  reelVersionSignDecision,
  publicFacingDerivativeSignDecision,
  isPublicFacingDerivativeKind,
  requiredPermittedUseForDerivative,
  resolveCurrentReelVersionId,
} from '../_shared/milSignPolicy.ts'
import {
  newCorrelationId,
  redactErrorForClient,
  toPublicSignCode,
  PUBLIC_ERROR_CATALOG,
} from '../_shared/milSafeErrors.ts'

const PREVIEW_TTL = 300
const DOWNLOAD_TTL = 600
const VALID_PURPOSES = new Set(['preview', 'download'])
const STAFF_PREVIEW_DERIVATIVE_KINDS = new Set([
  'detail_preview', 'grid_thumb', 'heic_preview', 'video_thumb', 'video_preview',
])
const VALID_DERIVATIVE_KINDS = new Set([
  'grid_thumb', 'detail_preview', 'website_optimized', 'creator_download',
  'redacted_public', 'video_thumb', 'video_preview', 'reel_version', 'heic_preview',
  'public_safe', 'ai_safe',
])

void OWN_UPLOAD_EXCEPTION

async function creatorAssignmentActive(userId: string, assetId: string): Promise<boolean> {
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

async function reelUseApproved(assetId: string): Promise<boolean> {
  const { data: use } = await supabaseAdmin
    .from('mil_permitted_uses')
    .select('asset_id')
    .eq('asset_id', assetId)
    .eq('use_key', 'reel_creation')
    .eq('approved', true)
    .maybeSingle()
  return Boolean(use)
}

async function permittedUseApproved(assetId: string, useKey: string): Promise<boolean> {
  const { data: use } = await supabaseAdmin
    .from('mil_permitted_uses')
    .select('asset_id')
    .eq('asset_id', assetId)
    .eq('use_key', useKey)
    .eq('approved', true)
    .maybeSingle()
  return Boolean(use)
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

  const deny = (internalCode: string, status = 403) => {
    const pub = toPublicSignCode(internalCode)
    return json({ error: PUBLIC_ERROR_CATALOG[pub], code: pub }, status)
  }

  try {
    const authHeader = req.headers.get('Authorization') || ''
    const authClient = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authHeader } },
    })
    const { data: { user }, error: authError } = await authClient.auth.getUser()
    if (authError || !user) return deny('SIGN_IN_REQUIRED', 401)

    const body = await req.json().catch(() => ({}))
    const assetId = body.assetId ? String(body.assetId).trim() : ''
    const reelVersionId = body.reelVersionId ? String(body.reelVersionId).trim() : ''
    const purpose = String(body.purpose || 'preview')
    const derivativeKind = body.derivativeKind ? String(body.derivativeKind) : null
    const destination = body.destination ? String(body.destination).trim() : null
    const allowOriginal = body.allowOriginal === true
    const archiveInspection = body.archiveInspection === true

    if (!VALID_PURPOSES.has(purpose)) return deny('INVALID_REQUEST', 400)
    if (derivativeKind && !VALID_DERIVATIVE_KINDS.has(derivativeKind)) return deny('INVALID_REQUEST', 400)
    if (!assetId && !reelVersionId) return deny('INVALID_REQUEST', 400)
    if (assetId && reelVersionId) return deny('INVALID_REQUEST', 400)

    const role = await resolveMilRole(user.id)
    const isStaff = STAFF_ROLES.has(role)
    const isCreator = role === 'reel_creator'
    if (!isStaff && !isCreator) return deny('MEDIA_ACCESS_DENIED', 403)

    const ttl = purpose === 'download' ? DOWNLOAD_TTL : PREVIEW_TTL

    if (reelVersionId) {
      const { data: version } = await supabaseAdmin
        .from('mil_reel_versions')
        .select('id, status, version_number, storage_bucket, storage_path, project_id, mil_reel_projects!inner(id, creator_user_id, status)')
        .eq('id', reelVersionId)
        .maybeSingle()
      if (!version) return deny('REEL_VERSION_UNAVAILABLE', 404)
      const project = Array.isArray(version.mil_reel_projects)
        ? version.mil_reel_projects[0]
        : version.mil_reel_projects

      const bucket = version.storage_bucket
      const path = version.storage_path
      if (bucket !== 'media-intel-derivatives' || !String(path).startsWith('mil/reels/')) {
        console.error('media-intel-sign invalid reel storage', { correlationId })
        return deny('INVALID_REQUEST', 400)
      }

      const { data: siblings } = await supabaseAdmin
        .from('mil_reel_versions')
        .select('id, version_number, status')
        .eq('project_id', version.project_id)
      const currentVersionId = resolveCurrentReelVersionId(siblings || [])

      const decision = reelVersionSignDecision({
        role,
        actorId: user.id,
        project,
        version,
        currentVersionId,
        storagePresent: true,
        archiveInspection,
      })
      if (!decision.ok) return deny(decision.code, 403)

      const { data: signed, error: sErr } = await supabaseAdmin.storage
        .from(bucket)
        .createSignedUrl(path, ttl)
      if (sErr) {
        const msg = sErr instanceof Error ? sErr.message : String((sErr as { message?: string })?.message || sErr)
        console.error('media-intel-sign reel storage', { correlationId, msg })
        if (isStorageObjectMissingMessage(msg)) return deny('MEDIA_SOURCE_MISSING', 404)
        return deny('INTERNAL_ERROR', 500)
      }

      await persistAccessAudit({
        actorUserId: user.id,
        action: purpose === 'download' ? 'reel_download' : 'reel_preview',
        targetType: 'mil_reel_versions',
        targetId: reelVersionId,
        details: { ttl, role, correlationId, current: decision.current === true },
      })
      return json({ url: signed.signedUrl, expiresIn: ttl, kind: 'reel_version' })
    }

    const { data: asset, error: assetErr } = await supabaseAdmin
      .from('mil_assets')
      .select('*')
      .eq('id', assetId)
      .maybeSingle()
    if (assetErr) {
      console.error('media-intel-sign asset load', { correlationId, msg: assetErr.message })
      return deny('INTERNAL_ERROR', 500)
    }
    if (!asset) return deny('MEDIA_NOT_AVAILABLE', 404)

    if (isCreator) {
      const assignmentActive = await creatorAssignmentActive(user.id, assetId)
      const reelApproved = await reelUseApproved(assetId)
      const decision = creatorAssetSignDecision({
        asset,
        actorId: user.id,
        assignmentActive,
        reelUseApproved: reelApproved,
        sourcePresent: true,
        allowOriginal,
      })
      if (!decision.ok) return deny(decision.code, 403)
      if (derivativeKind && !CREATOR_DERIVATIVE_KINDS.has(derivativeKind)) {
        return deny('MEDIA_ACCESS_DENIED', 403)
      }
      if (derivativeKind && isPublicFacingDerivativeKind(derivativeKind)) {
        return deny('PUBLIC_DERIVATIVE_NOT_ELIGIBLE', 403)
      }

      const derQuery = supabaseAdmin
        .from('mil_derivatives')
        .select('id, kind, bucket, object_path')
        .eq('asset_id', assetId)
        .order('created_at', { ascending: false })
        .limit(1)
      const { data: der } = derivativeKind
        ? await derQuery.eq('kind', derivativeKind).maybeSingle()
        : await derQuery.in('kind', Array.from(CREATOR_DERIVATIVE_KINDS)).maybeSingle()
      if (!der) return deny('MEDIA_SOURCE_MISSING', 403)

      const { data: signed, error: sErr } = await supabaseAdmin.storage
        .from(der.bucket)
        .createSignedUrl(der.object_path, ttl)
      if (sErr) {
        console.error('media-intel-sign creator storage', { correlationId })
        return deny('MEDIA_SOURCE_MISSING', 404)
      }
      await persistAccessAudit({
        actorUserId: user.id,
        action: purpose === 'download' ? 'creator_download' : 'creator_preview',
        targetType: 'mil_assets',
        targetId: assetId,
        details: { kind: der.kind, ttl, via: decision.via, correlationId },
      })
      return json({ url: signed.signedUrl, expiresIn: ttl, kind: der.kind })
    }

    // Staff
    const staffGate = staffAssetSignDecision({
      asset, archiveInspection, sourcePresent: true, role,
    })
    if (!staffGate.ok) return deny(staffGate.code, 403)

    let bucket = asset.original_bucket
    let path = asset.original_path
    let kind = 'original'

    if (derivativeKind && isPublicFacingDerivativeKind(derivativeKind)) {
      const useReq = requiredPermittedUseForDerivative({
        kind: derivativeKind,
        destination,
        purpose,
      })
      if (!useReq.ok) return deny(useReq.code, 403)
      const publicApproved = await permittedUseApproved(assetId, useReq.useKey)
      const pubDecision = publicFacingDerivativeSignDecision({
        asset,
        kind: derivativeKind,
        publicUseApproved: publicApproved,
        derivativePresent: true,
        destination,
        purpose,
      })
      if (!pubDecision.ok) return deny(pubDecision.code, 403)
      const { data: der } = await supabaseAdmin
        .from('mil_derivatives')
        .select('id, kind, bucket, object_path')
        .eq('asset_id', assetId)
        .eq('kind', derivativeKind)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      if (!der) return deny('MEDIA_SOURCE_MISSING', 404)
      bucket = der.bucket
      path = der.object_path
      kind = der.kind
    } else if (derivativeKind) {
      const { data: der } = await supabaseAdmin
        .from('mil_derivatives')
        .select('id, kind, bucket, object_path')
        .eq('asset_id', assetId)
        .eq('kind', derivativeKind)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      if (!der) return deny('MEDIA_SOURCE_MISSING', 404)
      bucket = der.bucket
      path = der.object_path
      kind = der.kind
    } else if (!allowOriginal) {
      const { data: der } = await supabaseAdmin
        .from('mil_derivatives')
        .select('id, kind, bucket, object_path')
        .eq('asset_id', assetId)
        .in('kind', Array.from(STAFF_PREVIEW_DERIVATIVE_KINDS))
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      if (der) {
        bucket = der.bucket
        path = der.object_path
        kind = der.kind
      }
    }

    if (!['media-intel-originals', 'media-intel-derivatives'].includes(bucket)) {
      console.error('media-intel-sign invalid bucket', { correlationId })
      return deny('INVALID_REQUEST', 400)
    }
    if (!String(path).startsWith('mil/')) {
      console.error('media-intel-sign invalid path', { correlationId })
      return deny('INVALID_REQUEST', 400)
    }

    const { data: signed, error: sErr } = await supabaseAdmin.storage
      .from(bucket)
      .createSignedUrl(path, ttl)
    if (sErr) {
      const msg = sErr instanceof Error ? sErr.message : String((sErr as { message?: string })?.message || sErr)
      console.error('media-intel-sign storage', { correlationId, msg })
      if (isStorageObjectMissingMessage(msg)) return deny('MEDIA_SOURCE_MISSING', 404)
      return deny('INTERNAL_ERROR', 500)
    }

    await persistAccessAudit({
      actorUserId: user.id,
      action: purpose === 'download' ? 'media_download' : 'media_preview',
      targetType: 'mil_assets',
      targetId: assetId,
      details: { kind, ttl, role, archiveInspection, correlationId },
    })

    return json({ url: signed.signedUrl, expiresIn: ttl, kind })
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    console.error('media-intel-sign', { correlationId, msg })
    const redacted = redactErrorForClient(error, { correlationId, fallbackCode: 'INTERNAL_ERROR' })
    return json({ error: redacted.error, code: redacted.code }, 500)
  }
})

function isStorageObjectMissingMessage(message: string) {
  const m = String(message || '').toLowerCase()
  return m.includes('object not found')
    || m.includes('no such object')
    || m.includes('does not exist')
}

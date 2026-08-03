/**
 * Edge copy of MIL signing-policy matrix (Phase 2A remediation).
 * Keep aligned with src/lib/mediaIntel/signPolicy.js
 */

export type SignDecision =
  | { ok: true; via?: string; matrix?: string; kind?: string; class?: string; current?: boolean; historical?: boolean }
  | { ok: false; code: string; error: string }

export const STAFF_ROLES = new Set(['admin', 'manager', 'office', 'media_reviewer'])

export const DERIVATIVE_KIND_CLASS: Record<string, string> = {
  public_safe: 'public_facing',
  website_optimized: 'public_facing',
  redacted_public: 'public_facing',
  grid_thumb: 'staff_preview',
  detail_preview: 'staff_preview',
  heic_preview: 'staff_preview',
  video_thumb: 'staff_preview',
  video_preview: 'staff_preview',
  creator_download: 'creator',
  ai_safe: 'internal',
  reel_version: 'reel',
}

export const CREATOR_DERIVATIVE_KINDS = new Set([
  'creator_download', 'detail_preview', 'grid_thumb', 'video_preview', 'video_thumb', 'heic_preview',
])

export const CREATOR_REEL_VERSION_STATUSES = new Set([
  'creator_draft', 'submitted_for_review', 'revision_requested', 'approved_to_post',
])

export const STAFF_HISTORICAL_REEL_STATUSES = new Set([
  'creator_draft', 'submitted_for_review', 'revision_requested',
  'approved_to_post', 'denied', 'superseded', 'archived',
])

export const PUBLIC_SAFE_RIGHTS = new Set([
  'tvg_owned', 'employee_supplied', 'permission_confirmed',
])

export const PUBLIC_SAFE_CUSTOMER_PERMISSION = new Set(['confirmed', 'not_required'])

export const DERIVATIVE_REQUIRED_USE: Record<string, string> = {
  website_optimized: 'website',
  public_safe: 'website',
  social_media: 'social_media',
  social_optimized: 'social_media',
  reel_creator: 'reel_creation',
  reel_creation: 'reel_creation',
  creator_download: 'reel_creation',
}

export const PUBLIC_DESTINATIONS: Record<string, string | null> = {
  website: 'website',
  social_media: 'social_media',
  reel_creation: 'reel_creation',
  public_download: null,
  internal_preview: null,
}

export const OWN_UPLOAD_EXCEPTION =
  'Creators may access creator-safe derivatives of their own uploads before verification; originals remain forbidden.'

function allow(extra: Record<string, unknown> = {}): SignDecision {
  return { ok: true, ...extra } as SignDecision
}

function deny(code: string): SignDecision {
  return { ok: false, code, error: code }
}

export function isPublicFacingDerivativeKind(kind: string | null | undefined): boolean {
  return Boolean(kind && DERIVATIVE_KIND_CLASS[kind] === 'public_facing')
}

export function requiredPermittedUseForDerivative(input: {
  kind?: string | null
  destination?: string | null
  purpose?: string | null
}): { ok: true; useKey: string; via: string } | { ok: false; code: string; reason: string } {
  const dest = input.destination ? String(input.destination).trim() : null
  const k = input.kind ? String(input.kind).trim() : null

  if (dest === 'public_download') {
    return { ok: false, code: 'PUBLIC_DERIVATIVE_NOT_ELIGIBLE', reason: 'public_download_undefined' }
  }
  if (dest === 'internal_preview') {
    return { ok: false, code: 'PUBLIC_DERIVATIVE_NOT_ELIGIBLE', reason: 'internal_preview_not_public' }
  }
  if (dest && Object.prototype.hasOwnProperty.call(PUBLIC_DESTINATIONS, dest)) {
    const useKey = PUBLIC_DESTINATIONS[dest]
    if (!useKey) {
      return { ok: false, code: 'PUBLIC_DERIVATIVE_NOT_ELIGIBLE', reason: 'destination_denied' }
    }
    return { ok: true, useKey, via: 'destination' }
  }
  if (dest) {
    return { ok: false, code: 'PUBLIC_DERIVATIVE_NOT_ELIGIBLE', reason: 'unknown_destination' }
  }
  if (k === 'redacted_public') {
    return { ok: false, code: 'PUBLIC_DERIVATIVE_NOT_ELIGIBLE', reason: 'ambiguous_destination' }
  }
  if (k && Object.prototype.hasOwnProperty.call(DERIVATIVE_REQUIRED_USE, k)) {
    return { ok: true, useKey: DERIVATIVE_REQUIRED_USE[k], via: 'kind' }
  }
  if (input.purpose === 'download' && isPublicFacingDerivativeKind(k)) {
    return { ok: false, code: 'PUBLIC_DERIVATIVE_NOT_ELIGIBLE', reason: 'public_download_undefined' }
  }
  return { ok: false, code: 'PUBLIC_DERIVATIVE_NOT_ELIGIBLE', reason: 'unknown_or_ambiguous' }
}

export function staffAssetSignDecision(input: {
  asset: { trashed_at?: string | null; archived_at?: string | null } | null
  archiveInspection?: boolean
  sourcePresent?: boolean
  role?: string
}): SignDecision {
  const { asset, archiveInspection = false, sourcePresent = true, role = 'admin' } = input
  if (!asset) return deny('MEDIA_NOT_AVAILABLE')
  if (asset.trashed_at) return deny('MEDIA_TRASHED')
  if (asset.archived_at) {
    if (!archiveInspection || !['admin', 'manager'].includes(role)) return deny('MEDIA_ARCHIVED')
  }
  if (!sourcePresent) return deny('MEDIA_SOURCE_MISSING')
  return allow()
}

export function creatorAssetSignDecision(input: {
  asset: {
    trashed_at?: string | null
    archived_at?: string | null
    created_by_user_id?: string | null
    human_review_status?: string | null
    privacy_status?: string | null
  } | null
  actorId: string
  assignmentActive?: boolean
  reelUseApproved?: boolean
  sourcePresent?: boolean
  allowOriginal?: boolean
}): SignDecision {
  const {
    asset, actorId, assignmentActive = false, reelUseApproved = false,
    sourcePresent = true, allowOriginal = false,
  } = input
  if (!asset) return deny('MEDIA_NOT_AVAILABLE')
  if (allowOriginal) return deny('MEDIA_ACCESS_DENIED')
  if (asset.trashed_at) return deny('MEDIA_TRASHED')
  if (asset.archived_at) return deny('MEDIA_ARCHIVED')
  if (!sourcePresent) return deny('MEDIA_SOURCE_MISSING')
  if (asset.created_by_user_id && asset.created_by_user_id === actorId) {
    return allow({ via: 'own_upload' })
  }
  if (asset.human_review_status !== 'verified') return deny('MEDIA_ACCESS_DENIED')
  if (asset.privacy_status !== 'clear') return deny('MEDIA_ACCESS_DENIED')
  if (!reelUseApproved) return deny('MEDIA_ACCESS_DENIED')
  if (!assignmentActive) return deny('MEDIA_ACCESS_DENIED')
  return allow({ via: 'assignment' })
}

export function publicFacingDerivativeSignDecision(input: {
  asset: {
    trashed_at?: string | null
    archived_at?: string | null
    human_review_status?: string | null
    privacy_status?: string | null
    rights_status?: string | null
    customer_permission_status?: string | null
  } | null
  kind: string
  publicUseApproved?: boolean
  derivativePresent?: boolean
  destination?: string | null
  purpose?: string | null
}): SignDecision {
  const {
    asset, kind, publicUseApproved = false, derivativePresent = true,
    destination = null, purpose = null,
  } = input
  if (!isPublicFacingDerivativeKind(kind)) return deny('PUBLIC_DERIVATIVE_NOT_ELIGIBLE')
  const useReq = requiredPermittedUseForDerivative({ kind, destination, purpose })
  if (!useReq.ok) return deny(useReq.code)
  if (!asset) return deny('MEDIA_NOT_AVAILABLE')
  if (asset.trashed_at) return deny('MEDIA_TRASHED')
  if (asset.archived_at) return deny('MEDIA_ARCHIVED')
  if (asset.human_review_status !== 'verified') return deny('PUBLIC_DERIVATIVE_NOT_ELIGIBLE')
  if (asset.privacy_status !== 'clear') return deny('PUBLIC_DERIVATIVE_NOT_ELIGIBLE')
  if (!PUBLIC_SAFE_RIGHTS.has(String(asset.rights_status || ''))) {
    return deny('PUBLIC_DERIVATIVE_NOT_ELIGIBLE')
  }
  if (!PUBLIC_SAFE_CUSTOMER_PERMISSION.has(String(asset.customer_permission_status || ''))) {
    return deny('PUBLIC_DERIVATIVE_NOT_ELIGIBLE')
  }
  if (!publicUseApproved) return deny('PUBLIC_DERIVATIVE_NOT_ELIGIBLE')
  if (!derivativePresent) return deny('MEDIA_SOURCE_MISSING')
  return allow({ kind, class: 'public_facing', useKey: useReq.useKey })
}

export function publicSafeSignDecision(input: {
  asset: Parameters<typeof publicFacingDerivativeSignDecision>[0]['asset']
  publicUseApproved?: boolean
  derivativePresent?: boolean
  kind?: string
}): SignDecision {
  return publicFacingDerivativeSignDecision({
    asset: input.asset,
    kind: input.kind || 'public_safe',
    publicUseApproved: input.publicUseApproved,
    derivativePresent: input.derivativePresent,
  })
}

export function reelVersionSignDecision(input: {
  role: string
  actorId: string
  project: {
    creator_user_id?: string | null
    status?: string | null
    archived_at?: string | null
    trashed_at?: string | null
    active_relationship?: boolean
  } | null
  version: { id?: string; status?: string | null } | null
  currentVersionId?: string | null
  storagePresent?: boolean
  archiveInspection?: boolean
}): SignDecision {
  const {
    role, actorId, project, version,
    currentVersionId = null, storagePresent = true, archiveInspection = false,
  } = input
  if (!version || !project) return deny('REEL_VERSION_UNAVAILABLE')
  const projectArchived = project.status === 'archived' || Boolean(project.archived_at)
  if (project.trashed_at) return deny('REEL_VERSION_UNAVAILABLE')

  const isStaff = STAFF_ROLES.has(role)
  const isCreator = role === 'reel_creator'
  if (!isStaff && !isCreator) return deny('MEDIA_ACCESS_DENIED')

  if (projectArchived) {
    if (!(archiveInspection && ['admin', 'manager'].includes(role))) {
      return deny('REEL_VERSION_UNAVAILABLE')
    }
  }
  if (!storagePresent) return deny('MEDIA_SOURCE_MISSING')

  const ownsProject =
    project.creator_user_id === actorId || project.active_relationship === true

  if (isCreator) {
    if (!ownsProject || projectArchived) return deny('REEL_VERSION_UNAVAILABLE')
    const st = String(version.status || '')
    if (st === 'superseded' || st === 'denied' || st === 'archived') {
      return deny('REEL_VERSION_UNAVAILABLE')
    }
    if (!CREATOR_REEL_VERSION_STATUSES.has(st)) return deny('REEL_VERSION_UNAVAILABLE')
    if (!currentVersionId || String(version.id) !== String(currentVersionId)) {
      return deny('REEL_VERSION_UNAVAILABLE')
    }
    return allow({ matrix: 'creator', current: true })
  }

  if (!STAFF_HISTORICAL_REEL_STATUSES.has(String(version.status || '')) && !projectArchived) {
    return deny('REEL_VERSION_UNAVAILABLE')
  }
  return allow({
    matrix: 'staff',
    historical: currentVersionId ? String(version.id) !== String(currentVersionId) : false,
  })
}

export function resolveCurrentReelVersionId(
  versions: Array<{ id?: string; version_number?: number; status?: string | null }>,
): string | null {
  if (!versions?.length) return null
  const pool = versions.filter((v) => v && v.status !== 'superseded')
  if (!pool.length) return null
  let best: { id: string; n: number } | null = null
  for (const v of pool) {
    const n = Number(v.version_number) || 0
    const id = String(v.id || '')
    if (!best || n > best.n || (n === best.n && id > best.id)) best = { id, n }
  }
  return best?.id || null
}

/**
 * Pure MIL signing-policy matrix (Phase 2A remediation).
 * Edge media-intel-sign must enforce the same rules.
 *
 * Public client codes (via safeErrors.toPublicSignCode):
 * MEDIA_NOT_AVAILABLE | MEDIA_ACCESS_DENIED | MEDIA_ARCHIVED | MEDIA_TRASHED |
 * MEDIA_SOURCE_MISSING | REEL_VERSION_UNAVAILABLE | PUBLIC_DERIVATIVE_NOT_ELIGIBLE | INTERNAL_ERROR
 */

export const SIGN_TTL = Object.freeze({ preview: 300, download: 600 });

export const STAFF_ROLES = Object.freeze([
  'admin', 'manager', 'office', 'media_reviewer',
]);

/**
 * Complete derivative-kind classification.
 * Public safety is NEVER inferred from a loose name — only from this matrix.
 */
export const DERIVATIVE_KIND_CLASS = Object.freeze({
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
});

export const PUBLIC_FACING_DERIVATIVE_KINDS = Object.freeze(
  Object.entries(DERIVATIVE_KIND_CLASS)
    .filter(([, c]) => c === 'public_facing')
    .map(([k]) => k),
);

export const CREATOR_DERIVATIVE_KINDS = Object.freeze([
  'creator_download', 'detail_preview', 'grid_thumb', 'video_preview', 'video_thumb', 'heic_preview',
]);

export const CREATOR_REEL_VERSION_STATUSES = Object.freeze([
  'creator_draft', 'submitted_for_review', 'revision_requested', 'approved_to_post',
]);

export const STAFF_HISTORICAL_REEL_STATUSES = Object.freeze([
  'creator_draft', 'submitted_for_review', 'revision_requested',
  'approved_to_post', 'denied', 'superseded', 'archived',
]);

export const PUBLIC_SAFE_RIGHTS = Object.freeze([
  'tvg_owned', 'employee_supplied', 'permission_confirmed',
]);

export const PUBLIC_SAFE_CUSTOMER_PERMISSION = Object.freeze([
  'confirmed', 'not_required',
]);

export const PUBLIC_USE_KEYS = Object.freeze(['website', 'social_media', 'reel_creation']);

/**
 * Kind / purpose → required permitted-use key.
 * Ambiguous multi-channel kinds (e.g. redacted_public) require an explicit
 * destination; filename/kind alone must never authorize both website and social.
 */
export const DERIVATIVE_REQUIRED_USE = Object.freeze({
  website_optimized: 'website',
  public_safe: 'website',
  social_media: 'social_media',
  social_optimized: 'social_media',
  reel_creator: 'reel_creation',
  reel_creation: 'reel_creation',
  creator_download: 'reel_creation',
  // redacted_public intentionally omitted — requires explicit destination
});

export const PUBLIC_DESTINATIONS = Object.freeze({
  website: 'website',
  social_media: 'social_media',
  reel_creation: 'reel_creation',
  public_download: null, // deny until an approved public-download key is ratified
  internal_preview: null, // not a public permitted-use path
});

/**
 * Own-upload exception (documented, privacy-safe):
 * Creators may access creator-safe derivatives of their own uploads before
 * owner verify. Originals remain forbidden. Assigned non-own assets still
 * require verify + privacy clear + reel_creation + active assignment.
 */
export const OWN_UPLOAD_EXCEPTION =
  'Creators may access creator-safe derivatives of their own uploads before verification; originals remain forbidden.';

export function classifyDerivativeKind(kind) {
  if (!kind) return null;
  return DERIVATIVE_KIND_CLASS[kind] || null;
}

export function isPublicFacingDerivativeKind(kind) {
  return classifyDerivativeKind(kind) === 'public_facing';
}

/**
 * Resolve the single required permitted-use key for a public-facing request.
 * Returns { ok:false } when destination is missing/ambiguous/unknown/denied.
 */
export function requiredPermittedUseForDerivative({
  kind,
  destination = null,
  purpose = null,
} = {}) {
  const dest = destination ? String(destination).trim() : null;
  const k = kind ? String(kind).trim() : null;

  if (dest === 'public_download') {
    return { ok: false, code: 'PUBLIC_DERIVATIVE_NOT_ELIGIBLE', reason: 'public_download_undefined' };
  }
  if (dest === 'internal_preview') {
    return { ok: false, code: 'PUBLIC_DERIVATIVE_NOT_ELIGIBLE', reason: 'internal_preview_not_public' };
  }
  if (dest && Object.prototype.hasOwnProperty.call(PUBLIC_DESTINATIONS, dest)) {
    const useKey = PUBLIC_DESTINATIONS[dest];
    if (!useKey) {
      return { ok: false, code: 'PUBLIC_DERIVATIVE_NOT_ELIGIBLE', reason: 'destination_denied' };
    }
    return { ok: true, useKey, via: 'destination' };
  }
  if (dest) {
    return { ok: false, code: 'PUBLIC_DERIVATIVE_NOT_ELIGIBLE', reason: 'unknown_destination' };
  }

  // Ambiguous multi-channel public kinds require an explicit destination.
  if (k === 'redacted_public') {
    return { ok: false, code: 'PUBLIC_DERIVATIVE_NOT_ELIGIBLE', reason: 'ambiguous_destination' };
  }

  if (k && Object.prototype.hasOwnProperty.call(DERIVATIVE_REQUIRED_USE, k)) {
    return { ok: true, useKey: DERIVATIVE_REQUIRED_USE[k], via: 'kind' };
  }

  if (purpose === 'download' && isPublicFacingDerivativeKind(k)) {
    return { ok: false, code: 'PUBLIC_DERIVATIVE_NOT_ELIGIBLE', reason: 'public_download_undefined' };
  }

  return { ok: false, code: 'PUBLIC_DERIVATIVE_NOT_ELIGIBLE', reason: 'unknown_or_ambiguous' };
}

export function staffAssetSignDecision({
  asset,
  archiveInspection = false,
  sourcePresent = true,
  role = 'admin',
}) {
  if (!asset) return deny('MEDIA_NOT_AVAILABLE');
  if (asset.trashed_at) return deny('MEDIA_TRASHED');
  if (asset.archived_at) {
    if (!archiveInspection || !['admin', 'manager'].includes(role)) {
      return deny('MEDIA_ARCHIVED');
    }
  }
  if (!sourcePresent) return deny('MEDIA_SOURCE_MISSING');
  return allow();
}

export function creatorAssetSignDecision({
  asset,
  actorId,
  assignmentActive = false,
  reelUseApproved = false,
  sourcePresent = true,
  allowOriginal = false,
}) {
  if (!asset) return deny('MEDIA_NOT_AVAILABLE');
  if (allowOriginal) return deny('MEDIA_ACCESS_DENIED');
  if (asset.trashed_at) return deny('MEDIA_TRASHED');
  if (asset.archived_at) return deny('MEDIA_ARCHIVED');
  if (!sourcePresent) return deny('MEDIA_SOURCE_MISSING');

  const isOwnUpload = asset.created_by_user_id && asset.created_by_user_id === actorId;
  if (isOwnUpload) return allow({ via: 'own_upload' });

  if (asset.human_review_status !== 'verified') return deny('MEDIA_ACCESS_DENIED');
  if (asset.privacy_status !== 'clear') return deny('MEDIA_ACCESS_DENIED');
  if (!reelUseApproved) return deny('MEDIA_ACCESS_DENIED');
  if (!assignmentActive) return deny('MEDIA_ACCESS_DENIED');
  return allow({ via: 'assignment' });
}

/**
 * Public-facing derivative gate — applies to staff and any caller.
 * website_optimized / redacted_public / public_safe cannot bypass this.
 * publicUseApproved must reflect the kind/destination-specific use key only.
 */
export function publicFacingDerivativeSignDecision({
  asset,
  kind,
  publicUseApproved = false,
  derivativePresent = true,
  destination = null,
  purpose = null,
}) {
  if (!isPublicFacingDerivativeKind(kind)) {
    return deny('PUBLIC_DERIVATIVE_NOT_ELIGIBLE');
  }
  const useReq = requiredPermittedUseForDerivative({ kind, destination, purpose });
  if (!useReq.ok) return deny(useReq.code);
  if (!asset) return deny('MEDIA_NOT_AVAILABLE');
  if (asset.trashed_at) return deny('MEDIA_TRASHED');
  if (asset.archived_at) return deny('MEDIA_ARCHIVED');
  if (asset.human_review_status !== 'verified') return deny('PUBLIC_DERIVATIVE_NOT_ELIGIBLE');
  if (asset.privacy_status !== 'clear') return deny('PUBLIC_DERIVATIVE_NOT_ELIGIBLE');
  if (!PUBLIC_SAFE_RIGHTS.includes(asset.rights_status)) {
    return deny('PUBLIC_DERIVATIVE_NOT_ELIGIBLE');
  }
  if (!PUBLIC_SAFE_CUSTOMER_PERMISSION.includes(asset.customer_permission_status)) {
    return deny('PUBLIC_DERIVATIVE_NOT_ELIGIBLE');
  }
  if (!publicUseApproved) return deny('PUBLIC_DERIVATIVE_NOT_ELIGIBLE');
  if (!derivativePresent) return deny('MEDIA_SOURCE_MISSING');
  return allow({ kind, class: 'public_facing', useKey: useReq.useKey });
}

/** @deprecated use publicFacingDerivativeSignDecision */
export function publicSafeSignDecision(args) {
  return publicFacingDerivativeSignDecision({
    ...args,
    kind: args.kind || 'public_safe',
  });
}

/**
 * Reel-version matrix with current-version enforcement for creators.
 * `currentVersionId` = project's current permitted version (max non-superseded
 * version_number, or explicit current pointer). Creators cannot open stale IDs.
 * Owner/admin/staff may open historical versions (denied/superseded) for audit.
 */
export function reelVersionSignDecision({
  role,
  actorId,
  project,
  version,
  currentVersionId = null,
  storagePresent = true,
  archiveInspection = false,
}) {
  if (!version || !project) return deny('REEL_VERSION_UNAVAILABLE');

  const projectArchived = project.status === 'archived' || Boolean(project.archived_at);
  if (project.trashed_at) return deny('REEL_VERSION_UNAVAILABLE');

  const isStaff = STAFF_ROLES.includes(role);
  const isCreator = role === 'reel_creator';
  if (!isStaff && !isCreator) return deny('MEDIA_ACCESS_DENIED');

  if (projectArchived) {
    if (!(archiveInspection && ['admin', 'manager'].includes(role))) {
      return deny('REEL_VERSION_UNAVAILABLE');
    }
  }

  if (!storagePresent) return deny('MEDIA_SOURCE_MISSING');

  const ownsProject =
    project.creator_user_id === actorId || project.active_relationship === true;

  if (isCreator) {
    if (!ownsProject) return deny('REEL_VERSION_UNAVAILABLE');
    if (projectArchived) return deny('REEL_VERSION_UNAVAILABLE');
    if (version.status === 'superseded' || version.status === 'denied' || version.status === 'archived') {
      return deny('REEL_VERSION_UNAVAILABLE');
    }
    if (!CREATOR_REEL_VERSION_STATUSES.includes(version.status)) {
      return deny('REEL_VERSION_UNAVAILABLE');
    }
    if (currentVersionId && String(version.id) !== String(currentVersionId)) {
      return deny('REEL_VERSION_UNAVAILABLE');
    }
    if (!currentVersionId) {
      // Fail closed when caller cannot prove currency.
      return deny('REEL_VERSION_UNAVAILABLE');
    }
    return allow({ matrix: 'creator', current: true });
  }

  // Staff / owner/admin — historical access for audit/comparison is intentional.
  if (!STAFF_HISTORICAL_REEL_STATUSES.includes(version.status) && !projectArchived) {
    return deny('REEL_VERSION_UNAVAILABLE');
  }
  return allow({
    matrix: 'staff',
    historical: currentVersionId ? String(version.id) !== String(currentVersionId) : false,
  });
}

/**
 * Resolve current reel version id from a version list.
 * Current = highest version_number among rows whose status is not 'superseded'.
 * If all superseded, returns null.
 */
export function resolveCurrentReelVersionId(versions) {
  if (!Array.isArray(versions) || !versions.length) return null;
  const active = versions.filter((v) => v && v.status !== 'superseded');
  const pool = active.length ? active : [];
  if (!pool.length) return null;
  let best = null;
  for (const v of pool) {
    const n = Number(v.version_number) || 0;
    if (!best || n > best.n || (n === best.n && String(v.id) > String(best.id))) {
      best = { id: v.id, n };
    }
  }
  return best?.id ?? null;
}

function allow(extra = {}) {
  return { ok: true, ...extra };
}

function deny(code) {
  return { ok: false, code, error: code };
}

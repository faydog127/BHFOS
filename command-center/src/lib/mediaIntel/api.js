import { supabase } from '@/lib/customSupabaseClient';
import { CONTRIBUTOR_SELF_SOURCE_LABEL } from './constants';
import { PREVIEW_DERIVATIVE_KINDS } from './derivativeKinds';
import { buildAssetSearchPlan, buildTextSearchOrFilter } from './assetSearch.js';

const ASSET_LIST_SELECT =
  '*, mil_derivatives(id, kind, object_path, bucket), mil_verified_metadata(*), mil_permitted_uses(use_key, approved), mil_upload_batches(source_label, source_person, uploader_user_id)';
const ASSET_LIST_SELECT_CONTRIBUTOR_SELF =
  '*, mil_derivatives(id, kind, object_path, bucket), mil_verified_metadata(*), mil_permitted_uses(use_key, approved), mil_upload_batches!inner(source_label, source_person, uploader_user_id)';

const SUBMISSION_LIST_SELECT =
  '*, mil_submission_assets(id, asset_id, version_number, sort_order, mil_assets(id, original_filename, media_kind, processing_status, human_review_status, created_at, mil_derivatives(id, kind, object_path, bucket), mil_upload_batches(source_label)))';

async function actorId() {
  const { data } = await supabase.auth.getUser();
  return data?.user?.id || null;
}

/**
 * Pre-staging hardening: client-side inserts into mil_audit_events were removable
 * (any authenticated session could forge audit history). All privileged mutations
 * now go through SECURITY DEFINER RPCs (mil_verify_asset, mil_set_permitted_use,
 * mil_review_reel_version, mil_submit_reel_version, mil_set_asset_archive_state)
 * which call mil_audit_insert() server-side using auth.uid(). There is no
 * client-authored audit trail anymore — call sites must not depend on this.
 */
export function audit() {
  throw new Error(
    'Client-side audit() inserts are disabled. Privileged actions audit themselves ' +
      'server-side via mil_audit_insert() inside their RPC.',
  );
}

export async function fetchDashboardStats() {
  const base = () => supabase.from('mil_assets').select('id', { count: 'exact', head: true });

  const active = () => base().is('archived_at', null).is('trashed_at', null);
  const results = await Promise.all([
    active().eq('media_kind', 'photo'),
    active().eq('media_kind', 'video'),
    active().gte('created_at', new Date(Date.now() - 7 * 864e5).toISOString()),
    active().in('processing_status', ['queued', 'analyzing']),
    active().eq('human_review_status', 'pending'),
    active().not('duplicate_of_asset_id', 'is', null),
    active().in('privacy_status', ['needs_review', 'needs_redaction']),
    active()
      .is('lifecycle_kept_at', null)
      .or('ai_lifecycle_recommendation.in.(archive,trash),ai_usability.in.(poor,unusable)'),
    supabase.from('mil_permitted_uses').select('asset_id', { count: 'exact', head: true }).eq('use_key', 'reel_creation').eq('approved', true),
    supabase.from('mil_creator_assignments').select('id', { count: 'exact', head: true }).eq('status', 'active'),
    supabase.from('mil_processing_jobs').select('id', { count: 'exact', head: true }).eq('status', 'failed'),
    supabase.from('mil_asset_relationships').select('id', { count: 'exact', head: true }).eq('relationship_type', 'possible_before_after').eq('verification_status', 'unverified'),
    supabase.from('mil_reel_versions').select('id', { count: 'exact', head: true }).eq('status', 'submitted_for_review'),
    supabase.from('mil_reel_versions').select('id', { count: 'exact', head: true }).eq('status', 'approved_to_post'),
    base().not('trashed_at', 'is', null),
    // Contributor Upload my shots — distinct from staff phone-dump intake.
    supabase
      .from('mil_assets')
      .select('id, mil_upload_batches!inner(source_label)', { count: 'exact', head: true })
      .is('archived_at', null)
      .is('trashed_at', null)
      .eq('human_review_status', 'pending')
      .eq('mil_upload_batches.source_label', CONTRIBUTOR_SELF_SOURCE_LABEL),
  ]);

  const firstError = results.find((r) => r?.error)?.error;
  if (firstError) throw firstError;

  // Best-effort until unified-submissions migration is applied on the target DB.
  let submissionsAwaitingOwner = 0;
  try {
    const subRes = await supabase
      .from('mil_submissions')
      .select('id', { count: 'exact', head: true })
      .eq('review_status', 'awaiting_owner_review')
      .eq('action_owner', 'owner');
    if (!subRes.error) submissionsAwaitingOwner = subRes.count || 0;
  } catch {
    submissionsAwaitingOwner = 0;
  }

  const [
    photos, videos, recent, awaitingAi, awaitingReview, duplicates, privacy, qualityCleanup,
    marketing, assigned, failedJobs, baUnverified, reelsAwaiting, reelsApproved, trashed,
    contributorReceivedPending,
  ] = results;

  return {
    totalPhotos: photos.count || 0,
    totalVideos: videos.count || 0,
    recentlyUploaded: recent.count || 0,
    awaitingAi: awaitingAi.count || 0,
    awaitingHumanReview: awaitingReview.count || 0,
    contributorReceivedPending: contributorReceivedPending.count || 0,
    submissionsAwaitingOwner,
    possibleDuplicates: duplicates.count || 0,
    possibleBeforeAfter: baUnverified.count || 0,
    privacyWarnings: privacy.count || 0,
    qualityCleanup: qualityCleanup.count || 0,
    trashed: trashed.count || 0,
    approvedForMarketing: marketing.count || 0,
    assignedToCreator: assigned.count || 0,
    reelsAwaitingReview: reelsAwaiting.count || 0,
    approvedReelsReady: reelsApproved.count || 0,
    failedJobs: failedJobs.count || 0,
  };
}

export async function listAssets(filters = {}) {
  const plan = buildAssetSearchPlan(filters.search);
  if (plan.kind === 'no_match') return [];

  const select = filters.contributorSelf ? ASSET_LIST_SELECT_CONTRIBUTOR_SELF : ASSET_LIST_SELECT;
  let q = supabase
    .from('mil_assets')
    .select(select)
    .order('created_at', { ascending: false })
    .limit(filters.limit || 60);

  if (filters.contributorSelf) {
    q = q.eq('mil_upload_batches.source_label', CONTRIBUTOR_SELF_SOURCE_LABEL);
  }
  if (filters.mediaKind) q = q.eq('media_kind', filters.mediaKind);
  if (filters.humanReviewStatus) q = q.eq('human_review_status', filters.humanReviewStatus);
  if (filters.privacyStatus) q = q.eq('privacy_status', filters.privacyStatus);
  if (filters.processingStatus) q = q.eq('processing_status', filters.processingStatus);
  if (filters.createdByUserId) q = q.eq('created_by_user_id', filters.createdByUserId);
  if (filters.archived === true) q = q.not('archived_at', 'is', null);
  else if (filters.archived === false) q = q.is('archived_at', null);
  if (filters.trashed === true) q = q.not('trashed_at', 'is', null);
  else if (filters.trashed === false) q = q.is('trashed_at', null);
  else if (filters.archived !== true && filters.qualityCleanup !== true) {
    // Default library views exclude trash unless explicitly requested.
    q = q.is('trashed_at', null);
  }
  if (filters.qualityCleanup) {
    q = q
      .is('archived_at', null)
      .is('trashed_at', null)
      .is('lifecycle_kept_at', null)
      .or('ai_lifecycle_recommendation.in.(archive,trash),ai_usability.in.(poor,unusable)');
  }
  if (filters.duplicatesOnly) q = q.not('duplicate_of_asset_id', 'is', null);

  if (plan.kind === 'uuid') {
    // UUID comparison only when the term is a syntactically valid UUID.
    q = q.eq('id', plan.uuid);
  } else if (plan.kind === 'text') {
    // Authoritative tags: mil_asset_tags.tag_slug (RLS: mil_browse_asset_tags).
    // Tag lookup is capped (1000 rows) and unique asset ids fed to id.in are
    // further capped in buildTextSearchOrFilter — safe for internal MIL volume;
    // not a full-library search index.
    const { data: tagRows, error: tagErr } = await supabase
      .from('mil_asset_tags')
      .select('asset_id')
      .ilike('tag_slug', plan.ilikePattern)
      .limit(1000);
    if (tagErr) throw tagErr;
    const tagAssetIds = [...new Set((tagRows || []).map((r) => r.asset_id).filter(Boolean))];
    const orFilter = buildTextSearchOrFilter(plan.literal, tagAssetIds);
    if (!orFilter) return [];
    q = q.or(orFilter);
  }

  const { data, error } = await q;
  if (error) throw error;
  return data || [];
}

/**
 * Direct storage.createSignedUrl() is disabled for MIL. Every preview/download must
 * go through the media-intel-sign edge function so access is authorized server-side
 * (asset visibility, creator assignment, reel ownership, etc.) rather than trusting
 * whatever RLS the browser session happens to carry.
 */
export async function signedUrl() {
  throw new Error('Use requestSignedMediaUrl — direct storage signing disabled for MIL');
}

export async function assetPreviewUrl(asset) {
  const { requestSignedMediaUrl } = await import('./signedAccess');
  const thumb = (asset.mil_derivatives || []).find((d) => PREVIEW_DERIVATIVE_KINDS.includes(d.kind));
  try {
    const signed = await requestSignedMediaUrl({
      assetId: asset.id,
      purpose: 'preview',
      derivativeKind: thumb?.kind || null,
      allowOriginal: false,
    });
    return signed?.url || null;
  } catch (err) {
    console.warn('MIL preview sign failed — no direct storage fallback', err);
    return null;
  }
}

/**
 * Evidence-based preview/download state for Review Queue / Received.
 * Distinguishes source missing, derivative pending/failed, unsupported format,
 * and temporary unavailability — never collapses them into HEIC-only copy.
 */
export async function resolveReviewPreviewAccess(asset) {
  const { requestSignedMediaUrl } = await import('./signedAccess');
  const { resolveAssetPreviewAccess } = await import('./previewAccess');
  return resolveAssetPreviewAccess(asset, { requestSignedMediaUrl });
}

export async function fetchReviewBundle(assetId) {
  const [assetRes, aiRes, tagsRes, qualityRes, privacyRes, neighborsRes, relRes] = await Promise.all([
    supabase.from('mil_assets').select('*, mil_derivatives(*), mil_verified_metadata(*), mil_permitted_uses(*)').eq('id', assetId).single(),
    supabase.from('mil_ai_analyses').select('*').eq('asset_id', assetId).order('analyzed_at', { ascending: false }).limit(5),
    supabase.from('mil_asset_tags').select('*').eq('asset_id', assetId),
    supabase.from('mil_quality_scores').select('*').eq('asset_id', assetId),
    supabase.from('mil_privacy_findings').select('*').eq('asset_id', assetId),
    supabase.from('mil_assets').select('id, original_filename, capture_taken_at, created_at, media_kind').order('capture_taken_at', { ascending: true, nullsFirst: false }).limit(12),
    supabase.from('mil_asset_relationships').select('*').or(`left_asset_id.eq.${assetId},right_asset_id.eq.${assetId}`),
  ]);
  if (assetRes.error) throw assetRes.error;
  return {
    asset: assetRes.data,
    analyses: aiRes.data || [],
    tags: tagsRes.data || [],
    quality: qualityRes.data || [],
    privacy: privacyRes.data || [],
    neighbors: neighborsRes.data || [],
    relationships: relRes.data || [],
  };
}

/** Human verification is a SECURITY DEFINER RPC — it audits server-side. */
export async function verifyAssetMetadata(assetId, patch) {
  const { error } = await supabase.rpc('mil_verify_asset', {
    p_asset_id: assetId,
    p_patch: patch || {},
  });
  if (error) throw error;
}

export async function acceptAiSuggestions(assetId, analysisId) {
  const { data: analysis, error } = await supabase.from('mil_ai_analyses').select('*').eq('id', analysisId).single();
  if (error) throw error;
  const suggested = analysis.suggested || {};
  await verifyAssetMetadata(assetId, {
    service_category: suggested.service_category || null,
    work_phase: suggested.work_phase || null,
    condition_notes: suggested.condition_notes || null,
    location_component: suggested.location_component || null,
    narrative: suggested.narrative || null,
    public_caption: suggested.public_caption || null,
    alt_text: suggested.alt_text || null,
    unsuitable_uses: suggested.unsuitable_uses || [],
  });
  const tags = Array.isArray(suggested.tags) ? suggested.tags : [];
  if (tags.length) {
    const createdBy = await actorId();
    await supabase.from('mil_asset_tags').insert(
      tags.map((slug) => ({
        asset_id: assetId,
        tag_slug: slug,
        source: 'human_verified',
        created_by: createdBy,
      })),
    );
  }
}

/** Permitted-use gate changes are a SECURITY DEFINER RPC — it audits server-side. */
export async function setPermittedUse(assetId, useKey, approved, notes) {
  const { error } = await supabase.rpc('mil_set_permitted_use', {
    p_asset_id: assetId,
    p_use_key: useKey,
    p_approved: approved,
    p_notes: notes || null,
  });
  if (error) throw error;
}

export async function confirmBeforeAfter(relationshipId, confirm) {
  const { error } = await supabase
    .from('mil_asset_relationships')
    .update({
      verification_status: confirm ? 'confirmed' : 'rejected',
      relationship_type: confirm ? 'before_after' : 'possible_before_after',
      verified_by: await actorId(),
      verified_at: new Date().toISOString(),
    })
    .eq('id', relationshipId);
  if (error) throw error;
}

/** Reel review decisions are a SECURITY DEFINER RPC — it audits server-side. */
export async function reviewReelVersion({ versionId, decision, notes }) {
  if (!['approved', 'denied', 'revision_requested'].includes(decision)) {
    throw new Error('Invalid review decision');
  }
  const { error } = await supabase.rpc('mil_review_reel_version', {
    p_version_id: versionId,
    p_decision: decision,
    p_notes: notes?.trim() ? notes.trim() : null,
  });
  if (error) throw error;
}

/** Reel submission is a SECURITY DEFINER RPC — it audits server-side. */
export async function submitReelVersion(versionId) {
  const { error } = await supabase.rpc('mil_submit_reel_version', {
    p_version_id: versionId,
  });
  if (error) throw error;
}

/**
 * Deliberate raw-video / social-post submit (upload ≠ submit).
 * SECURITY DEFINER — idempotent when idempotencyKey is stable across retries.
 */
export async function submitContentPackage({
  submissionType,
  assetIds,
  title,
  contributorNotes,
  contextKind = 'general',
  contextLabel,
  caption,
  cta,
  hashtags,
  platforms,
  proposedPostAt,
  idempotencyKey,
} = {}) {
  if (!['raw_video', 'social_post'].includes(submissionType)) {
    throw new Error('submissionType must be raw_video or social_post');
  }
  const ids = (assetIds || []).filter(Boolean);
  if (!ids.length) throw new Error('At least one asset is required');
  const { data, error } = await supabase.rpc('mil_submit_content_package', {
    p_submission_type: submissionType,
    p_asset_ids: ids,
    p_title: title || null,
    p_contributor_notes: contributorNotes || null,
    p_context_kind: contextKind || 'general',
    p_context_label: contextLabel || null,
    p_caption: caption || null,
    p_cta: cta || null,
    p_hashtags: hashtags || null,
    p_platforms: platforms || null,
    p_proposed_post_at: proposedPostAt || null,
    p_idempotency_key: idempotencyKey || null,
  });
  if (error) throw error;
  return data;
}

export async function reviewContentSubmission({ submissionId, decision, notes } = {}) {
  if (!submissionId) throw new Error('Missing submissionId');
  const { error } = await supabase.rpc('mil_review_content_submission', {
    p_submission_id: submissionId,
    p_decision: decision,
    p_notes: notes?.trim() ? notes.trim() : null,
  });
  if (error) throw error;
}

/**
 * Canonical owner/contributor submission list for the unified Review Queue.
 * Optional context is left-joined — missing optional joins never hide a row.
 */
export async function listSubmissions(filters = {}) {
  let q = supabase
    .from('mil_submissions')
    .select(SUBMISSION_LIST_SELECT)
    .order('submitted_at', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false })
    .limit(filters.limit || 100);

  if (filters.contributorUserId) q = q.eq('contributor_user_id', filters.contributorUserId);
  if (filters.submissionType) q = q.eq('submission_type', filters.submissionType);
  if (filters.reviewStatus) {
    if (Array.isArray(filters.reviewStatus)) q = q.in('review_status', filters.reviewStatus);
    else q = q.eq('review_status', filters.reviewStatus);
  }
  if (filters.actionOwner) q = q.eq('action_owner', filters.actionOwner);
  if (filters.excludeDrafts !== false) {
    // Default: hide drafts from owner-action queues; contributors may pass excludeDrafts:false
    if (!filters.includeDrafts) q = q.neq('review_status', 'draft');
  }

  // Named queue filters (Release A)
  if (filters.queueFilter === 'needs_review') {
    q = q.eq('review_status', 'awaiting_owner_review').eq('action_owner', 'owner');
  } else if (filters.queueFilter === 'reel') {
    q = q.eq('submission_type', 'reel');
  } else if (filters.queueFilter === 'raw_video') {
    q = q.eq('submission_type', 'raw_video');
  } else if (filters.queueFilter === 'social_post') {
    q = q.eq('submission_type', 'social_post');
  } else if (filters.queueFilter === 'changes_requested') {
    q = q.eq('review_status', 'changes_requested');
  } else if (filters.queueFilter === 'approved') {
    q = q.in('review_status', ['approved', 'ready_to_post']);
  }

  const { data, error } = await q;
  if (error) throw error;
  return data || [];
}

/** Owner-action badge count — excludes contributor-waiting rows. */
export async function countOwnerActionSubmissions() {
  const { count, error } = await supabase
    .from('mil_submissions')
    .select('id', { count: 'exact', head: true })
    .eq('review_status', 'awaiting_owner_review')
    .eq('action_owner', 'owner');
  if (error) throw error;
  return count || 0;
}

/**
 * Lifecycle disposition (keep / archive / trash / restore / permanent_delete).
 * SECURITY DEFINER RPC — audits server-side. AI never calls this.
 */
export async function setAssetLifecycle(assetId, action, reason = null) {
  const { data, error } = await supabase.rpc('mil_set_asset_lifecycle', {
    p_asset_id: assetId,
    p_action: action,
    p_reason: reason?.trim() ? reason.trim() : null,
  });
  if (error) throw error;
  return data;
}

export async function setAssetsLifecycle(assetIds, action, reason = null) {
  const ids = (assetIds || []).filter(Boolean);
  if (!ids.length) throw new Error('No assets selected');
  const { data, error } = await supabase.rpc('mil_set_assets_lifecycle', {
    p_asset_ids: ids,
    p_action: action,
    p_reason: reason?.trim() ? reason.trim() : null,
  });
  if (error) throw error;
  return data;
}

/**
 * Privacy-restrict state changes via mil_set_asset_archive_state.
 * Archive/restore prefer mil_set_asset_lifecycle (reviewer-capable).
 */
async function setAssetArchiveState(assetId, action) {
  const { error } = await supabase.rpc('mil_set_asset_archive_state', {
    p_asset_id: assetId,
    p_action: action,
  });
  if (error) throw error;
}

export const archiveAsset = (assetId, reason) => setAssetLifecycle(assetId, 'archive', reason);
export const trashAsset = (assetId, reason) => setAssetLifecycle(assetId, 'trash', reason);
export const keepAsset = (assetId, reason) => setAssetLifecycle(assetId, 'keep', reason);
export const restoreAsset = (assetId, reason) => setAssetLifecycle(assetId, 'restore', reason);
export const permanentlyDeleteAsset = (assetId, reason) =>
  setAssetLifecycle(assetId, 'permanent_delete', reason);
export const restrictAsset = (assetId) => setAssetArchiveState(assetId, 'restrict');
export const unrestrictAsset = (assetId) => setAssetArchiveState(assetId, 'unrestrict');

export async function getAiConfigState() {
  try {
    const { data, error } = await supabase.functions.invoke('media-intel-analyze', {
      body: { action: 'config_status' },
    });
    if (error) {
      return { configured: false, message: 'AI analysis function unavailable. Manual review still works.' };
    }
    return {
      configured: Boolean(data?.configured),
      provider: data?.provider || null,
      message: data?.message || (data?.configured ? 'AI analysis is configured.' : 'AI key not configured. Uploads and manual review still work.'),
    };
  } catch {
    return { configured: false, message: 'AI analysis not reachable. Manual review still works.' };
  }
}

/**
 * On-demand AI analysis. The browser must NOT insert mil_processing_jobs or
 * mutate mil_assets.processing_status — RLS only allows SELECT on jobs, and
 * finalize already creates queued rows server-side. This invokes the edge
 * function (staff-gated), which claims or creates the job via service_role.
 */
export async function queueAiAnalysis(assetId) {
  if (!assetId) throw new Error('Missing assetId');
  const { data, error } = await supabase.functions.invoke('media-intel-analyze', {
    body: { action: 'analyze', assetId },
  });
  if (error) {
    const detail = (data && data.error) || error.message || 'AI analysis invoke failed';
    throw new Error(detail);
  }
  if (data?.error) throw new Error(data.error);
  return data;
}

/**
 * Owner/admin only (edge-enforced). Pulls existing website promotions for an asset.
 * Promote / prepare_public_safe remain 503 on the edge — do not call them from the client.
 *
 * Body contract: { action: 'unpublish', assetId }
 * Success: { ok: true, results: [{ promotionId, ok }] }
 */
export async function unpublishWebsiteMedia(assetId) {
  const id = typeof assetId === 'string' ? assetId.trim() : '';
  if (!id) throw new Error('Missing assetId');
  const { data, error } = await supabase.functions.invoke('media-intel-promote-website', {
    body: { action: 'unpublish', assetId: id },
  });
  if (error) {
    const detail = (data && data.error) || error.message || 'Website unpublish failed';
    throw new Error(detail);
  }
  if (data?.error) throw new Error(data.error);
  if (data?.ok === false) {
    const failed = (data.results || []).filter((r) => !r.ok).map((r) => r.error || r.promotionId);
    throw new Error(failed.length ? `Unpublish incomplete: ${failed.join('; ')}` : 'Unpublish incomplete');
  }
  return data;
}

const MIL_ASSET_UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** Normalize + validate an asset UUID for collection membership writes. */
export function normalizeMilAssetId(value) {
  const id = typeof value === 'string' ? value.trim() : '';
  if (!MIL_ASSET_UUID_RE.test(id)) return null;
  return id.toLowerCase();
}

/**
 * Collections membership uses direct table RLS
 * (mil_library_staff_write_collections / mil_library_staff_write_collection_items
 * gated by mil_can_browse_library). No SECURITY DEFINER RPC exists for these
 * tables — keep helpers thin and do not invent privileged paths.
 */
export async function listCollections() {
  const { data, error } = await supabase
    .from('mil_collections')
    .select('*, mil_collection_items(count)')
    .is('archived_at', null)
    .order('updated_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function createCollection({ title, description } = {}) {
  const trimmed = typeof title === 'string' ? title.trim() : '';
  if (!trimmed) throw new Error('Collection title is required');
  const ownerUserId = await actorId();
  const { data, error } = await supabase
    .from('mil_collections')
    .insert({
      title: trimmed,
      description: typeof description === 'string' && description.trim()
        ? description.trim()
        : null,
      owner_user_id: ownerUserId,
      visibility: 'internal',
    })
    .select('*')
    .single();
  if (error) throw error;
  return data;
}

export async function listCollectionItems(collectionId) {
  const id = typeof collectionId === 'string' ? collectionId.trim() : '';
  if (!id) throw new Error('Missing collectionId');
  const { data, error } = await supabase
    .from('mil_collection_items')
    .select('collection_id, asset_id, sort_order, notes, added_at, mil_assets(id, original_filename, media_kind)')
    .eq('collection_id', id)
    .order('sort_order', { ascending: true })
    .order('added_at', { ascending: true });
  if (error) throw error;
  return data || [];
}

export async function addCollectionItem(collectionId, assetId) {
  const cid = typeof collectionId === 'string' ? collectionId.trim() : '';
  const aid = normalizeMilAssetId(assetId);
  if (!cid) throw new Error('Missing collectionId');
  if (!aid) throw new Error('Enter a valid asset UUID');
  const { data, error } = await supabase
    .from('mil_collection_items')
    .insert({
      collection_id: cid,
      asset_id: aid,
      added_by: await actorId(),
    })
    .select('collection_id, asset_id, sort_order, notes, added_at')
    .single();
  if (error) throw error;
  return data;
}

export async function removeCollectionItem(collectionId, assetId) {
  const cid = typeof collectionId === 'string' ? collectionId.trim() : '';
  const aid = normalizeMilAssetId(assetId);
  if (!cid) throw new Error('Missing collectionId');
  if (!aid) throw new Error('Enter a valid asset UUID');
  const { error } = await supabase
    .from('mil_collection_items')
    .delete()
    .eq('collection_id', cid)
    .eq('asset_id', aid);
  if (error) throw error;
}

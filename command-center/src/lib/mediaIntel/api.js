import { supabase } from '@/lib/customSupabaseClient';
import { PREVIEW_DERIVATIVE_KINDS } from './derivativeKinds';

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

  const results = await Promise.all([
    base().eq('media_kind', 'photo').is('archived_at', null),
    base().eq('media_kind', 'video').is('archived_at', null),
    base().is('archived_at', null).gte('created_at', new Date(Date.now() - 7 * 864e5).toISOString()),
    base().in('processing_status', ['queued', 'analyzing']).is('archived_at', null),
    base().eq('human_review_status', 'pending').is('archived_at', null),
    base().not('duplicate_of_asset_id', 'is', null).is('archived_at', null),
    base().in('privacy_status', ['needs_review', 'needs_redaction']).is('archived_at', null),
    supabase.from('mil_permitted_uses').select('asset_id', { count: 'exact', head: true }).eq('use_key', 'reel_creation').eq('approved', true),
    supabase.from('mil_creator_assignments').select('id', { count: 'exact', head: true }).eq('status', 'active'),
    supabase.from('mil_processing_jobs').select('id', { count: 'exact', head: true }).eq('status', 'failed'),
    supabase.from('mil_asset_relationships').select('id', { count: 'exact', head: true }).eq('relationship_type', 'possible_before_after').eq('verification_status', 'unverified'),
    supabase.from('mil_reel_versions').select('id', { count: 'exact', head: true }).eq('status', 'submitted_for_review'),
    supabase.from('mil_reel_versions').select('id', { count: 'exact', head: true }).eq('status', 'approved_to_post'),
  ]);

  const firstError = results.find((r) => r?.error)?.error;
  if (firstError) throw firstError;

  const [
    photos, videos, recent, awaitingAi, awaitingReview, duplicates, privacy,
    marketing, assigned, failedJobs, baUnverified, reelsAwaiting, reelsApproved,
  ] = results;

  return {
    totalPhotos: photos.count || 0,
    totalVideos: videos.count || 0,
    recentlyUploaded: recent.count || 0,
    awaitingAi: awaitingAi.count || 0,
    awaitingHumanReview: awaitingReview.count || 0,
    possibleDuplicates: duplicates.count || 0,
    possibleBeforeAfter: baUnverified.count || 0,
    privacyWarnings: privacy.count || 0,
    approvedForMarketing: marketing.count || 0,
    assignedToCreator: assigned.count || 0,
    reelsAwaitingReview: reelsAwaiting.count || 0,
    approvedReelsReady: reelsApproved.count || 0,
    failedJobs: failedJobs.count || 0,
  };
}

export async function listAssets(filters = {}) {
  let q = supabase
    .from('mil_assets')
    .select('*, mil_derivatives(id, kind, object_path, bucket), mil_verified_metadata(*)')
    .order('created_at', { ascending: false })
    .limit(filters.limit || 60);

  if (filters.mediaKind) q = q.eq('media_kind', filters.mediaKind);
  if (filters.humanReviewStatus) q = q.eq('human_review_status', filters.humanReviewStatus);
  if (filters.privacyStatus) q = q.eq('privacy_status', filters.privacyStatus);
  if (filters.processingStatus) q = q.eq('processing_status', filters.processingStatus);
  if (filters.archived === true) q = q.not('archived_at', 'is', null);
  else if (filters.archived === false) q = q.is('archived_at', null);
  if (filters.duplicatesOnly) q = q.not('duplicate_of_asset_id', 'is', null);
  if (filters.search) {
    q = q.or(`original_filename.ilike.%${filters.search}%,id.eq.${filters.search}`);
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
 * Archive / restore / privacy-restrict state changes are all a single SECURITY
 * DEFINER RPC (mil_set_asset_archive_state) — it audits server-side.
 */
async function setAssetArchiveState(assetId, action) {
  const { error } = await supabase.rpc('mil_set_asset_archive_state', {
    p_asset_id: assetId,
    p_action: action,
  });
  if (error) throw error;
}

export const archiveAsset = (assetId) => setAssetArchiveState(assetId, 'archive');
export const restoreAsset = (assetId) => setAssetArchiveState(assetId, 'restore');
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

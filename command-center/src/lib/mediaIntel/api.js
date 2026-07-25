import { supabase } from '@/lib/customSupabaseClient';
import { MIL_DERIVATIVES_BUCKET, MIL_ORIGINALS_BUCKET } from './constants';

async function actorId() {
  const { data } = await supabase.auth.getUser();
  return data?.user?.id || null;
}

export async function audit(action, targetType, targetId, details = {}) {
  return supabase.from('mil_audit_events').insert({
    actor_user_id: await actorId(),
    action,
    target_type: targetType,
    target_id: targetId,
    details,
  });
}

export async function fetchDashboardStats() {
  const base = () => supabase.from('mil_assets').select('id', { count: 'exact', head: true });

  const [
    photos, videos, recent, awaitingAi, awaitingReview, duplicates, privacy,
    marketing, assigned, failedJobs, baUnverified, reelsAwaiting, reelsApproved,
  ] = await Promise.all([
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
  if (filters.search) {
    q = q.or(`original_filename.ilike.%${filters.search}%,id.eq.${filters.search}`);
  }

  const { data, error } = await q;
  if (error) throw error;
  return data || [];
}

export async function signedUrl(bucket, path, expiresIn = 300) {
  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, expiresIn);
  if (error) throw error;
  return data.signedUrl;
}

export async function assetPreviewUrl(asset) {
  const { requestSignedMediaUrl } = await import('./signedAccess');
  try {
    const thumb = (asset.mil_derivatives || []).find((d) =>
      ['grid_thumb', 'detail_preview', 'heic_preview', 'video_thumb'].includes(d.kind),
    );
    const signed = await requestSignedMediaUrl({
      assetId: asset.id,
      purpose: 'preview',
      derivativeKind: thumb?.kind || null,
      allowOriginal: false,
    });
    return signed.url;
  } catch {
    const thumb = (asset.mil_derivatives || []).find((d) =>
      ['grid_thumb', 'detail_preview', 'heic_preview', 'video_thumb'].includes(d.kind),
    );
    if (thumb) return signedUrl(thumb.bucket || MIL_DERIVATIVES_BUCKET, thumb.object_path, 300);
    if (asset.media_kind === 'photo' && !String(asset.mime_type).includes('heic')) {
      return signedUrl(asset.original_bucket || MIL_ORIGINALS_BUCKET, asset.original_path, 300);
    }
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

export async function verifyAssetMetadata(assetId, patch) {
  const userId = await actorId();
  const { error } = await supabase.from('mil_verified_metadata').upsert({
    asset_id: assetId,
    ...patch,
    verified_by: userId,
    verified_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });
  if (error) throw error;
  await supabase.from('mil_assets').update({ human_review_status: 'verified' }).eq('id', assetId);
  await audit('human_verification', 'mil_assets', assetId, { patch });
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
  await audit('ai_suggestion_accepted', 'mil_ai_analyses', analysisId, { assetId });
}

export async function setPermittedUse(assetId, useKey, approved, notes) {
  const { error } = await supabase.from('mil_permitted_uses').upsert({
    asset_id: assetId,
    use_key: useKey,
    approved,
    approved_by: await actorId(),
    approved_at: approved ? new Date().toISOString() : null,
    notes: notes || null,
  });
  if (error) throw error;
  await audit('permitted_use_change', 'mil_assets', assetId, { useKey, approved, notes });
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
  await audit(confirm ? 'before_after_confirmed' : 'before_after_rejected', 'mil_asset_relationships', relationshipId, {});
}

export async function reviewReelVersion({ versionId, decision, notes }) {
  if (!['approved', 'denied', 'revision_requested'].includes(decision)) {
    throw new Error('Invalid review decision');
  }
  const statusMap = {
    approved: 'approved_to_post',
    denied: 'denied',
    revision_requested: 'revision_requested',
  };
  const { data: version, error: vErr } = await supabase
    .from('mil_reel_versions')
    .select('*, mil_reel_projects!inner(id, status)')
    .eq('id', versionId)
    .single();
  if (vErr) throw vErr;

  const { error } = await supabase
    .from('mil_reel_versions')
    .update({
      status: statusMap[decision],
      review_decision: decision,
      review_notes: notes?.trim() ? notes.trim() : null,
      reviewed_by: await actorId(),
      reviewed_at: new Date().toISOString(),
    })
    .eq('id', versionId);
  if (error) throw error;

  await supabase.from('mil_reel_projects').update({ status: statusMap[decision] }).eq('id', version.project_id);
  await audit(`reel_${decision}`, 'mil_reel_versions', versionId, {
    notes: notes?.trim() ? notes.trim() : null,
    notesProvided: Boolean(notes?.trim()),
  });
}

export async function submitReelVersion(versionId) {
  const { error } = await supabase
    .from('mil_reel_versions')
    .update({ status: 'submitted_for_review', submitted_at: new Date().toISOString() })
    .eq('id', versionId);
  if (error) throw error;
  const { data: version } = await supabase.from('mil_reel_versions').select('project_id').eq('id', versionId).single();
  if (version?.project_id) {
    await supabase.from('mil_reel_projects').update({ status: 'submitted_for_review' }).eq('id', version.project_id);
  }
  await audit('reel_submission', 'mil_reel_versions', versionId, {});
}

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

export async function queueAiAnalysis(assetId) {
  const { error } = await supabase.from('mil_processing_jobs').insert({
    asset_id: assetId,
    job_type: 'ai_analyze',
    status: 'queued',
  });
  if (error) throw error;
  await supabase.from('mil_assets').update({ processing_status: 'queued' }).eq('id', assetId);
  supabase.functions.invoke('media-intel-analyze', {
    body: { action: 'analyze', assetId },
  }).catch(() => {});
}

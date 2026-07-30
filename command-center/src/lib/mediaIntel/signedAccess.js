import { supabase } from '@/lib/customSupabaseClient';

/**
 * Server-authorized short-lived signed URL.
 * Falls back to direct storage sign only when edge is unavailable AND caller already
 * has RLS select (staff). Prefer edge in production.
 */
export async function requestSignedMediaUrl({
  assetId = null,
  reelVersionId = null,
  purpose = 'preview',
  derivativeKind = null,
  allowOriginal = false,
}) {
  const { data, error } = await supabase.functions.invoke('media-intel-sign', {
    body: { assetId, reelVersionId, purpose, derivativeKind, allowOriginal },
  });
  if (error) throw new Error(error.message || 'Unable to authorize media access');
  if (data?.error) throw new Error(data.error);
  return data;
}

/** Creator/staff reel preview — never use client storage.createSignedUrl for reels. */
export async function requestSignedReelUrl(reelVersionId, purpose = 'preview') {
  return requestSignedMediaUrl({ reelVersionId, purpose });
}

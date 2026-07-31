import { supabase } from '@/lib/customSupabaseClient';

/**
 * Server-authorized short-lived signed URL.
 * Falls back to direct storage sign only when edge is unavailable AND caller already
 * has RLS select (staff). Prefer edge in production.
 */
function signedMediaError(message, extras = {}) {
  const err = new Error(message || 'Unable to authorize media access');
  if (extras.code) err.code = extras.code;
  if (extras.kind) err.kind = extras.kind;
  if (extras.status != null) err.status = extras.status;
  return err;
}

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
  let body = data && typeof data === 'object' ? data : null;
  // Non-2xx often lands in error.context (Response) while data is null.
  if (!body?.error && error?.context) {
    try {
      if (typeof error.context.json === 'function') {
        body = await error.context.json();
      } else if (typeof error.context.text === 'function') {
        const raw = await error.context.text();
        body = raw ? JSON.parse(raw) : null;
      }
    } catch {
      /* keep body null */
    }
  }
  // Edge may return structured { error, code } — preserve code for classifiers.
  if (body?.error) {
    throw signedMediaError(body.error, {
      code: body.code || null,
      kind: body.kind || null,
      status: body.code ? 404 : 500,
    });
  }
  if (error) {
    throw signedMediaError(error.message || 'Unable to authorize media access', {
      code: null,
      status: null,
    });
  }
  return body || data;
}

/** Creator/staff reel preview — never use client storage.createSignedUrl for reels. */
export async function requestSignedReelUrl(reelVersionId, purpose = 'preview') {
  return requestSignedMediaUrl({ reelVersionId, purpose });
}

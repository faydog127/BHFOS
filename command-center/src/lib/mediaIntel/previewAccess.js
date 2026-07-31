/**
 * Evidence-based preview / download access classification for MIL review surfaces.
 * Missing signed URL, expired URL, processing state, and storage 404 are distinct.
 */
import { PREVIEW_DERIVATIVE_KINDS } from './derivativeKinds.js';

export const PREVIEW_STATES = Object.freeze({
  READY: 'ready',
  SOURCE_MISSING: 'source_missing',
  DERIVATIVE_PENDING: 'derivative_pending',
  DERIVATIVE_FAILED: 'derivative_failed',
  FORMAT_UNSUPPORTED: 'format_unsupported',
  TEMPORARILY_UNAVAILABLE: 'temporarily_unavailable',
});

const PENDING_PROCESSING = new Set(['queued', 'uploaded', 'analyzing', 'processing', 'deriving']);
const FAILED_PROCESSING = new Set(['processing_failed', 'failed']);

const BROWSER_IMAGE_EXT = /\.(jpe?g|png|gif|webp|bmp)$/i;
const BROWSER_VIDEO_EXT = /\.(mp4|webm|ogg)$/i;
const HEIC_EXT = /\.(heic|heif)$/i;
const BROWSER_IMAGE_MIME = /^(image\/(jpeg|jpg|png|gif|webp|bmp))$/i;
const BROWSER_VIDEO_MIME = /^(video\/(mp4|webm|ogg))$/i;
const HEIC_MIME = /heic|heif/i;

export function isHeicLikeAsset(asset) {
  const name = String(asset?.original_filename || '');
  const mime = String(asset?.mime_type || '');
  return HEIC_EXT.test(name) || HEIC_MIME.test(mime);
}

/** Formats the browser can usually render from an original without a derivative. */
export function isBrowserPreviewableOriginal(asset) {
  if (isHeicLikeAsset(asset)) return false;
  const name = String(asset?.original_filename || '');
  const mime = String(asset?.mime_type || '');
  if (BROWSER_IMAGE_MIME.test(mime) || BROWSER_VIDEO_MIME.test(mime)) return true;
  if (BROWSER_IMAGE_EXT.test(name) || BROWSER_VIDEO_EXT.test(name)) return true;
  const kind = String(asset?.media_kind || '').toLowerCase();
  if (kind === 'video' && BROWSER_VIDEO_EXT.test(name || '.mp4')) return true;
  return false;
}

export function pickPreviewDerivative(asset) {
  const rows = asset?.mil_derivatives || [];
  return rows.find((d) => PREVIEW_DERIVATIVE_KINDS.includes(d.kind))
    || rows.find((d) => d.kind === 'video_preview')
    || null;
}

export function processingBucket(status) {
  const s = String(status || '');
  if (FAILED_PROCESSING.has(s)) return 'failed';
  if (PENDING_PROCESSING.has(s)) return 'pending';
  return 'other';
}

export function isStorageMissingCode(code) {
  return code === 'SOURCE_OBJECT_MISSING' || code === 'DERIVATIVE_OBJECT_MISSING';
}

export function isStorageMissingMessage(message) {
  const m = String(message || '').toLowerCase();
  // Do not treat API "Derivative not found" / "Media not found" as storage 404 evidence.
  return (
    m.includes('object not found')
    || m.includes('no such object')
    || m.includes('source object not found')
    || m.includes('derivative object not found')
    || (m.includes('does not exist') && m.includes('object'))
  );
}

export function previewStateCopy(state) {
  switch (state) {
    case PREVIEW_STATES.SOURCE_MISSING:
      return {
        title: 'File unavailable',
        message:
          'The source file could not be found in storage. This submission cannot be previewed or downloaded.',
      };
    case PREVIEW_STATES.DERIVATIVE_PENDING:
      return {
        title: 'Preview processing',
        message:
          'A browser-safe preview is still being generated. The original remains stored privately.',
      };
    case PREVIEW_STATES.DERIVATIVE_FAILED:
      return {
        title: 'Preview failed',
        message:
          'Browser-safe preview generation failed. The original may still be stored, but this item cannot be previewed here yet.',
      };
    case PREVIEW_STATES.FORMAT_UNSUPPORTED:
      return {
        title: 'Preview not supported',
        message:
          'This format cannot be shown directly in the browser. A browser-safe preview derivative is required.',
      };
    case PREVIEW_STATES.TEMPORARILY_UNAVAILABLE:
      return {
        title: 'Preview temporarily unavailable',
        message:
          'Preview could not be loaded right now. Try again in a moment — this is not confirmed as a missing file.',
      };
    case PREVIEW_STATES.READY:
      return { title: 'Ready', message: '' };
    default:
      return {
        title: 'Preview temporarily unavailable',
        message:
          'Preview could not be loaded right now. Try again in a moment — this is not confirmed as a missing file.',
      };
  }
}

/**
 * Pure classifier from collected evidence. Callers must not invent storage 404s
 * from a bare null URL or from processing_status alone.
 *
 * @param {{
 *   asset: object,
 *   previewSign?: { ok: boolean, url?: string|null, kind?: string|null, code?: string|null, error?: string|null, httpStatus?: number|null }|null,
 *   probe?: { ok: boolean, status?: number|null, expired?: boolean }|null,
 *   sourceSign?: { ok: boolean, code?: string|null, error?: string|null, httpStatus?: number|null }|null,
 * }} evidence
 */
export function classifyPreviewAccess(evidence) {
  const asset = evidence?.asset || {};
  const previewSign = evidence?.previewSign || null;
  const probe = evidence?.probe ?? null;
  const sourceSign = evidence?.sourceSign || null;
  const der = pickPreviewDerivative(asset);
  const needsDerivative = !isBrowserPreviewableOriginal(asset);
  const proc = processingBucket(asset.processing_status);

  // A signed preview URL is usable when probe confirms it, or when the probe is
  // inconclusive (CORS/network) — only an HTTP 404 probe is missing-object evidence.
  const probeAllowsReady =
    !probe
    || probe.ok
    || (probe.status == null && !probe.expired);
  if (previewSign?.ok && previewSign.url && probeAllowsReady) {
    const sourceMissing = isConfirmedSourceMissing({
      previewSign: null,
      probe: null,
      sourceSign,
      needsDerivative,
      hasDerivative: Boolean(der),
    });
    return finalize(
      PREVIEW_STATES.READY,
      previewSign.url,
      true,
      sourceMissing ? false : sourceDownloadable(sourceSign, true),
    );
  }

  const sourceMissingConfirmed = isConfirmedSourceMissing({
    previewSign,
    probe,
    sourceSign,
    needsDerivative,
    hasDerivative: Boolean(der),
  });

  if (sourceMissingConfirmed) {
    return finalize(PREVIEW_STATES.SOURCE_MISSING, null, false, false);
  }

  // Derivative row signed but object 404 — not the same as source missing.
  if (
    previewSign?.ok
    && previewSign.kind
    && previewSign.kind !== 'original'
    && probe
    && !probe.ok
    && !probe.expired
    && Number(probe.status) === 404
  ) {
    return finalize(PREVIEW_STATES.DERIVATIVE_FAILED, null, false, sourceDownloadable(sourceSign));
  }

  if (previewSign?.code === 'DERIVATIVE_OBJECT_MISSING') {
    return finalize(PREVIEW_STATES.DERIVATIVE_FAILED, null, false, sourceDownloadable(sourceSign));
  }

  if (probe?.expired || (probe && !probe.ok && Number(probe.status) === 400)) {
    return finalize(PREVIEW_STATES.TEMPORARILY_UNAVAILABLE, null, false, sourceDownloadable(sourceSign));
  }

  // No usable preview URL yet — classify without treating null URL as missing.
  if (needsDerivative && !der) {
    if (proc === 'pending') {
      return finalize(PREVIEW_STATES.DERIVATIVE_PENDING, null, false, sourceDownloadable(sourceSign));
    }
    if (proc === 'failed') {
      return finalize(PREVIEW_STATES.DERIVATIVE_FAILED, null, false, sourceDownloadable(sourceSign));
    }
    return finalize(PREVIEW_STATES.FORMAT_UNSUPPORTED, null, false, sourceDownloadable(sourceSign));
  }

  if (!needsDerivative && !der && proc === 'failed' && previewSign && !previewSign.ok) {
    // Browser-native format with failed processing: still try original; failure
    // without storage-missing evidence is temporary, not HEIC guidance.
    return finalize(PREVIEW_STATES.TEMPORARILY_UNAVAILABLE, null, false, sourceDownloadable(sourceSign));
  }

  if (previewSign && !previewSign.ok) {
    if (previewSign.code === 'SOURCE_OBJECT_MISSING') {
      return finalize(PREVIEW_STATES.SOURCE_MISSING, null, false, false);
    }
    return finalize(PREVIEW_STATES.TEMPORARILY_UNAVAILABLE, null, false, sourceDownloadable(sourceSign));
  }

  if (needsDerivative && der && proc === 'pending' && (!previewSign || !previewSign.ok)) {
    return finalize(PREVIEW_STATES.DERIVATIVE_PENDING, null, false, sourceDownloadable(sourceSign));
  }

  return finalize(PREVIEW_STATES.TEMPORARILY_UNAVAILABLE, null, false, sourceDownloadable(sourceSign));
}

function isConfirmedSourceMissing({ previewSign, probe, sourceSign, needsDerivative, hasDerivative }) {
  if (sourceSign?.code === 'SOURCE_OBJECT_MISSING') return true;
  if (
    sourceSign
    && !sourceSign.ok
    && (sourceSign.code === 'SOURCE_OBJECT_MISSING'
      || (isStorageMissingMessage(sourceSign.error)
        && sourceSign.code !== 'DERIVATIVE_OBJECT_MISSING'))
  ) {
    return true;
  }
  // Signed original URL that 404s on fetch — storage evidence, not "no URL yet".
  if (
    previewSign?.ok
    && (previewSign.kind === 'original' || previewSign.kind == null)
    && probe
    && !probe.ok
    && !probe.expired
    && Number(probe.status) === 404
  ) {
    return true;
  }
  // Preview sign targeted original (browser-native, no derivative) and storage said missing.
  if (
    previewSign
    && !previewSign.ok
    && !needsDerivative
    && !hasDerivative
    && (previewSign.code === 'SOURCE_OBJECT_MISSING'
      || (isStorageMissingMessage(previewSign.error)
        && previewSign.code !== 'DERIVATIVE_OBJECT_MISSING'))
  ) {
    return true;
  }
  if (previewSign?.code === 'SOURCE_OBJECT_MISSING') return true;
  return false;
}

function sourceDownloadable(sourceSign, previewReady = false) {
  if (!sourceSign) return Boolean(previewReady);
  if (sourceSign.code === 'SOURCE_OBJECT_MISSING') return false;
  if (!sourceSign.ok && isStorageMissingMessage(sourceSign.error)) return false;
  return Boolean(sourceSign.ok);
}

function finalize(state, url, canPreview, canDownload) {
  const copy = previewStateCopy(state);
  return {
    state,
    url: url || null,
    title: copy.title,
    message: copy.message,
    canPreview: Boolean(canPreview && url),
    canDownload: Boolean(canDownload),
  };
}

/**
 * Probe a just-issued signed URL. Distinguishes 404 (missing) from expiry/auth.
 * Injectable for tests.
 */
export async function probeSignedMediaUrl(url, fetchImpl = globalThis.fetch) {
  if (!url) return { ok: false, status: null, expired: false };
  try {
    const res = await fetchImpl(url, {
      method: 'GET',
      headers: { Range: 'bytes=0-0' },
    });
    const status = res.status;
    const bodyText = status >= 400 ? await res.text().catch(() => '') : '';
    const expired =
      status === 400
      || status === 401
      || /expired|invalid.*token|jwt/i.test(bodyText);
    if (status === 200 || status === 206 || status === 304) {
      return { ok: true, status, expired: false };
    }
    return { ok: false, status, expired };
  } catch {
    // Network/CORS failures are not storage-404 evidence.
    return { ok: false, status: null, expired: false };
  }
}

/**
 * Resolve preview/download access with injectable sign + probe helpers.
 */
export async function resolveAssetPreviewAccess(asset, deps = {}) {
  const requestSigned = deps.requestSignedMediaUrl;
  const probe = deps.probeSignedMediaUrl || probeSignedMediaUrl;
  if (typeof requestSigned !== 'function') {
    throw new Error('resolveAssetPreviewAccess requires requestSignedMediaUrl');
  }

  const der = pickPreviewDerivative(asset);
  const needsDerivative = !isBrowserPreviewableOriginal(asset);

  let previewSign = null;
  let probeResult = null;

  // Staff review may fall through to a signed original when no preview derivative
  // exists (preserves working HEIC originals in Safari). Browser-native formats
  // also use originals. MP4/JPEG missing objects are classified via sign code + probe,
  // never via HEIC-only copy.
  try {
    const signed = await requestSigned({
      assetId: asset.id,
      purpose: 'preview',
      derivativeKind: der?.kind || null,
      allowOriginal: !der,
    });
    previewSign = {
      ok: Boolean(signed?.url),
      url: signed?.url || null,
      kind: signed?.kind || (der?.kind || 'original'),
      code: null,
      error: null,
      httpStatus: 200,
    };
    if (previewSign.url) {
      probeResult = await probe(previewSign.url);
      // Storage may issue a signed URL even when the object is gone — probe decides.
      if (probeResult && !probeResult.ok && !probeResult.expired && Number(probeResult.status) === 404) {
        previewSign = {
          ...previewSign,
          ok: false,
          code: previewSign.kind === 'original' || !der ? 'SOURCE_OBJECT_MISSING' : 'DERIVATIVE_OBJECT_MISSING',
          error: 'Signed URL probe returned 404',
        };
      }
    }
  } catch (err) {
    previewSign = {
      ok: false,
      url: null,
      kind: err?.kind || der?.kind || 'original',
      code: err?.code || null,
      error: err?.message || String(err),
      httpStatus: err?.status || null,
    };
  }

  // Separate source existence check for download affordance + missing-file confirmation.
  let sourceSign = null;
  try {
    const signed = await requestSigned({
      assetId: asset.id,
      purpose: 'download',
      derivativeKind: null,
      allowOriginal: true,
    });
    sourceSign = {
      ok: Boolean(signed?.url),
      code: null,
      error: null,
      httpStatus: 200,
      url: signed?.url || null,
    };
  } catch (err) {
    sourceSign = {
      ok: false,
      code: err?.code || null,
      error: err?.message || String(err),
      httpStatus: err?.status || null,
    };
  }

  return classifyPreviewAccess({
    asset,
    previewSign,
    probe: probeResult,
    sourceSign,
  });
}

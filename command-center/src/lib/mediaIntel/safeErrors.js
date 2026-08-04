/**
 * Client-safe MIL error redaction (Phase 2A remediation).
 * Internal logs may keep detail; responses must not.
 */

export const PUBLIC_ERROR_CATALOG = Object.freeze({
  MEDIA_NOT_AVAILABLE: 'This media is not available.',
  MEDIA_ACCESS_DENIED: 'You do not have access to this media.',
  MEDIA_ARCHIVED: 'This media is archived and cannot be opened.',
  MEDIA_TRASHED: 'This media is in trash and cannot be opened.',
  MEDIA_SOURCE_MISSING: 'The media file is not available.',
  REEL_VERSION_UNAVAILABLE: 'This reel version is not available.',
  PUBLIC_DERIVATIVE_NOT_ELIGIBLE: 'This media is not eligible for public access.',
  PUBLIC_PROMOTION_UNAVAILABLE: 'Public media promotion is not currently available.',
  INTERNAL_ERROR: 'Something went wrong. Please try again.',
  SIGN_IN_REQUIRED: 'Sign in required.',
  INVALID_REQUEST: 'Invalid request.',
});

const SENSITIVE_PATTERNS = [
  /wwyxohjnyqnegzbxtuxs/i,
  /sdzhdupekcnekesbtxsl/i,
  /[a-z0-9-]+\.supabase\.co/i,
  /media-intel-originals/i,
  /media-intel-derivatives/i,
  /website-public-media/i,
  /\bmil\/[^\s"']+/i,
  /object_path|storage_path|storage_bucket/i,
  /violates (unique|check|foreign key|not-null) constraint/i,
  /duplicate key value/i,
  /permission denied for/i,
  /PGRST\d+/i,
  /postgres|sqlstate|relation "|column "/i,
  /at\s+\S+\s+\(.*:\d+:\d+\)/i,
  /stack trace/i,
  /service_role|SUPABASE_SERVICE|sbp_/i,
];

export function newCorrelationId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `mil-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function isSensitiveErrorText(text) {
  const s = String(text || '');
  return SENSITIVE_PATTERNS.some((re) => re.test(s));
}

/**
 * Map an internal decision/exception to a stable public client payload.
 * @returns {{ error: string, code: string, correlationId: string }}
 */
export function redactErrorForClient(input, { correlationId, fallbackCode = 'INTERNAL_ERROR' } = {}) {
  const cid = correlationId || newCorrelationId();
  let code = fallbackCode;
  let message = null;

  if (input && typeof input === 'object') {
    const candidate = String(input.code || input.publicCode || '').trim();
    if (candidate && PUBLIC_ERROR_CATALOG[candidate]) {
      code = candidate;
      message = PUBLIC_ERROR_CATALOG[candidate];
    } else if (candidate) {
      // Unknown internal code → map family
      code = mapInternalCode(candidate);
      message = PUBLIC_ERROR_CATALOG[code];
    }
  } else if (typeof input === 'string' && PUBLIC_ERROR_CATALOG[input]) {
    code = input;
    message = PUBLIC_ERROR_CATALOG[code];
  }

  if (!message) message = PUBLIC_ERROR_CATALOG[code] || PUBLIC_ERROR_CATALOG.INTERNAL_ERROR;

  // Never echo raw exception text to the client.
  const raw = input instanceof Error
    ? input.message
    : (input && typeof input === 'object' ? (input.message || input.error) : input);
  if (raw && isSensitiveErrorText(raw) && code !== fallbackCode && !PUBLIC_ERROR_CATALOG[String(input?.code || '')]) {
    code = 'INTERNAL_ERROR';
    message = PUBLIC_ERROR_CATALOG.INTERNAL_ERROR;
  }

  return { error: message, code, correlationId: cid };
}

function mapInternalCode(code) {
  const c = String(code || '');
  if (c === 'MEDIA_NOT_FOUND' || c === 'REEL_NOT_FOUND') return 'MEDIA_NOT_AVAILABLE';
  if (c === 'MEDIA_TRASHED' || c === 'REEL_TRASHED') return 'MEDIA_TRASHED';
  if (c === 'MEDIA_ARCHIVED' || c === 'REEL_ARCHIVED') return 'MEDIA_ARCHIVED';
  if (
    c === 'SOURCE_OBJECT_MISSING'
    || c === 'DERIVATIVE_OBJECT_MISSING'
  ) return 'MEDIA_SOURCE_MISSING';
  if (
    c === 'REEL_STATUS_DENIED'
    || c === 'REEL_NOT_ASSIGNED'
    || c === 'REEL_STALE_VERSION'
    || c === 'REEL_NOT_CURRENT'
  ) return 'REEL_VERSION_UNAVAILABLE';
  if (
    c === 'NOT_VERIFIED'
    || c === 'PRIVACY_NOT_CLEAR'
    || c === 'RIGHTS_NOT_CLEAR'
    || c === 'CUSTOMER_PERMISSION_REQUIRED'
    || c === 'PUBLIC_USE_NOT_APPROVED'
    || c === 'PUBLIC_DERIVATIVE_NOT_ELIGIBLE'
  ) return 'PUBLIC_DERIVATIVE_NOT_ELIGIBLE';
  if (
    c === 'FORBIDDEN'
    || c === 'ASSIGNMENT_INACTIVE'
    || c === 'REEL_USE_NOT_APPROVED'
    || c === 'CREATOR_ORIGINALS_FORBIDDEN'
    || c === 'DERIVATIVE_FORBIDDEN'
    || c === 'NOT_SHARED'
  ) return 'MEDIA_ACCESS_DENIED';
  if (c === 'SIGN_IN_REQUIRED') return 'SIGN_IN_REQUIRED';
  if (c === 'INVALID_REQUEST' || c.startsWith('INVALID_')) return 'INVALID_REQUEST';
  return 'INTERNAL_ERROR';
}

/** Map policy decision codes to public catalog codes. */
export function toPublicSignCode(internalCode) {
  if (PUBLIC_ERROR_CATALOG[internalCode]) return internalCode;
  return mapInternalCode(internalCode);
}

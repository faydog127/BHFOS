/**
 * Client-safe MIL error redaction for edge functions (Phase 2A remediation).
 */

export const PUBLIC_ERROR_CATALOG: Record<string, string> = {
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
}

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
  /service_role|SUPABASE_SERVICE|sbp_/i,
]

export function newCorrelationId(): string {
  return crypto.randomUUID()
}

export function isSensitiveErrorText(text: unknown): boolean {
  const s = String(text || '')
  return SENSITIVE_PATTERNS.some((re) => re.test(s))
}

function mapInternalCode(code: string): string {
  const c = String(code || '')
  if (c === 'MEDIA_NOT_FOUND' || c === 'REEL_NOT_FOUND') return 'MEDIA_NOT_AVAILABLE'
  if (c === 'MEDIA_TRASHED' || c === 'REEL_TRASHED') return 'MEDIA_TRASHED'
  if (c === 'MEDIA_ARCHIVED' || c === 'REEL_ARCHIVED') return 'MEDIA_ARCHIVED'
  if (c === 'SOURCE_OBJECT_MISSING' || c === 'DERIVATIVE_OBJECT_MISSING') return 'MEDIA_SOURCE_MISSING'
  if (
    c === 'REEL_STATUS_DENIED' || c === 'REEL_NOT_ASSIGNED' || c === 'REEL_STALE_VERSION'
    || c === 'REEL_NOT_CURRENT' || c === 'REEL_VERSION_UNAVAILABLE'
  ) return 'REEL_VERSION_UNAVAILABLE'
  if (
    c === 'NOT_VERIFIED' || c === 'PRIVACY_NOT_CLEAR' || c === 'RIGHTS_NOT_CLEAR'
    || c === 'CUSTOMER_PERMISSION_REQUIRED' || c === 'PUBLIC_USE_NOT_APPROVED'
    || c === 'PUBLIC_DERIVATIVE_NOT_ELIGIBLE'
  ) return 'PUBLIC_DERIVATIVE_NOT_ELIGIBLE'
  if (
    c === 'FORBIDDEN' || c === 'ASSIGNMENT_INACTIVE' || c === 'REEL_USE_NOT_APPROVED'
    || c === 'CREATOR_ORIGINALS_FORBIDDEN' || c === 'DERIVATIVE_FORBIDDEN' || c === 'NOT_SHARED'
    || c === 'MEDIA_ACCESS_DENIED'
  ) return 'MEDIA_ACCESS_DENIED'
  if (PUBLIC_ERROR_CATALOG[c]) return c
  if (c === 'SIGN_IN_REQUIRED') return 'SIGN_IN_REQUIRED'
  if (c === 'INVALID_REQUEST' || c.startsWith('INVALID_')) return 'INVALID_REQUEST'
  return 'INTERNAL_ERROR'
}

export function toPublicSignCode(internalCode: string): string {
  if (PUBLIC_ERROR_CATALOG[internalCode]) return internalCode
  return mapInternalCode(internalCode)
}

export function redactErrorForClient(
  input: unknown,
  opts: { correlationId?: string; fallbackCode?: string } = {},
): { error: string; code: string; correlationId: string } {
  const cid = opts.correlationId || newCorrelationId()
  let code = opts.fallbackCode || 'INTERNAL_ERROR'

  if (input && typeof input === 'object') {
    const obj = input as { code?: string; publicCode?: string; message?: string; error?: string }
    const candidate = String(obj.code || obj.publicCode || '').trim()
    if (candidate) code = toPublicSignCode(candidate)
  } else if (typeof input === 'string' && PUBLIC_ERROR_CATALOG[input]) {
    code = input
  } else if (input instanceof Error) {
    code = isSensitiveErrorText(input.message) ? 'INTERNAL_ERROR' : (opts.fallbackCode || 'INTERNAL_ERROR')
  }

  if (!PUBLIC_ERROR_CATALOG[code]) code = 'INTERNAL_ERROR'
  return { error: PUBLIC_ERROR_CATALOG[code], code, correlationId: cid }
}

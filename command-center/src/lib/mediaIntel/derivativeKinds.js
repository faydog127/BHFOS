/**
 * Shared derivative-kind contract. MUST stay in sync with the `mil_derivatives.kind`
 * check constraint in `supabase/migrations/20260725120000_media_intelligence_library.sql`.
 * Client code should reference these exports instead of re-typing kind strings.
 */
export const ALL_DERIVATIVE_KINDS = [
  'grid_thumb',
  'detail_preview',
  'website_optimized',
  'creator_download',
  'redacted_public',
  'video_thumb',
  'video_preview',
  'reel_version',
  'heic_preview',
  'public_safe',
  'ai_safe',
];

/** Derivative kinds that are safe to render as a client-facing preview thumbnail/poster. */
export const PREVIEW_DERIVATIVE_KINDS = [
  'grid_thumb',
  'detail_preview',
  'heic_preview',
  'video_thumb',
];

export function isKnownDerivativeKind(kind) {
  return ALL_DERIVATIVE_KINDS.includes(kind);
}

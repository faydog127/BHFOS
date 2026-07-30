/**
 * MIL-specific CORS allowlist.
 *
 * Scoped to media-intel-* edge functions only. Do NOT change `_shared/cors.ts`
 * (wildcard) — other, non-MIL functions still rely on that broad default and
 * must not be affected by this hardening.
 *
 * Origin allowlist = built-in local dev defaults + `MIL_ALLOWED_ORIGINS`
 * (comma-separated) from edge secrets/env. Unknown origins never receive an
 * `Access-Control-Allow-Origin` reflecting their value.
 */

const DEFAULT_ALLOWED_ORIGINS = [
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:4173',
]

function readAllowedOrigins(): string[] {
  const fromEnv = (Deno.env.get('MIL_ALLOWED_ORIGINS') || '')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean)
  const merged = [...DEFAULT_ALLOWED_ORIGINS, ...fromEnv]
  return Array.from(new Set(merged))
}

/**
 * Build CORS headers for a given request. Reflects the request Origin only
 * when it is present in the allowlist; otherwise omits `Access-Control-Allow-Origin`
 * entirely (falls back to the first default) so unauthorized origins cannot
 * read the response via CORS.
 */
export function milCorsHeaders(req: Request): Record<string, string> {
  const allowed = readAllowedOrigins()
  const origin = req.headers.get('Origin') || req.headers.get('origin') || ''
  const headers: Record<string, string> = {
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    Vary: 'Origin',
  }
  if (origin && allowed.includes(origin)) {
    headers['Access-Control-Allow-Origin'] = origin
  } else {
    // No credentialed wildcard; omit reflection for unknown origins. Provide a
    // safe default so same-origin/dev tooling that omits Origin still works.
    headers['Access-Control-Allow-Origin'] = allowed[0]
  }
  return headers
}

/** Standard OPTIONS preflight response for MIL functions. */
export function milCorsPreflight(req: Request): Response {
  return new Response('ok', { headers: milCorsHeaders(req) })
}

import { createRemoteJWKSet, jwtVerify, type JWTPayload } from 'https://esm.sh/jose@5.2.4';

export type JwtClaims = {
  sub?: string;
  role?: string;
  exp?: number;
  iat?: number;
  iss?: string;
  aud?: string | string[];
  app_metadata?: Record<string, unknown>;
  user_metadata?: Record<string, unknown>;
  [k: string]: unknown;
};

const USER_UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const unauthorized = (): never => {
  throw new Error('unauthorized');
};

/**
 * Issuer pin: EXPECTED_ISS is `SUPABASE_URL` with trailing slashes removed,
 * plus `/auth/v1`. The token `iss` must equal that string exactly.
 * Trailing-slash, letter-case, and explicit-port variants do not match.
 * The JWKS URL is built only from that env value. Token claims never select a URL.
 * HS256 is accepted only when SUPABASE_JWT_SECRET is set, with the same issuer
 * and audience. There is no shared-secret fallback and no localhost exception.
 */
const parseHttpUrl = (value: string): URL => {
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    return unauthorized();
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return unauthorized();
  if (parsed.username || parsed.password || parsed.search || parsed.hash) return unauthorized();
  return parsed;
};

const supabaseBaseUrl = (): string => {
  const raw = (Deno.env.get('SUPABASE_URL') ?? '').trim().replace(/\/+$/, '');
  if (!raw) return unauthorized();
  parseHttpUrl(raw);
  return raw;
};

const expectedIssuer = (): string => `${supabaseBaseUrl()}/auth/v1`;

let ownJwks: ReturnType<typeof createRemoteJWKSet> | null = null;
let ownJwksUrl = '';

const ownJwksSet = (): ReturnType<typeof createRemoteJWKSet> => {
  const url = `${supabaseBaseUrl()}/auth/v1/.well-known/jwks.json`;
  if (ownJwks && ownJwksUrl === url) return ownJwks;

  const parsed = parseHttpUrl(url);
  ownJwks = createRemoteJWKSet(parsed, {
    cooldownDuration: 30_000,
    timeoutDuration: 5_000,
  });
  ownJwksUrl = url;
  return ownJwks;
};

const base64UrlDecodeToString = (input: string): string => {
  const base64 = input.replace(/-/g, '+').replace(/_/g, '/');
  const padded = base64 + '==='.slice((base64.length + 3) % 4);
  if (typeof atob !== 'function') unauthorized();
  return atob(padded);
};

export const getBearerToken = (req: Request): string | null => {
  const header = req.headers.get('authorization') || req.headers.get('Authorization') || '';
  if (!header) return null;
  return header.startsWith('Bearer ') ? header.slice(7) : header;
};

/** Unverified payload decode. Not an authentication decision. */
export const decodeJwtClaims = (token: string): JwtClaims => {
  const parts = token.split('.');
  if (parts.length !== 3) throw new Error('Invalid JWT format.');
  const payloadJson = base64UrlDecodeToString(parts[1]);
  return JSON.parse(payloadJson);
};

const peekAlgorithm = (token: string): string => {
  const parts = token.split('.');
  if (parts.length !== 3 || !parts[0] || !parts[1]) unauthorized();

  let header: unknown;
  try {
    header = JSON.parse(base64UrlDecodeToString(parts[0]));
  } catch {
    unauthorized();
  }
  if (!header || typeof header !== 'object') unauthorized();

  const algValue = (header as { alg?: unknown }).alg;
  const alg = typeof algValue === 'string' ? algValue.trim() : '';
  if (!alg || alg.toLowerCase() === 'none') unauthorized();
  return alg;
};

const assertUserClaims = (payload: JWTPayload, expectedIss: string): JwtClaims => {
  if (payload.iss !== expectedIss) unauthorized();
  if (typeof payload.sub !== 'string' || !USER_UUID.test(payload.sub)) unauthorized();
  if (payload.role !== 'authenticated') unauthorized();
  if (typeof payload.exp !== 'number' || !Number.isFinite(payload.exp)) unauthorized();
  if (payload.is_anonymous === true) unauthorized();
  return payload as JwtClaims;
};

const legacyJwtSecret = (): string => (Deno.env.get('SUPABASE_JWT_SECRET') ?? '').trim();

export const verifyJwtClaims = async (token: string): Promise<JwtClaims> => {
  if (typeof token !== 'string' || !token.trim()) unauthorized();
  const expectedIss = expectedIssuer();
  const alg = peekAlgorithm(token.trim());

  try {
    if (alg === 'HS256') {
      const secret = legacyJwtSecret();
      if (!secret) unauthorized();
      const { payload } = await jwtVerify(token.trim(), new TextEncoder().encode(secret), {
        issuer: expectedIss,
        audience: 'authenticated',
        algorithms: ['HS256'],
        clockTolerance: 5,
      });
      return assertUserClaims(payload, expectedIss);
    }

    if (alg !== 'ES256' && alg !== 'RS256') unauthorized();

    const { payload } = await jwtVerify(token.trim(), ownJwksSet(), {
      issuer: expectedIss,
      audience: 'authenticated',
      algorithms: ['ES256', 'RS256'],
      clockTolerance: 5,
    });
    return assertUserClaims(payload, expectedIss);
  } catch (error) {
    if (error instanceof Error && error.message === 'unauthorized') throw error;
    return unauthorized();
  }
};

const timingSafeEqualString = (left: string, right: string): boolean => {
  const encoder = new TextEncoder();
  const a = encoder.encode(left);
  const b = encoder.encode(right);
  const length = Math.max(a.length, b.length, 1);
  let diff = a.length ^ b.length;
  for (let i = 0; i < length; i++) {
    diff |= (a[i] ?? 0) ^ (b[i] ?? 0);
  }
  return diff === 0;
};

const bearerEqualsEnv = (token: string, envName: string): boolean => {
  const expected = (Deno.env.get(envName) ?? '').trim();
  if (!token || !expected) return false;
  return timingSafeEqualString(token, expected);
};

/** True only when the bearer equals SUPABASE_SERVICE_ROLE_KEY. Never a user claim. */
export const isServiceRoleBearer = (req: Request): boolean => {
  const token = getBearerToken(req)?.trim() ?? '';
  return bearerEqualsEnv(token, 'SUPABASE_SERVICE_ROLE_KEY');
};

export const getVerifiedClaims = async (req: Request): Promise<{ token: string; claims: JwtClaims }> => {
  const token = getBearerToken(req)?.trim() ?? '';
  if (!token) unauthorized();
  if (bearerEqualsEnv(token, 'SUPABASE_SERVICE_ROLE_KEY')) unauthorized();
  if (bearerEqualsEnv(token, 'SUPABASE_ANON_KEY')) unauthorized();
  const claims = await verifyJwtClaims(token);
  return { token, claims };
};

/** Verifies the bearer. The previous unverified decoder under this name was removed. */
export const getTrustedClaims = getVerifiedClaims;

export const getTenantIdFromClaims = (claims: JwtClaims): string | null => {
  const app = claims.app_metadata as Record<string, unknown> | undefined;
  const tid = app?.tenant_id;
  return typeof tid === 'string' && tid.trim() ? tid : null;
};

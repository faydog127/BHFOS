import { createRemoteJWKSet, jwtVerify } from 'https://esm.sh/jose@5.2.4';

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

export const getBearerToken = (req: Request): string | null => {
  const header = req.headers.get('authorization') || req.headers.get('Authorization') || '';
  if (!header) return null;
  return header.startsWith('Bearer ') ? header.slice(7) : header;
};

const base64UrlDecodeToString = (input: string): string => {
  const base64 = input.replace(/-/g, '+').replace(/_/g, '/');
  const padded = base64 + '==='.slice((base64.length + 3) % 4);
  if (typeof atob === 'function') {
    return atob(padded);
  }
  throw new Error('No base64 decoder available in runtime.');
};

export const decodeJwtClaims = (token: string): JwtClaims => {
  const parts = token.split('.');
  if (parts.length !== 3) throw new Error('Invalid JWT format.');
  const payloadJson = base64UrlDecodeToString(parts[1]);
  return JSON.parse(payloadJson);
};

export const getTrustedClaims = (req: Request): { token: string; claims: JwtClaims } => {
  const token = getBearerToken(req);
  if (!token) throw new Error('Missing Authorization Bearer token.');
  const claims = decodeJwtClaims(token);
  return { token, claims };
};

const jwksCache = new Map<string, ReturnType<typeof createRemoteJWKSet>>();
const LOCAL_SUPABASE_JWT_SECRET = 'super-secret-jwt-token-with-at-least-32-characters-long';

const resolveJwtSecret = (): string | null => {
  const secret = Deno.env.get('JWT_SECRET') || Deno.env.get('SUPABASE_JWT_SECRET') || '';
  return secret.trim() || null;
};

const isLocalIssuer = (issuer: string) => /^https?:\/\/(?:127\.0\.0\.1|localhost)(?::\d+)?(?:\/|$)/i.test(issuer);

type JwtHeader = {
  alg?: string;
  kid?: string;
  typ?: string;
  [k: string]: unknown;
};

const decodeJwtHeader = (token: string): JwtHeader => {
  const parts = token.split('.');
  if (parts.length !== 3) throw new Error('Invalid JWT format.');
  const headerJson = base64UrlDecodeToString(parts[0]);
  return JSON.parse(headerJson);
};

const resolveIssuer = (claims: JwtClaims): string | null => {
  if (typeof claims.iss === 'string' && claims.iss.trim()) return claims.iss;

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  if (!supabaseUrl) return null;

  return `${supabaseUrl.replace(/\/$/, '')}/auth/v1`;
};

const resolveJwksUrl = (issuer: string) => {
  // Tokens minted by local Supabase often use an `iss` like:
  //   http://127.0.0.1:25431/auth/v1
  // That URL is NOT reachable from inside the Edge Runtime container, so we
  // fetch JWKS via the container-reachable SUPABASE_URL instead (Kong).
  if (isLocalIssuer(issuer)) {
    const supabaseUrl = (Deno.env.get('SUPABASE_URL') ?? '').trim();
    if (supabaseUrl) {
      return new URL(`${supabaseUrl.replace(/\/$/, '')}/auth/v1/.well-known/jwks.json`);
    }
  }

  return new URL(`${issuer.replace(/\/$/, '')}/.well-known/jwks.json`);
};

const getRemoteJwks = (issuer: string) => {
  const jwksUrl = resolveJwksUrl(issuer);
  const cacheKey = jwksUrl.toString();
  const cached = jwksCache.get(cacheKey);
  if (cached) return cached;

  const jwks = createRemoteJWKSet(jwksUrl);
  jwksCache.set(cacheKey, jwks);
  return jwks;
};

const verifyWithSharedSecret = async (token: string, issuer: string, secret: string): Promise<JwtClaims> => {
  const { payload } = await jwtVerify(token, new TextEncoder().encode(secret), {
    issuer,
    audience: 'authenticated',
  });

  return payload as JwtClaims;
};

export const verifyJwtClaims = async (token: string): Promise<JwtClaims> => {
  const untrusted = decodeJwtClaims(token);
  const header = decodeJwtHeader(token);
  const issuer = resolveIssuer(untrusted);
  if (!issuer) throw new Error('Missing iss claim.');

  const algorithm = typeof header.alg === 'string' ? header.alg.trim() : '';
  const isHmacAlgorithm = algorithm.startsWith('HS');
  const sharedSecret = resolveJwtSecret() || (isLocalIssuer(issuer) ? LOCAL_SUPABASE_JWT_SECRET : null);

  // Local Supabase can mint either:
  // - HS256 tokens (shared secret), or
  // - ES256 tokens (JWKS).
  // Never attempt shared-secret verification for non-HS algorithms.
  if (isHmacAlgorithm && sharedSecret && isLocalIssuer(issuer)) {
    return verifyWithSharedSecret(token, issuer, sharedSecret);
  }

  const jwks = getRemoteJwks(issuer);
  try {
    const { payload } = await jwtVerify(token, jwks, {
      issuer,
      audience: 'authenticated',
    });

    return payload as JwtClaims;
  } catch (error) {
    if (isHmacAlgorithm && sharedSecret && isLocalIssuer(issuer)) {
      return verifyWithSharedSecret(token, issuer, sharedSecret);
    }
    throw error;
  }
};

export const getVerifiedClaims = async (req: Request): Promise<{ token: string; claims: JwtClaims }> => {
  const token = getBearerToken(req);
  if (!token) throw new Error('Missing Authorization Bearer token.');
  const claims = await verifyJwtClaims(token);
  return { token, claims };
};

export const getTenantIdFromClaims = (claims: JwtClaims): string | null => {
  const app = claims.app_metadata as Record<string, unknown> | undefined;
  const tid = app?.tenant_id;
  return typeof tid === 'string' && tid.trim() ? tid : null;
};

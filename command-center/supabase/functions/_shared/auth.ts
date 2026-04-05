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

const resolveIssuer = (claims: JwtClaims): string | null => {
  if (typeof claims.iss === 'string' && claims.iss.trim()) return claims.iss;

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  if (!supabaseUrl) return null;

  return `${supabaseUrl.replace(/\/$/, '')}/auth/v1`;
};

const getRemoteJwks = (issuer: string) => {
  const jwksUrl = new URL(`${issuer.replace(/\/$/, '')}/.well-known/jwks.json`);
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
  const issuer = resolveIssuer(untrusted);
  if (!issuer) throw new Error('Missing iss claim.');

  const sharedSecret = resolveJwtSecret() || (isLocalIssuer(issuer) ? LOCAL_SUPABASE_JWT_SECRET : null);
  if (sharedSecret && isLocalIssuer(issuer)) {
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
    if (sharedSecret && isLocalIssuer(issuer)) {
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

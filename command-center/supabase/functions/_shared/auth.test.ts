import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { exportJWK, generateKeyPair, SignJWT, type KeyLike } from 'https://esm.sh/jose@5.2.4';
import {
  decodeJwtClaims,
  getTenantIdFromClaims,
  getTrustedClaims,
  getVerifiedClaims,
  isServiceRoleBearer,
  verifyJwtClaims,
} from './auth.ts';

const OWN_BASE = 'https://own.example';
const OWN_ISS = `${OWN_BASE}/auth/v1`;
const ATTACKER_ISS = 'https://attacker.example/auth/v1';
const USER = '11111111-1111-4111-8111-111111111111';
const PUBLIC_LOCAL_SECRET = 'super-secret-jwt-token-with-at-least-32-characters-long';

const now = () => Math.floor(Date.now() / 1000);

const ownEs = await generateKeyPair('ES256', { extractable: true });
const ownRs = await generateKeyPair('RS256', { extractable: true });
const attackerEs = await generateKeyPair('ES256', { extractable: true });

const ownEsJwk = await exportJWK(ownEs.publicKey);
ownEsJwk.kid = 'own-es256';
ownEsJwk.alg = 'ES256';
ownEsJwk.use = 'sig';

const ownRsJwk = await exportJWK(ownRs.publicKey);
ownRsJwk.kid = 'own-rs256';
ownRsJwk.alg = 'RS256';
ownRsJwk.use = 'sig';

const attackerJwk = await exportJWK(attackerEs.publicKey);
attackerJwk.kid = 'attacker-1';
attackerJwk.alg = 'ES256';
attackerJwk.use = 'sig';

const fetchCalls: string[] = [];
const originalFetch = globalThis.fetch;

const fetchUrl = (input: RequestInfo | URL): string => {
  if (typeof input === 'string') return input;
  if (input instanceof URL) return input.href;
  return input.url;
};

globalThis.fetch = (async (input: RequestInfo | URL) => {
  const url = fetchUrl(input);
  fetchCalls.push(url);
  const parsed = new URL(url);
  if (parsed.hostname === 'own.example' && parsed.pathname === '/auth/v1/.well-known/jwks.json') {
    return new Response(JSON.stringify({ keys: [ownEsJwk, ownRsJwk] }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  }
  if (url.includes('attacker.example')) {
    return new Response(JSON.stringify({ keys: [attackerJwk] }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  }
  return new Response('not found', { status: 404 });
}) as typeof fetch;

const ENV_KEYS = [
  'SUPABASE_URL',
  'SUPABASE_JWT_SECRET',
  'JWT_SECRET',
  'SUPABASE_SERVICE_ROLE_KEY',
  'SUPABASE_ANON_KEY',
  'ALLOW_LOCAL_JWT_SECRET',
] as const;

const withEnv = async (
  values: Partial<Record<(typeof ENV_KEYS)[number], string>>,
  fn: () => Promise<void>,
) => {
  const prev = new Map(ENV_KEYS.map((key) => [key, Deno.env.get(key) ?? null]));
  for (const key of ENV_KEYS) Deno.env.delete(key);
  for (const [key, value] of Object.entries(values)) {
    if (value) Deno.env.set(key, value);
  }
  try {
    await fn();
  } finally {
    for (const [key, value] of prev) {
      if (value === null) Deno.env.delete(key);
      else Deno.env.set(key, value);
    }
  }
};

const bearer = (token: string) =>
  new Request('https://own.example/functions/v1/test', {
    headers: { authorization: `Bearer ${token}` },
  });

const assertUnauthorized = async (fn: () => Promise<unknown>) => {
  try {
    await fn();
  } catch (error) {
    assertEquals(error instanceof Error ? error.message : String(error), 'unauthorized');
    return;
  }
  throw new Error('expected unauthorized');
};

const withoutSub = (claims: Record<string, unknown>) => {
  const payload = { ...claims };
  const hasSub = Object.prototype.hasOwnProperty.call(payload, 'sub');
  const sub = payload.sub;
  delete payload.sub;
  return { payload, hasSub, sub };
};

const applySubject = (
  jwt: SignJWT,
  claims: Record<string, unknown>,
) => {
  const { hasSub, sub } = withoutSub(claims);
  if (!hasSub) return jwt.setSubject(USER);
  if (typeof sub === 'string' && sub.length > 0) return jwt.setSubject(sub);
  return jwt;
};

const signAsymmetric = async (
  alg: 'ES256' | 'RS256',
  key: KeyLike,
  kid: string,
  iss: string,
  claims: Record<string, unknown> = {},
  times?: { iat?: number; exp?: number },
) => {
  const { payload } = withoutSub(claims);
  const jwt = applySubject(
    new SignJWT({
      role: 'authenticated',
      app_metadata: { tenant_id: 'tvg' },
      ...payload,
    })
      .setProtectedHeader({ alg, kid, typ: 'JWT' })
      .setIssuer(iss)
      .setAudience('authenticated')
      .setIssuedAt(times?.iat ?? now() - 30)
      .setExpirationTime(times?.exp ?? now() + 600),
    claims,
  );
  return await jwt.sign(key);
};

const signHs = async (
  secret: string,
  iss: string,
  claims: Record<string, unknown> = {},
  aud: string | string[] | null = 'authenticated',
) => {
  const { payload } = withoutSub(claims);
  let jwt = new SignJWT({
    role: 'authenticated',
    app_metadata: { tenant_id: 'tvg' },
    ...payload,
  })
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setIssuer(iss)
    .setIssuedAt(now() - 30)
    .setExpirationTime(now() + 600);
  if (aud) jwt = jwt.setAudience(aud);
  jwt = applySubject(jwt, claims);
  return await jwt.sign(new TextEncoder().encode(secret));
};

let queue = Promise.resolve();
const test = (name: string, fn: () => Promise<void>) => {
  Deno.test({
    name,
    sanitizeOps: false,
    sanitizeResources: false,
    fn() {
      const run = queue.then(fn);
      queue = run.then(() => {}, () => {});
      return run;
    },
  });
};

test('accepts own-issuer ES256 and extracts the tenant claim', async () => {
  const token = await signAsymmetric('ES256', ownEs.privateKey, 'own-es256', OWN_ISS);
  await withEnv({ SUPABASE_URL: OWN_BASE }, async () => {
    const claims = await verifyJwtClaims(token);
    assertEquals(claims.sub, USER);
    assertEquals(claims.iss, OWN_ISS);
    assertEquals(getTenantIdFromClaims(claims), 'tvg');
    const trusted = await getTrustedClaims(bearer(token));
    assertEquals(trusted.claims.sub, USER);
    assertEquals(getTenantIdFromClaims(trusted.claims), 'tvg');
  });
});

test('rejects a foreign issuer and does not fetch that host', async () => {
  const token = await signAsymmetric('ES256', attackerEs.privateKey, 'attacker-1', ATTACKER_ISS);
  const before = fetchCalls.length;
  await withEnv({ SUPABASE_URL: OWN_BASE }, async () => {
    await assertUnauthorized(() => verifyJwtClaims(token));
    await assertUnauthorized(() => getVerifiedClaims(bearer(token)));
  });
  const seen = fetchCalls.slice(before);
  if (seen.some((url) => url.includes('attacker.example'))) {
    throw new Error('verification fetched the token issuer host');
  }
  const decoded = decodeJwtClaims(token);
  assertEquals(decoded.iss, ATTACKER_ISS);
});

test('rejects localhost HS256 signed with the public local secret', async () => {
  const issuers = [
    'http://127.0.0.1:54321/auth/v1',
    'http://localhost/auth/v1',
    'http://localhost:54321/auth/v1',
    'http://localhost',
  ];
  for (const iss of issuers) {
    const token = await signHs(PUBLIC_LOCAL_SECRET, iss);
    await withEnv({ SUPABASE_URL: OWN_BASE }, async () => {
      await assertUnauthorized(() => verifyJwtClaims(token));
    });
    await withEnv({ SUPABASE_URL: OWN_BASE, SUPABASE_JWT_SECRET: PUBLIC_LOCAL_SECRET }, async () => {
      await assertUnauthorized(() => verifyJwtClaims(token));
    });
    await withEnv({
      SUPABASE_URL: OWN_BASE,
      SUPABASE_JWT_SECRET: 'different-secret-with-at-least-32-characters',
      JWT_SECRET: PUBLIC_LOCAL_SECRET,
      ALLOW_LOCAL_JWT_SECRET: 'true',
    }, async () => {
      await assertUnauthorized(() => verifyJwtClaims(token));
    });
  }

  const localIss = 'http://127.0.0.1:54321/auth/v1';
  const localToken = await signHs(PUBLIC_LOCAL_SECRET, localIss);
  await withEnv({
    SUPABASE_URL: 'http://127.0.0.1:54321',
    ALLOW_LOCAL_JWT_SECRET: 'true',
    JWT_SECRET: PUBLIC_LOCAL_SECRET,
  }, async () => {
    await assertUnauthorized(() => verifyJwtClaims(localToken));
  });
});

test('rejects non-URL issuers signed with the configured secret', async () => {
  const secret = 'staging-secret-with-at-least-32-characters';
  for (const iss of ['supabase', 'supabase-demo']) {
    const token = await signHs(secret, iss);
    const publicToken = await signHs(PUBLIC_LOCAL_SECRET, iss);
    await withEnv({ SUPABASE_URL: OWN_BASE, SUPABASE_JWT_SECRET: secret }, async () => {
      await assertUnauthorized(() => verifyJwtClaims(token));
      await assertUnauthorized(() => verifyJwtClaims(publicToken));
    });
  }
});

test('getVerifiedClaims rejects anon and service-role keys', async () => {
  const anonJwt = await signHs('anon-secret-with-at-least-32-characters', 'supabase', {
    role: 'anon',
    sub: undefined,
  });
  const serviceJwt = await signHs('service-secret-with-at-least-32-characters', 'supabase', {
    role: 'service_role',
    sub: undefined,
  });
  const userToken = await signAsymmetric('ES256', ownEs.privateKey, 'own-es256', OWN_ISS);
  const anonKey = `anon-${crypto.randomUUID()}`;

  await withEnv({
    SUPABASE_URL: OWN_BASE,
    SUPABASE_SERVICE_ROLE_KEY: serviceJwt,
    SUPABASE_ANON_KEY: anonKey,
    SUPABASE_JWT_SECRET: 'service-secret-with-at-least-32-characters',
  }, async () => {
    assertEquals(isServiceRoleBearer(bearer(serviceJwt)), true);
    assertEquals(isServiceRoleBearer(bearer(anonKey)), false);
    assertEquals(isServiceRoleBearer(bearer(userToken)), false);
    assertEquals(isServiceRoleBearer(bearer(`${serviceJwt}x`)), false);
    assertEquals(isServiceRoleBearer(new Request('https://own.example/')), false);
    await assertUnauthorized(() => getVerifiedClaims(bearer(serviceJwt)));
    await assertUnauthorized(() => getVerifiedClaims(bearer(anonKey)));
    await assertUnauthorized(() => getVerifiedClaims(bearer(anonJwt)));
    const accepted = await getVerifiedClaims(bearer(userToken));
    assertEquals(accepted.claims.role, 'authenticated');
  });

  await withEnv({ SUPABASE_URL: OWN_BASE, SUPABASE_SERVICE_ROLE_KEY: userToken }, async () => {
    assertEquals(isServiceRoleBearer(bearer(userToken)), true);
    await assertUnauthorized(() => getVerifiedClaims(bearer(userToken)));
    const claims = await verifyJwtClaims(userToken);
    assertEquals(claims.sub, USER);
  });
});

test('rejects bad audience, expiry, alg none, bare HS256, subject, role, and tampering', async () => {
  const wrongAud = await signHs('hs-secret-with-at-least-32-characters', OWN_ISS, {}, 'anon');
  const missingAud = await (async () => {
    return await new SignJWT({ role: 'authenticated', app_metadata: { tenant_id: 'tvg' } })
      .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
      .setIssuer(OWN_ISS)
      .setSubject(USER)
      .setIssuedAt(now() - 30)
      .setExpirationTime(now() + 600)
      .sign(new TextEncoder().encode('hs-secret-with-at-least-32-characters'));
  })();
  const expired = await signAsymmetric('ES256', ownEs.privateKey, 'own-es256', OWN_ISS, {}, {
    iat: now() - 120,
    exp: now() - 15,
  });
  const skewOk = await signAsymmetric('ES256', ownEs.privateKey, 'own-es256', OWN_ISS, {}, {
    iat: now() - 60,
    exp: now() - 2,
  });
  const missingSub = await signAsymmetric('ES256', ownEs.privateKey, 'own-es256', OWN_ISS, { sub: '' });
  const badSub = await signAsymmetric('ES256', ownEs.privateKey, 'own-es256', OWN_ISS, { sub: 'not-a-uuid' });
  const badRole = await signAsymmetric('ES256', ownEs.privateKey, 'own-es256', OWN_ISS, { role: 'service_role' });
  const anonymous = await signAsymmetric('ES256', ownEs.privateKey, 'own-es256', OWN_ISS, { is_anonymous: true });
  const hsOnly = await signHs('hs-secret-with-at-least-32-characters', OWN_ISS);
  const valid = await signAsymmetric('ES256', ownEs.privateKey, 'own-es256', OWN_ISS);
  const parts = valid.split('.');
  const tampered = `${parts[0]}.${parts[1].slice(0, -1)}${parts[1].endsWith('a') ? 'b' : 'a'}.${parts[2]}`;
  const noneToken = `${b64url({ alg: 'none', typ: 'JWT' })}.${b64url({
    iss: OWN_ISS,
    aud: 'authenticated',
    sub: USER,
    role: 'authenticated',
    exp: now() + 600,
  })}.`;

  await withEnv({
    SUPABASE_URL: OWN_BASE,
    SUPABASE_JWT_SECRET: 'hs-secret-with-at-least-32-characters',
  }, async () => {
    await assertUnauthorized(() => verifyJwtClaims(wrongAud));
    await assertUnauthorized(() => verifyJwtClaims(missingAud));
    const hsClaims = await verifyJwtClaims(hsOnly);
    assertEquals(getTenantIdFromClaims(hsClaims), 'tvg');
  });

  await withEnv({ SUPABASE_URL: OWN_BASE }, async () => {
    await assertUnauthorized(() => verifyJwtClaims(expired));
    const skewClaims = await verifyJwtClaims(skewOk);
    assertEquals(skewClaims.sub, USER);
    await assertUnauthorized(() => verifyJwtClaims(missingSub));
    await assertUnauthorized(() => verifyJwtClaims(badSub));
    await assertUnauthorized(() => verifyJwtClaims(badRole));
    await assertUnauthorized(() => verifyJwtClaims(anonymous));
    await assertUnauthorized(() => verifyJwtClaims(hsOnly));
    await assertUnauthorized(() => verifyJwtClaims(tampered));
    await assertUnauthorized(() => verifyJwtClaims(noneToken));
    await assertUnauthorized(() => verifyJwtClaims('not-a-jwt'));
    await assertUnauthorized(() => getVerifiedClaims(new Request('https://own.example/')));
  });
});

test('issuer comparison is exact for slash, case, and port', async () => {
  const accepted = await signAsymmetric('ES256', ownEs.privateKey, 'own-es256', OWN_ISS);
  const slash = await signAsymmetric('ES256', ownEs.privateKey, 'own-es256', `${OWN_ISS}/`);
  const upper = await signAsymmetric('ES256', ownEs.privateKey, 'own-es256', 'https://OWN.example/auth/v1');
  const port = await signAsymmetric('ES256', ownEs.privateKey, 'own-es256', 'https://own.example:443/auth/v1');
  const multiAud = await signAsymmetric('ES256', ownEs.privateKey, 'own-es256', OWN_ISS);
  const withList = await new SignJWT({ role: 'authenticated', app_metadata: { tenant_id: 'tvg' } })
    .setProtectedHeader({ alg: 'ES256', kid: 'own-es256', typ: 'JWT' })
    .setIssuer(OWN_ISS)
    .setAudience(['other', 'authenticated'])
    .setSubject(USER)
    .setIssuedAt(now() - 30)
    .setExpirationTime(now() + 600)
    .sign(ownEs.privateKey);

  await withEnv({ SUPABASE_URL: `${OWN_BASE}/` }, async () => {
    const claims = await verifyJwtClaims(accepted);
    assertEquals(claims.iss, OWN_ISS);
    await assertUnauthorized(() => verifyJwtClaims(slash));
    await assertUnauthorized(() => verifyJwtClaims(upper));
    await assertUnauthorized(() => verifyJwtClaims(port));
    const listed = await verifyJwtClaims(withList);
    assertEquals(listed.aud, ['other', 'authenticated']);
    assertEquals((await verifyJwtClaims(multiAud)).iss, OWN_ISS);
  });

  await withEnv({ SUPABASE_URL: 'https://own.example:8443' }, async () => {
    await assertUnauthorized(() => verifyJwtClaims(accepted));
    const portToken = await signAsymmetric(
      'ES256',
      ownEs.privateKey,
      'own-es256',
      'https://own.example:8443/auth/v1',
    );
    assertEquals((await verifyJwtClaims(portToken)).iss, 'https://own.example:8443/auth/v1');
  });
});

test('accepts own-issuer RS256 with the same claim checks', async () => {
  const token = await signAsymmetric('RS256', ownRs.privateKey, 'own-rs256', OWN_ISS);
  await withEnv({ SUPABASE_URL: OWN_BASE }, async () => {
    const { claims } = await getVerifiedClaims(bearer(token));
    assertEquals(claims.role, 'authenticated');
    assertEquals(getTenantIdFromClaims(claims), 'tvg');
  });
});

test('helper source has no token-derived issuer or local secret branch', async () => {
  const src = await Deno.readTextFile(new URL('./auth.ts', import.meta.url));
  const forbidden = [
    'super-secret-jwt-token-with-at-least-32-characters-long',
    'LOCAL_SUPABASE_JWT_SECRET',
    'isLocalIssuer',
    'resolveIssuer',
    'resolveJwksUrl',
    'verifyWithSharedSecret',
    'ALLOW_LOCAL_JWT_SECRET',
    'supabase-demo',
  ];
  for (const needle of forbidden) {
    if (src.includes(needle)) throw new Error(`forbidden source pattern: ${needle}`);
  }
});

test('every JWKS fetch stayed on the configured own host', () => {
  for (const url of fetchCalls) {
    const host = new URL(url).hostname;
    if (host !== 'own.example') throw new Error(`unexpected fetch host ${host}`);
  }
  globalThis.fetch = originalFetch;
  return Promise.resolve();
});

function b64url(value: unknown): string {
  const bytes = new TextEncoder().encode(JSON.stringify(value));
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/g, '');
}

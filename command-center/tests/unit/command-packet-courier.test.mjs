/**
 * NOS-COMMAND-CENTER-N8N-COURIER-01
 * Run: node --test tests/unit/command-packet-courier.test.mjs
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  ATOMIC_CLAIM_INTERFACE_MISMATCH,
  EVENT_TYPE,
  INGRESS_TOKEN_HEADER,
  PERMITTED_REPOSITORY_CONTEXT,
  PR154_PINNED_CLAIM_INTERFACE,
  SOURCE,
  constructCommandPacketEnvelope,
  defaultProductionClaimAdapter,
  envelopePublicPreview,
  inspectApprovedAtomicClaimInterface,
  isAuthorizedFromClaims,
  isAuthorizedFromRoles,
  postIngressEnvelope,
  redactSensitive,
  submitCommandPacket,
} from '../../supabase/functions/_shared/commandPacketCourier.mjs';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '../..');

const SECRET_URL = 'https://example.invalid/ingress/test-only';
const SECRET_TOKEN = 'test-ingress-token-value';
const PACKET_TEXT = 'NOS-COMMAND-CENTER-N8N-COURIER-01 authorized packet text';

const walkFiles = (dir, acc = []) => {
  if (!fs.existsSync(dir)) return acc;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walkFiles(full, acc);
    else acc.push(full);
  }
  return acc;
};

const authorizeOk = async () => ({ ok: true, actorId: 'actor-1' });
const authorizeNo = async () => ({ ok: false, status: 'unauthorized', httpStatus: 401 });
const authorizeForbidden = async () => ({ ok: false, status: 'forbidden', httpStatus: 403 });

const claimOnce = () => {
  const seen = new Set();
  return async (packetId) => {
    if (seen.has(packetId)) return { ok: false, status: 'duplicate', duplicate: true };
    seen.add(packetId);
    return { ok: true, status: 'claimed', duplicate: false };
  };
};

describe('atomic claim investigation', () => {
  it('reports ATOMIC_CLAIM_INTERFACE_MISMATCH for PR 154 @ 0ec7867', () => {
    const inspection = inspectApprovedAtomicClaimInterface();
    assert.equal(inspection.found, false);
    assert.equal(inspection.status, ATOMIC_CLAIM_INTERFACE_MISMATCH);
    assert.equal(PR154_PINNED_CLAIM_INTERFACE.rpc, 'public.network_os_claim_assurance_delivery');
    assert.equal(PR154_PINNED_CLAIM_INTERFACE.sha, '0ec7867f03ca412a83b764b98a18fc695ad57986');
    assert.ok(PR154_PINNED_CLAIM_INTERFACE.hardConstraints.includes("event_name = 'pull_request'"));
    assert.ok(inspection.rejected.some((row) => row.candidate.includes('network_os_claim_assurance_delivery')));
    assert.ok(inspection.rejected.some((row) => row.candidate.includes('process-local')));
  });

  it('does not call or copy the GitHub assurance claim RPC', () => {
    const courier = fs.readFileSync(
      path.join(root, 'supabase/functions/_shared/commandPacketCourier.mjs'),
      'utf8',
    );
    const edge = fs.readFileSync(
      path.join(root, 'supabase/functions/command-packet-courier/index.ts'),
      'utf8',
    );
    assert.equal(courier.includes('rpc('), false);
    assert.equal(edge.includes('network_os_claim_assurance_delivery'), false);
    assert.equal(fs.existsSync(path.join(root, 'supabase/migrations/20260828170000_network_os_assurance_delivery_claims.sql')), false);
  });

  it('production claim adapter never grants a claim', async () => {
    const claim = defaultProductionClaimAdapter();
    const result = await claim('pkt-1');
    assert.equal(result.ok, false);
    assert.equal(result.status, ATOMIC_CLAIM_INTERFACE_MISMATCH);
    assert.equal(result.duplicate, false);
  });
});

describe('1. unauthorized request produces no outbound call', () => {
  it('rejects missing auth before claim or fetch', async () => {
    let secretsRead = 0;
    let fetchCalls = 0;
    let claimCalls = 0;
    const result = await submitCommandPacket(
      { request: {}, packetId: 'pkt-unauth', packetText: PACKET_TEXT },
      {
        authorize: authorizeNo,
        claimPacket: async () => {
          claimCalls += 1;
          return { ok: true, status: 'claimed', duplicate: false };
        },
        getIngressSecrets: () => {
          secretsRead += 1;
          return { url: SECRET_URL, token: SECRET_TOKEN };
        },
        fetch: async () => {
          fetchCalls += 1;
          return { ok: true, status: 200 };
        },
      },
    );
    assert.equal(result.ok, false);
    assert.equal(result.status, 'unauthorized');
    assert.equal(result.delivered, false);
    assert.equal(result.httpStatus, 401);
    assert.equal(claimCalls, 0);
    assert.equal(fetchCalls, 0);
    assert.equal(secretsRead, 0);
    assert.equal(result.outboundCalls.length, 0);
  });

  it('rejects authenticated but unauthorized callers before fetch', async () => {
    let fetchCalls = 0;
    const result = await submitCommandPacket(
      { request: {}, packetId: 'pkt-forbidden', packetText: PACKET_TEXT },
      {
        authorize: authorizeForbidden,
        claimPacket: claimOnce(),
        getIngressSecrets: () => ({ url: SECRET_URL, token: SECRET_TOKEN }),
        fetch: async () => {
          fetchCalls += 1;
          return { ok: true, status: 200 };
        },
      },
    );
    assert.equal(result.status, 'forbidden');
    assert.equal(result.delivered, false);
    assert.equal(fetchCalls, 0);
  });

  it('reuses Command Center admin/superuser claim shapes', () => {
    assert.equal(isAuthorizedFromClaims({ role: 'authenticated' }), false);
    assert.equal(isAuthorizedFromClaims({ role: 'admin' }), true);
    assert.equal(isAuthorizedFromClaims({ app_metadata: { is_superuser: true } }), true);
    assert.equal(isAuthorizedFromRoles(['technician']), false);
    assert.equal(isAuthorizedFromRoles(['owner']), true);
  });
});

describe('NOS-N8N-REQ-COURIER-AUTHZ-PROTECTED-CLAIMS-01', () => {
  const authorizeFromProtectedClaims = (claims, durableRoles = []) => async () => {
    if (!claims) {
      return { ok: false, status: 'unauthorized', httpStatus: 401 };
    }
    if (isAuthorizedFromClaims(claims) || isAuthorizedFromRoles(durableRoles)) {
      return { ok: true, actorId: 'actor-1' };
    }
    return { ok: false, status: 'forbidden', httpStatus: 403 };
  };

  const submitWithAuthz = async ({ claims = null, durableRoles = [], packetId = 'pkt-authz' }) => {
    let claimCalls = 0;
    let fetchCalls = 0;
    let secretsRead = 0;
    const result = await submitCommandPacket(
      { request: {}, packetId, packetText: PACKET_TEXT },
      {
        authorize: authorizeFromProtectedClaims(claims, durableRoles),
        claimPacket: async () => {
          claimCalls += 1;
          return { ok: true, status: 'claimed', duplicate: false };
        },
        getIngressSecrets: () => {
          secretsRead += 1;
          return { url: SECRET_URL, token: SECRET_TOKEN };
        },
        fetch: async () => {
          fetchCalls += 1;
          return { ok: true, status: 200 };
        },
      },
    );
    return { result, claimCalls, fetchCalls, secretsRead };
  };

  it('AC-1 user_metadata.is_superuser === true does not authorize', () => {
    assert.equal(
      isAuthorizedFromClaims({
        role: 'authenticated',
        user_metadata: { is_superuser: true },
      }),
      false,
    );
  });

  it('AC-2 user_metadata.superuser === true does not authorize', () => {
    assert.equal(
      isAuthorizedFromClaims({
        role: 'authenticated',
        user_metadata: { superuser: true },
      }),
      false,
    );
  });

  it('AC-3 user_metadata admin/owner/role strings do not authorize', () => {
    for (const user_metadata of [
      { role: 'admin' },
      { role: 'super_admin' },
      { role: 'owner' },
      { admin: true },
      { owner: true },
      { is_admin: true },
    ]) {
      assert.equal(
        isAuthorizedFromClaims({ role: 'authenticated', user_metadata }),
        false,
        `user_metadata ${JSON.stringify(user_metadata)} must not authorize`,
      );
    }
  });

  it('AC-4 service_role still authorizes', () => {
    assert.equal(isAuthorizedFromClaims({ role: 'service_role' }), true);
  });

  it('AC-5 app_metadata.is_superuser === true still authorizes', () => {
    assert.equal(isAuthorizedFromClaims({ app_metadata: { is_superuser: true } }), true);
    assert.equal(isAuthorizedFromClaims({ app_metadata: { superuser: true } }), true);
  });

  it('AC-6 app_metadata.role in COMMAND_CENTER_ADMIN_ROLES still authorizes', () => {
    assert.equal(isAuthorizedFromClaims({ app_metadata: { role: 'admin' } }), true);
    assert.equal(isAuthorizedFromClaims({ app_metadata: { role: 'super_admin' } }), true);
    assert.equal(isAuthorizedFromClaims({ app_metadata: { role: 'owner' } }), true);
    assert.equal(isAuthorizedFromClaims({ app_metadata: { role: 'technician' } }), false);
  });

  it('AC-7 app_user_roles durable admin/super_admin/owner still authorizes', () => {
    assert.equal(isAuthorizedFromRoles(['admin']), true);
    assert.equal(isAuthorizedFromRoles(['super_admin']), true);
    assert.equal(isAuthorizedFromRoles(['owner']), true);
    assert.equal(isAuthorizedFromRoles(['technician']), false);
    assert.equal(isAuthorizedFromRoles([]), false);
  });

  it('AC-8 missing Bearer is 401; unprotected verified JWT is 403; no claim RPC; no outbound n8n', async () => {
    const missingBearer = await submitWithAuthz({ claims: null, packetId: 'pkt-authz-missing' });
    assert.equal(missingBearer.result.ok, false);
    assert.equal(missingBearer.result.status, 'unauthorized');
    assert.equal(missingBearer.result.httpStatus, 401);
    assert.equal(missingBearer.result.delivered, false);
    assert.equal(missingBearer.claimCalls, 0);
    assert.equal(missingBearer.fetchCalls, 0);
    assert.equal(missingBearer.secretsRead, 0);
    assert.equal(missingBearer.result.outboundCalls.length, 0);

    const unprotectedJwt = await submitWithAuthz({
      claims: {
        role: 'authenticated',
        user_metadata: { is_superuser: true, superuser: true, role: 'admin' },
      },
      durableRoles: ['technician'],
      packetId: 'pkt-authz-forbidden',
    });
    assert.equal(unprotectedJwt.result.ok, false);
    assert.equal(unprotectedJwt.result.status, 'forbidden');
    assert.equal(unprotectedJwt.result.httpStatus, 403);
    assert.equal(unprotectedJwt.result.delivered, false);
    assert.equal(unprotectedJwt.claimCalls, 0);
    assert.equal(unprotectedJwt.fetchCalls, 0);
    assert.equal(unprotectedJwt.secretsRead, 0);
    assert.equal(unprotectedJwt.result.outboundCalls.length, 0);
  });

  it('AC-10 courier auth path has no user_metadata authorization branch', () => {
    const courier = fs.readFileSync(
      path.join(root, 'supabase/functions/_shared/commandPacketCourier.mjs'),
      'utf8',
    );
    const edge = fs.readFileSync(
      path.join(root, 'supabase/functions/command-packet-courier/index.ts'),
      'utf8',
    );
    const start = courier.indexOf('export function isAuthorizedFromClaims');
    const end = courier.indexOf('export function isAuthorizedFromRoles');
    assert.ok(start >= 0 && end > start);
    const authFn = courier.slice(start, end);
    assert.equal(authFn.includes('user_metadata'), false);
    assert.equal(/\buser_metadata\b/.test(courier), false);
    assert.equal(/\buser_metadata\b/.test(edge), false);
    assert.match(authFn, /app_metadata/);
    assert.match(authFn, /service_role/);
  });
});

describe('2. duplicate packet_id produces no second outbound call', () => {
  it('is not runnable: PR 154 claim interface is incompatible with packet_id', () => {
    const inspection = inspectApprovedAtomicClaimInterface();
    assert.equal(inspection.found, false);
    assert.equal(inspection.status, ATOMIC_CLAIM_INTERFACE_MISMATCH);
  });
});

describe('3. valid authorized request constructs the required envelope', () => {
  it('builds event_type, delivery_id, occurred_at, source, and payload', () => {
    const occurredAt = '2026-08-29T23:50:00.000Z';
    const envelope = constructCommandPacketEnvelope({
      packetId: 'NOS-COMMAND-CENTER-N8N-COURIER-01',
      packetText: PACKET_TEXT,
      occurredAt,
    });
    assert.deepEqual(envelope, {
      event_type: EVENT_TYPE,
      delivery_id: 'NOS-COMMAND-CENTER-N8N-COURIER-01',
      occurred_at: occurredAt,
      source: SOURCE,
      payload: {
        packet_text: PACKET_TEXT,
        repository: { ...PERMITTED_REPOSITORY_CONTEXT },
      },
    });
  });

  it('authorized production path constructs the envelope then stops before outbound', async () => {
    let fetchCalls = 0;
    const occurredAt = '2026-08-29T23:51:00.000Z';
    const result = await submitCommandPacket(
      {
        request: {},
        packetId: 'pkt-construct',
        packetText: PACKET_TEXT,
        occurredAt,
      },
      {
        authorize: authorizeOk,
        claimPacket: defaultProductionClaimAdapter(),
        getIngressSecrets: () => ({ url: SECRET_URL, token: SECRET_TOKEN }),
        fetch: async () => {
          fetchCalls += 1;
          return { ok: true, status: 200 };
        },
      },
    );
    assert.equal(result.status, ATOMIC_CLAIM_INTERFACE_MISMATCH);
    assert.equal(result.delivered, false);
    assert.equal(fetchCalls, 0);
    assert.deepEqual(result.constructed, envelopePublicPreview({
      event_type: EVENT_TYPE,
      delivery_id: 'pkt-construct',
      occurred_at: occurredAt,
      source: SOURCE,
      payload: { packet_text: PACKET_TEXT, repository: PERMITTED_REPOSITORY_CONTEXT },
    }));
    assert.equal(result.constructed.event_type, EVENT_TYPE);
    assert.equal(result.constructed.delivery_id, 'pkt-construct');
    assert.equal(result.constructed.source, SOURCE);
    assert.equal(result.constructed.payload.packet_text_present, true);
    assert.deepEqual(result.constructed.payload.repository, PERMITTED_REPOSITORY_CONTEXT);
    assert.equal('packet_text' in result.constructed.payload, false);
  });
});

describe('4. secrets are absent from client code and logs', () => {
  it('does not leak token, webhook URL, packet text, or authorization in logs/responses', async () => {
    const result = await submitCommandPacket(
      {
        request: {},
        packetId: 'pkt-redact',
        packetText: PACKET_TEXT,
        authorization: `Bearer ${SECRET_TOKEN}`,
      },
      {
        authorize: authorizeOk,
        claimPacket: async () => ({ ok: true, status: 'claimed', duplicate: false }),
        getIngressSecrets: () => ({ url: SECRET_URL, token: SECRET_TOKEN }),
        fetch: async () => {
          throw new Error(`failed contacting ${SECRET_URL} token=${SECRET_TOKEN} ${PACKET_TEXT}`);
        },
      },
    );
    const serialized = JSON.stringify(result);
    assert.equal(serialized.includes(SECRET_TOKEN), false);
    assert.equal(serialized.includes(SECRET_URL), false);
    assert.equal(serialized.includes(PACKET_TEXT), false);
    assert.equal(serialized.includes(`Bearer ${SECRET_TOKEN}`), false);
    const redacted = redactSensitive(
      { authorization: `Bearer ${SECRET_TOKEN}`, packet_text: PACKET_TEXT, ingress_url: SECRET_URL },
      { token: SECRET_TOKEN, url: SECRET_URL, packetText: PACKET_TEXT },
    );
    assert.equal(redacted.authorization, '[REDACTED]');
    assert.equal(redacted.packet_text, '[REDACTED]');
    assert.equal(redacted.ingress_url, '[REDACTED]');
  });

  it('keeps ingress secret names and token header out of the Vite client tree', () => {
    const srcFiles = walkFiles(path.join(root, 'src')).filter((file) =>
      /\.(js|jsx|ts|tsx|mjs|cjs|css|html)$/.test(file),
    );
    const banned = [
      'N8N_COMMAND_INGRESS_URL',
      'N8N_COMMAND_INGRESS_TOKEN',
      INGRESS_TOKEN_HEADER,
    ];
    const hits = [];
    for (const file of srcFiles) {
      const text = fs.readFileSync(file, 'utf8');
      for (const needle of banned) {
        if (text.includes(needle)) hits.push(`${path.relative(root, file)}:${needle}`);
      }
    }
    assert.deepEqual(hits, []);
  });

  it('does not hardcode a live webhook URL in courier runtime or client', () => {
    const targets = [
      path.join(root, 'supabase/functions/_shared/commandPacketCourier.mjs'),
      path.join(root, 'supabase/functions/command-packet-courier/index.ts'),
      ...walkFiles(path.join(root, 'src')).filter((file) => /\.(js|jsx|ts|tsx)$/.test(file)),
    ];
    const webhookPattern = /https?:\/\/[^\s'"]*n8n[^\s'"]*/i;
    const hits = [];
    for (const file of targets) {
      if (!fs.existsSync(file)) continue;
      const text = fs.readFileSync(file, 'utf8');
      if (webhookPattern.test(text)) hits.push(path.relative(root, file));
    }
    assert.deepEqual(hits, []);
  });
});

describe('claim failure and concurrency (PR 154 mismatch)', () => {
  it('claim mismatch / failure produces no n8n request', async () => {
    let fetchCalls = 0;
    const result = await submitCommandPacket(
      { request: {}, packetId: 'pkt-claim-fail', packetText: PACKET_TEXT },
      {
        authorize: authorizeOk,
        claimPacket: defaultProductionClaimAdapter(),
        getIngressSecrets: () => ({ url: SECRET_URL, token: SECRET_TOKEN }),
        fetch: async () => {
          fetchCalls += 1;
          return { ok: true, status: 200 };
        },
      },
    );
    assert.equal(result.status, ATOMIC_CLAIM_INTERFACE_MISMATCH);
    assert.equal(result.delivered, false);
    assert.equal(fetchCalls, 0);
    assert.equal(result.outboundCalls.length, 0);
  });

  it('does not invent a 25-way packet_id race against an incompatible GitHub PR claim', () => {
    assert.equal(inspectApprovedAtomicClaimInterface().status, ATOMIC_CLAIM_INTERFACE_MISMATCH);
  });
});

describe('5. n8n/network failure returns controlled failure and does not mark delivered', () => {
  it('network throw does not mark delivered', async () => {
    const result = await submitCommandPacket(
      { request: {}, packetId: 'pkt-net', packetText: PACKET_TEXT },
      {
        authorize: authorizeOk,
        claimPacket: async () => ({ ok: true, status: 'claimed', duplicate: false }),
        getIngressSecrets: () => ({ url: SECRET_URL, token: SECRET_TOKEN }),
        fetch: async () => {
          throw new Error('ECONNRESET');
        },
      },
    );
    assert.equal(result.ok, false);
    assert.equal(result.status, 'transport');
    assert.equal(result.delivered, false);
    assert.equal(result.httpStatus, 502);
    assert.equal(result.outboundCalls.length, 1);
  });

  it('non-2xx ingress does not mark delivered', async () => {
    const posted = [];
    const result = await submitCommandPacket(
      { request: {}, packetId: 'pkt-502', packetText: PACKET_TEXT },
      {
        authorize: authorizeOk,
        claimPacket: async () => ({ ok: true, status: 'claimed', duplicate: false }),
        getIngressSecrets: () => ({ url: SECRET_URL, token: SECRET_TOKEN }),
        fetch: async (url, init) => {
          posted.push({ url, headerNames: Object.keys(init.headers), body: JSON.parse(init.body) });
          return { ok: false, status: 500 };
        },
      },
    );
    assert.equal(result.delivered, false);
    assert.equal(result.status, 'http_5xx');
    assert.equal(posted[0].headerNames.includes(INGRESS_TOKEN_HEADER), true);
    assert.equal(posted[0].body.event_type, EVENT_TYPE);
    assert.equal(posted[0].body.delivery_id, 'pkt-502');
    assert.equal(posted[0].body.source, SOURCE);
  });

  it('postIngressEnvelope itself never reports delivered on failure', async () => {
    const failed = await postIngressEnvelope({
      envelope: { event_type: EVENT_TYPE },
      url: SECRET_URL,
      token: SECRET_TOKEN,
      fetchImpl: async () => {
        throw new Error('timeout');
      },
    });
    assert.equal(failed.ok, false);
    assert.equal(failed.delivered, false);
    assert.equal(failed.status, 'transport');
  });
});

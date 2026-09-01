/**
 * NOS-N8N-COMMAND-PACKET-CLAIM-CONTRACT-01
 * Isolated unit coverage for the command-packet claim courier wiring.
 * Run: node --test tests/unit/command-packet-claim-contract.test.mjs
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  COMMAND_PACKET_CLAIM_FUNCTION,
  COMMAND_PACKET_DISPATCH_STARTED_FUNCTION,
  COMMAND_PACKET_FINALIZE_FUNCTION,
  COMMAND_PACKET_LEASE_FUNCTION,
  EVENT_TYPE,
  PACKET_DIGEST_PATTERN,
  PACKET_ID_PATTERN,
  SOURCE,
  constructCommandPacketEnvelope,
  createCommandPacketClaimAdapter,
  digestCommandPacketEnvelope,
  inspectApprovedAtomicClaimInterface,
  redactSensitive,
  submitCommandPacket,
  validateCommandPacketInput,
} from '../../supabase/functions/_shared/commandPacketCourier.mjs';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '../..');
const SECRET_URL = 'https://example.invalid/ingress/test-only';
const SECRET_TOKEN = 'test-ingress-token-value';
const PACKET_TEXT = 'NOS-WI-N8N-COMMAND-PACKET-CLAIM-01 synthetic packet';

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

const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');

describe('AC-1 purpose isolation vs PR 154', () => {
  it('adds a command-packet table/RPC and does not copy the GitHub assurance store', () => {
    const migration = read('supabase/migrations/20260830050000_network_os_command_packet_claims.sql');
    const rollback = read('supabase/rollbacks/20260830050000_network_os_command_packet_claims.sql');
    const courier = read('supabase/functions/_shared/commandPacketCourier.mjs');
    const edge = read('supabase/functions/command-packet-courier/index.ts');

    assert.match(migration, /CREATE TABLE public\.network_os_command_packet_claims/);
    assert.match(migration, /CREATE FUNCTION public\.network_os_claim_command_packet/);
    assert.match(migration, /RETURNS text/);
    assert.match(migration, /ON CONFLICT \(packet_id\) DO NOTHING/);
    assert.match(migration, /SECURITY DEFINER/);
    assert.match(migration, /SET search_path = public, pg_temp/);
    assert.match(migration, /FORCE ROW LEVEL SECURITY/);
    assert.match(migration, /GRANT EXECUTE ON FUNCTION[\s\S]*TO service_role/);
    assert.match(migration, /event_type = 'command\.packet\.submitted'/);
    assert.match(migration, /source = 'bhfos-command-center'/);
    assert.match(migration, /packet_digest ~ '\^\[0-9a-f\]\{64\}\$'/);
    assert.match(migration, /claimed_at timestamptz NOT NULL DEFAULT clock_timestamp\(\)/);
    assert.doesNotMatch(migration, /network_os_assurance_delivery_claims/);
    assert.doesNotMatch(migration, /network_os_claim_assurance_delivery/);
    assert.doesNotMatch(migration, /delivery_id/);
    assert.doesNotMatch(migration, /installation_id|pr_number|head_sha|repository_id|pull_request/);
    assert.doesNotMatch(migration, /\bpacket_text\b/);
    assert.doesNotMatch(migration, /\bexpires_at\b|\bforward_state\b|\bwebhook\b|\bauthorization\b/);
    assert.match(migration, /packet_id text PRIMARY KEY/);
    assert.doesNotMatch(migration, /CREATE TABLE[\s\S]*packet_text/);
    assert.doesNotMatch(migration, /GRANT (SELECT|INSERT|UPDATE|DELETE)[\s\S]*TO (anon|authenticated|service_role)/);

    assert.match(rollback, /DROP FUNCTION IF EXISTS public\.network_os_claim_command_packet/);
    assert.match(rollback, /DROP TABLE IF EXISTS public\.network_os_command_packet_claims/);
    assert.doesNotMatch(rollback, /network_os_assurance_delivery/);

    assert.equal(fs.existsSync(path.join(root, 'supabase/migrations/20260828170000_network_os_assurance_delivery_claims.sql')), false);
    assert.equal(fs.existsSync(path.join(root, 'supabase/rollbacks/20260828170000_network_os_assurance_delivery_claims.sql')), false);
    assert.equal(courier.includes('rpc('), false);
    assert.equal(edge.includes('network_os_claim_assurance_delivery'), false);
    assert.equal(edge.includes('COMMAND_PACKET_CLAIM_FUNCTION'), false);
    assert.match(edge, /COMMAND_PACKET_LEASE_FUNCTION/);
    assert.match(edge, /COMMAND_PACKET_DISPATCH_STARTED_FUNCTION/);
    assert.match(edge, /COMMAND_PACKET_FINALIZE_FUNCTION/);
    assert.equal(COMMAND_PACKET_CLAIM_FUNCTION, 'network_os_claim_command_packet');
    assert.equal(COMMAND_PACKET_LEASE_FUNCTION, 'network_os_lease_command_packet');
    assert.equal(COMMAND_PACKET_DISPATCH_STARTED_FUNCTION, 'network_os_mark_command_packet_dispatch_started');
    assert.equal(COMMAND_PACKET_FINALIZE_FUNCTION, 'network_os_finalize_command_packet_delivery');

    const inspection = inspectApprovedAtomicClaimInterface();
    assert.equal(inspection.status, 'ATOMIC_CLAIM_INTERFACE_MISMATCH');
    assert.ok(inspection.rejected.some((row) => row.candidate.includes('network_os_claim_assurance_delivery')));
  });
});

describe('digest and validation', () => {
  it('accepts safe packet ids and rejects empty or oversized ids', () => {
    assert.equal(validateCommandPacketInput({ packetId: 'pkt-1', packetText: PACKET_TEXT }).ok, true);
    assert.equal(validateCommandPacketInput({ packetId: '', packetText: PACKET_TEXT }).ok, false);
    assert.equal(validateCommandPacketInput({ packetId: 'x'.repeat(129), packetText: PACKET_TEXT }).ok, false);
    assert.equal(validateCommandPacketInput({ packetId: 'pkt 1', packetText: PACKET_TEXT }).ok, false);
    assert.equal(PACKET_ID_PATTERN.test('NOS-WI-N8N-COMMAND-PACKET-CLAIM-01'), true);
  });

  it('computes a 64-hex digest without returning packet text', async () => {
    const envelope = constructCommandPacketEnvelope({
      packetId: 'pkt-digest-1',
      packetText: PACKET_TEXT,
      occurredAt: '2026-08-30T05:00:00.000Z',
    });
    const digest = await digestCommandPacketEnvelope(envelope);
    assert.equal(PACKET_DIGEST_PATTERN.test(digest), true);
    assert.equal(digest.includes(PACKET_TEXT), false);
    const again = await digestCommandPacketEnvelope({
      ...envelope,
      occurred_at: '2026-08-30T06:00:00.000Z',
    });
    assert.equal(digest, again);
    const other = await digestCommandPacketEnvelope(
      constructCommandPacketEnvelope({
        packetId: 'pkt-digest-1',
        packetText: `${PACKET_TEXT}-mutated`,
        occurredAt: '2026-08-30T05:00:00.000Z',
      }),
    );
    assert.notEqual(digest, other);
  });
});

describe('AC-2 / AC-3 claimed then duplicate', () => {
  it('first claimed grant produces exactly one outbound adapter call; duplicate adds none', async () => {
    const outcomes = ['claimed', 'duplicate'];
    let invokeCount = 0;
    let fetchCalls = 0;
    const claimPacket = createCommandPacketClaimAdapter(async () => {
      invokeCount += 1;
      return outcomes.shift();
    });

    const first = await submitCommandPacket(
      { request: {}, packetId: 'pkt-claim-once', packetText: PACKET_TEXT },
      {
        authorize: authorizeOk,
        claimPacket,
        getIngressSecrets: () => ({ url: SECRET_URL, token: SECRET_TOKEN }),
        fetch: async () => {
          fetchCalls += 1;
          return { ok: true, status: 200 };
        },
      },
    );
    const second = await submitCommandPacket(
      { request: {}, packetId: 'pkt-claim-once', packetText: PACKET_TEXT },
      {
        authorize: authorizeOk,
        claimPacket,
        getIngressSecrets: () => ({ url: SECRET_URL, token: SECRET_TOKEN }),
        fetch: async () => {
          fetchCalls += 1;
          return { ok: true, status: 200 };
        },
      },
    );

    assert.equal(first.ok, true);
    assert.equal(first.status, 'submitted');
    assert.equal(first.delivered, true);
    assert.equal(first.outboundCalls.length, 1);
    assert.equal(second.ok, false);
    assert.equal(second.status, 'duplicate');
    assert.equal(second.delivered, false);
    assert.equal(second.outboundCalls.length, 0);
    assert.equal(invokeCount, 2);
    assert.equal(fetchCalls, 1);
  });
});

describe('AC-5 conflict', () => {
  it('same packet_id with a different digest is conflict and adds no outbound', async () => {
    let fetchCalls = 0;
    const claimPacket = createCommandPacketClaimAdapter(async () => 'conflict');
    const result = await submitCommandPacket(
      { request: {}, packetId: 'pkt-conflict', packetText: PACKET_TEXT },
      {
        authorize: authorizeOk,
        claimPacket,
        getIngressSecrets: () => ({ url: SECRET_URL, token: SECRET_TOKEN }),
        fetch: async () => {
          fetchCalls += 1;
          return { ok: true, status: 200 };
        },
      },
    );
    assert.equal(result.ok, false);
    assert.equal(result.status, 'conflict');
    assert.equal(result.delivered, false);
    assert.equal(result.outboundCalls.length, 0);
    assert.equal(fetchCalls, 0);
  });
});

describe('AC-6 claim failure', () => {
  it('RPC/indeterminate failure produces zero outbound and does not invent memory fallback', async () => {
    let fetchCalls = 0;
    const claimPacket = createCommandPacketClaimAdapter(async () => {
      throw new Error('db_unavailable');
    });
    const result = await submitCommandPacket(
      { request: {}, packetId: 'pkt-claim-fail', packetText: PACKET_TEXT },
      {
        authorize: authorizeOk,
        claimPacket,
        getIngressSecrets: () => ({ url: SECRET_URL, token: SECRET_TOKEN }),
        fetch: async () => {
          fetchCalls += 1;
          return { ok: true, status: 200 };
        },
      },
    );
    assert.equal(result.ok, false);
    assert.equal(result.status, 'claim_failed');
    assert.equal(result.delivered, false);
    assert.equal(result.outboundCalls.length, 0);
    assert.equal(fetchCalls, 0);
    assert.equal(result.inspection, undefined);
  });
});

describe('AC-7 unauthorized', () => {
  it('does not invoke the claim function, read ingress secrets, or outbound', async () => {
    let invokeCount = 0;
    let secretsRead = 0;
    let fetchCalls = 0;
    const result = await submitCommandPacket(
      { request: {}, packetId: 'pkt-unauth-claim', packetText: PACKET_TEXT },
      {
        authorize: authorizeNo,
        claimPacket: createCommandPacketClaimAdapter(async () => {
          invokeCount += 1;
          return 'claimed';
        }),
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
    assert.equal(result.status, 'unauthorized');
    assert.equal(result.delivered, false);
    assert.equal(invokeCount, 0);
    assert.equal(secretsRead, 0);
    assert.equal(fetchCalls, 0);
    assert.equal(result.outboundCalls.length, 0);
  });
});

describe('AC-8 / AC-9 secret and client-bundle boundary', () => {
  it('redacts packet text, URLs, tokens, and authorization from public results', async () => {
    const result = await submitCommandPacket(
      {
        request: {},
        packetId: 'pkt-redact-claim',
        packetText: PACKET_TEXT,
        authorization: `Bearer ${SECRET_TOKEN}`,
      },
      {
        authorize: authorizeOk,
        claimPacket: createCommandPacketClaimAdapter(async () => 'claimed'),
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
    const redacted = redactSensitive(
      { authorization: `Bearer ${SECRET_TOKEN}`, packet_text: PACKET_TEXT, ingress_url: SECRET_URL },
      { token: SECRET_TOKEN, url: SECRET_URL, packetText: PACKET_TEXT },
    );
    assert.equal(redacted.authorization, '[REDACTED]');
    assert.equal(redacted.packet_text, '[REDACTED]');
    assert.equal(redacted.ingress_url, '[REDACTED]');
  });

  it('keeps claim RPC, table, service_role, and courier impl out of the Vite client tree', () => {
    const srcFiles = walkFiles(path.join(root, 'src')).filter((file) =>
      /\.(js|jsx|ts|tsx|mjs|cjs|css|html)$/.test(file),
    );
    const banned = [
      'network_os_claim_command_packet',
      'network_os_command_packet_claims',
      'network_os_lease_command_packet',
      'network_os_mark_command_packet_dispatch_started',
      'network_os_finalize_command_packet_delivery',
      'network_os_command_packet_delivery_attempts',
      'COMMAND_PACKET_CLAIM_FUNCTION',
      'N8N_COMMAND_INGRESS_URL',
      'N8N_COMMAND_INGRESS_TOKEN',
      'createCommandPacketClaimAdapter',
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
});

/**
 * NOS-N8N-RECOVERABLE-DELIVERY-IMPLEMENTATION-01
 * Isolated unit coverage for recoverable delivery source + Edge mapping.
 * Run: node --test tests/unit/command-packet-recoverable-delivery.test.mjs
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
  COMMAND_PACKET_LEASE_OWNER,
  DB_FINALIZATION_MARGIN,
  HTTP_DISPATCH_TIMEOUT,
  HTTP_DISPATCH_TIMEOUT_MS,
  LEASE_TTL,
  POST_DISPATCH_FINALIZE_WINDOW,
  RUNTIME_MARGIN,
  createCommandPacketFinalizeAdapter,
  createCommandPacketLeaseAdapter,
  finalizePairForDispatchOutcome,
  mapHttpDispatchOutcome,
  postIngressEnvelope,
  submitCommandPacket,
} from '../../supabase/functions/_shared/commandPacketCourier.mjs';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '../..');
const SECRET_URL = 'https://example.invalid/ingress/test-only';
const SECRET_TOKEN = 'test-ingress-token-value';
const PACKET_TEXT = 'NOS-N8N-RECOVERABLE-DELIVERY-IMPLEMENTATION-01 synthetic packet';
const DIGEST = 'a'.repeat(64);

const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');
const authorizeOk = async () => ({ ok: true, actorId: 'actor-1' });

describe('frozen durations and identities', () => {
  it('encodes 15s / 2s / 3s / 20s / 20s and p_lease_owner', () => {
    assert.equal(HTTP_DISPATCH_TIMEOUT, 15);
    assert.equal(DB_FINALIZATION_MARGIN, 2);
    assert.equal(RUNTIME_MARGIN, 3);
    assert.equal(LEASE_TTL, 20);
    assert.equal(POST_DISPATCH_FINALIZE_WINDOW, 20);
    assert.equal(HTTP_DISPATCH_TIMEOUT + DB_FINALIZATION_MARGIN + RUNTIME_MARGIN, LEASE_TTL);
    assert.equal(COMMAND_PACKET_LEASE_OWNER, 'command-packet-courier');
    assert.equal(COMMAND_PACKET_LEASE_FUNCTION, 'network_os_lease_command_packet');
    assert.equal(COMMAND_PACKET_DISPATCH_STARTED_FUNCTION, 'network_os_mark_command_packet_dispatch_started');
    assert.equal(COMMAND_PACKET_FINALIZE_FUNCTION, 'network_os_finalize_command_packet_delivery');
    assert.equal(COMMAND_PACKET_CLAIM_FUNCTION, 'network_os_claim_command_packet');
  });
});

describe('T1-T16 source contract', () => {
  const migration = read('supabase/migrations/20260901010000_network_os_command_packet_recoverable_delivery.sql');
  const rollback = read('supabase/rollbacks/20260901010000_network_os_command_packet_recoverable_delivery.sql');
  const claimsMigration = read('supabase/migrations/20260830050000_network_os_command_packet_claims.sql');
  const courier = read('supabase/functions/_shared/commandPacketCourier.mjs');
  const edge = read('supabase/functions/command-packet-courier/index.ts');

  it('T1 AC-3 backfill then ALWAYS SET NOT NULL; unexpected rows RAISE', () => {
    assert.match(migration, /packet_id IS DISTINCT FROM 'NOS-AC3-AUTH-SYNTH-01'/);
    assert.match(migration, /delivery_state = 'reconciliation_required'/);
    assert.match(migration, /dispatch_outcome = 'historical_delivery_unknown'/);
    assert.match(migration, /dispatch_started_at = NULL/);
    assert.match(migration, /ALTER COLUMN delivery_state SET NOT NULL/);
    assert.doesNotMatch(migration, /SET claimed_at/);
    assert.match(migration, /network_os_command_packet_recoverable_delivery_unexpected_claim_rows/);
  });

  it('T1 preserves claim identity columns and adds exactly the additive set', () => {
    assert.match(claimsMigration, /packet_id text PRIMARY KEY/);
    assert.match(claimsMigration, /packet_digest text NOT NULL/);
    assert.match(claimsMigration, /event_type text NOT NULL/);
    assert.match(claimsMigration, /source text NOT NULL/);
    assert.match(claimsMigration, /claimed_at timestamptz NOT NULL DEFAULT clock_timestamp\(\)/);
    for (const column of [
      'delivery_state text',
      'lease_token text',
      'lease_owner text',
      'lease_acquired_at timestamptz',
      'lease_expires_at timestamptz',
      'dispatch_started_at timestamptz',
      'post_dispatch_finalize_deadline_at timestamptz',
      'dispatch_outcome text',
      'delivered_at timestamptz',
      'current_attempt_no integer',
    ]) {
      assert.match(migration, new RegExp(column.replace(/ /g, '\\s+')));
    }
    assert.doesNotMatch(migration, /ADD COLUMN\s+packet_text|packet_text\s+text/);
    assert.doesNotMatch(migration, /CREATE TABLE public\.network_os_command_packet_claims/);
  });

  it('T3 CHECK vocabulary and delivered/retryable/deadline/AC-3 rules', () => {
    assert.match(migration, /delivery_state IN \('leased', 'delivered', 'retryable', 'reconciliation_required'\)/);
    assert.match(migration, /dispatch_outcome IS DISTINCT FROM 'finalization_failed'/);
    assert.match(migration, /delivery_state <> 'delivered'[\s\S]*http_2xx[\s\S]*dispatch_started_at IS NOT NULL[\s\S]*delivered_at IS NOT NULL/);
    assert.match(migration, /delivery_state <> 'retryable'[\s\S]*dispatch_started_at IS NULL/);
    assert.match(migration, /dispatch_started_at IS NULL[\s\S]*OR post_dispatch_finalize_deadline_at IS NOT NULL/);
    assert.match(migration, /historical_delivery_unknown/);
  });

  it('T4 attempt table phases + unique lease index + FORCE RLS + REVOKE ALL', () => {
    assert.match(migration, /CREATE TABLE public\.network_os_command_packet_delivery_attempts/);
    assert.match(migration, /phase IN \('lease_acquired', 'dispatch_started', 'finalize_ok'\)/);
    assert.match(migration, /lease_token text NOT NULL/);
    assert.match(migration, /CREATE UNIQUE INDEX network_os_command_packet_attempt_lease_uq/);
    assert.match(
      migration,
      /ON public\.network_os_command_packet_delivery_attempts \(packet_id, attempt_no\)\s+WHERE phase = 'lease_acquired'/,
    );
    assert.match(migration, /ENABLE ROW LEVEL SECURITY/);
    assert.match(migration, /FORCE ROW LEVEL SECURITY/);
    assert.match(migration, /REVOKE ALL ON TABLE public\.network_os_command_packet_delivery_attempts FROM PUBLIC/);
    assert.match(migration, /REVOKE ALL ON TABLE public\.network_os_command_packet_delivery_attempts FROM service_role/);
    assert.doesNotMatch(migration, /CREATE POLICY/);
    assert.doesNotMatch(migration, /GRANT (SELECT|INSERT|UPDATE|DELETE)/);
  });

  it('T5 drops old claim RPC and adds three SECURITY DEFINER RPCs', () => {
    assert.match(migration, /DROP FUNCTION IF EXISTS public\.network_os_claim_command_packet\(text, text, text, text\)/);
    assert.match(migration, /CREATE FUNCTION public\.network_os_lease_command_packet/);
    assert.match(migration, /CREATE FUNCTION public\.network_os_mark_command_packet_dispatch_started/);
    assert.match(migration, /CREATE FUNCTION public\.network_os_finalize_command_packet_delivery/);
    assert.equal((migration.match(/SET search_path = pg_temp/g) || []).length, 3);
    assert.doesNotMatch(migration, /SET search_path = public, pg_temp/);
    assert.match(migration, /ON CONFLICT \(packet_id\) DO NOTHING/);
    assert.match(migration, /FOR UPDATE/);
    assert.match(migration, /COALESCE\(v_row\.current_attempt_no, 0\) \+ 1/);
    assert.doesNotMatch(migration, /MAX\(/);
    assert.match(migration, /p_lease_ttl IS DISTINCT FROM interval '20 seconds'/);
    assert.match(migration, /p_lease_owner IS DISTINCT FROM 'command-packet-courier'/);
    assert.match(migration, /GRANT EXECUTE ON FUNCTION public\.network_os_lease_command_packet/);
    assert.match(migration, /GRANT EXECUTE ON FUNCTION public\.network_os_mark_command_packet_dispatch_started/);
    assert.match(migration, /GRANT EXECUTE ON FUNCTION public\.network_os_finalize_command_packet_delivery/);
    assert.doesNotMatch(migration, /GRANT EXECUTE[\s\S]*TO (anon|authenticated)/);
    assert.doesNotMatch(migration, /CREATE FUNCTION public\.network_os_claim_command_packet/);
  });

  it('T6 post-dispatch fence and no second lease after dispatch_started_at', () => {
    assert.match(migration, /clock_timestamp\(\) < v_row\.post_dispatch_finalize_deadline_at/);
    assert.match(migration, /outcome := 'in_flight'/);
    assert.match(migration, /delivery_state = 'reconciliation_required'/);
    assert.match(migration, /IF v_row\.dispatch_started_at IS NOT NULL THEN/);
  });

  it('T7 mark_dispatch_started requires unexpired lease and sets +20s deadline', () => {
    assert.match(migration, /v_now \+ interval '20 seconds'/);
    assert.match(migration, /v_row\.lease_expires_at <= clock_timestamp\(\)/);
    assert.match(migration, /outcome := 'lease_lost'/);
  });

  it('T8 finalize same-token without requiring unexpired lease; lease_lost writes no attempt', () => {
    assert.match(migration, /v_row\.lease_token IS DISTINCT FROM p_lease_token/);
    assert.doesNotMatch(
      migration.split('CREATE FUNCTION public.network_os_finalize_command_packet_delivery')[1],
      /lease_expires_at <= clock_timestamp/,
    );
    assert.match(migration, /p_delivery_state = 'delivered' AND p_dispatch_outcome = 'http_2xx'/);
    assert.match(migration, /p_dispatch_outcome IN \('http_4xx', 'http_5xx', 'timeout', 'transport'\)/);
  });

  it('T15 rollback locks claims then attempts ACCESS EXCLUSIVE and does not drop claims or recreate old RPC', () => {
    const claimsLock = rollback.indexOf('LOCK TABLE public.network_os_command_packet_claims IN ACCESS EXCLUSIVE MODE');
    const attemptsLock = rollback.indexOf('LOCK TABLE public.network_os_command_packet_delivery_attempts IN ACCESS EXCLUSIVE MODE');
    assert.ok(claimsLock >= 0 && attemptsLock > claimsLock);
    assert.match(rollback, /network_os_command_packet_recoverable_delivery_rollback_blocked_attempts_exist/);
    assert.match(rollback, /DROP FUNCTION IF EXISTS public\.network_os_finalize_command_packet_delivery/);
    assert.match(rollback, /DROP FUNCTION IF EXISTS public\.network_os_mark_command_packet_dispatch_started/);
    assert.match(rollback, /DROP FUNCTION IF EXISTS public\.network_os_lease_command_packet/);
    assert.match(rollback, /DROP TABLE IF EXISTS public\.network_os_command_packet_delivery_attempts/);
    assert.match(rollback, /DROP COLUMN IF EXISTS delivery_state/);
    assert.doesNotMatch(rollback, /DROP TABLE IF EXISTS public\.network_os_command_packet_claims/);
    assert.doesNotMatch(rollback, /DELETE FROM public\.network_os_command_packet_claims/);
    assert.doesNotMatch(rollback, /NOS-AC3-AUTH-SYNTH-01/);
    assert.doesNotMatch(rollback, /CREATE FUNCTION public\.network_os_claim_command_packet/);
  });

  it('T16 Edge secrets-before-lease, 15s abort, local finalize_failed, no old RPC', () => {
    assert.match(edge, /getIngressSecrets:/);
    const secretsIdx = edge.indexOf('getIngressSecrets:');
    const leaseIdx = edge.indexOf('leasePacket:');
    assert.ok(secretsIdx >= 0 && leaseIdx > secretsIdx);
    assert.match(courier, /AbortSignal\.timeout\(timeoutMs\)/);
    assert.match(courier, /AbortSignal\.timeout/);
    assert.equal(HTTP_DISPATCH_TIMEOUT_MS, 15000);
    assert.match(courier, /status: 'finalize_failed'/);
    assert.doesNotMatch(edge, /COMMAND_PACKET_CLAIM_FUNCTION/);
    assert.doesNotMatch(edge, /network_os_claim_command_packet/);
    assert.match(migration, /dispatch_outcome IS DISTINCT FROM 'finalization_failed'/);
  });
});

describe('Edge mapping and adapters', () => {
  it('maps 2xx/4xx/5xx/timeout/transport', () => {
    assert.equal(mapHttpDispatchOutcome({ status: 200 }, null).dispatchOutcome, 'http_2xx');
    assert.equal(mapHttpDispatchOutcome({ status: 404 }, null).dispatchOutcome, 'http_4xx');
    assert.equal(mapHttpDispatchOutcome({ status: 503 }, null).dispatchOutcome, 'http_5xx');
    assert.equal(mapHttpDispatchOutcome(null, { name: 'TimeoutError' }).dispatchOutcome, 'timeout');
    assert.equal(mapHttpDispatchOutcome(null, { name: 'AbortError' }).dispatchOutcome, 'timeout');
    assert.equal(mapHttpDispatchOutcome(null, { name: 'TypeError' }).dispatchOutcome, 'transport');
    assert.deepEqual(finalizePairForDispatchOutcome('http_2xx'), {
      deliveryState: 'delivered',
      dispatchOutcome: 'http_2xx',
    });
    assert.deepEqual(finalizePairForDispatchOutcome('timeout'), {
      deliveryState: 'reconciliation_required',
      dispatchOutcome: 'timeout',
    });
  });

  it('lease adapter maps INSERT-winner leased and loser in_flight/conflict', async () => {
    const lease = createCommandPacketLeaseAdapter(async () => ({
      outcome: 'leased',
      lease_token: 'tok-1',
      attempt_no: 1,
      delivery_state: 'leased',
    }));
    const won = await lease('pkt-1', { packetDigest: DIGEST });
    assert.equal(won.ok, true);
    assert.equal(won.status, 'leased');
    assert.equal(won.leaseToken, 'tok-1');
    assert.equal(won.attemptNo, 1);

    const held = createCommandPacketLeaseAdapter(async () => ({ outcome: 'in_flight' }));
    const second = await held('pkt-1', { packetDigest: DIGEST });
    assert.equal(second.ok, false);
    assert.equal(second.status, 'in_flight');
    assert.equal(second.duplicate, true);

    const conflicted = createCommandPacketLeaseAdapter(async () => ({ outcome: 'conflict' }));
    const clash = await conflicted('pkt-1', { packetDigest: DIGEST });
    assert.equal(clash.status, 'conflict');
  });

  it('T13 2xx + finalize failure is local finalize_failed and does not mark delivered', async () => {
    let leaseCalls = 0;
    let fetchCalls = 0;
    const result = await submitCommandPacket(
      { request: {}, packetId: 'pkt-finalize-fail', packetText: PACKET_TEXT },
      {
        authorize: authorizeOk,
        getIngressSecrets: () => ({ url: SECRET_URL, token: SECRET_TOKEN }),
        leasePacket: async () => {
          leaseCalls += 1;
          return { ok: true, status: 'leased', leaseToken: 'tok-z', attemptNo: 1 };
        },
        markDispatchStarted: async () => ({ ok: true, status: 'ok' }),
        finalizeDelivery: createCommandPacketFinalizeAdapter(async () => {
          throw new Error('db_finalize_unavailable');
        }),
        fetch: async () => {
          fetchCalls += 1;
          return { ok: true, status: 200 };
        },
      },
    );
    assert.equal(leaseCalls, 1);
    assert.equal(fetchCalls, 1);
    assert.equal(result.ok, false);
    assert.equal(result.status, 'finalize_failed');
    assert.equal(result.delivered, false);
    assert.equal(JSON.stringify(result).includes(SECRET_TOKEN), false);
  });

  it('reads secrets before lease and does not lease when secrets are missing', async () => {
    let leaseCalls = 0;
    let secretsRead = 0;
    const result = await submitCommandPacket(
      { request: {}, packetId: 'pkt-no-secrets', packetText: PACKET_TEXT },
      {
        authorize: authorizeOk,
        getIngressSecrets: () => {
          secretsRead += 1;
          return { url: '', token: '' };
        },
        leasePacket: async () => {
          leaseCalls += 1;
          return { ok: true, status: 'leased', leaseToken: 'tok' };
        },
        fetch: async () => ({ ok: true, status: 200 }),
      },
    );
    assert.equal(secretsRead, 1);
    assert.equal(leaseCalls, 0);
    assert.equal(result.status, 'ingress_misconfigured');
    assert.equal(result.delivered, false);
  });

  it('passes AbortSignal.timeout(15000) to fetch', async () => {
    let seenSignal = false;
    const result = await submitCommandPacket(
      { request: {}, packetId: 'pkt-timeout-signal', packetText: PACKET_TEXT },
      {
        authorize: authorizeOk,
        getIngressSecrets: () => ({ url: SECRET_URL, token: SECRET_TOKEN }),
        leasePacket: async () => ({ ok: true, status: 'leased', leaseToken: 'tok-s', attemptNo: 1 }),
        markDispatchStarted: async () => ({ ok: true, status: 'ok' }),
        finalizeDelivery: async () => ({ ok: true, status: 'ok' }),
        fetch: async (_url, init) => {
          seenSignal = Boolean(init && init.signal);
          return { ok: true, status: 202 };
        },
      },
    );
    assert.equal(seenSignal, true);
    assert.equal(result.delivered, true);
    assert.equal(result.status, 'submitted');
  });

  it('T12D wrong-token finalize is local lease_lost and does not mark delivered', async () => {
    const result = await submitCommandPacket(
      { request: {}, packetId: 'pkt-wrong-token', packetText: PACKET_TEXT },
      {
        authorize: authorizeOk,
        getIngressSecrets: () => ({ url: SECRET_URL, token: SECRET_TOKEN }),
        leasePacket: async () => ({ ok: true, status: 'leased', leaseToken: 'tok-a', attemptNo: 1 }),
        markDispatchStarted: async () => ({ ok: true, status: 'ok' }),
        finalizeDelivery: async () => ({ ok: false, status: 'lease_lost' }),
        fetch: async () => ({ ok: true, status: 200 }),
      },
    );
    assert.equal(result.status, 'lease_lost');
    assert.equal(result.delivered, false);
  });

  it('post-dispatch in_flight observer does not outbound', async () => {
    let fetchCalls = 0;
    const result = await submitCommandPacket(
      { request: {}, packetId: 'pkt-inflight', packetText: PACKET_TEXT },
      {
        authorize: authorizeOk,
        getIngressSecrets: () => ({ url: SECRET_URL, token: SECRET_TOKEN }),
        leasePacket: async () => ({ ok: false, status: 'in_flight', duplicate: true }),
        fetch: async () => {
          fetchCalls += 1;
          return { ok: true, status: 200 };
        },
      },
    );
    assert.equal(result.status, 'in_flight');
    assert.equal(result.delivered, false);
    assert.equal(fetchCalls, 0);
  });
});

describe('postIngressEnvelope timeout mapping', () => {
  it('maps AbortError from fetch to timeout', async () => {
    const failed = await postIngressEnvelope({
      envelope: { event_type: 'command.packet.submitted' },
      url: SECRET_URL,
      token: SECRET_TOKEN,
      fetchImpl: async () => {
        const error = new Error('aborted');
        error.name = 'AbortError';
        throw error;
      },
    });
    assert.equal(failed.status, 'timeout');
    assert.equal(failed.dispatchOutcome, 'timeout');
    assert.equal(failed.delivered, false);
  });
});

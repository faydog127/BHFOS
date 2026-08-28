/**
 * NOS-N8N-ASSURANCE-PHASE-A-01 / NOS-N8N-EDGE-INGRESS-SPIKE-01
 * Source-only deterministic tests. No migration apply, deploy, webhook, AI, or network call.
 * Run: node --test tests/unit/network-os-assurance-ingress.test.mjs
 */
import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it } from 'node:test';
import {
  createAssuranceIngressHandler,
  DEFAULT_BODY_LIMIT_BYTES,
} from '../../supabase/functions/network-os-assurance-ingress/handler.mjs';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '../..');
const SECRET = 'phase-a-public-fixture-secret';
const TARGET = Object.freeze({
  repositoryId: 1117631079,
  repositoryFullName: 'faydog127/BHFOS',
  installationId: 12345678,
  allowedActions: new Set(['opened', 'reopened', 'synchronize', 'ready_for_review']),
});

function fixture(overrides = {}) {
  return {
    action: 'synchronize',
    installation: { id: TARGET.installationId },
    repository: {
      id: TARGET.repositoryId,
      full_name: TARGET.repositoryFullName,
      owner: { login: 'must-not-forward' },
    },
    pull_request: {
      number: 152,
      draft: true,
      title: 'must-not-forward',
      head: { sha: 'd5d61dc93e86fdc1f7498b55cd2ad7428be2f76a' },
      base: { ref: 'network-os/foundation' },
      body: 'must-not-forward',
    },
    sender: { login: 'must-not-forward' },
    unexpected: 'must-not-forward',
    ...overrides,
  };
}

async function signatureFor(raw, secret = SECRET) {
  const key = await webcrypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const digest = new Uint8Array(
    await webcrypto.subtle.sign('HMAC', key, new TextEncoder().encode(raw)),
  );
  return `sha256=${[...digest].map((byte) => byte.toString(16).padStart(2, '0')).join('')}`;
}

async function requestFor({
  payload = fixture(),
  raw = JSON.stringify(payload),
  deliveryId = 'phase-a-valid-001',
  eventName = 'pull_request',
  signature,
  contentType = 'application/json',
  method = 'POST',
} = {}) {
  const headers = { 'content-type': contentType };
  if (eventName !== null) headers['x-github-event'] = eventName;
  if (deliveryId !== null) headers['x-github-delivery'] = deliveryId;
  if (signature !== null) {
    headers['x-hub-signature-256'] = signature === undefined
      ? await signatureFor(raw)
      : signature;
  }
  return new Request('https://edge.example.invalid/network-os-assurance-ingress', {
    method,
    headers,
    body: method === 'POST' ? raw : undefined,
  });
}

function atomicMemoryClaim() {
  const deliveries = new Set();
  return async (envelope) => {
    if (deliveries.has(envelope.delivery_id)) return 'duplicate';
    deliveries.add(envelope.delivery_id);
    return 'claimed';
  };
}

function harness(overrides = {}) {
  const forwarded = [];
  const marked = [];
  const logs = [];
  const handle = createAssuranceIngressHandler({
    configurationReady: true,
    webhookSecret: SECRET,
    target: TARGET,
    cryptoImpl: webcrypto,
    now: () => new Date('2026-08-28T17:00:00.000Z'),
    claimDelivery: atomicMemoryClaim(),
    forwardEnvelope: async (envelope) => {
      forwarded.push(envelope);
      return { ok: true };
    },
    markDelivery: async (deliveryId, state) => {
      marked.push({ deliveryId, state });
      return true;
    },
    log: (event) => logs.push(event),
    ...overrides,
  });
  return { handle, forwarded, marked, logs };
}

async function jsonOf(response) {
  return JSON.parse(await response.text());
}

describe('Network OS assurance edge ingress', () => {
  it('fails closed while preview-test configuration is absent', async () => {
    let claims = 0;
    const { handle } = harness({
      configurationReady: false,
      claimDelivery: async () => {
        claims += 1;
        return 'claimed';
      },
    });
    const response = await handle(await requestFor());
    assert.equal(response.status, 503);
    assert.equal((await jsonOf(response)).code, 'INGRESS_NOT_CONFIGURED');
    assert.equal(claims, 0);
  });

  it('verifies exact bytes, claims once, and forwards only the normalized envelope', async () => {
    const { handle, forwarded, marked } = harness();
    const response = await handle(await requestFor());
    assert.equal(response.status, 202);
    assert.deepEqual(await jsonOf(response), {
      ok: true,
      code: 'ACCEPTED',
      delivery_id: 'phase-a-valid-001',
    });
    assert.equal(forwarded.length, 1);
    assert.deepEqual(forwarded[0], {
      schema_version: '1.0',
      delivery_id: 'phase-a-valid-001',
      event_name: 'pull_request',
      action: 'synchronize',
      received_at: '2026-08-28T17:00:00.000Z',
      repository: { id: 1117631079, full_name: 'faydog127/BHFOS' },
      installation_id: 12345678,
      pull_request: {
        number: 152,
        head_sha: 'd5d61dc93e86fdc1f7498b55cd2ad7428be2f76a',
        base_ref: 'network-os/foundation',
        draft: true,
      },
    });
    assert.doesNotMatch(JSON.stringify(forwarded[0]), /must-not-forward/);
    assert.deepEqual(marked, [{ deliveryId: 'phase-a-valid-001', state: 'forwarded' }]);
  });

  it('produces one forward for 25 concurrent identical deliveries', async () => {
    const { handle, forwarded } = harness();
    const responses = await Promise.all(
      Array.from({ length: 25 }, () => requestFor().then((request) => handle(request))),
    );
    assert.equal(responses.filter((response) => response.status === 202).length, 1);
    assert.equal(responses.filter((response) => response.status === 200).length, 24);
    assert.equal(forwarded.length, 1);
  });

  it('rejects missing, malformed, and incorrect signatures before claiming', async () => {
    let claims = 0;
    const { handle } = harness({
      claimDelivery: async () => {
        claims += 1;
        return 'claimed';
      },
    });
    const missing = await handle(await requestFor({ signature: null }));
    const malformed = await handle(await requestFor({ signature: 'sha256=nope' }));
    const incorrect = await handle(await requestFor({ signature: `sha256=${'0'.repeat(64)}` }));
    assert.equal(missing.status, 401);
    assert.equal(malformed.status, 401);
    assert.equal(incorrect.status, 403);
    assert.equal(claims, 0);
  });

  it('ignores irrelevant events and actions without claiming', async () => {
    let claims = 0;
    const { handle } = harness({
      claimDelivery: async () => {
        claims += 1;
        return 'claimed';
      },
    });
    const irrelevant = await handle(await requestFor({ eventName: 'issues' }));
    const actionPayload = fixture({ action: 'closed' });
    const unexpectedAction = await handle(await requestFor({ payload: actionPayload, raw: JSON.stringify(actionPayload) }));
    assert.equal(irrelevant.status, 204);
    assert.equal(unexpectedAction.status, 204);
    assert.equal(claims, 0);
  });

  it('rejects repository, installation, and pull-request mismatches', async () => {
    const { handle, forwarded } = harness();
    const wrongRepository = fixture({ repository: { id: 7, full_name: TARGET.repositoryFullName } });
    const wrongInstallation = fixture({ installation: { id: 7 } });
    const malformedHead = fixture({
      pull_request: {
        ...fixture().pull_request,
        head: { sha: 'not-a-sha' },
      },
    });
    for (const [index, payload] of [wrongRepository, wrongInstallation, malformedHead].entries()) {
      const response = await handle(await requestFor({ payload, raw: JSON.stringify(payload), deliveryId: `target-case-${index}` }));
      assert.equal(response.status, 403);
    }
    assert.equal(forwarded.length, 0);
  });

  it('rejects invalid delivery headers, JSON, content type, and oversized bodies', async () => {
    const { handle } = harness();
    const noDelivery = await handle(await requestFor({ deliveryId: null }));
    const invalidJsonRaw = '{invalid';
    const invalidJson = await handle(await requestFor({ raw: invalidJsonRaw }));
    const wrongType = await handle(await requestFor({ contentType: 'text/plain' }));
    const oversizedRaw = JSON.stringify({ value: 'x'.repeat(DEFAULT_BODY_LIMIT_BYTES + 1) });
    const oversized = await handle(await requestFor({ raw: oversizedRaw }));
    assert.equal(noDelivery.status, 400);
    assert.equal(invalidJson.status, 400);
    assert.equal(wrongType.status, 415);
    assert.equal(oversized.status, 413);
  });

  it('returns 503 without forwarding when the delivery claim is unavailable', async () => {
    const { handle, forwarded } = harness({ claimDelivery: async () => 'error' });
    const response = await handle(await requestFor());
    assert.equal(response.status, 503);
    assert.equal((await jsonOf(response)).code, 'DELIVERY_CLAIM_UNAVAILABLE');
    assert.equal(forwarded.length, 0);
  });

  it('retains the claim and marks forward failure without retrying', async () => {
    const marked = [];
    const { handle } = harness({
      forwardEnvelope: async () => ({ ok: false }),
      markDelivery: async (deliveryId, state) => {
        marked.push({ deliveryId, state });
        return true;
      },
    });
    const response = await handle(await requestFor());
    assert.equal(response.status, 502);
    assert.equal((await jsonOf(response)).code, 'N8N_FORWARD_FAILED');
    assert.deepEqual(marked, [{ deliveryId: 'phase-a-valid-001', state: 'forward_failed' }]);
  });

  it('logs only bounded status, code, and validated delivery ID', async () => {
    const { handle, logs } = harness();
    await handle(await requestFor());
    const serialized = JSON.stringify(logs);
    assert.doesNotMatch(serialized, /phase-a-public-fixture-secret|must-not-forward|d5d61dc/);
    assert.match(serialized, /ACCEPTED/);
    assert.match(serialized, /phase-a-valid-001/);
  });

  it('defines a database-enforced primary-key claim and source-only rollback', () => {
    const handler = fs.readFileSync(
      path.join(root, 'supabase/functions/network-os-assurance-ingress/handler.mjs'),
      'utf8',
    );
    const migration = fs.readFileSync(
      path.join(root, 'supabase/migrations/20260828170000_network_os_assurance_delivery_claims.sql'),
      'utf8',
    );
    const rollback = fs.readFileSync(
      path.join(root, 'supabase/rollbacks/20260828170000_network_os_assurance_delivery_claims.sql'),
      'utf8',
    );
    assert.match(migration, /delivery_id text PRIMARY KEY/);
    assert.match(handler, /cryptoImpl\.subtle\.verify/);
    assert.match(migration, /ON CONFLICT \(delivery_id\) DO NOTHING/);
    assert.match(migration, /GET DIAGNOSTICS inserted_rows = ROW_COUNT/);
    assert.match(migration, /SECURITY DEFINER/);
    assert.match(migration, /SET search_path = public, pg_temp/);
    assert.match(migration, /REVOKE ALL ON TABLE[\s\S]*FROM anon/);
    assert.match(migration, /REVOKE ALL ON TABLE[\s\S]*FROM authenticated/);
    assert.match(migration, /GRANT EXECUTE ON FUNCTION[\s\S]*TO service_role/);
    assert.doesNotMatch(migration, /GRANT (SELECT|INSERT|UPDATE|DELETE)[\s\S]*TO (anon|authenticated)/);
    assert.match(rollback, /DROP FUNCTION IF EXISTS public\.network_os_claim_assurance_delivery/);
    assert.match(rollback, /DROP TABLE IF EXISTS public\.network_os_assurance_delivery_claims/);
  });
});

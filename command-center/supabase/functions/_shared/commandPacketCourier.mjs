/**
 * Restricted Command Center → n8n ingress courier.
 *
 * Server-side only. Do not import this module from `src/` or any Vite client graph.
 * Unpublished n8n destination identity is documented outside this runtime module.
 *
 * Secrets (names only): N8N_COMMAND_INGRESS_URL, N8N_COMMAND_INGRESS_TOKEN.
 * Secrets are loaded before lease. Token is sent only as header X-BHFOS-Ingress-Token.
 */

export const ATOMIC_CLAIM_REQUIRED = 'ATOMIC_CLAIM_REQUIRED';
export const ATOMIC_CLAIM_INTERFACE_MISMATCH = 'ATOMIC_CLAIM_INTERFACE_MISMATCH';
export const EVENT_TYPE = 'command.packet.submitted';
export const SOURCE = 'bhfos-command-center';
export const INGRESS_TOKEN_HEADER = 'X-BHFOS-Ingress-Token';
export const PACKET_ID_PATTERN = /^[A-Za-z0-9._:-]{1,128}$/;
export const PACKET_DIGEST_PATTERN = /^[0-9a-f]{64}$/;
export const COMMAND_PACKET_CLAIM_FUNCTION = 'network_os_claim_command_packet';
export const COMMAND_PACKET_LEASE_FUNCTION = 'network_os_lease_command_packet';
export const COMMAND_PACKET_DISPATCH_STARTED_FUNCTION = 'network_os_mark_command_packet_dispatch_started';
export const COMMAND_PACKET_FINALIZE_FUNCTION = 'network_os_finalize_command_packet_delivery';
export const COMMAND_PACKET_LEASE_OWNER = 'command-packet-courier';
export const HTTP_DISPATCH_TIMEOUT_MS = 15000;
export const DB_FINALIZATION_MARGIN_MS = 2000;
export const RUNTIME_MARGIN_MS = 3000;
export const LEASE_TTL_SECONDS = 20;
export const POST_DISPATCH_FINALIZE_WINDOW_SECONDS = 20;
export const HTTP_DISPATCH_TIMEOUT = HTTP_DISPATCH_TIMEOUT_MS / 1000;
export const DB_FINALIZATION_MARGIN = DB_FINALIZATION_MARGIN_MS / 1000;
export const RUNTIME_MARGIN = RUNTIME_MARGIN_MS / 1000;
export const LEASE_TTL = LEASE_TTL_SECONDS;
export const POST_DISPATCH_FINALIZE_WINDOW = POST_DISPATCH_FINALIZE_WINDOW_SECONDS;

export const PERMITTED_REPOSITORY_CONTEXT = Object.freeze({
  owner: 'faydog127',
  name: 'BHFOS',
  full_name: 'faydog127/BHFOS',
});

export const COMMAND_CENTER_ADMIN_ROLES = Object.freeze(['admin', 'super_admin', 'owner']);

const SENSITIVE_KEY_RE =
  /^(authorization|ingress_token|ingress_url|webhook_url|packet_text|n8n_command_ingress_url|n8n_command_ingress_token|x-bhfos-ingress-token)$/i;

/**
 * Investigation snapshot for this source HEAD.
 * Domain-specific money/MIL/ops tables are not an approved packet-delivery claim.
 * Review Board claim/lease design is out of scope and unimplemented.
 */
export const PR154_PINNED_CLAIM_INTERFACE = Object.freeze({
  pr: 154,
  sha: '0ec7867f03ca412a83b764b98a18fc695ad57986',
  rpc: 'public.network_os_claim_assurance_delivery',
  arguments: Object.freeze([
    'p_delivery_id text',
    'p_event_name text',
    'p_repository_id bigint',
    'p_installation_id bigint',
    'p_pr_number bigint',
    'p_head_sha text',
  ]),
  hardConstraints: Object.freeze([
    "event_name = 'pull_request'",
    'repository_id > 0',
    'installation_id > 0',
    'pr_number > 0',
    "head_sha ~ '^[0-9a-f]{40}$'",
  ]),
  purpose: 'Isolated delivery claims for preview/test GitHub assurance ingress.',
});

export const ATOMIC_CLAIM_INVESTIGATION = Object.freeze({
  found: false,
  status: ATOMIC_CLAIM_INTERFACE_MISMATCH,
  searched: Object.freeze([
    'PR 154 exact SHA 0ec7867f03ca412a83b764b98a18fc695ad57986 network_os_claim_assurance_delivery',
    'CREATE TABLE / RPC matching idempotency_keys (ARCHITECTURE.md mentions it; no migration or caller exists)',
    'generic claimOnce / tryClaim / acquire_claim / outbox_claim helpers under command-center/',
    'event_jobs / messages (ops visibility queues: optional idempotency_key, no unique constraint, no claim RPC)',
    'stripe_webhook_events + record_stripe_webhook_payment (Stripe event_id only)',
    'quotes.idempotency_key, invoice_execution_mutations, public_payment_attempts, transactions',
    'mil_upload_grants completed_at claim (MIL finalize only)',
    'Fast Lane / transactional outbox helper (no Fast Lane or outbox implementation on this HEAD)',
    'N8N_COMMAND_INGRESS_* / command.packet / delivery_id courier tables or RPCs',
  ]),
  rejected: Object.freeze([
    {
      candidate: 'PR 154 public.network_os_claim_assurance_delivery @ 0ec7867',
      reason:
        'GitHub assurance pull_request claim, not a packet_id reserve. Requires event_name=pull_request, installation_id, pr_number, and a 40-char head SHA. Consuming it for command.packet.submitted would fabricate PR fields.',
    },
    {
      candidate: 'public.idempotency_keys',
      reason: 'Named in ARCHITECTURE.md only. No CREATE TABLE, no callers.',
    },
    {
      candidate: 'public.event_jobs',
      reason: 'Ops UI queue. No unique packet_id, no atomic claim function.',
    },
    {
      candidate: 'stripe / quote / invoice / payment idempotency',
      reason: 'Domain-specific money-path keys. Not approved for n8n command packets.',
    },
    {
      candidate: 'mil_upload_grants FOR UPDATE claim',
      reason: 'Upload-grant completion only. Reusing it would invent a new store use.',
    },
    {
      candidate: 'Review Board request/run claim-lease (DEC-V2-014 / REQ-V2-001)',
      reason: 'Design only; implementation unauthorized. This packet forbids touching Review Board.',
    },
    {
      candidate: 'process-local Map / in-memory set',
      reason: 'Explicitly disallowed as a production claim substitute.',
    },
  ]),
});

export function inspectApprovedAtomicClaimInterface() {
  return {
    found: ATOMIC_CLAIM_INVESTIGATION.found,
    status: ATOMIC_CLAIM_INVESTIGATION.status,
    searched: [...ATOMIC_CLAIM_INVESTIGATION.searched],
    rejected: ATOMIC_CLAIM_INVESTIGATION.rejected.map((row) => ({ ...row })),
  };
}

export function validateCommandPacketInput({ packetId, packetText }) {
  const id = String(packetId || '').trim();
  if (!PACKET_ID_PATTERN.test(id)) {
    return { ok: false, reason: 'invalid_packet_id' };
  }
  if (typeof packetText !== 'string' || !packetText.trim()) {
    return { ok: false, reason: 'invalid_packet_text' };
  }
  return { ok: true, packetId: id, packetText };
}

function bytesToHex(bytes) {
  let hex = '';
  for (const byte of bytes) {
    hex += byte.toString(16).padStart(2, '0');
  }
  return hex;
}

/**
 * Server-side SHA-256 of packet identity. packet_text is hashed in memory only
 * and is not returned, logged, or persisted.
 */
export async function digestCommandPacketEnvelope(envelope) {
  const packetId = envelope && envelope.delivery_id != null ? String(envelope.delivery_id) : '';
  const eventType = envelope && envelope.event_type != null ? String(envelope.event_type) : '';
  const source = envelope && envelope.source != null ? String(envelope.source) : '';
  const packetText =
    envelope && envelope.payload && typeof envelope.payload.packet_text === 'string'
      ? envelope.payload.packet_text
      : '';
  const canonical = `${packetId}\n${eventType}\n${source}\n${packetText}`;
  const digestBuffer = await globalThis.crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(canonical),
  );
  return bytesToHex(new Uint8Array(digestBuffer));
}

/**
 * Courier-side adapter. `invokeClaim` is injected by the server identity.
 * This module does not open a database client.
 */
export function createCommandPacketClaimAdapter(invokeClaim) {
  return async function claimPacket(packetId, details = {}) {
    if (typeof invokeClaim !== 'function') {
      return { ok: false, status: 'claim_failed', duplicate: false };
    }

    const p_packet_id = details.packetId || packetId;
    const p_packet_digest = details.packetDigest;
    const p_event_type = details.eventType || EVENT_TYPE;
    const p_source = details.source || SOURCE;

    if (!PACKET_ID_PATTERN.test(String(p_packet_id || '')) || !PACKET_DIGEST_PATTERN.test(String(p_packet_digest || ''))) {
      return { ok: false, status: 'claim_failed', duplicate: false };
    }

    let outcome;
    try {
      outcome = await invokeClaim({
        p_packet_id,
        p_packet_digest,
        p_event_type,
        p_source,
      });
    } catch {
      return { ok: false, status: 'claim_failed', duplicate: false };
    }

    if (outcome === 'claimed') {
      return { ok: true, status: 'claimed', duplicate: false };
    }
    if (outcome === 'duplicate') {
      return { ok: false, status: 'duplicate', duplicate: true };
    }
    if (outcome === 'conflict') {
      return { ok: false, status: 'conflict', duplicate: false, conflict: true };
    }
    return { ok: false, status: 'claim_failed', duplicate: false };
  };
}

function firstRow(result) {
  if (Array.isArray(result)) return result[0] || null;
  return result && typeof result === 'object' ? result : null;
}

function outcomeOf(result) {
  if (typeof result === 'string') return result;
  const row = firstRow(result);
  if (row && typeof row.outcome === 'string') return row.outcome;
  return null;
}

export function createCommandPacketLeaseAdapter(invokeLease) {
  return async function leasePacket(packetId, details = {}) {
    if (typeof invokeLease !== 'function') {
      return { ok: false, status: 'lease_failed', duplicate: false };
    }

    const p_packet_id = details.packetId || packetId;
    const p_packet_digest = details.packetDigest;
    const p_event_type = details.eventType || EVENT_TYPE;
    const p_source = details.source || SOURCE;

    if (!PACKET_ID_PATTERN.test(String(p_packet_id || '')) || !PACKET_DIGEST_PATTERN.test(String(p_packet_digest || ''))) {
      return { ok: false, status: 'lease_failed', duplicate: false };
    }

    let result;
    try {
      result = await invokeLease({
        p_packet_id,
        p_packet_digest,
        p_event_type,
        p_source,
        p_lease_owner: COMMAND_PACKET_LEASE_OWNER,
        p_lease_ttl: `${LEASE_TTL_SECONDS} seconds`,
      });
    } catch {
      return { ok: false, status: 'lease_failed', duplicate: false };
    }

    const row = firstRow(result) || (typeof result === 'string' ? { outcome: result } : null);
    const outcome = row && row.outcome;
    if (outcome === 'leased') {
      return {
        ok: true,
        status: 'leased',
        duplicate: false,
        leaseToken: row.lease_token || row.leaseToken || details.leaseToken || null,
        attemptNo: row.attempt_no != null ? row.attempt_no : row.attemptNo,
        deliveryState: row.delivery_state || row.deliveryState || 'leased',
      };
    }
    if (outcome === 'in_flight') {
      return { ok: false, status: 'in_flight', duplicate: true };
    }
    if (outcome === 'conflict') {
      return { ok: false, status: 'conflict', duplicate: false, conflict: true };
    }
    if (outcome === 'delivered') {
      return { ok: false, status: 'delivered', duplicate: true, alreadyDelivered: true };
    }
    if (outcome === 'reconciliation_required') {
      return { ok: false, status: 'reconciliation_required', duplicate: false };
    }
    return { ok: false, status: 'lease_failed', duplicate: false };
  };
}

export function createCommandPacketDispatchStartedAdapter(invokeMark) {
  return async function markDispatchStarted({ packetId, leaseToken }) {
    if (typeof invokeMark !== 'function') {
      return { ok: false, status: 'lease_lost' };
    }
    let result;
    try {
      result = await invokeMark({
        p_packet_id: packetId,
        p_lease_token: leaseToken,
      });
    } catch {
      return { ok: false, status: 'lease_lost' };
    }
    const outcome = outcomeOf(result);
    if (outcome === 'ok') return { ok: true, status: 'ok' };
    if (outcome === 'lease_lost') return { ok: false, status: 'lease_lost' };
    return { ok: false, status: 'lease_lost' };
  };
}

export function createCommandPacketFinalizeAdapter(invokeFinalize) {
  return async function finalizeDelivery({ packetId, leaseToken, deliveryState, dispatchOutcome }) {
    if (typeof invokeFinalize !== 'function') {
      return { ok: false, status: 'finalize_failed' };
    }
    let result;
    try {
      result = await invokeFinalize({
        p_packet_id: packetId,
        p_lease_token: leaseToken,
        p_delivery_state: deliveryState,
        p_dispatch_outcome: dispatchOutcome,
      });
    } catch {
      return { ok: false, status: 'finalize_failed' };
    }
    const outcome = outcomeOf(result);
    if (outcome === 'ok') return { ok: true, status: 'ok' };
    if (outcome === 'lease_lost') return { ok: false, status: 'lease_lost' };
    return { ok: false, status: 'finalize_failed' };
  };
}

export function mapHttpDispatchOutcome(response, error) {
  if (error) {
    const name = error && error.name ? String(error.name) : '';
    if (name === 'TimeoutError' || name === 'AbortError') {
      return { ok: false, status: 'timeout', dispatchOutcome: 'timeout', delivered: false };
    }
    return { ok: false, status: 'transport', dispatchOutcome: 'transport', delivered: false };
  }
  const httpStatus = response && typeof response.status === 'number' ? response.status : null;
  if (httpStatus != null && httpStatus >= 200 && httpStatus <= 299) {
    return { ok: true, status: 'http_2xx', dispatchOutcome: 'http_2xx', delivered: false, httpStatus };
  }
  if (httpStatus != null && httpStatus >= 400 && httpStatus <= 499) {
    return { ok: false, status: 'http_4xx', dispatchOutcome: 'http_4xx', delivered: false, httpStatus };
  }
  if (httpStatus != null && httpStatus >= 500 && httpStatus <= 599) {
    return { ok: false, status: 'http_5xx', dispatchOutcome: 'http_5xx', delivered: false, httpStatus };
  }
  return { ok: false, status: 'transport', dispatchOutcome: 'transport', delivered: false, httpStatus };
}

export function finalizePairForDispatchOutcome(dispatchOutcome) {
  if (dispatchOutcome === 'http_2xx') {
    return { deliveryState: 'delivered', dispatchOutcome: 'http_2xx' };
  }
  if (
    dispatchOutcome === 'http_4xx'
    || dispatchOutcome === 'http_5xx'
    || dispatchOutcome === 'timeout'
    || dispatchOutcome === 'transport'
  ) {
    return { deliveryState: 'reconciliation_required', dispatchOutcome };
  }
  return null;
}

export function isAuthorizedFromClaims(claims) {
  if (!claims || typeof claims !== 'object') return false;
  const role = String(claims.role || '').trim().toLowerCase();
  if (role === 'service_role') return true;
  if (COMMAND_CENTER_ADMIN_ROLES.includes(role)) return true;

  const app = claims.app_metadata && typeof claims.app_metadata === 'object' ? claims.app_metadata : {};
  if (app.is_superuser === true || app.superuser === true) return true;

  const appRole = String(app.role || '').trim().toLowerCase();
  if (COMMAND_CENTER_ADMIN_ROLES.includes(appRole)) return true;
  return false;
}

export function isAuthorizedFromRoles(roles) {
  if (!Array.isArray(roles)) return false;
  return roles.some((role) => COMMAND_CENTER_ADMIN_ROLES.includes(String(role || '').trim().toLowerCase()));
}

export function constructCommandPacketEnvelope({
  packetId,
  packetText,
  occurredAt,
  repositoryContext = PERMITTED_REPOSITORY_CONTEXT,
}) {
  const deliveryId = String(packetId || '').trim();
  if (!deliveryId) {
    throw new Error('packet_id is required');
  }
  if (typeof packetText !== 'string' || !packetText.trim()) {
    throw new Error('packet_text is required');
  }
  const occurred = occurredAt || new Date().toISOString();
  if (Number.isNaN(Date.parse(occurred))) {
    throw new Error('occurred_at must be ISO-8601');
  }

  return {
    event_type: EVENT_TYPE,
    delivery_id: deliveryId,
    occurred_at: occurred,
    source: SOURCE,
    payload: {
      packet_text: packetText,
      repository: {
        owner: repositoryContext.owner,
        name: repositoryContext.name,
        full_name: repositoryContext.full_name,
      },
    },
  };
}

export function envelopePublicPreview(envelope) {
  if (!envelope || typeof envelope !== 'object') return null;
  return {
    event_type: envelope.event_type,
    delivery_id: envelope.delivery_id,
    occurred_at: envelope.occurred_at,
    source: envelope.source,
    payload: {
      packet_text_present: Boolean(envelope.payload && envelope.payload.packet_text),
      repository: envelope.payload ? envelope.payload.repository : null,
    },
  };
}

function replaceSecretSubstrings(text, secretValues) {
  let out = text;
  for (const secret of secretValues) {
    if (!secret) continue;
    out = out.split(secret).join('[REDACTED]');
  }
  return out;
}

export function collectSecretValues(secrets = {}) {
  return [secrets.token, secrets.url, secrets.packetText, secrets.authorization]
    .filter((value) => typeof value === 'string' && value.length > 0);
}

export function redactSensitive(value, secrets = {}) {
  const secretValues = collectSecretValues(secrets);

  const walk = (node, keyName) => {
    if (typeof node === 'string') {
      if (keyName && SENSITIVE_KEY_RE.test(keyName)) return '[REDACTED]';
      return replaceSecretSubstrings(node, secretValues);
    }
    if (Array.isArray(node)) return node.map((item) => walk(item, keyName));
    if (node && typeof node === 'object') {
      const out = {};
      for (const [key, child] of Object.entries(node)) {
        out[key] = walk(child, key);
      }
      return out;
    }
    return node;
  };

  return walk(value, null);
}

export function publicFailureResponse({ status, httpStatus, deliveryId = null, constructed = null }) {
  return {
    ok: false,
    status,
    delivered: false,
    delivery_id: deliveryId,
    constructed,
    httpStatus,
  };
}

export async function resolveCommandCenterAuthorization(requestLike, deps) {
  const authorize = deps.authorize;
  if (typeof authorize !== 'function') {
    return { ok: false, status: 'unauthorized', httpStatus: 401 };
  }
  return authorize(requestLike);
}

export async function claimPacketOrStop(claimInput, deps) {
  if (typeof deps.leasePacket === 'function') {
    if (claimInput && typeof claimInput === 'object') {
      return deps.leasePacket(claimInput.packetId, claimInput);
    }
    return deps.leasePacket(claimInput);
  }
  if (typeof deps.claimPacket === 'function') {
    if (claimInput && typeof claimInput === 'object') {
      return deps.claimPacket(claimInput.packetId, claimInput);
    }
    return deps.claimPacket(claimInput);
  }
  const inspection = inspectApprovedAtomicClaimInterface();
  return {
    ok: false,
    status: inspection.status,
    duplicate: false,
    inspection,
  };
}

export async function postIngressEnvelope({
  envelope,
  url,
  token,
  fetchImpl,
  timeoutMs = HTTP_DISPATCH_TIMEOUT_MS,
}) {
  if (typeof fetchImpl !== 'function') {
    return { ok: false, status: 'transport', dispatchOutcome: 'transport', delivered: false, reason: 'missing_fetch' };
  }
  if (!url || !token) {
    return { ok: false, status: 'ingress_misconfigured', delivered: false };
  }

  let response;
  try {
    response = await fetchImpl(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        [INGRESS_TOKEN_HEADER]: token,
      },
      body: JSON.stringify(envelope),
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (error) {
    return mapHttpDispatchOutcome(null, error);
  }

  return mapHttpDispatchOutcome(response, null);
}

/**
 * Orchestrates auth → envelope → secrets → lease → dispatch → finalize.
 * Secrets are read before lease. Delivered is true only after http_2xx and
 * successful finalize. finalize_failed is local only.
 */
export async function submitCommandPacket(input, deps = {}) {
  const logs = [];
  const outboundCalls = [];
  const secretsForRedaction = {
    token: deps.secrets && deps.secrets.token,
    url: deps.secrets && deps.secrets.url,
    packetText: typeof input.packetText === 'string' ? input.packetText : '',
    authorization: input.authorization || '',
  };

  const log = (entry) => {
    logs.push(redactSensitive(entry, secretsForRedaction));
  };

  const auth = await resolveCommandCenterAuthorization(input.request, deps);
  if (!auth || !auth.ok) {
    log({ event: 'auth_rejected', status: auth && auth.status ? auth.status : 'unauthorized' });
    return {
      ...publicFailureResponse({
        status: auth && auth.status ? auth.status : 'unauthorized',
        httpStatus: auth && auth.httpStatus ? auth.httpStatus : 401,
        deliveryId: input.packetId || null,
      }),
      outboundCalls,
      logs,
    };
  }

  const validated = validateCommandPacketInput({
    packetId: input.packetId,
    packetText: input.packetText,
  });
  if (!validated.ok) {
    log({ event: 'envelope_invalid' });
    return {
      ...publicFailureResponse({
        status: 'invalid_request',
        httpStatus: 400,
        deliveryId: input.packetId || null,
      }),
      outboundCalls,
      logs,
      error: 'invalid_request',
    };
  }

  let envelope;
  try {
    envelope = constructCommandPacketEnvelope({
      packetId: validated.packetId,
      packetText: validated.packetText,
      occurredAt: input.occurredAt || (deps.now ? deps.now() : new Date().toISOString()),
      repositoryContext: input.repositoryContext || PERMITTED_REPOSITORY_CONTEXT,
    });
  } catch (error) {
    log({ event: 'envelope_invalid' });
    return {
      ...publicFailureResponse({
        status: 'invalid_request',
        httpStatus: 400,
        deliveryId: validated.packetId,
      }),
      outboundCalls,
      logs,
      error: 'invalid_request',
    };
  }

  const constructed = envelopePublicPreview(envelope);
  log({ event: 'envelope_constructed', constructed });

  let packetDigest;
  try {
    packetDigest = await digestCommandPacketEnvelope(envelope);
  } catch {
    log({ event: 'claim_stop', status: 'claim_failed' });
    return {
      ...publicFailureResponse({
        status: 'claim_failed',
        httpStatus: 503,
        deliveryId: envelope.delivery_id,
        constructed,
      }),
      outboundCalls,
      logs,
    };
  }

  const secrets =
    typeof deps.getIngressSecrets === 'function'
      ? deps.getIngressSecrets()
      : deps.secrets || {};
  secretsForRedaction.token = secrets.token;
  secretsForRedaction.url = secrets.url;

  if (!secrets.url || !secrets.token) {
    log({ event: 'secrets_missing_before_lease', status: 'ingress_misconfigured' });
    return {
      ...publicFailureResponse({
        status: 'ingress_misconfigured',
        httpStatus: 503,
        deliveryId: envelope.delivery_id,
        constructed,
      }),
      outboundCalls,
      logs,
    };
  }

  const claim = await claimPacketOrStop(
    {
      packetId: envelope.delivery_id,
      packetDigest,
      eventType: envelope.event_type,
      source: envelope.source,
    },
    deps,
  );
  const leased = Boolean(claim && claim.ok && (claim.status === 'leased' || claim.status === 'claimed'));
  if (!leased) {
    const status = claim && claim.status ? claim.status : ATOMIC_CLAIM_INTERFACE_MISMATCH;
    log({ event: 'lease_stop', status });
    const mismatch =
      status === ATOMIC_CLAIM_REQUIRED || status === ATOMIC_CLAIM_INTERFACE_MISMATCH;
    const unavailable = status === 'claim_failed' || status === 'lease_failed';
    const failure = {
      ...publicFailureResponse({
        status,
        httpStatus: mismatch || unavailable ? 503 : 409,
        deliveryId: envelope.delivery_id,
        constructed,
      }),
      outboundCalls,
      logs,
    };
    if (mismatch) {
      failure.inspection = claim && claim.inspection ? claim.inspection : inspectApprovedAtomicClaimInterface();
    }
    return failure;
  }

  if (typeof deps.markDispatchStarted === 'function') {
    let marked;
    try {
      marked = await deps.markDispatchStarted({
        packetId: envelope.delivery_id,
        leaseToken: claim.leaseToken,
      });
    } catch {
      marked = { ok: false, status: 'lease_lost' };
    }
    if (!marked || marked.ok !== true) {
      log({ event: 'lease_lost', status: marked && marked.status ? marked.status : 'lease_lost' });
      return {
        ...publicFailureResponse({
          status: 'lease_lost',
          httpStatus: 409,
          deliveryId: envelope.delivery_id,
          constructed,
        }),
        outboundCalls,
        logs,
      };
    }
  }

  const fetchImpl = deps.fetch;
  const trackedFetch = async (url, init) => {
    outboundCalls.push({
      urlRedacted: Boolean(url),
      method: init && init.method,
      headerNames: init && init.headers ? Object.keys(init.headers) : [],
    });
    return fetchImpl(url, init);
  };

  const delivery = await postIngressEnvelope({
    envelope,
    url: secrets.url,
    token: secrets.token,
    fetchImpl: trackedFetch,
    timeoutMs: HTTP_DISPATCH_TIMEOUT_MS,
  });

  const dispatchOutcome = delivery.dispatchOutcome || delivery.status;
  const pair = finalizePairForDispatchOutcome(dispatchOutcome);

  if (typeof deps.finalizeDelivery === 'function') {
    if (!pair) {
      log({ event: 'finalize_failed', status: 'finalize_failed', delivered: false });
      return {
        ...publicFailureResponse({
          status: 'finalize_failed',
          httpStatus: 502,
          deliveryId: envelope.delivery_id,
          constructed,
        }),
        outboundCalls,
        logs,
      };
    }
    let finalized;
    try {
      finalized = await deps.finalizeDelivery({
        packetId: envelope.delivery_id,
        leaseToken: claim.leaseToken,
        deliveryState: pair.deliveryState,
        dispatchOutcome: pair.dispatchOutcome,
      });
    } catch {
      finalized = { ok: false, status: 'finalize_failed' };
    }
    if (!finalized || finalized.ok !== true) {
      const status = finalized && finalized.status === 'lease_lost' ? 'lease_lost' : 'finalize_failed';
      log({ event: status, delivered: false });
      return {
        ...publicFailureResponse({
          status,
          httpStatus: status === 'lease_lost' ? 409 : 502,
          deliveryId: envelope.delivery_id,
          constructed,
        }),
        outboundCalls,
        logs,
      };
    }
    if (pair.dispatchOutcome !== 'http_2xx') {
      log({ event: 'dispatch_finalized', status: pair.dispatchOutcome, delivered: false });
      return {
        ...publicFailureResponse({
          status: pair.dispatchOutcome,
          httpStatus: 502,
          deliveryId: envelope.delivery_id,
          constructed,
        }),
        outboundCalls,
        logs,
      };
    }
    log({ event: 'submitted', delivery_id: envelope.delivery_id, delivered: true });
    return {
      ok: true,
      status: 'submitted',
      delivered: true,
      delivery_id: envelope.delivery_id,
      constructed,
      httpStatus: 202,
      outboundCalls,
      logs,
    };
  }

  if (!delivery.ok || dispatchOutcome !== 'http_2xx') {
    log({ event: 'ingress_failed', status: dispatchOutcome, delivered: false });
    return {
      ...publicFailureResponse({
        status: dispatchOutcome,
        httpStatus: 502,
        deliveryId: envelope.delivery_id,
        constructed,
      }),
      outboundCalls,
      logs,
    };
  }

  log({ event: 'submitted', delivery_id: envelope.delivery_id, delivered: true });
  return {
    ok: true,
    status: 'submitted',
    delivered: true,
    delivery_id: envelope.delivery_id,
    constructed,
    httpStatus: 202,
    outboundCalls,
    logs,
  };
}

export function defaultProductionClaimAdapter() {
  const inspection = inspectApprovedAtomicClaimInterface();
  return async function claimPacket() {
    return {
      ok: false,
      status: inspection.status,
      duplicate: false,
      inspection,
    };
  };
}

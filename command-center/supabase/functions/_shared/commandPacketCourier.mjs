/**
 * Restricted Command Center → n8n ingress courier.
 *
 * Server-side only. Do not import this module from `src/` or any Vite client graph.
 * Unpublished n8n destination identity is documented outside this runtime module.
 *
 * Secrets (names only): N8N_COMMAND_INGRESS_URL, N8N_COMMAND_INGRESS_TOKEN.
 * Token is sent only as header X-BHFOS-Ingress-Token after an approved atomic claim.
 */

export const ATOMIC_CLAIM_REQUIRED = 'ATOMIC_CLAIM_REQUIRED';
export const EVENT_TYPE = 'command.packet.submitted';
export const SOURCE = 'bhfos-command-center';
export const INGRESS_TOKEN_HEADER = 'X-BHFOS-Ingress-Token';

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
export const ATOMIC_CLAIM_INVESTIGATION = Object.freeze({
  found: false,
  status: ATOMIC_CLAIM_REQUIRED,
  searched: Object.freeze([
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

export function isAuthorizedFromClaims(claims) {
  if (!claims || typeof claims !== 'object') return false;
  const role = String(claims.role || '').trim().toLowerCase();
  if (role === 'service_role') return true;
  if (COMMAND_CENTER_ADMIN_ROLES.includes(role)) return true;

  const app = claims.app_metadata && typeof claims.app_metadata === 'object' ? claims.app_metadata : {};
  const user = claims.user_metadata && typeof claims.user_metadata === 'object' ? claims.user_metadata : {};
  if (app.is_superuser === true || app.superuser === true) return true;
  if (user.is_superuser === true || user.superuser === true) return true;

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

export async function claimPacketOrStop(packetId, deps) {
  if (typeof deps.claimPacket === 'function') {
    return deps.claimPacket(packetId);
  }
  const inspection = inspectApprovedAtomicClaimInterface();
  return {
    ok: false,
    status: inspection.status,
    duplicate: false,
    inspection,
  };
}

export async function postIngressEnvelope({ envelope, url, token, fetchImpl }) {
  if (typeof fetchImpl !== 'function') {
    return { ok: false, status: 'ingress_failed', delivered: false, reason: 'missing_fetch' };
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
    });
  } catch {
    return { ok: false, status: 'ingress_failed', delivered: false, reason: 'network_error' };
  }

  const ok = Boolean(response && response.ok);
  if (!ok) {
    return {
      ok: false,
      status: 'ingress_failed',
      delivered: false,
      reason: 'http_error',
      httpStatus: response && typeof response.status === 'number' ? response.status : null,
    };
  }

  return { ok: true, status: 'submitted', delivered: true };
}

/**
 * Orchestrates auth → envelope → atomic claim → outbound ingress.
 * Never marks delivered unless claim succeeded and ingress returned 2xx.
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

  let envelope;
  try {
    envelope = constructCommandPacketEnvelope({
      packetId: input.packetId,
      packetText: input.packetText,
      occurredAt: input.occurredAt || (deps.now ? deps.now() : new Date().toISOString()),
      repositoryContext: input.repositoryContext || PERMITTED_REPOSITORY_CONTEXT,
    });
  } catch (error) {
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

  const constructed = envelopePublicPreview(envelope);
  log({ event: 'envelope_constructed', constructed });

  const claim = await claimPacketOrStop(envelope.delivery_id, deps);
  if (!claim || claim.status === ATOMIC_CLAIM_REQUIRED || (claim.ok === false && !claim.duplicate)) {
    const status = claim && claim.status ? claim.status : ATOMIC_CLAIM_REQUIRED;
    log({ event: 'claim_stop', status });
    return {
      ...publicFailureResponse({
        status,
        httpStatus: status === ATOMIC_CLAIM_REQUIRED ? 503 : 409,
        deliveryId: envelope.delivery_id,
        constructed,
      }),
      outboundCalls,
      logs,
      inspection: claim && claim.inspection ? claim.inspection : inspectApprovedAtomicClaimInterface(),
    };
  }

  if (claim.duplicate) {
    log({ event: 'claim_duplicate', delivery_id: envelope.delivery_id });
    return {
      ...publicFailureResponse({
        status: 'duplicate',
        httpStatus: 409,
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
  });

  if (!delivery.ok) {
    log({ event: 'ingress_failed', status: delivery.status, delivered: false });
    return {
      ...publicFailureResponse({
        status: delivery.status,
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

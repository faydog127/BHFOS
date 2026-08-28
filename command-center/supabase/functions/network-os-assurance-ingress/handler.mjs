const DEFAULT_BODY_LIMIT_BYTES = 1024 * 1024;
const DEFAULT_FORWARD_TIMEOUT_MS = 4_000;
const DELIVERY_ID_PATTERN = /^[A-Za-z0-9._:-]{1,128}$/;
const SHA256_PATTERN = /^[0-9a-f]{40}$/;
const SIGNATURE_PATTERN = /^sha256=([0-9a-f]{64})$/;
const SUPPORTED_ACTIONS = new Set(['opened', 'reopened', 'synchronize', 'ready_for_review']);

const encoder = new TextEncoder();

function jsonResponse(status, body, extraHeaders = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      ...extraHeaders,
    },
  });
}

function emptyResponse(status) {
  return new Response(null, {
    status,
    headers: { 'cache-control': 'no-store' },
  });
}

function hexToBytes(hex) {
  const bytes = new Uint8Array(hex.length / 2);
  for (let index = 0; index < hex.length; index += 2) {
    bytes[index / 2] = Number.parseInt(hex.slice(index, index + 2), 16);
  }
  return bytes;
}

async function verifySignature({ cryptoImpl, rawBody, secret, signatureHeader }) {
  if (!signatureHeader) return { ok: false, status: 401, code: 'SIGNATURE_MISSING' };
  const match = SIGNATURE_PATTERN.exec(signatureHeader);
  if (!match) return { ok: false, status: 401, code: 'SIGNATURE_MALFORMED' };

  try {
    const key = await cryptoImpl.subtle.importKey(
      'raw',
      encoder.encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify'],
    );
    const valid = await cryptoImpl.subtle.verify(
      'HMAC',
      key,
      hexToBytes(match[1]),
      rawBody,
    );
    return valid
      ? { ok: true }
      : { ok: false, status: 403, code: 'SIGNATURE_INVALID' };
  } catch {
    return { ok: false, status: 403, code: 'SIGNATURE_INVALID' };
  }
}

function validTargetConfig(target) {
  return Boolean(
    target
      && Number.isSafeInteger(target.repositoryId)
      && target.repositoryId > 0
      && typeof target.repositoryFullName === 'string'
      && target.repositoryFullName.length > 0
      && Number.isSafeInteger(target.installationId)
      && target.installationId > 0
      && target.allowedActions instanceof Set
      && target.allowedActions.size > 0,
  );
}

function normalizePullRequest(payload, deliveryId, receivedAt) {
  const repository = payload?.repository;
  const installation = payload?.installation;
  const pullRequest = payload?.pull_request;

  if (
    !Number.isSafeInteger(pullRequest?.number)
    || pullRequest.number < 1
    || typeof pullRequest?.head?.sha !== 'string'
    || !SHA256_PATTERN.test(pullRequest.head.sha)
    || typeof pullRequest?.base?.ref !== 'string'
    || pullRequest.base.ref.length < 1
    || pullRequest.base.ref.length > 255
    || typeof pullRequest?.draft !== 'boolean'
  ) {
    return null;
  }

  return {
    schema_version: '1.0',
    delivery_id: deliveryId,
    event_name: 'pull_request',
    action: payload.action,
    received_at: receivedAt,
    repository: {
      id: repository.id,
      full_name: repository.full_name,
    },
    installation_id: installation.id,
    pull_request: {
      number: pullRequest.number,
      head_sha: pullRequest.head.sha,
      base_ref: pullRequest.base.ref,
      draft: pullRequest.draft,
    },
  };
}

function safeLog(log, event) {
  try {
    log({
      status: event.status,
      code: event.code,
      delivery_id: DELIVERY_ID_PATTERN.test(event.delivery_id || '')
        ? event.delivery_id
        : null,
    });
  } catch {
    // Logging must never change ingress behavior.
  }
}

export function parseAllowedActions(value) {
  return new Set(
    String(value || '')
      .split(',')
      .map((item) => item.trim())
      .filter((item) => SUPPORTED_ACTIONS.has(item)),
  );
}

export function createAssuranceIngressHandler({
  configurationReady,
  webhookSecret,
  target,
  claimDelivery,
  forwardEnvelope,
  markDelivery = async () => true,
  cryptoImpl = globalThis.crypto,
  now = () => new Date(),
  log = () => {},
  bodyLimitBytes = DEFAULT_BODY_LIMIT_BYTES,
  forwardTimeoutMs = DEFAULT_FORWARD_TIMEOUT_MS,
}) {
  return async function handle(request) {
    let deliveryId = '';

    const finish = (status, code, body = { ok: false, code }) => {
      safeLog(log, { status, code, delivery_id: deliveryId });
      return body === null ? emptyResponse(status) : jsonResponse(status, body);
    };

    if (request.method !== 'POST') {
      return jsonResponse(405, { ok: false, code: 'METHOD_NOT_ALLOWED' }, { allow: 'POST' });
    }

    if (
      configurationReady !== true
      || typeof webhookSecret !== 'string'
      || webhookSecret.length < 1
      || !validTargetConfig(target)
      || typeof claimDelivery !== 'function'
      || typeof forwardEnvelope !== 'function'
      || !cryptoImpl?.subtle
    ) {
      return finish(503, 'INGRESS_NOT_CONFIGURED');
    }

    const contentType = request.headers.get('content-type') || '';
    if (!contentType.toLowerCase().startsWith('application/json')) {
      return finish(415, 'CONTENT_TYPE_UNSUPPORTED');
    }

    const declaredLength = Number(request.headers.get('content-length'));
    if (Number.isFinite(declaredLength) && declaredLength > bodyLimitBytes) {
      return finish(413, 'PAYLOAD_TOO_LARGE');
    }

    let rawBody;
    try {
      rawBody = new Uint8Array(await request.arrayBuffer());
    } catch {
      return finish(400, 'BODY_UNREADABLE');
    }
    if (rawBody.byteLength > bodyLimitBytes) {
      return finish(413, 'PAYLOAD_TOO_LARGE');
    }

    const signature = await verifySignature({
      cryptoImpl,
      rawBody,
      secret: webhookSecret,
      signatureHeader: request.headers.get('x-hub-signature-256'),
    });
    if (!signature.ok) return finish(signature.status, signature.code);

    const eventName = request.headers.get('x-github-event') || '';
    deliveryId = request.headers.get('x-github-delivery') || '';
    if (!eventName || !DELIVERY_ID_PATTERN.test(deliveryId)) {
      return finish(400, 'DELIVERY_HEADERS_INVALID');
    }

    let payload;
    try {
      payload = JSON.parse(new TextDecoder().decode(rawBody));
    } catch {
      return finish(400, 'JSON_INVALID');
    }

    if (eventName !== 'pull_request') {
      return finish(204, 'EVENT_IGNORED', null);
    }
    if (!target.allowedActions.has(payload?.action)) {
      return finish(204, 'ACTION_IGNORED', null);
    }

    if (
      payload?.repository?.id !== target.repositoryId
      || payload?.repository?.full_name !== target.repositoryFullName
      || payload?.installation?.id !== target.installationId
    ) {
      return finish(403, 'TARGET_MISMATCH');
    }

    const receivedAt = now().toISOString();
    const envelope = normalizePullRequest(payload, deliveryId, receivedAt);
    if (!envelope) return finish(403, 'PULL_REQUEST_INVALID');

    let claim;
    try {
      claim = await claimDelivery(envelope);
    } catch {
      claim = 'error';
    }
    if (claim === 'duplicate') {
      return finish(200, 'DUPLICATE_DELIVERY', {
        ok: true,
        code: 'DUPLICATE_DELIVERY',
        delivery_id: deliveryId,
      });
    }
    if (claim !== 'claimed') {
      return finish(503, 'DELIVERY_CLAIM_UNAVAILABLE');
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), forwardTimeoutMs);
    let forwarded = false;
    try {
      const result = await forwardEnvelope(envelope, { signal: controller.signal });
      forwarded = result?.ok === true;
    } catch {
      forwarded = false;
    } finally {
      clearTimeout(timeout);
    }

    try {
      const marked = await markDelivery(deliveryId, forwarded ? 'forwarded' : 'forward_failed');
      if (marked !== true) {
        safeLog(log, { status: 500, code: 'STATE_MARK_FAILED', delivery_id: deliveryId });
      }
    } catch {
      safeLog(log, { status: 500, code: 'STATE_MARK_FAILED', delivery_id: deliveryId });
    }

    if (!forwarded) {
      return finish(502, 'N8N_FORWARD_FAILED');
    }

    return finish(202, 'ACCEPTED', {
      ok: true,
      code: 'ACCEPTED',
      delivery_id: deliveryId,
    });
  };
}

export {
  DEFAULT_BODY_LIMIT_BYTES,
  DEFAULT_FORWARD_TIMEOUT_MS,
  DELIVERY_ID_PATTERN,
};

/**
 * Public HTTP owner for HUGE 2026 convention QR provider interest.
 * Server-only. Does not import star-CORS or customer write helpers.
 */

export const PAYLOAD_CEILING_BYTES = 8192;
export const FORM_COOLDOWN_MS = 8000;
export const HOURLY_POST_LIMIT = 10;
export const FORM_KEY = 'convention-join';

export const INTAKE_TABLE = 'network_os_provider_interest_intake';
export const CAMPAIGN_ID = 'HUGE_2026';
export const INTAKE_SOURCE = 'HUGE_2026';
export const INTAKE_CHANNEL = 'convention_qr';
export const INITIAL_STATUS = 'provider_interest_received';

const ALLOWED_FIELDS = Object.freeze([
  'name',
  'company',
  'email',
  'phone',
  'trades',
  'service_area',
  'consent',
  'honeypot',
  'client_request_id',
]);

const FIELD_LIMITS = Object.freeze({
  name: 80,
  company: 120,
  email: 254,
  phone: 32,
  service_area: 80,
  client_request_id: 80,
  tradesMaxItems: 12,
  tradesItemLen: 40,
});

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const SENSITIVE_RE =
  /email|phone|token|jwt|secret|key|password|bearer|service_role|supabase/i;

const ERRORS = Object.freeze({
  VALIDATION: 'CONVENTION_INTAKE_VALIDATION',
  RATE_LIMITED: 'CONVENTION_INTAKE_RATE_LIMITED',
  NETWORK: 'CONVENTION_INTAKE_NETWORK',
  WRITE_BLOCKED: 'CONVENTION_WRITE_PATH_MATERIAL_BLOCKED',
});

export function parseAllowedOrigins(raw) {
  return String(raw || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

export function isExactOriginAllowed(origin, allowlist) {
  if (!origin || origin === 'null') return false;
  return Array.isArray(allowlist) && allowlist.includes(origin);
}

export function stampIsTestData(name, email) {
  const display = String(name || '');
  const normalizedEmail = String(email || '').toLowerCase();
  return normalizedEmail.endsWith('.invalid') || display.toLowerCase().startsWith('synth');
}

export function allowlistIntakeInput(input = {}) {
  const next = {};
  for (const key of ALLOWED_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(input, key)) {
      next[key] = input[key];
    }
  }
  return next;
}

function asText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function clip(value, max) {
  const text = asText(value);
  return text.length <= max ? text : text.slice(0, max);
}

export function validateConventionIntakeBody(input = {}) {
  const body = allowlistIntakeInput(input);
  const name = clip(body.name, FIELD_LIMITS.name);
  const company = clip(body.company, FIELD_LIMITS.company);
  const email = clip(body.email, FIELD_LIMITS.email).toLowerCase();
  const phoneDigits = String(body.phone || '').replace(/\D/g, '').slice(0, 11);
  const phone =
    phoneDigits.length === 11 && phoneDigits.startsWith('1')
      ? phoneDigits.slice(1)
      : phoneDigits.slice(0, 10);
  const serviceArea = clip(body.service_area, FIELD_LIMITS.service_area);
  const trades = (Array.isArray(body.trades) ? body.trades : [])
    .map((item) => clip(item, FIELD_LIMITS.tradesItemLen))
    .filter(Boolean)
    .slice(0, FIELD_LIMITS.tradesMaxItems);
  const consent = body.consent === true;
  const honeypot = asText(body.honeypot);
  const clientRequestId = clip(body.client_request_id, FIELD_LIMITS.client_request_id);

  const errors = [];
  if (!name) errors.push({ field: 'name', message: 'Enter your name.' });
  if (!company) errors.push({ field: 'company', message: 'Enter your company.' });
  if (!email || !EMAIL_RE.test(email)) {
    errors.push({ field: 'email', message: 'Enter a valid email address.' });
  }
  if (phone.length !== 10) {
    errors.push({ field: 'phone', message: 'Enter a 10-digit phone number.' });
  }
  if (!trades.length) {
    errors.push({ field: 'trades', message: 'Select at least one trade or service.' });
  }
  if (!serviceArea) {
    errors.push({ field: 'service_area', message: 'Enter a service area.' });
  }
  if (!consent) {
    errors.push({ field: 'consent', message: 'Consent is required to continue.' });
  }

  return {
    ok: errors.length === 0,
    honeypotTriggered: honeypot.length > 0,
    errors,
    normalized: {
      name,
      company,
      email,
      phone,
      trades,
      service_area: serviceArea,
      consent,
      client_request_id: clientRequestId,
    },
  };
}

export function sanitizePublicError(code, errors) {
  if (code === ERRORS.VALIDATION) {
    return {
      code,
      message: 'Check the highlighted fields and try again.',
      errors: Array.isArray(errors) ? errors : [],
    };
  }
  if (code === ERRORS.RATE_LIMITED) {
    return { code, message: 'Please wait before submitting again.' };
  }
  if (code === ERRORS.NETWORK) {
    return { code, message: 'The request could not be completed. No record was stored.' };
  }
  return {
    code: ERRORS.WRITE_BLOCKED,
    message:
      'Provider interest cannot be stored until an isolated intake object and effective RLS are proven.',
  };
}

export function intakeLogContainsSensitive(text) {
  return SENSITIVE_RE.test(String(text || ''));
}

function jsonResponse(status, body, headers) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...headers,
      'Content-Type': 'application/json',
    },
  });
}

function resultBody({ ok, received, stored, duplicate, error }) {
  const body = { ok, received, stored, duplicate };
  if (error) body.error = error;
  return body;
}

function corsHeaders(origin, allowed) {
  const headers = {
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  };
  if (allowed) headers['Access-Control-Allow-Origin'] = origin;
  return headers;
}

function readRemoteAddress(req) {
  const forwarded = req.headers.get('x-forwarded-for') || '';
  return (
    forwarded.split(',')[0]?.trim() ||
    req.headers.get('x-real-ip') ||
    'unknown'
  );
}

function contentTypeIsJson(req) {
  const value = (req.headers.get('content-type') || '').toLowerCase();
  return value.startsWith('application/json');
}

export function createProviderInterestIntakeHandler(deps = {}) {
  const allowlist = Array.isArray(deps.allowedOrigins) ? deps.allowedOrigins : [];
  const insertRow = deps.insertRow;
  const nowMs = deps.now || (() => Date.now());
  const makeRequestId = deps.requestId || (() => {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
    return `req-${Date.now()}`;
  });
  const log = deps.log || (() => {});
  const lastFormAt = deps.lastFormAt || new Map();
  const hourlyHits = deps.hourlyHits || new Map();

  function emit(requestId, status, reason) {
    log({ request_id: requestId, status, reason });
  }

  function hourlyLimited(remote, now) {
    const windowStart = now - 60 * 60 * 1000;
    const prior = (hourlyHits.get(remote) || []).filter((stamp) => stamp > windowStart);
    if (prior.length >= HOURLY_POST_LIMIT) {
      hourlyHits.set(remote, prior);
      return true;
    }
    prior.push(now);
    hourlyHits.set(remote, prior);
    return false;
  }

  return async function handleProviderInterestIntakeRequest(req) {
    const requestId = makeRequestId();
    const origin = req.headers.get('origin');
    const allowed = isExactOriginAllowed(origin, allowlist);
    const headers = corsHeaders(origin, allowed);

    if (req.method === 'OPTIONS') {
      if (!allowed) {
        emit(requestId, 403, 'ORIGIN_DENIED');
        return jsonResponse(403, resultBody({
          ok: false,
          received: false,
          stored: false,
          duplicate: false,
        }), headers);
      }
      emit(requestId, 204, 'PREFLIGHT');
      return new Response(null, { status: 204, headers });
    }

    if (!allowed) {
      emit(requestId, 403, 'ORIGIN_DENIED');
      return jsonResponse(403, resultBody({
        ok: false,
        received: false,
        stored: false,
        duplicate: false,
      }), headers);
    }

    if (req.method !== 'POST') {
      emit(requestId, 405, 'METHOD_DENIED');
      return jsonResponse(405, resultBody({
        ok: false,
        received: false,
        stored: false,
        duplicate: false,
      }), headers);
    }

    if (!contentTypeIsJson(req)) {
      emit(requestId, 400, 'VALIDATION');
      return jsonResponse(400, resultBody({
        ok: false,
        received: false,
        stored: false,
        duplicate: false,
        error: sanitizePublicError(ERRORS.VALIDATION),
      }), headers);
    }

    const raw = await req.arrayBuffer();
    if (raw.byteLength > PAYLOAD_CEILING_BYTES) {
      emit(requestId, 413, 'OVERSIZE');
      return jsonResponse(413, resultBody({
        ok: false,
        received: false,
        stored: false,
        duplicate: false,
      }), headers);
    }

    const remote = typeof deps.remoteAddress === 'function'
      ? deps.remoteAddress(req)
      : readRemoteAddress(req);
    const now = nowMs();
    const formStampKey = `${FORM_KEY}:${remote}`;
    const last = lastFormAt.get(formStampKey);
    if ((last && now - last < FORM_COOLDOWN_MS) || hourlyLimited(remote, now)) {
      emit(requestId, 429, 'RATE_LIMITED');
      return jsonResponse(429, resultBody({
        ok: false,
        received: false,
        stored: false,
        duplicate: false,
        error: sanitizePublicError(ERRORS.RATE_LIMITED),
      }), headers);
    }
    lastFormAt.set(formStampKey, now);

    let parsed;
    try {
      const text = new TextDecoder().decode(raw);
      parsed = text ? JSON.parse(text) : {};
    } catch {
      emit(requestId, 400, 'VALIDATION');
      return jsonResponse(400, resultBody({
        ok: false,
        received: false,
        stored: false,
        duplicate: false,
        error: sanitizePublicError(ERRORS.VALIDATION),
      }), headers);
    }

    const validation = validateConventionIntakeBody(parsed && typeof parsed === 'object' ? parsed : {});
    if (validation.honeypotTriggered) {
      emit(requestId, 200, 'NONSTORE');
      return jsonResponse(200, resultBody({
        ok: true,
        received: true,
        stored: false,
        duplicate: false,
      }), headers);
    }
    if (!validation.ok) {
      emit(requestId, 400, 'VALIDATION');
      return jsonResponse(400, resultBody({
        ok: false,
        received: false,
        stored: false,
        duplicate: false,
        error: sanitizePublicError(ERRORS.VALIDATION, validation.errors),
      }), headers);
    }

    if (typeof insertRow !== 'function') {
      emit(requestId, 503, 'WRITE_BLOCKED');
      return jsonResponse(503, resultBody({
        ok: false,
        received: true,
        stored: false,
        duplicate: false,
        error: sanitizePublicError(ERRORS.WRITE_BLOCKED),
      }), headers);
    }

    const stampedAt = new Date(now).toISOString();
    const row = {
      campaign_id: CAMPAIGN_ID,
      source: INTAKE_SOURCE,
      intake_channel: INTAKE_CHANNEL,
      onboarding_status: INITIAL_STATUS,
      display_name: validation.normalized.name,
      company_name: validation.normalized.company,
      email: validation.normalized.email,
      phone_digits: validation.normalized.phone,
      trades: validation.normalized.trades,
      service_area: validation.normalized.service_area,
      consent_contact: true,
      consented_at: stampedAt,
      submitted_at: stampedAt,
      client_request_id: validation.normalized.client_request_id || null,
      is_test_data: stampIsTestData(
        validation.normalized.name,
        validation.normalized.email,
      ),
    };

    let outcome;
    try {
      outcome = await insertRow(row);
    } catch {
      emit(requestId, 503, 'NETWORK');
      return jsonResponse(503, resultBody({
        ok: false,
        received: false,
        stored: false,
        duplicate: false,
        error: sanitizePublicError(ERRORS.NETWORK),
      }), headers);
    }

    if (outcome?.duplicate) {
      emit(requestId, 200, 'DUPLICATE');
      return jsonResponse(200, resultBody({
        ok: true,
        received: true,
        stored: false,
        duplicate: true,
      }), headers);
    }
    if (!outcome?.ok) {
      emit(requestId, 503, 'WRITE_BLOCKED');
      return jsonResponse(503, resultBody({
        ok: false,
        received: true,
        stored: false,
        duplicate: false,
        error: sanitizePublicError(ERRORS.WRITE_BLOCKED),
      }), headers);
    }

    emit(requestId, 200, 'STORED');
    return jsonResponse(200, resultBody({
      ok: true,
      received: true,
      stored: true,
      duplicate: false,
    }), headers);
  };
}

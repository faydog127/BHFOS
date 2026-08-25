/**
 * Network OS convention QR → provider-interest intake.
 *
 * Isolated write path: HTTP owner stamps HUGE_2026 / convention_qr and
 * inserts only into public.network_os_provider_interest_intake.
 * Hosted RLS apply remains a later packet.
 */

export const CONVENTION_WRITE_PATH_MATERIAL_BLOCKED =
  'CONVENTION_WRITE_PATH_MATERIAL_BLOCKED';
export const CONVENTION_WRITE_PATH_IMPLEMENTATION_READY_FOR_GUARD =
  'CONVENTION_WRITE_PATH_IMPLEMENTATION_READY_FOR_GUARD';
export const CONVENTION_INTAKE_VALIDATION = 'CONVENTION_INTAKE_VALIDATION';
export const CONVENTION_INTAKE_DUPLICATE = 'CONVENTION_INTAKE_DUPLICATE';
export const CONVENTION_INTAKE_RATE_LIMITED = 'CONVENTION_INTAKE_RATE_LIMITED';
export const CONVENTION_INTAKE_UNAUTHORIZED = 'CONVENTION_INTAKE_UNAUTHORIZED';
export const CONVENTION_INTAKE_ANON_READ_DENIED = 'CONVENTION_INTAKE_ANON_READ_DENIED';

export const CONVENTION_QR_PATH = '/network-os/convention/join';
export const CONVENTION_INTAKE_QUEUE_PATH = '/network-os/convention/intake';
export const CONVENTION_INTAKE_CAMPAIGN_ID = 'HUGE_2026';
export const CONVENTION_INTAKE_SOURCE = 'HUGE_2026';
export const CONVENTION_INTAKE_CHANNEL = 'convention_qr';
export const CONVENTION_INTAKE_STATUS = 'provider_interest_received';
export const CONVENTION_INTAKE_TABLE = 'network_os_provider_interest_intake';
export const CONVENTION_INTAKE_HELPER = 'network_os_actor_has_bhis_convention_intake';
export const CONVENTION_INTAKE_HTTP_FUNCTION = 'network-os-provider-interest-intake';
export const CONVENTION_INTAKE_ROLE = 'bhis_convention_intake';

export const INTAKE_QUEUE_SELECT_COLUMNS = Object.freeze([
  'id',
  'campaign_id',
  'source',
  'intake_channel',
  'onboarding_status',
  'display_name',
  'company_name',
  'email',
  'phone_digits',
  'trades',
  'service_area',
  'consent_contact',
  'consented_at',
  'submitted_at',
  'client_request_id',
  'is_test_data',
  'created_at',
  'updated_at',
].join(','));

export const INTAKE_ALLOWED_STATUSES = Object.freeze([
  'provider_interest_received',
  'reviewed',
  'contacted',
  'declined',
]);

export const INTAKE_QUEUE_STATUSES = Object.freeze([
  'reviewed',
  'contacted',
  'declined',
]);

export const INTAKE_ALLOWED_FIELDS = Object.freeze([
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

export const INTAKE_FIELD_LIMITS = Object.freeze({
  name: 80,
  company: 120,
  email: 254,
  phone: 32,
  service_area: 80,
  client_request_id: 80,
  tradesMaxItems: 12,
  tradesItemLen: 40,
});

export const INTAKE_HOSTED_RESIDUALS = Object.freeze([
  {
    id: 'hosted_rls_public_read_deny',
    need: 'Hosted RLS/grants proving anon and PUBLIC cannot SELECT intake or customer rows.',
  },
  {
    id: 'hosted_rls_public_table_write_deny',
    need: 'Hosted RLS/grants proving anon cannot INSERT/UPDATE/DELETE those tables directly.',
  },
]);

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const SENSITIVE_LOG_RE =
  /email|phone|token|jwt|secret|key|password|bearer|service_role|supabase/i;

function asText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function clip(value, max) {
  const text = asText(value);
  return text.length <= max ? text : text.slice(0, max);
}

export function resolveConventionQrTarget(origin = '') {
  const base = asText(origin).replace(/\/$/, '');
  return `${base}${CONVENTION_QR_PATH}`;
}

export function isSafeConventionIntakeNext(next) {
  const path = asText(next);
  return (
    path === CONVENTION_INTAKE_QUEUE_PATH ||
    path.startsWith(`${CONVENTION_INTAKE_QUEUE_PATH}?`)
  );
}

export function mapConventionIntakeSourceStatus() {
  return {
    campaign_id: CONVENTION_INTAKE_CAMPAIGN_ID,
    source: CONVENTION_INTAKE_SOURCE,
    intake_channel: CONVENTION_INTAKE_CHANNEL,
    status: CONVENTION_INTAKE_STATUS,
  };
}

export function allowlistIntakeInput(input = {}) {
  const next = {};
  for (const key of INTAKE_ALLOWED_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(input, key)) {
      next[key] = input[key];
    }
  }
  return next;
}

export function validateConventionIntake(input = {}) {
  const body = allowlistIntakeInput(input);
  const name = clip(body.name, INTAKE_FIELD_LIMITS.name);
  const company = clip(body.company, INTAKE_FIELD_LIMITS.company);
  const email = clip(body.email, INTAKE_FIELD_LIMITS.email).toLowerCase();
  const phoneDigits = String(body.phone || '').replace(/\D/g, '').slice(0, 11);
  const phone =
    phoneDigits.length === 11 && phoneDigits.startsWith('1')
      ? phoneDigits.slice(1)
      : phoneDigits.slice(0, 10);
  const serviceArea = clip(body.service_area, INTAKE_FIELD_LIMITS.service_area);
  const trades = (Array.isArray(body.trades) ? body.trades : [])
    .map((item) => clip(item, INTAKE_FIELD_LIMITS.tradesItemLen))
    .filter(Boolean)
    .slice(0, INTAKE_FIELD_LIMITS.tradesMaxItems);
  const consent = body.consent === true;
  const honeypot = asText(body.honeypot);
  const clientRequestId = clip(body.client_request_id, INTAKE_FIELD_LIMITS.client_request_id);

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
      ...mapConventionIntakeSourceStatus(),
    },
  };
}

export function evaluateConventionIntakeWrite() {
  return {
    allowed: true,
    code: CONVENTION_WRITE_PATH_IMPLEMENTATION_READY_FOR_GUARD,
    hostedResiduals: INTAKE_HOSTED_RESIDUALS,
  };
}

export function assertIntakeQueueAccess({ session = null, bhisIntakeGrant = false } = {}) {
  if (!session) {
    const err = new Error(CONVENTION_INTAKE_ANON_READ_DENIED);
    err.code = CONVENTION_INTAKE_ANON_READ_DENIED;
    throw err;
  }
  if (bhisIntakeGrant !== true) {
    const err = new Error(CONVENTION_INTAKE_UNAUTHORIZED);
    err.code = CONVENTION_INTAKE_UNAUTHORIZED;
    throw err;
  }
  return true;
}

export function sanitizeIntakeError(error) {
  const code = error?.code || CONVENTION_WRITE_PATH_MATERIAL_BLOCKED;
  if (code === CONVENTION_INTAKE_VALIDATION) {
    return {
      code,
      message: 'Check the highlighted fields and try again.',
      errors: Array.isArray(error.errors) ? error.errors : [],
    };
  }
  if (code === CONVENTION_INTAKE_DUPLICATE) {
    return { code, message: 'This interest was already submitted from this device.' };
  }
  if (code === CONVENTION_INTAKE_RATE_LIMITED) {
    return { code, message: 'Please wait before submitting again.' };
  }
  if (code === CONVENTION_INTAKE_ANON_READ_DENIED) {
    return { code, message: 'Sign in is required to view the intake queue.' };
  }
  if (code === CONVENTION_INTAKE_UNAUTHORIZED) {
    return { code, message: 'This queue is limited to authorized BHIS intake operators.' };
  }
  if (code === CONVENTION_WRITE_PATH_IMPLEMENTATION_READY_FOR_GUARD) {
    return {
      code,
      message: 'Convention intake write path is implemented locally. Hosted apply is not authorized.',
    };
  }
  return {
    code: CONVENTION_WRITE_PATH_MATERIAL_BLOCKED,
    message:
      'Provider interest cannot be stored until an isolated intake object and effective RLS are proven.',
  };
}

export function sanitizeNetworkFailure() {
  return {
    code: 'CONVENTION_INTAKE_NETWORK',
    message: 'The request could not be completed. No record was stored.',
  };
}

export function intakeErrorContainsPii(text) {
  return SENSITIVE_LOG_RE.test(String(text || ''));
}

/**
 * Convention intake service.
 * Public submit calls the HTTP write owner only.
 * Queue uses the boolean helper, then RLS SELECT / column-limited status UPDATE.
 * Never opens customer/partner tables or app_user_roles.
 */

import {
  CONVENTION_INTAKE_DUPLICATE,
  CONVENTION_INTAKE_HELPER,
  CONVENTION_INTAKE_HTTP_FUNCTION,
  CONVENTION_INTAKE_RATE_LIMITED,
  CONVENTION_INTAKE_TABLE,
  CONVENTION_INTAKE_UNAUTHORIZED,
  CONVENTION_INTAKE_VALIDATION,
  INTAKE_QUEUE_SELECT_COLUMNS,
  INTAKE_QUEUE_STATUSES,
  assertIntakeQueueAccess,
  evaluateConventionIntakeWrite,
  sanitizeIntakeError,
  sanitizeNetworkFailure,
  validateConventionIntake,
} from '../lib/networkOs/conventionIntakePolicy.js';

const RATE_WINDOW_MS = 8000;
const FORBIDDEN_TABLES = new Set([
  'app_user_roles',
  'leads',
  'contacts',
  'partner_prospects',
  'submissions',
  'events',
]);

function makeId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return `intake-${Date.now()}`;
}

function guardClient(supabase) {
  if (!supabase || typeof supabase.from !== 'function') return supabase;
  return {
    ...supabase,
    from(table) {
      if (FORBIDDEN_TABLES.has(table)) {
        throw new Error('CONVENTION_INTAKE_TABLE_TOUCH_FORBIDDEN');
      }
      return supabase.from(table);
    },
  };
}

/**
 * @param {object} [deps]
 * @param {object} [deps.supabase] session client for the queue path only
 * @param {typeof fetch} [deps.fetch]
 * @param {string} [deps.functionsBase]
 * @param {string} [deps.anonKey]
 * @param {{ now?: () => number }} [deps.clock]
 */
export function createNetworkOsConventionIntakeService(deps = {}) {
  const supabase = guardClient(deps.supabase || null);
  const fetchImpl = deps.fetch || globalThis.fetch;
  const functionsBase = String(deps.functionsBase || '').replace(/\/$/, '');
  const anonKey = deps.anonKey || '';
  const now = deps.clock?.now || (() => Date.now());
  const lastSubmitAt = new Map();

  async function submitProviderInterest(input, { formId = 'convention-join' } = {}) {
    const validation = validateConventionIntake(input);
    if (validation.honeypotTriggered) {
      return {
        ok: true,
        persisted: false,
        confirmation: { received: true, stored: false },
        duplicate: false,
      };
    }
    if (!validation.ok) {
      const err = new Error(CONVENTION_INTAKE_VALIDATION);
      err.code = CONVENTION_INTAKE_VALIDATION;
      err.errors = validation.errors;
      return {
        ok: false,
        persisted: false,
        confirmation: { received: false, stored: false },
        error: sanitizeIntakeError(err),
      };
    }

    const last = lastSubmitAt.get(formId);
    if (last && now() - last < RATE_WINDOW_MS) {
      return {
        ok: false,
        persisted: false,
        confirmation: { received: false, stored: false },
        error: sanitizeIntakeError({ code: CONVENTION_INTAKE_RATE_LIMITED }),
      };
    }

    if (typeof fetchImpl !== 'function' || !functionsBase) {
      return {
        ok: false,
        persisted: false,
        confirmation: { received: true, stored: false },
        error: sanitizeIntakeError({ code: 'CONVENTION_WRITE_PATH_MATERIAL_BLOCKED' }),
      };
    }

    lastSubmitAt.set(formId, now());

    const headers = {
      'Content-Type': 'application/json',
    };
    if (anonKey) headers.apikey = anonKey;

    let response;
    try {
      response = await fetchImpl(`${functionsBase}/${CONVENTION_INTAKE_HTTP_FUNCTION}`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          name: validation.normalized.name,
          company: validation.normalized.company,
          email: validation.normalized.email,
          phone: validation.normalized.phone,
          trades: validation.normalized.trades,
          service_area: validation.normalized.service_area,
          consent: validation.normalized.consent,
          client_request_id: validation.normalized.client_request_id || makeId(),
        }),
      });
    } catch {
      return {
        ok: false,
        persisted: false,
        confirmation: { received: false, stored: false },
        error: sanitizeNetworkFailure(),
      };
    }

    let payload = {};
    try {
      payload = await response.json();
    } catch {
      payload = {};
    }

    if (payload?.duplicate === true || payload?.error?.code === CONVENTION_INTAKE_DUPLICATE) {
      return {
        ok: true,
        persisted: false,
        confirmation: { received: true, stored: false },
        duplicate: true,
        error: sanitizeIntakeError({ code: CONVENTION_INTAKE_DUPLICATE }),
      };
    }

    if (payload?.stored === true) {
      return {
        ok: true,
        persisted: true,
        confirmation: { received: true, stored: true },
        duplicate: false,
        mapping: {
          campaign_id: validation.normalized.campaign_id,
          source: validation.normalized.source,
          intake_channel: validation.normalized.intake_channel,
          status: validation.normalized.status,
        },
      };
    }

    if (payload?.error?.code === CONVENTION_INTAKE_VALIDATION) {
      return {
        ok: false,
        persisted: false,
        confirmation: { received: false, stored: false },
        error: sanitizeIntakeError({
          code: CONVENTION_INTAKE_VALIDATION,
          errors: payload.error.errors,
        }),
      };
    }

    if (payload?.error?.code === CONVENTION_INTAKE_RATE_LIMITED) {
      return {
        ok: false,
        persisted: false,
        confirmation: { received: false, stored: false },
        error: sanitizeIntakeError({ code: CONVENTION_INTAKE_RATE_LIMITED }),
      };
    }

    if (payload?.received === true && payload?.stored === false) {
      return {
        ok: true,
        persisted: false,
        confirmation: { received: true, stored: false },
        duplicate: Boolean(payload.duplicate),
      };
    }

    return {
      ok: false,
      persisted: false,
      confirmation: { received: false, stored: false },
      error: sanitizeIntakeError(payload?.error || sanitizeNetworkFailure()),
    };
  }

  function handleNetworkFailure() {
    return {
      ok: false,
      persisted: false,
      confirmation: { received: false, stored: false },
      error: sanitizeNetworkFailure(),
    };
  }

  async function resolveBhisGrant(access = {}) {
    if (access.bhisIntakeGrant === true || access.bhisIntakeGrant === false) {
      return access.bhisIntakeGrant === true;
    }
    if (!supabase || typeof supabase.rpc !== 'function') {
      return false;
    }
    const { data, error } = await supabase.rpc(CONVENTION_INTAKE_HELPER);
    if (error) return false;
    return data === true;
  }

  async function listIntakeQueue(access = {}) {
    try {
      if (!access.session) {
        assertIntakeQueueAccess({ session: null, bhisIntakeGrant: false });
      }
    } catch (error) {
      return {
        ok: false,
        rows: [],
        error: sanitizeIntakeError(error),
        write: evaluateConventionIntakeWrite(),
      };
    }

    const granted = await resolveBhisGrant(access);
    try {
      assertIntakeQueueAccess({ session: access.session, bhisIntakeGrant: granted });
    } catch (error) {
      return {
        ok: false,
        rows: [],
        error: sanitizeIntakeError(error),
        write: evaluateConventionIntakeWrite(),
      };
    }

    if (!supabase) {
      return {
        ok: false,
        rows: [],
        error: sanitizeIntakeError({ code: CONVENTION_INTAKE_UNAUTHORIZED }),
        write: evaluateConventionIntakeWrite(),
      };
    }

    const { data, error } = await supabase
      .from(CONVENTION_INTAKE_TABLE)
      .select(INTAKE_QUEUE_SELECT_COLUMNS)
      .order('submitted_at', { ascending: false });

    if (error) {
      return {
        ok: false,
        rows: [],
        error: sanitizeIntakeError({ code: CONVENTION_INTAKE_UNAUTHORIZED }),
        write: evaluateConventionIntakeWrite(),
      };
    }

    return {
      ok: true,
      rows: Array.isArray(data) ? data : [],
      write: evaluateConventionIntakeWrite(),
    };
  }

  async function updateIntakeStatus(access, id, status) {
    const granted = await resolveBhisGrant(access);
    try {
      assertIntakeQueueAccess({ session: access?.session, bhisIntakeGrant: granted });
    } catch (error) {
      return { ok: false, error: sanitizeIntakeError(error) };
    }
    if (!INTAKE_QUEUE_STATUSES.includes(status) || !supabase) {
      return {
        ok: false,
        error: sanitizeIntakeError({ code: CONVENTION_INTAKE_UNAUTHORIZED }),
      };
    }

    const { error } = await supabase
      .from(CONVENTION_INTAKE_TABLE)
      .update({
        onboarding_status: status,
        updated_at: new Date(now()).toISOString(),
      })
      .eq('id', id);

    if (error) {
      return {
        ok: false,
        error: sanitizeIntakeError({ code: CONVENTION_INTAKE_UNAUTHORIZED }),
      };
    }
    return { ok: true };
  }

  return {
    submitProviderInterest,
    handleNetworkFailure,
    listIntakeQueue,
    updateIntakeStatus,
    evaluateWrite: evaluateConventionIntakeWrite,
  };
}

/**
 * Fail-closed convention intake service.
 * Validates and maps source/status locally. Never inserts, updates, or
 * selects existing customer/partner tables for this workflow.
 */

import {
  CONVENTION_INTAKE_DUPLICATE,
  CONVENTION_INTAKE_RATE_LIMITED,
  CONVENTION_INTAKE_VALIDATION,
  CONVENTION_WRITE_PATH_MATERIAL_BLOCKED,
  assertConventionIntakeWriteAllowed,
  assertIntakeQueueAccess,
  evaluateConventionIntakeWrite,
  sanitizeIntakeError,
  sanitizeNetworkFailure,
  validateConventionIntake,
} from '../lib/networkOs/conventionIntakePolicy.js';

const RATE_WINDOW_MS = 8000;

function makeId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return `intake-${Date.now()}`;
}

/**
 * @param {object} [deps]
 * @param {object} [deps.supabase] unused; accepted only so callers cannot
 *   accidentally "just pass supabase" and get a write path
 * @param {{ now?: () => number }} [deps.clock]
 */
export function createNetworkOsConventionIntakeService(deps = {}) {
  const supabase = deps.supabase || null;
  const now = deps.clock?.now || (() => Date.now());
  const seenRequestIds = new Set();
  const lastSubmitAt = new Map();

  function denyWrite(extra = {}) {
    try {
      assertConventionIntakeWriteAllowed();
    } catch (error) {
      return {
        ok: false,
        persisted: false,
        confirmation: { received: true, stored: false },
        error: sanitizeIntakeError(error),
        ...extra,
      };
    }
    return {
      ok: false,
      persisted: false,
      confirmation: { received: true, stored: false },
      error: sanitizeIntakeError({ code: CONVENTION_WRITE_PATH_MATERIAL_BLOCKED }),
      ...extra,
    };
  }

  function assertNoTableTouch() {
    if (supabase && typeof supabase.from === 'function') {
      // Public intake must never open a table handle.
      throw new Error('CONVENTION_INTAKE_TABLE_TOUCH_FORBIDDEN');
    }
  }

  async function submitProviderInterest(input, { formId = 'convention-join' } = {}) {
    const validation = validateConventionIntake(input);
    if (validation.honeypotTriggered) {
      return denyWrite();
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

    const requestId = validation.normalized.client_request_id || makeId();
    const last = lastSubmitAt.get(formId);
    if (last && now() - last < RATE_WINDOW_MS) {
      return {
        ok: false,
        persisted: false,
        confirmation: { received: false, stored: false },
        error: sanitizeIntakeError({ code: CONVENTION_INTAKE_RATE_LIMITED }),
      };
    }
    if (seenRequestIds.has(requestId)) {
      return {
        ok: false,
        persisted: false,
        confirmation: { received: true, stored: false },
        error: sanitizeIntakeError({ code: CONVENTION_INTAKE_DUPLICATE }),
      };
    }

    lastSubmitAt.set(formId, now());
    seenRequestIds.add(requestId);
    void validation.normalized;
    return denyWrite({
      mapping: {
        source: validation.normalized.source,
        status: validation.normalized.status,
      },
    });
  }

  function handleNetworkFailure() {
    return {
      ok: false,
      persisted: false,
      confirmation: { received: false, stored: false },
      error: sanitizeNetworkFailure(),
    };
  }

  function listIntakeQueue(access) {
    try {
      assertIntakeQueueAccess(access);
    } catch (error) {
      return {
        ok: false,
        rows: [],
        error: sanitizeIntakeError(error),
        write: evaluateConventionIntakeWrite(),
      };
    }
    return {
      ok: true,
      rows: [],
      error: sanitizeIntakeError({ code: CONVENTION_WRITE_PATH_MATERIAL_BLOCKED }),
      write: evaluateConventionIntakeWrite(),
    };
  }

  return {
    submitProviderInterest,
    handleNetworkFailure,
    listIntakeQueue,
    evaluateWrite: evaluateConventionIntakeWrite,
    assertNoTableTouch,
  };
}

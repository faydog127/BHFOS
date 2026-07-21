/**
 * ML-P1 Slice 1 — Legacy `estimates` create DENY (KI-01).
 * New work must use canonical `quotes` only. No migration.
 */

export const ESTIMATES_CREATE_DENY_CODE = 'ML_P1_S1_ESTIMATES_CREATE_DENIED';

export const ESTIMATES_CREATE_DENY_MESSAGE =
  'DENY: legacy estimates create is frozen on the ML-P1 path. Use canonical quotes (draft) instead.';

/**
 * @param {{ operation?: string }} [opts]
 * @returns {{ ok: false, code: string, message: string }}
 */
export function denyEstimatesCreate(opts = {}) {
  return {
    ok: false,
    code: ESTIMATES_CREATE_DENY_CODE,
    message: ESTIMATES_CREATE_DENY_MESSAGE,
    operation: opts.operation || 'estimates.insert',
  };
}

/**
 * Throw-style guard for call sites that prefer exceptions.
 * @param {string} [operation]
 */
export function assertEstimatesCreateAllowed(operation = 'estimates.insert') {
  const denied = denyEstimatesCreate({ operation });
  const err = new Error(denied.message);
  err.code = denied.code;
  err.operation = denied.operation;
  throw err;
}

/**
 * True if an error is the S1 estimates DENY.
 */
export function isEstimatesCreateDeniedError(error) {
  return error?.code === ESTIMATES_CREATE_DENY_CODE;
}

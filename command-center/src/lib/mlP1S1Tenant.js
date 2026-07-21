/**
 * ML-P1 Slice 1 — Tenant enforcement helpers (deny-by-default).
 * Money-State §12: missing session tenant → DENY; client URL/default override alone → DENY.
 */

export const TENANT_DENY_CODE = 'ML_P1_S1_TENANT_DENY';

/**
 * Resolve write tenant from session only. URL may confirm match; never authorizes alone.
 * `defaultTenantId` is ignored (deny-by-default; no silent fallback).
 *
 * @param {{ sessionTenantId?: string|null, urlTenantId?: string|null, defaultTenantId?: string|null }} args
 */
export function resolveWriteTenantId({
  sessionTenantId = null,
  urlTenantId = null,
  defaultTenantId = null,
} = {}) {
  void defaultTenantId; // explicitly ignored — no admin/default tenant fallback
  const session = sessionTenantId && String(sessionTenantId).trim();
  const url = urlTenantId && String(urlTenantId).trim();

  if (!session) {
    const err = new Error('DENY: session tenant_id required for money-path write');
    err.code = TENANT_DENY_CODE;
    throw err;
  }
  if (url && session !== url) {
    const err = new Error('DENY: session tenant does not match URL tenant');
    err.code = TENANT_DENY_CODE;
    throw err;
  }
  return session;
}

/**
 * Assert row tenant matches write tenant. Null row tenant → DENY (no unscoped money rows).
 */
export function assertTenantMatch(rowTenantId, writeTenantId) {
  if (!writeTenantId) {
    const err = new Error('DENY: write tenant missing');
    err.code = TENANT_DENY_CODE;
    throw err;
  }
  if (rowTenantId == null || String(rowTenantId).trim() === '') {
    const err = new Error('DENY: row tenant missing');
    err.code = TENANT_DENY_CODE;
    throw err;
  }
  if (String(rowTenantId) !== String(writeTenantId)) {
    const err = new Error('DENY: cross-tenant access blocked');
    err.code = TENANT_DENY_CODE;
    throw err;
  }
  return true;
}

export function isTenantDenyError(error) {
  return error?.code === TENANT_DENY_CODE;
}

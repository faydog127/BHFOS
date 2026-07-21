/**
 * ML-P1 Slice 1 — Tenant enforcement helpers (deny-by-default).
 */

export const TENANT_DENY_CODE = 'ML_P1_S1_TENANT_DENY';

/**
 * Resolve write tenant: session claim preferred; URL tenant must match when both present.
 * Never silently fall back across tenants.
 *
 * @param {{ sessionTenantId?: string|null, urlTenantId?: string|null, defaultTenantId?: string|null }} args
 */
export function resolveWriteTenantId({
  sessionTenantId = null,
  urlTenantId = null,
  defaultTenantId = null,
} = {}) {
  const session = sessionTenantId && String(sessionTenantId).trim();
  const url = urlTenantId && String(urlTenantId).trim();
  const fallback = defaultTenantId && String(defaultTenantId).trim();

  if (session && url && session !== url) {
    const err = new Error('DENY: session tenant does not match URL tenant');
    err.code = TENANT_DENY_CODE;
    throw err;
  }
  if (session) return session;
  if (url) return url;
  if (fallback) return fallback;
  const err = new Error('DENY: tenant_id required for money-path write');
  err.code = TENANT_DENY_CODE;
  throw err;
}

/**
 * Assert row tenant matches write tenant.
 */
export function assertTenantMatch(rowTenantId, writeTenantId) {
  if (!writeTenantId) {
    const err = new Error('DENY: write tenant missing');
    err.code = TENANT_DENY_CODE;
    throw err;
  }
  if (rowTenantId != null && String(rowTenantId) !== String(writeTenantId)) {
    const err = new Error('DENY: cross-tenant access blocked');
    err.code = TENANT_DENY_CODE;
    throw err;
  }
  return true;
}

export function isTenantDenyError(error) {
  return error?.code === TENANT_DENY_CODE;
}

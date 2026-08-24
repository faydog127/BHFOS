/**
 * Network OS convention-demo policy (Fast Convention Lane).
 *
 * Reads may use the signed-in compatibility scope plus query-level
 * is_test_data filters. Writes stay deny-by-default until an isolated
 * demo tenant AND effective RLS are independently proven.
 *
 * Hosted RLS remains unproven for most Slice 1 objects. Source-present
 * leads JWT policies do not prove an isolated demo tenant.
 */

export const DEMO_WRITE_ISOLATION_BLOCKED = 'DEMO_WRITE_ISOLATION_BLOCKED';
export const CONVENTION_TENANT_UNRESOLVED = 'CONVENTION_TENANT_UNRESOLVED';
export const CONVENTION_TENANT_MISMATCH = 'CONVENTION_TENANT_MISMATCH';
export const CONVENTION_READ_FAILED = 'CONVENTION_READ_FAILED';

/** Compatibility / customer-bearing scopes that must never authorize demo writes. */
export const CUSTOMER_SCOPE_IDS = Object.freeze(
  new Set(['tvg', 'default', 'bhf', 'bhis', 'bhfos', 'production', 'prod', 'live']),
);

const SENSITIVE_ERROR_RE =
  /email|phone|token|jwt|secret|key|password|bearer|supabase|postgres|sql|service_role|anon/i;

function readPublicEnv(name) {
  try {
    const vite = import.meta && import.meta.env;
    if (vite && vite[name] != null && String(vite[name]).trim() !== '') {
      return String(vite[name]).trim();
    }
  } catch {
    // import.meta.env is absent in some Node test runners
  }
  if (typeof process !== 'undefined' && process.env && process.env[name]) {
    return String(process.env[name]).trim();
  }
  return '';
}

function normalizeTenantId(value) {
  if (value == null) return '';
  const next = String(value).trim().toLowerCase();
  return next;
}

export function createConventionPolicy(overrides = {}) {
  const isolatedFromEnv = normalizeTenantId(readPublicEnv('VITE_NETWORK_OS_DEMO_TENANT'));
  const rlsFromEnv = readPublicEnv('VITE_NETWORK_OS_DEMO_RLS_PROVEN') === 'true';

  return {
    isolatedDemoTenantId: isolatedFromEnv || '',
    rlsEffectiveProven: rlsFromEnv,
    customerScopeIds: CUSTOMER_SCOPE_IDS,
    ...overrides,
  };
}

export function isCustomerScopeTenant(tenantId, policy = createConventionPolicy()) {
  const id = normalizeTenantId(tenantId);
  if (!id) return false;
  const blocked = policy.customerScopeIds || CUSTOMER_SCOPE_IDS;
  return blocked.has(id);
}

export function isIsolatedDemoTenant(tenantId, policy = createConventionPolicy()) {
  const id = normalizeTenantId(tenantId);
  if (!id || isCustomerScopeTenant(id, policy)) return false;
  const allowed = normalizeTenantId(policy.isolatedDemoTenantId);
  return Boolean(allowed && allowed === id);
}

/**
 * Active tenant comes from the session claim. URL may confirm; it never authorizes.
 * Default / env fallbacks do not resolve a tenant.
 */
export function resolveConventionTenant({
  sessionTenantId = null,
  urlTenantId = null,
} = {}) {
  const session = normalizeTenantId(sessionTenantId);
  const url = normalizeTenantId(urlTenantId);

  if (!session) {
    const err = new Error(CONVENTION_TENANT_UNRESOLVED);
    err.code = CONVENTION_TENANT_UNRESOLVED;
    throw err;
  }
  if (url && url !== session) {
    const err = new Error(CONVENTION_TENANT_MISMATCH);
    err.code = CONVENTION_TENANT_MISMATCH;
    throw err;
  }
  return session;
}

export function describeConventionTenant(tenantId, policy = createConventionPolicy()) {
  const id = normalizeTenantId(tenantId);
  const isolated = isIsolatedDemoTenant(id, policy);
  return {
    tenantId: id,
    isolatedDemo: isolated,
    customerScope: isCustomerScopeTenant(id, policy),
    writesAllowed: isolated && policy.rlsEffectiveProven === true,
  };
}

export function assertDemoWriteAllowed(tenantCtx = {}, policy = createConventionPolicy()) {
  const tenantId = resolveConventionTenant(tenantCtx);
  const isolated = isIsolatedDemoTenant(tenantId, policy);
  if (!isolated || policy.rlsEffectiveProven !== true) {
    const err = new Error(DEMO_WRITE_ISOLATION_BLOCKED);
    err.code = DEMO_WRITE_ISOLATION_BLOCKED;
    throw err;
  }
  return tenantId;
}

export function evaluateDemoWrite(tenantCtx = {}, policy = createConventionPolicy()) {
  try {
    const tenantId = assertDemoWriteAllowed(tenantCtx, policy);
    return { allowed: true, code: null, tenantId };
  } catch (error) {
    return {
      allowed: false,
      code: error?.code || DEMO_WRITE_ISOLATION_BLOCKED,
      tenantId: normalizeTenantId(tenantCtx.sessionTenantId) || null,
    };
  }
}

export function keepDemoCustomerRows(rows) {
  return (Array.isArray(rows) ? rows : []).filter(
    (row) => row && row.is_test_data === true,
  );
}

export function uniqueIds(rows, key) {
  return [
    ...new Set(
      (Array.isArray(rows) ? rows : [])
        .map((row) => row && row[key])
        .filter((value) => value != null && String(value).trim() !== ''),
    ),
  ];
}

export function sanitizeConventionError(error) {
  const code = error?.code || CONVENTION_READ_FAILED;
  if (code === DEMO_WRITE_ISOLATION_BLOCKED) {
    return {
      code,
      message:
        'Demo writes are disabled until an isolated demo tenant and effective RLS are proven.',
    };
  }
  if (code === CONVENTION_TENANT_UNRESOLVED) {
    return {
      code,
      message: 'Active tenant could not be resolved from the signed-in session.',
    };
  }
  if (code === CONVENTION_TENANT_MISMATCH) {
    return {
      code,
      message: 'Session tenant does not match the requested scope.',
    };
  }
  const raw = error?.message ? String(error.message) : '';
  if (raw && !SENSITIVE_ERROR_RE.test(raw) && raw.length < 120 && raw === code) {
    return { code, message: 'Unable to load convention demo data.' };
  }
  return {
    code: CONVENTION_READ_FAILED,
    message: 'Unable to load convention demo data.',
  };
}

export function isConventionPolicyError(error) {
  return (
    error?.code === DEMO_WRITE_ISOLATION_BLOCKED ||
    error?.code === CONVENTION_TENANT_UNRESOLVED ||
    error?.code === CONVENTION_TENANT_MISMATCH ||
    error?.code === CONVENTION_READ_FAILED
  );
}

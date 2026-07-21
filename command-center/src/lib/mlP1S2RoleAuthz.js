/**
 * ML-P1 Slice 2 — R-S1-03 server internal role authorization matrix.
 * Maps live app roles → Money-State Contract §11 capabilities.
 * UI hiding is not authorization — every money-state action must call assertCapability.
 */

export const ML_P1_S2_ROLES = Object.freeze({
  OFFICE: 'office',
  TECHNICIAN: 'technician',
  MANAGER: 'manager',
  ADMIN: 'admin',
  CUSTOMER: 'customer',
  UNAUTHENTICATED: 'unauthenticated',
});

export const ML_P1_S2_CAPABILITIES = Object.freeze({
  DRAFT_EDIT: 'quote.draft_edit',
  ISSUE: 'quote.issue',
  REVISE: 'quote.revise',
  REJECT_OFFICE: 'quote.reject_office',
  EXPIRE: 'quote.expire',
  APPROVE_CUSTOMER: 'quote.approve_customer',
  APPROVE_BREAK_GLASS: 'quote.approve_break_glass',
});

/** Live CRM roles → contract roles */
export function normalizeActorRole(rawRole) {
  const r = String(rawRole || '')
    .trim()
    .toLowerCase();
  if (!r || r === 'anon' || r === 'anonymous') return ML_P1_S2_ROLES.UNAUTHENTICATED;
  if (r === 'customer' || r === 'public' || r === 'designated_customer') {
    return ML_P1_S2_ROLES.CUSTOMER;
  }
  if (r === 'admin' || r === 'super_admin') return ML_P1_S2_ROLES.ADMIN;
  if (r === 'manager') return ML_P1_S2_ROLES.MANAGER;
  if (r === 'technician' || r === 'tech') return ML_P1_S2_ROLES.TECHNICIAN;
  if (r === 'office' || r === 'csr') return ML_P1_S2_ROLES.OFFICE;
  // viewer / partner: no money-state mutation rights
  if (r === 'viewer' || r === 'partner') return ML_P1_S2_ROLES.UNAUTHENTICATED;
  return ML_P1_S2_ROLES.UNAUTHENTICATED;
}

/**
 * Capability matrix (Contract §11 + S2 scope).
 * Technician: draft/issue per policy = No for S2 money mutations (deny).
 */
const MATRIX = Object.freeze({
  [ML_P1_S2_CAPABILITIES.DRAFT_EDIT]: new Set([
    ML_P1_S2_ROLES.OFFICE,
    ML_P1_S2_ROLES.MANAGER,
    ML_P1_S2_ROLES.ADMIN,
  ]),
  [ML_P1_S2_CAPABILITIES.ISSUE]: new Set([
    ML_P1_S2_ROLES.OFFICE,
    ML_P1_S2_ROLES.MANAGER,
    ML_P1_S2_ROLES.ADMIN,
  ]),
  [ML_P1_S2_CAPABILITIES.REVISE]: new Set([
    ML_P1_S2_ROLES.OFFICE,
    ML_P1_S2_ROLES.MANAGER,
    ML_P1_S2_ROLES.ADMIN,
  ]),
  [ML_P1_S2_CAPABILITIES.REJECT_OFFICE]: new Set([
    ML_P1_S2_ROLES.OFFICE,
    ML_P1_S2_ROLES.MANAGER,
    ML_P1_S2_ROLES.ADMIN,
  ]),
  [ML_P1_S2_CAPABILITIES.EXPIRE]: new Set([
    ML_P1_S2_ROLES.OFFICE,
    ML_P1_S2_ROLES.MANAGER,
    ML_P1_S2_ROLES.ADMIN,
  ]),
  [ML_P1_S2_CAPABILITIES.APPROVE_CUSTOMER]: new Set([ML_P1_S2_ROLES.CUSTOMER]),
  [ML_P1_S2_CAPABILITIES.APPROVE_BREAK_GLASS]: new Set([ML_P1_S2_ROLES.ADMIN]),
});

export const ROLE_AUTHZ_DENY_CODE = 'ML_P1_S2_ROLE_DENY';

export function canPerform(capability, rawRole) {
  const role = normalizeActorRole(rawRole);
  const allowed = MATRIX[capability];
  if (!allowed) return false;
  return allowed.has(role);
}

export function assertCapability(capability, rawRole, { reasonCode = null } = {}) {
  const role = normalizeActorRole(rawRole);
  if (role === ML_P1_S2_ROLES.UNAUTHENTICATED) {
    const err = new Error('DENY: unauthenticated actor cannot mutate quote money state');
    err.code = ROLE_AUTHZ_DENY_CODE;
    err.capability = capability;
    err.actorRole = role;
    throw err;
  }
  if (capability === ML_P1_S2_CAPABILITIES.APPROVE_BREAK_GLASS && !reasonCode) {
    const err = new Error('DENY: admin break-glass approve requires reason_code');
    err.code = 'ML_P1_S2_BREAK_GLASS_REASON_REQUIRED';
    err.capability = capability;
    throw err;
  }
  if (!canPerform(capability, role)) {
    const err = new Error(
      `DENY: role "${role}" cannot perform ${capability}`,
    );
    err.code = ROLE_AUTHZ_DENY_CODE;
    err.capability = capability;
    err.actorRole = role;
    throw err;
  }
  return { ok: true, role, capability };
}

export function isRoleAuthzDeniedError(err) {
  return Boolean(err && err.code === ROLE_AUTHZ_DENY_CODE);
}

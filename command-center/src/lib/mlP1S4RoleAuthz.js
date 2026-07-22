/**
 * ML-P1 Slice 4 — field execution + change-order capability matrix.
 * UI hiding is not authorization — server RPCs enforce deny-by-default.
 * PD-S4-02: technicians never approve change orders.
 */

import { normalizeActorRole, ML_P1_S2_ROLES } from './mlP1S2RoleAuthz.js';

export const ML_P1_S4_ROLES = ML_P1_S2_ROLES;

export const ML_P1_S4_CAPABILITIES = Object.freeze({
  ASSIGN: 'job.assign',
  SCHEDULE: 'job.schedule',
  FIELD_TRANSITION: 'job.field_transition',
  COMPLETE: 'job.complete',
  REOPEN: 'job.reopen',
  ACK_WAIVE: 'job.ack_waive',
  CO_PROPOSE: 'co.propose',
  CO_APPROVE_CUSTOMER: 'co.approve_customer',
  CO_APPROVE_BREAK_GLASS: 'co.approve_break_glass',
  CO_REJECT: 'co.reject',
  CO_CANCEL: 'co.cancel',
  CO_FREE_FORM_RELEASE: 'co.free_form_release',
});

const MATRIX = Object.freeze({
  [ML_P1_S4_CAPABILITIES.ASSIGN]: new Set([
    ML_P1_S4_ROLES.OFFICE,
    ML_P1_S4_ROLES.MANAGER,
    ML_P1_S4_ROLES.ADMIN,
  ]),
  [ML_P1_S4_CAPABILITIES.SCHEDULE]: new Set([
    ML_P1_S4_ROLES.OFFICE,
    ML_P1_S4_ROLES.MANAGER,
    ML_P1_S4_ROLES.ADMIN,
  ]),
  [ML_P1_S4_CAPABILITIES.FIELD_TRANSITION]: new Set([
    ML_P1_S4_ROLES.TECHNICIAN,
    ML_P1_S4_ROLES.OFFICE,
    ML_P1_S4_ROLES.MANAGER,
    ML_P1_S4_ROLES.ADMIN,
  ]),
  [ML_P1_S4_CAPABILITIES.COMPLETE]: new Set([
    ML_P1_S4_ROLES.TECHNICIAN,
    ML_P1_S4_ROLES.OFFICE,
    ML_P1_S4_ROLES.MANAGER,
    ML_P1_S4_ROLES.ADMIN,
  ]),
  [ML_P1_S4_CAPABILITIES.REOPEN]: new Set([
    ML_P1_S4_ROLES.OFFICE,
    ML_P1_S4_ROLES.MANAGER,
    ML_P1_S4_ROLES.ADMIN,
  ]),
  [ML_P1_S4_CAPABILITIES.ACK_WAIVE]: new Set([
    ML_P1_S4_ROLES.OFFICE,
    ML_P1_S4_ROLES.MANAGER,
    ML_P1_S4_ROLES.ADMIN,
  ]),
  [ML_P1_S4_CAPABILITIES.CO_PROPOSE]: new Set([
    ML_P1_S4_ROLES.TECHNICIAN,
    ML_P1_S4_ROLES.OFFICE,
    ML_P1_S4_ROLES.MANAGER,
    ML_P1_S4_ROLES.ADMIN,
  ]),
  [ML_P1_S4_CAPABILITIES.CO_APPROVE_CUSTOMER]: new Set([ML_P1_S4_ROLES.CUSTOMER]),
  [ML_P1_S4_CAPABILITIES.CO_APPROVE_BREAK_GLASS]: new Set([
    ML_P1_S4_ROLES.OFFICE,
    ML_P1_S4_ROLES.MANAGER,
    ML_P1_S4_ROLES.ADMIN,
  ]),
  [ML_P1_S4_CAPABILITIES.CO_REJECT]: new Set([
    ML_P1_S4_ROLES.OFFICE,
    ML_P1_S4_ROLES.MANAGER,
    ML_P1_S4_ROLES.ADMIN,
    ML_P1_S4_ROLES.CUSTOMER,
  ]),
  [ML_P1_S4_CAPABILITIES.CO_CANCEL]: new Set([
    ML_P1_S4_ROLES.OFFICE,
    ML_P1_S4_ROLES.MANAGER,
    ML_P1_S4_ROLES.ADMIN,
    ML_P1_S4_ROLES.TECHNICIAN,
  ]),
  [ML_P1_S4_CAPABILITIES.CO_FREE_FORM_RELEASE]: new Set([
    ML_P1_S4_ROLES.OFFICE,
    ML_P1_S4_ROLES.MANAGER,
    ML_P1_S4_ROLES.ADMIN,
  ]),
});

export const ROLE_AUTHZ_DENY_CODE = 'ML_P1_S4_ROLE_DENY';

export function canPerformS4(capability, rawRole) {
  const role = normalizeActorRole(rawRole);
  const allowed = MATRIX[capability];
  if (!allowed) return false;
  // PD-S4-02 hard deny: technician never approves COs
  if (
    role === ML_P1_S4_ROLES.TECHNICIAN &&
    (capability === ML_P1_S4_CAPABILITIES.CO_APPROVE_CUSTOMER ||
      capability === ML_P1_S4_CAPABILITIES.CO_APPROVE_BREAK_GLASS)
  ) {
    return false;
  }
  return allowed.has(role);
}

export function assertS4Capability(capability, rawRole, { reasonCode = null } = {}) {
  const role = normalizeActorRole(rawRole);
  if (!canPerformS4(capability, role)) {
    const err = new Error(`DENY: role "${role}" cannot perform ${capability}`);
    err.code = ROLE_AUTHZ_DENY_CODE;
    err.capability = capability;
    err.actorRole = role;
    throw err;
  }
  if (
    (capability === ML_P1_S4_CAPABILITIES.CO_APPROVE_BREAK_GLASS ||
      capability === ML_P1_S4_CAPABILITIES.REOPEN) &&
    !reasonCode
  ) {
    const err = new Error('DENY: break-glass action requires reason');
    err.code = 'ML_P1_S4_BREAK_GLASS_REASON_REQUIRED';
    err.capability = capability;
    throw err;
  }
}

/** PD-S4-05 UI labels */
export const ML_P1_S4_STATUS_LABELS = Object.freeze({
  unscheduled: 'Created',
  pending_schedule: 'Needs schedule',
  scheduled: 'Scheduled',
  en_route: 'On the way',
  arrived: 'Arrived',
  in_progress: 'In progress',
  on_hold: 'Paused',
  no_access: 'No access',
  reschedule_required: 'Reschedule required',
  completion_pending: 'Completion pending',
  completed: 'Completed',
  cancelled: 'Cancelled',
});

export function formatS4StatusLabel(status) {
  const key = String(status || '')
    .trim()
    .toLowerCase();
  return ML_P1_S4_STATUS_LABELS[key] || key || 'Unknown';
}

/** Derived office condition — not a technician action (PD-S4-05). */
export function isDispatchedDerived(job) {
  if (!job) return false;
  const status = String(job.status || '')
    .trim()
    .toLowerCase();
  return status === 'scheduled' && Boolean(job.technician_id) && Boolean(job.scheduled_start);
}

export function nextFieldActionsForStatus(status) {
  const s = String(status || '')
    .trim()
    .toLowerCase();
  switch (s) {
    case 'scheduled':
      return ['on_my_way'];
    case 'en_route':
      return ['arrive', 'no_access', 'request_reschedule'];
    case 'arrived':
      return ['start', 'no_access', 'request_reschedule'];
    case 'in_progress':
      return ['pause', 'complete_submit', 'no_access', 'request_reschedule'];
    case 'on_hold':
      return ['resume', 'request_reschedule'];
    case 'no_access':
      return ['request_reschedule'];
    case 'completion_pending':
      return ['complete_finalize'];
    default:
      return [];
  }
}

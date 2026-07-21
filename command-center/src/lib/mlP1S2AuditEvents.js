/**
 * ML-P1 Slice 2 — Quote lifecycle audit event types (extends S1 builders).
 */

import { buildMoneyStateAuditEvent } from './mlP1S1AuditEvents.js';

export const ML_P1_S2_EVENT_TYPES = Object.freeze({
  ISSUED: 'quote.issued',
  REVISED: 'quote.revised',
  APPROVED: 'quote.approved',
  REJECTED: 'quote.rejected',
  EXPIRED: 'quote.expired',
  ROLE_DENY: 'security.role_deny',
  TRANSITION_DENY: 'security.transition_deny',
});

export function buildS2AuditEvent(args) {
  return buildMoneyStateAuditEvent({
    ...args,
    eventType: args.eventType,
    sourceAction: args.sourceAction,
  });
}

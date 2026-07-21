/**
 * ML-P1 Slice 1 — Draft quote audit event builders (Money-State Contract minimum fields).
 * Client may insert into `events` when RLS allows; failures must not block draft save
 * but are recorded as incomplete for KPI audit completeness.
 */

export const ML_P1_S1_EVENT_TYPES = Object.freeze({
  DRAFT_CREATED: 'quote.draft_created',
  DRAFT_UPDATED: 'quote.draft_updated',
  DRAFT_ITEMS_SET: 'quote.draft_items_set',
  TENANT_DENY: 'security.tenant_deny',
  ESTIMATES_CREATE_DENY: 'security.estimates_create_deny',
  DUP_CUSTOMER_HIT: 'kpi.duplicate_customer_hit',
});

/**
 * Build append-only event row (no secrets / tokens).
 */
export function buildMoneyStateAuditEvent({
  eventId,
  tenantId,
  recordId,
  recordType = 'quote',
  actorId = null,
  actorRole = 'office',
  previousState = null,
  newState = 'draft',
  reason = null,
  sourceAction,
  correlationId,
  success = true,
  related = {},
  eventType,
} = {}) {
  if (!tenantId) {
    const err = new Error('DENY: audit event requires tenant_id');
    err.code = 'ML_P1_S1_AUDIT_MISSING_TENANT';
    throw err;
  }
  if (!recordId && success) {
    const err = new Error('DENY: successful audit event requires record_id');
    err.code = 'ML_P1_S1_AUDIT_MISSING_RECORD';
    throw err;
  }
  if (!sourceAction || !eventType) {
    const err = new Error('DENY: audit event requires source_action and event_type');
    err.code = 'ML_P1_S1_AUDIT_MISSING_ACTION';
    throw err;
  }

  const payload = {
    event_id: eventId || null,
    record_id: recordId || null,
    record_type: recordType,
    tenant_id: tenantId,
    actor_id: actorId,
    actor_role: actorRole,
    previous_state: previousState,
    new_state: newState,
    reason: reason || null,
    source_action: sourceAction,
    correlation_id: correlationId || null,
    success: Boolean(success),
    quote_id: related.quote_id || recordId || null,
    lead_id: related.lead_id || null,
    // Slice 1: no job/invoice ids
    job_id: null,
    invoice_id: null,
  };

  return {
    tenant_id: tenantId,
    entity_type: recordType,
    entity_id: recordId || correlationId || 'unknown',
    event_type: eventType,
    actor_type: actorRole,
    actor_id: actorId,
    payload,
    created_at: new Date().toISOString(),
  };
}

export function assertAuditPayloadComplete(payload = {}) {
  const required = [
    'record_type',
    'tenant_id',
    'actor_role',
    'new_state',
    'source_action',
    'correlation_id',
    'success',
  ];
  const missing = required.filter((k) => payload[k] === undefined || payload[k] === null || payload[k] === '');
  // success may be false; still required key present
  if (payload.success === undefined) missing.push('success');
  return { ok: missing.length === 0, missing };
}

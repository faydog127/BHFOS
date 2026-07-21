/**
 * ML-P1 Slice 2 — Quote lifecycle transitions (issue / revise / approve / reject / expire).
 *
 * Enforces Money-State Contract statuses + R-S1-03 role matrix.
 * Stop before accept→job (S3): job auto-create is gated off by migration.
 * No Stripe / invoice / estimates create path.
 */

import { assertTenantMatch, resolveWriteTenantId } from '../lib/mlP1S1Tenant.js';
import {
  ML_P1_S2_CAPABILITIES,
  assertCapability,
  normalizeActorRole,
} from '../lib/mlP1S2RoleAuthz.js';
import { ML_P1_S2_EVENT_TYPES, buildS2AuditEvent } from '../lib/mlP1S2AuditEvents.js';

/** Canonical Money-State statuses used by S2 (DB may normalize approved→accepted). */
export const ML_P1_S2_STATUSES = Object.freeze({
  DRAFT: 'draft',
  ISSUED: 'issued',
  APPROVED: 'approved',
  ACCEPTED: 'accepted',
  REJECTED: 'rejected',
  EXPIRED: 'expired',
  REVISED: 'revised',
});

const IMMUTABLE_CONTENT = new Set([
  ML_P1_S2_STATUSES.ISSUED,
  ML_P1_S2_STATUSES.APPROVED,
  ML_P1_S2_STATUSES.ACCEPTED,
]);

function newCorrelationId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return `s2-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function normalizeQuoteStatus(status) {
  const s = String(status || '')
    .trim()
    .toLowerCase();
  if (s === 'approved') return ML_P1_S2_STATUSES.ACCEPTED;
  return s;
}

export function quoteAmount(row) {
  if (!row) return null;
  const n = row.total_amount ?? row.total;
  if (n === null || n === undefined || n === '') return null;
  return Number(n);
}

/**
 * Allowed from→to transitions (input status before normalize).
 * approve writes `approved` (DB may store `accepted` via normalize trigger).
 */
export const ML_P1_S2_TRANSITIONS = Object.freeze({
  issue: { from: new Set(['draft']), to: ML_P1_S2_STATUSES.ISSUED },
  approve: { from: new Set(['issued']), to: ML_P1_S2_STATUSES.APPROVED },
  reject: { from: new Set(['issued', 'draft']), to: ML_P1_S2_STATUSES.REJECTED },
  expire: { from: new Set(['issued']), to: ML_P1_S2_STATUSES.EXPIRED },
  revise: {
    from: new Set(['issued', 'rejected', 'expired']),
    to: ML_P1_S2_STATUSES.REVISED,
  },
});

export function assertTransitionAllowed(action, currentStatus) {
  const rule = ML_P1_S2_TRANSITIONS[action];
  if (!rule) {
    const err = new Error(`DENY: unknown lifecycle action "${action}"`);
    err.code = 'ML_P1_S2_UNKNOWN_ACTION';
    throw err;
  }
  const raw = String(currentStatus || '')
    .trim()
    .toLowerCase();
  if (!rule.from.has(raw)) {
    const err = new Error(`DENY: cannot ${action} quote in status "${currentStatus}"`);
    err.code = 'ML_P1_S2_TRANSITION_DENY';
    err.from = currentStatus;
    err.action = action;
    throw err;
  }
  return rule;
}

export function assertQuoteMutableForEdit(status) {
  const s = normalizeQuoteStatus(status);
  const raw = String(status || '')
    .trim()
    .toLowerCase();
  if (IMMUTABLE_CONTENT.has(s) || IMMUTABLE_CONTENT.has(raw) || raw === 'issued') {
    const err = new Error(
      'DENY: issued/approved quotes are immutable; use revise to create a new draft version',
    );
    err.code = 'ML_P1_S2_IMMUTABLE';
    throw err;
  }
  if (raw !== ML_P1_S2_STATUSES.DRAFT) {
    const err = new Error('DENY: only draft quotes may be edited in place');
    err.code = 'ML_P1_S2_NOT_DRAFT';
    throw err;
  }
  return true;
}

function capabilityForAction(action, actorRole) {
  if (action === 'issue') return ML_P1_S2_CAPABILITIES.ISSUE;
  if (action === 'revise') return ML_P1_S2_CAPABILITIES.REVISE;
  if (action === 'reject') return ML_P1_S2_CAPABILITIES.REJECT_OFFICE;
  if (action === 'expire') return ML_P1_S2_CAPABILITIES.EXPIRE;
  if (action === 'approve') {
    return normalizeActorRole(actorRole) === 'customer'
      ? ML_P1_S2_CAPABILITIES.APPROVE_CUSTOMER
      : ML_P1_S2_CAPABILITIES.APPROVE_BREAK_GLASS;
  }
  return null;
}

/**
 * @param {object} deps
 * @param {import('@supabase/supabase-js').SupabaseClient} deps.supabase
 */
export function createMlP1S2QuoteLifecycleService(deps) {
  const supabase = deps.supabase;
  if (!supabase) throw new Error('mlP1S2QuoteLifecycleService requires supabase');

  async function emitAudit(row) {
    try {
      const { error } = await supabase.from('events').insert(row);
      if (error) return { ok: false, error };
      return { ok: true };
    } catch (error) {
      return { ok: false, error };
    }
  }

  async function loadQuote({ quoteId, tenantId }) {
    const { data, error } = await supabase
      .from('quotes')
      .select('*')
      .eq('id', quoteId)
      .eq('tenant_id', tenantId)
      .maybeSingle();
    if (error) throw error;
    if (!data) {
      const err = new Error('DENY: quote not found for tenant');
      err.code = 'ML_P1_S2_QUOTE_NOT_FOUND';
      throw err;
    }
    assertTenantMatch(data.tenant_id, tenantId);
    return data;
  }

  async function reviseQuote({ existing, tenantId, actorId, actorRole, corr, reasonCode }) {
    const now = new Date().toISOString();
    const { error: markErr } = await supabase
      .from('quotes')
      .update({
        status: ML_P1_S2_STATUSES.REVISED,
        updated_at: now,
      })
      .eq('id', existing.id)
      .eq('tenant_id', tenantId);
    if (markErr) throw markErr;

    const nextVersion = Number(existing.quote_version || 1) + 1;
    const amount = quoteAmount(existing);
    const draftPayload = {
      lead_id: existing.lead_id,
      tenant_id: tenantId,
      status: ML_P1_S2_STATUSES.DRAFT,
      service_address: existing.service_address,
      customer_name: existing.customer_name,
      customer_email: existing.customer_email,
      customer_phone: existing.customer_phone,
      subtotal: existing.subtotal,
      total_amount: amount,
      tax_amount: existing.tax_amount ?? existing.tax ?? 0,
      notes: existing.notes || null,
      quote_version: nextVersion,
      supersedes_quote_id: existing.id,
      created_at: now,
      updated_at: now,
    };

    const { data: draft, error: draftErr } = await supabase
      .from('quotes')
      .insert([draftPayload])
      .select('*')
      .single();
    if (draftErr) throw draftErr;

    const { data: items } = await supabase
      .from('quote_items')
      .select('description, quantity, unit_price, total_price')
      .eq('quote_id', existing.id);
    if (items?.length) {
      const rows = items.map((item) => ({
        quote_id: draft.id,
        description: item.description,
        quantity: item.quantity,
        unit_price: item.unit_price,
        total_price: item.total_price,
      }));
      const { error: itemsErr } = await supabase.from('quote_items').insert(rows);
      if (itemsErr) throw itemsErr;
    }

    const auditRow = buildS2AuditEvent({
      tenantId,
      recordId: draft.id,
      recordType: 'quote',
      actorId,
      actorRole: normalizeActorRole(actorRole),
      previousState: existing.status,
      newState: ML_P1_S2_STATUSES.DRAFT,
      reason: reasonCode || 'revise',
      sourceAction: 'ml_p1_s2.revise_quote',
      correlationId: corr,
      success: true,
      related: {
        quote_id: draft.id,
        lead_id: draft.lead_id,
        supersedes_quote_id: existing.id,
      },
      eventType: ML_P1_S2_EVENT_TYPES.REVISED,
    });
    const audit = await emitAudit(auditRow);

    return {
      quote: draft,
      superseded: existing.id,
      action: 'revise',
      correlationId: corr,
      audit,
      jobCreated: false,
    };
  }

  async function transition({
    action,
    quoteId,
    sessionTenantId = null,
    urlTenantId = null,
    actorId = null,
    actorRole = null,
    reasonCode = null,
    rejectionReason = null,
    approvalMethod = 'customer_token',
    correlationId = null,
    validUntil = null,
  }) {
    const tenantId = resolveWriteTenantId({ sessionTenantId, urlTenantId });
    if (!actorRole && !actorId) {
      const err = new Error('DENY: missing actor for quote lifecycle mutation');
      err.code = 'ML_P1_S2_MISSING_ACTOR';
      throw err;
    }

    const capability = capabilityForAction(action, actorRole);
    if (!capability) {
      const err = new Error(`DENY: unknown action ${action}`);
      err.code = 'ML_P1_S2_UNKNOWN_ACTION';
      throw err;
    }
    assertCapability(capability, actorRole, { reasonCode });

    const existing = await loadQuote({ quoteId, tenantId });
    assertTransitionAllowed(action, existing.status);

    const corr = correlationId || newCorrelationId();
    const previousState = existing.status;

    if (action === 'revise') {
      return reviseQuote({
        existing,
        tenantId,
        actorId,
        actorRole,
        corr,
        reasonCode,
      });
    }

    const patch = {
      updated_at: new Date().toISOString(),
    };

    if (action === 'issue') {
      patch.status = ML_P1_S2_STATUSES.ISSUED;
      patch.issued_at = new Date().toISOString();
      if (validUntil) patch.valid_until = validUntil;
    } else if (action === 'approve') {
      patch.status = ML_P1_S2_STATUSES.APPROVED;
      patch.accepted_at = new Date().toISOString();
      patch.approval_method = approvalMethod || 'customer_token';
      patch.approved_by_actor_id = actorId ? String(actorId) : null;
      patch.approved_amount = quoteAmount(existing);
    } else if (action === 'reject') {
      patch.status = ML_P1_S2_STATUSES.REJECTED;
      patch.rejected_at = new Date().toISOString();
      patch.rejection_reason = rejectionReason || reasonCode || 'rejected';
    } else if (action === 'expire') {
      patch.status = ML_P1_S2_STATUSES.EXPIRED;
      patch.expired_at = new Date().toISOString();
    }

    const { data: quote, error } = await supabase
      .from('quotes')
      .update(patch)
      .eq('id', quoteId)
      .eq('tenant_id', tenantId)
      .select('*')
      .single();
    if (error) throw error;

    const eventType = {
      issue: ML_P1_S2_EVENT_TYPES.ISSUED,
      approve: ML_P1_S2_EVENT_TYPES.APPROVED,
      reject: ML_P1_S2_EVENT_TYPES.REJECTED,
      expire: ML_P1_S2_EVENT_TYPES.EXPIRED,
    }[action];

    const auditRow = buildS2AuditEvent({
      tenantId,
      recordId: quoteId,
      recordType: 'quote',
      actorId,
      actorRole: normalizeActorRole(actorRole),
      previousState,
      newState: quote.status,
      reason: reasonCode || rejectionReason || null,
      sourceAction: `ml_p1_s2.${action}_quote`,
      correlationId: corr,
      success: true,
      related: { quote_id: quoteId, lead_id: quote.lead_id },
      eventType,
    });
    const audit = await emitAudit(auditRow);

    return {
      quote,
      action,
      correlationId: corr,
      audit,
      jobCreated: false,
    };
  }

  async function approveByPublicToken({
    publicToken,
    actorId = null,
    correlationId = null,
    approvalMethod = 'public_token',
  }) {
    const token = String(publicToken || '').trim();
    if (!token) {
      const err = new Error('DENY: public_token required');
      err.code = 'ML_P1_S2_MISSING_TOKEN';
      throw err;
    }
    assertCapability(ML_P1_S2_CAPABILITIES.APPROVE_CUSTOMER, 'customer');

    const { data: existing, error } = await supabase
      .from('quotes')
      .select('*')
      .eq('public_token', token)
      .maybeSingle();
    if (error) throw error;
    if (!existing) {
      const err = new Error('DENY: quote not found for token');
      err.code = 'ML_P1_S2_QUOTE_NOT_FOUND';
      throw err;
    }
    if (!existing.tenant_id) {
      const err = new Error('DENY: quote missing tenant_id');
      err.code = 'ML_P1_S2_MISSING_TENANT';
      throw err;
    }
    assertTransitionAllowed('approve', existing.status);

    const corr = correlationId || newCorrelationId();
    const previousState = existing.status;
    const patch = {
      status: ML_P1_S2_STATUSES.APPROVED,
      accepted_at: new Date().toISOString(),
      approval_method: approvalMethod,
      approved_by_actor_id: actorId ? String(actorId) : null,
      approved_amount: quoteAmount(existing),
      updated_at: new Date().toISOString(),
    };

    const { data: quote, error: updErr } = await supabase
      .from('quotes')
      .update(patch)
      .eq('id', existing.id)
      .eq('tenant_id', existing.tenant_id)
      .eq('public_token', token)
      .select('*')
      .single();
    if (updErr) throw updErr;

    const auditRow = buildS2AuditEvent({
      tenantId: existing.tenant_id,
      recordId: existing.id,
      recordType: 'quote',
      actorId,
      actorRole: 'customer',
      previousState,
      newState: quote.status,
      reason: null,
      sourceAction: 'ml_p1_s2.approve_quote_public_token',
      correlationId: corr,
      success: true,
      related: { quote_id: existing.id, lead_id: quote.lead_id },
      eventType: ML_P1_S2_EVENT_TYPES.APPROVED,
    });
    const audit = await emitAudit(auditRow);

    return {
      quote,
      action: 'approve',
      correlationId: corr,
      audit,
      jobCreated: false,
    };
  }

  return {
    issueQuote: (args) => transition({ ...args, action: 'issue' }),
    approveQuote: (args) => transition({ ...args, action: 'approve' }),
    approveByPublicToken,
    rejectQuote: (args) => transition({ ...args, action: 'reject' }),
    expireQuote: (args) => transition({ ...args, action: 'expire' }),
    reviseQuote: (args) => transition({ ...args, action: 'revise' }),
    assertTransitionAllowed,
    assertQuoteMutableForEdit,
    loadQuote,
  };
}

/**
 * ML-P1 Slice 2 — Quote lifecycle client. Mutations go through server RPCs
 * (R-S1-03 + transitions). Client matrix helpers remain for tests/UI gating only.
 */

import { resolveWriteTenantId } from '../lib/mlP1S1Tenant.js';
import { normalizeActorRole } from '../lib/mlP1S2RoleAuthz.js';

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

function mapRpcError(error) {
  const msg = String(error?.message || error || 'lifecycle RPC failed');
  const err = new Error(msg);
  if (/ML_P1_S2_ROLE_DENY|42501/i.test(msg) && /BREAK_GLASS/i.test(msg)) {
    err.code = 'ML_P1_S2_BREAK_GLASS_REASON_REQUIRED';
  } else if (/ML_P1_S2_BREAK_GLASS_REASON_REQUIRED/i.test(msg)) {
    err.code = 'ML_P1_S2_BREAK_GLASS_REASON_REQUIRED';
  } else if (/ML_P1_S2_ROLE_DENY/i.test(msg)) {
    err.code = 'ML_P1_S2_ROLE_DENY';
  } else if (/ML_P1_S2_TENANT_DENY|TENANT_DENY/i.test(msg)) {
    err.code = 'ML_P1_S1_TENANT_DENY';
  } else if (/ML_P1_S2_TRANSITION_DENY/i.test(msg)) {
    err.code = 'ML_P1_S2_TRANSITION_DENY';
  } else if (/ML_P1_S2_JOB_GATE_REQUIRED/i.test(msg)) {
    err.code = 'ML_P1_S2_JOB_GATE_REQUIRED';
  } else if (/ML_P1_S2_QUOTE_NOT_FOUND/i.test(msg)) {
    err.code = 'ML_P1_S2_QUOTE_NOT_FOUND';
  } else if (/ML_P1_S2_MISSING_TOKEN/i.test(msg)) {
    err.code = 'ML_P1_S2_MISSING_TOKEN';
  } else if (/ML_P1_S2_QUOTE_EXPIRED/i.test(msg)) {
    err.code = 'ML_P1_S2_QUOTE_EXPIRED';
  } else if (/ML_P1_S2_UNKNOWN_ACTION/i.test(msg)) {
    err.code = 'ML_P1_S2_UNKNOWN_ACTION';
  } else {
    err.code = error?.code || 'ML_P1_S2_RPC_ERROR';
  }
  err.cause = error;
  return err;
}

function normalizeRpcResult(data) {
  const payload = data && typeof data === 'object' ? data : {};
  return {
    quote: payload.quote || null,
    action: payload.action,
    superseded: payload.superseded || null,
    correlationId: payload.correlationId || null,
    audit: { ok: true, server: true },
    idempotent: Boolean(payload.idempotent),
    jobCreated: false, // Slice 2 hard stop — never claim job create
  };
}

/**
 * @param {object} deps
 * @param {import('@supabase/supabase-js').SupabaseClient} deps.supabase
 */
export function createMlP1S2QuoteLifecycleService(deps) {
  const supabase = deps.supabase;
  if (!supabase) throw new Error('mlP1S2QuoteLifecycleService requires supabase');

  async function callLifecycleRpc(args) {
    const {
      action,
      quoteId,
      sessionTenantId = null,
      urlTenantId = null,
      reasonCode = null,
      rejectionReason = null,
      approvalMethod = null,
      correlationId = null,
      validUntil = null,
      actorRole = null,
    } = args || {};

    // Tenant pre-check (session required) — server also enforces JWT tenant.
    resolveWriteTenantId({ sessionTenantId, urlTenantId });
    void normalizeActorRole(actorRole); // UI may pass role; server ignores it

    const { data, error } = await supabase.rpc('ml_p1_s2_quote_lifecycle', {
      p_action: action,
      p_quote_id: quoteId,
      p_reason_code: reasonCode,
      p_rejection_reason: rejectionReason,
      p_approval_method: approvalMethod,
      p_valid_until: validUntil,
      p_correlation_id: correlationId,
    });
    if (error) throw mapRpcError(error);
    return normalizeRpcResult(data);
  }

  async function approveByPublicToken({
    publicToken,
    correlationId = null,
    approvalMethod = 'public_token',
  }) {
    const { data, error } = await supabase.rpc('ml_p1_s2_quote_approve_public', {
      p_public_token: publicToken,
      p_correlation_id: correlationId,
      p_approval_method: approvalMethod,
    });
    if (error) throw mapRpcError(error);
    return normalizeRpcResult(data);
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
    return data;
  }

  return {
    issueQuote: (args) => callLifecycleRpc({ ...args, action: 'issue' }),
    approveQuote: (args) =>
      callLifecycleRpc({
        ...args,
        action: 'approve',
        approvalMethod: args.approvalMethod || 'admin_break_glass',
      }),
    rejectQuote: (args) => callLifecycleRpc({ ...args, action: 'reject' }),
    expireQuote: (args) => callLifecycleRpc({ ...args, action: 'expire' }),
    reviseQuote: (args) => callLifecycleRpc({ ...args, action: 'revise' }),
    approveByPublicToken,
    assertTransitionAllowed,
    assertQuoteMutableForEdit,
    loadQuote,
  };
}

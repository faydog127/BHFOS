/**
 * ML-P1 Slice 1 — Canonical draft quote service (`quotes` + `quote_items` only).
 * Status forced to `draft`. Idempotent create via client_request_id in correlation.
 * No migrations. No issue/approve/job/invoice.
 */

import {
  assertStableCustomerLink,
  resolveP1ServiceAddress,
} from '../lib/mlP1S1Identity.js';
import {
  buildMoneyStateAuditEvent,
  ML_P1_S1_EVENT_TYPES,
} from '../lib/mlP1S1AuditEvents.js';
import { assertTenantMatch, resolveWriteTenantId } from '../lib/mlP1S1Tenant.js';
import {
  buildDuplicateCustomerFilters,
  sortDuplicateCandidates,
} from '../lib/mlP1S1DuplicateCustomer.js';
import { endKpiTimer, incrementKpi, startKpiTimer } from '../lib/mlP1S1Kpi.js';

const DRAFT_STATUS = 'draft';

/** Process-local in-flight locks to collapse concurrent double-submit for same idem key. */
const inflightDraftCreates = new Map();

function newCorrelationId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return `s1-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * @param {object} deps
 * @param {import('@supabase/supabase-js').SupabaseClient} deps.supabase
 */
export function createMlP1S1QuoteDraftService(deps) {
  const supabase = deps.supabase;
  if (!supabase) throw new Error('mlP1S1QuoteDraftService requires supabase');

  async function emitAudit(row) {
    try {
      const { error } = await supabase.from('events').insert(row);
      if (error) {
        incrementKpi('audit_emit_fail');
        return { ok: false, error };
      }
      incrementKpi('audit_emit_ok');
      return { ok: true };
    } catch (error) {
      incrementKpi('audit_emit_fail');
      return { ok: false, error };
    }
  }

  /**
   * Find existing draft by idempotency key stored in notes prefix or customer_notes.
   * Uses correlation marker `s1-idem:` in notes field when present.
   */
  async function findDraftByIdempotency({ tenantId, leadId, idempotencyKey }) {
    if (!idempotencyKey) return null;
    const marker = `s1-idem:${idempotencyKey}`;
    const { data, error } = await supabase
      .from('quotes')
      .select('id, status, lead_id, tenant_id, notes, service_address, total, created_at')
      .eq('tenant_id', tenantId)
      .eq('lead_id', leadId)
      .eq('status', DRAFT_STATUS)
      .ilike('notes', `%${marker}%`)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    return data || null;
  }

  /**
   * Create or return existing draft quote (idempotent).
   */
  async function createDraftQuote(args) {
    const {
      lead,
      form = null,
      lineItems = [],
      sessionTenantId = null,
      urlTenantId = null,
      defaultTenantId = null,
      actorId = null,
      actorRole = 'office',
      idempotencyKey = null,
      correlationId = null,
    } = args || {};

    startKpiTimer('create_draft_quote');

    const tenantId = resolveWriteTenantId({
      sessionTenantId,
      urlTenantId,
      defaultTenantId,
    });

    if (!lead?.id) {
      const err = new Error('DENY: lead required for draft quote');
      err.code = 'ML_P1_S1_MISSING_LEAD';
      throw err;
    }
    assertTenantMatch(lead.tenant_id, tenantId);

    const serviceAddress = resolveP1ServiceAddress({ lead, form });
    if (!serviceAddress) {
      const err = new Error('DENY: service address required for draft quote');
      err.code = 'ML_P1_S1_MISSING_ADDRESS';
      throw err;
    }

    const corr = correlationId || newCorrelationId();
    const idem = idempotencyKey || corr;
    const lockKey = `${tenantId}:${lead.id}:${idem}`;

    if (inflightDraftCreates.has(lockKey)) {
      incrementKpi('draft_idempotent_inflight');
      const shared = await inflightDraftCreates.get(lockKey);
      endKpiTimer('create_draft_quote');
      return { ...shared, idempotent: true };
    }

    const run = (async () => {
      const existing = await findDraftByIdempotency({
        tenantId,
        leadId: lead.id,
        idempotencyKey: idem,
      });
      if (existing) {
        incrementKpi('draft_idempotent_hit');
        return {
          quote: existing,
          items: [],
          idempotent: true,
          correlationId: corr,
          audit: { skipped: true, reason: 'idempotent_reuse' },
        };
      }

      const marker = `s1-idem:${idem}`;
      const subtotal = (lineItems || []).reduce(
        (sum, item) => sum + Number(item.quantity || 1) * Number(item.unit_price || item.price || 0),
        0,
      );

      const quotePayload = {
        lead_id: lead.id,
        tenant_id: tenantId,
        status: DRAFT_STATUS,
        service_address: serviceAddress,
        customer_name:
          [lead.first_name, lead.last_name].filter(Boolean).join(' ') || lead.company || null,
        customer_email: lead.email || null,
        customer_phone: lead.phone || null,
        subtotal,
        total: subtotal,
        tax: 0,
        notes: marker,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      assertStableCustomerLink(quotePayload);

      const { data: quote, error: quoteError } = await supabase
        .from('quotes')
        .insert([quotePayload])
        .select('*')
        .single();
      if (quoteError) throw quoteError;

      let items = [];
      if (lineItems?.length) {
        const rows = lineItems.map((item, index) => {
          const qty = Number(item.quantity || 1);
          const unit = Number(item.unit_price || item.price || 0);
          return {
            quote_id: quote.id,
            description: item.description || item.name || `Item ${index + 1}`,
            quantity: qty,
            unit_price: unit,
            total_price: qty * unit,
          };
        });
        const { data: insertedItems, error: itemsError } = await supabase
          .from('quote_items')
          .insert(rows)
          .select('*');
        if (itemsError) {
          await supabase.from('quotes').delete().eq('id', quote.id).eq('tenant_id', tenantId);
          throw itemsError;
        }
        items = insertedItems || [];
      }

      const auditRow = buildMoneyStateAuditEvent({
        tenantId,
        recordId: quote.id,
        recordType: 'quote',
        actorId,
        actorRole,
        previousState: null,
        newState: DRAFT_STATUS,
        sourceAction: 'ml_p1_s1.create_draft_quote',
        correlationId: corr,
        success: true,
        related: { quote_id: quote.id, lead_id: lead.id },
        eventType: ML_P1_S1_EVENT_TYPES.DRAFT_CREATED,
      });
      const audit = await emitAudit(auditRow);

      incrementKpi('draft_created');

      return {
        quote,
        items,
        idempotent: false,
        correlationId: corr,
        audit,
      };
    })();

    inflightDraftCreates.set(lockKey, run);
    try {
      const result = await run;
      endKpiTimer('create_draft_quote');
      return result;
    } finally {
      inflightDraftCreates.delete(lockKey);
    }
  }

  /**
   * Update draft only (status must remain draft). Rejects non-draft.
   */
  async function updateDraftQuote({
    quoteId,
    sessionTenantId = null,
    urlTenantId = null,
    tenantId: _ignoredCallerTenant = null,
    patch = {},
    lineItems = null,
    actorId = null,
    actorRole = 'office',
    correlationId = null,
  }) {
    void _ignoredCallerTenant;
    const tenantId = resolveWriteTenantId({ sessionTenantId, urlTenantId });

    const { data: existing, error: loadError } = await supabase
      .from('quotes')
      .select('*')
      .eq('id', quoteId)
      .eq('tenant_id', tenantId)
      .maybeSingle();
    if (loadError) throw loadError;
    if (!existing) {
      const err = new Error('DENY: draft quote not found for tenant');
      err.code = 'ML_P1_S1_QUOTE_NOT_FOUND';
      throw err;
    }
    assertTenantMatch(existing.tenant_id, tenantId);
    if (String(existing.status || '').toLowerCase() !== DRAFT_STATUS) {
      const err = new Error('DENY: Slice 1 may only update draft quotes');
      err.code = 'ML_P1_S1_NOT_DRAFT';
      throw err;
    }

    const next = {
      ...patch,
      status: DRAFT_STATUS,
      updated_at: new Date().toISOString(),
    };
    delete next.id;
    delete next.tenant_id;
    delete next.lead_id; // never allow lead nulling / reassignment via S1 update

    const { data: quote, error: updError } = await supabase
      .from('quotes')
      .update(next)
      .eq('id', quoteId)
      .eq('tenant_id', tenantId)
      .eq('status', DRAFT_STATUS)
      .select('*')
      .single();
    if (updError) throw updError;

    let items = null;
    if (Array.isArray(lineItems)) {
      await supabase.from('quote_items').delete().eq('quote_id', quoteId);
      if (lineItems.length) {
        const rows = lineItems.map((item, index) => {
          const qty = Number(item.quantity || 1);
          const unit = Number(item.unit_price || item.price || 0);
          return {
            quote_id: quoteId,
            description: item.description || item.name || `Item ${index + 1}`,
            quantity: qty,
            unit_price: unit,
            total_price: qty * unit,
          };
        });
        const { data: inserted, error: itemsError } = await supabase
          .from('quote_items')
          .insert(rows)
          .select('*');
        if (itemsError) throw itemsError;
        items = inserted;
      } else {
        items = [];
      }
    }

    const corr = correlationId || newCorrelationId();
    const auditRow = buildMoneyStateAuditEvent({
      tenantId,
      recordId: quoteId,
      recordType: 'quote',
      actorId,
      actorRole,
      previousState: DRAFT_STATUS,
      newState: DRAFT_STATUS,
      sourceAction: 'ml_p1_s1.update_draft_quote',
      correlationId: corr,
      success: true,
      related: { quote_id: quoteId, lead_id: quote.lead_id },
      eventType: ML_P1_S1_EVENT_TYPES.DRAFT_UPDATED,
    });
    await emitAudit(auditRow);

    return { quote, items, correlationId: corr };
  }

  async function findDuplicateCustomers({
    sessionTenantId = null,
    urlTenantId = null,
    tenantId: _ignored = null,
    input,
    limit = 8,
  }) {
    void _ignored;
    const tenantId = resolveWriteTenantId({ sessionTenantId, urlTenantId });
    const built = buildDuplicateCustomerFilters(input);
    if (!built.ok) return { ok: false, reason: built.reason, matches: [] };
    const { data, error } = await supabase
      .from('leads')
      .select(
        'id, tenant_id, first_name, last_name, company, phone, email, address, property_formatted_address',
      )
      .eq('tenant_id', tenantId)
      .or(built.filters.join(','))
      .limit(limit);
    if (error) throw error;
    const matches = sortDuplicateCandidates(input, data || []);
    if (matches.length) incrementKpi('duplicate_customer_hit');
    return { ok: true, matches, tenantId };
  }

  return {
    createDraftQuote,
    updateDraftQuote,
    findDuplicateCustomers,
    findDraftByIdempotency,
  };
}

export { DRAFT_STATUS as ML_P1_S1_DRAFT_STATUS };

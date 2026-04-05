import { supabaseAdmin } from '../_lib/supabaseAdmin.ts';
import { getTenantIdFromClaims, getVerifiedClaims } from '../_shared/auth.ts';
import { buildCorsHeaders, readJson } from '../_shared/publicUtils.ts';
import { closeFollowUpTasks } from '../_shared/taskUtils.ts';
import { logMoneyLoopEvent } from '../_shared/moneyLoopUtils.ts';

const PAYMENT_ROLES = new Set(['tech', 'technician', 'dispatcher', 'admin', 'super_admin']);

const GENERATED_COLUMN_RE = /column "([^"]+)" is a generated column/i;
const COLUMN_NAME_RE = /column "([^"]+)"/i;
const MISSING_COLUMN_CACHE_RE = /Could not find the '([^']+)' column/i;

const respondJson = (body: Record<string, unknown>, status: number, headers: Record<string, string>) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...headers, 'Content-Type': 'application/json' },
  });

const asNullableNumber = (value: unknown) => {
  if (value === null) return null;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
};

const asString = (value: unknown): string => (typeof value === 'string' ? value.trim() : '');

const asNullableString = (value: unknown) => {
  if (value === null) return null;
  const text = asString(value);
  return text || null;
};

const ensureCanRecordPayment = async (tenantId: string, userId: string | null) => {
  if (!userId) return false;

  // Prefer tenant-scoped role lookup when tenant_id exists; fall back to global if not present (older schemas).
  let { data, error } = await supabaseAdmin
    .from('app_user_roles')
    .select('role')
    .eq('user_id', userId)
    .eq('tenant_id', tenantId);

  if (error) {
    const retriableColumn = getRetriableColumnName(error);
    if (retriableColumn === 'tenant_id') {
      ({ data, error } = await supabaseAdmin
        .from('app_user_roles')
        .select('role')
        .eq('user_id', userId));
    }
  }

  if (error) {
    console.error('invoice-update-status role lookup failed:', error.message || error);
    return false;
  }

  const roles = (data ?? []).map((row: { role?: string | null }) => asString(row?.role).toLowerCase()).filter(Boolean);
  return roles.some((role) => PAYMENT_ROLES.has(role));
};

const normalizePaymentMethod = (value: unknown) => {
  const method = asString(value).toLowerCase();
  if (!method) return 'offline';
  if (method === 'manual') return 'offline';
  if (method === 'card') return 'offline_card';
  return method;
};

const normalizeManualReference = (value: unknown) => {
  const raw = asString(value);
  if (!raw) return { raw: null, normalized: null };
  const normalized = raw.replace(/\s+/g, ' ').trim();
  return { raw, normalized };
};

const validateManualReference = (reference: string | null) => {
  if (!reference) return { ok: false, reason: 'payment_reference is required for offline/manual payments.' };

  const normalized = reference.replace(/\s+/g, ' ').trim();
  if (normalized.length < 4) return { ok: false, reason: 'payment_reference is too short.' };

  const lower = normalized.toLowerCase();
  const banned = new Set(['cash', 'paid', 'manual', 'offline', 'na', 'n/a', 'none', 'unknown', 'test']);
  if (banned.has(lower)) return { ok: false, reason: 'payment_reference is not allowed (low-signal value).' };

  if (/^\d{1,3}$/.test(normalized)) return { ok: false, reason: 'payment_reference is not allowed (low-signal numeric value).' };

  return { ok: true, normalized };
};

const buildMethodWithReference = (method: string, reference: string | null) => {
  if (!reference) return method;
  if (method === 'check') return `check:${reference}`;
  return method;
};

const EPS = 0.009;
const NON_FINANCIAL_STATUSES = new Set(['draft', 'sent']);
const FINANCIAL_STATUSES = new Set(['paid', 'partial', 'partially_paid', 'void', 'voided', 'refunded']);

const getRetriableColumnName = (error: { code?: string | null; message?: string | null; details?: string | null }) => {
  const code = String(error?.code || '');
  if (code === '428C9') {
    const detailMatch = String(error?.details || '').match(GENERATED_COLUMN_RE);
    if (detailMatch?.[1]) return detailMatch[1];
  }

  if (code === '42703' || code === 'PGRST204') {
    const messageMatch = String(error?.message || '').match(COLUMN_NAME_RE);
    if (messageMatch?.[1]) return messageMatch[1];

    const cacheMatch = String(error?.message || '').match(MISSING_COLUMN_CACHE_RE);
    if (cacheMatch?.[1]) return cacheMatch[1];
  }

  return null;
};

const updateInvoiceRow = async (invoiceId: string, tenantId: string, patch: Record<string, unknown>) => {
  let nextPatch = { ...patch };

  for (let attempt = 0; attempt < 6; attempt += 1) {
    const { data, error } = await supabaseAdmin
      .from('invoices')
      .update(nextPatch)
      .eq('id', invoiceId)
      .eq('tenant_id', tenantId)
      .select('id, status, tenant_id, total_amount, amount_paid, balance_due, paid_at, sent_at')
      .maybeSingle();

    if (!error) return { data, error: null };

    const retriableColumn = getRetriableColumnName(error);
    if (!retriableColumn || !Object.prototype.hasOwnProperty.call(nextPatch, retriableColumn)) {
      return { data: null, error };
    }

    delete nextPatch[retriableColumn];
  }

  return {
    data: null,
    error: { message: 'Failed to update invoice after removing incompatible columns.' },
  };
};

Deno.serve(async (req) => {
  const origin = req.headers.get('origin');
  const cors = buildCorsHeaders(origin);

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: cors.headers });
  }

  if (req.method !== 'POST') {
    return respondJson({ error: 'Method not allowed' }, 405, cors.headers);
  }

  let claims;
  try {
    ({ claims } = await getVerifiedClaims(req));
  } catch (error) {
    return respondJson({ error: String(error?.message ?? error) }, 401, cors.headers);
  }

  const jwtTenantId = getTenantIdFromClaims(claims);
  if (!jwtTenantId) {
    return respondJson({ error: 'Unauthorized: missing tenant claim' }, 403, cors.headers);
  }

  const body = await readJson(req);
  const invoiceId = body?.invoice_id || null;
  const bodyTenantId = body?.tenant_id || null;
  const status = body?.status || null;
  const paymentAmountRaw = body?.payment_amount ?? null;
  const paymentMethodRaw = body?.payment_method ?? null;
  const paymentReferenceRaw = body?.payment_reference ?? null;
  const sourceScreen = asString(body?.source_screen) || 'unknown';

  if (bodyTenantId && bodyTenantId !== jwtTenantId) {
    return respondJson({ error: 'Tenant mismatch' }, 403, cors.headers);
  }

  if (!invoiceId) {
    return respondJson({ error: 'invoice_id is required' }, 400, cors.headers);
  }

  const paymentAmount = asNullableNumber(paymentAmountRaw);
  const isPaymentWrite = typeof paymentAmount === 'number' && Number.isFinite(paymentAmount) && paymentAmount > 0;

  if (!isPaymentWrite && !status) {
    return respondJson({ error: 'status is required when payment_amount is not provided' }, 400, cors.headers);
  }

  const { data: existingInvoice, error: invoiceError } = await supabaseAdmin
    .from('invoices')
    .select('id, status, tenant_id, total_amount, amount_paid, paid_at, sent_at, balance_due, payment_method, job_id, quote_id, lead_id')
    .eq('id', invoiceId)
    .eq('tenant_id', jwtTenantId)
    .maybeSingle();

  if (invoiceError || !existingInvoice) {
    return respondJson({ error: invoiceError?.message || 'Invoice not found' }, 404, cors.headers);
  }

  const nowIso = new Date().toISOString();
  const totalAmount = asNullableNumber(existingInvoice.total_amount) ?? 0;

  // Payment write path (canonical for offline payments).
  if (isPaymentWrite) {
    const canRecordPayment = await ensureCanRecordPayment(jwtTenantId, asString(claims?.sub) || null);
    if (!canRecordPayment) {
      return respondJson({ error: 'Permission denied: role required to record offline payment.' }, 403, cors.headers);
    }

    const method = normalizePaymentMethod(paymentMethodRaw);
    const { raw: referenceRaw, normalized: referenceNormalized } = normalizeManualReference(paymentReferenceRaw);
    const referenceValidation = validateManualReference(referenceNormalized);
    if (!referenceValidation.ok) {
      return respondJson({ error: referenceValidation.reason }, 400, cors.headers);
    }
    const reference = referenceValidation.normalized ?? null;
    const methodWithRef = buildMethodWithReference(method, reference);

    const currentStatus = asString(existingInvoice.status).toLowerCase() || 'draft';

    let autoSent = false;
    // Some guardrails block draft -> paid/partial directly. Move through sent first.
    if (currentStatus === 'draft') {
      const sentPatch: Record<string, unknown> = {
        status: 'sent',
        sent_at: existingInvoice.sent_at || nowIso,
        release_approved: true,
        release_approved_at: nowIso,
        release_approved_by: null,
        updated_at: nowIso,
      };

      const sentResult = await updateInvoiceRow(invoiceId, jwtTenantId, sentPatch);
      if (sentResult.error) {
        return respondJson({ error: sentResult.error?.message || 'Failed to move invoice to sent before payment.' }, 409, cors.headers);
      }
      autoSent = true;
    }

    const actorUserId = asString(claims?.sub) || null;
    const rpcResult = await supabaseAdmin.rpc('record_offline_manual_payment', {
      p_tenant_id: jwtTenantId,
      p_invoice_id: invoiceId,
      p_amount: paymentAmount,
      p_payment_method: methodWithRef,
      p_manual_reference_raw: referenceRaw || reference || '',
      p_actor_user_id: actorUserId,
      p_request_id: sourceScreen,
    });

    if (rpcResult.error) {
      const message = rpcResult.error.message || 'Failed to record offline payment.';
      const statusCode =
        message.includes('MANUAL_REFERENCE') || message.includes('AMOUNT_') ? 400 :
        message.includes('LEGACY_MONEY_STATE_MIGRATION_REQUIRED') ? 409 :
        500;
      return respondJson({ error: message }, statusCode, cors.headers);
    }

    const row = Array.isArray(rpcResult.data) ? rpcResult.data[0] : rpcResult.data;
    const duplicate = Boolean(row?.duplicate);
    const transactionId = row?.transaction_id || null;

    const { data: invoice, error: refreshError } = await supabaseAdmin
      .from('invoices')
      .select('id, status, tenant_id, total_amount, amount_paid, balance_due, paid_at, sent_at, payment_method, job_id, quote_id, lead_id, settlement_status, last_payment_at')
      .eq('id', invoiceId)
      .eq('tenant_id', jwtTenantId)
      .maybeSingle();

    if (refreshError || !invoice) {
      return respondJson({ error: refreshError?.message || 'Failed to refresh invoice after payment.' }, 500, cors.headers);
    }

    if (existingInvoice.job_id) {
      const jobPatch: Record<string, unknown> = {
        payment_status: String(invoice.status || '').toLowerCase() || null,
        amount_paid: invoice.amount_paid ?? null,
        payment_method: invoice.payment_method ?? methodWithRef,
        updated_at: nowIso,
      };
      const { error: jobError } = await supabaseAdmin
        .from('jobs')
        .update(jobPatch)
        .eq('tenant_id', jwtTenantId)
        .eq('id', existingInvoice.job_id);
      if (jobError) {
        console.error('invoice-update-status payment mirror to job failed:', jobError.message || jobError);
      }
    }

    if (!duplicate) {
      await logMoneyLoopEvent({
        tenantId: jwtTenantId,
        entityType: 'payment',
        entityId: invoiceId,
        eventType: 'OfflinePaymentRecorded',
        actorType: 'internal_user',
        actorId: actorUserId,
        payload: {
          invoice_id: invoiceId,
          job_id: existingInvoice.job_id ?? null,
          lead_id: existingInvoice.lead_id ?? null,
          transaction_id: transactionId,
          amount_applied: paymentAmount,
          invoice_total: totalAmount,
          status_before: currentStatus,
          status_after: invoice.status,
          payment_method: methodWithRef,
          payment_reference: reference,
          source_screen: sourceScreen,
          auto_sent: autoSent,
          auto_sent_at: autoSent ? nowIso : null,
        },
      });
    }

    if (String(invoice.status || '').toLowerCase() === 'paid') {
      await closeFollowUpTasks({
        tenantId: invoice.tenant_id || jwtTenantId,
        sourceType: 'invoice',
        sourceId: invoice.id,
      });
    }

    return respondJson(
      {
        ok: true,
        duplicate,
        transaction_id: transactionId,
        financial_effect_created: !duplicate,
        event_emitted: !duplicate,
        invoice,
      },
      200,
      cors.headers,
    );
  }

  // Legacy status-only path (non-payment).
  const normalizedStatus = String(status).trim().toLowerCase();

  if (FINANCIAL_STATUSES.has(normalizedStatus)) {
    return respondJson(
      {
        error:
          'Financial settlement statuses (paid/partial/void) must be set by the canonical payment path (provide payment_amount) or an admin accounting action.',
      },
      400,
      cors.headers,
    );
  }

  if (!NON_FINANCIAL_STATUSES.has(normalizedStatus)) {
    return respondJson(
      {
        error: `Unsupported invoice status transition via status-only update: "${normalizedStatus}". Allowed: draft, sent.`,
      },
      400,
      cors.headers,
    );
  }

  const nextPatch: Record<string, unknown> = { status: normalizedStatus };

  if (normalizedStatus === 'sent' && !existingInvoice.sent_at) {
    nextPatch.sent_at = nowIso;
  }

  const { data: invoice, error } = await updateInvoiceRow(invoiceId, jwtTenantId, nextPatch);

  if (error || !invoice) {
    return respondJson({ error: error?.message || 'Invoice not found' }, 404, cors.headers);
  }

  return respondJson({ invoice }, 200, cors.headers);
});

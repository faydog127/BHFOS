import { corsHeaders } from './cors.ts';
import { getTenantIdFromClaims, getVerifiedClaims } from '../_shared/auth.ts';
import { supabaseAdmin } from '../_shared/supabaseAdmin.ts';
import {
  loadLeadDeliveryProfile,
  normalizeRequestedDeliveryChannel,
  resolveDocumentDelivery,
} from '../_shared/documentDelivery.ts';
import { sendReceiptForPaidInvoice } from '../_shared/receiptUtils.ts';

type JsonObject = Record<string, unknown>;

type InvoiceRow = {
  id: string;
  tenant_id: string | null;
  lead_id: string | null;
  customer_name: string | null;
  customer_email: string | null;
  customer_phone: string | null;
  invoice_number: string | number | null;
  paid_at: string | null;
  amount_paid: number | string | null;
  status: string | null;
  public_token: string | null;
  leads?: {
    first_name?: string | null;
    last_name?: string | null;
    email?: string | null;
    phone?: string | null;
  } | {
    first_name?: string | null;
    last_name?: string | null;
    email?: string | null;
    phone?: string | null;
  }[] | null;
};

const respondJson = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

const parseJson = async (req: Request): Promise<JsonObject> => {
  try {
    const parsed = await req.json();
    return parsed && typeof parsed === 'object' ? (parsed as JsonObject) : {};
  } catch {
    return {};
  }
};

const asString = (value: unknown) => (typeof value === 'string' ? value.trim() : '');

const asNumber = (value: unknown): number => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return 0;
};

const normalizeLead = (lead: InvoiceRow['leads']) => {
  if (!lead) return null;
  if (Array.isArray(lead)) return lead[0] ?? null;
  return lead;
};

const normalizeReceiptRequestChannel = (value: unknown): 'email' | 'sms' | 'both' | null => {
  const normalized = asString(value).toLowerCase();
  if (!normalized) return null;
  if (['sms', 'text', 'txt'].includes(normalized)) return 'sms';
  if (['email', 'mail'].includes(normalized)) return 'email';
  if (normalized === 'both') return 'both';
  return null;
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return respondJson({ error: 'Method not allowed' }, 405);
  }

  try {
    const body = await parseJson(req);
    const invoiceId = asString(body.invoice_id);
    const jobId = asString(body.job_id);
    const bodyTenantId = asString(body.tenant_id);

    let claims: Record<string, unknown> | null = null;
    try {
      const verified = await getVerifiedClaims(req);
      claims = verified.claims as Record<string, unknown>;
    } catch {
      claims = null;
    }

    const claimsTenantId = claims ? getTenantIdFromClaims(claims) : null;
    const effectiveTenantId = claimsTenantId || bodyTenantId || null;

    let invoiceQuery = supabaseAdmin
      .from('invoices')
      .select(`
        id,
        tenant_id,
        lead_id,
        customer_name,
        customer_email,
        customer_phone,
        invoice_number,
        paid_at,
        amount_paid,
        status,
        public_token,
        leads (
          first_name,
          last_name,
          email,
          phone
        )
      `);

    if (invoiceId) {
      invoiceQuery = invoiceQuery.eq('id', invoiceId);
    } else if (jobId) {
      invoiceQuery = invoiceQuery.eq('job_id', jobId).order('created_at', { ascending: false }).limit(1);
    } else {
      return respondJson({ error: 'invoice_id or job_id is required' }, 400);
    }

    if (effectiveTenantId) {
      invoiceQuery = invoiceQuery.eq('tenant_id', effectiveTenantId);
    }

    const { data: invoiceRaw, error: invoiceError } = await invoiceQuery.maybeSingle();
    const invoice = invoiceRaw as InvoiceRow | null;

    if (invoiceError || !invoice) {
      return respondJson({ error: 'Receipt invoice not found' }, 404);
    }

    if (claimsTenantId && invoice.tenant_id && claimsTenantId !== invoice.tenant_id) {
      return respondJson({ error: 'Forbidden' }, 403);
    }

    const isPaid =
      asString(invoice.status).toLowerCase() === 'paid' ||
      Boolean(invoice.paid_at) ||
      asNumber(invoice.amount_paid) > 0;

    if (!isPaid) {
      return respondJson({ error: 'Receipts can only be sent for paid invoices', code: 'INVOICE_NOT_PAID' }, 400);
    }

    const requestedReceiptChannel = normalizeReceiptRequestChannel(
      body.delivery_channel ?? body.send_via ?? body.channel,
    );
    const requestedDeliveryChannel = requestedReceiptChannel === 'both'
      ? null
      : normalizeRequestedDeliveryChannel(requestedReceiptChannel);
    const lead = normalizeLead(invoice.leads);
    const deliveryProfile = await loadLeadDeliveryProfile({
      tenantId: invoice.tenant_id || effectiveTenantId,
      leadId: invoice.lead_id,
    });
    const deliveryResolution = resolveDocumentDelivery({
      requestedChannel: requestedDeliveryChannel,
      email:
        asString(body.to_email) ||
        asString(body.email) ||
        asString(invoice.customer_email) ||
        asString(lead?.email) ||
        deliveryProfile?.email ||
        null,
      phone:
        asString(body.to_phone) ||
        asString(body.phone) ||
        asString(invoice.customer_phone) ||
        asString(lead?.phone) ||
        deliveryProfile?.phone ||
        null,
      preferredDocumentDelivery: deliveryProfile?.preferredDocumentDelivery ?? null,
      preferredContactMethod: deliveryProfile?.preferredContactMethod ?? null,
      smsOptOut: deliveryProfile?.smsOptOut ?? false,
    });

    const canDeliverBoth =
      requestedReceiptChannel === 'both' &&
      deliveryResolution.canEmail &&
      deliveryResolution.canSms;

    if (!deliveryResolution.deliveryChannel && !canDeliverBoth) {
      return respondJson(
        {
          error: 'No deliverable customer contact found for receipt',
          code: 'NO_DELIVERABLE_CONTACT',
          missing_fields: deliveryResolution.missingFields,
          requested_delivery_channel: requestedReceiptChannel,
          delivery_resolution_reason: deliveryResolution.resolutionReason,
        },
        400,
      );
    }

    const sendResult = await sendReceiptForPaidInvoice({
      tenantId: invoice.tenant_id || effectiveTenantId,
      invoice,
      paidAt: invoice.paid_at,
      deliveryChannel: requestedReceiptChannel,
      recipientEmail: asString(body.to_email) || asString(body.email) || null,
      recipientPhone: asString(body.to_phone) || asString(body.phone) || null,
      allowResend: true,
    });

    return respondJson({
      success: true,
      invoice_id: invoice.id,
      status: sendResult.status,
      reason: 'reason' in sendResult ? sendResult.reason : null,
      requested_delivery_channel: requestedReceiptChannel,
      delivery_channel:
        canDeliverBoth
          ? 'both'
          : sendResult.status === 'sent_sms'
            ? 'sms'
            : deliveryResolution.deliveryChannel,
      delivery_resolution_reason: deliveryResolution.resolutionReason,
      missing_fields: deliveryResolution.missingFields,
      receipt_email: 'receiptEmail' in sendResult ? sendResult.receiptEmail ?? null : null,
      receipt_phone: 'receiptPhone' in sendResult ? sendResult.receiptPhone ?? null : null,
      sms_error: 'smsError' in sendResult ? sendResult.smsError ?? null : null,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal error';
    console.error('send-receipt failed:', error);
    return respondJson({ error: message }, 500);
  }
});

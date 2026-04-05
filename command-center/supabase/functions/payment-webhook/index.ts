import Stripe from 'https://esm.sh/stripe@14.25.0?target=deno';
import { supabaseAdmin } from '../_lib/supabaseAdmin.ts';
import { logMoneyLoopEvent, hasEvent, createMoneyLoopTask, convertContactToCustomer } from '../_shared/moneyLoopUtils.ts';
import { sendReceiptForPaidInvoice } from '../_shared/receiptUtils.ts';
import { closeFollowUpTasks } from '../_shared/taskUtils.ts';

const respondJson = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

const formatError = (error: unknown) => (error instanceof Error ? error.message : String(error));

const getStripeEvent = async (req: Request) => {
  const allowTestBypass =
    req.headers.get('x-test-webhook') === '1' &&
    /^(true|1)$/i.test(Deno.env.get('TEST_MODE') ?? '') &&
    /^(?:http:\/\/)?(?:127\.0\.0\.1|localhost)(?::\d+)?/i.test(Deno.env.get('SUPABASE_URL') ?? '');

  if (allowTestBypass) {
    return (await req.json()) as Stripe.Event;
  }

  const signature = req.headers.get('stripe-signature');
  const secret = (Deno.env.get('STRIPE_WEBHOOK_SECRET') ?? '').trim();

  if (!signature || !secret) {
    throw new Error('Missing webhook signature or secret');
  }

  const payload = await req.text();
  const stripe = new Stripe((Deno.env.get('STRIPE_SECRET_KEY') ?? '').trim(), { apiVersion: '2024-06-20' });

  return await stripe.webhooks.constructEventAsync(payload, signature, secret);
};

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return respondJson({ error: 'Method not allowed' }, 405);
  }

  let event: Stripe.Event;
  try {
    event = await getStripeEvent(req);
  } catch (err) {
    return respondJson({ error: 'Invalid signature', details: formatError(err) }, 400);
  }

  if (!event?.type) {
    return respondJson({ error: 'Invalid event' }, 400);
  }

  const eventObject = (event.data?.object ?? null) as Record<string, unknown> | null;
  // Canonical provider payment id (financial idempotency key):
  // - prefer PaymentIntent id when present (charge.* events include payment_intent reference)
  // - fall back to object id when no better linkage exists
  const paymentIntentRef = typeof eventObject?.payment_intent === 'string' ? eventObject.payment_intent : null;
  const objectId = typeof eventObject?.id === 'string' ? eventObject.id : null;
  const providerPaymentId = paymentIntentRef ?? objectId;

  if (!providerPaymentId) {
    return respondJson({ received: true, ignored: 'missing_provider_payment_id' }, 200);
  }

  const metadata = (eventObject?.metadata ?? null) as Record<string, unknown> | null;
  const invoiceIdFromMetadata = typeof metadata?.invoice_id === 'string' ? metadata.invoice_id : null;
  const amountCentsRaw =
    typeof eventObject?.amount_received === 'number'
      ? eventObject.amount_received
      : typeof eventObject?.amount === 'number'
        ? eventObject.amount
        : null;
  const amountCents = typeof amountCentsRaw === 'number' && Number.isFinite(amountCentsRaw) ? Math.trunc(amountCentsRaw) : 0;
  const currency = typeof eventObject?.currency === 'string' ? eventObject.currency : 'usd';

  const FINAL_SUCCESS_EVENTS = new Set(['payment_intent.succeeded', 'charge.succeeded']);
  const NON_FINAL_EVENTS = new Set(['payment_intent.payment_failed']);
  const REVERSAL_EVENTS = new Set(['charge.refunded', 'charge.refund.updated', 'payment_intent.canceled']);

  if (REVERSAL_EVENTS.has(event.type)) {
    return respondJson({ received: true, ignored: 'reversal_not_supported' }, 200);
  }

  if (!FINAL_SUCCESS_EVENTS.has(event.type) && !NON_FINAL_EVENTS.has(event.type)) {
    // Record receipt for observability (network idempotency only).
    await supabaseAdmin.from('stripe_webhook_events').insert({
      event_id: event.id,
      event_type: event.type,
      payment_intent_id: providerPaymentId,
      provider_payment_id: providerPaymentId,
      payload: event as unknown as Record<string, unknown>,
      processed_status: 'ignored_unsupported',
      processed_at: new Date().toISOString(),
    }).catch(() => null);

    return respondJson({ received: true, ignored: 'unsupported_event' }, 200);
  }

  if (NON_FINAL_EVENTS.has(event.type)) {
    const { error: receiptError } = await supabaseAdmin.from('stripe_webhook_events').insert({
      event_id: event.id,
      event_type: event.type,
      payment_intent_id: providerPaymentId,
      provider_payment_id: providerPaymentId,
      payload: event as unknown as Record<string, unknown>,
      processed_status: 'ignored_nonfinal',
      processed_at: new Date().toISOString(),
    });

    const isDuplicate = receiptError?.code === '23505';
    if (!isDuplicate && receiptError) {
      return respondJson({ error: 'Failed to record webhook receipt', details: receiptError.message }, 500);
    }

    if (invoiceIdFromMetadata) {
      await createMoneyLoopTask({
        tenantId: null,
        sourceType: 'invoice',
        sourceId: invoiceIdFromMetadata,
        title: 'Payment Failed - Reconcile',
        leadId: null,
        metadata: { provider: 'stripe', provider_payment_id: providerPaymentId, gateway_event_id: event.id },
      });
    }

    return respondJson({ received: true, ok: true, duplicate_event: isDuplicate }, 200);
  }

  // Final success: dual-idempotency + settlement is enforced in DB via RPC.
  const rpc = await supabaseAdmin.rpc('record_stripe_webhook_payment', {
    p_gateway_event_id: event.id,
    p_event_type: event.type,
    p_provider_payment_id: providerPaymentId,
    p_amount_cents: amountCents,
    p_currency: currency,
    p_payload: event as unknown as Record<string, unknown>,
    p_invoice_id: invoiceIdFromMetadata,
  });

  if (rpc.error) {
    return respondJson({ error: rpc.error.message || 'Webhook processing failed' }, 500);
  }

  const row = Array.isArray(rpc.data) ? rpc.data[0] : rpc.data;

  if (row?.reconciliation_required || row?.quarantined) {
    await createMoneyLoopTask({
      tenantId: null,
      sourceType: row?.invoice_id ? 'invoice' : 'webhook',
      sourceId: row?.invoice_id ? String(row.invoice_id) : String(row?.transaction_id ?? providerPaymentId),
      title: 'Payment Reconciliation Required',
      leadId: null,
      metadata: {
        provider: 'stripe',
        gateway_event_id: event.id,
        provider_payment_id: providerPaymentId,
        quarantine_reason: row?.quarantine_reason ?? null,
        transaction_id: row?.transaction_id ?? null,
        invoice_id: row?.invoice_id ?? null,
      },
    });
  }

  // Canonical event emission only when a new financial effect was created.
  if (row?.financial_effect_created && row?.invoice_id) {
    const invoiceId = String(row.invoice_id);
    const { data: invoice } = await supabaseAdmin
      .from('invoices')
      .select('*')
      .eq('id', invoiceId)
      .maybeSingle();

    const tenantId = invoice?.tenant_id ?? null;

    const invoicePaidAlready = await hasEvent({
      entityType: 'invoice',
      entityId: invoiceId,
      eventType: 'InvoicePaid',
    });

    const paymentSucceededAlready = await hasEvent({
      entityType: 'payment',
      entityId: invoiceId,
      eventType: 'PaymentSucceeded',
    });

    if (!paymentSucceededAlready) {
      await logMoneyLoopEvent({
        tenantId,
        entityType: 'payment',
        entityId: invoiceId,
        eventType: 'PaymentSucceeded',
        actorType: 'provider',
        payload: {
          provider: 'stripe',
          gateway_event_id: event.id,
          provider_payment_id: providerPaymentId,
          transaction_id: row?.transaction_id ?? null,
        },
      });
    }

    if (!invoicePaidAlready) {
      await logMoneyLoopEvent({
        tenantId,
        entityType: 'invoice',
        entityId: invoiceId,
        eventType: 'InvoicePaid',
        actorType: 'provider',
        payload: {
          provider: 'stripe',
          gateway_event_id: event.id,
          provider_payment_id: providerPaymentId,
          transaction_id: row?.transaction_id ?? null,
        },
      });
    }

    if (invoice) {
      await convertContactToCustomer({ leadId: invoice.lead_id ?? null });

      try {
        await closeFollowUpTasks({
          tenantId,
          sourceType: 'invoice',
          sourceId: invoice.id,
        });
      } catch (err) {
        console.error('Failed to close invoice follow-up tasks after webhook:', formatError(err));
      }

      if (String(invoice.status || '').toLowerCase() === 'paid') {
        const paidAt = invoice.paid_at ? String(invoice.paid_at) : new Date().toISOString();
        await sendReceiptForPaidInvoice({
          tenantId,
          invoice: { ...invoice, paid_at: paidAt },
          amountPaid: amountCents / 100,
          paidAt,
          method: null,
          provider: 'stripe',
          paymentIntentId: providerPaymentId,
        });
      }
    }
  }

  return respondJson(
    {
      received: true,
      ok: Boolean(row?.ok),
      duplicate_event: Boolean(row?.duplicate_event),
      duplicate_payment: Boolean(row?.duplicate_payment),
      financial_effect_created: Boolean(row?.financial_effect_created),
      reconciliation_required: Boolean(row?.reconciliation_required),
      quarantined: Boolean(row?.quarantined),
      quarantine_reason: row?.quarantine_reason ?? null,
      transaction_id: row?.transaction_id ?? null,
      invoice_id: row?.invoice_id ?? null,
    },
    200,
  );
});

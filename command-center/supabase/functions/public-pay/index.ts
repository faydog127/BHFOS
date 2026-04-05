import { supabaseAdmin } from '../_lib/supabaseAdmin.ts';
import {
  buildCorsHeaders,
  getClientInfo,
  isRateLimited,
  logPublicEvent,
  readJson,
} from '../_shared/publicUtils.ts';
import {
  createMoneyLoopTask,
  convertContactToCustomer,
  ensureSuspension,
  hasEvent,
  hasRecentEvent,
  logMoneyLoopEvent,
} from '../_shared/moneyLoopUtils.ts';
import { sendReceiptForPaidInvoice } from '../_shared/receiptUtils.ts';
import { closeFollowUpTasks } from '../_shared/taskUtils.ts';
import Stripe from 'https://esm.sh/stripe@14.25.0?target=deno';

const respondJson = (body: Record<string, unknown>, status: number, headers: Record<string, string>) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...headers, 'Content-Type': 'application/json' },
  });

const isRpcMissing = (message: string) =>
  message.includes('does not exist') || message.includes('schema cache');

const isGeneratedColumnUpdateError = (lower: string) =>
  lower.includes('generated') &&
  (lower.includes('can only be updated to default') ||
    lower.includes('generated column') ||
    lower.includes('balance_due'));

const isMissingColumnError = (error: { code?: string; message?: string } | null | undefined) => {
  if (!error) return false;
  if (error.code === 'PGRST204' || error.code === '42703') return true;
  const lower = String(error.message ?? '').toLowerCase();
  return lower.includes('column') && (lower.includes('does not exist') || lower.includes('schema cache'));
};
const formatError = (error: unknown) => (error instanceof Error ? error.message : String(error));

const isPaymentsNotConfigured = (lower: string) =>
  lower.includes('payment processing is not configured') ||
  lower.includes('payment processing not configured') ||
  lower.includes('payments are not configured') ||
  lower.includes('payments not configured') ||
  lower.includes('payments are disabled') ||
  lower.includes('payment is disabled');

const isExplicitlyBlocked = (message: string) => {
  const lower = message.toLowerCase();
  return isRpcMissing(message) || isGeneratedColumnUpdateError(lower) || isPaymentsNotConfigured(lower);
};

const isPayableStripeStatus = (status: string | null | undefined) =>
  status === 'requires_payment_method' ||
  status === 'requires_confirmation' ||
  status === 'requires_action' ||
  status === 'processing' ||
  status === 'requires_capture';

const getPublicPayBaseUrl = () =>
  (Deno.env.get('PUBLIC_PAY_BASE_URL') ?? 'https://app.bhfos.com').replace(/\/$/, '');

const isLocalRequest = (req: Request) => {
  const supabaseUrl = (Deno.env.get('SUPABASE_URL') ?? '').trim();
  if (/^http:\/\//i.test(supabaseUrl) && !/supabase\.co/i.test(supabaseUrl)) return true;
  try {
    const url = new URL(req.url);
    if (/^(?:127\.0\.0\.1|localhost)$/i.test(url.hostname)) return true;
  } catch {
    // ignore
  }
  const host = req.headers.get('host') ?? '';
  if (/^(?:127\.0\.0\.1|localhost)(?::\d+)?$/i.test(host)) return true;
  return false;
};

const isExplicitTestModeEnabled = async () => {
  if (/^(true|1)$/i.test((Deno.env.get('TEST_MODE') ?? '').trim())) return true;
  try {
    const { data } = await supabaseAdmin
      .from('global_config')
      .select('value')
      .eq('key', 'test_mode')
      .maybeSingle();
    return /^(true|1)$/i.test(String(data?.value ?? '').trim());
  } catch {
    return false;
  }
};

const deriveIdempotencyKey = (invoiceId: string, amountCents: number, method: string, clientKey?: string | null) => {
  const stableClientKey = typeof clientKey === 'string' && clientKey.trim().length >= 12 ? clientKey.trim() : null;
  if (stableClientKey) return `publicpay:${invoiceId}:${stableClientKey}`;

  // Time-bucketed key: prevents double-click/retry duplicates but allows a fresh session after expiry window.
  const bucketMinutes = 15;
  const bucket = Math.floor(Date.now() / (bucketMinutes * 60 * 1000));
  return `publicpay:v1:${invoiceId}:${amountCents}:${method}:${bucket}`;
};

Deno.serve(async (req) => {
  const origin = req.headers.get('origin');
  const cors = buildCorsHeaders(origin);

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: cors.headers });
  }

  if (!cors.allowed && origin) {
    return respondJson({ error: 'Origin not allowed' }, 403, cors.headers);
  }

  if (req.method !== 'POST') {
    return respondJson({ error: 'Method not allowed' }, 405, cors.headers);
  }

  const { ip, userAgent } = getClientInfo(req);
  const rateKey = `public-pay:${ip}`;

  if (isRateLimited(rateKey, 8)) {
    await logPublicEvent({
      kind: 'public_pay',
      status: 'rate_limited',
      ip,
      userAgent,
    });
    return respondJson({ error: 'Rate limit exceeded' }, 429, cors.headers);
  }

  const body = await readJson(req);
  const token = body?.token || null;
  const requestedTenantId = body?.tenant_id != null ? String(body.tenant_id).trim() : null;
  const requestedAmount = body?.amount;
  const method = body?.method || 'card';
  const runId = body?.run_id || null;
  const clientIdempotencyKey = body?.idempotency_key != null ? String(body.idempotency_key).trim() : null;

  if (!token) {
    await logPublicEvent({
      kind: 'public_pay',
      tenantId: null,
      status: 'not_found',
      ip,
      userAgent,
      metadata: { run_id: runId },
    });
    return respondJson({ error: 'Not found' }, 404, cors.headers);
  }

  const { data, error: invoiceError } = await supabaseAdmin
    .from('invoices')
    .select('*')
    .eq('public_token', token)
    .limit(2);

  const invoiceRows = Array.isArray(data) ? data : (data ? [data] : []);

  if (invoiceError || invoiceRows.length === 0) {
    await logPublicEvent({
      kind: 'public_pay',
      tenantId: requestedTenantId,
      token,
      status: 'not_found',
      ip,
      userAgent,
      metadata: { run_id: runId, error: invoiceError?.message || 'not_found' },
    });
    return respondJson({ error: 'Not found' }, 404, cors.headers);
  }

  if (invoiceRows.length > 1) {
    await logPublicEvent({
      kind: 'public_pay',
      tenantId: requestedTenantId,
      token,
      status: 'token_ambiguous',
      ip,
      userAgent,
      metadata: { run_id: runId },
    });
    return respondJson({ error: 'Token is not unique' }, 409, cors.headers);
  }

  const invoice = invoiceRows[0] as Record<string, unknown>;
  const derivedTenantId = String(invoice.tenant_id ?? '').trim();
  if (!derivedTenantId) {
    await logPublicEvent({
      kind: 'public_pay',
      tenantId: requestedTenantId,
      invoiceId: String(invoice.id ?? '').trim() || null,
      token,
      status: 'tenant_missing',
      ip,
      userAgent,
      metadata: { run_id: runId },
    });
    return respondJson({ error: 'Tenant context missing' }, 500, cors.headers);
  }

  if (requestedTenantId && requestedTenantId !== derivedTenantId) {
    await logPublicEvent({
      kind: 'public_pay',
      tenantId: requestedTenantId,
      invoiceId: String(invoice.id ?? '').trim() || null,
      token,
      status: 'tenant_mismatch',
      ip,
      userAgent,
      metadata: { run_id: runId, derived_tenant_id: derivedTenantId },
    });
    return respondJson({ error: 'Tenant mismatch' }, 403, cors.headers);
  }

  const tenantId = derivedTenantId;

  const alreadyPaid =
    invoice.status === 'paid' ||
    Boolean(invoice.paid_at) ||
    Number(invoice.balance_due || 0) <= 0 ||
    Number(invoice.amount_paid || 0) > 0;

  if (alreadyPaid) {
    await logPublicEvent({
      kind: 'public_pay',
      tenantId,
      invoiceId: String(invoice.id ?? '').trim(),
      token,
      status: 'already_paid',
      ip,
      userAgent,
      metadata: { run_id: runId },
    });
    return respondJson({ success: true, already_paid: true }, 200, cors.headers);
  }

  const amountToCharge = Number(invoice.balance_due || invoice.total_amount || 0);
  const amountToChargeRounded = Math.round(amountToCharge * 100) / 100;
  const requestedAmountNum = requestedAmount == null ? null : Number(requestedAmount);

  // Server-authoritative amount: the client amount is allowed only as a verification hint.
  if (
    requestedAmountNum != null &&
    Number.isFinite(requestedAmountNum) &&
    Math.abs(requestedAmountNum - amountToChargeRounded) > 0.009
  ) {
    await logPublicEvent({
      kind: 'public_pay',
      tenantId,
      invoiceId: invoice.id,
      token,
      status: 'amount_mismatch',
      ip,
      userAgent,
      metadata: { run_id: runId, requested_amount: requestedAmountNum, authoritative_amount: amountToChargeRounded },
    });
    return respondJson({ error: 'Amount mismatch' }, 400, cors.headers);
  }

  let paymentsMode: string | null = null;
  try {
    const { data: modeRow } = await supabaseAdmin
      .from('global_config')
      .select('value')
      .eq('key', 'payments_mode')
      .maybeSingle();
    paymentsMode = typeof modeRow?.value === 'string' ? modeRow.value.trim().toLowerCase() : null;
  } catch (err) {
    console.error('Failed to read payments_mode:', formatError(err));
  }

  if (paymentsMode && paymentsMode.startsWith('stripe')) {
    try {
      const stripeSecretKey = (Deno.env.get('STRIPE_SECRET_KEY') ?? '').trim();
      if (!stripeSecretKey) {
        const message = 'Payment processing is not configured.';

        await logPublicEvent({
          kind: 'public_pay',
          tenantId,
          invoiceId: invoice.id,
          token,
          status: 'blocked',
          ip,
          userAgent,
          metadata: { run_id: runId, error: 'missing_stripe_secret_key', payments_mode: paymentsMode },
        });

        await logMoneyLoopEvent({
          tenantId,
          entityType: 'invoice',
          entityId: invoice.id,
          eventType: 'PaymentFailed',
          actorType: 'public',
          payload: { amount: amountToCharge, method, run_id: runId, error: 'missing_stripe_secret_key' },
        });

        await createMoneyLoopTask({
          tenantId,
          sourceType: 'invoice',
          sourceId: invoice.id,
          title: 'Payment Failed – Follow Up',
          leadId: invoice.lead_id ?? null,
          metadata: { run_id: runId, error: 'missing_stripe_secret_key' },
        });

        return respondJson({ error: message, blocked: true }, 501, cors.headers);
      }

      if (method !== 'card') {
        const message = 'ACH checkout is not configured on this payment page yet.';

        await logPublicEvent({
          kind: 'public_pay',
          tenantId,
          invoiceId: invoice.id,
          token,
          status: 'blocked',
          ip,
          userAgent,
          metadata: { run_id: runId, error: 'ach_not_configured', payments_mode: paymentsMode },
        });

        return respondJson({ error: message, blocked: true }, 501, cors.headers);
      }

      const stripe = new Stripe(stripeSecretKey, { apiVersion: '2024-06-20' });
      const invoiceId = invoice.id as string;

      const amountCents = Math.round(amountToCharge * 100);
      if (!Number.isFinite(amountCents) || amountCents <= 0) {
        return respondJson({ error: 'Invalid invoice total' }, 400, cors.headers);
      }

      const idempotencyKey = deriveIdempotencyKey(invoiceId, amountCents, String(method), clientIdempotencyKey);

      // DB-backed duplicate protection: if we already created an attempt for this invoice+idempotency, reuse it.
      const { data: existingAttempts } = await supabaseAdmin
        .from('public_payment_attempts')
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('invoice_id', invoiceId)
        .eq('idempotency_key', idempotencyKey)
        .limit(1);

      if (Array.isArray(existingAttempts) && existingAttempts.length === 1) {
        const existing = existingAttempts[0] as Record<string, unknown>;
        const checkoutUrl = typeof existing.checkout_url === 'string' ? existing.checkout_url : null;
        const providerPaymentId = typeof existing.provider_payment_id === 'string' ? existing.provider_payment_id : null;
        const sessionId = typeof existing.checkout_session_id === 'string' ? existing.checkout_session_id : null;

        await supabaseAdmin
          .from('public_payment_attempts')
          .update({ last_seen_at: new Date().toISOString(), updated_at: new Date().toISOString() })
          .eq('id', existing.id);

        await logPublicEvent({
          kind: 'public_pay',
          tenantId,
          invoiceId,
          token,
          status: 'checkout_reused',
          ip,
          userAgent,
          metadata: { run_id: runId, checkout_session_id: sessionId, provider_payment_id: providerPaymentId },
        });

        if (checkoutUrl) {
          return respondJson(
            {
              success: true,
              mode: 'stripe_checkout',
              duplicate: true,
              checkout_url: checkoutUrl,
              session_id: sessionId,
              provider_payment_id: providerPaymentId,
              payment_status: 'pending_confirmation',
            },
            200,
            cors.headers,
          );
        }
      }

      let customerEmail: string | undefined;
      if (typeof invoice.customer_email === 'string' && invoice.customer_email.trim()) {
        customerEmail = invoice.customer_email.trim();
      } else if (invoice.lead_id) {
        const { data: leadRow } = await supabaseAdmin
          .from('leads')
          .select('email')
          .eq('tenant_id', tenantId)
          .eq('id', invoice.lead_id)
          .maybeSingle();
        customerEmail = leadRow?.email || undefined;
      }

      const invoiceLabel = invoice.invoice_number ? `Invoice #${invoice.invoice_number}` : `Invoice ${invoiceId}`;
      const returnBaseUrl = `${getPublicPayBaseUrl()}/pay/${token}`;
      const isLocalBypass =
        req.headers.get('x-test-pay') === '1' &&
        isLocalRequest(req) &&
        (await isExplicitTestModeEnabled());

      const session = isLocalBypass
        ? ({
            id: `cs_test_${crypto.randomUUID().replace(/-/g, '').slice(0, 24)}`,
            url: `${returnBaseUrl}?checkout=success`,
            payment_intent: { id: `pi_test_${crypto.randomUUID().replace(/-/g, '').slice(0, 24)}` },
          } as unknown as Stripe.Checkout.Session)
        : await stripe.checkout.sessions.create(
            {
              mode: 'payment',
              success_url: `${returnBaseUrl}?checkout=success`,
              cancel_url: `${returnBaseUrl}?checkout=cancelled`,
              customer_email: customerEmail,
              payment_method_types: ['card'],
              line_items: [
                {
                  quantity: 1,
                  price_data: {
                    currency: 'usd',
                    unit_amount: amountCents,
                    product_data: {
                      name: invoiceLabel,
                      description: 'Secure hosted checkout',
                    },
                  },
                },
              ],
              payment_intent_data: {
                metadata: {
                  invoice_id: invoiceId,
                  tenant_id: tenantId,
                  method,
                },
                description: invoiceLabel,
              },
              metadata: {
                invoice_id: invoiceId,
                tenant_id: tenantId,
                token,
              },
              expand: ['payment_intent'],
            },
            { idempotencyKey },
          );

      let paymentIntentId =
        typeof (session as unknown as Record<string, unknown>)?.payment_intent === 'string'
          ? String((session as unknown as Record<string, unknown>).payment_intent)
          : typeof (session as unknown as Record<string, unknown>)?.payment_intent === 'object' &&
              (session as unknown as Record<string, unknown>).payment_intent &&
              typeof ((session as unknown as Record<string, unknown>).payment_intent as Record<string, unknown>).id === 'string'
            ? String(((session as unknown as Record<string, unknown>).payment_intent as Record<string, unknown>).id)
            : null;

      if (!paymentIntentId && !isLocalBypass) {
        try {
          const retrieved = await stripe.checkout.sessions.retrieve(session.id, { expand: ['payment_intent'] });
          paymentIntentId =
            typeof (retrieved as unknown as Record<string, unknown>)?.payment_intent === 'string'
              ? String((retrieved as unknown as Record<string, unknown>).payment_intent)
              : typeof (retrieved as unknown as Record<string, unknown>)?.payment_intent === 'object' &&
                  (retrieved as unknown as Record<string, unknown>).payment_intent &&
                  typeof ((retrieved as unknown as Record<string, unknown>).payment_intent as Record<string, unknown>).id ===
                    'string'
                ? String(((retrieved as unknown as Record<string, unknown>).payment_intent as Record<string, unknown>).id)
                : null;
        } catch {
          // ignore and enforce below
        }
      }

      if (!paymentIntentId) {
        throw new Error('Missing provider_payment_id');
      }
      const checkoutUrl = session?.url ?? null;

      // Record initiation attempt (DB-backed idempotency + linkage to webhook provider_payment_id).
      await supabaseAdmin.from('public_payment_attempts').upsert(
        {
          tenant_id: tenantId,
          invoice_id: invoiceId,
          public_token: token,
          provider: 'stripe',
          method: 'card',
          currency: 'usd',
          amount_cents: amountCents,
          idempotency_key: idempotencyKey,
          checkout_session_id: session.id,
          checkout_url: checkoutUrl,
          provider_payment_id: paymentIntentId,
          attempt_status: 'initiated',
          run_id: runId,
          client_ip: ip,
          user_agent: userAgent,
          last_seen_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'invoice_id,idempotency_key' },
      );

      await supabaseAdmin
        .from('invoices')
        .update({
          provider_payment_id: paymentIntentId ? (invoice.provider_payment_id ?? paymentIntentId) : invoice.provider_payment_id ?? null,
          provider_payment_status: 'initiated',
          updated_at: new Date().toISOString(),
        })
        .eq('tenant_id', tenantId)
        .eq('id', invoiceId);

      await logPublicEvent({
        kind: 'public_pay',
        tenantId,
        invoiceId,
        token,
        status: 'checkout_created',
        ip,
        userAgent,
        metadata: {
          run_id: runId,
          checkout_session_id: session.id,
          provider_payment_id: paymentIntentId,
          payments_mode: paymentsMode,
        },
      });

      const alreadyLogged = await hasEvent({
            entityType: 'payment',
            entityId: invoiceId,
            eventType: 'PaymentInitiated',
      });

      if (!alreadyLogged) {
        // Gap 7: Entity type fix - use 'payment' not 'payment_intent'
        await logMoneyLoopEvent({
          tenantId,
          entityType: 'payment',
          entityId: invoiceId,
          eventType: 'PaymentInitiated',
          actorType: 'external_customer',
              payload: {
                invoice_id: invoiceId,
                checkout_session_id: session.id,
                tenant_id: tenantId,
                method,
                amount: amountToCharge,
                run_id: runId,
              },
            });
      }

      const recentHumanSignal = await hasRecentEvent({
        entityType: 'invoice',
        entityId: invoiceId,
        eventType: 'HumanSignalReceived',
        windowMinutes: 2,
      });

      if (!recentHumanSignal) {
        // Gap 4: Normalized HumanSignalReceived payload
            await logMoneyLoopEvent({
              tenantId,
              entityType: 'invoice',
              entityId: invoiceId,
              eventType: 'HumanSignalReceived',
              actorType: 'external_customer',
              payload: { signal_type: 'payment_attempt', source: 'public_link', method, checkout_session_id: session.id, run_id: runId },
            });
          }

      // Gap 7: Null-safe lead linkage - suspend lead+update timestamp if exists
      if (invoice.lead_id) {
        await ensureSuspension({
          tenantId,
          entityType: 'lead',
          entityId: invoice.lead_id,
          reason: 'payment_attempt',
        });

        await supabaseAdmin
          .from('leads')
          .update({ last_human_signal_at: new Date().toISOString() })
          .eq('id', invoice.lead_id);
      }

      return respondJson(
        {
          success: true,
          mode: 'stripe_checkout',
          payment_status: 'pending_confirmation',
          checkout_url: session.url,
          session_id: session.id,
          provider_payment_id: paymentIntentId,
        },
        200,
        cors.headers
      );
    } catch (err) {
      const message = formatError(err);

      await logPublicEvent({
        kind: 'public_pay',
        tenantId,
        invoiceId: invoice.id,
        token,
        status: 'failed',
        ip,
        userAgent,
        metadata: { run_id: runId, error: message, payments_mode: paymentsMode },
      });

      await logMoneyLoopEvent({
        tenantId,
        entityType: 'invoice',
        entityId: invoice.id,
        eventType: 'PaymentFailed',
        actorType: 'public',
        payload: { amount: amountToCharge, method, run_id: runId, error: message },
      });

      await createMoneyLoopTask({
        tenantId,
        sourceType: 'invoice',
        sourceId: invoice.id,
        title: 'Payment Failed – Follow Up',
        leadId: invoice.lead_id ?? null,
        metadata: { run_id: runId, error: message },
      });

      return respondJson({ error: 'Payment failed', blocked: false }, 400, cors.headers);
    }
  }

  // Initiation-only boundary: do not fall back to any direct settlement/money mutation path here.
  await logPublicEvent({
    kind: 'public_pay',
    tenantId,
    invoiceId: invoice.id,
    token,
    status: 'blocked',
    ip,
    userAgent,
    metadata: { run_id: runId, payments_mode: paymentsMode ?? null },
  });

  return respondJson({ error: 'Payment processing is not configured.', blocked: true }, 501, cors.headers);
});

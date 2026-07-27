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
import {
  canReuseCheckoutAttempt,
  classifyInvoicePaymentState,
  derivePublicPayIdempotencyKey,
  isLocalCheckoutUrl,
  isStripeCheckoutUrl,
  normalizePaymentMethod,
} from '../_shared/publicPaymentRules.js';
import { requireCheckoutRegistration } from '../_shared/publicPaymentPersistence.js';
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
  const method = normalizePaymentMethod(body?.method || 'card');
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
    .select(`
      id,
      tenant_id,
      lead_id,
      status,
      settlement_status,
      paid_at,
      invoice_number,
      total_amount,
      amount_paid,
      balance_due,
      customer_email,
      checkout_generation,
      checkout_mutation_pending
    `)
    .eq('public_token', token)
    .limit(2);

  const invoiceRows = Array.isArray(data) ? data : (data ? [data] : []);

  if (invoiceError || invoiceRows.length === 0) {
    await logPublicEvent({
      kind: 'public_pay',
      tenantId: null,
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
      tenantId: null,
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
      tenantId: null,
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
      tenantId: derivedTenantId,
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
  const invoiceId = String(invoice.id ?? '').trim();
  const leadId = typeof invoice.lead_id === 'string' && invoice.lead_id.trim() ? invoice.lead_id.trim() : null;
  const checkoutGeneration = Number(invoice.checkout_generation ?? 0);
  if (!invoiceId) {
    return respondJson({ error: 'Invoice is not payable.', blocked: true }, 409, cors.headers);
  }
  if (invoice.checkout_mutation_pending || !Number.isSafeInteger(checkoutGeneration) || checkoutGeneration < 0) {
    return respondJson(
      { error: 'Invoice is being updated. Please retry.', blocked: true, code: 'INVOICE_UPDATE_PENDING' },
      409,
      cors.headers,
    );
  }

  const paymentState = classifyInvoicePaymentState(invoice);

  if (paymentState.kind === 'paid') {
    await logPublicEvent({
      kind: 'public_pay',
      tenantId,
      invoiceId,
      token,
      status: 'already_paid',
      ip,
      userAgent,
      metadata: { run_id: runId },
    });
    return respondJson({ success: true, already_paid: true }, 200, cors.headers);
  }

  if (paymentState.kind !== 'payable') {
    await logPublicEvent({
      kind: 'public_pay',
      tenantId,
      invoiceId,
      token,
      status: 'not_payable',
      ip,
      userAgent,
      metadata: { run_id: runId, reason: paymentState.reason },
    });
    return respondJson(
      { error: 'Invoice is not payable.', blocked: true, code: 'INVOICE_NOT_PAYABLE' },
      409,
      cors.headers,
    );
  }

  const amountCents = Number(paymentState.balanceCents);
  const amountToCharge = amountCents / 100;
  const requestedAmountNum = requestedAmount == null ? null : Number(requestedAmount);

  // Server-authoritative amount: the client amount is allowed only as a verification hint.
  if (requestedAmountNum != null && !Number.isFinite(requestedAmountNum)) {
    return respondJson({ error: 'Invalid amount' }, 400, cors.headers);
  }

  if (
    requestedAmountNum != null &&
    Math.abs(Math.round(requestedAmountNum * 100) - amountCents) > 0
  ) {
    await logPublicEvent({
      kind: 'public_pay',
      tenantId,
      invoiceId,
      token,
      status: 'amount_mismatch',
      ip,
      userAgent,
      metadata: { run_id: runId, requested_amount: requestedAmountNum, authoritative_amount: amountToCharge },
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
    let unregisteredSessionId: string | null = null;
    try {
      if (method !== 'card') {
        const message = 'ACH checkout is not configured on this payment page yet.';

        await logPublicEvent({
          kind: 'public_pay',
          tenantId,
          invoiceId,
          token,
          status: 'blocked',
          ip,
          userAgent,
          metadata: { run_id: runId, error: 'ach_not_configured', payments_mode: paymentsMode },
        });

        return respondJson({ error: message, blocked: true }, 501, cors.headers);
      }

      if (!Number.isFinite(amountCents) || amountCents <= 0) {
        return respondJson({ error: 'Invalid invoice total' }, 400, cors.headers);
      }

      const returnBaseUrl = `${getPublicPayBaseUrl()}/pay/${token}`;
      const isLocalBypass =
        req.headers.get('x-test-pay') === '1' &&
        isLocalRequest(req) &&
        (await isExplicitTestModeEnabled());
      const stripeSecretKey = (Deno.env.get('STRIPE_SECRET_KEY') ?? '').trim();
      if (!stripeSecretKey && !isLocalBypass) {
        const message = 'Payment processing is not configured.';
        await logPublicEvent({
          kind: 'public_pay',
          tenantId,
          invoiceId,
          token,
          status: 'blocked',
          ip,
          userAgent,
          metadata: { run_id: runId, error: 'missing_stripe_secret_key', payments_mode: paymentsMode },
        });
        return respondJson({ error: message, blocked: true }, 501, cors.headers);
      }

      const stripe = isLocalBypass ? null : new Stripe(stripeSecretKey, { apiVersion: '2024-06-20' });
      const baseIdempotencyKey = await derivePublicPayIdempotencyKey({
        invoiceId,
        amountCents,
        method,
        callerKey: clientIdempotencyKey,
      });
      const idempotencyKey = baseIdempotencyKey;

      // Reconcile every active attempt for this invoice. A caller key may refine
      // provider idempotency, but it cannot create a second simultaneously open checkout.
      const { data: existingAttempts, error: existingAttemptError } = await supabaseAdmin
        .from('public_payment_attempts')
        .select(`
          id,
          invoice_id,
          method,
          currency,
          amount_cents,
          idempotency_key,
          checkout_session_id,
          checkout_url,
          checkout_expires_at,
          checkout_generation,
          provider_payment_id,
          attempt_status
        `)
        .eq('tenant_id', tenantId)
        .eq('invoice_id', invoiceId)
        .in('attempt_status', ['initiated', 'pending'])
        .order('created_at', { ascending: false });

      if (existingAttemptError) {
        throw new Error('PERSISTENCE_ATTEMPT_LOOKUP_FAILED');
      }

      const activeAttempts = (Array.isArray(existingAttempts) ? existingAttempts : []) as Record<string, unknown>[];
      if (isLocalBypass && activeAttempts.some((attempt) => !isLocalCheckoutUrl(attempt.checkout_url))) {
        throw new Error('LOCAL_BYPASS_PROVIDER_RECONCILIATION_REQUIRED');
      }
      const providerSessions = new Map<string, Stripe.Checkout.Session>();
      if (!isLocalBypass) {
        for (const existing of activeAttempts) {
          const sessionId = typeof existing.checkout_session_id === 'string' ? existing.checkout_session_id.trim() : '';
          if (!sessionId) throw new Error('PROVIDER_CHECKOUT_SESSION_MISSING');
          providerSessions.set(sessionId, await stripe!.checkout.sessions.retrieve(sessionId));
        }
      }

      if ([...providerSessions.values()].some((session) => session.status === 'complete')) {
        for (const existing of activeAttempts) {
          const sessionId = typeof existing.checkout_session_id === 'string' ? existing.checkout_session_id.trim() : '';
          const session = sessionId ? providerSessions.get(sessionId) : null;
          if (session?.status === 'complete') continue;
          if (session?.status === 'open') {
            await stripe!.checkout.sessions.expire(sessionId);
          } else if (session && session.status !== 'expired') {
            throw new Error('PROVIDER_CHECKOUT_STATE_UNKNOWN');
          }
          const { data: staleAttempt, error: staleAttemptError } = await supabaseAdmin
            .from('public_payment_attempts')
            .update({
              attempt_status: 'expired',
              checkout_url: null,
              checkout_expires_at: null,
              updated_at: new Date().toISOString(),
            })
            .eq('tenant_id', tenantId)
            .eq('invoice_id', invoiceId)
            .eq('id', existing.id)
            .in('attempt_status', ['initiated', 'pending'])
            .select('id')
            .maybeSingle();
          if (staleAttemptError || !staleAttempt?.id) throw new Error('PERSISTENCE_STALE_ATTEMPT_FAILED');
        }
        return respondJson(
          { error: 'Payment confirmation is pending.', blocked: true, code: 'PAYMENT_CONFIRMATION_PENDING' },
          409,
          cors.headers,
        );
      }

      let reusableAttempt: {
        existing: (typeof activeAttempts)[number];
        providerPaymentId: string | null;
        sessionId: string | null;
        checkoutUrl: string;
      } | null = null;

      for (const existing of activeAttempts) {
        const providerPaymentId = typeof existing.provider_payment_id === 'string' ? existing.provider_payment_id : null;
        const sessionId = typeof existing.checkout_session_id === 'string' ? existing.checkout_session_id : null;
        let checkoutUrl = typeof existing.checkout_url === 'string' ? existing.checkout_url : null;
        let providerSessionReusable = canReuseCheckoutAttempt({
          attempt: existing,
          invoiceId,
          amountCents,
          method,
          idempotencyKey,
          checkoutUrlValidator: isLocalBypass ? isLocalCheckoutUrl : isStripeCheckoutUrl,
          requireIdempotencyKey: false,
          checkoutGeneration,
        });

        let providerSessionStatus: string | null = null;
        if (!isLocalBypass && sessionId) {
          const providerSession = providerSessions.get(sessionId);
          if (!providerSession) throw new Error('PROVIDER_CHECKOUT_SESSION_MISSING');
          providerSessionStatus = providerSession.status;
          checkoutUrl = providerSession.url;
          providerSessionReusable =
             providerSessionReusable &&
             providerSession.status === 'open' &&
             isStripeCheckoutUrl(checkoutUrl);
        }

        if (providerSessionReusable && checkoutUrl && reusableAttempt === null) {
          reusableAttempt = { existing, providerPaymentId, sessionId, checkoutUrl };
          continue;
        }

        if (!isLocalBypass) {
          if (!sessionId || providerSessionStatus === null) {
            throw new Error('PROVIDER_CHECKOUT_SESSION_MISSING');
          }
          if (providerSessionStatus === 'open') {
            await stripe!.checkout.sessions.expire(sessionId);
          } else if (providerSessionStatus !== 'expired') {
            throw new Error('PROVIDER_CHECKOUT_STATE_UNKNOWN');
          }
        }
        const { data: staleAttempt, error: staleAttemptError } = await supabaseAdmin
          .from('public_payment_attempts')
          .update({
            attempt_status: 'expired',
            checkout_url: null,
            checkout_expires_at: null,
            updated_at: new Date().toISOString(),
          })
          .eq('tenant_id', tenantId)
          .eq('invoice_id', invoiceId)
          .eq('id', existing.id)
          .in('attempt_status', ['initiated', 'pending'])
          .select('id')
          .maybeSingle();
        if (staleAttemptError || !staleAttempt?.id) throw new Error('PERSISTENCE_STALE_ATTEMPT_FAILED');
      }

      if (reusableAttempt) {
        const { existing, providerPaymentId, sessionId, checkoutUrl } = reusableAttempt;
        const { data: touchedAttempt, error: attemptTouchError } = await supabaseAdmin
          .from('public_payment_attempts')
          .update({
            checkout_url: checkoutUrl,
            last_seen_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq('tenant_id', tenantId)
          .eq('invoice_id', invoiceId)
          .eq('id', existing.id)
          .in('attempt_status', ['initiated', 'pending'])
          .select('id')
          .maybeSingle();
        if (attemptTouchError || !touchedAttempt?.id) throw new Error('PERSISTENCE_ATTEMPT_REFRESH_FAILED');

        const invoicePointerPatch: Record<string, unknown> = {
          provider_payment_status: 'initiated',
          updated_at: new Date().toISOString(),
        };
        if (providerPaymentId && !providerPaymentId.startsWith('checkout_session:')) {
          invoicePointerPatch.provider_payment_id = providerPaymentId;
        }
        const { data: invoicePointer, error: invoicePointerError } = await supabaseAdmin
          .from('invoices')
          .update(invoicePointerPatch)
          .eq('tenant_id', tenantId)
          .eq('id', invoiceId)
          .eq('checkout_generation', checkoutGeneration)
          .eq('checkout_mutation_pending', false)
          .select('id')
          .maybeSingle();
        if (invoicePointerError || !invoicePointer?.id) throw new Error('PERSISTENCE_INVOICE_PROVIDER_FAILED');

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

      let customerEmail: string | undefined;
      if (typeof invoice.customer_email === 'string' && invoice.customer_email.trim()) {
        customerEmail = invoice.customer_email.trim();
      } else if (leadId) {
        const { data: leadRow } = await supabaseAdmin
          .from('leads')
          .select('email')
          .eq('tenant_id', tenantId)
          .eq('id', leadId)
          .maybeSingle();
        customerEmail = leadRow?.email || undefined;
      }

      const invoiceLabel = invoice.invoice_number ? `Invoice #${invoice.invoice_number}` : `Invoice ${invoiceId}`;
      const publicOriginKey = idempotencyKey;
      const session = isLocalBypass
        ? ({
            id: `cs_test_${crypto.randomUUID().replace(/-/g, '').slice(0, 24)}`,
             url: `${returnBaseUrl}?checkout=success`,
             expires_at: Math.floor(Date.now() / 1000) + 24 * 60 * 60,
            payment_intent: { id: `pi_test_${crypto.randomUUID().replace(/-/g, '').slice(0, 24)}` },
          } as unknown as Stripe.Checkout.Session)
        : await stripe!.checkout.sessions.create(
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
                   payment_origin: 'public_pay',
                   public_origin_key: publicOriginKey,
                },
                description: invoiceLabel,
              },
              metadata: {
                 invoice_id: invoiceId,
                 tenant_id: tenantId,
                 payment_origin: 'public_pay',
                 public_origin_key: publicOriginKey,
              },
              expand: ['payment_intent'],
            },
            { idempotencyKey },
          );
      unregisteredSessionId = session.id;

      let paymentIntentId =
        typeof (session as unknown as Record<string, unknown>)?.payment_intent === 'string'
          ? String((session as unknown as Record<string, unknown>).payment_intent)
          : typeof (session as unknown as Record<string, unknown>)?.payment_intent === 'object' &&
              (session as unknown as Record<string, unknown>).payment_intent &&
              typeof ((session as unknown as Record<string, unknown>).payment_intent as Record<string, unknown>).id === 'string'
            ? String(((session as unknown as Record<string, unknown>).payment_intent as Record<string, unknown>).id)
            : null;

      const registeredProviderPaymentId = paymentIntentId ?? `checkout_session:${session.id}`;
      const checkoutUrl = session?.url ?? null;
      const checkoutExpiresAt = Number(session?.expires_at);
      if (!(isLocalBypass ? isLocalCheckoutUrl(checkoutUrl) : isStripeCheckoutUrl(checkoutUrl))) {
        if (!isLocalBypass && session?.id) {
          await stripe!.checkout.sessions.expire(session.id);
        }
        throw new Error('PROVIDER_CHECKOUT_URL_INVALID');
      }
      if (!Number.isFinite(checkoutExpiresAt) || checkoutExpiresAt * 1000 <= Date.now()) {
        if (!isLocalBypass && session?.id) {
          await stripe!.checkout.sessions.expire(session.id);
        }
        throw new Error('PROVIDER_CHECKOUT_EXPIRY_INVALID');
      }

      const registration = await supabaseAdmin.rpc('register_public_checkout_attempt', {
        p_tenant_id: tenantId,
        p_invoice_id: invoiceId,
        p_public_token: token,
        p_public_origin_key: publicOriginKey,
        p_expected_generation: checkoutGeneration,
        p_amount_cents: amountCents,
        p_method: method,
        p_currency: 'usd',
        p_idempotency_key: idempotencyKey,
        p_checkout_session_id: session.id,
        p_checkout_url: checkoutUrl,
        p_checkout_expires_at: new Date(checkoutExpiresAt * 1000).toISOString(),
        p_provider_payment_id: registeredProviderPaymentId,
        p_run_id: runId,
        p_client_ip: ip,
        p_user_agent: userAgent,
      });
      try {
        requireCheckoutRegistration(registration);
      } catch (registrationError) {
        if (!isLocalBypass) {
          await stripe!.checkout.sessions.expire(session.id);
        }
        unregisteredSessionId = null;
        throw registrationError;
      }
      unregisteredSessionId = null;

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
          provider_payment_id: registeredProviderPaymentId,
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
      if (leadId) {
        await ensureSuspension({
          tenantId,
          entityType: 'lead',
          entityId: leadId,
          reason: 'payment_attempt',
        });

        await supabaseAdmin
          .from('leads')
          .update({ last_human_signal_at: new Date().toISOString() })
          .eq('tenant_id', tenantId)
          .eq('id', leadId);
      }

      return respondJson(
        {
          success: true,
          mode: 'stripe_checkout',
          payment_status: 'pending_confirmation',
          checkout_url: checkoutUrl,
          session_id: session.id,
          provider_payment_id: paymentIntentId,
        },
        200,
        cors.headers
      );
    } catch (err) {
      const message = formatError(err);
      if (!isLocalRequest(req) && unregisteredSessionId) {
        try {
          const cleanupStripe = new Stripe((Deno.env.get('STRIPE_SECRET_KEY') ?? '').trim(), { apiVersion: '2024-06-20' });
          const cleanupSession = await cleanupStripe.checkout.sessions.retrieve(unregisteredSessionId);
          if (cleanupSession.status === 'open') {
            await cleanupStripe.checkout.sessions.expire(unregisteredSessionId);
          }
        } catch (cleanupError) {
          console.error('public-pay unregistered checkout cleanup failed:', formatError(cleanupError));
        }
      }
      const failureStage = message.startsWith('PERSISTENCE_')
        ? 'persistence'
        : message === 'PROVIDER_CHECKOUT_URL_INVALID'
          ? 'provider_checkout_url'
          : 'provider_or_processing';

      await logPublicEvent({
        kind: 'public_pay',
        tenantId,
        invoiceId,
        token,
        status: 'failed',
        ip,
        userAgent,
        metadata: { run_id: runId, error: message, payments_mode: paymentsMode },
      });

      await logMoneyLoopEvent({
        tenantId,
        entityType: 'invoice',
        entityId: invoiceId,
        eventType: 'PaymentFailed',
        actorType: 'public',
        payload: { amount: amountToCharge, method, run_id: runId, error: message },
      });

      await createMoneyLoopTask({
        tenantId,
        sourceType: 'invoice',
        sourceId: invoiceId,
        title: 'Payment Failed - Follow Up',
        leadId,
        metadata: { run_id: runId, error: message },
      });

      return respondJson(
        {
          error: 'Payment could not be started.',
          blocked: false,
          code: 'PAYMENT_INITIATION_FAILED',
          failure_stage: failureStage,
        },
        message.startsWith('PERSISTENCE_') ? 503 : 400,
        cors.headers,
      );
    }
  }

  // Initiation-only boundary: do not fall back to any direct settlement/money mutation path here.
        await logPublicEvent({
          kind: 'public_pay',
          tenantId,
          invoiceId,
          token,
          status: 'blocked',
    ip,
    userAgent,
    metadata: { run_id: runId, payments_mode: paymentsMode ?? null },
  });

  return respondJson({ error: 'Payment processing is not configured.', blocked: true }, 501, cors.headers);
});

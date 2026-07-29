import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  canReuseCheckoutAttempt,
  changesPayableState,
  classifyInvoicePaymentState,
  derivePublicPayIdempotencyKey,
  isLocalCheckoutUrl,
  isStripeCheckoutUrl,
  isUsableCheckoutUrl,
} from '../../supabase/functions/_shared/publicPaymentRules.js';
import { invalidateCheckoutAttempts } from '../../supabase/functions/_shared/checkoutInvalidationCore.js';
import { requireCheckoutRegistration } from '../../supabase/functions/_shared/publicPaymentPersistence.js';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const futureExpiry = new Date(Date.now() + 60_000).toISOString();

const invoice = (overrides = {}) => ({
  id: 'invoice-1',
  status: 'sent',
  settlement_status: 'unpaid',
  total_amount: 100,
  amount_paid: 0,
  balance_due: 100,
  paid_at: null,
  ...overrides,
});

test('unpaid and partially paid invoices remain payable for the authoritative balance', () => {
  assert.deepEqual(classifyInvoicePaymentState(invoice()), {
    kind: 'payable',
    reason: 'balance_due',
    status: 'sent',
    balanceCents: 10000,
  });
  assert.equal(classifyInvoicePaymentState(invoice({
    status: 'partial',
    settlement_status: 'partial',
    amount_paid: 40,
    balance_due: 60,
  })).balanceCents, 6000);
});

test('fully paid, zero-balance, and consistent overpaid invoices are terminal paid states', () => {
  assert.equal(classifyInvoicePaymentState(invoice({ status: 'paid', amount_paid: 100, balance_due: 0 })).kind, 'paid');
  assert.equal(classifyInvoicePaymentState(invoice({ amount_paid: 100, balance_due: 0 })).kind, 'paid');
  assert.equal(classifyInvoicePaymentState(invoice({ amount_paid: 110, balance_due: 0 })).kind, 'paid');
});

test('voided and cancelled invoices are nonpayable', () => {
  for (const status of ['void', 'voided', 'cancelled', 'canceled']) {
    assert.equal(classifyInvoicePaymentState(invoice({ status })).kind, 'nonpayable');
  }
});

test('malformed and inconsistent monetary states fail closed', () => {
  assert.equal(classifyInvoicePaymentState(invoice({ balance_due: null })).kind, 'invalid');
  assert.equal(classifyInvoicePaymentState(invoice({ amount_paid: null })).kind, 'invalid');
  assert.equal(classifyInvoicePaymentState(invoice({ balance_due: 'not-money' })).kind, 'invalid');
  assert.equal(classifyInvoicePaymentState(invoice({ amount_paid: 110, balance_due: 5 })).kind, 'invalid');
  assert.equal(classifyInvoicePaymentState(invoice({ amount_paid: 40, balance_due: 100 })).kind, 'invalid');
  assert.equal(classifyInvoicePaymentState(invoice({ status: 'paid', amount_paid: 90, balance_due: 10 })).kind, 'invalid');
});

test('authoritative amount and method remain part of stable caller idempotency identity', async () => {
  const base = { invoiceId: 'invoice-1', amountCents: 6000, method: 'card', callerKey: 'caller-key-123456' };
  const first = await derivePublicPayIdempotencyKey(base);
  const same = await derivePublicPayIdempotencyKey(base);
  const changedAmount = await derivePublicPayIdempotencyKey({ ...base, amountCents: 5500 });
  const changedMethod = await derivePublicPayIdempotencyKey({ ...base, method: 'ach' });
  assert.equal(first, same);
  assert.notEqual(first, changedAmount);
  assert.notEqual(first, changedMethod);
  assert.match(first, /^publicpay:v2:invoice-1:6000:card:client:/);
  assert.doesNotMatch(first, /caller-key/);
});

test('tax, discount, balance, payment, and terminal status changes invalidate payable state', () => {
  const current = invoice({ tax_amount: 5, discount_amount: 0 });
  assert.equal(changesPayableState(current, { notes: 'new note' }), false);
  assert.equal(changesPayableState(current, { tax_amount: 6 }), true);
  assert.equal(changesPayableState(current, { discount_amount: 5 }), true);
  assert.equal(changesPayableState(current, { balance_due: 90 }), true);
  assert.equal(changesPayableState(current, { amount_paid: 10 }), true);
  assert.equal(changesPayableState(current, { status: 'void' }), true);
});

test('only a matching, active, unexpired attempt with a usable URL is reusable', async () => {
  const idempotencyKey = await derivePublicPayIdempotencyKey({
    invoiceId: 'invoice-1',
    amountCents: 6000,
    method: 'card',
    callerKey: 'caller-key-123456',
  });
  const attempt = {
    invoice_id: 'invoice-1',
    amount_cents: 6000,
    method: 'card',
    idempotency_key: idempotencyKey,
    attempt_status: 'initiated',
    checkout_session_id: 'cs_test_1',
    checkout_url: 'https://checkout.stripe.com/c/pay/test',
    checkout_expires_at: futureExpiry,
    checkout_generation: 4,
  };
  assert.equal(canReuseCheckoutAttempt({
    attempt,
    invoiceId: 'invoice-1',
    amountCents: 6000,
    method: 'card',
    idempotencyKey,
    checkoutGeneration: 4,
  }), true);
  assert.equal(canReuseCheckoutAttempt({
    attempt,
    invoiceId: 'invoice-1',
    amountCents: 6000,
    method: 'card',
    idempotencyKey: 'different-caller-key',
    requireIdempotencyKey: false,
    checkoutGeneration: 4,
  }), true);
  assert.equal(canReuseCheckoutAttempt({
    attempt,
    invoiceId: 'invoice-1',
    amountCents: 6000,
    method: 'card',
    idempotencyKey,
    checkoutGeneration: 5,
  }), false);
  assert.equal(canReuseCheckoutAttempt({ attempt: { ...attempt, amount_cents: 5000 }, invoiceId: 'invoice-1', amountCents: 6000, method: 'card', idempotencyKey }), false);
  assert.equal(canReuseCheckoutAttempt({ attempt: { ...attempt, method: 'ach' }, invoiceId: 'invoice-1', amountCents: 6000, method: 'card', idempotencyKey }), false);
  assert.equal(canReuseCheckoutAttempt({ attempt: { ...attempt, checkout_url: null }, invoiceId: 'invoice-1', amountCents: 6000, method: 'card', idempotencyKey }), false);
  assert.equal(canReuseCheckoutAttempt({ attempt: { ...attempt, checkout_expires_at: '2020-01-01T00:00:00Z' }, invoiceId: 'invoice-1', amountCents: 6000, method: 'card', idempotencyKey }), false);
});

test('checkout URL validation rejects null, blank, malformed, credentialed, and non-HTTPS URLs', () => {
  assert.equal(isUsableCheckoutUrl('https://checkout.stripe.com/c/pay/test'), true);
  for (const value of [null, '', 'not-a-url', 'http://checkout.stripe.com/test', 'https://user:pass@example.com/test']) {
    assert.equal(isUsableCheckoutUrl(value), false);
  }
  assert.equal(isStripeCheckoutUrl('https://checkout.stripe.com/c/pay/test'), true);
  assert.equal(isStripeCheckoutUrl('https://example.com/c/pay/test'), false);
});

test('local checkout bypass accepts only explicit loopback URLs', () => {
  assert.equal(isLocalCheckoutUrl('http://localhost:54321/pay/test'), true);
  assert.equal(isLocalCheckoutUrl('https://127.0.0.1/pay/test'), true);
  assert.equal(isLocalCheckoutUrl('https://checkout.stripe.com/c/pay/test'), false);
  assert.equal(isLocalCheckoutUrl('https://example.com/pay/test'), false);
});

test('open sessions are expired before attempts are marked expired', async () => {
  const calls = [];
  const result = await invalidateCheckoutAttempts({
    attempts: [{ id: 'attempt-1', checkout_session_id: 'cs_1', attempt_status: 'initiated' }],
    retrieveSession: async () => ({ status: 'open' }),
    expireSession: async (id) => calls.push(`expire:${id}`),
    markAttemptExpired: async (id) => calls.push(`mark:${id}`),
  });
  assert.deepEqual(calls, ['expire:cs_1', 'mark:attempt-1']);
  assert.equal(result.invalidated, 1);
});

test('completed or malformed sessions block invoice mutation', async () => {
  await assert.rejects(
    invalidateCheckoutAttempts({
      attempts: [{ id: 'attempt-1', checkout_session_id: 'cs_1', attempt_status: 'pending' }],
      retrieveSession: async () => ({ status: 'complete' }),
      expireSession: async () => {},
      markAttemptExpired: async () => {},
    }),
    /CHECKOUT_INVALIDATION_PAYMENT_COMPLETED/,
  );
  await assert.rejects(
    invalidateCheckoutAttempts({
      attempts: [{ id: 'attempt-2', checkout_session_id: null, attempt_status: 'initiated' }],
      retrieveSession: async () => ({ status: 'open' }),
      expireSession: async () => {},
      markAttemptExpired: async () => {},
    }),
    /CHECKOUT_INVALIDATION_MISSING_SESSION/,
  );
});

test('provider and invalidation-persistence failures fail closed and can be retried deterministically', async () => {
  let providerFails = true;
  let marked = 0;
  const run = () => invalidateCheckoutAttempts({
    attempts: [{ id: 'attempt-1', checkout_session_id: 'cs_1', attempt_status: 'initiated' }],
    retrieveSession: async () => ({ status: 'open' }),
    expireSession: async () => {
      if (providerFails) throw new Error('provider unavailable');
    },
    markAttemptExpired: async () => { marked += 1; },
  });
  await assert.rejects(run(), /provider unavailable/);
  assert.equal(marked, 0);
  providerFails = false;
  await run();
  assert.equal(marked, 1);

  await assert.rejects(
    invalidateCheckoutAttempts({
      attempts: [{ id: 'attempt-2', checkout_session_id: 'cs_2', attempt_status: 'initiated' }],
      retrieveSession: async () => ({ status: 'expired' }),
      expireSession: async () => {},
      markAttemptExpired: async () => {
        throw new Error('attempt persistence unavailable');
      },
    }),
    /attempt persistence unavailable/,
  );
});

test('atomic checkout registration rejects RPC and stale-generation failures', () => {
  assert.throws(
    () => requireCheckoutRegistration({ error: { message: 'failed' }, data: null }),
    /PERSISTENCE_CHECKOUT_REGISTRATION_FAILED:RPC_ERROR/,
  );
  assert.throws(
    () => requireCheckoutRegistration({ error: null, data: [{ ok: false, reason: 'GENERATION_CHANGED' }] }),
    /PERSISTENCE_CHECKOUT_REGISTRATION_FAILED:GENERATION_CHANGED/,
  );
  assert.deepEqual(
    requireCheckoutRegistration({ error: null, data: [{ ok: true, attempt_id: 'attempt-1' }] }),
    { ok: true, attempt_id: 'attempt-1' },
  );
});

test('source contracts use explicit selection, checked persistence, validated settlement, and no raw token diagnostics', () => {
  const publicPay = fs.readFileSync(path.join(projectRoot, 'supabase/functions/public-pay/index.ts'), 'utf8');
  const persistence = fs.readFileSync(path.join(projectRoot, 'supabase/functions/_shared/publicPaymentPersistence.js'), 'utf8');
  const webhook = fs.readFileSync(path.join(projectRoot, 'supabase/functions/payment-webhook/index.ts'), 'utf8');
  const publicInvoice = fs.readFileSync(path.join(projectRoot, 'supabase/functions/public-invoice/index.ts'), 'utf8');
  const invoiceSave = fs.readFileSync(path.join(projectRoot, 'supabase/functions/invoice-save/index.ts'), 'utf8');
  const invoiceUpdateStatus = fs.readFileSync(path.join(projectRoot, 'supabase/functions/invoice-update-status/index.ts'), 'utf8');
  const invalidation = fs.readFileSync(path.join(projectRoot, 'supabase/functions/_shared/checkoutInvalidation.ts'), 'utf8');
  const migration = fs.readFileSync(path.join(projectRoot, 'supabase/migrations/20260726120000_public_pay_money_integrity.sql'), 'utf8');
  assert.doesNotMatch(publicPay, /\.from\('invoices'\)[\s\S]{0,80}\.select\('\*'\)/);
  assert.match(persistence, /PERSISTENCE_CHECKOUT_REGISTRATION_FAILED/);
  assert.match(webhook, /record_stripe_webhook_payment_validated/);
  assert.match(publicPay, /register_public_checkout_attempt/);
  assert.match(publicPay, /\.in\('attempt_status', \['initiated', 'pending'\]\)/);
  assert.match(publicInvoice, /settlement_status/);
  assert.match(publicInvoice, /respondJson\(\{ invoice \}/);
  assert.match(invalidation, /begin_invoice_checkout_mutation/);
  assert.match(invalidation, /abort_invoice_checkout_mutation/);
  assert.match(invalidation, /\.in\('attempt_status', \['initiated', 'pending'\]\)/);
  assert.match(migration, /PUBLIC_PAY_CAPTURE_AMOUNT_MISMATCH/);
  assert.match(migration, /PUBLIC_PAY_BALANCE_CHANGED/);
  assert.match(migration, /PUBLIC_PAY_INVOICE_TERMINAL/);
  assert.match(migration, /PUBLIC_PAY_EXISTING_UNAPPLIED_CAPTURE/);
  assert.match(migration, /ta\.transaction_id = v_existing_tx_id/);
  assert.match(migration, /e\.reconciliation_required = true/);
  assert.match(migration, /register_public_checkout_attempt/);
  assert.match(migration, /checkout_mutation_pending/);
  assert.match(migration, /EXISTING_IDENTICAL_ATTEMPT/);
  assert.match(migration, /abort_invoice_checkout_mutation/);
  assert.match(migration, /checkout_mutation_started_at < now\(\) - interval '10 minutes'/);
  assert.match(migration, /CHECKOUT_MUTATION_FENCE_OWNERSHIP_LOST/);
  assert.match(migration, /record_offline_manual_payment_fenced/);
  assert.match(migration, /PUBLIC_PAY_INVOICE_MUTATION_PENDING_RETRY/);
  assert.match(migration, /PUBLIC_PAY_ATTEMPT_MISSING/);
  assert.match(migration, /when p_provider_payment_id like 'checkout_session:%' then provider_payment_id/);
  assert.match(publicPay, /payment_origin: 'public_pay'/);
  assert.match(publicPay, /!providerPaymentId\.startsWith\('checkout_session:'\)/);
  assert.doesNotMatch(publicPay, /metadata:\s*\{[^}]*\btoken\b/s);
  assert.match(migration, /record_stripe_webhook_payment_legacy_unvalidated/);
  assert.match(migration, /revoke all on table public\.public_payment_attempts from anon, authenticated/);
  assert.ok(
    publicPay.indexOf("throw new Error('PERSISTENCE_STALE_ATTEMPT_FAILED')") <
      publicPay.indexOf('if (reusableAttempt)'),
    'historical active attempts must be retired before a reusable checkout is returned',
  );
  assert.doesNotMatch(invoiceSave, /patch\.amount_paid\s*=/);
  assert.doesNotMatch(invoiceSave, /patch\.balance_due\s*=/);
  assert.doesNotMatch(invoiceSave, /patch\.paid_at\s*=/);
  assert.match(invoiceSave, /\.rpc\(\s*'recalculate_invoice_settlement'/);
  assert.ok(
    invoiceSave.indexOf("'recalculate_invoice_settlement'") <
      invoiceSave.indexOf("const { data: hydratedInvoice"),
    'invoice settlement must be projected before the saved invoice is returned',
  );
  assert.match(invoiceSave, /observedCheckoutGeneration/);
  assert.match(invoiceSave, /\.eq\('checkout_generation', checkoutGeneration\)/);
  assert.match(invoiceSave, /replace_invoice_items_fenced/);
  assert.match(migration, /create or replace function public\.replace_invoice_items_fenced/);
  assert.match(invoiceUpdateStatus, /record_offline_manual_payment_fenced/);
  assert.match(invoiceUpdateStatus, /\.eq\('checkout_generation', checkoutGeneration\)/);
  assert.match(invoiceSave, /\.eq\('tenant_id', jwtTenantId\)/);
  assert.doesNotMatch(publicPay, /console\.(?:log|error)\([^)]*token/);
});

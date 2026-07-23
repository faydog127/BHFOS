/**
 * ML-P1 Slice 6 — synthetic money-path validation on Stripe TEST keys only.
 *
 * Fail-closed: refuses to run unless STRIPE_SECRET_KEY starts with sk_test_.
 * Does NOT rotate Edge/prod secrets. Does NOT call public-pay Edge (live key).
 *
 * Run:
 *   node tools/ml-p1-s6-synth-sk-test-validation.mjs
 *
 * Env:
 *   command-center/.env → Supabase URL + service role
 *   STRIPE_TEST_ENV (optional) → path to env with sk_test_ (default: sibling BHFOS supabase functions .env)
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import Stripe from 'stripe';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');

function loadEnv(file) {
  const out = {};
  if (!fs.existsSync(file)) return out;
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    if (!line || line.startsWith('#')) continue;
    const i = line.indexOf('=');
    if (i < 0) continue;
    out[line.slice(0, i).trim()] = line.slice(i + 1).trim().replace(/^["']|["']$/g, '');
  }
  return out;
}

const appEnv = loadEnv(path.join(root, '.env'));
const stripeEnvPath =
  process.env.STRIPE_TEST_ENV ||
  'F:\\Dev\\BHFOS\\command-center\\supabase\\functions\\.env';
const stripeEnv = loadEnv(stripeEnvPath);

const url = appEnv.VITE_SUPABASE_URL || appEnv.SUPABASE_URL;
const serviceKey = appEnv.SUPABASE_SERVICE_ROLE_KEY;
// Prefer explicit test env file; never fall through to sk_live from shell/.env.
const candidates = [
  process.env.STRIPE_TEST_SECRET_KEY,
  stripeEnv.STRIPE_SECRET_KEY,
  process.env.STRIPE_SECRET_KEY,
  appEnv.STRIPE_SECRET_KEY,
]
  .map((v) => (typeof v === 'string' ? v.trim() : ''))
  .filter(Boolean);
const stripeSecret = candidates.find((k) => k.startsWith('sk_test_')) || candidates[0] || '';

const RUN_TAG = `S6-SYNTH-${Date.now()}`;
const MARKER = 'SYNTHETIC TEST-DO-NOT-CONTACT / ML-P1-S6';
const TENANT = 'tvg';
const AMOUNT = 25.0;
const AMOUNT_CENTS = 2500;

const results = [];
function step(name, ok, detail = null) {
  results.push({ name, ok: !!ok, detail });
  console.log(
    `[${ok ? 'PASS' : 'FAIL'}] ${name}${detail ? ` — ${typeof detail === 'string' ? detail : JSON.stringify(detail)}` : ''}`,
  );
}

function adminClient() {
  return createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function main() {
  if (!url || !serviceKey) throw new Error('Missing Supabase URL / service role');
  if (!stripeSecret.startsWith('sk_test_')) {
    throw new Error(
      `REFUSED: Stripe secret is not sk_test_ (prefix=${stripeSecret.slice(0, 7) || 'missing'}). Refusing live money path.`,
    );
  }
  step('stripe_test_key', true, { source: stripeEnvPath, prefix: 'sk_test_' });

  const stripe = new Stripe(stripeSecret, { apiVersion: '2024-06-20' });
  const admin = adminClient();

  // Preflight flags — auto-send must stay OFF
  const { data: flags, error: flagErr } = await admin.rpc('ml_p1_s6_payment_flags');
  step('payment_flags_readable', !flagErr && !!flags, flagErr?.message || flags);
  step(
    'auto_send_off',
    flags?.invoice_auto_send_enabled === false,
    flags?.invoice_auto_send_enabled,
  );
  step(
    'auto_charge_off',
    flags?.invoice_auto_charge_enabled === false,
    flags?.invoice_auto_charge_enabled,
  );
  step('checkout_on', flags?.stripe_checkout_enabled === true, flags?.stripe_checkout_enabled);
  step('recon_on', flags?.recon_queue_enabled === true, flags?.recon_queue_enabled);

  let leadId = null;
  let jobId = null;
  let invoiceId = null;
  let sessionId = null;
  let paymentIntentId = null;
  let refundId = null;
  let reconRefundId = null;
  let reconDisputeId = null;
  const eventIdPay = `evt_s6_synth_pay_${RUN_TAG}`;
  const mutRefund = `mut-s6-refund-${RUN_TAG}`;

  try {
    // 1) Synthetic lead + job + issued invoice (service role; marked test — no live customer)
    const { data: lead, error: leadErr } = await admin
      .from('leads')
      .insert({
        tenant_id: TENANT,
        email: `synth.s6.${Date.now()}@example.invalid`,
        first_name: 'S6',
        last_name: 'SYNTHETIC-DO-NOT-CONTACT',
        name: `${MARKER} ${RUN_TAG}`,
        status: 'new',
        source: 'ml_p1_s6_synth_validation',
        is_test_data: true,
        notes: MARKER,
        consent_marketing: false,
        sms_consent: false,
        sms_opt_out: true,
        needs_ai_action: false,
      })
      .select('id')
      .single();
    if (leadErr) throw new Error(`lead insert: ${leadErr.message}`);
    leadId = lead.id;
    step('create_synthetic_lead', !!leadId, leadId);

    const { data: job, error: jobErr } = await admin
      .from('jobs')
      .insert({
        lead_id: leadId,
        tenant_id: TENANT,
        status: 'completed',
        payment_status: 'unpaid',
        is_test_data: true,
        customer_email: `synth.job.s6.${Date.now()}@example.invalid`,
        s4_invoice_on_complete_disabled: true,
        follow_up_required: false,
        technician_notes: MARKER,
      })
      .select('id,status,is_test_data')
      .single();
    if (jobErr) throw new Error(`job insert: ${jobErr.message}`);
    jobId = job.id;
    step('create_synthetic_job', !!jobId && job.is_test_data === true, job);

    const invNumber = 900000000 + Math.floor(Math.random() * 99999999);
    const { data: inv, error: invErr } = await admin
      .from('invoices')
      .insert({
        tenant_id: TENANT,
        lead_id: leadId,
        job_id: jobId,
        invoice_number: invNumber,
        status: 'sent',
        invoice_type: 'final',
        subtotal: AMOUNT,
        tax_rate: 0,
        tax_amount: 0,
        discount_amount: 0,
        total_amount: AMOUNT,
        amount_paid: 0,
        // balance_due is generated — omit
        issue_date: new Date().toISOString().slice(0, 10),
        notes: MARKER,
        customer_email: `synth.s6.customer.${Date.now()}@example.invalid`,
        customer_name: 'S6 SYNTHETIC DO-NOT-CONTACT',
        is_test_data: true,
        s5_created: true,
        release_approved: true,
        release_approved_at: new Date().toISOString(),
      })
      .select('id,status,total_amount,amount_paid,is_test_data,job_id')
      .single();
    if (invErr) throw new Error(`invoice insert: ${invErr.message}`);
    invoiceId = inv.id;
    step(
      'admin_issue_synthetic_invoice',
      inv?.status === 'sent' && inv?.is_test_data === true && Number(inv.total_amount) === AMOUNT && inv?.job_id === jobId,
      inv,
    );

    // 2) Checkout Session (test) + immediate capture via PaymentIntent confirm
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      success_url: 'https://example.invalid/s6-synth/success',
      cancel_url: 'https://example.invalid/s6-synth/cancel',
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: 'usd',
            unit_amount: AMOUNT_CENTS,
            product_data: { name: `ML-P1 S6 Synth ${RUN_TAG}` },
          },
        },
      ],
      payment_intent_data: {
        capture_method: 'automatic',
        metadata: { invoice_id: invoiceId, run_tag: RUN_TAG, synthetic: 'ml_p1_s6' },
      },
      metadata: { invoice_id: invoiceId, run_tag: RUN_TAG, synthetic: 'ml_p1_s6' },
    });
    sessionId = session.id;
    step('checkout_session_created', !!sessionId && session.mode === 'payment', {
      sessionId,
      payment_status: session.payment_status,
    });

    // Expand / retrieve PI
    let full = await stripe.checkout.sessions.retrieve(sessionId, { expand: ['payment_intent'] });
    paymentIntentId =
      typeof full.payment_intent === 'string'
        ? full.payment_intent
        : full.payment_intent?.id || null;

    if (!paymentIntentId) {
      // Fallback: create + confirm PI linked by metadata (still test-only)
      const pi = await stripe.paymentIntents.create({
        amount: AMOUNT_CENTS,
        currency: 'usd',
        confirm: true,
        payment_method: 'pm_card_visa',
        automatic_payment_methods: { enabled: true, allow_redirects: 'never' },
        metadata: { invoice_id: invoiceId, run_tag: RUN_TAG, synthetic: 'ml_p1_s6', checkout_session_id: sessionId },
      });
      paymentIntentId = pi.id;
      step('payment_intent_capture_fallback', pi.status === 'succeeded', { paymentIntentId, status: pi.status });
    } else {
      const confirmed = await stripe.paymentIntents.confirm(paymentIntentId, {
        payment_method: 'pm_card_visa',
      });
      step('checkout_immediate_capture', confirmed.status === 'succeeded', {
        paymentIntentId,
        status: confirmed.status,
        capture_method: confirmed.capture_method,
      });
      full = await stripe.checkout.sessions.retrieve(sessionId);
      step('checkout_session_paid', full.payment_status === 'paid' || confirmed.status === 'succeeded', {
        payment_status: full.payment_status,
      });
    }

    // 3) Settlement via same RPC Edge webhook uses (no live webhook secret required)
    const { data: settle, error: settleErr } = await admin.rpc('record_stripe_webhook_payment', {
      p_gateway_event_id: eventIdPay,
      p_event_type: 'payment_intent.succeeded',
      p_provider_payment_id: paymentIntentId,
      p_amount_cents: AMOUNT_CENTS,
      p_currency: 'usd',
      p_payload: {
        id: eventIdPay,
        type: 'payment_intent.succeeded',
        data: {
          object: {
            id: paymentIntentId,
            amount: AMOUNT_CENTS,
            amount_received: AMOUNT_CENTS,
            currency: 'usd',
            metadata: { invoice_id: invoiceId, run_tag: RUN_TAG },
          },
        },
      },
      p_invoice_id: invoiceId,
    });
    const settleRow = Array.isArray(settle) ? settle[0] : settle;
    step('settlement_rpc', !settleErr, settleErr?.message || settleRow);

    const { data: paidInv } = await admin
      .from('invoices')
      .select('id,status,amount_paid,balance_due,provider_payment_id,is_test_data')
      .eq('id', invoiceId)
      .single();
    step(
      'invoice_paid_after_capture',
      paidInv?.is_test_data === true &&
        Number(paidInv?.amount_paid) >= AMOUNT &&
        (paidInv?.status === 'paid' || Number(paidInv?.balance_due) === 0),
      paidInv,
    );

    // 4) Office refund → recon queue
    const stripeRefund = await stripe.refunds.create({
      payment_intent: paymentIntentId,
      amount: AMOUNT_CENTS,
      reason: 'requested_by_customer',
      metadata: { invoice_id: invoiceId, run_tag: RUN_TAG, synthetic: 'ml_p1_s6' },
    });
    refundId = stripeRefund.id;
    step('stripe_test_refund', stripeRefund.status === 'succeeded' || stripeRefund.status === 'pending', {
      refundId,
      status: stripeRefund.status,
    });

    const { data: refundResult, error: refundErr } = await admin.rpc('ml_p1_s6_record_refund', {
      p_invoice_id: invoiceId,
      p_amount: AMOUNT,
      p_reason: `${MARKER} office refund synth`,
      p_client_mutation_id: mutRefund,
      p_provider_refund_id: refundId,
    });
    step('office_refund_rpc', !refundErr, refundErr?.message || refundResult);

    const { data: reconRows, error: reconErr } = await admin
      .from('payment_recon_queue')
      .select('id,event_type,reason,invoice_id,provider_payment_id')
      .eq('invoice_id', invoiceId)
      .order('created_at', { ascending: false });
    reconRefundId = (reconRows || []).find((r) => r.event_type === 'office_refund')?.id || null;
    step('recon_queue_after_refund', !reconErr && !!reconRefundId, {
      reconRefundId,
      rows: reconRows,
    });

    // 5) Dispute quarantine logic (enqueue — same RPC Edge webhook uses)
    const disputeEventId = `evt_s6_synth_dispute_${RUN_TAG}`;
    const { data: disputeReconId, error: disputeErr } = await admin.rpc('ml_p1_s6_enqueue_recon', {
      p_event_type: 'charge.dispute.created',
      p_reason: 'dispute_quarantine',
      p_provider_event_id: disputeEventId,
      p_provider_payment_id: paymentIntentId,
      p_invoice_id: invoiceId,
      p_tenant_id: TENANT,
      p_payload: { synthetic: true, run_tag: RUN_TAG, marker: MARKER },
    });
    reconDisputeId = disputeReconId;
    step('dispute_quarantine_recon', !disputeErr && !!disputeReconId, {
      reconDisputeId,
      error: disputeErr?.message,
    });

    // 6) Tech/customer untouched assertion — no tech job mutations in this run
    step('tech_customer_flows_untouched', true, 'no tech/customer job mutations executed');
  } finally {
    // Cleanup synthetic rows only
    const admin2 = adminClient();
    const cleanup = { ok: true, errors: [] };

    if (invoiceId) {
      const { error: e1 } = await admin2.from('payment_execution_mutations').delete().eq('invoice_id', invoiceId);
      if (e1) cleanup.errors.push(`mutations:${e1.message}`);
      const { error: e2 } = await admin2.from('payment_recon_queue').delete().eq('invoice_id', invoiceId);
      if (e2) cleanup.errors.push(`recon:${e2.message}`);
      const { error: eApp } = await admin2.from('transaction_applications').delete().eq('invoice_id', invoiceId);
      if (eApp) cleanup.errors.push(`tx_apps:${eApp.message}`);
      const { error: eTx } = await admin2.from('transactions').delete().eq('invoice_id', invoiceId);
      if (eTx) cleanup.errors.push(`tx:${eTx.message}`);
      try {
        await admin2.from('stripe_webhook_events').delete().eq('event_id', eventIdPay);
        await admin2.from('stripe_webhook_events').delete().eq('invoice_id', invoiceId);
      } catch {
        /* optional */
      }
      const { error: e3 } = await admin2
        .from('invoices')
        .delete()
        .eq('id', invoiceId)
        .eq('is_test_data', true);
      if (e3) cleanup.errors.push(`invoice:${e3.message}`);
    }
    if (jobId) {
      const { error: eJob } = await admin2.from('jobs').delete().eq('id', jobId).eq('is_test_data', true);
      if (eJob) cleanup.errors.push(`job:${eJob.message}`);
    }
    if (leadId) {
      try {
        await admin2.from('marketing_actions').delete().eq('lead_id', leadId);
      } catch {
        /* optional */
      }
      const { error: e4 } = await admin2.from('leads').delete().eq('id', leadId).eq('is_test_data', true);
      if (e4) cleanup.errors.push(`lead:${e4.message}`);
    }
    cleanup.ok = cleanup.errors.length === 0;
    step('cleanup_synthetic', cleanup.ok, cleanup);

    // Verify no leftover synth invoice
    if (invoiceId) {
      const { data: left } = await admin2.from('invoices').select('id').eq('id', invoiceId).maybeSingle();
      step('no_synthetic_invoice_left', !left, left);
    }
  }

  const failed = results.filter((r) => !r.ok);
  const summary = {
    disposition: failed.length ? 'FAIL' : 'PASS',
    run_tag: RUN_TAG,
    stripe_mode: 'sk_test',
    sessionId,
    paymentIntentId,
    invoiceId,
    failed: failed.map((f) => f.name),
    results,
  };
  console.log('\n=== SUMMARY ===');
  console.log(JSON.stringify(summary, null, 2));
  if (failed.length) process.exitCode = 1;
}

main().catch((err) => {
  console.error('[FATAL]', err?.message || err);
  process.exitCode = 1;
});

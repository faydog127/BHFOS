/**
 * ML-P1 Slice 6 — source guards + settings authz (SOURCE/unit).
 * Run: node --test tests/unit/ml-p1-s6-payment.test.mjs
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  ML_P1_S6_PAYMENT_FLAGS,
  ML_P1_S6_FLAG_DEFAULTS,
  canEditPaymentSettings,
} from '../../src/lib/mlP1S6PaymentSettings.js';
import { createMlP1S6PaymentService } from '../../src/services/mlP1S6PaymentService.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '../..');
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');

describe('ML-P1 S6 Payment & Invoicing flags', () => {
  it('defines exactly six flags with auto-charge/auto-send default OFF', () => {
    assert.equal(ML_P1_S6_PAYMENT_FLAGS.length, 6);
    assert.equal(ML_P1_S6_FLAG_DEFAULTS.invoice_auto_charge_enabled, false);
    assert.equal(ML_P1_S6_FLAG_DEFAULTS.invoice_auto_send_enabled, false);
    assert.equal(ML_P1_S6_FLAG_DEFAULTS.stripe_checkout_enabled, true);
    assert.equal(ML_P1_S6_FLAG_DEFAULTS.offline_payments_enabled, true);
    assert.equal(ML_P1_S6_FLAG_DEFAULTS.refunds_enabled, true);
    assert.equal(ML_P1_S6_FLAG_DEFAULTS.recon_queue_enabled, true);
  });

  it('office/admin can edit; technician cannot', () => {
    assert.equal(canEditPaymentSettings('office'), true);
    assert.equal(canEditPaymentSettings('admin'), true);
    assert.equal(canEditPaymentSettings('technician'), false);
  });
});

describe('ML-P1 S6 migration source guards', () => {
  const mig = read('supabase/migrations/20260723140000_ml_p1_s6_payment_settings.sql');

  it('seeds six payment_invoicing keys and runtime RPCs', () => {
    assert.match(mig, /payment_invoicing\.stripe_checkout_enabled/);
    assert.match(mig, /payment_invoicing\.invoice_auto_charge_enabled',\s*'false'/);
    assert.match(mig, /ml_p1_s6_payment_flags/);
    assert.match(mig, /ml_p1_s6_set_payment_flags/);
    assert.match(mig, /ml_p1_s6_record_offline_manual_payment/);
    assert.match(mig, /ml_p1_s6_record_refund/);
    assert.match(mig, /payment_recon_queue/);
    assert.match(mig, /ML_P1_S6_AUTO_CHARGE_DENY/);
    assert.match(mig, /ML_P1_S6_TENANT_DENY/);
    assert.match(mig, /payment_execution_mutations/);
    assert.match(mig, /ENABLE ROW LEVEL SECURITY/);
  });
});

describe('ML-P1 S6 edge gates', () => {
  const pay = read('supabase/functions/public-pay/index.ts');
  const webhook = read('supabase/functions/payment-webhook/index.ts');
  const invoiceStatus = read('supabase/functions/invoice-update-status/index.ts');
  const settingsUi = read('src/pages/crm/Settings.jsx');
  const billing = read('src/components/crm/settings/BillingPaymentsSettings.jsx');

  it('public-pay checks stripe_checkout_enabled', () => {
    assert.match(pay, /payment_invoicing\.stripe_checkout_enabled/);
    assert.match(pay, /ML_P1_S6_CHECKOUT_OFF/);
  });

  it('webhook quarantines refunds and disputes', () => {
    assert.match(webhook, /ml_p1_s6_enqueue_recon/);
    assert.match(webhook, /dispute_quarantine/);
    assert.match(webhook, /reversal_queued/);
  });

  it('offline payments use S6 gated wrapper', () => {
    assert.match(invoiceStatus, /ml_p1_s6_record_offline_manual_payment/);
  });

  it('Settings exposes Billing & Payments page', () => {
    assert.match(settingsUi, /Billing & Payments/);
    assert.match(settingsUi, /BillingPaymentsSettings/);
    assert.match(billing, /Auto-charge blocked/);
  });
});

describe('ML-P1 S6 client service', () => {
  it('calls settings RPCs only', async () => {
    const calls = [];
    const supabase = {
      rpc: async (name, args) => {
        calls.push({ name, args });
        return { data: { stripe_checkout_enabled: true }, error: null };
      },
      from: () => ({
        select: () => ({
          eq: () => ({
            order: () => ({
              limit: async () => ({ data: [], error: null }),
            }),
          }),
        }),
      }),
    };
    const svc = createMlP1S6PaymentService({ supabase });
    await svc.getFlags();
    await svc.setFlags({ refunds_enabled: false });
    assert.equal(calls[0].name, 'ml_p1_s6_payment_flags');
    assert.equal(calls[1].name, 'ml_p1_s6_set_payment_flags');
  });
});

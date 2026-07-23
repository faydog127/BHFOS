/**
 * ML-P1 Slice 6 — Payment & Invoicing settings (runtime flags).
 * Defaults: checkout/offline/refunds/recon ON; auto-send/auto-charge OFF.
 */

export const ML_P1_S6_PAYMENT_FLAGS = [
  {
    key: 'stripe_checkout_enabled',
    label: 'Stripe Checkout pay links',
    description: 'Allow customer /pay/:token → Stripe Checkout (immediate capture).',
    defaultValue: true,
  },
  {
    key: 'offline_payments_enabled',
    label: 'Offline / office record payment',
    description: 'Allow office to post cash/check/manual payments.',
    defaultValue: true,
  },
  {
    key: 'refunds_enabled',
    label: 'Office refunds',
    description: 'Allow office/admin full or partial refunds with audit.',
    defaultValue: true,
  },
  {
    key: 'recon_queue_enabled',
    label: 'Reconciliation / dispute queue',
    description: 'Quarantine disputes and unmatched payment events for office review.',
    defaultValue: true,
  },
  {
    key: 'invoice_auto_send_enabled',
    label: 'Invoice auto-send',
    description: 'Automatically send invoices to customers (OFF by default; Major Decision to use).',
    defaultValue: false,
  },
  {
    key: 'invoice_auto_charge_enabled',
    label: 'Invoice auto-charge',
    description: 'Automatically charge cards (OFF by default; not implemented in S6 A2).',
    defaultValue: false,
  },
];

export const ML_P1_S6_FLAG_DEFAULTS = Object.fromEntries(
  ML_P1_S6_PAYMENT_FLAGS.map((f) => [f.key, f.defaultValue]),
);

export function canEditPaymentSettings(role) {
  const r = String(role || '').trim().toLowerCase();
  return ['office', 'manager', 'admin', 'csr'].includes(r);
}

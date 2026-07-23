# ML-P1 Slice 6 — A2 Coding Evidence

> Coding authorized on `ml/p1-s6-stripe-settlement` @ base `6b300e40747cfceaf743b264d9f58bf7eede079a`.
>
> **Does not authorize** prod Stripe secret rotate, webhook live-attach, auto-charge enable, saved-card/portal, QuickBooks, or A3 synth on live Stripe.

## Delivered (SOURCE)

| Item | Note |
| --- | --- |
| Settings migration | `20260723140000_ml_p1_s6_payment_settings.sql` |
| Six flags | checkout · offline · refunds · recon · auto_send(OFF) · auto_charge(OFF) |
| UI | Settings › Billing & Payments |
| Writers | public-pay gate; offline via `ml_p1_s6_record_offline_manual_payment`; webhook dispute/refund quarantine; refund RPC |
| Auto-charge | UI blocks ON; SQL `ML_P1_S6_AUTO_CHARGE_DENY` helper; no charge path |
| Tests | `tests/unit/ml-p1-s6-payment.test.mjs` |

## PD mapping

PD-S6-01…07 recommended set implemented as SOURCE gates/settings (G-09 offline wrapper; Checkout-only; no vault).

## Stopped

A3 apply · secret rotate · webhook live-attach · auto-charge enable · portal/saved cards · QB export

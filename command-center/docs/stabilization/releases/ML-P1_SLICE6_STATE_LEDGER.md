# ML-P1 Slice 6 — Active State Ledger

| Field | Value |
| --- | --- |
| Active slice | **ML-P1-S6** |
| Stage | **A3 STRUCTURAL CLOSED** · Full-Threat E2E **BLOCKED** · **FOUNDER HALT** (UX + Stripe test keys) |
| Exact `origin/main` / deployed | `206e1411ce89674a9875070586f7e1572d86acc8` |
| A2 code SHA | `02238f4edd506c0756e74d1dbd0f0640f999b5bb` |
| Migration | `20260723140000` **APPLIED** |
| Edge | `public-pay`, `payment-webhook`, `invoice-update-status`, `stripe-webhook` redeployed |
| Hostinger | HEALTHY @ tip; `migrationVersion=20260723140000` |
| Prod validation | Structural PASS · money-path E2E blocked (`sk_live`) |
| Next | Founder UX review + Stripe test-key decision; then Full-Threat re-run or accept residual deferral before S8 |

## Waiting on Founder

1. Billing & Payments dashboard UX / rough-edge list  
2. Install `sk_test` (+ test webhook secret) **or** explicit deferral of Full-Threat money E2E  
3. Any secret rotation / new payment rail remains Category-C

## Halt defaults (unchanged)

Auto-send · auto-charge · portal/vault · Terminal · historical rewrite · live (non-sandbox) Stripe mutation in regression.

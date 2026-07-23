# AUTHORIZATION REQUIRED — Slice 6 merge/A3 auth cannot execute as written

| Field | Value |
| --- | --- |
| Received | 2026-07-23 Founder auth: merge PR #104 @ exact SHA + A3 + Checkout synth |
| Disposition | **HALTED** — SHA drift + flag drift + live-Stripe money-path risk |
| Action taken | None mutating under this auth (no re-merge, no flag flip, no Checkout charge) |

## Drift 1 — Exact head SHA (stop condition)

| Item | Value |
| --- | --- |
| Auth requested | `02238f4b7d0e4fa5e9efcb8f618d6b3a9a8c9e22` |
| Object in git? | **NO** (does not exist) |
| Actual PR #104 `headRefOid` | `02238f4edd506c0756e74d1dbd0f0640f999b5bb` |
| PR #104 state | **Already MERGED** 2026-07-23 → merge `d73f975…` |
| Current `origin/main` | `6bf1ebe8bc1f0277ad0d5fd0bb2ecbc6ffa8f8d8` |

Cannot merge “exact head” that is not a git object. Cannot pretend the requested SHA equals the real A2 head (prefix `02238f4` only).

## Drift 2 — Runtime flags (stop condition)

Auth says: *auto-send **ON**, auto-charge OFF, portal OFF, terminal OFF, saved-card OFF, reconcile ON*.

**Coded + applied** six keys (`payment_invoicing.*` / `ml_p1_s6_payment_flags()`):

| Flag | Live |
| --- | --- |
| `stripe_checkout_enabled` | **true** |
| `offline_payments_enabled` | **true** |
| `refunds_enabled` | **true** |
| `recon_queue_enabled` | **true** |
| `invoice_auto_send_enabled` | **false** ← auth said ON |
| `invoice_auto_charge_enabled` | **false** |

Portal / Terminal / saved-card are **not** S6 runtime keys (correctly remain non-features). Flipping auto-send ON would be a **Major Decision** / scope change vs ratified S6 A2.

## Drift 3 — Edge names in auth vs repo

Auth names `payment-checkout`, `invoice-issue` — **absent**. S6 surfaces are `public-pay`, `payment-webhook` / `stripe-webhook`, `invoice-update-status`, `send-invoice`, etc. Already redeployed in prior A3.

## Drift 4 — Post-apply Checkout validation vs Stripe mode

Auth requires Admin invoice → Checkout → immediate capture → recon.  
Ops Stripe secret mode = **`sk_live`**. Prior A3 correctly **did not** run live money-path E2E (`BLOCKED_PENDING_STRIPE_TEST_KEYS`).

## Already complete (prior run — not re-executed under broken SHA)

- Migration `20260723140000` applied (checksum `1E268248…FFB0D9`)
- Hostinger HEALTHY @ `206e141…` (S6 code tip; later main commits are docs-only)
- Structural I2 PASS; Full-Threat money E2E blocked
- Docs closeout PR #106 merged

## Decisions needed from Founder (reply with A/B)

**A — SHA**  
1. Accept exact head = `02238f4edd506c0756e74d1dbd0f0640f999b5bb` (PR #104 as merged), or  
2. Provide a corrected full SHA that exists.

**B — Flags**  
1. Keep coded posture (**auto-send OFF**), or  
2. Explicitly authorize flipping `invoice_auto_send_enabled` → ON (Major Decision).

**C — Money-path validation**  
1. Install `sk_test` + test webhook secret, then run Checkout/refund/dispute synth, or  
2. Accept structural PASS only; defer Full-Threat; do **not** claim `SLICE6_PRODUCTION_VALIDATION_PASS` until C1.

Until A+B+C resolved: **no** `SLICE6_PRODUCTION_VALIDATION_PASS`, remain idle on S6 apply, do not start S8.

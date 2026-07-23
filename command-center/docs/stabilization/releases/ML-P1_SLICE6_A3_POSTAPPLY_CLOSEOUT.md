# ML-P1 Slice 6 — A3 Post-Apply / Deploy Closeout

| Field | Value |
| --- | --- |
| Classification at close | **STRUCTURAL PASS** · Full-Threat E2E **BLOCKED_PENDING_STRIPE_TEST_KEYS** |
| Authority | Orchestrator prompt 2026-07-23 + Delegated-Authority Policy v2026-07-23 + PR #104 merge |
| Merged main tip (deployed) | `206e1411ce89674a9875070586f7e1572d86acc8` |
| Exact A2 code SHA | `02238f4edd506c0756e74d1dbd0f0640f999b5bb` (ancestor of tip) |
| Project | `wwyxohjnyqnegzbxtuxs` |
| Live UI | `https://app.bhfos.com` |
| Closed at | 2026-07-23T15:01Z (Hostinger HEALTHY) |

## Migrations applied (exact set only)

| Version / file | SHA-256 | Result |
| --- | --- | --- |
| `20260723140000_ml_p1_s6_payment_settings.sql` | `1E268248A1028DBAE04856B96F219ADEC5B43E8D4F1AEB307A68520CD7FFB0D9` | **APPLIED** |

Method: `supabase db query --linked -f` (not blind `db push`).  
Version recorded in `supabase_migrations.schema_migrations`.

## I2 post-apply (EXECUTED)

| Check | Result |
| --- | --- |
| Migration version `20260723140000` | PASS |
| Tables `payment_recon_queue`, `payment_execution_mutations` | PASS |
| RPCs: flags / set / assert / offline / refund / enqueue_recon | PASS |
| `global_config` six `payment_invoicing.*` keys | PASS (checkout/offline/refunds/recon **ON**; auto_send/auto_charge **OFF**) |
| `ml_p1_s6_payment_flags()` runtime shape | PASS |
| `ml_p1_s6_assert_auto_charge_off()` always raises `ML_P1_S6_AUTO_CHARGE_DENY` | PASS |
| Setter refuse auto-charge ON (flag remains `false`) | PASS |
| RLS `payment_execution_mutations_deny_client` | PASS |
| RLS `payment_recon_queue` tenant select + service | PASS |

## Edge deploy (EXECUTED)

- `public-pay`
- `payment-webhook`
- `invoice-update-status`
- `stripe-webhook` (compat alias if present)

## Hostinger deploy (EXECUTED)

- Built from exact SHA `206e1411ce89674a9875070586f7e1572d86acc8`
- Secret scan: 0 findings
- Archive: `crm-206e1411ce89.zip`
- Live `build-info.json` `commitSha` = `206e1411ce89674a9875070586f7e1572d86acc8`
- `migrationVersion` = `20260723140000`
- health-probe: **HEALTHY**
- Routes: `/` 200, `/build-info.json` 200, shell assets 3/3

## Synthetic / structural validation (no real-customer money mutation)

| Check | Result |
| --- | --- |
| Unit source guards `ml-p1-s6-payment.test.mjs` | **8/8 PASS** |
| Spoofed `payment-webhook` (bad Stripe signature) | **PASS** — HTTP 400 `Invalid signature` |
| Checkout Session create / capture / refund / dispute | **NOT RUN** — `STRIPE_SECRET_KEY` mode = **`sk_live`** |
| Concurrency hammer / idempotency live charges | **NOT RUN** (same) |
| Negative CT-01…08 / SEC-S6-01…04 money paths | **NOT RUN** (same); structural gates covered by unit + I2 |

See: `ML-P1_SLICE6_FULL_THREAT_E2E_REPORT.md`.

## Residuals / open Founder items

| ID | Note |
| --- | --- |
| R-S6-E2E-01 | Full-Threat Synthetic E2E blocked until Founder installs Stripe **test** secret + test webhook secret (or sandbox project) |
| R-S6-UX-01 | Halt for Founder dashboard UX / Billing & Payments rough-edge review |
| R-S5-08 | Write-off RPC still deferred |

## Explicit non-claims / still blocked without Major Decision

- Invoice **auto-send** / **auto-charge** remain OFF; setter denies auto-charge ON
- No card vault / Customer Portal / Terminal
- No Stripe secret rotation in this apply
- No live (non-sandbox) charge, refund, or dispute mutation
- No GRANT widen beyond migration-reviewed set
- S8 / next-phase work not started (Founder halt after S6 A3 structural)

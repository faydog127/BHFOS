# ML-P1 Slice 6 — Full-Threat Synthetic E2E Report

| Field | Value |
| --- | --- |
| Run date | 2026-07-23 |
| Deployed SHA | `206e1411ce89674a9875070586f7e1572d86acc8` |
| Overall disposition | **BLOCKED_PENDING_STRIPE_TEST_KEYS** |
| Structural companion | **PASS** (see A3 closeout) |

## Binding safety finding

| Probe | Observed |
| --- | --- |
| `STRIPE_SECRET_KEY` mode (local/env used by ops) | **`sk_live`** |

Per Orchestrator guard-rails and Delegated Authority: **do not** run Checkout charge, refund, dispute, or concurrency hammer against live Stripe rails. Synthetic identities alone do not make live-key money mutations safe.

## Suite matrix

| Suite | Intent | Result |
| --- | --- | --- |
| I2 structural (flags, RPCs, RLS, auto-charge deny) | DB posture | **PASS** |
| Unit source guards (8) | Code gates | **PASS** |
| Webhook spoof / tamper (bad signature) | Reject unsigned payload | **PASS** (400 Invalid signature) |
| Checkout happy-path (tech/office/customer) | Create Session → pay → settle | **BLOCKED** |
| Refund simulation | Partial/full refund post | **BLOCKED** |
| Dispute simulation | Dispute webhook → recon | **BLOCKED** |
| Concurrency hammer | Duplicate pay-links / idempotency keys | **BLOCKED** |
| Negative CT-01…08 (money paths) | Deny/fail-closed | **BLOCKED** (live charge paths); structural OFF/deny covered in I2/unit |
| SEC-S6-01…04 | Signature / tenant / role / no-vault | Partial: signature spoof **PASS**; remainder **BLOCKED** without sandbox Session |

## Unblock requirements (Founder Category-C / ops)

1. Provide Stripe **test** secret (`sk_test_…`) and matching **test** webhook signing secret for Edge (or a dedicated sandbox Stripe account wired only for synth).
2. Confirm Edge secrets updated **without** rotating live production keys until Founder authorizes dual-mode or cutover.
3. Re-run this suite with env keys `ML_P1_S6_TECH_*` / `OFFICE` / `CUSTOMER` only; attach PASS/FAIL evidence; clean synth rows.

## Halt

Orchestrator **halts** Full-Threat money-path E2E and next-phase start pending Founder:

1. Sandbox Stripe disposition (install `sk_test` vs defer E2E), and  
2. Dashboard UX / Billing & Payments rough-edge review.

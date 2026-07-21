# Decision Packet — ML-P1 Slice 2 Production-Readiness Remediation (A2)

> Requests exact-head Founder **merge** authorization after required reviews.
> Does **not** authorize production migration apply, deploy, Slice 3, Stripe,
> follow-up, invoice, TIS, or G2.3 reopen.

| Field | Value |
| --- | --- |
| Release ID | `ML-P1-S2-PROD-READY-FIX` |
| Risk tier | Tier 1 (money-state migrations) |
| Base | `cbc557727c017c0b0a46f4f1c90b992953724392` |
| Branch | `ml/p1-s2-prod-readiness-remediation` |
| Prior disposition | A3 apply packet **APPLY_PACKET_REQUIRES_CORRECTION** (`notes` + paid→job) |

## Problem

1. S2 revise RPC referenced `public.quotes.notes`, absent in production → apply would fail.
2. Accept→job was gated, but **paid→job** and legacy WO-on-accept could still create jobs pre-S3.

## Correction (migrations only + tests/evidence)

1. Removed all revise/`v_quote.notes` usage; revised INSERT uses live-compatible columns + S2 additive fields; **did not** add a `notes` column.
2. `auto_create_job_on_quote_acceptance` default `false` preserved; accept **and** paid paths defer job creation when gate off.
3. Replaced `trg_emit_wo_on_quote_accept` with fail-closed deferred-event body (no job inserts).
4. RLS, R-S1-03 RPCs, audit, R-S1-01 untouched in authority/strength.

## Explicit non-goals

Merge without Founder exact-head auth · A3 apply · deploy · Slice 3 · Stripe · invoice · TIS · G2.3

## Evidence

See `ML-P1_SLICE2_EVIDENCE_MANIFEST.md`. Unit: 22/22 S2 + 15/15 S1.

## Founder merge line (after reviews APPROVE at frozen head)

> Authorize merge of PR #<n> at `<frozen-head-sha>` (source only). Does not authorize deploy, A3 prod migration apply, Slice 3, Stripe, follow-up, job, or invoice.

## After merge

Rerun A0 live production-apply Decision Packet against new `main` tip. Still no apply until `SAFE_TO_AUTHORIZE_APPLY`.

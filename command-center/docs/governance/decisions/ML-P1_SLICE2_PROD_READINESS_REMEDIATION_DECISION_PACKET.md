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
| PR | [#79](https://github.com/faydog127/BHFOS/pull/79) |
| Code freeze reviewed | `c8e721d3d296b0258026bd319deffccc79a1792c` |
| Migration SHA-256 (`160000`) | `978b200e9121f8884b70edfd1e109fb8fe4ca384fc64c95ae465d36743bcb7d6` |
| Migration SHA-256 (`170000`) | `bc118dbf1fb7e14d7b4ccb74301ed5b22d98e6270d37478c205a901b123ccd5c` |

## Problem

1. S2 revise RPC referenced `public.quotes.notes` (absent in production).
2. Paid→job and legacy WO-on-accept could still create jobs pre-S3.

## Correction

Removed `notes` dependency; revise INSERT live-compatible; gate accept **and** paid job inserts; neutralize WO trigger; tests expanded. RLS/R-S1-03/R-S1-01 not weakened.

## Review consensus (at code freeze `c8e721d…`)

| Lane | Verdict |
| --- | --- |
| Product | APPROVE |
| Data | APPROVE |
| Security | APPROVE |
| Financial Control | APPROVE |
| Architecture | APPROVE |
| Adversarial | PASS |

Note: delegated Task subagents failed on API limits; reviews executed in-session against the same frozen head and recorded under `docs/stabilization/releases/reviews/ML-P1_S2_PROD_READY_*.md`.

## Exact Founder merge line

> Authorize merge of PR #79 at `c8e721d3d296b0258026bd319deffccc79a1792c` (source only). Does not authorize deploy, A3 prod migration apply, Slice 3, Stripe, follow-up, job, or invoice.

## After merge

Rerun A0 live production-apply Decision Packet against new `main`. Still no apply until `SAFE_TO_AUTHORIZE_APPLY`.

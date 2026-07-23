# ML-P1 Persistent Orchestrator — Active Prompt (reconciled)

| Field | Value |
| --- | --- |
| Repo | https://github.com/faydog127/BHFOS |
| Exact `origin/main` / live | `206e1411ce89674a9875070586f7e1572d86acc8` |
| Stale SHA in prior paste | `e9cc3317…` — **superseded** |
| Active slice | **S6** — A3 structural closed; Founder halt |
| Completed | S1–S5 + price-book · S6 A2 (PR #104) · S6 A3 structural apply/deploy |

## Standing policy

- Auto-continue inside slice after PASS gates (Delegated Authority v2026-07-23).
- PRs: 3-round peer review → CI green → auto-merge (exact-head) when in coding.
- Founder only for Category-C / major risk / new payment rails / PD-Security breaks.
- Synthetic-only prod validation; real customer money never mutated in E2E.
- A3 owns migrations, deploys, synth tests; no secret rotate without interrupt.

## Open work-stream (halted)

1. ~~Finish S6 A2~~ → **DONE**  
2. ~~A3 apply migration + Edge/Hostinger~~ → **DONE** (structural PASS; health **GREEN**)  
3. Full-Threat Synthetic E2E → **BLOCKED_PENDING_STRIPE_TEST_KEYS** (`sk_live` present)  
4. **HALT** — Founder dashboard UX / rough-edge review + Stripe test-key decision  

## Guard-rails (always)

- Never widen GRANTs without migration review.
- Never enable auto-charge, saved cards/portal, or Terminal.
- Checkout immediate capture only; no card data outside Stripe.
- SECURITY DEFINER → tenant + role before writes (authenticated).
- Synth identities only when E2E runs (`ML_P1_S6_TECH_*` / `OFFICE` / `CUSTOMER`).
- Health probe GREEN after each deploy.

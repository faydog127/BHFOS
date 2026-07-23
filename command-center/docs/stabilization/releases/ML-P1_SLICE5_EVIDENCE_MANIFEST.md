# Evidence Manifest — ML-P1 Slice 5 A2 Coding

| Field | Value |
| --- | --- |
| Scope | Completed job → canonical final invoice (draft → issue `sent` / Issued) |
| Exact coding base SHA | `8505a89a0e920ff68e35d0f10b49e98693125674` |
| Branch | `ml/p1-s5-invoice-collection` |
| Disposition | **A2 coding complete (SOURCE)**; merge requires Founder exact-head approval; **no prod apply** |

## Artifacts

| Path | Role |
| --- | --- |
| `docs/governance/decisions/ML-P1_SLICE5_DECISION_PACKET.md` | Ratified PD-S5-01…07 |
| `docs/stabilization/releases/ML-P1_SLICE5_A2_CODING_EVIDENCE.md` | Coding evidence |
| `docs/stabilization/releases/ML-P1_SLICE5_STATE_LEDGER.md` | S5 state |
| `docs/stabilization/releases/ML-P1_SLICE5_RESIDUAL_REGISTER.md` | Residuals |
| `docs/stabilization/releases/reviews/ML-P1_S5_CODING_*_REVIEW.md` | Three coding critique rounds |
| `supabase/migrations/2026072312*_ml_p1_s5_*.sql` | Schema / RPCs / auto-draft (SOURCE) |
| `tests/unit/ml-p1-s5-invoice.test.mjs` | Unit / source guards |

## Explicit non-claims

No production migrations applied · no Hostinger deploy · no Stripe/Braintree · no historical invoice rewrite · merge not authorized without Founder exact-head approval.

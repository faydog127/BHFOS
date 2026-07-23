# Evidence Manifest — ML-P1 Slice 6 Planning

| Field | Value |
| --- | --- |
| Scope | Planning only — Stripe settlement & payment posting |
| Exact main SHA | `a7e1f63781cca7fcba5d706a7a97bd62a17a4c3b` |
| Branch | `plan/ml-p1-s6-stripe-settlement` |
| Disposition | Docs PR ready for Founder Category-C review; **no coding auth** |

## Artifacts

| Path | Role |
| --- | --- |
| `docs/governance/decisions/ML-P1_SLICE6_DECISION_PACKET.md` | PD-S6-01…07 (recommended) |
| `docs/stabilization/releases/ML-P1_SLICE6_BRIEF.md` | Brief |
| `docs/stabilization/releases/ML-P1_SLICE6_ARCHITECTURE_FINDINGS.md` | Architecture |
| `docs/stabilization/releases/ML-P1_SLICE6_RESIDUAL_REGISTER.md` | Residuals |
| `docs/stabilization/releases/ML-P1_SLICE6_STATE_LEDGER.md` | S6 state |
| `docs/stabilization/releases/reviews/ML-P1_S6_PLANNING_*_REVIEW.md` | Three critique rounds |

## EXECUTED (read-only)

- `payments_mode=stripe`
- Invoice settlement snapshot: 25 / paid 9 / provider_id 9 / amount_paid>0 10
- Confirmed `stripe_webhook_events`, `public_payment_attempts` present

## Explicit non-claims

No code · no migrations · no deploys · no Stripe API mutations · no PD ratification · no A2 coding.

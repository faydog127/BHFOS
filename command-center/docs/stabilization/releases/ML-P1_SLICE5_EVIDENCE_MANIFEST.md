# Evidence Manifest — ML-P1 Slice 5 Planning (ratified)

| Field | Value |
| --- | --- |
| Scope | Planning / governance only — completed job → canonical invoice |
| Exact main SHA | `e9cc3317fcb9c84f44643700927699f40c7f1a93` |
| Branch | `plan/ml-p1-s5-invoice-generation` |
| Disposition | PD-S5-01…07 **RATIFIED**; coding **not** authorized |
| Supersedes | Prior planning tip `84452db` / base `3bb175e` |

## Artifacts

| Path | Role |
| --- | --- |
| `docs/governance/decisions/ML-P1_SLICE5_DECISION_PACKET.md` | Ratified PD-S5-01…07 |
| `docs/stabilization/releases/ML-P1_SLICE5_BRIEF.md` | Slice brief |
| `docs/stabilization/releases/ML-P1_SLICE5_ARCHITECTURE_FINDINGS.md` | Architecture (revalidated) |
| `docs/stabilization/releases/ML-P1_SLICE5_PLANNING_DESIGN.md` | Design |
| `docs/stabilization/releases/ML-P1_SLICE5_INVOICE_WRITER_INVENTORY.md` | Writer inventory |
| `docs/stabilization/releases/ML-P1_SLICE5_STATE_LEDGER.md` | S5 state |
| `docs/stabilization/releases/ML-P1_SLICE5_RESIDUAL_REGISTER.md` | Residuals |
| `docs/stabilization/releases/reviews/ML-P1_S5_PLANNING_*_REVIEW.md` | Three critique rounds |

## EXECUTED revalidation (2026-07-23)

- `origin/main` = `e9cc3317fcb9c84f44643700927699f40c7f1a93`
- Live invoices: 25 (`draft` 2, `sent` 14, `paid` 9)
- Indexes: `idx_invoices_unique_job`, `idx_invoices_one_active_per_job`, draft-per-type unique present
- Source: `ML_P1_S4_INVOICE_ON_COMPLETE_ENABLED=false`; kanban `ML_P1_S4_INVOICE_PATH_DENY`

## Explicit non-claims

No Slice 5 coding · no migrations applied · no Stripe · no refunds · no historical invoice rewrite · no Hostinger deploy.

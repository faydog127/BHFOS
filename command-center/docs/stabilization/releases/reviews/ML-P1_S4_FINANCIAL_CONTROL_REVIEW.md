# ML-P1 S4 — Financial Control Review

| Field | Value |
| --- | --- |
| Verdict | **APPROVE** (SOURCE-ONLY) |
| Evidence class | SOURCE-ONLY |

## Findings

- No `INSERT INTO invoices` in S4 RPCs.
- Edge `ML_P1_S4_INVOICE_ON_COMPLETE_ENABLED = false`.
- Change orders never mutate `quotes` rows.
- Approved CO deltas recorded for Slice 5 handoff; rejected/pending not billable.
- Make-safe forced `billable = false`.
- Free-form pricing gated from customer until office release.

## Boundary

- Canonical invoicing remains Slice 5 — PRODUCTION-UNVERIFIED that no other live path still invoices on complete until edge deployed.

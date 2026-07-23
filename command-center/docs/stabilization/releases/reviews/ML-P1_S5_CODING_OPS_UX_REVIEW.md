# ML-P1 S5 Coding — Round 3 Review (Ops / UX)

| Field | Value |
| --- | --- |
| Target | Office invoice panel + Invoices status label + auto-draft soft-fail |
| Verdict | **APPROVE** (SOURCE-ONLY) |

## Findings

- Office panel on completed-job record modal: readiness, create draft, tax adjust, issue, void+reason.
- Invoices list badge shows **Issued** for persisted `sent` (PD-S5-02).
- Auto-draft soft-fails without rolling back job completion; office can create manually.
- No auto-send / payment CTA introduced.

## Residuals

- Write-off UI not present (deferred).
- Full field/tech mobile invoice UX out of scope (tech never edits totals).
- Live A3 validation of auto-draft + issue path still required before merge-to-prod.

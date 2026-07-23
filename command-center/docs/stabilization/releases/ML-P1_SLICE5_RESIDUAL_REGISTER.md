# ML-P1 Slice 5 — Residual Register

| ID | Severity | Status | Note |
| --- | --- | --- | --- |
| R-S5-01 | Medium | Open (coding) | `work-order-update` payment-ensure may still create invoice — must deny in coding |
| R-S5-02 | Medium | Open (coding) | Direct `invoices` insert if RLS permits — force RPC-only |
| R-S5-03 | Low | Open (coding) | Stale UI copy implying auto invoice on complete |
| R-S5-04 | Low | Open (coding) | Lineage columns (quote version / CO ids / calc snapshot) absent on grandfathered rows — best-effort only (PD-S5-07) |
| R-S5-05 | Info | Closed (product) | PD-S5-01…07 ratified 2026-07-23 |
| R-S5-06 | Info | Closed (planning) | Stale base `3bb175e` replaced by `e9cc331` |
| R-S4-07 | Soft | Carry | tenant_id stamps — non-blocking |

No residual authorizes Stripe, historical reprice, or multi-tenant work.

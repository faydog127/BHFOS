# ML-P1 Slice 5 — Residual Register

| ID | Severity | Status | Note |
| --- | --- | --- | --- |
| R-S5-01 | Medium | Closed (coding SOURCE) | Edge ensure/create throws `ML_P1_S5_ALT_WRITER_DENY` |
| R-S5-02 | Medium | Closed (coding SOURCE) | MyMoney create denied; office UI uses RPC facade only |
| R-S5-03 | Low | Closed (coding SOURCE) | Office execution badge → “Invoice via Slice 5 (no auto-send)” |
| R-S5-04 | Low | Open (A3) | Grandfathered rows lack full lineage — best-effort only (PD-S5-07) |
| R-S5-05 | Info | Closed (product) | PD-S5-01…07 ratified 2026-07-23 |
| R-S5-06 | Info | Closed (planning) | Stale base `3bb175e` replaced by `e9cc331` / coding base `8505a89` |
| R-S5-07 | Low | Open (A3) | Auto-draft soft-fail path depends on `events` insert when create fails |
| R-S5-08 | Low | Deferred | Admin write-off RPC/UI not shipped (capability helper present; S5b-compatible) |
| R-S4-07 | Soft | Carry | tenant_id stamps — non-blocking |

No residual authorizes Stripe, historical reprice, prod apply, or multi-tenant work.

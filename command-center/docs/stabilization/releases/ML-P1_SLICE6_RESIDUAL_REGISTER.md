# ML-P1 Slice 6 — Residual Register (planning)

| ID | Severity | Status | Note |
| --- | --- | --- | --- |
| R-S6-01 | High | Open (coding) | G-09 / KI-07 — prove sole paid writers; inventory alternate paid mutators |
| R-S6-02 | Medium | Open (coding) | Dual initiation: Checkout Session vs optional Stripe Invoice in `send-invoice` |
| R-S6-03 | Medium | Open (coding) | Webhook ignores refunds today — must gain explicit refund path under PD-S6-04 A |
| R-S6-04 | Medium | Open (coding) | KI-06 job.payment_status vs invoice settlement coherence |
| R-S6-05 | Low | Open (product) | Partial-pay under-exercised live (`partially_paid`) |
| R-S6-06 | Info | Closed (planning) | Naming: roadmap S5b → packet S6; follow-up → S7 |
| R-S6-07 | Info | Open (Founder) | PD-S6-01…07 recommended, not Category-C ratified |
| R-S5-08 | Low | Carry | Write-off RPC deferred — may touch S6b/admin money if needed |

No residual authorizes auto-charge, vaulting, Terminal, or historical rewrite.

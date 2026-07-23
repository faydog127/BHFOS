# ML-P1 Slice 6 — Residual Register

| ID | Severity | Status | Note |
| --- | --- | --- | --- |
| R-S6-E2E-01 | — | **Closed** | sk_test E2E PASS after settlement hotfixes |
| R-S6-SETTLE-01 | High | **Closed** | S4 writer block on invoice→job payment sync — fixed `20260723150000` |
| R-S6-REFUND-01 | High | **Closed** | Refund wrote generated `balance_due` — fixed `20260723151000` |
| R-S6-UX-01 | Low | Open (optional) | Billing & Payments UX rough-edge feedback |
| R-S6-04 | Low | Mitigated | job.payment_status sync now uses S4 writer context |
| R-S5-08 | Low | Carry | Write-off RPC deferred |

No residual authorizes auto-charge, vaulting, Terminal, or historical rewrite.

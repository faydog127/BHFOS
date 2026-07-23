# ML-P1 Slice 6 — Residual Register

| ID | Severity | Status | Note |
| --- | --- | --- | --- |
| R-S6-E2E-01 | High (gate) | **Open — Founder** | Full-Threat Synthetic E2E blocked: prod Stripe key is `sk_live`; need `sk_test` + test webhook secret |
| R-S6-UX-01 | Medium | **Open — Founder** | Halt for Billing & Payments dashboard UX / rough-edge review |
| R-S6-01 | Medium | Mitigated (A2) | Paid writers gated via S6 flags + webhook quarantine paths; continue monitoring alternate mutators |
| R-S6-02 | Medium | Accepted (S6) | Checkout Session primary; Stripe Invoice dual-path not expanded |
| R-S6-03 | Medium | Closed (A2) | Refund/dispute → recon queue under PD-S6-04 A |
| R-S6-04 | Low | Open (monitor) | `job.payment_status` vs invoice settlement coherence |
| R-S6-05 | Low | Open (product) | Partial-pay under-exercised |
| R-S5-08 | Low | Carry | Write-off RPC deferred |
| R-S6-07 | Info | Closed | PD-S6-01…07 treated ratified for A2/A3 under Founder planning merge path |

No residual authorizes auto-charge, vaulting, Terminal, or historical rewrite.

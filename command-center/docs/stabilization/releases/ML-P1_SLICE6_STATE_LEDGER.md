# ML-P1 Slice 6 — Active State Ledger

| Field | Value |
| --- | --- |
| Active slice | **ML-P1-S6** |
| Stage | **PRODUCTION VALIDATION PASS** — idle awaiting Founder direction |
| Exact A2 head | `02238f4edd506c0756e74d1dbd0f0640f999b5bb` |
| Migrations | `20260723140000` + hotfix `150000` + `151000` **APPLIED** |
| Flags | `invoice_auto_send_enabled=false` (binding) |
| E2E | sk_test synth **PASS** (`S6-SYNTH-1784832909376`) |
| Next | Await Founder; do not start S8 until directed |

## Waiting on Founder

None for S6 close. Optional: Billing & Payments UX rough-edge feedback (non-blocking).

## Halt defaults (unchanged)

Auto-send · auto-charge · portal/vault · Terminal · historical rewrite · live (non-sandbox) Stripe mutation in regression.

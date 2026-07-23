# ML-P1 Persistent Orchestrator — Active Prompt (reconciled)

| Field | Value |
| --- | --- |
| Repo | https://github.com/faydog127/BHFOS |
| S6 A2 head | `02238f4edd506c0756e74d1dbd0f0640f999b5bb` |
| Disposition | **SLICE6_PRODUCTION_VALIDATION_PASS** |
| Active posture | **Idle** — awaiting Founder direction (S8 / next-phase) |

## Completed

- S1–S5 + price-book  
- S6 A2 + A3 structural + settlement hotfixes (`150000`, `151000`)  
- sk_test Full-Threat synth E2E PASS  

## Guard-rails (always)

- Never widen GRANTs without migration review.  
- Never enable auto-charge, saved cards/portal, or Terminal.  
- Checkout immediate capture only; no card data outside Stripe.  
- `invoice_auto_send_enabled` remains **false** unless Major Decision.  
- Health probe GREEN after each deploy.  

# ML-P1 State Ledger

| Field | Value |
| --- | --- |
| Updated | 2026-07-23 |
| Repo | https://github.com/faydog127/BHFOS |
| Current main / live deploy | `206e1411ce89674a9875070586f7e1572d86acc8` |
| Authority | Delegated-Authority Policy **v2026-07-23** |
| Next-phase | `docs/governance/ML-P1_NEXT_PHASE_PRIORITIES.md` |

## Slice / gate posture

| Slice | Gate | Status |
| --- | --- | --- |
| S5 | A3 CLOSED ✔ | |
| **S6** | A3 STRUCTURAL CLOSED ✔ | Deployed `206e141`; Full-Threat E2E **BLOCKED** (`sk_live`); **FOUNDER HALT** (UX + test keys) |
| S7 | Reserved | Not started |
| **S8** | Queued | Do **not** start until Founder clears S6 halt |

## Waiting on Founder

1. Billing & Payments UX / rough-edge feedback  
2. Stripe `sk_test` (+ test webhook) install **or** explicit E2E deferral  
3. Clearance to leave halt before S8 / next-phase coding

## Halt defaults

Auto-send · auto-charge · portal/vault · historical rewrite · live (non-sandbox) Stripe mutation in regression.

# ML-P1 State Ledger

| Field | Value |
| --- | --- |
| Updated | 2026-07-23 |
| Repo | https://github.com/faydog127/BHFOS |
| S6 coding base | `6b300e40747cfceaf743b264d9f58bf7eede079a` |
| Branch | `ml/p1-s6-stripe-settlement` |
| Authority | Delegated + Category-C coding auth for S6 |

## Slice / gate posture

| Slice | Gate | Status |
| --- | --- | --- |
| S5 | A3 CLOSED ✔ | |
| **S6** | **A2 coding** | SOURCE on branch; stop before A3 secret/webhook/auto-charge |
| S7 | Not started | Follow-up |

## Halt

No prod Stripe secret rotate · no webhook live-attach · no auto-charge enable · no portal · no QB export until separate auth.

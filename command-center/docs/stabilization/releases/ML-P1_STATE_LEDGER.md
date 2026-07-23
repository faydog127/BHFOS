# ML-P1 State Ledger

| Field | Value |
| --- | --- |
| Updated | 2026-07-23 |
| Repo | https://github.com/faydog127/BHFOS |
| Current coding branch | `ml/p1-s5-invoice-collection` @ base `8505a89` |
| Evidence bundle (price-book) | `260C5CB28EE1A7F5E4E76A488C38749926CDC8435608F83A1B421808E90A4158` |

## Slice / gate posture

| Slice | Gate | Status |
| --- | --- | --- |
| S4 | CLOSED ✔ | A3 PASS |
| Price-book | A2-MERGED ✔ | PR #100 |
| **S5** | **A2 coding** | PD-S5-01…07 ratified; coding on `ml/p1-s5-invoice-collection`; **no prod apply** |

## Waiting on Founder

- Exact-head **merge approval** for Slice 5 A2 coding PR
- Separate **A3** auth before production migrations / Hostinger / Stripe

## Halt / non-scope

No production migrations · no Hostinger deploy · no Stripe/Braintree · no historical invoice rewrite · merge requires exact-head Founder approval.

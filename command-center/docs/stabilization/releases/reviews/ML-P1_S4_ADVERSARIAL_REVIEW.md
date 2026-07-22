# ML-P1 S4 — Independent Adversarial Test Review

| Field | Value |
| --- | --- |
| Verdict | **PASS with PRODUCTION-UNVERIFIED gaps** |
| Evidence class | EXECUTED unit/source guards; live DB adversaries PRODUCTION-UNVERIFIED |

## Sentinel matrix

| ID | Coverage | Result |
| --- | --- | --- |
| T-S4-01 Unauthorized transition | SOURCE RPC capability/assignment + client matrix | PASS (SOURCE) |
| T-S4-02 Duplicate start idempotent | Mutation ledger + client mutation id test | PASS (unit EXECUTED / SQL SOURCE) |
| T-S4-03 Duplicate complete idempotent | Same | PASS (unit EXECUTED / SQL SOURCE) |
| T-S4-04 Concurrent state change | `FOR UPDATE` + row_version stale deny | PASS (SOURCE) / live race PRODUCTION-UNVERIFIED |
| T-S4-05 Stale technician client | `ML_P1_S4_STALE_CLIENT` | PASS (SOURCE) |
| T-S4-06 Missing evidence DENY | readiness blockers | PASS (SOURCE) |
| T-S4-07 CO approve replay | event mutation id idempotent | PASS (SOURCE) |
| T-S4-08 Tech self-approve DENY | RPC + client unit | PASS (EXECUTED client / SOURCE RPC) |
| T-S4-09 Unapproved work not billable | pending CO blocks; make-safe never billable | PASS (SOURCE) |
| T-S4-10 Approved CO omitted | readiness `approved_change_order_unaccounted` | PASS (SOURCE) |
| T-S4-11 Original quote mutation DENY | no quotes UPDATE in S4 RPCs | PASS (SOURCE guard EXECUTED) |
| T-S4-12 Invoice-on-complete DENY | edge flag false + no invoice insert | PASS (EXECUTED source guard) |
| T-S4-13 Alternate job writer DENY | trigger + edge 409 | PASS (SOURCE) |
| T-S4-14 Reopen without authority | capability + reason | PASS (SOURCE) |
| T-S4-15 Partial txn / no status without audit | transition writes event+mutation in same function | PASS (SOURCE) |
| Ext | Break-glass without proof | `ML_P1_S4_BREAK_GLASS_PROOF_REQUIRED` | PASS (SOURCE) |
| Ext | Free-form before office release | status stays `proposed` | PASS (SOURCE) |

## EXECUTED command

```text
node --test tests/unit/ml-p1-s4-execution.test.mjs
# 11/11 pass
```

# Finance approvability contract

Command Center glkry-10. Approval is a stored-document decision. The screen and `finance_approve_plan` use this contract. A failed approval raises `finance_plan_not_approvable` before any status change, so status and version stay as they were.

Rates normalize to 4 decimal places. Money normalizes to cents. Rounding is half away from zero. There is no extra epsilon. The four hurdles on a stage must total strictly less than 1 at that precision. `0.7 + 0.2 + 0.1 + 0` normalizes to exactly `1.0000` and is rejected. `0.9999` is accepted. `1.0001` is rejected. A single hurdle of `1` is rejected. Exactly 1 leaves required revenue blank, and that blank does not exempt the stage. A missing hurdle on any stage is still a refusal.

## Business rules that block approval

These are the only calculator errors that disable Approve. Each stage is `stage_0` through `stage_3`.

| Rule | Error | Plain language |
|---|---|---|
| A retention hurdle is missing or not a number | `stage:key:missing` | Enter every retention hurdle on all four stages before approving. |
| A hurdle, after scale-4 rounding, is below 0 or at least 1 | `stage:key:invalid` | Each retention hurdle must be at least 0 and less than 1, and the four hurdles on a stage must total less than 1. A total of exactly 1 is not allowed, even when required revenue is blank. |
| The four scale-4 hurdles total 1 or more | `stage:retention_hurdle:invalid` | Same sentence as the row above. |
| Management compensation, after cent rounding, is negative | `stage:owner_management_comp:invalid` | Management compensation cannot be negative. |
| Hurdles are valid and economic operating cost, in cents, is negative | `stage:negative_economic_cost` | Economic operating cost cannot be negative. Check the cost pools and compensation. |
| Hurdles are valid, economic cost is not negative, and cent-rounded required revenue is negative | `stage:negative_revenue` | Required revenue cannot be negative. |

Economic operating cost is hired field payroll, plus direct production pools, plus indirect pools, plus support payroll, plus management compensation, plus the owner field replacement reserve. A missing number makes that cost unknown. Unknown is not a negative, and it does not by itself block approval. Payroll uses the calculator formula and rounds the result to cents. A negative wage, hour, headcount, burden, or week count makes that payroll unknown. Required revenue is economic cost divided by one minus the hurdle total. A total of exactly 1 does not divide, so required revenue stays blank, and the plan is still not approvable. A stage with a blank hurdle is not skipped.

Channel-share mismatch is a warning. It is not an approval error.

## Not part of this contract

- Unsaved edits. The screen asks for a save before approve. The server sees the stored row only.
- Read-only builds, version conflicts, and the one-draft rule.
- Document shape (`finance_plans_monthly_basis`) and the comparison-plan lock. Those are separate failures and use their own sentences.
- Invalid drafts stay editable. This contract does not block Save.

## Server and scan

`finance_plan_approvable` enforces the table above for the approve RPC and for a draft-to-approved update. `20261006141000` aborts if any existing approved row would fail. Drafts are not aborted.

`supabase/tests/finance/preapply_v1_shape_scan.sql` is the read-only scan. It does not call the new functions. `approved_not_approvable` applies this contract to approved rows. A non-zero shape or approvability count means stop, do not apply, and do not bypass constraints. Non-draft rows have no authorized repair in this packet. The operator returns the counts and row ids for a Command Center remediation decision.

`negative_revenue` stays in the contract so the check is not dropped. It runs only after the hurdle total is strictly below 1 and economic cost is not negative. In that range the cent-rounded required revenue is not negative, so that error has no separate input in the parity matrix.

The apply order for the three corrective migrations is in `STAGING_MIGRATION_RUNBOOK.md`. `20261006142000` calls `finance_plan_approvable` and does not repeat the total comparison. Never apply it alone. The superuser edit-guard analysis is `SUPERUSER_EDIT_GUARD.md`.

## Local parity

Both sides normalize before they compare. The server proof calls `finance_approve_plan` and `finance_upgrade_draft_schema` as the authenticated client does. Postgres 16 disposable database. Not staging.

| Case | Screen | RPC | Local result |
|---|---|---|---|
| Missing hurdle | `stage:key:missing` | `finance_plan_not_approvable`; status and version unchanged | SQL 07 PASS |
| Hurdle of 1, including the GUC approve path | `stage:key:invalid` | same refusal; status and version unchanged | SQL 07 PASS |
| `0.7+0.2+0.0999+0` (0.9999) | no retention error | function returns true; approve succeeds | SQL 07 PASS |
| `0.7+0.2+0.1+0` and four quarters of 0.25 | `stage:retention_hurdle:invalid` | same refusal; status and version unchanged. Required revenue stays blank | SQL 07 PASS. Scan of an approved blank-revenue total of 1, before the new function exists: `3\|0\|0\|0\|0\|1` |
| `0.7+0.2+0.1+0.0001` | `stage:retention_hurdle:invalid` | same refusal; status and version unchanged | SQL 07 PASS |
| Known zero cost with a total of 1 | `stage:retention_hurdle:invalid` | function returns false. Required revenue stays blank | SQL 07 PASS |
| Blank hurdle on stage 2, other stages at 0 | `stage_2:growth_reserve_pct:missing` | function returns false. That stage is not exempt | SQL 07 PASS |
| Negative management compensation | `stage:owner_management_comp:invalid` | same refusal; status and version unchanged | SQL 07 PASS. Scan of that approved row before the new function exists: `1\|0\|0\|0\|0\|1` |
| Stage 0 fuel `-10`, other stage 0 pool lines `0`, compensation and replacement `0` | `stage:negative_economic_cost` | same refusal; status and version unchanged | SQL 07 PASS. Scan after that row is the approved plan: `2\|0\|0\|0\|0\|1` |
| Zero hurdles, unknown cost | no approvability error | function returns true | SQL 07 PASS |
| Legitimate version 1 document | historical shape, hurdles of 0 | upgrade to schema 2, then approve; the prior approved plan is superseded | SQL 07 PASS |
| Existing approved row that fails this contract | not a screen case | `20261006141000` raises `finance_approvability_impact_abort` and rolls back | `run_approvability_abort.sh` PASS; function absent; approved row unchanged |

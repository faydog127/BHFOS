# Monthly plan-basis contract

Design only. This slice does not add a schema, a migration, or plan-basis code. Command Center must approve this design before any of it is implemented.

## What is true now (schema version 1)

- `finance_plans.schema_version` is checked to equal 1 (`finance_plans_schema_version`).
- `finance_plans.inputs` is accepted only when it matches `blankPlanInputs()`. Unknown keys are rejected.
- That document has no monthly comparison map.
- `declaredMonthlyBasis` returns null for schema version 1. It does not read `stages.*.scenario.projected_revenue` or any other stage figure.
- Monthly Check-In Plan and Variance render `--`. That means no declared basis, not zero.
- `finance_monthly_actuals.comparison_plan_id` points at one plan row of the same tenant. It is set only when that plan is approved at association time. Once set, the basis, tenant, and month cannot be changed. Superseding the plan does not detach it.
- Approved plan inputs are not rewritten in place. A newer plan is a new row.

## Proposed rule

1. A monthly plan value exists only when the approved plan stores it explicitly.
2. No reader spreads an annual figure across months.
3. No reader maps a stage scenario value, including projected revenue, into a monthly plan value.
4. The basis is an explicit map. A missing metric and a null both mean not planned.
5. Zero is a planned zero only when it is stored as zero. It is never implied.
6. Approved plan history stays immutable. Supersession inserts a new plan row. It does not update the approved row's id, inputs, or schema version.
7. An actual's `comparison_plan_id` keeps identifying that historical plan row. Variance for the month is read from that row only. A later approved plan does not replace it.
8. Planned values, if later approved, are limited to the Monthly Check-In fact fields (`CHECKIN_FIELDS` in `actuals.js`). Derived metrics stay calculated. They are not stored as a second plan input.
9. Month keys are `YYYY-MM-01`. A month left out of the map is not planned.
10. Schema version 1 keeps returning a null basis. Version 1 rows are not reinterpreted.

## Schema change required

Yes, before any storage.

- `schema_version` must increment. Version 1 plans cannot grow a monthly map without changing their meaning.
- The check constraint `finance_plans.schema_version = 1` must be widened in a new forward migration. Until that migration exists, a version 2 row cannot be stored.
- `finance_monthly_actuals.schema_version` can stay 1. The basis lives on the plan the actual already points at. No actuals migration is proposed.
- `validatePlanInputs` and `declaredMonthlyBasis` would have to learn version 2. They do not, in this slice.

Recommended shape, not implemented: put the map on the plan document as `inputs.monthly_basis` at schema version 2, because `comparison_plan_id` already snapshots that row. A separate table is not proposed. No migration is added here.

## Unresolved questions for Command Center

- Approve or reject `inputs.monthly_basis` at schema version 2 as the storage shape.
- Confirm planned values are only the check-in fact fields, and that derived metrics never receive their own planned numbers.
- Confirm version 1 plans stay permanently without a monthly basis, including after this design is approved.

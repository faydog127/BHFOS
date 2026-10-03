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

Yes, before any storage. Nothing in this section is implemented.

Recommended shape: put the map on the existing plan document as `inputs.monthly_basis` at schema version 2, because `comparison_plan_id` already snapshots that row. A separate table is not proposed.

Verified against the current migrations and `persistence.js`:

- `finance_plans_schema_version` is `check (schema_version = 1)` in `20261003053000_finance_stage_a_persistence.sql`. A version 2 row cannot be stored until a new forward migration widens that check. `finance_monthly_actuals` has its own `schema_version = 1` check. This design does not widen the actuals check. The basis stays on the plan.
- `finance_plan_before_update` assigns `new.schema_version := old.schema_version` on every plan update. Later migrations do not replace that function. A version 1 draft cannot be upgraded in place. Approval also forces `new.inputs := old.inputs`, so approval cannot change the document either. The insert trigger does not overwrite `schema_version`. The check constraint is what blocks a version 2 insert today.
- The live `finance_open_draft` is `20261003113216_finance_one_draft_per_tenant.sql`. It inserts `source_row.schema_version` and `source_row.inputs`. If a draft already exists, it returns that draft and does not insert another. The earlier copy in `20261003063000` was replaced and behaved the same on the copy. A version 2 draft cannot be created from an approved version 1 plan by the current RPC.
- `FINANCE_PLAN_SCHEMA_VERSION` is 1. `readPlan` returns `finance_schema_unsupported` when `schema_version` is anything else. `validatePlanInputs` checks `assertShape(blankPlanInputs())`, so an unknown key, including `monthly_basis`, is `invalid_inputs`. Both must learn version 2 only after this design is approved.
- The database check on plan inputs is `jsonb_typeof(inputs) = 'object'` (`finance_plans_inputs_object`). It does not inspect keys. Today `monthly_basis` validation is JavaScript only.
- `finance_plans` and `finance_monthly_actuals` already use `enable row level security` and `force row level security`. This shape adds no table, so it needs no RLS change.

Rules the design adds, still not implemented:

1. Widen `finance_plans.schema_version` in a new forward migration. Keep the update trigger's `new.schema_version := old.schema_version`. Do not upgrade a version 1 row in place.
2. Replace `finance_open_draft` in that same forward migration. A version 2 draft is a new insert with `schema_version` 2, and only when no draft exists. The approved version 1 row stays version 1. `monthly_basis` on the new draft starts absent or null. It is not copied from stage scenario values and not inferred from the version 1 document. Non-monthly inputs may be copied only if Command Center says so when it approves this design.
3. Do not leave `monthly_basis` as a JavaScript-only check. The forward migration adds a database check, or a trigger function that is `security invoker` with a fixed `search_path`, so a raw insert cannot store an unvalidated map. The JavaScript validator remains the app gate. The exact SQL expression is part of the later implementation review, not this slice.
4. An actual whose `comparison_plan_id` points at a version 1 plan shows an explicit no-basis state. Plan and Variance stay `--`. They are never 0. That stays true after other plans are version 2. `declaredMonthlyBasis` already returns null for schema version 1, and the check-in already renders that as not zero.

## Unresolved questions for Command Center

- Approve or reject `inputs.monthly_basis` at schema version 2 as the storage shape.
- Confirm planned values are only the check-in fact fields, and that derived metrics never receive their own planned numbers.
- Confirm version 1 plans stay permanently without a monthly basis, including after this design is approved.
- If a version 1 draft already exists, the current RPC returns it and a second draft cannot be inserted. This design does not add a delete. How is that draft finished before a version 2 draft can be opened?
- Confirm the database check, rather than JavaScript alone, is the required gate for `monthly_basis`.

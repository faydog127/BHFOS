# Monthly plan-basis contract

Stage C1 implements this contract in `20261003180000_finance_plan_monthly_basis.sql`. Command Center accepted the shape in the Stage C ruling. The sections below that describe a version-1-only check are the pre-C1 constraints that the migration replaces.

Implemented behavior:

- `finance_plans.schema_version` may be 1 or 2. `finance_monthly_actuals.schema_version` stays 1.
- Version 2 stores `inputs.monthly_basis`. A missing month, a missing metric, and JSON null mean not planned. Zero is a planned zero. The map has only the 13 check-in fact fields. Derived figures are calculated, not stored.
- Known planned channels cannot exceed planned Total Revenue. When all three channels are present they must equal that total. The database check rejects an invalid map, including a raw authenticated write.
- Version 1 never has `monthly_basis`. An ordinary update cannot change `schema_version`.
- `finance_upgrade_draft_schema` is the only transition from a version 1 draft to a version 2 draft. It requires the expected version, keeps the other inputs and notes, and adds an empty map. Approved and superseded version 1 rows stay version 1.
- `finance_open_draft` returns an existing version 2 draft. If the existing draft is version 1, it upgrades that same row. Otherwise it inserts a new version 2 draft: an empty map when the approved plan is version 1, or a copy of `monthly_basis` when the approved plan is version 2.
- Check-in Plan and Variance read the plan named by `comparison_plan_id` for that month. A version 1 plan stays `--`. A later approved plan does not replace that id.

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

The pre-C1 constraints below are what Stage C1 replaced. They are not the live rules after `20261003180000_finance_plan_monthly_basis.sql`.

Recommended shape: put the map on the existing plan document as `inputs.monthly_basis` at schema version 2, because `comparison_plan_id` already snapshots that row. A separate table is not proposed.

Verified against the current migrations and `persistence.js`:

- `finance_plans_schema_version` is `check (schema_version = 1)` in `20261003053000_finance_stage_a_persistence.sql`. A version 2 row cannot be stored until a new forward migration widens that check. `finance_monthly_actuals` has its own `schema_version = 1` check. This design does not widen the actuals check. The basis stays on the plan.
- `finance_plan_before_update` assigns `new.schema_version := old.schema_version` on every plan update. Later migrations do not replace that function. A version 1 draft cannot be upgraded in place. Approval also forces `new.inputs := old.inputs`, so approval cannot change the document either. The insert trigger does not overwrite `schema_version`. The check constraint is what blocks a version 2 insert today.
- The live `finance_open_draft` is `20261003113216_finance_one_draft_per_tenant.sql`. It inserts `source_row.schema_version` and `source_row.inputs`. If a draft already exists, it returns that draft and does not insert another. The earlier copy in `20261003063000` was replaced and behaved the same on the copy. A version 2 draft cannot be created from an approved version 1 plan by the current RPC.
- `FINANCE_PLAN_SCHEMA_VERSION` is 1. `readPlan` returns `finance_schema_unsupported` when `schema_version` is anything else. `validatePlanInputs` checks `assertShape(blankPlanInputs())`, so an unknown key, including `monthly_basis`, is `invalid_inputs`. Both must learn version 2 only after this design is approved.
- The database check on plan inputs is `jsonb_typeof(inputs) = 'object'` (`finance_plans_inputs_object`). It does not inspect keys. Today `monthly_basis` validation is JavaScript only.
- `finance_plans` and `finance_monthly_actuals` already use `enable row level security` and `force row level security`. This shape adds no table, so it needs no RLS change.

The Stage C ruling answered the open questions. Version 2 uses `inputs.monthly_basis` for the 13 fact fields only. Version 1 stays without a monthly basis. A living version 1 draft is upgraded in place, not copied into a second draft. Approved and superseded rows are not upgraded in place. The database check is the gate for a raw write. Non-monthly inputs and notes are copied. An empty map is not inferred from stage figures.

An actual whose `comparison_plan_id` points at a version 1 plan shows `checkin-no-monthly-basis`. Plan and Variance stay `--`. They are never 0. That stays true after a newer plan is version 2.

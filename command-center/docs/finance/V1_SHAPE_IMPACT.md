# Version 1 shape impact

`20261006140000_finance_v1_document_shape.sql` replaces `finance_plan_document_ok`. Version 1 must omit `monthly_basis` and must include the calculator sections version 2 already requires: `structural` (four keys), `stages` (`stage_0` through `stage_3` objects), `staffing` array, `owner_field_replacement` (`wage` and `burden`), `cost_pools` object, `channels` array, and `services` object.

The migration does not drop or re-add `finance_plans_monthly_basis`, and it does not rewrite rows. If any existing row would fail the new check, the migration raises `finance_v1_shape_impact_abort` with the counts and the transaction rolls back. A notice with zeros is printed only when every existing row passes.

Do not use `finance_plan_document_ok` for a pre-apply count. Before this migration, that function's version 1 branch only checks that `monthly_basis` is absent, so `{"kept":true}` is counted as valid.

## Read-only scan

The standalone scan is `command-center/supabase/tests/finance/preapply_v1_shape_scan.sql`. It is a single `SELECT`. It does not create objects, write rows, or call `finance_plan_document_ok`. An authorized operator can run it on hosted staging before apply. A non-zero `v1_would_fail`, `v1_nondraft_would_fail`, or `v2_fail` stops the apply.

Non-draft partial version 1 rows have no authorized repair. Approved and superseded inputs are frozen by `finance_plan_before_update`. Do not delete them under replica mode. Do not disable triggers. Do not edit an already-applied migration.

## Local proof

`supabase/tests/finance/run_shape_abort.sh` builds the pre-migration schema, approves one `{"kept":true}` version 1 plan, and leaves a second partial version 1 draft. The old function count is `old_v1_would_fail = 0`. The inline scan reports `v1_would_fail = 2` and `v1_nondraft_would_fail = 1`. Applying `20261006140000` then exits non-zero with `finance_v1_shape_impact_abort total=2 v1=2 v1_would_fail=2 v2_would_fail=0`, and the old function is still in place.

A second empty database applies the migration and prints `finance_v1_shape_impact total=0 v1=0 v1_would_fail=0 v2_would_fail=0`.

Hosted staging and production were not queried.

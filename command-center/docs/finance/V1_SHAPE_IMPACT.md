# Version 1 shape impact

`20261006140000_finance_v1_document_shape.sql` replaces `finance_plan_document_ok`. Version 1 must omit `monthly_basis` and must include the calculator sections version 2 already requires: `structural` (four keys), `stages` (`stage_0` through `stage_3` objects), `staffing` array, `owner_field_replacement` (`wage` and `burden`), `cost_pools` object, `channels` array, and `services` object.

The migration does not drop or re-add `finance_plans_monthly_basis`, and it does not rewrite rows. If any existing row would fail the new check, the migration raises `finance_v1_shape_impact_abort` with the counts and the transaction rolls back. A notice with zeros is printed only when every existing row passes.

Do not use `finance_plan_document_ok` for a pre-apply count. Before this migration, that function's version 1 branch only checks that `monthly_basis` is absent, so `{"kept":true}` is counted as valid.

## Read-only scan

The standalone scan is `command-center/supabase/tests/finance/preapply_v1_shape_scan.sql`. It is a single `SELECT`. It does not create objects, write rows, or call `finance_plan_document_ok` or `finance_plan_approvable`. `approved_not_approvable` applies `docs/finance/APPROVABILITY_CONTRACT.md` to approved rows. An authorized operator can run it on hosted staging before apply. A non-zero `v1_would_fail`, `v1_nondraft_would_fail`, `v2_fail`, or `approved_not_approvable` stops the apply. The operator returns those counts and the matching row ids. That is the remediation proposal. This packet does not repair non-draft rows.

Non-draft partial version 1 rows have no authorized repair. Approved and superseded inputs are frozen by `finance_plan_before_update`. Do not delete them under replica mode. Do not disable triggers. Do not edit an already-applied migration.

## Local proof

`supabase/tests/finance/run_shape_abort.sh` builds the pre-migration schema, approves one `{"kept":true}` version 1 plan, and leaves a second partial version 1 draft. The old function count is `old_v1_would_fail = 0`. The inline scan reports `2|2|2|1|0|1`: two version 1 failures, one of them non-draft, and the approved partial row also fails approvability. Applying `20261006140000` then exits non-zero with `finance_v1_shape_impact_abort total=2 v1=2 v1_would_fail=2 v2_would_fail=0`, and the old function is still in place.

A second empty database applies the migration and prints `finance_v1_shape_impact total=0 v1=0 v1_would_fail=0 v2_would_fail=0`. Its clean scan is `2|1|0|0|0|0` after the authorized historical seed.

`supabase/tests/finance/run_approvability_abort.sh` uses the same scan against proposed approvability. An approved negative management-compensation row is `1|0|0|0|0|1`. After a negative stage-0 fuel pool supersedes it, the scan is `2|0|0|0|0|1`. Applying `20261006141000` then aborts with `finance_approvability_impact_abort approved_not_approvable=1`. The approved pool row stays approved and `finance_plan_approvable` is absent.

Hosted staging and production were not queried.

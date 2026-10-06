# Version 1 shape impact

`20261006140000_finance_v1_document_shape.sql` replaces `finance_plan_document_ok`. Version 1 must omit `monthly_basis` and must include the same calculator sections version 2 already requires: `structural` (four keys), `stages` (`stage_0` through `stage_3` objects), `staffing` array, `owner_field_replacement` (`wage` and `burden`), `cost_pools` object, `channels` array, and `services` object.

The migration does not drop or re-add `finance_plans_monthly_basis`, so existing rows are not rechecked and are not rewritten. The next insert or update of a partial version 1 document fails that check. A section-complete historical version 1 document stays valid. `finance_upgrade_draft_schema` can still move that document to version 2.

## Rows that would fail on the next write

The migration prints:

```text
finance_v1_shape_impact total=<n> v1=<n> v1_would_fail=<n> v2_would_fail=<n>
```

The same count, without writing, is:

```sql
select
  count(*) as total,
  count(*) filter (where schema_version = 1) as v1,
  count(*) filter (
    where schema_version = 1
      and not public.finance_plan_document_ok(schema_version, inputs)
  ) as v1_would_fail,
  count(*) filter (
    where schema_version = 2
      and not public.finance_plan_document_ok(schema_version, inputs)
  ) as v2_would_fail
from public.finance_plans;
```

## Local disposable result

`supabase/tests/finance/run_local_disposable.sh` on Postgres 16 printed:

```text
finance_v1_shape_impact total=0 v1=0 v1_would_fail=0 v2_would_fail=0
```

That database had no finance rows. A missing section makes `jsonb_typeof` null, and a null check expression would pass, so the helper uses `is not distinct from` and `coalesce(..., false)`. A partial document then fails the check on write.

Hosted staging and production were not queried.

## If a hosted apply is later authorized

Read the notice on that database before leaving the session. A non-zero `v1_would_fail` means those rows remain stored and will fail the next update until an ordinary authenticated admin replaces the document with a section-complete version 1 document. Do not delete them under replica mode. Do not edit an already-applied migration.

# Malformed plan preflight

Documentation only. Do not run this against production, n8n Assurance Preview, or Command Center staging from the hardening change.

Run both queries on the target database before `20261003223000_finance_plan_v2_required_sections.sql` is applied. The Finance screen has no replace-invalid-draft button. Do not weaken `finance_plan_document_ok`.

## Version 2 rows — stop the migration

A row here fails the new constraint. Repair it with an ordinary admin `UPDATE` to a valid version 2 document before applying. If this query returns any row, do not apply.

```sql
select id, status, schema_version, 'stop-apply' as disposition
from public.finance_plans
where schema_version = 2
  and (
    not (inputs ? 'monthly_basis')
    or jsonb_typeof(inputs -> 'monthly_basis') is distinct from 'object'
    or jsonb_typeof(inputs -> 'structural') is distinct from 'object'
    or jsonb_typeof(inputs -> 'stages') is distinct from 'object'
    or jsonb_typeof(inputs -> 'staffing') is distinct from 'array'
    or jsonb_typeof(inputs -> 'owner_field_replacement') is distinct from 'object'
    or jsonb_typeof(inputs -> 'cost_pools') is distinct from 'object'
    or jsonb_typeof(inputs -> 'channels') is distinct from 'array'
    or jsonb_typeof(inputs -> 'services') is distinct from 'object'
    or jsonb_typeof(inputs -> 'stages' -> 'stage_0') is distinct from 'object'
    or jsonb_typeof(inputs -> 'stages' -> 'stage_1') is distinct from 'object'
    or jsonb_typeof(inputs -> 'stages' -> 'stage_2') is distinct from 'object'
    or jsonb_typeof(inputs -> 'stages' -> 'stage_3') is distinct from 'object'
    or not (inputs -> 'structural' ? 'weeks_per_year')
    or not (inputs -> 'structural' ? 'months_per_year')
    or not (inputs -> 'structural' ? 'days_per_month_ar')
    or not (inputs -> 'structural' ? 'rounding_increment_usd')
    or not (inputs -> 'owner_field_replacement' ? 'wage')
    or not (inputs -> 'owner_field_replacement' ? 'burden')
    or exists (
      select 1
      from jsonb_object_keys(coalesce(inputs -> 'monthly_basis', '{}'::jsonb)) as month_key
      where month_key !~ '^[0-9]{4}-(0[1-9]|1[0-2])-01$'
        or left(month_key, 4) = '0000'
    )
    or exists (
      select 1
      from jsonb_each(coalesce(inputs -> 'monthly_basis', '{}'::jsonb)) as month(month_key, month_row)
      cross join lateral jsonb_each(coalesce(month_row, '{}'::jsonb)) as metric(metric_key, metric_value)
      where metric_value #>> '{}' ~ '^-0+(\.0+)?$'
    )
  );
```

## Version 1 rows — stop upgrade and open-draft

A minimal version 1 row, including `{}` and `{"kept":true}`, is still valid storage. The migration does not rewrite it. `finance_upgrade_draft_schema` and `finance_open_draft` copy that document, add `monthly_basis`, and then raise `23514` because the version 2 check requires the calculator sections.

If this query returns any row, the migration may still be applied. Do not run upgrade or open-draft on those rows until an ordinary admin `UPDATE` replaces the document with a full section document. There is no replace-invalid-draft button and no new product meaning.

```sql
select id, status, schema_version, 'stop-upgrade-and-open' as disposition
from public.finance_plans
where schema_version = 1
  and (
    jsonb_typeof(inputs -> 'structural') is distinct from 'object'
    or jsonb_typeof(inputs -> 'stages') is distinct from 'object'
    or jsonb_typeof(inputs -> 'staffing') is distinct from 'array'
    or jsonb_typeof(inputs -> 'owner_field_replacement') is distinct from 'object'
    or jsonb_typeof(inputs -> 'cost_pools') is distinct from 'object'
    or jsonb_typeof(inputs -> 'channels') is distinct from 'array'
    or jsonb_typeof(inputs -> 'services') is distinct from 'object'
    or jsonb_typeof(inputs -> 'stages' -> 'stage_0') is distinct from 'object'
    or jsonb_typeof(inputs -> 'stages' -> 'stage_1') is distinct from 'object'
    or jsonb_typeof(inputs -> 'stages' -> 'stage_2') is distinct from 'object'
    or jsonb_typeof(inputs -> 'stages' -> 'stage_3') is distinct from 'object'
    or not (inputs -> 'structural' ? 'weeks_per_year')
    or not (inputs -> 'structural' ? 'months_per_year')
    or not (inputs -> 'structural' ? 'days_per_month_ar')
    or not (inputs -> 'structural' ? 'rounding_increment_usd')
    or not (inputs -> 'owner_field_replacement' ? 'wage')
    or not (inputs -> 'owner_field_replacement' ? 'burden')
    or inputs ? 'monthly_basis'
  );
```

Zero rows on both queries means this structural check is clear. It does not approve a remote apply.

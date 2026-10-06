-- READ-ONLY pre-apply scan for 20261006140000_finance_v1_document_shape.sql.
-- Run this on hosted staging before that migration, as a role that can SELECT
-- public.finance_plans. This file does not create objects, write rows, or call
-- finance_plan_document_ok. Before the migration, that function's version 1
-- branch only checks that monthly_basis is absent, so it under-counts partial
-- version 1 documents such as {"kept":true}.
--
-- Version 2 month rules are already the applied check from
-- 20261003223000_finance_plan_v2_required_sections.sql. This migration does not
-- loosen them. v2_fail below is the section and monthly_basis shape that both
-- the applied function and the new function require. A non-zero count stops
-- the apply. Non-draft partial version 1 rows have no authorized repair.
--
-- No replica mode. No trigger changes. Do not apply a migration from this file.

select
  count(*) as total,
  count(*) filter (where schema_version = 1) as v1,
  count(*) filter (where schema_version = 1 and not coalesce(
      jsonb_typeof(inputs) = 'object'
      and not (inputs ? 'monthly_basis')
      and jsonb_typeof(inputs -> 'structural') = 'object'
      and jsonb_typeof(inputs -> 'stages') = 'object'
      and jsonb_typeof(inputs -> 'staffing') = 'array'
      and jsonb_typeof(inputs -> 'owner_field_replacement') = 'object'
      and jsonb_typeof(inputs -> 'cost_pools') = 'object'
      and jsonb_typeof(inputs -> 'channels') = 'array'
      and jsonb_typeof(inputs -> 'services') = 'object'
      and jsonb_typeof(inputs -> 'stages' -> 'stage_0') = 'object'
      and jsonb_typeof(inputs -> 'stages' -> 'stage_1') = 'object'
      and jsonb_typeof(inputs -> 'stages' -> 'stage_2') = 'object'
      and jsonb_typeof(inputs -> 'stages' -> 'stage_3') = 'object'
      and (inputs -> 'structural') ?& array['weeks_per_year','months_per_year','days_per_month_ar','rounding_increment_usd']
      and (inputs -> 'owner_field_replacement') ?& array['wage','burden'],
      false)) as v1_would_fail,
  count(*) filter (where schema_version = 1 and status <> 'draft' and not coalesce(
      jsonb_typeof(inputs) = 'object'
      and not (inputs ? 'monthly_basis')
      and jsonb_typeof(inputs -> 'structural') = 'object'
      and jsonb_typeof(inputs -> 'stages') = 'object'
      and jsonb_typeof(inputs -> 'staffing') = 'array'
      and jsonb_typeof(inputs -> 'owner_field_replacement') = 'object'
      and jsonb_typeof(inputs -> 'cost_pools') = 'object'
      and jsonb_typeof(inputs -> 'channels') = 'array'
      and jsonb_typeof(inputs -> 'services') = 'object'
      and jsonb_typeof(inputs -> 'stages' -> 'stage_0') = 'object'
      and jsonb_typeof(inputs -> 'stages' -> 'stage_1') = 'object'
      and jsonb_typeof(inputs -> 'stages' -> 'stage_2') = 'object'
      and jsonb_typeof(inputs -> 'stages' -> 'stage_3') = 'object'
      and (inputs -> 'structural') ?& array['weeks_per_year','months_per_year','days_per_month_ar','rounding_increment_usd']
      and (inputs -> 'owner_field_replacement') ?& array['wage','burden'],
      false)) as v1_nondraft_would_fail,
  count(*) filter (where schema_version = 2 and not coalesce(
      jsonb_typeof(inputs) = 'object'
      and (inputs ? 'monthly_basis')
      and jsonb_typeof(inputs -> 'monthly_basis') = 'object'
      and jsonb_typeof(inputs -> 'structural') = 'object'
      and jsonb_typeof(inputs -> 'stages') = 'object'
      and jsonb_typeof(inputs -> 'staffing') = 'array'
      and jsonb_typeof(inputs -> 'owner_field_replacement') = 'object'
      and jsonb_typeof(inputs -> 'cost_pools') = 'object'
      and jsonb_typeof(inputs -> 'channels') = 'array'
      and jsonb_typeof(inputs -> 'services') = 'object'
      and jsonb_typeof(inputs -> 'stages' -> 'stage_0') = 'object'
      and jsonb_typeof(inputs -> 'stages' -> 'stage_1') = 'object'
      and jsonb_typeof(inputs -> 'stages' -> 'stage_2') = 'object'
      and jsonb_typeof(inputs -> 'stages' -> 'stage_3') = 'object'
      and (inputs -> 'structural') ?& array['weeks_per_year','months_per_year','days_per_month_ar','rounding_increment_usd']
      and (inputs -> 'owner_field_replacement') ?& array['wage','burden'],
      false)) as v2_fail
from public.finance_plans;

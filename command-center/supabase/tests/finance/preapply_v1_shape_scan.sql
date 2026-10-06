-- READ-ONLY pre-apply scan for the v1 shape migration and the approvability
-- contract. Run it with psql on hosted staging before apply, as a role that
-- can SELECT public.finance_plans. This file does not create objects, write
-- rows, or call finance_plan_document_ok or finance_plan_approvable.
--
-- v1_would_fail / v2_fail are document shape. approved_not_approvable counts
-- approved rows whose stored inputs fail the proposed approvability rules
-- (scale-4 hurdles, a hurdle total of 1 or more, cent-rounded money,
-- negative economic cost, negative required revenue). A blank required
-- revenue does not exempt an approved row. Drafts are omitted there.
--
-- Any count above zero in v1_would_fail, v1_nondraft_would_fail, v2_fail, or
-- approved_not_approvable means STOP. Do not apply. Do not use replica mode,
-- disable triggers, or bypass constraints. Return the counts and the row ids
-- from a follow-up SELECT of the same predicates. Non-draft rows have no
-- authorized repair in this packet.
--
-- Version 2 month rules are already the applied check from
-- 20261003223000_finance_plan_v2_required_sections.sql. v2_fail is the section
-- and monthly_basis shape. No replica mode. No trigger changes.

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
      false)) as v2_fail,
  count(*) filter (where status = 'approved' and (
    jsonb_typeof(inputs -> 'stages') is distinct from 'object'
    or exists (
      select 1
      from unnest(array['stage_0','stage_1','stage_2','stage_3']::text[]) as stage_key
      where jsonb_typeof(inputs -> 'stages' -> stage_key) is distinct from 'object'
        or exists (
          select 1
          from unnest(array['true_operating_profit_pct','growth_reserve_pct','bad_debt_warranty_pct','unidentified_cost_contingency_pct']::text[]) as hurdle_key
          where jsonb_typeof(inputs -> 'stages' -> stage_key -> hurdle_key) is distinct from 'number'
            or round((inputs -> 'stages' -> stage_key -> hurdle_key #>> '{}')::numeric, 4) < 0
            or round((inputs -> 'stages' -> stage_key -> hurdle_key #>> '{}')::numeric, 4) >= 1
        )
        or coalesce((
          select sum(round((inputs -> 'stages' -> stage_key -> hurdle_key #>> '{}')::numeric, 4))
          from unnest(array['true_operating_profit_pct','growth_reserve_pct','bad_debt_warranty_pct','unidentified_cost_contingency_pct']::text[]) as hurdle_key
          where jsonb_typeof(inputs -> 'stages' -> stage_key -> hurdle_key) = 'number'
        ), 0) >= 1
        or (
          jsonb_typeof(inputs -> 'stages' -> stage_key -> 'owner_management_comp') = 'number'
          and round((inputs -> 'stages' -> stage_key -> 'owner_management_comp' #>> '{}')::numeric, 2) < 0
        )
        or (
          select economic < 0
          from (
            select
              case
                when hired is null or support is null or direct_cost is null or indirect_cost is null or owner_cents is null or replacement is null then null
                else hired + support + direct_cost + indirect_cost + owner_cents + replacement
              end as economic
            from (
              select
                case
                  when inputs -> 'staffing' is not null and jsonb_typeof(inputs -> 'staffing') is distinct from 'array' then null
                  when exists (
                    select 1
                    from jsonb_array_elements(coalesce(inputs -> 'staffing', '[]'::jsonb)) as role
                    where role.value ->> 'classification' = 'direct_field'
                      and (
                        jsonb_typeof(role.value -> 'headcount' -> stage_key) is distinct from 'number'
                        or jsonb_typeof(role.value -> 'wage') is distinct from 'number'
                        or jsonb_typeof(role.value -> 'weekly_hours') is distinct from 'number'
                        or jsonb_typeof(role.value -> 'burden') is distinct from 'number'
                        or jsonb_typeof(inputs -> 'structural' -> 'weeks_per_year') is distinct from 'number'
                        or jsonb_typeof(inputs -> 'structural' -> 'months_per_year') is distinct from 'number'
                        or (role.value -> 'headcount' -> stage_key #>> '{}')::numeric < 0
                        or (role.value -> 'wage' #>> '{}')::numeric < 0
                        or (role.value -> 'weekly_hours' #>> '{}')::numeric < 0
                        or (role.value -> 'burden' #>> '{}')::numeric < 0
                        or (inputs -> 'structural' -> 'weeks_per_year' #>> '{}')::numeric < 0
                        or (inputs -> 'structural' -> 'months_per_year' #>> '{}')::numeric <= 0
                      )
                  ) then null
                  else coalesce((
                    select sum(round(
                      (role.value -> 'headcount' -> stage_key #>> '{}')::numeric
                      * (role.value -> 'wage' #>> '{}')::numeric
                      * (role.value -> 'weekly_hours' #>> '{}')::numeric
                      * (inputs -> 'structural' -> 'weeks_per_year' #>> '{}')::numeric
                      / (inputs -> 'structural' -> 'months_per_year' #>> '{}')::numeric
                      * (1 + (role.value -> 'burden' #>> '{}')::numeric), 2))
                    from jsonb_array_elements(coalesce(inputs -> 'staffing', '[]'::jsonb)) as role
                    where role.value ->> 'classification' = 'direct_field'
                  ), 0)
                end as hired,
                case
                  when inputs -> 'staffing' is not null and jsonb_typeof(inputs -> 'staffing') is distinct from 'array' then null
                  when exists (
                    select 1
                    from jsonb_array_elements(coalesce(inputs -> 'staffing', '[]'::jsonb)) as role
                    where role.value ->> 'classification' = 'indirect_support'
                      and (
                        jsonb_typeof(role.value -> 'headcount' -> stage_key) is distinct from 'number'
                        or jsonb_typeof(role.value -> 'wage') is distinct from 'number'
                        or jsonb_typeof(role.value -> 'weekly_hours') is distinct from 'number'
                        or jsonb_typeof(role.value -> 'burden') is distinct from 'number'
                        or jsonb_typeof(inputs -> 'structural' -> 'weeks_per_year') is distinct from 'number'
                        or jsonb_typeof(inputs -> 'structural' -> 'months_per_year') is distinct from 'number'
                        or (role.value -> 'headcount' -> stage_key #>> '{}')::numeric < 0
                        or (role.value -> 'wage' #>> '{}')::numeric < 0
                        or (role.value -> 'weekly_hours' #>> '{}')::numeric < 0
                        or (role.value -> 'burden' #>> '{}')::numeric < 0
                        or (inputs -> 'structural' -> 'weeks_per_year' #>> '{}')::numeric < 0
                        or (inputs -> 'structural' -> 'months_per_year' #>> '{}')::numeric <= 0
                      )
                  ) then null
                  else coalesce((
                    select sum(round(
                      (role.value -> 'headcount' -> stage_key #>> '{}')::numeric
                      * (role.value -> 'wage' #>> '{}')::numeric
                      * (role.value -> 'weekly_hours' #>> '{}')::numeric
                      * (inputs -> 'structural' -> 'weeks_per_year' #>> '{}')::numeric
                      / (inputs -> 'structural' -> 'months_per_year' #>> '{}')::numeric
                      * (1 + (role.value -> 'burden' #>> '{}')::numeric), 2))
                    from jsonb_array_elements(coalesce(inputs -> 'staffing', '[]'::jsonb)) as role
                    where role.value ->> 'classification' = 'indirect_support'
                  ), 0)
                end as support,
                (
                  select case when count(*) filter (where jsonb_typeof(raw) is distinct from 'number') > 0 then null
                    else sum(round((raw #>> '{}')::numeric, 2)) end
                  from unnest(array['fuel','consumables','job_rentals']::text[]) as line
                  cross join lateral (select inputs -> 'cost_pools' -> 'direct_production' -> line -> stage_key as raw) as got
                ) as direct_cost,
                (
                  select case when count(*) filter (where pool_total is null) > 0 then null else sum(pool_total) end
                  from (
                    select (
                      select case when count(*) filter (where jsonb_typeof(raw) is distinct from 'number') > 0 then null
                        else sum(round((raw #>> '{}')::numeric, 2)) end
                      from unnest(lines) as line
                      cross join lateral (select inputs -> 'cost_pools' -> grp -> line -> stage_key as raw) as got
                    ) as pool_total
                    from (values
                      ('indirect_field', array['vehicle_payments','maintenance','equipment_financing','tooling_ppe','replacement_sinking_fund']),
                      ('ga', array['office_shop','utilities','software','accounting_legal','office_misc']),
                      ('sales', array['marketing','memberships','collateral']),
                      ('insurance', array['gl_package','commercial_auto','umbrella','workers_comp_fixed','licensing'])
                    ) as pools(grp, lines)
                  ) as pooled
                ) as indirect_cost,
                case
                  when jsonb_typeof(inputs -> 'stages' -> stage_key -> 'owner_management_comp') is distinct from 'number' then null
                  else round((inputs -> 'stages' -> stage_key -> 'owner_management_comp' #>> '{}')::numeric, 2)
                end as owner_cents,
                case
                  when jsonb_typeof(inputs -> 'stages' -> stage_key -> 'owner_shadow_hours') is distinct from 'number'
                    or jsonb_typeof(inputs -> 'owner_field_replacement' -> 'wage') is distinct from 'number'
                    or jsonb_typeof(inputs -> 'owner_field_replacement' -> 'burden') is distinct from 'number'
                    or (inputs -> 'stages' -> stage_key -> 'owner_shadow_hours' #>> '{}')::numeric < 0
                    or (inputs -> 'owner_field_replacement' -> 'wage' #>> '{}')::numeric < 0
                    or (inputs -> 'owner_field_replacement' -> 'burden' #>> '{}')::numeric < 0
                  then null
                  else round(
                    (inputs -> 'stages' -> stage_key -> 'owner_shadow_hours' #>> '{}')::numeric
                    * (inputs -> 'owner_field_replacement' -> 'wage' #>> '{}')::numeric
                    * (1 + (inputs -> 'owner_field_replacement' -> 'burden' #>> '{}')::numeric), 2)
                end as replacement
            ) as parts
          ) as money
        )
        or (
          select economic is not null and economic >= 0 and hurdle_total < 1 and round(economic / (1 - hurdle_total), 2) < 0
          from (
            select
              case
                when hired is null or support is null or direct_cost is null or indirect_cost is null or owner_cents is null or replacement is null then null
                else hired + support + direct_cost + indirect_cost + owner_cents + replacement
              end as economic,
              (
                select sum(round((inputs -> 'stages' -> stage_key -> hurdle_key #>> '{}')::numeric, 4))
                from unnest(array['true_operating_profit_pct','growth_reserve_pct','bad_debt_warranty_pct','unidentified_cost_contingency_pct']::text[]) as hurdle_key
                where jsonb_typeof(inputs -> 'stages' -> stage_key -> hurdle_key) = 'number'
              ) as hurdle_total
            from (
              select
                case
                  when inputs -> 'staffing' is not null and jsonb_typeof(inputs -> 'staffing') is distinct from 'array' then null
                  else coalesce((
                    select sum(round(
                      (role.value -> 'headcount' -> stage_key #>> '{}')::numeric
                      * (role.value -> 'wage' #>> '{}')::numeric
                      * (role.value -> 'weekly_hours' #>> '{}')::numeric
                      * (inputs -> 'structural' -> 'weeks_per_year' #>> '{}')::numeric
                      / (inputs -> 'structural' -> 'months_per_year' #>> '{}')::numeric
                      * (1 + (role.value -> 'burden' #>> '{}')::numeric), 2))
                    from jsonb_array_elements(coalesce(inputs -> 'staffing', '[]'::jsonb)) as role
                    where role.value ->> 'classification' = 'direct_field'
                  ), 0)
                end as hired,
                case
                  when inputs -> 'staffing' is not null and jsonb_typeof(inputs -> 'staffing') is distinct from 'array' then null
                  else coalesce((
                    select sum(round(
                      (role.value -> 'headcount' -> stage_key #>> '{}')::numeric
                      * (role.value -> 'wage' #>> '{}')::numeric
                      * (role.value -> 'weekly_hours' #>> '{}')::numeric
                      * (inputs -> 'structural' -> 'weeks_per_year' #>> '{}')::numeric
                      / (inputs -> 'structural' -> 'months_per_year' #>> '{}')::numeric
                      * (1 + (role.value -> 'burden' #>> '{}')::numeric), 2))
                    from jsonb_array_elements(coalesce(inputs -> 'staffing', '[]'::jsonb)) as role
                    where role.value ->> 'classification' = 'indirect_support'
                  ), 0)
                end as support,
                (
                  select case when count(*) filter (where jsonb_typeof(raw) is distinct from 'number') > 0 then null
                    else sum(round((raw #>> '{}')::numeric, 2)) end
                  from unnest(array['fuel','consumables','job_rentals']::text[]) as line
                  cross join lateral (select inputs -> 'cost_pools' -> 'direct_production' -> line -> stage_key as raw) as got
                ) as direct_cost,
                (
                  select case when count(*) filter (where pool_total is null) > 0 then null else sum(pool_total) end
                  from (
                    select (
                      select case when count(*) filter (where jsonb_typeof(raw) is distinct from 'number') > 0 then null
                        else sum(round((raw #>> '{}')::numeric, 2)) end
                      from unnest(lines) as line
                      cross join lateral (select inputs -> 'cost_pools' -> grp -> line -> stage_key as raw) as got
                    ) as pool_total
                    from (values
                      ('indirect_field', array['vehicle_payments','maintenance','equipment_financing','tooling_ppe','replacement_sinking_fund']),
                      ('ga', array['office_shop','utilities','software','accounting_legal','office_misc']),
                      ('sales', array['marketing','memberships','collateral']),
                      ('insurance', array['gl_package','commercial_auto','umbrella','workers_comp_fixed','licensing'])
                    ) as pools(grp, lines)
                  ) as pooled
                ) as indirect_cost,
                case
                  when jsonb_typeof(inputs -> 'stages' -> stage_key -> 'owner_management_comp') is distinct from 'number' then null
                  else round((inputs -> 'stages' -> stage_key -> 'owner_management_comp' #>> '{}')::numeric, 2)
                end as owner_cents,
                case
                  when jsonb_typeof(inputs -> 'stages' -> stage_key -> 'owner_shadow_hours') is distinct from 'number'
                    or jsonb_typeof(inputs -> 'owner_field_replacement' -> 'wage') is distinct from 'number'
                    or jsonb_typeof(inputs -> 'owner_field_replacement' -> 'burden') is distinct from 'number'
                  then null
                  else round(
                    (inputs -> 'stages' -> stage_key -> 'owner_shadow_hours' #>> '{}')::numeric
                    * (inputs -> 'owner_field_replacement' -> 'wage' #>> '{}')::numeric
                    * (1 + (inputs -> 'owner_field_replacement' -> 'burden' #>> '{}')::numeric), 2)
                end as replacement
            ) as parts
          ) as revenue_check
        )
    )
  )) as approved_not_approvable
from public.finance_plans;

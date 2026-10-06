-- Version 1 plan documents must carry the same calculator sections as version 2.
-- monthly_basis stays forbidden on version 1. This does not edit an applied migration.
-- CREATE OR REPLACE does not rewrite stored rows. If any existing row would fail
-- the new check, this migration raises and the transaction rolls back. A notice
-- is printed only when every existing row passes.
-- A missing key makes jsonb_typeof return null. A null CHECK expression passes,
-- so every predicate below is a real boolean and the result is coalesced to false.
-- A partial document such as {"kept":true} is rejected.
-- No hosted project is contacted. No finance seed. No DELETE.

begin;

create or replace function public.finance_plan_calculator_sections_ok(p_inputs jsonb)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select coalesce(
    p_inputs is not null
    and pg_catalog.jsonb_typeof(p_inputs) is not distinct from 'object'
    and pg_catalog.jsonb_typeof(p_inputs -> 'structural') is not distinct from 'object'
    and pg_catalog.jsonb_typeof(p_inputs -> 'stages') is not distinct from 'object'
    and pg_catalog.jsonb_typeof(p_inputs -> 'staffing') is not distinct from 'array'
    and pg_catalog.jsonb_typeof(p_inputs -> 'owner_field_replacement') is not distinct from 'object'
    and pg_catalog.jsonb_typeof(p_inputs -> 'cost_pools') is not distinct from 'object'
    and pg_catalog.jsonb_typeof(p_inputs -> 'channels') is not distinct from 'array'
    and pg_catalog.jsonb_typeof(p_inputs -> 'services') is not distinct from 'object'
    and pg_catalog.jsonb_typeof(p_inputs -> 'stages' -> 'stage_0') is not distinct from 'object'
    and pg_catalog.jsonb_typeof(p_inputs -> 'stages' -> 'stage_1') is not distinct from 'object'
    and pg_catalog.jsonb_typeof(p_inputs -> 'stages' -> 'stage_2') is not distinct from 'object'
    and pg_catalog.jsonb_typeof(p_inputs -> 'stages' -> 'stage_3') is not distinct from 'object'
    and (p_inputs -> 'structural' ? 'weeks_per_year')
    and (p_inputs -> 'structural' ? 'months_per_year')
    and (p_inputs -> 'structural' ? 'days_per_month_ar')
    and (p_inputs -> 'structural' ? 'rounding_increment_usd')
    and (p_inputs -> 'owner_field_replacement' ? 'wage')
    and (p_inputs -> 'owner_field_replacement' ? 'burden'),
    false
  );
$$;

create or replace function public.finance_plan_document_ok(p_schema integer, p_inputs jsonb)
returns boolean
language plpgsql
immutable
set search_path = ''
as $$
declare
  basis jsonb;
  month_key text;
  month_row jsonb;
  metric_key text;
  metric_value jsonb;
  amount numeric;
  direct_value numeric;
  commercial_value numeric;
  portal_value numeric;
  total_value numeric;
  known_sum numeric;
  known_count integer;
  whole_digits integer;
  money_keys text[] := array[
    'total_revenue',
    'direct_residential_revenue',
    'commercial_direct_revenue',
    'portal_revenue',
    'field_payroll',
    'indirect_cash_costs',
    'ar_ending',
    'cash_reserve'
  ];
  count_keys text[] := array[
    'total_jobs',
    'dryer_vent_jobs',
    'duct_jobs',
    'ahu_jobs'
  ];
  allowed text[] := array[
    'total_revenue',
    'direct_residential_revenue',
    'commercial_direct_revenue',
    'portal_revenue',
    'total_jobs',
    'dryer_vent_jobs',
    'duct_jobs',
    'ahu_jobs',
    'productive_unit_hours',
    'field_payroll',
    'indirect_cash_costs',
    'ar_ending',
    'cash_reserve'
  ];
begin
  if p_inputs is null or pg_catalog.jsonb_typeof(p_inputs) <> 'object' then
    return false;
  end if;
  if p_schema = 1 then
    return coalesce(
      not (p_inputs ? 'monthly_basis')
        and public.finance_plan_calculator_sections_ok(p_inputs),
      false
    );
  end if;
  if p_schema is distinct from 2 or not (p_inputs ? 'monthly_basis') then
    return false;
  end if;
  basis := p_inputs -> 'monthly_basis';
  if basis is null or pg_catalog.jsonb_typeof(basis) <> 'object' then
    return false;
  end if;
  if pg_catalog.jsonb_typeof(p_inputs -> 'structural') is distinct from 'object'
    or pg_catalog.jsonb_typeof(p_inputs -> 'stages') is distinct from 'object'
    or pg_catalog.jsonb_typeof(p_inputs -> 'staffing') is distinct from 'array'
    or pg_catalog.jsonb_typeof(p_inputs -> 'owner_field_replacement') is distinct from 'object'
    or pg_catalog.jsonb_typeof(p_inputs -> 'cost_pools') is distinct from 'object'
    or pg_catalog.jsonb_typeof(p_inputs -> 'channels') is distinct from 'array'
    or pg_catalog.jsonb_typeof(p_inputs -> 'services') is distinct from 'object'
    or pg_catalog.jsonb_typeof(p_inputs -> 'stages' -> 'stage_0') is distinct from 'object'
    or pg_catalog.jsonb_typeof(p_inputs -> 'stages' -> 'stage_1') is distinct from 'object'
    or pg_catalog.jsonb_typeof(p_inputs -> 'stages' -> 'stage_2') is distinct from 'object'
    or pg_catalog.jsonb_typeof(p_inputs -> 'stages' -> 'stage_3') is distinct from 'object'
    or not (p_inputs -> 'structural' ? 'weeks_per_year')
    or not (p_inputs -> 'structural' ? 'months_per_year')
    or not (p_inputs -> 'structural' ? 'days_per_month_ar')
    or not (p_inputs -> 'structural' ? 'rounding_increment_usd')
    or not (p_inputs -> 'owner_field_replacement' ? 'wage')
    or not (p_inputs -> 'owner_field_replacement' ? 'burden')
  then
    return false;
  end if;
  for month_key in select pg_catalog.jsonb_object_keys(basis)
  loop
    if month_key !~ '^[0-9]{4}-(0[1-9]|1[0-2])-01$' or pg_catalog.left(month_key, 4) = '0000' then
      return false;
    end if;
    month_row := basis -> month_key;
    if month_row is null or pg_catalog.jsonb_typeof(month_row) <> 'object' then
      return false;
    end if;
    direct_value := null;
    commercial_value := null;
    portal_value := null;
    total_value := null;
    for metric_key in select pg_catalog.jsonb_object_keys(month_row)
    loop
      if not (metric_key = any (allowed)) then
        return false;
      end if;
      metric_value := month_row -> metric_key;
      if pg_catalog.jsonb_typeof(metric_value) = 'null' then
        continue;
      end if;
      if pg_catalog.jsonb_typeof(metric_value) <> 'number' then
        return false;
      end if;
      if (metric_value #>> '{}') ~ '^-0+(\.0+)?$' then
        return false;
      end if;
      amount := (metric_value #>> '{}')::numeric;
      if amount < 0 or amount <> amount then
        return false;
      end if;
      if metric_key = any (count_keys) then
        if amount <> pg_catalog.trunc(amount) or amount > 2147483647 then
          return false;
        end if;
      else
        if pg_catalog.scale(amount) > 2 then
          return false;
        end if;
        whole_digits := case
          when pg_catalog.trunc(amount) = 0 then 1
          else pg_catalog.length(pg_catalog.trunc(amount)::text)
        end;
        if metric_key = 'productive_unit_hours' then
          if whole_digits > 8 then
            return false;
          end if;
        elsif metric_key = any (money_keys) then
          if whole_digits > 12 then
            return false;
          end if;
        else
          return false;
        end if;
      end if;
      if metric_key = 'direct_residential_revenue' then
        direct_value := amount;
      elsif metric_key = 'commercial_direct_revenue' then
        commercial_value := amount;
      elsif metric_key = 'portal_revenue' then
        portal_value := amount;
      elsif metric_key = 'total_revenue' then
        total_value := amount;
      end if;
    end loop;
    known_sum := 0;
    known_count := 0;
    if direct_value is not null then
      known_sum := known_sum + direct_value;
      known_count := known_count + 1;
    end if;
    if commercial_value is not null then
      known_sum := known_sum + commercial_value;
      known_count := known_count + 1;
    end if;
    if portal_value is not null then
      known_sum := known_sum + portal_value;
      known_count := known_count + 1;
    end if;
    if known_count = 3 and (total_value is null or total_value <> known_sum) then
      return false;
    end if;
    if total_value is not null and known_sum > total_value then
      return false;
    end if;
  end loop;
  return true;
end;
$$;


revoke all on function public.finance_plan_calculator_sections_ok(jsonb) from public, anon, service_role;
grant execute on function public.finance_plan_calculator_sections_ok(jsonb) to authenticated;

comment on constraint finance_plans_monthly_basis on public.finance_plans is
  'Version 1 has no monthly_basis and must include structural, stages, staffing, owner_field_replacement, cost_pools, channels, and services. Version 2 also requires monthly_basis. A partial version 1 document is rejected on write. This migration aborts if an existing row would fail.';

do $$
declare
  v_total integer;
  v_v1 integer;
  v_v1_fail integer;
  v_v2_fail integer;
begin
  select count(*) into v_total from public.finance_plans;
  select count(*) into v_v1 from public.finance_plans where schema_version = 1;
  select count(*) into v_v1_fail
  from public.finance_plans
  where schema_version = 1
    and not public.finance_plan_document_ok(schema_version, inputs);
  select count(*) into v_v2_fail
  from public.finance_plans
  where schema_version = 2
    and not public.finance_plan_document_ok(schema_version, inputs);
  if v_v1_fail > 0 or v_v2_fail > 0 then
    raise exception 'finance_v1_shape_impact_abort total=% v1=% v1_would_fail=% v2_would_fail=% existing rows would fail the new plan document check; migration rolled back; non-draft partial rows have no authorized repair',
      v_total, v_v1, v_v1_fail, v_v2_fail
      using errcode = '23514';
  end if;
  raise notice 'finance_v1_shape_impact total=% v1=% v1_would_fail=% v2_would_fail=%',
    v_total, v_v1, v_v1_fail, v_v2_fail;
end;
$$;

commit;

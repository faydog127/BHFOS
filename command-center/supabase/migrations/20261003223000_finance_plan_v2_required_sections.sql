-- Version 2 plan documents must carry the sections the calculator reads.
-- This replaces finance_plan_document_ok. It does not edit
-- 20261003180000_finance_plan_monthly_basis.sql.
-- Version 1 stays a historical plan with no monthly_basis key.
-- No stored facts are rewritten. No finance seed. No DELETE.
-- A database that already holds a malformed version 2 row will fail the
-- constraint rebuild. Run the preflight document first. Do not apply this
-- file to a remote project from this change.
-- No real TVG data may be entered in any Vercel Preview or staging environment.

begin;

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
    return not (p_inputs ? 'monthly_basis');
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

alter table public.finance_plans drop constraint finance_plans_monthly_basis;

alter table public.finance_plans
  add constraint finance_plans_monthly_basis check (public.finance_plan_document_ok(schema_version, inputs));

comment on constraint finance_plans_monthly_basis on public.finance_plans is
  'Version 1 has no monthly_basis. Version 2 requires monthly_basis plus structural, stages, staffing, owner_field_replacement, cost_pools, channels, and services. A zero year month key is rejected. A negative-zero amount text is rejected.';

commit;

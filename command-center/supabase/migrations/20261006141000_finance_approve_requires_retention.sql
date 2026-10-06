-- Approve refuses a plan whose retention hurdles are missing or invalid,
-- whose hurdle sum is >= 1 in exact numeric arithmetic, or whose
-- owner_management_comp is a negative number.
-- The screen uses the same hurdle-sum rule on the decimal text of each value.
-- Derived calculator errors that are not a stored field are listed for a
-- Command Center ruling; they are not reimplemented here.
-- This does not edit an applied migration. It does not change grants on the approve RPC.
-- A rejected approve does not update status or version.
-- No hosted project is contacted. No finance seed. No DELETE.

begin;

create or replace function public.finance_plan_approvable(p_inputs jsonb)
returns boolean
language plpgsql
immutable
set search_path = ''
as $$
declare
  stage_key text;
  hurdle_key text;
  raw jsonb;
  amount numeric;
  total numeric;
  stage_keys text[] := array['stage_0', 'stage_1', 'stage_2', 'stage_3'];
  hurdle_keys text[] := array[
    'true_operating_profit_pct',
    'growth_reserve_pct',
    'bad_debt_warranty_pct',
    'unidentified_cost_contingency_pct'
  ];
begin
  if p_inputs is null or pg_catalog.jsonb_typeof(p_inputs) <> 'object' then
    return false;
  end if;
  if pg_catalog.jsonb_typeof(p_inputs -> 'stages') is distinct from 'object' then
    return false;
  end if;
  foreach stage_key in array stage_keys loop
    if pg_catalog.jsonb_typeof(p_inputs -> 'stages' -> stage_key) is distinct from 'object' then
      return false;
    end if;
    total := 0;
    foreach hurdle_key in array hurdle_keys loop
      if not (p_inputs -> 'stages' -> stage_key ? hurdle_key) then
        return false;
      end if;
      raw := p_inputs -> 'stages' -> stage_key -> hurdle_key;
      if pg_catalog.jsonb_typeof(raw) <> 'number' then
        return false;
      end if;
      if (raw #>> '{}') ~ '^-0+(\.0+)?$' then
        return false;
      end if;
      amount := (raw #>> '{}')::numeric;
      if amount < 0 or amount >= 1 or amount <> amount then
        return false;
      end if;
      total := total + amount;
    end loop;
    -- Numeric addition matches the client decimal-text sum. 0.7+0.2+0.1+0 is 1.
    if total >= 1 then
      return false;
    end if;
    raw := p_inputs -> 'stages' -> stage_key -> 'owner_management_comp';
    if pg_catalog.jsonb_typeof(raw) = 'number' and (raw #>> '{}') !~ '^-0+(\.0+)?$' then
      amount := (raw #>> '{}')::numeric;
      if amount < 0 then
        return false;
      end if;
    end if;
  end loop;
  return true;
end;
$$;

revoke all on function public.finance_plan_approvable(jsonb) from public, anon, service_role;
grant execute on function public.finance_plan_approvable(jsonb) to authenticated;

create or replace function public.finance_approve_plan(p_plan_id uuid, p_expected_version integer)
returns public.finance_plans
language plpgsql
set search_path = ''
as $$
declare
  current_row public.finance_plans;
  approved_row public.finance_plans;
begin
  if coalesce(public.finance_plan_access(), false) = false then
    raise exception 'finance_access_denied' using errcode = '42501';
  end if;
  select *
  into current_row
  from public.finance_plans
  where id = p_plan_id
    and tenant_id = 'tvg'
    and status = 'draft'
    and version = p_expected_version
  for update;
  if current_row.id is null then
    raise exception 'finance_version_conflict'
      using errcode = 'PT409',
            detail = 'finance_version_conflict',
            hint = 'finance_version_conflict';
  end if;
  if not public.finance_plan_approvable(current_row.inputs) then
    raise exception 'finance_plan_not_approvable' using errcode = '23514';
  end if;
  perform set_config('finance.plan_transition', 'approve', true);
  update public.finance_plans
  set status = 'superseded'
  where tenant_id = 'tvg'
    and status = 'approved';
  update public.finance_plans
  set status = 'approved'
  where id = p_plan_id
    and tenant_id = 'tvg'
    and status = 'draft'
    and version = p_expected_version
  returning * into approved_row;
  if approved_row.id is null then
    raise exception 'finance_version_conflict'
      using errcode = 'PT409',
            detail = 'finance_version_conflict',
            hint = 'finance_version_conflict';
  end if;
  return approved_row;
exception
  when unique_violation then
    raise exception 'finance_version_conflict'
      using errcode = 'PT409',
            detail = 'finance_version_conflict',
            hint = 'finance_version_conflict';
end;
$$;

commit;

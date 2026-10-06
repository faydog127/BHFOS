-- Approve refuses a plan that fails the approvability contract
-- (command-center/docs/finance/APPROVABILITY_CONTRACT.md).
-- Rates normalize to 4 decimal places and money to cents, half away from zero.
-- A hurdle total must be strictly below 1. 0.7+0.2+0.1+0 is exactly 1 and is rejected.
-- Blank required revenue does not exempt that stage.
-- A failed approve raises before any status update, so status and version stay.
-- If an existing approved row would fail, this migration rolls back.
-- Draft rows are not failed here; they stay editable.
-- This does not change grants on the approve RPC.
-- No hosted project is contacted. No finance seed. No DELETE.

begin;

create or replace function public.finance_plan_approvable(p_inputs jsonb)
returns boolean
language plpgsql
stable
set search_path = ''
as $$
declare
  stage_key text;
  hurdle_key text;
  raw jsonb;
  amount numeric;
  total numeric;
  stage jsonb;
  role jsonb;
  pay numeric;
  hc numeric;
  wage numeric;
  hours numeric;
  burden numeric;
  weeks numeric;
  months numeric;
  hired numeric;
  support numeric;
  hired_ok boolean;
  support_ok boolean;
  direct numeric;
  indirect numeric;
  group_total numeric;
  group_ok boolean;
  group_name text;
  line text;
  lines text[];
  owner_cents numeric;
  cash numeric;
  replacement numeric;
  economic numeric;
  revenue numeric;
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
    stage := p_inputs -> 'stages' -> stage_key;
    if pg_catalog.jsonb_typeof(stage) is distinct from 'object' then
      return false;
    end if;
    total := 0;
    foreach hurdle_key in array hurdle_keys loop
      raw := stage -> hurdle_key;
      if pg_catalog.jsonb_typeof(raw) is distinct from 'number' then
        return false;
      end if;
      amount := pg_catalog.round((raw #>> '{}')::numeric, 4);
      if amount < 0 or amount >= 1 then
        return false;
      end if;
      total := total + amount;
    end loop;
    if total >= 1 then
      return false;
    end if;

    raw := stage -> 'owner_management_comp';
    owner_cents := null;
    if pg_catalog.jsonb_typeof(raw) = 'number' then
      owner_cents := pg_catalog.round((raw #>> '{}')::numeric, 2);
      if owner_cents < 0 then
        return false;
      end if;
    end if;

    hired := 0;
    support := 0;
    hired_ok := true;
    support_ok := true;
    if p_inputs -> 'staffing' is not null and pg_catalog.jsonb_typeof(p_inputs -> 'staffing') is distinct from 'array' then
      hired_ok := false;
      support_ok := false;
    else
      for role in
        select value
        from pg_catalog.jsonb_array_elements(coalesce(p_inputs -> 'staffing', '[]'::jsonb))
      loop
        if coalesce(role ->> 'classification', '') not in ('direct_field', 'indirect_support') then
          continue;
        end if;
        pay := null;
        if pg_catalog.jsonb_typeof(role -> 'headcount' -> stage_key) = 'number'
          and pg_catalog.jsonb_typeof(role -> 'wage') = 'number'
          and pg_catalog.jsonb_typeof(role -> 'weekly_hours') = 'number'
          and pg_catalog.jsonb_typeof(role -> 'burden') = 'number'
          and pg_catalog.jsonb_typeof(p_inputs -> 'structural' -> 'weeks_per_year') = 'number'
          and pg_catalog.jsonb_typeof(p_inputs -> 'structural' -> 'months_per_year') = 'number'
        then
          hc := (role -> 'headcount' -> stage_key #>> '{}')::numeric;
          wage := (role -> 'wage' #>> '{}')::numeric;
          hours := (role -> 'weekly_hours' #>> '{}')::numeric;
          burden := (role -> 'burden' #>> '{}')::numeric;
          weeks := (p_inputs -> 'structural' -> 'weeks_per_year' #>> '{}')::numeric;
          months := (p_inputs -> 'structural' -> 'months_per_year' #>> '{}')::numeric;
          if hc >= 0 and wage >= 0 and hours >= 0 and burden >= 0 and weeks >= 0 and months > 0 then
            pay := pg_catalog.round(hc * wage * hours * weeks / months * (1 + burden), 2);
          end if;
        end if;
        if role ->> 'classification' = 'direct_field' then
          if pay is null then
            hired_ok := false;
          else
            hired := hired + pay;
          end if;
        elsif pay is null then
          support_ok := false;
        else
          support := support + pay;
        end if;
      end loop;
    end if;

    direct := null;
    indirect := 0;
    group_ok := true;
    foreach group_name in array array['direct_production', 'indirect_field', 'ga', 'sales', 'insurance'] loop
      lines := case group_name
        when 'direct_production' then array['fuel', 'consumables', 'job_rentals']
        when 'indirect_field' then array['vehicle_payments', 'maintenance', 'equipment_financing', 'tooling_ppe', 'replacement_sinking_fund']
        when 'ga' then array['office_shop', 'utilities', 'software', 'accounting_legal', 'office_misc']
        when 'sales' then array['marketing', 'memberships', 'collateral']
        else array['gl_package', 'commercial_auto', 'umbrella', 'workers_comp_fixed', 'licensing']
      end;
      group_total := 0;
      foreach line in array lines loop
        raw := p_inputs -> 'cost_pools' -> group_name -> line -> stage_key;
        if pg_catalog.jsonb_typeof(raw) is distinct from 'number' then
          group_total := null;
          exit;
        end if;
        group_total := group_total + pg_catalog.round((raw #>> '{}')::numeric, 2);
      end loop;
      if group_name = 'direct_production' then
        direct := group_total;
      elsif group_total is null then
        group_ok := false;
      else
        indirect := indirect + group_total;
      end if;
    end loop;
    if not group_ok then
      indirect := null;
    end if;

    replacement := null;
    if pg_catalog.jsonb_typeof(stage -> 'owner_shadow_hours') = 'number'
      and pg_catalog.jsonb_typeof(p_inputs -> 'owner_field_replacement' -> 'wage') = 'number'
      and pg_catalog.jsonb_typeof(p_inputs -> 'owner_field_replacement' -> 'burden') = 'number'
    then
      hours := (stage -> 'owner_shadow_hours' #>> '{}')::numeric;
      wage := (p_inputs -> 'owner_field_replacement' -> 'wage' #>> '{}')::numeric;
      burden := (p_inputs -> 'owner_field_replacement' -> 'burden' #>> '{}')::numeric;
      if hours >= 0 and wage >= 0 and burden >= 0 then
        replacement := pg_catalog.round(hours * wage * (1 + burden), 2);
      end if;
    end if;

    cash := null;
    if hired_ok and support_ok and direct is not null and indirect is not null and owner_cents is not null then
      cash := hired + direct + indirect + support + owner_cents;
    end if;
    economic := null;
    if cash is not null and replacement is not null then
      economic := cash + replacement;
    end if;
    if economic is not null and economic < 0 then
      return false;
    end if;
    if economic is not null and economic >= 0 and total < 1 then
      revenue := pg_catalog.round(economic / (1 - total), 2);
      if revenue < 0 then
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

do $$
declare
  v_bad integer;
begin
  select count(*) into v_bad
  from public.finance_plans
  where status = 'approved'
    and not public.finance_plan_approvable(inputs);
  if v_bad > 0 then
    raise exception 'finance_approvability_impact_abort approved_not_approvable=% existing approved rows fail the approvability contract; migration rolled back; do not bypass constraints; non-draft rows have no authorized repair',
      v_bad
      using errcode = '23514';
  else
    raise notice 'finance_approvability_impact approved_not_approvable=0';
  end if;
end;
$$;

commit;

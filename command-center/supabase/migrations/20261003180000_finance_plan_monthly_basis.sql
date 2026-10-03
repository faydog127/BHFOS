-- Plan schema version 2 stores an explicit monthly basis on the plan document.
-- Ordinary updates still freeze schema_version. A draft moves from 1 to 2 only
-- inside finance_upgrade_draft_schema. Approved and superseded rows stay put.
-- finance_monthly_actuals.schema_version is unchanged.
-- No stored facts are rewritten. No finance seed. No DELETE.
-- No real TVG data may be entered in any Vercel Preview or staging environment.
-- The finance migration is not applied to any remote project by PR #164.
-- Preview must use a non-production Supabase project, or none.
-- Applying the migration anywhere requires explicit Command Center authorization.

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
  for month_key in select pg_catalog.jsonb_object_keys(basis)
  loop
    if month_key !~ '^[0-9]{4}-(0[1-9]|1[0-2])-01$' then
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

revoke all on function public.finance_plan_document_ok(integer, jsonb) from public, anon, service_role;
grant execute on function public.finance_plan_document_ok(integer, jsonb) to authenticated;

alter table public.finance_plans drop constraint finance_plans_schema_version;

alter table public.finance_plans
  add constraint finance_plans_schema_version check (schema_version in (1, 2));

alter table public.finance_plans
  add constraint finance_plans_monthly_basis check (public.finance_plan_document_ok(schema_version, inputs));

comment on constraint finance_plans_monthly_basis on public.finance_plans is
  'Version 1 has no monthly_basis. Version 2 requires an explicit monthly_basis object. Missing and null mean not planned. Zero is a planned zero.';

create or replace function public.finance_plan_before_update()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  transition text := pg_catalog.current_setting('finance.plan_transition', true);
  requested_schema integer := new.schema_version;
begin
  new.version := old.version + 1;
  new.updated_at := pg_catalog.now();
  new.updated_by_user_id := auth.uid();
  new.created_at := old.created_at;
  new.created_by_user_id := old.created_by_user_id;
  new.schema_version := old.schema_version;
  if transition = 'schema_upgrade' then
    if old.status <> 'draft' or new.status is distinct from 'draft' then
      raise exception 'finance_plan_locked' using errcode = '23514';
    end if;
    if old.schema_version is distinct from 1 or requested_schema is distinct from 2 then
      raise exception 'finance_schema_upgrade_rejected' using errcode = '23514';
    end if;
    new.schema_version := 2;
    new.status := 'draft';
    new.approved_at := null;
    new.approved_by := null;
  elsif transition = 'approve' then
    if old.status = 'approved' and new.status = 'superseded' then
      new.approved_at := old.approved_at;
      new.approved_by := old.approved_by;
      new.inputs := old.inputs;
      new.notes := old.notes;
    elsif old.status = 'draft' and new.status = 'approved' then
      new.approved_at := pg_catalog.now();
      new.approved_by := auth.uid();
      new.inputs := old.inputs;
      new.notes := old.notes;
    else
      raise exception 'finance_invalid_transition' using errcode = '23514';
    end if;
  else
    if old.status <> 'draft' or new.status is distinct from 'draft' then
      raise exception 'finance_plan_locked' using errcode = '23514';
    end if;
    new.status := 'draft';
    new.approved_at := null;
    new.approved_by := null;
  end if;
  return new;
end;
$$;

create or replace function public.finance_upgrade_draft_schema(p_plan_id uuid, p_expected_version integer)
returns public.finance_plans
language plpgsql
set search_path = ''
as $$
declare
  current_row public.finance_plans;
  upgraded public.finance_plans;
  next_inputs jsonb;
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
    and schema_version = 1
    and version = p_expected_version
  for update;
  if current_row.id is null then
    raise exception 'finance_version_conflict' using errcode = '40001';
  end if;
  next_inputs := coalesce(current_row.inputs, '{}'::jsonb) - 'monthly_basis';
  next_inputs := next_inputs || pg_catalog.jsonb_build_object('monthly_basis', '{}'::jsonb);
  perform set_config('finance.plan_transition', 'schema_upgrade', true);
  update public.finance_plans
  set schema_version = 2,
      inputs = next_inputs
  where id = p_plan_id
    and tenant_id = 'tvg'
    and status = 'draft'
    and schema_version = 1
    and version = p_expected_version
  returning * into upgraded;
  perform set_config('finance.plan_transition', '', true);
  if upgraded.id is null then
    raise exception 'finance_version_conflict' using errcode = '40001';
  end if;
  return upgraded;
exception
  when others then
    perform set_config('finance.plan_transition', '', true);
    raise;
end;
$$;

create or replace function public.finance_open_draft(p_plan_id uuid)
returns public.finance_plans
language plpgsql
set search_path = ''
as $$
declare
  source_row public.finance_plans;
  draft_row public.finance_plans;
  next_inputs jsonb;
begin
  if coalesce(public.finance_plan_access(), false) = false then
    raise exception 'finance_access_denied' using errcode = '42501';
  end if;
  select *
  into source_row
  from public.finance_plans
  where id = p_plan_id
    and tenant_id = 'tvg'
    and status = 'approved'
  for update;
  if source_row.id is null then
    raise exception 'finance_no_approved_plan' using errcode = '02000';
  end if;
  select *
  into draft_row
  from public.finance_plans
  where tenant_id = 'tvg'
    and status = 'draft'
  for update;
  if draft_row.id is not null then
    if draft_row.schema_version = 2 then
      return draft_row;
    end if;
    if draft_row.schema_version = 1 then
      return public.finance_upgrade_draft_schema(draft_row.id, draft_row.version);
    end if;
    raise exception 'finance_schema_unsupported' using errcode = '23514';
  end if;
  if source_row.schema_version = 1 then
    next_inputs := coalesce(source_row.inputs, '{}'::jsonb) - 'monthly_basis';
    next_inputs := next_inputs || pg_catalog.jsonb_build_object('monthly_basis', '{}'::jsonb);
  elsif source_row.schema_version = 2 then
    next_inputs := source_row.inputs;
  else
    raise exception 'finance_schema_unsupported' using errcode = '23514';
  end if;
  begin
    insert into public.finance_plans (tenant_id, schema_version, inputs, notes)
    values ('tvg', 2, next_inputs, source_row.notes)
    returning * into draft_row;
    return draft_row;
  exception
    when unique_violation then
      select *
      into draft_row
      from public.finance_plans
      where tenant_id = 'tvg'
        and status = 'draft';
      if draft_row.id is null then
        raise;
      end if;
      if draft_row.schema_version = 1 then
        return public.finance_upgrade_draft_schema(draft_row.id, draft_row.version);
      end if;
      return draft_row;
  end;
end;
$$;

revoke all on function public.finance_upgrade_draft_schema(uuid, integer) from public, anon, service_role;
grant execute on function public.finance_upgrade_draft_schema(uuid, integer) to authenticated;

commit;

-- Stage A security fixes. Forward-only. No plan rows.
-- No real TVG data may be entered in any Vercel Preview or staging environment.
-- The finance migration is not applied to any remote project by PR #164.
-- Preview must use a non-production Supabase project, or none.
-- Applying the migration anywhere requires explicit Command Center authorization.
--
-- finance.plan_transition is a transaction-local GUC set only inside
-- finance_approve_plan. It is not an API column. Direct SQL in that same
-- session can set it; the app does not. Approval from the app goes through
-- finance_approve_plan.
--
-- Trigger functions keep EXECUTE for authenticated because PostgreSQL checks
-- that privilege for the role that fires the trigger. PUBLIC and anon do not.

begin;

create or replace function public.finance_plan_access()
returns boolean
language sql
stable
set search_path = ''
as $$
  select
    auth.uid() is not null
    and nullif(lower(btrim(auth.jwt() -> 'app_metadata' ->> 'tenant_id')), '') = 'tvg'
    and jsonb_typeof(auth.jwt() -> 'app_metadata' -> 'role') = 'string'
    and lower(btrim(auth.jwt() -> 'app_metadata' ->> 'role')) in ('admin', 'super_admin');
$$;

create or replace function public.finance_actual_before_write()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'finance_access_denied' using errcode = '42501';
  end if;
  if tg_op = 'UPDATE' then
    if new.plan_id is distinct from old.plan_id
      or new.tenant_id is distinct from old.tenant_id
      or new.month is distinct from old.month then
      raise exception 'finance_actuals_identity_locked' using errcode = '23514';
    end if;
    if not exists (
      select 1
      from public.finance_plans plan
      where plan.id = old.plan_id
        and plan.tenant_id = old.tenant_id
        and plan.status = 'approved'
    ) then
      raise exception 'finance_actuals_history_locked' using errcode = '23514';
    end if;
    new.version := old.version + 1;
    new.created_by_user_id := old.created_by_user_id;
    new.created_at := old.created_at;
    new.schema_version := old.schema_version;
    new.plan_id := old.plan_id;
    new.tenant_id := old.tenant_id;
    new.month := old.month;
  else
    if new.tenant_id is distinct from 'tvg' then
      raise exception 'finance_tenant_rejected' using errcode = '23514';
    end if;
    if not exists (
      select 1
      from public.finance_plans plan
      where plan.id = new.plan_id
        and plan.tenant_id = new.tenant_id
        and plan.status = 'approved'
    ) then
      raise exception 'finance_actuals_require_approved_plan' using errcode = '23514';
    end if;
    new.version := 1;
    new.created_by_user_id := auth.uid();
    new.created_at := pg_catalog.now();
  end if;
  new.updated_by_user_id := auth.uid();
  new.updated_at := pg_catalog.now();
  return new;
end;
$$;

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
    raise exception 'finance_version_conflict' using errcode = '40001';
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
    raise exception 'finance_version_conflict' using errcode = '40001';
  end if;
  return approved_row;
exception
  when unique_violation then
    raise exception 'finance_version_conflict' using errcode = '40001';
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
  insert into public.finance_plans (tenant_id, schema_version, inputs, notes)
  values ('tvg', source_row.schema_version, source_row.inputs, source_row.notes)
  returning * into draft_row;
  return draft_row;
end;
$$;

revoke all on function public.finance_plan_before_insert() from public, anon, service_role;
revoke all on function public.finance_plan_before_update() from public, anon, service_role;
revoke all on function public.finance_actual_before_write() from public, anon, service_role;
grant execute on function public.finance_plan_before_insert() to authenticated;
grant execute on function public.finance_plan_before_update() to authenticated;
grant execute on function public.finance_actual_before_write() to authenticated;

alter table public.finance_monthly_actuals
  drop constraint finance_actuals_month_first,
  drop constraint finance_actuals_money_nonnegative,
  drop constraint finance_actuals_hours_nonnegative;

alter table public.finance_monthly_actuals
  add constraint finance_actuals_month_first check (
    pg_catalog.isfinite(month)
    and month = date_trunc('month', month)::date
  ),
  add constraint finance_actuals_money_nonnegative check (
    (total_revenue is null or (total_revenue >= 0 and total_revenue <> 'NaN'::numeric and total_revenue <> 'Infinity'::numeric and total_revenue <> '-Infinity'::numeric))
    and (direct_residential_revenue is null or (direct_residential_revenue >= 0 and direct_residential_revenue <> 'NaN'::numeric and direct_residential_revenue <> 'Infinity'::numeric and direct_residential_revenue <> '-Infinity'::numeric))
    and (commercial_direct_revenue is null or (commercial_direct_revenue >= 0 and commercial_direct_revenue <> 'NaN'::numeric and commercial_direct_revenue <> 'Infinity'::numeric and commercial_direct_revenue <> '-Infinity'::numeric))
    and (portal_revenue is null or (portal_revenue >= 0 and portal_revenue <> 'NaN'::numeric and portal_revenue <> 'Infinity'::numeric and portal_revenue <> '-Infinity'::numeric))
    and (field_payroll is null or (field_payroll >= 0 and field_payroll <> 'NaN'::numeric and field_payroll <> 'Infinity'::numeric and field_payroll <> '-Infinity'::numeric))
    and (indirect_cash_costs is null or (indirect_cash_costs >= 0 and indirect_cash_costs <> 'NaN'::numeric and indirect_cash_costs <> 'Infinity'::numeric and indirect_cash_costs <> '-Infinity'::numeric))
    and (ar_ending is null or (ar_ending >= 0 and ar_ending <> 'NaN'::numeric and ar_ending <> 'Infinity'::numeric and ar_ending <> '-Infinity'::numeric))
    and (cash_reserve is null or (cash_reserve >= 0 and cash_reserve <> 'NaN'::numeric and cash_reserve <> 'Infinity'::numeric and cash_reserve <> '-Infinity'::numeric))
  ),
  add constraint finance_actuals_hours_nonnegative check (
    productive_unit_hours is null
    or (
      productive_unit_hours >= 0
      and productive_unit_hours <> 'NaN'::numeric
      and productive_unit_hours <> 'Infinity'::numeric
      and productive_unit_hours <> '-Infinity'::numeric
    )
  );

commit;

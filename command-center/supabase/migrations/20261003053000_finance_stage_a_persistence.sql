-- Stage A finance persistence. Schema and policies only. No plan rows.
-- One current plan: partial unique index finance_plans_one_approved
-- on (tenant_id) WHERE status = 'approved'.
-- Lifecycle is draft | approved | superseded.
-- Approved rows are not rewritten; a new draft is a new row.

begin;

create or replace function public.finance_plan_access()
returns boolean
language sql
stable
set search_path = ''
as $$
  select
    auth.uid() is not null
    and nullif(btrim(auth.jwt() -> 'app_metadata' ->> 'tenant_id'), '') = 'tvg'
    and jsonb_typeof(auth.jwt() -> 'app_metadata' -> 'role') = 'string'
    and lower(btrim(auth.jwt() -> 'app_metadata' ->> 'role')) in ('admin', 'super_admin');
$$;

revoke all on function public.finance_plan_access() from public, anon, authenticated, service_role;
grant execute on function public.finance_plan_access() to authenticated, service_role;

create table public.finance_plans (
  id uuid primary key default extensions.gen_random_uuid(),
  tenant_id text not null,
  status text not null,
  version integer not null default 1,
  schema_version integer not null,
  inputs jsonb not null,
  notes text,
  created_at timestamptz not null default pg_catalog.now(),
  updated_at timestamptz not null default pg_catalog.now(),
  created_by_user_id uuid,
  updated_by_user_id uuid,
  approved_at timestamptz,
  approved_by uuid,
  constraint finance_plans_tenant_tvg check (tenant_id = 'tvg'),
  constraint finance_plans_status check (status in ('draft', 'approved', 'superseded')),
  constraint finance_plans_version_positive check (version >= 1),
  constraint finance_plans_schema_version check (schema_version = 1),
  constraint finance_plans_inputs_object check (jsonb_typeof(inputs) = 'object'),
  constraint finance_plans_notes_length check (notes is null or char_length(notes) <= 2000),
  constraint finance_plans_approval_pair check (
    (
      status in ('approved', 'superseded')
      and approved_at is not null
      and approved_by is not null
    )
    or (
      status = 'draft'
      and approved_at is null
      and approved_by is null
    )
  ),
  constraint finance_plans_tenant_id_key unique (tenant_id, id)
);

create unique index finance_plans_one_approved
  on public.finance_plans (tenant_id)
  where status = 'approved';

create table public.finance_monthly_actuals (
  id uuid primary key default extensions.gen_random_uuid(),
  tenant_id text not null,
  plan_id uuid not null,
  month date not null,
  version integer not null default 1,
  schema_version integer not null,
  total_revenue numeric(14,2),
  direct_residential_revenue numeric(14,2),
  commercial_direct_revenue numeric(14,2),
  portal_revenue numeric(14,2),
  field_payroll numeric(14,2),
  indirect_cash_costs numeric(14,2),
  ar_ending numeric(14,2),
  cash_reserve numeric(14,2),
  total_jobs integer,
  dryer_vent_jobs integer,
  duct_jobs integer,
  ahu_jobs integer,
  productive_unit_hours numeric(10,2),
  notes text,
  created_at timestamptz not null default pg_catalog.now(),
  updated_at timestamptz not null default pg_catalog.now(),
  created_by_user_id uuid,
  updated_by_user_id uuid,
  constraint finance_actuals_tenant_tvg check (tenant_id = 'tvg'),
  constraint finance_actuals_month_first check (month = date_trunc('month', month)::date),
  constraint finance_actuals_version_positive check (version >= 1),
  constraint finance_actuals_schema_version check (schema_version = 1),
  constraint finance_actuals_money_nonnegative check (
    (total_revenue is null or total_revenue >= 0)
    and (direct_residential_revenue is null or direct_residential_revenue >= 0)
    and (commercial_direct_revenue is null or commercial_direct_revenue >= 0)
    and (portal_revenue is null or portal_revenue >= 0)
    and (field_payroll is null or field_payroll >= 0)
    and (indirect_cash_costs is null or indirect_cash_costs >= 0)
    and (ar_ending is null or ar_ending >= 0)
    and (cash_reserve is null or cash_reserve >= 0)
  ),
  constraint finance_actuals_counts_nonnegative check (
    (total_jobs is null or total_jobs >= 0)
    and (dryer_vent_jobs is null or dryer_vent_jobs >= 0)
    and (duct_jobs is null or duct_jobs >= 0)
    and (ahu_jobs is null or ahu_jobs >= 0)
  ),
  constraint finance_actuals_hours_nonnegative check (
    productive_unit_hours is null or productive_unit_hours >= 0
  ),
  constraint finance_actuals_notes_length check (notes is null or char_length(notes) <= 2000),
  constraint finance_actuals_plan_fk
    foreign key (tenant_id, plan_id)
    references public.finance_plans (tenant_id, id)
    on delete restrict,
  constraint finance_actuals_month_key unique (tenant_id, plan_id, month)
);

create or replace function public.finance_plan_before_insert()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'finance_access_denied' using errcode = '42501';
  end if;
  if new.tenant_id is distinct from 'tvg' then
    raise exception 'finance_tenant_rejected' using errcode = '23514';
  end if;
  new.status := 'draft';
  new.version := 1;
  new.approved_at := null;
  new.approved_by := null;
  new.created_by_user_id := auth.uid();
  new.updated_by_user_id := auth.uid();
  new.created_at := pg_catalog.now();
  new.updated_at := pg_catalog.now();
  return new;
end;
$$;

create or replace function public.finance_plan_before_update()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  transition text := current_setting('finance.plan_transition', true);
begin
  new.version := old.version + 1;
  new.updated_at := pg_catalog.now();
  new.updated_by_user_id := auth.uid();
  new.created_at := old.created_at;
  new.created_by_user_id := old.created_by_user_id;
  new.schema_version := old.schema_version;
  if transition = 'approve' then
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

create or replace function public.finance_actual_before_write()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'finance_access_denied' using errcode = '42501';
  end if;
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
  if tg_op = 'INSERT' then
    new.version := 1;
    new.created_by_user_id := auth.uid();
    new.created_at := pg_catalog.now();
  else
    new.version := old.version + 1;
    new.created_by_user_id := old.created_by_user_id;
    new.created_at := old.created_at;
    new.plan_id := old.plan_id;
    new.month := old.month;
    new.schema_version := old.schema_version;
  end if;
  new.updated_by_user_id := auth.uid();
  new.updated_at := pg_catalog.now();
  return new;
end;
$$;

create trigger finance_plans_before_insert
before insert on public.finance_plans
for each row
execute function public.finance_plan_before_insert();

create trigger finance_plans_before_update
before update on public.finance_plans
for each row
execute function public.finance_plan_before_update();

create trigger finance_plans_tenant_immutable
before update on public.finance_plans
for each row
execute function public.enforce_tenant_id_immutability();

create trigger finance_actuals_before_write
before insert or update on public.finance_monthly_actuals
for each row
execute function public.finance_actual_before_write();

create trigger finance_actuals_tenant_immutable
before update on public.finance_monthly_actuals
for each row
execute function public.enforce_tenant_id_immutability();

create or replace function public.finance_approve_plan(p_plan_id uuid, p_expected_version integer)
returns public.finance_plans
language plpgsql
set search_path = ''
as $$
declare
  current_row public.finance_plans;
  approved_row public.finance_plans;
begin
  if not public.finance_plan_access() then
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
  if not public.finance_plan_access() then
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

revoke all on function public.finance_approve_plan(uuid, integer) from public, anon, authenticated, service_role;
revoke all on function public.finance_open_draft(uuid) from public, anon, authenticated, service_role;
grant execute on function public.finance_approve_plan(uuid, integer) to authenticated;
grant execute on function public.finance_open_draft(uuid) to authenticated;

alter table public.finance_plans enable row level security;
alter table public.finance_plans force row level security;
alter table public.finance_monthly_actuals enable row level security;
alter table public.finance_monthly_actuals force row level security;

revoke all on public.finance_plans from public, anon, authenticated, service_role;
revoke all on public.finance_monthly_actuals from public, anon, authenticated, service_role;
grant select, insert, update on public.finance_plans to authenticated;
grant select, insert, update on public.finance_monthly_actuals to authenticated;

create policy finance_plans_select
on public.finance_plans
for select
to authenticated
using (tenant_id = 'tvg' and public.finance_plan_access());

create policy finance_plans_insert
on public.finance_plans
for insert
to authenticated
with check (tenant_id = 'tvg' and public.finance_plan_access());

create policy finance_plans_update
on public.finance_plans
for update
to authenticated
using (tenant_id = 'tvg' and public.finance_plan_access())
with check (tenant_id = 'tvg' and public.finance_plan_access());

create policy finance_actuals_select
on public.finance_monthly_actuals
for select
to authenticated
using (tenant_id = 'tvg' and public.finance_plan_access());

create policy finance_actuals_insert
on public.finance_monthly_actuals
for insert
to authenticated
with check (tenant_id = 'tvg' and public.finance_plan_access());

create policy finance_actuals_update
on public.finance_monthly_actuals
for update
to authenticated
using (tenant_id = 'tvg' and public.finance_plan_access())
with check (tenant_id = 'tvg' and public.finance_plan_access());

commit;

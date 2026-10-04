-- Monthly actuals are plan-independent facts. Forward-only. No plan rows.
-- Data handling: finance_monthly_actuals is empty. There is no finance seed,
-- and this migration is not applied to any remote project. The identity change
-- does not copy, rewrite, or delete stored facts. If a row exists, this
-- migration stops instead of reshaping history.
-- No real TVG data may be entered in any Vercel Preview or staging environment.
-- The finance migration is not applied to any remote project by PR #164.
-- Preview must use a non-production Supabase project, or none.
-- Applying the migration anywhere requires explicit Command Center authorization.
--
-- Total Revenue is earned operating revenue for work completed in the
-- reporting month. It is not invoice issue-date volume, cash collected,
-- quoted value, or scheduled value. Direct Residential, Commercial Direct,
-- and Portal revenue use that same basis. AR and cash stay separate.
-- When all three channel amounts are present they must equal Total Revenue
-- at currency scale. A missing channel stays null.

begin;

do $$
begin
  if exists (select 1 from public.finance_monthly_actuals) then
    raise exception 'finance_actuals_not_empty' using errcode = '23514';
  end if;
end;
$$;

alter table public.finance_monthly_actuals
  drop constraint finance_actuals_plan_fk,
  drop constraint finance_actuals_month_key;

alter table public.finance_monthly_actuals
  rename column plan_id to comparison_plan_id;

alter table public.finance_monthly_actuals
  alter column comparison_plan_id drop not null;

alter table public.finance_monthly_actuals
  add constraint finance_actuals_month_key unique (tenant_id, month),
  add constraint finance_actuals_comparison_plan_fk
    foreign key (tenant_id, comparison_plan_id)
    references public.finance_plans (tenant_id, id)
    on delete restrict,
  add column source text not null default 'manual_entry',
  add column source_note text,
  add constraint finance_actuals_source check (source = 'manual_entry'),
  add constraint finance_actuals_source_note_length check (
    source_note is null or char_length(source_note) <= 2000
  ),
  add constraint finance_actuals_channel_reconcile check (
    direct_residential_revenue is null
    or commercial_direct_revenue is null
    or portal_revenue is null
    or (
      total_revenue is not null
      and total_revenue = direct_residential_revenue + commercial_direct_revenue + portal_revenue
    )
  );

comment on column public.finance_monthly_actuals.total_revenue is
  'Earned operating revenue for work completed in the reporting month. Not invoice issue-date volume, cash collected, quoted value, or scheduled value.';

comment on column public.finance_monthly_actuals.direct_residential_revenue is
  'Direct residential earned operating revenue for the reporting month. Same basis as total revenue. Null stays null.';

comment on column public.finance_monthly_actuals.commercial_direct_revenue is
  'Commercial direct earned operating revenue for the reporting month. Same basis as total revenue. Null stays null.';

comment on column public.finance_monthly_actuals.portal_revenue is
  'Portal earned operating revenue for the reporting month. Same basis as total revenue. Null stays null.';

comment on column public.finance_monthly_actuals.ar_ending is
  'Ending accounts receivable. Separate from earned operating revenue.';

comment on column public.finance_monthly_actuals.cash_reserve is
  'Cash reserve. Separate from earned operating revenue.';

comment on column public.finance_monthly_actuals.comparison_plan_id is
  'Nullable comparison basis. Not ownership of the actual. Once set, it is not rebound.';

comment on column public.finance_monthly_actuals.source is
  'Origin of the actual. The only allowed value is manual authenticated entry.';

comment on column public.finance_monthly_actuals.source_note is
  'Optional source note or reference. Not an external import.';

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
    if new.tenant_id is distinct from old.tenant_id
      or new.month is distinct from old.month then
      raise exception 'finance_actuals_identity_locked' using errcode = '23514';
    end if;
    if old.comparison_plan_id is not null
      and new.comparison_plan_id is distinct from old.comparison_plan_id then
      raise exception 'finance_actuals_basis_locked' using errcode = '23514';
    end if;
    if old.comparison_plan_id is null and new.comparison_plan_id is not null then
      if not exists (
        select 1
        from public.finance_plans plan
        where plan.id = new.comparison_plan_id
          and plan.tenant_id = new.tenant_id
          and plan.status = 'approved'
      ) then
        raise exception 'finance_actuals_require_approved_plan' using errcode = '23514';
      end if;
    end if;
    new.version := old.version + 1;
    new.created_by_user_id := old.created_by_user_id;
    new.created_at := old.created_at;
    new.schema_version := old.schema_version;
    new.tenant_id := old.tenant_id;
    new.month := old.month;
    new.source := old.source;
    if old.comparison_plan_id is not null then
      new.comparison_plan_id := old.comparison_plan_id;
    end if;
  else
    if new.tenant_id is distinct from 'tvg' then
      raise exception 'finance_tenant_rejected' using errcode = '23514';
    end if;
    if new.comparison_plan_id is not null and not exists (
      select 1
      from public.finance_plans plan
      where plan.id = new.comparison_plan_id
        and plan.tenant_id = new.tenant_id
        and plan.status = 'approved'
    ) then
      raise exception 'finance_actuals_require_approved_plan' using errcode = '23514';
    end if;
    new.version := 1;
    new.created_by_user_id := auth.uid();
    new.created_at := pg_catalog.now();
    if new.source is null then
      new.source := 'manual_entry';
    end if;
  end if;
  new.updated_by_user_id := auth.uid();
  new.updated_at := pg_catalog.now();
  return new;
end;
$$;

commit;

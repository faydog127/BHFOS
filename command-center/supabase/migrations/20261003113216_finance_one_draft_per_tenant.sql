-- One draft per tenant. Forward-only. No plan rows.
-- finance_open_draft returns the existing draft instead of inserting another.
-- No real TVG data may be entered in any Vercel Preview or staging environment.
-- The finance migration is not applied to any remote project by PR #164.
-- Preview must use a non-production Supabase project, or none.
-- Applying the migration anywhere requires explicit Command Center authorization.

begin;

create unique index finance_plans_one_draft
  on public.finance_plans (tenant_id)
  where status = 'draft';

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
  select *
  into draft_row
  from public.finance_plans
  where tenant_id = 'tvg'
    and status = 'draft'
  for update;
  if draft_row.id is not null then
    return draft_row;
  end if;
  begin
    insert into public.finance_plans (tenant_id, schema_version, inputs, notes)
    values ('tvg', source_row.schema_version, source_row.inputs, source_row.notes)
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
      return draft_row;
  end;
end;
$$;

commit;

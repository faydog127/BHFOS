-- Defense in depth: a draft becomes approved only when finance_plan_approvable
-- is true. The approve RPC already checks. This covers the transaction-local
-- finance.plan_transition = approve path, which PostgREST clients cannot set.
-- This does not edit an applied migration. It does not change grants.
-- No hosted project is contacted. No finance seed. No DELETE.

begin;

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
      if not public.finance_plan_approvable(old.inputs) then
        raise exception 'finance_plan_not_approvable' using errcode = '23514';
      end if;
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

commit;

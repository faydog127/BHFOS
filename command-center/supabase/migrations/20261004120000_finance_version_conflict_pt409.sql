-- Deliberate finance version conflicts use PT409 so PostgREST returns HTTP 409
-- once. A custom SQLSTATE 40001 is retried by PostgREST and the request can hang.
-- This file does not edit an earlier migration. It does not change grants, RLS,
-- or formulas. It does not rewrite a genuine serialization_failure.
--
-- Audit of public finance_* functions. Only the two functions below raise the
-- deliberate finance_version_conflict. The others do not raise 40001 and are
-- not replaced here:
--   finance_plan_access
--   finance_plan_document_ok
--   finance_plan_before_insert
--   finance_plan_before_update
--   finance_actual_before_write
--   finance_open_draft
--     calls finance_upgrade_draft_schema with the version it just read and
--     lets that function's error propagate. It has no conflict raise of its own.
-- Non-finance functions are out of scope.

begin;

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
    raise exception 'finance_version_conflict'
      using errcode = 'PT409',
            detail = 'finance_version_conflict',
            hint = 'finance_version_conflict';
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
    raise exception 'finance_version_conflict'
      using errcode = 'PT409',
            detail = 'finance_version_conflict',
            hint = 'finance_version_conflict';
  end if;
  return upgraded;
exception
  when others then
    perform set_config('finance.plan_transition', '', true);
    raise;
end;
$$;

commit;

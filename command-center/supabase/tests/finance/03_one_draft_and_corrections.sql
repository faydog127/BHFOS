-- One draft per tenant, and corrections only while the plan is approved.
-- Local disposable stack. One transaction, then rollback.
-- Usage: psql "$LOCAL_DB_URL" -v ON_ERROR_STOP=1 -f supabase/tests/finance/03_one_draft_and_corrections.sql

\set ON_ERROR_STOP on

begin;

create function pg_temp.finance_become(p_uid uuid, p_tenant text, p_role jsonb)
returns void
language plpgsql
as $$
begin
  perform set_config('request.jwt.claim.sub', p_uid::text, true);
  perform set_config(
    'request.jwt.claims',
    json_build_object(
      'sub', p_uid::text,
      'role', 'authenticated',
      'app_metadata', json_build_object('tenant_id', p_tenant, 'role', p_role),
      'user_metadata', json_build_object('tenant_id', 'tvg', 'role', 'admin')
    )::text,
    true
  );
  execute 'set local role authenticated';
end;
$$;

create function pg_temp.finance_clear()
returns void
language plpgsql
as $$
begin
  execute 'reset role';
  perform set_config('request.jwt.claim.sub', '', true);
  perform set_config('request.jwt.claims', '', true);
end;
$$;

do $$
declare
  v_admin uuid := 'cccccccc-cccc-4ccc-8ccc-ccccccccccc1';
  v_plan uuid;
  v_draft uuid;
  v_again uuid;
  v_next uuid;
  v_actual uuid;
  v_version integer;
  v_updated_by uuid;
  v_plan_id uuid;
  v_revenue numeric;
  v_updated_at timestamptz;
  v_drafts integer;
begin
  perform pg_temp.finance_become(v_admin, 'tvg', '"admin"'::jsonb);

  insert into public.finance_plans (tenant_id, schema_version, inputs)
  values ('tvg', 1, '{}'::jsonb)
  returning id into v_plan;

  begin
    insert into public.finance_plans (tenant_id, schema_version, inputs)
    values ('tvg', 1, '{}'::jsonb);
    raise exception 'FAIL: second draft inserted';
  exception
    when unique_violation then
      null;
  end;
  select count(*) into v_drafts from public.finance_plans where status = 'draft';
  if v_drafts <> 1 then
    raise exception 'FAIL: draft count before approval';
  end if;

  select id into v_plan from public.finance_approve_plan(v_plan, 1);

  insert into public.finance_monthly_actuals (tenant_id, plan_id, month, schema_version, total_revenue)
  values ('tvg', v_plan, date '2026-01-01', 1, null)
  returning id into v_actual;

  update public.finance_monthly_actuals
  set total_revenue = 1,
      version = 99,
      updated_by_user_id = '00000000-0000-4000-8000-000000000099',
      updated_at = timestamptz '2000-01-01'
  where id = v_actual
  returning version, updated_by_user_id, plan_id, total_revenue, updated_at
  into v_version, v_updated_by, v_plan_id, v_revenue, v_updated_at;
  if v_version <> 2
    or v_updated_by is distinct from v_admin
    or v_plan_id is distinct from v_plan
    or v_revenue is distinct from 1
    or v_updated_at is null
    or v_updated_at = timestamptz '2000-01-01' then
    raise exception 'FAIL: approved actual correction';
  end if;

  select id into v_draft from public.finance_open_draft(v_plan);
  select id into v_again from public.finance_open_draft(v_plan);
  if v_draft is null or v_again is distinct from v_draft or v_draft = v_plan then
    raise exception 'FAIL: open_draft did not return the existing draft';
  end if;
  select count(*) into v_drafts from public.finance_plans where status = 'draft';
  if v_drafts <> 1 then
    raise exception 'FAIL: open_draft created a second draft';
  end if;

  begin
    insert into public.finance_plans (tenant_id, schema_version, inputs)
    values ('tvg', 1, '{}'::jsonb);
    raise exception 'FAIL: second draft after open_draft';
  exception
    when unique_violation then
      null;
  end;

  select version into v_version from public.finance_plans where id = v_draft and status = 'draft';
  select id into v_next from public.finance_approve_plan(v_draft, v_version);

  select plan_id, version, total_revenue
  into v_plan_id, v_version, v_revenue
  from public.finance_monthly_actuals
  where id = v_actual;
  if v_plan_id is distinct from v_plan or v_version <> 2 or v_revenue is distinct from 1 then
    raise exception 'FAIL: approval rebound historical actual';
  end if;

  begin
    update public.finance_monthly_actuals
    set plan_id = v_next, total_revenue = 2
    where id = v_actual;
    raise exception 'FAIL: superseded actual corrected';
  exception
    when check_violation then
      null;
  end;
  select plan_id, version, total_revenue
  into v_plan_id, v_version, v_revenue
  from public.finance_monthly_actuals
  where id = v_actual;
  if v_plan_id is distinct from v_plan or v_version <> 2 or v_revenue is distinct from 1 then
    raise exception 'FAIL: superseded actual changed';
  end if;

  perform pg_temp.finance_clear();
  raise notice 'PASS: one draft and approved corrections';
end $$;

rollback;

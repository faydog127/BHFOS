-- Stage A finance RLS, grant, version, and approval tests.
-- Local disposable stack only. One transaction, then rollback.
-- Usage: psql "$LOCAL_DB_URL" -v ON_ERROR_STOP=1 -f supabase/tests/finance/01_rls_and_version.sql

\set ON_ERROR_STOP on

select 'finance_plans_before' as check_name, count(*) as row_count from public.finance_plans;
select 'finance_actuals_before' as check_name, count(*) as row_count from public.finance_monthly_actuals;

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

create function pg_temp.finance_become_role(p_role name)
returns void
language plpgsql
as $$
begin
  perform set_config('request.jwt.claim.sub', '', true);
  perform set_config('request.jwt.claims', '', true);
  execute format('set local role %I', p_role);
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

-- Finance audit columns do not reference auth.users. Tests use JWT subjects only.

do $$
declare
  v_plans_rls boolean;
  v_plans_force boolean;
  v_actuals_rls boolean;
  v_actuals_force boolean;
  v_policy_count integer;
  v_bad_policy integer;
  v_realtime integer;
begin
  select c.relrowsecurity, c.relforcerowsecurity
  into v_plans_rls, v_plans_force
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relname = 'finance_plans';
  select c.relrowsecurity, c.relforcerowsecurity
  into v_actuals_rls, v_actuals_force
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relname = 'finance_monthly_actuals';
  if v_plans_rls is not true or v_plans_force is not true then
    raise exception 'FAIL: finance_plans RLS not enabled and forced';
  end if;
  if v_actuals_rls is not true or v_actuals_force is not true then
    raise exception 'FAIL: finance_monthly_actuals RLS not enabled and forced';
  end if;

  select count(*) into v_policy_count
  from pg_policies
  where schemaname = 'public'
    and tablename in ('finance_plans', 'finance_monthly_actuals');
  if v_policy_count <> 6 then
    raise exception 'FAIL: expected 6 finance policies, found %', v_policy_count;
  end if;
  select count(*) into v_bad_policy
  from pg_policies
  where schemaname = 'public'
    and tablename in ('finance_plans', 'finance_monthly_actuals')
    and (
      roles::text not like '%authenticated%'
      or cmd not in ('SELECT', 'INSERT', 'UPDATE')
      or qual = 'true'
      or with_check = 'true'
      or (cmd in ('SELECT', 'UPDATE') and coalesce(qual, '') not like '%finance_plan_access%')
      or (cmd in ('INSERT', 'UPDATE') and coalesce(with_check, '') not like '%finance_plan_access%')
    );
  if v_bad_policy <> 0 then
    raise exception 'FAIL: finance policy is not authenticated + finance_plan_access';
  end if;

  select count(*) into v_realtime
  from pg_publication_tables
  where pubname = 'supabase_realtime'
    and schemaname = 'public'
    and tablename in ('finance_plans', 'finance_monthly_actuals');
  if v_realtime <> 0 then
    raise exception 'FAIL: finance tables are in supabase_realtime';
  end if;

  if has_table_privilege('anon', 'public.finance_plans', 'SELECT')
    or has_table_privilege('anon', 'public.finance_plans', 'INSERT')
    or has_table_privilege('anon', 'public.finance_plans', 'UPDATE')
    or has_table_privilege('anon', 'public.finance_plans', 'DELETE')
    or has_table_privilege('anon', 'public.finance_monthly_actuals', 'SELECT')
    or has_table_privilege('service_role', 'public.finance_plans', 'SELECT')
    or has_table_privilege('service_role', 'public.finance_plans', 'INSERT')
    or has_table_privilege('authenticated', 'public.finance_plans', 'DELETE')
    or has_table_privilege('authenticated', 'public.finance_monthly_actuals', 'DELETE')
    or not has_table_privilege('authenticated', 'public.finance_plans', 'SELECT')
    or not has_table_privilege('authenticated', 'public.finance_plans', 'INSERT')
    or not has_table_privilege('authenticated', 'public.finance_plans', 'UPDATE')
    or not has_table_privilege('authenticated', 'public.finance_monthly_actuals', 'SELECT')
    or not has_table_privilege('authenticated', 'public.finance_monthly_actuals', 'INSERT')
    or not has_table_privilege('authenticated', 'public.finance_monthly_actuals', 'UPDATE')
  then
    raise exception 'FAIL: finance table grants';
  end if;
  if has_function_privilege('public', 'public.finance_plan_access()', 'EXECUTE')
    or not has_function_privilege('authenticated', 'public.finance_plan_access()', 'EXECUTE')
    or not has_function_privilege('service_role', 'public.finance_plan_access()', 'EXECUTE')
    or has_function_privilege('anon', 'public.finance_approve_plan(uuid, integer)', 'EXECUTE')
    or not has_function_privilege('authenticated', 'public.finance_approve_plan(uuid, integer)', 'EXECUTE')
    or has_function_privilege('public', 'public.finance_open_draft(uuid)', 'EXECUTE')
  then
    raise exception 'FAIL: finance function grants';
  end if;
  raise notice 'PASS: force rls, policies, grants, realtime absent';
end $$;

do $$
declare
  v_admin uuid := 'cccccccc-cccc-4ccc-8ccc-ccccccccccc1';
  v_count integer;
begin
  perform pg_temp.finance_become_role('anon');
  begin
    perform 1 from public.finance_plans;
    raise exception 'FAIL: anon select';
  exception
    when insufficient_privilege then
      null;
  end;
  begin
    insert into public.finance_plans (tenant_id, schema_version, inputs)
    values ('tvg', 1, '{}'::jsonb);
    raise exception 'FAIL: anon insert';
  exception
    when insufficient_privilege then
      null;
  end;
  begin
    delete from public.finance_plans;
    raise exception 'FAIL: anon delete';
  exception
    when insufficient_privilege then
      null;
  end;
  perform pg_temp.finance_clear();

  perform pg_temp.finance_become(v_admin, 'other', '"admin"'::jsonb);
  if public.finance_plan_access() then
    raise exception 'FAIL: wrong tenant helper';
  end if;
  select count(*) into v_count from public.finance_plans;
  if v_count <> 0 then
    raise exception 'FAIL: wrong tenant select';
  end if;
  begin
    insert into public.finance_plans (tenant_id, schema_version, inputs)
    values ('tvg', 1, '{}'::jsonb);
    raise exception 'FAIL: cross-tenant insert';
  exception
    when insufficient_privilege then
      null;
  end;
  perform pg_temp.finance_clear();
  raise notice 'PASS: anon and wrong-tenant denied';
end $$;

do $$
declare
  v_owner uuid := 'cccccccc-cccc-4ccc-8ccc-ccccccccccc3';
  v_manager uuid := 'cccccccc-cccc-4ccc-8ccc-ccccccccccc4';
  v_viewer uuid := 'cccccccc-cccc-4ccc-8ccc-ccccccccccc5';
  v_admin uuid := 'cccccccc-cccc-4ccc-8ccc-ccccccccccc1';
  v_role text;
  v_count integer;
begin
  foreach v_role in array array['owner', 'manager', 'viewer'] loop
    perform pg_temp.finance_become(
      case v_role
        when 'owner' then v_owner
        when 'manager' then v_manager
        else v_viewer
      end,
      'tvg',
      to_jsonb(v_role)
    );
    if public.finance_plan_access() then
      raise exception 'FAIL: role % helper allowed', v_role;
    end if;
    select count(*) into v_count from public.finance_plans;
    if v_count <> 0 then
      raise exception 'FAIL: role % select', v_role;
    end if;
    begin
      insert into public.finance_plans (tenant_id, schema_version, inputs)
      values ('tvg', 1, '{}'::jsonb);
      raise exception 'FAIL: role % insert', v_role;
    exception
      when insufficient_privilege then
        null;
    end;
    perform pg_temp.finance_clear();
  end loop;

  perform pg_temp.finance_become(v_admin, 'tvg', '["admin"]'::jsonb);
  if public.finance_plan_access() then
    raise exception 'FAIL: array role allowed';
  end if;
  select count(*) into v_count from public.finance_plans;
  if v_count <> 0 then
    raise exception 'FAIL: array role select';
  end if;
  perform pg_temp.finance_clear();

  perform pg_temp.finance_become(v_admin, null, 'null'::jsonb);
  if public.finance_plan_access() then
    raise exception 'FAIL: missing claims allowed';
  end if;
  perform pg_temp.finance_clear();
  raise notice 'PASS: owner manager viewer array role and missing claims denied';
end $$;

do $$
declare
  v_admin uuid := 'cccccccc-cccc-4ccc-8ccc-ccccccccccc1';
  v_super uuid := 'cccccccc-cccc-4ccc-8ccc-ccccccccccc2';
  v_plan uuid;
  v_version integer;
  v_notes text;
  v_status text;
  v_approved_by uuid;
  v_count integer;
  v_actual uuid;
  v_money numeric;
begin
  perform pg_temp.finance_become(v_admin, 'tvg', '"admin"'::jsonb);
  if not public.finance_plan_access() then
    raise exception 'FAIL: admin helper';
  end if;
  insert into public.finance_plans (tenant_id, status, version, schema_version, inputs, approved_by)
  values ('tvg', 'approved', 9, 1, '{"structural":{}}'::jsonb, v_admin)
  returning id, version, status, approved_by into v_plan, v_version, v_status, v_approved_by;
  if v_version <> 1 or v_status <> 'draft' or v_approved_by is not null then
    raise exception 'FAIL: insert trigger did not force draft';
  end if;

  update public.finance_plans
  set notes = 'synthetic-note-a', version = 1
  where id = v_plan and version = 1;
  select version, notes into v_version, v_notes from public.finance_plans where id = v_plan;
  if v_version <> 2 or v_notes <> 'synthetic-note-a' then
    raise exception 'FAIL: first update version';
  end if;

  update public.finance_plans
  set notes = 'synthetic-note-b'
  where id = v_plan and version = 1;
  get diagnostics v_count = row_count;
  select version, notes into v_version, v_notes from public.finance_plans where id = v_plan;
  if v_count <> 0 or v_version <> 2 or v_notes <> 'synthetic-note-a' then
    raise exception 'FAIL: stale version write changed the row';
  end if;

  begin
    update public.finance_plans set tenant_id = 'other' where id = v_plan;
    raise exception 'FAIL: tenant update';
  exception
    when check_violation then
      null;
  end;

  begin
    update public.finance_plans set status = 'approved' where id = v_plan and version = 2;
    raise exception 'FAIL: client approval';
  exception
    when check_violation then
      null;
  end;

  begin
    insert into public.finance_monthly_actuals (tenant_id, plan_id, month, schema_version)
    values ('tvg', v_plan, date '2026-01-01', 1);
    raise exception 'FAIL: actual on draft';
  exception
    when check_violation then
      null;
  end;

  begin
    delete from public.finance_plans where id = v_plan;
    raise exception 'FAIL: admin delete';
  exception
    when insufficient_privilege then
      null;
  end;

  select status, approved_by into v_status, v_approved_by
  from public.finance_approve_plan(v_plan, 2);
  if v_status <> 'approved' or v_approved_by <> v_admin then
    raise exception 'FAIL: approval stamp';
  end if;
  select version into v_version from public.finance_plans where id = v_plan;
  if v_version <> 3 then
    raise exception 'FAIL: approval version';
  end if;

  begin
    update public.finance_plans set notes = 'synthetic-note-c' where id = v_plan and status = 'approved';
    raise exception 'FAIL: approved rewrite';
  exception
    when check_violation then
      null;
  end;
  select notes into v_notes from public.finance_plans where id = v_plan;
  if v_notes <> 'synthetic-note-a' then
    raise exception 'FAIL: approved notes changed';
  end if;

  begin
    perform public.finance_approve_plan(v_plan, 3);
    raise exception 'FAIL: second approve';
  exception
    when serialization_failure then
      null;
  end;

  begin
    insert into public.finance_monthly_actuals (tenant_id, plan_id, month, schema_version, total_revenue)
    values ('tvg', 'dddddddd-dddd-4ddd-8ddd-ddddddddddd1', date '2026-01-01', 1, null);
    raise exception 'FAIL: missing plan actual';
  exception
    when check_violation or foreign_key_violation then
      null;
  end;

  insert into public.finance_monthly_actuals (tenant_id, plan_id, month, schema_version, total_revenue)
  values ('tvg', v_plan, date '2026-01-01', 1, null)
  returning id, total_revenue into v_actual, v_money;
  if v_money is not null then
    raise exception 'FAIL: null actual coerced';
  end if;

  begin
    insert into public.finance_monthly_actuals (tenant_id, plan_id, month, schema_version, total_revenue)
    values ('tvg', v_plan, date '2026-02-01', 1, -1);
    raise exception 'FAIL: negative actual';
  exception
    when check_violation then
      null;
  end;

  begin
    delete from public.finance_monthly_actuals where id = v_actual;
    raise exception 'FAIL: actual delete';
  exception
    when insufficient_privilege then
      null;
  end;

  declare
    v_draft uuid;
    v_draft_status text;
  begin
    select id, status into v_draft, v_draft_status
    from public.finance_open_draft(v_plan);
    if v_draft is null or v_draft = v_plan or v_draft_status <> 'draft' then
      raise exception 'FAIL: open draft';
    end if;
    select status, notes into v_status, v_notes from public.finance_plans where id = v_plan;
    if v_status <> 'approved' or v_notes <> 'synthetic-note-a' then
      raise exception 'FAIL: approved row changed by open draft';
    end if;
    begin
      insert into public.finance_monthly_actuals (tenant_id, plan_id, month, schema_version)
      values ('tvg', v_draft, date '2026-03-01', 1);
      raise exception 'FAIL: actual on new draft';
    exception
      when check_violation then
        null;
    end;
  end;

  perform pg_temp.finance_clear();
  perform pg_temp.finance_become(v_super, 'tvg', '"super_admin"'::jsonb);
  if not public.finance_plan_access() then
    raise exception 'FAIL: super_admin helper';
  end if;
  perform pg_temp.finance_clear();
  raise notice 'PASS: admin write, conflict, approval, actuals';
end $$;

rollback;

select 'finance_plans_after' as check_name, count(*) as row_count from public.finance_plans;
select 'finance_actuals_after' as check_name, count(*) as row_count from public.finance_monthly_actuals;

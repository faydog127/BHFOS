-- Stage A fix tests. Local disposable stack. One transaction, then rollback.
-- Usage: psql "$LOCAL_DB_URL" -v ON_ERROR_STOP=1 -f supabase/tests/finance/02_stage_a_security_fixes.sql

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

create function pg_temp.finance_claims(p_uid uuid, p_claims jsonb)
returns void
language plpgsql
as $$
begin
  perform set_config('request.jwt.claim.sub', coalesce(p_uid::text, ''), true);
  perform set_config(
    'request.jwt.claims',
    (p_claims || jsonb_build_object('sub', p_uid::text, 'role', 'authenticated'))::text,
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
  v_numeric integer;
  v_money text;
  v_hours text;
  v_month text;
begin
  select count(*) into v_numeric
  from information_schema.columns
  where table_schema = 'public'
    and table_name = 'finance_plans'
    and data_type in ('numeric', 'double precision', 'real', 'date');
  if v_numeric <> 0 then
    raise exception 'FAIL: finance_plans has a numeric or date input column';
  end if;
  select pg_get_constraintdef(oid) into v_money
  from pg_constraint
  where conname = 'finance_actuals_money_nonnegative';
  select pg_get_constraintdef(oid) into v_hours
  from pg_constraint
  where conname = 'finance_actuals_hours_nonnegative';
  select pg_get_constraintdef(oid) into v_month
  from pg_constraint
  where conname = 'finance_actuals_month_first';
  if v_money not like '%NaN%' or v_hours not like '%NaN%' or v_month not like '%isfinite%' then
    raise exception 'FAIL: finite numeric guards missing';
  end if;
  if has_function_privilege('public', 'public.finance_actual_before_write()', 'EXECUTE')
    or has_function_privilege('anon', 'public.finance_actual_before_write()', 'EXECUTE')
    or has_function_privilege('public', 'public.finance_plan_before_insert()', 'EXECUTE')
    or has_function_privilege('anon', 'public.finance_plan_before_update()', 'EXECUTE')
    or not has_function_privilege('authenticated', 'public.finance_actual_before_write()', 'EXECUTE')
  then
    raise exception 'FAIL: trigger function execute grants';
  end if;
  raise notice 'PASS: numeric guards and trigger execute grants';
end $$;

do $$
declare
  v_admin uuid := 'cccccccc-cccc-4ccc-8ccc-ccccccccccc1';
begin
  perform pg_temp.finance_become(v_admin, 'TVG', '"admin"'::jsonb);
  if public.finance_plan_access() is not true then
    raise exception 'FAIL: TVG tenant helper';
  end if;
  perform pg_temp.finance_clear();

  perform pg_temp.finance_become(v_admin, ' tvg ', '"admin"'::jsonb);
  if public.finance_plan_access() is not true then
    raise exception 'FAIL: spaced tenant helper';
  end if;
  perform pg_temp.finance_clear();

  perform pg_temp.finance_claims(
    v_admin,
    jsonb_build_object('user_metadata', jsonb_build_object('tenant_id', 'tvg', 'role', 'admin'))
  );
  if public.finance_plan_access() is true then
    raise exception 'FAIL: absent app_metadata allowed';
  end if;
  if (select count(*) from public.finance_plans) <> 0 then
    raise exception 'FAIL: absent app_metadata select';
  end if;
  begin
    perform public.finance_approve_plan('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee1', 1);
    raise exception 'FAIL: absent app_metadata approve';
  exception
    when insufficient_privilege then
      null;
  end;
  perform pg_temp.finance_clear();

  perform pg_temp.finance_become(v_admin, null, '"admin"'::jsonb);
  if public.finance_plan_access() is not null then
    raise exception 'FAIL: null tenant access should be null';
  end if;
  begin
    perform public.finance_approve_plan('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee1', 1);
    raise exception 'FAIL: null access approve';
  exception
    when insufficient_privilege then
      null;
  end;
  begin
    perform public.finance_open_draft('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee1');
    raise exception 'FAIL: null access draft';
  exception
    when insufficient_privilege then
      null;
  end;
  perform pg_temp.finance_clear();
  raise notice 'PASS: tenant normalize, absent app_metadata, null access';
end $$;

do $$
declare
  v_admin uuid := 'cccccccc-cccc-4ccc-8ccc-ccccccccccc1';
  v_plan uuid;
  v_next uuid;
  v_actual uuid;
  v_money numeric;
  v_notes text;
begin
  perform pg_temp.finance_become(v_admin, 'tvg', '"admin"'::jsonb);
  insert into public.finance_plans (tenant_id, schema_version, inputs)
  values ('tvg', 1, '{}'::jsonb)
  returning id into v_plan;
  select id into v_plan from public.finance_approve_plan(v_plan, 1);
  insert into public.finance_monthly_actuals (tenant_id, plan_id, month, schema_version, total_revenue, productive_unit_hours)
  values ('tvg', v_plan, date '2026-01-01', 1, null, null)
  returning id into v_actual;

  begin
    insert into public.finance_monthly_actuals (tenant_id, plan_id, month, schema_version, total_revenue)
    values ('tvg', v_plan, date '2026-02-01', 1, 'NaN');
    raise exception 'FAIL: money NaN';
  exception
    when check_violation then
      null;
  end;
  begin
    insert into public.finance_monthly_actuals (tenant_id, plan_id, month, schema_version, total_revenue)
    values ('tvg', v_plan, date '2026-02-01', 1, 'Infinity');
    raise exception 'FAIL: money infinity';
  exception
    when check_violation or numeric_value_out_of_range then
      null;
  end;
  begin
    insert into public.finance_monthly_actuals (tenant_id, plan_id, month, schema_version, productive_unit_hours)
    values ('tvg', v_plan, date '2026-03-01', 1, 'NaN');
    raise exception 'FAIL: hours NaN';
  exception
    when check_violation then
      null;
  end;
  begin
    insert into public.finance_monthly_actuals (tenant_id, plan_id, month, schema_version, productive_unit_hours)
    values ('tvg', v_plan, date '2026-03-01', 1, 'Infinity');
    raise exception 'FAIL: hours infinity';
  exception
    when check_violation or numeric_value_out_of_range then
      null;
  end;
  begin
    insert into public.finance_monthly_actuals (tenant_id, plan_id, month, schema_version, total_jobs)
    values ('tvg', v_plan, date '2026-04-01', 1, 'NaN');
    raise exception 'FAIL: count NaN';
  exception
    when invalid_text_representation then
      null;
  end;
  begin
    insert into public.finance_monthly_actuals (tenant_id, plan_id, month, schema_version, total_jobs)
    values ('tvg', v_plan, date '2026-04-01', 1, 'Infinity');
    raise exception 'FAIL: count infinity';
  exception
    when invalid_text_representation then
      null;
  end;
  begin
    insert into public.finance_monthly_actuals (tenant_id, plan_id, month, schema_version)
    values ('tvg', v_plan, 'infinity', 1);
    raise exception 'FAIL: month infinity';
  exception
    when datetime_field_overflow or check_violation or invalid_datetime_format then
      null;
  end;

  update public.finance_monthly_actuals
  set notes = 'synthetic-note-current'
  where id = v_actual;
  select notes into v_notes from public.finance_monthly_actuals where id = v_actual;
  if v_notes <> 'synthetic-note-current' then
    raise exception 'FAIL: approved actual note';
  end if;

  insert into public.finance_plans (tenant_id, schema_version, inputs)
  values ('tvg', 1, '{}'::jsonb)
  returning id into v_next;
  perform public.finance_approve_plan(v_next, 1);

  begin
    update public.finance_monthly_actuals
    set plan_id = v_next, total_revenue = 1
    where id = v_actual;
    raise exception 'FAIL: superseded actual edited';
  exception
    when check_violation then
      null;
  end;
  select total_revenue, notes into v_money, v_notes
  from public.finance_monthly_actuals
  where id = v_actual;
  if v_money is not null or v_notes <> 'synthetic-note-current' then
    raise exception 'FAIL: superseded history changed';
  end if;

  begin
    update public.finance_monthly_actuals
    set notes = 'synthetic-note-rewritten'
    where id = v_actual;
    raise exception 'FAIL: superseded notes edited';
  exception
    when check_violation then
      null;
  end;
  select notes into v_notes from public.finance_monthly_actuals where id = v_actual;
  if v_notes <> 'synthetic-note-current' then
    raise exception 'FAIL: superseded notes persisted';
  end if;

  perform pg_temp.finance_clear();
  raise notice 'PASS: NaN infinity and superseded history';
end $$;

rollback;

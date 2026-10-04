-- Stage C1 monthly plan basis. Local disposable stack. One transaction, then rollback.
-- Usage: psql "$LOCAL_DB_URL" -v ON_ERROR_STOP=1 -f supabase/tests/finance/06_monthly_basis.sql

\set ON_ERROR_STOP on

begin;

\ir plan_document_fixture.sql

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

do $$
declare
  v_admin uuid := 'cccccccc-cccc-4ccc-8ccc-ccccccccccc1';
  v_hist uuid;
  v_from_v1 uuid;
  v_rich uuid;
  v_copy uuid;
  v_again uuid;
  v_living uuid;
  v_actual uuid;
  v_version integer;
  v_schema integer;
  v_status text;
  v_notes text;
  v_kept text;
  v_basis jsonb;
  v_jobs jsonb;
  v_cash numeric;
  v_total numeric;
  v_plan_id uuid;
  v_drafts integer;
  v_omitted boolean;
  v_plans_def text;
  v_actuals_def text;
  v_force boolean;
begin
  if (select count(*) from public.finance_plans) <> 0
    or (select count(*) from public.finance_monthly_actuals) <> 0 then
    raise exception 'FAIL: finance seed rows';
  end if;

  select c.relforcerowsecurity into v_force
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relname = 'finance_plans';
  if v_force is not true then
    raise exception 'FAIL: finance_plans force rls';
  end if;
  select pg_get_constraintdef(oid) into v_plans_def
  from pg_constraint
  where conname = 'finance_plans_schema_version';
  select pg_get_constraintdef(oid) into v_actuals_def
  from pg_constraint
  where conname = 'finance_actuals_schema_version';
  if v_plans_def not like '%1%' or v_plans_def not like '%2%' then
    raise exception 'FAIL: plan schema check %', v_plans_def;
  end if;
  if v_actuals_def like '%2%' or v_actuals_def not like '%1%' then
    raise exception 'FAIL: actuals schema check changed %', v_actuals_def;
  end if;
  if has_function_privilege('anon', 'public.finance_upgrade_draft_schema(uuid, integer)', 'EXECUTE')
    or has_function_privilege('public', 'public.finance_upgrade_draft_schema(uuid, integer)', 'EXECUTE')
    or has_function_privilege('service_role', 'public.finance_upgrade_draft_schema(uuid, integer)', 'EXECUTE')
    or not has_function_privilege('authenticated', 'public.finance_upgrade_draft_schema(uuid, integer)', 'EXECUTE')
    or has_function_privilege('anon', 'public.finance_plan_document_ok(integer, jsonb)', 'EXECUTE')
    or has_function_privilege('public', 'public.finance_plan_document_ok(integer, jsonb)', 'EXECUTE')
    or not has_function_privilege('authenticated', 'public.finance_plan_document_ok(integer, jsonb)', 'EXECUTE')
    or has_table_privilege('authenticated', 'public.finance_plans', 'DELETE')
    or has_table_privilege('authenticated', 'public.finance_monthly_actuals', 'DELETE')
  then
    raise exception 'FAIL: monthly basis grants';
  end if;

  perform pg_temp.finance_become(v_admin, 'tvg', '"admin"'::jsonb);

  if public.finance_plan_document_ok(2, '{"monthly_basis":{}}'::jsonb) then
    raise exception 'FAIL: minimal v2 accepted';
  end if;
  if public.finance_plan_document_ok(2, '{"structural":{},"stages":{},"staffing":[],"owner_field_replacement":{},"cost_pools":{},"channels":[],"services":{},"monthly_basis":{}}'::jsonb) then
    raise exception 'FAIL: malformed v2 sections accepted';
  end if;
  if public.finance_plan_document_ok(2, pg_temp.finance_v2_document('{"0000-01-01":{}}'::jsonb)) then
    raise exception 'FAIL: year 0000 accepted';
  end if;
  if ('-0'::jsonb #>> '{}') ~ '^-0' then
    if public.finance_plan_document_ok(2, pg_temp.finance_v2_document(jsonb_build_object('2026-06-01', jsonb_build_object('total_revenue', '-0'::jsonb)))) then
      raise exception 'FAIL: negative zero accepted';
    end if;
  elsif ('-0'::jsonb #>> '{}') is distinct from '0' then
    raise exception 'FAIL: negative zero text %', '-0'::jsonb #>> '{}';
  end if;
  if public.finance_plan_document_ok(1, pg_temp.finance_v1_document()) is not true then
    raise exception 'FAIL: full historical v1 rejected';
  end if;
  if public.finance_plan_document_ok(1, '{"kept":true}'::jsonb) is not true then
    raise exception 'FAIL: historical v1 without sections rejected';
  end if;
  if public.finance_plan_document_ok(2, pg_temp.finance_v2_document('{}'::jsonb)) is not true then
    raise exception 'FAIL: full v2 rejected';
  end if;
  if public.finance_plan_document_ok(2, pg_temp.finance_v2_document(jsonb_build_object('2026-07-01', jsonb_build_object('total_revenue', 1234567.89)))) is not true then
    raise exception 'FAIL: 7-digit cents rejected';
  end if;
  if public.finance_plan_document_ok(2, pg_temp.finance_v2_document(jsonb_build_object('2026-07-01', jsonb_build_object('total_revenue', 12345678.89)))) is not true then
    raise exception 'FAIL: 8-digit cents rejected';
  end if;
  if public.finance_plan_document_ok(2, pg_temp.finance_v2_document(jsonb_build_object('2026-07-01', jsonb_build_object('total_revenue', 123456789012.89)))) is not true then
    raise exception 'FAIL: 12-digit cents rejected';
  end if;
  if public.finance_plan_document_ok(2, pg_temp.finance_v2_document(jsonb_build_object('2026-07-01', jsonb_build_object('productive_unit_hours', 12345678.89)))) is not true then
    raise exception 'FAIL: 8-digit hours rejected';
  end if;
  if public.finance_plan_document_ok(2, pg_temp.finance_v2_document(jsonb_build_object('2026-07-01', jsonb_build_object('total_revenue', 1234567890123.89)))) then
    raise exception 'FAIL: 13 whole digits accepted';
  end if;
  if public.finance_plan_document_ok(2, pg_temp.finance_v2_document(jsonb_build_object('2026-07-01', jsonb_build_object('total_revenue', 1.001)))) then
    raise exception 'FAIL: three decimal places accepted';
  end if;
  if public.finance_plan_document_ok(2, pg_temp.finance_v2_document(jsonb_build_object('2026-07-01', jsonb_build_object('total_revenue', -1234567.89)))) then
    raise exception 'FAIL: negative money accepted';
  end if;
  if public.finance_plan_document_ok(2, pg_temp.finance_v2_document(jsonb_build_object('2026-07-01', jsonb_build_object('productive_unit_hours', 123456789.89)))) then
    raise exception 'FAIL: 9-digit hours accepted';
  end if;

  -- A minimal version 1 row stays valid storage. Upgrade and open-draft copy it
  -- into a version 2 document and then fail closed. This probe rolls back.
  begin
    insert into public.finance_plans (tenant_id, schema_version, inputs, notes)
    values ('tvg', 1, '{"kept":true}'::jsonb, 'minimal-v1-probe')
    returning id, version into v_hist, v_version;
    begin
      perform public.finance_upgrade_draft_schema(v_hist, v_version);
      raise exception 'FAIL: minimal v1 upgrade accepted';
    exception
      when check_violation then
        null;
    end;
    select version into v_version from public.finance_plans where id = v_hist;
    perform public.finance_approve_plan(v_hist, v_version);
    begin
      perform public.finance_open_draft(v_hist);
      raise exception 'FAIL: minimal v1 open draft accepted';
    exception
      when check_violation then
        null;
    end;
    raise exception 'rollback minimal v1 probe';
  exception
    when raise_exception then
      if sqlerrm is distinct from 'rollback minimal v1 probe' then
        raise;
      end if;
  end;
  if (select count(*) from public.finance_plans) <> 0 then
    raise exception 'FAIL: minimal v1 probe left rows';
  end if;

  insert into public.finance_plans (tenant_id, schema_version, inputs, notes)
  values ('tvg', 1, pg_temp.finance_v1_document(), 'preserve-me')
  returning id into v_hist;

  begin
    update public.finance_plans
    set inputs = '{"kept":true,"monthly_basis":{}}'::jsonb
    where id = v_hist;
    raise exception 'FAIL: version 1 stored monthly_basis';
  exception
    when check_violation then
      null;
  end;

  update public.finance_plans
  set schema_version = 2
  where id = v_hist
  returning schema_version, version into v_schema, v_version;
  if v_schema <> 1 or v_version <> 2 then
    raise exception 'FAIL: ordinary update changed schema_version';
  end if;

  begin
    update public.finance_plans
    set schema_version = 2,
        inputs = '{"kept":true,"monthly_basis":{}}'::jsonb
    where id = v_hist;
    raise exception 'FAIL: ordinary update stored a version 2 basis';
  exception
    when check_violation then
      null;
  end;

  select version into v_version from public.finance_plans where id = v_hist;
  select id into v_hist from public.finance_approve_plan(v_hist, v_version);
  select schema_version, status, notes, inputs ->> 'kept'
  into v_schema, v_status, v_notes, v_kept
  from public.finance_plans
  where id = v_hist;
  if v_schema <> 1 or v_status <> 'approved' or v_notes <> 'preserve-me' or v_kept <> 'true' then
    raise exception 'FAIL: approved v1 changed during approval';
  end if;

  insert into public.finance_monthly_actuals (
    tenant_id, comparison_plan_id, month, schema_version, total_revenue, cash_reserve
  )
  values ('tvg', v_hist, date '2026-01-01', 1, 4.00, 0)
  returning id into v_actual;

  select id, schema_version, notes, inputs ->> 'kept', inputs -> 'monthly_basis'
  into v_from_v1, v_schema, v_notes, v_kept, v_basis
  from public.finance_open_draft(v_hist);
  if v_from_v1 is null or v_from_v1 = v_hist or v_schema <> 2 or v_notes <> 'preserve-me' or v_kept <> 'true' or v_basis <> '{}'::jsonb then
    raise exception 'FAIL: approved v1 did not open a new empty v2 draft';
  end if;
  select id into v_again from public.finance_open_draft(v_hist);
  if v_again is distinct from v_from_v1 then
    raise exception 'FAIL: second open_draft from v1 created another row';
  end if;
  select schema_version, status into v_schema, v_status from public.finance_plans where id = v_hist;
  if v_schema <> 1 or v_status <> 'approved' then
    raise exception 'FAIL: approved v1 upgraded in place';
  end if;

  select version into v_version from public.finance_plans where id = v_from_v1;
  select id into v_from_v1 from public.finance_approve_plan(v_from_v1, v_version);

  insert into public.finance_plans (tenant_id, schema_version, inputs, notes)
  values ('tvg', 1, pg_temp.finance_v1_document(), 'upgrade-me')
  returning id, version into v_rich, v_version;

  begin
    perform public.finance_upgrade_draft_schema(v_rich, v_version - 1);
    raise exception 'FAIL: stale upgrade';
  exception
    when sqlstate 'PT409' then
      if sqlerrm <> 'finance_version_conflict' then
        raise exception 'FAIL: stale upgrade message %', sqlerrm;
      end if;
  end;

  select id, schema_version, version, notes, inputs ->> 'kept', inputs -> 'monthly_basis'
  into v_again, v_schema, v_version, v_notes, v_kept, v_basis
  from public.finance_upgrade_draft_schema(v_rich, v_version);
  if v_again is distinct from v_rich or v_schema <> 2 or v_notes <> 'upgrade-me' or v_kept <> 'true' or v_basis <> '{}'::jsonb then
    raise exception 'FAIL: v1 draft to v2 draft';
  end if;

  begin
    perform public.finance_upgrade_draft_schema(v_rich, v_version);
    raise exception 'FAIL: second upgrade';
  exception
    when sqlstate 'PT409' then
      null;
  end;

  begin
    update public.finance_plans
    set inputs = '{"kept":true,"monthly_basis":{"2026-02-15":{"total_revenue":1}}}'::jsonb
    where id = v_rich;
    raise exception 'FAIL: bad month key';
  exception
    when check_violation then
      if sqlerrm not like '%finance_plans_monthly_basis%' then
        raise exception 'FAIL: bad month message %', sqlerrm;
      end if;
  end;

  begin
    update public.finance_plans
    set inputs = '{"kept":true,"monthly_basis":{"2026-02-01":{"notes":1}}}'::jsonb
    where id = v_rich;
    raise exception 'FAIL: extra basis key';
  exception
    when check_violation then
      null;
  end;

  begin
    update public.finance_plans
    set inputs = '{"kept":true,"monthly_basis":{"2026-02-01":{"total_revenue":-1}}}'::jsonb
    where id = v_rich;
    raise exception 'FAIL: negative basis';
  exception
    when check_violation then
      null;
  end;

  begin
    update public.finance_plans
    set inputs = '{"kept":true,"monthly_basis":{"2026-02-01":{"total_jobs":1.5}}}'::jsonb
    where id = v_rich;
    raise exception 'FAIL: fractional count';
  exception
    when check_violation then
      null;
  end;

  begin
    update public.finance_plans
    set inputs = '{"kept":true,"monthly_basis":{"2026-02-01":{"total_revenue":4,"direct_residential_revenue":5}}}'::jsonb
    where id = v_rich;
    raise exception 'FAIL: channel above total';
  exception
    when check_violation then
      null;
  end;

  begin
    update public.finance_plans
    set inputs = '{"kept":true,"monthly_basis":{"2026-02-01":{"total_revenue":4,"direct_residential_revenue":1,"commercial_direct_revenue":1,"portal_revenue":1}}}'::jsonb
    where id = v_rich;
    raise exception 'FAIL: channels not equal total';
  exception
    when check_violation then
      null;
  end;

  begin
    update public.finance_plans
    set inputs = '{"kept":true}'::jsonb
    where id = v_rich;
    raise exception 'FAIL: version 2 without monthly_basis';
  exception
    when check_violation then
      null;
  end;

  update public.finance_plans
  set inputs = pg_temp.finance_v2_document(jsonb_build_object(
      '2026-02-01', jsonb_build_object(
        'total_revenue', 10.00,
        'cash_reserve', 0,
        'total_jobs', null,
        'direct_residential_revenue', 4.00,
        'commercial_direct_revenue', 3.00,
        'portal_revenue', 3.00
      ),
      '2026-03-01', jsonb_build_object('total_revenue', 0)
    ))
  where id = v_rich
  returning (inputs -> 'monthly_basis' -> '2026-02-01' -> 'total_jobs'),
    (inputs -> 'monthly_basis' -> '2026-02-01' ->> 'cash_reserve')::numeric,
    (inputs -> 'monthly_basis' -> '2026-02-01' ->> 'total_revenue')::numeric
  into v_jobs, v_cash, v_total;
  if jsonb_typeof(v_jobs) <> 'null' or v_cash <> 0 or v_total <> 10 then
    raise exception 'FAIL: null and zero basis';
  end if;
  select (inputs -> 'monthly_basis' -> '2026-02-01') ? 'dryer_vent_jobs' into v_omitted
  from public.finance_plans
  where id = v_rich;
  if v_omitted then
    raise exception 'FAIL: omitted metric stored';
  end if;
  select (inputs -> 'monthly_basis' -> '2026-03-01' ->> 'total_revenue')::numeric into v_total
  from public.finance_plans
  where id = v_rich;
  if v_total <> 0 then
    raise exception 'FAIL: explicit planned zero';
  end if;

  select version into v_version from public.finance_plans where id = v_rich;
  select id into v_rich from public.finance_approve_plan(v_rich, v_version);
  select schema_version, status,
    (inputs -> 'monthly_basis' -> '2026-02-01' ->> 'total_revenue')::numeric
  into v_schema, v_status, v_total
  from public.finance_plans
  where id = v_rich;
  if v_schema <> 2 or v_status <> 'approved' or v_total <> 10 then
    raise exception 'FAIL: approved v2 basis';
  end if;

  perform set_config('finance.plan_transition', '', true);
  begin
    update public.finance_plans
    set inputs = '{"kept":true,"monthly_basis":{}}'::jsonb
    where id = v_rich;
    raise exception 'FAIL: approved v2 rewrite';
  exception
    when check_violation then
      if sqlerrm <> 'finance_plan_locked' then
        raise exception 'FAIL: approved lock message %', sqlerrm;
      end if;
  end;

  begin
    perform set_config('finance.plan_transition', 'schema_upgrade', true);
    update public.finance_plans set schema_version = 1 where id = v_rich;
    raise exception 'FAIL: session upgrade of approved row';
  exception
    when check_violation then
      null;
  end;

  select id,
    schema_version,
    (inputs -> 'monthly_basis' -> '2026-02-01' ->> 'cash_reserve')::numeric,
    (inputs -> 'monthly_basis' -> '2026-02-01' ->> 'total_revenue')::numeric
  into v_copy, v_schema, v_cash, v_total
  from public.finance_open_draft(v_rich);
  if v_copy is null or v_copy = v_rich or v_schema <> 2 or v_cash <> 0 or v_total <> 10 then
    raise exception 'FAIL: approved v2 did not copy monthly_basis';
  end if;
  select id into v_again from public.finance_open_draft(v_rich);
  if v_again is distinct from v_copy then
    raise exception 'FAIL: second open_draft created another row';
  end if;

  select version into v_version from public.finance_plans where id = v_copy;
  perform public.finance_approve_plan(v_copy, v_version);

  begin
    insert into public.finance_plans (tenant_id, schema_version, inputs)
    values ('tvg', 2, '{"monthly_basis":{"2026-13-01":{}}}'::jsonb);
    raise exception 'FAIL: raw bad month insert';
  exception
    when check_violation then
      null;
  end;
  begin
    insert into public.finance_plans (tenant_id, schema_version, inputs)
    values ('tvg', 2, '{"monthly_basis":{"2026-05-01":{"total_revenue":-2}}}'::jsonb);
    raise exception 'FAIL: raw negative insert';
  exception
    when check_violation then
      null;
  end;
  begin
    insert into public.finance_plans (tenant_id, schema_version, inputs)
    values ('tvg', 2, '{"monthly_basis":[]}'::jsonb);
    raise exception 'FAIL: raw basis shape';
  exception
    when check_violation then
      null;
  end;
  begin
    insert into public.finance_plans (tenant_id, schema_version, inputs)
    values ('tvg', 2, '{"monthly_basis":{"2026-05-01":{"field_payroll":"1"}}}'::jsonb);
    raise exception 'FAIL: raw non-numeric basis';
  exception
    when check_violation then
      null;
  end;
  begin
    insert into public.finance_plans (tenant_id, schema_version, inputs)
    values ('tvg', 3, '{"monthly_basis":{}}'::jsonb);
    raise exception 'FAIL: schema 3 insert';
  exception
    when check_violation then
      null;
  end;

  begin
    insert into public.finance_monthly_actuals (tenant_id, month, schema_version)
    values ('tvg', date '2026-04-01', 2);
    raise exception 'FAIL: actual schema 2';
  exception
    when check_violation then
      null;
  end;

  insert into public.finance_plans (tenant_id, schema_version, inputs, notes)
  values ('tvg', 1, pg_temp.finance_v1_document(), 'living-v1')
  returning id into v_living;
  select id, schema_version, notes, inputs -> 'monthly_basis'
  into v_again, v_schema, v_notes, v_basis
  from public.finance_open_draft(v_copy);
  if v_again is distinct from v_living or v_schema <> 2 or v_notes <> 'living-v1' or v_basis <> '{}'::jsonb then
    raise exception 'FAIL: living v1 draft was not upgraded in place';
  end if;
  select count(*) into v_drafts from public.finance_plans where status = 'draft';
  if v_drafts <> 1 then
    raise exception 'FAIL: living draft upgrade created a second draft';
  end if;
  select schema_version, status,
    (inputs -> 'monthly_basis' -> '2026-02-01' ->> 'total_revenue')::numeric
  into v_schema, v_status, v_total
  from public.finance_plans
  where id = v_copy;
  if v_schema <> 2 or v_status <> 'approved' or v_total <> 10 then
    raise exception 'FAIL: approved v2 changed while a draft was upgraded';
  end if;

  select schema_version, status into v_schema, v_status from public.finance_plans where id = v_hist;
  if v_schema <> 1 or v_status <> 'superseded' then
    raise exception 'FAIL: historical v1 did not stay version 1';
  end if;
  select comparison_plan_id into v_plan_id from public.finance_monthly_actuals where id = v_actual;
  if v_plan_id is distinct from v_hist then
    raise exception 'FAIL: newer plan rewrote comparison_plan_id';
  end if;

  begin
    perform public.finance_upgrade_draft_schema(v_hist, 1);
    raise exception 'FAIL: superseded v1 upgrade';
  exception
    when sqlstate 'PT409' then
      null;
  end;
  begin
    perform public.finance_upgrade_draft_schema(v_rich, 1);
    raise exception 'FAIL: approved upgrade';
  exception
    when sqlstate 'PT409' then
      null;
  end;

  perform pg_temp.finance_clear();
  raise notice 'PASS: monthly basis transitions';
end $$;

do $$
declare
  v_owner uuid := 'cccccccc-cccc-4ccc-8ccc-ccccccccccc3';
  v_manager uuid := 'cccccccc-cccc-4ccc-8ccc-ccccccccccc4';
  v_viewer uuid := 'cccccccc-cccc-4ccc-8ccc-ccccccccccc5';
  v_other uuid := 'cccccccc-cccc-4ccc-8ccc-ccccccccccc6';
  v_role text;
  v_count integer;
begin
  perform pg_temp.finance_become_role('anon');
  begin
    perform public.finance_upgrade_draft_schema('dddddddd-dddd-4ddd-8ddd-ddddddddddd1', 1);
    raise exception 'FAIL: anon upgrade';
  exception
    when insufficient_privilege then
      null;
  end;
  begin
    perform 1 from public.finance_plans;
    raise exception 'FAIL: anon select';
  exception
    when insufficient_privilege then
      null;
  end;
  perform pg_temp.finance_clear();

  foreach v_role in array array['owner', 'manager', 'viewer'] loop
    perform pg_temp.finance_become(
      case v_role when 'owner' then v_owner when 'manager' then v_manager else v_viewer end,
      'tvg',
      to_jsonb(v_role)
    );
    select count(*) into v_count from public.finance_plans;
    if v_count <> 0 then
      raise exception 'FAIL: role % can see plans', v_role;
    end if;
    begin
      perform public.finance_upgrade_draft_schema('dddddddd-dddd-4ddd-8ddd-ddddddddddd1', 1);
      raise exception 'FAIL: role % upgrade', v_role;
    exception
      when insufficient_privilege then
        null;
    end;
    begin
      insert into public.finance_plans (tenant_id, schema_version, inputs)
      values ('tvg', 2, '{"monthly_basis":{}}'::jsonb);
      raise exception 'FAIL: role % insert', v_role;
    exception
      when insufficient_privilege then
        null;
    end;
    perform pg_temp.finance_clear();
  end loop;

  perform pg_temp.finance_become(v_other, 'other', '"admin"'::jsonb);
  select count(*) into v_count from public.finance_plans;
  if v_count <> 0 then
    raise exception 'FAIL: other tenant select';
  end if;
  begin
    perform public.finance_upgrade_draft_schema('dddddddd-dddd-4ddd-8ddd-ddddddddddd1', 1);
    raise exception 'FAIL: other tenant upgrade';
  exception
    when insufficient_privilege then
      null;
  end;
  begin
    insert into public.finance_plans (tenant_id, schema_version, inputs)
    values ('tvg', 2, '{"monthly_basis":{}}'::jsonb);
    raise exception 'FAIL: other tenant insert';
  exception
    when insufficient_privilege then
      null;
  end;
  perform pg_temp.finance_clear();
  raise notice 'PASS: monthly basis denials';
end $$;

rollback;

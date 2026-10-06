-- Plan-independent monthly actuals. Local disposable stack. Rolls back.
-- Usage: psql "$LOCAL_DB_URL" -v ON_ERROR_STOP=1 -f supabase/tests/finance/04_actuals_identity.sql

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

do $$
declare
  v_admin uuid := 'cccccccc-cccc-4ccc-8ccc-ccccccccccc1';
  v_plan uuid;
  v_next uuid;
  v_draft uuid;
  v_actual uuid;
  v_count integer;
  v_version integer;
  v_basis uuid;
  v_updated_by uuid;
  v_revenue numeric;
  v_zero numeric;
  v_cents numeric;
  v_channel numeric;
  v_source text;
  v_note text;
  v_month date;
begin
  if (select count(*) from public.finance_monthly_actuals) <> 0
    or (select count(*) from public.finance_plans) <> 0 then
    raise exception 'FAIL: finance seed rows';
  end if;

  perform pg_temp.finance_become(v_admin, 'tvg', '"admin"'::jsonb);

  insert into public.finance_monthly_actuals (tenant_id, month, schema_version, total_revenue, cash_reserve)
  values ('tvg', date '2026-01-01', 1, null, 0)
  returning id, comparison_plan_id, total_revenue, cash_reserve, source
  into v_actual, v_basis, v_revenue, v_zero, v_source;
  if v_basis is not null or v_revenue is not null or v_zero is distinct from 0 or v_source <> 'manual_entry' then
    raise exception 'FAIL: actual without a plan';
  end if;

  begin
    insert into public.finance_monthly_actuals (tenant_id, month, schema_version)
    values ('tvg', date '2026-01-01', 1);
    raise exception 'FAIL: second actual for the month';
  exception
    when unique_violation then
      null;
  end;

  insert into public.finance_plans (tenant_id, schema_version, inputs)
  values ('tvg', 1, pg_temp.finance_v1_document())
  returning id into v_draft;

  begin
    insert into public.finance_monthly_actuals (tenant_id, comparison_plan_id, month, schema_version)
    values ('tvg', v_draft, date '2026-02-01', 1);
    raise exception 'FAIL: draft comparison plan';
  exception
    when check_violation then
      null;
  end;

  begin
    insert into public.finance_monthly_actuals (tenant_id, comparison_plan_id, month, schema_version)
    values ('tvg', 'dddddddd-dddd-4ddd-8ddd-ddddddddddd1', date '2026-02-01', 1);
    raise exception 'FAIL: cross-tenant comparison plan';
  exception
    when foreign_key_violation or check_violation then
      null;
  end;

  begin
    insert into public.finance_monthly_actuals (tenant_id, month, schema_version)
    values ('other', date '2026-02-01', 1);
    raise exception 'FAIL: other tenant actual';
  exception
    when check_violation then
      null;
  end;

  select id into v_plan from public.finance_approve_plan(v_draft, 1);

  update public.finance_monthly_actuals
  set comparison_plan_id = v_plan
  where id = v_actual
  returning comparison_plan_id into v_basis;
  if v_basis is distinct from v_plan then
    raise exception 'FAIL: association to approved plan';
  end if;

  insert into public.finance_plans (tenant_id, schema_version, inputs)
  values ('tvg', 1, pg_temp.finance_v1_document())
  returning id into v_next;
  select id into v_next from public.finance_approve_plan(v_next, 1);

  select comparison_plan_id into v_basis from public.finance_monthly_actuals where id = v_actual;
  if v_basis is distinct from v_plan then
    raise exception 'FAIL: supersession detached the basis';
  end if;

  begin
    insert into public.finance_monthly_actuals (tenant_id, comparison_plan_id, month, schema_version)
    values ('tvg', v_next, date '2026-01-01', 1);
    raise exception 'FAIL: second actual across plan versions';
  exception
    when unique_violation then
      null;
  end;

  begin
    insert into public.finance_monthly_actuals (tenant_id, comparison_plan_id, month, schema_version)
    values ('tvg', v_plan, date '2026-03-01', 1);
    raise exception 'FAIL: superseded plan associated';
  exception
    when check_violation then
      null;
  end;

  update public.finance_monthly_actuals
  set total_revenue = 1.01,
      version = 50,
      updated_by_user_id = '00000000-0000-4000-8000-000000000099',
      updated_at = timestamptz '2000-01-01'
  where id = v_actual and version = 2
  returning version, updated_by_user_id, total_revenue, comparison_plan_id
  into v_version, v_updated_by, v_cents, v_basis;
  if v_version <> 3
    or v_updated_by is distinct from v_admin
    or v_cents is distinct from 1.01
    or v_basis is distinct from v_plan then
    raise exception 'FAIL: correction after supersession';
  end if;

  update public.finance_monthly_actuals
  set total_revenue = 9
  where id = v_actual and version = 1;
  get diagnostics v_count = row_count;
  select total_revenue, version into v_revenue, v_version
  from public.finance_monthly_actuals where id = v_actual;
  if v_count <> 0 or v_revenue is distinct from 1.01 or v_version <> 3 then
    raise exception 'FAIL: stale actual update';
  end if;

  begin
    update public.finance_monthly_actuals
    set comparison_plan_id = v_next, month = date '2026-04-01', tenant_id = 'tvg'
    where id = v_actual and version = 3;
    raise exception 'FAIL: basis or month rebound';
  exception
    when check_violation then
      null;
  end;
  select comparison_plan_id, month, total_revenue
  into v_basis, v_month, v_revenue
  from public.finance_monthly_actuals where id = v_actual;
  if v_basis is distinct from v_plan or v_month <> date '2026-01-01' or v_revenue is distinct from 1.01 then
    raise exception 'FAIL: identity change persisted';
  end if;

  begin
    delete from public.finance_monthly_actuals where id = v_actual;
    raise exception 'FAIL: actual delete';
  exception
    when insufficient_privilege then
      null;
  end;

  insert into public.finance_monthly_actuals (
    tenant_id, month, schema_version,
    total_revenue, direct_residential_revenue, commercial_direct_revenue, portal_revenue
  )
  values ('tvg', date '2026-05-01', 1, 3.10, 1.00, 1.05, 1.05);

  begin
    insert into public.finance_monthly_actuals (
      tenant_id, month, schema_version,
      total_revenue, direct_residential_revenue, commercial_direct_revenue, portal_revenue
    )
    values ('tvg', date '2026-06-01', 1, 3.00, 1.00, 1.00, 1.01);
    raise exception 'FAIL: channel mismatch';
  exception
    when check_violation then
      null;
  end;

  insert into public.finance_monthly_actuals (
    tenant_id, month, schema_version,
    total_revenue, direct_residential_revenue, commercial_direct_revenue, portal_revenue
  )
  values ('tvg', date '2026-07-01', 1, 4.00, 4.00, null, null)
  returning portal_revenue, direct_residential_revenue into v_channel, v_revenue;
  if v_channel is not null or v_revenue is distinct from 4.00 then
    raise exception 'FAIL: partial channel coerced';
  end if;

  begin
    insert into public.finance_monthly_actuals (tenant_id, month, schema_version, source)
    values ('tvg', date '2026-08-01', 1, 'import');
    raise exception 'FAIL: provenance source';
  exception
    when check_violation then
      null;
  end;

  insert into public.finance_monthly_actuals (tenant_id, month, schema_version, source_note)
  values ('tvg', date '2026-09-01', 1, 'synthetic-source-note')
  returning source, source_note into v_source, v_note;
  if v_source <> 'manual_entry' or v_note <> 'synthetic-source-note' then
    raise exception 'FAIL: source note';
  end if;

  if exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'finance_monthly_actuals'
      and cmd = 'DELETE'
  ) or has_table_privilege('authenticated', 'public.finance_monthly_actuals', 'DELETE')
    or has_table_privilege('anon', 'public.finance_monthly_actuals', 'DELETE') then
    raise exception 'FAIL: delete policy or grant';
  end if;

  raise notice 'PASS: plan-independent actuals';
end $$;

rollback;

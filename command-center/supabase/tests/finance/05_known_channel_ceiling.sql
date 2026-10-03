-- Known channel revenue cannot exceed Total Revenue. Rolls back.
-- Usage: psql "$LOCAL_DB_URL" -v ON_ERROR_STOP=1 -f supabase/tests/finance/05_known_channel_ceiling.sql

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

do $$
declare
  v_admin uuid := 'cccccccc-cccc-4ccc-8ccc-ccccccccccc5';
  v_direct numeric;
  v_portal numeric;
  v_total numeric;
  v_cash numeric;
begin
  if (select count(*) from public.finance_monthly_actuals) <> 0 then
    raise exception 'FAIL: finance seed rows';
  end if;

  perform pg_temp.finance_become(v_admin, 'tvg', '"admin"'::jsonb);

  begin
    insert into public.finance_monthly_actuals (
      tenant_id, month, schema_version,
      total_revenue, direct_residential_revenue
    )
    values ('tvg', date '2026-01-01', 1, 4.00, 5.00);
    raise exception 'FAIL: known channel exceeds total';
  exception
    when check_violation then
      null;
  end;

  begin
    insert into public.finance_monthly_actuals (
      tenant_id, month, schema_version,
      total_revenue, direct_residential_revenue, commercial_direct_revenue
    )
    values ('tvg', date '2026-02-01', 1, 4.00, 3.00, 2.00);
    raise exception 'FAIL: two known channels exceed total';
  exception
    when check_violation then
      null;
  end;

  insert into public.finance_monthly_actuals (
    tenant_id, month, schema_version,
    total_revenue, direct_residential_revenue, commercial_direct_revenue, portal_revenue
  )
  values ('tvg', date '2026-03-01', 1, 4.00, 1.00, null, null)
  returning direct_residential_revenue, commercial_direct_revenue, portal_revenue, total_revenue
  into v_direct, v_portal, v_cash, v_total;
  if v_direct is distinct from 1.00 or v_portal is not null or v_cash is not null or v_total is distinct from 4.00 then
    raise exception 'FAIL: partial null coerced';
  end if;

  insert into public.finance_monthly_actuals (
    tenant_id, month, schema_version,
    total_revenue, direct_residential_revenue, commercial_direct_revenue, portal_revenue, cash_reserve
  )
  values ('tvg', date '2026-04-01', 1, 3.10, 1.00, 1.05, 1.05, 0)
  returning direct_residential_revenue, portal_revenue, cash_reserve
  into v_direct, v_portal, v_cash;
  if v_direct is distinct from 1.00 or v_portal is distinct from 1.05 or v_cash is distinct from 0 then
    raise exception 'FAIL: exact channels or zero';
  end if;

  begin
    insert into public.finance_monthly_actuals (
      tenant_id, month, schema_version,
      total_revenue, direct_residential_revenue, commercial_direct_revenue, portal_revenue
    )
    values ('tvg', date '2026-05-01', 1, null, 1.00, 1.00, 1.00);
    raise exception 'FAIL: all channels without total';
  exception
    when check_violation then
      null;
  end;

  insert into public.finance_monthly_actuals (
    tenant_id, month, schema_version,
    total_revenue, direct_residential_revenue, cash_reserve
  )
  values ('tvg', date '2026-06-01', 1, null, 0, 0)
  returning direct_residential_revenue, total_revenue, cash_reserve
  into v_direct, v_total, v_cash;
  if v_direct is distinct from 0 or v_total is not null or v_cash is distinct from 0 then
    raise exception 'FAIL: null total or stored zero';
  end if;

  if (select count(*) from public.finance_monthly_actuals) <> 3 then
    raise exception 'FAIL: rejected rows were stored';
  end if;

  raise notice 'PASS: known channel ceiling';
end $$;

rollback;

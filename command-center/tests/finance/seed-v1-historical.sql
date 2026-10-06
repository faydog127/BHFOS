-- Local proof only. One superseded schema version 1 plan and one actual that
-- names it. Not a migration. Not for a remote database.
-- Authorized path: authenticated TVG admin, triggers left enabled, no replica
-- role. The version 1 draft includes retention hurdles of 0 so approve accepts
-- it. A second version 2 draft is approved so the version 1 row is superseded.
-- An existing draft or approved plan stops this seed. It will not bypass triggers.

begin;

select set_config('request.jwt.claim.sub', 'cccccccc-cccc-4ccc-8ccc-ccccccccccc1', true);
select set_config(
  'request.jwt.claims',
  json_build_object(
    'sub', 'cccccccc-cccc-4ccc-8ccc-ccccccccccc1',
    'role', 'authenticated',
    'app_metadata', json_build_object('tenant_id', 'tvg', 'role', 'admin')
  )::text,
  true
);
set local role authenticated;

do $$
declare
  v_historical uuid := 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1';
  v_holder uuid := 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2';
  v_inputs jsonb;
  v_version integer;
begin
  if exists (select 1 from public.finance_plans where id = v_historical) then
    return;
  end if;
  if exists (select 1 from public.finance_plans where status = 'draft') then
    raise exception 'historical_v1_seed_blocked existing draft; refusing to bypass triggers';
  end if;
  if exists (select 1 from public.finance_plans where status = 'approved') then
    raise exception 'historical_v1_seed_blocked existing approved plan would be superseded; refusing';
  end if;

  v_inputs := jsonb_build_object(
    'structural', jsonb_build_object(
      'weeks_per_year', null,
      'months_per_year', null,
      'days_per_month_ar', null,
      'rounding_increment_usd', null
    ),
    'stages', jsonb_build_object(
      'stage_0', jsonb_build_object('label', 'Stage 0', 'true_operating_profit_pct', 0, 'growth_reserve_pct', 0, 'bad_debt_warranty_pct', 0, 'unidentified_cost_contingency_pct', 0),
      'stage_1', jsonb_build_object('label', 'Stage 1', 'true_operating_profit_pct', 0, 'growth_reserve_pct', 0, 'bad_debt_warranty_pct', 0, 'unidentified_cost_contingency_pct', 0),
      'stage_2', jsonb_build_object('label', 'Stage 2', 'true_operating_profit_pct', 0, 'growth_reserve_pct', 0, 'bad_debt_warranty_pct', 0, 'unidentified_cost_contingency_pct', 0),
      'stage_3', jsonb_build_object('label', 'Stage 3', 'true_operating_profit_pct', 0, 'growth_reserve_pct', 0, 'bad_debt_warranty_pct', 0, 'unidentified_cost_contingency_pct', 0)
    ),
    'staffing', '[]'::jsonb,
    'owner_field_replacement', jsonb_build_object('wage', null, 'burden', null),
    'cost_pools', '{}'::jsonb,
    'channels', '[]'::jsonb,
    'services', '{}'::jsonb
  );

  insert into public.finance_plans (id, tenant_id, schema_version, inputs, notes)
  values (v_historical, 'tvg', 1, v_inputs, 'historical-v1-browser');
  perform public.finance_approve_plan(v_historical, 1);

  insert into public.finance_monthly_actuals (
    id, tenant_id, comparison_plan_id, month, schema_version, source, total_revenue
  )
  values (
    'dddddddd-dddd-4ddd-8ddd-ddddddddddd1',
    'tvg',
    v_historical,
    date '2025-11-01',
    1,
    'manual_entry',
    8.00
  );

  insert into public.finance_plans (id, tenant_id, schema_version, inputs, notes)
  values (
    v_holder,
    'tvg',
    2,
    v_inputs || jsonb_build_object('monthly_basis', '{}'::jsonb),
    'historical-v1-holder'
  );
  select version into v_version from public.finance_plans where id = v_holder;
  perform public.finance_approve_plan(v_holder, v_version);

  if (select status from public.finance_plans where id = v_historical) is distinct from 'superseded' then
    raise exception 'historical_v1_seed_failed version 1 row was not superseded';
  end if;
  if (select schema_version from public.finance_plans where id = v_historical) is distinct from 1 then
    raise exception 'historical_v1_seed_failed schema';
  end if;
end;
$$;

reset role;

commit;

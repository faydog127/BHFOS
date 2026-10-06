-- Gate S corrective behavioral proofs. Local disposable database only.
-- D1, D5, D6, and the invalid approve run as an authenticated tenant admin.
-- Triggers stay enabled. No replica role. Rolls back.
-- Usage: psql "$LOCAL_DB_URL" -v ON_ERROR_STOP=1 -f supabase/tests/finance/07_gate_s_corrective.sql

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
  v_admin uuid := 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa7';
  v_plan uuid;
  v_status text;
  v_version integer;
  v_notes text;
  v_actual uuid;
  v_basis uuid;
  v_actual_version integer;
  v_direct numeric;
  v_commercial numeric;
  v_portal numeric;
  v_total numeric;
  v_bad jsonb;
  v_pools jsonb;
  v_hist uuid;
  v_hist_version integer;
  v_hist_schema integer;
begin
  perform pg_temp.finance_become(v_admin, 'tvg', '"admin"'::jsonb);

  -- D1: schema 2 without monthly_basis is rejected. No row is stored.
  begin
    insert into public.finance_plans (tenant_id, schema_version, inputs)
    values ('tvg', 2, pg_temp.finance_v2_document('{}'::jsonb) - 'monthly_basis');
    raise exception 'FAIL: D1 v2 without monthly_basis accepted';
  exception
    when check_violation then
      if sqlerrm not like '%finance_plans_monthly_basis%' then
        raise exception 'FAIL: D1 message %', sqlerrm;
      end if;
  end;
  if (select count(*) from public.finance_plans) <> 0 then
    raise exception 'FAIL: D1 stored a row';
  end if;

  -- Direct approve of a stored plan whose retention hurdle is missing or invalid.
  v_bad := pg_temp.finance_v2_document('{}'::jsonb) #- '{stages,stage_0,growth_reserve_pct}';
  insert into public.finance_plans (tenant_id, schema_version, inputs, notes)
  values ('tvg', 2, v_bad, 'invalid-approve')
  returning id, status, version into v_plan, v_status, v_version;
  if v_status <> 'draft' or v_version <> 1 then
    raise exception 'FAIL: invalid plan insert % %', v_status, v_version;
  end if;
  if public.finance_plan_approvable((select inputs from public.finance_plans where id = v_plan)) then
    raise exception 'FAIL: missing hurdle looks approvable';
  end if;
  begin
    perform public.finance_approve_plan(v_plan, v_version);
    raise exception 'FAIL: missing hurdle approve accepted';
  exception
    when check_violation then
      if sqlerrm not like '%finance_plan_not_approvable%' then
        raise exception 'FAIL: missing hurdle approve message %', sqlerrm;
      end if;
  end;
  select status, version, notes into v_status, v_version, v_notes
  from public.finance_plans where id = v_plan;
  if v_status <> 'draft' or v_version <> 1 or v_notes <> 'invalid-approve' then
    raise exception 'FAIL: missing hurdle approve changed % % %', v_status, v_version, v_notes;
  end if;

  update public.finance_plans
  set inputs = jsonb_set(pg_temp.finance_v2_document('{}'::jsonb), '{stages,stage_0,growth_reserve_pct}', '1'::jsonb)
  where id = v_plan
  returning version into v_version;
  begin
    perform public.finance_approve_plan(v_plan, v_version);
    raise exception 'FAIL: hurdle of 1 approve accepted';
  exception
    when check_violation then
      if sqlerrm not like '%finance_plan_not_approvable%' then
        raise exception 'FAIL: hurdle of 1 message %', sqlerrm;
      end if;
  end;
  select status, version into v_status, v_version from public.finance_plans where id = v_plan;
  if v_status <> 'draft' or v_version <> 2 then
    raise exception 'FAIL: hurdle of 1 changed status % version %', v_status, v_version;
  end if;
  perform set_config('finance.plan_transition', 'approve', true);
  begin
    update public.finance_plans set status = 'approved' where id = v_plan;
    raise exception 'FAIL: GUC approve of hurdle 1 accepted';
  exception
    when check_violation then
      if sqlerrm not like '%finance_plan_not_approvable%' then
        raise exception 'FAIL: GUC approve message %', sqlerrm;
      end if;
  end;
  perform set_config('finance.plan_transition', '', true);
  select status, version into v_status, v_version from public.finance_plans where id = v_plan;
  if v_status <> 'draft' or v_version <> 2 then
    raise exception 'FAIL: GUC approve changed status % version %', v_status, v_version;
  end if;

  -- 0.7+0.2+0.1+0.0001 normalizes to 1.0001 and is over 1.
  v_bad := pg_temp.finance_v2_document('{}'::jsonb);
  v_bad := jsonb_set(v_bad, '{stages,stage_0,true_operating_profit_pct}', '0.7'::jsonb);
  v_bad := jsonb_set(v_bad, '{stages,stage_0,growth_reserve_pct}', '0.2'::jsonb);
  v_bad := jsonb_set(v_bad, '{stages,stage_0,bad_debt_warranty_pct}', '0.1'::jsonb);
  v_bad := jsonb_set(v_bad, '{stages,stage_0,unidentified_cost_contingency_pct}', '0.0001'::jsonb);
  if public.finance_plan_approvable(v_bad) then
    raise exception 'FAIL: hurdle total 1.0001 looks approvable';
  end if;
  update public.finance_plans set inputs = v_bad where id = v_plan returning version into v_version;
  begin
    perform public.finance_approve_plan(v_plan, v_version);
    raise exception 'FAIL: hurdle total 1.0001 approve accepted';
  exception
    when check_violation then
      if sqlerrm not like '%finance_plan_not_approvable%' then
        raise exception 'FAIL: hurdle total 1.0001 message %', sqlerrm;
      end if;
  end;
  select status, version into v_status, v_version from public.finance_plans where id = v_plan;
  if v_status <> 'draft' or v_version <> 3 then
    raise exception 'FAIL: hurdle total 1.0001 changed status % version %', v_status, v_version;
  end if;

  v_bad := jsonb_set(pg_temp.finance_v2_document('{}'::jsonb), '{stages,stage_1,owner_management_comp}', '-1'::jsonb);
  if public.finance_plan_approvable(v_bad) then
    raise exception 'FAIL: negative owner comp looks approvable';
  end if;
  update public.finance_plans set inputs = v_bad where id = v_plan returning version into v_version;
  begin
    perform public.finance_approve_plan(v_plan, v_version);
    raise exception 'FAIL: negative owner comp approve accepted';
  exception
    when check_violation then
      if sqlerrm not like '%finance_plan_not_approvable%' then
        raise exception 'FAIL: negative owner comp message %', sqlerrm;
      end if;
  end;
  select status, version into v_status, v_version from public.finance_plans where id = v_plan;
  if v_status <> 'draft' or v_version <> 4 then
    raise exception 'FAIL: negative owner comp changed % %', v_status, v_version;
  end if;

  v_bad := pg_temp.finance_v2_document('{}'::jsonb);
  v_bad := jsonb_set(v_bad, '{stages,stage_0,owner_management_comp}', '0'::jsonb);
  v_bad := jsonb_set(v_bad, '{stages,stage_0,owner_shadow_hours}', '0'::jsonb);
  v_bad := jsonb_set(v_bad, '{owner_field_replacement,wage}', '0'::jsonb);
  v_bad := jsonb_set(v_bad, '{owner_field_replacement,burden}', '0'::jsonb);
  -- jsonb_set does not create missing parent keys, so the pools are built whole.
  select jsonb_object_agg(grp, grp_obj) into v_pools
  from (
    select grp, jsonb_object_agg(line, jsonb_build_object(
      'stage_0', case when grp = 'direct_production' and line = 'fuel' then -10 else 0 end
    )) as grp_obj
    from (values
      ('direct_production', 'fuel'),
      ('direct_production', 'consumables'),
      ('direct_production', 'job_rentals'),
      ('indirect_field', 'vehicle_payments'),
      ('indirect_field', 'maintenance'),
      ('indirect_field', 'equipment_financing'),
      ('indirect_field', 'tooling_ppe'),
      ('indirect_field', 'replacement_sinking_fund'),
      ('ga', 'office_shop'),
      ('ga', 'utilities'),
      ('ga', 'software'),
      ('ga', 'accounting_legal'),
      ('ga', 'office_misc'),
      ('sales', 'marketing'),
      ('sales', 'memberships'),
      ('sales', 'collateral'),
      ('insurance', 'gl_package'),
      ('insurance', 'commercial_auto'),
      ('insurance', 'umbrella'),
      ('insurance', 'workers_comp_fixed'),
      ('insurance', 'licensing')
    ) as pool_lines(grp, line)
    group by grp
  ) as pool_groups;
  v_bad := jsonb_set(v_bad, '{cost_pools}', v_pools);
  if public.finance_plan_approvable(v_bad) then
    raise exception 'FAIL: negative economic cost looks approvable';
  end if;
  update public.finance_plans set inputs = v_bad where id = v_plan returning version into v_version;
  begin
    perform public.finance_approve_plan(v_plan, v_version);
    raise exception 'FAIL: negative economic cost approve accepted';
  exception
    when check_violation then
      if sqlerrm not like '%finance_plan_not_approvable%' then
        raise exception 'FAIL: negative economic cost message %', sqlerrm;
      end if;
  end;
  select status, version into v_status, v_version from public.finance_plans where id = v_plan;
  if v_status <> 'draft' or v_version <> 5 then
    raise exception 'FAIL: negative economic cost changed % %', v_status, v_version;
  end if;

  if not public.finance_plan_approvable(pg_temp.finance_v2_document('{}'::jsonb)) then
    raise exception 'FAIL: zero hurdles are not approvable';
  end if;

  -- Below the boundary. 0.7+0.2+0.0999+0 normalizes to 0.9999.
  v_bad := pg_temp.finance_v2_document('{}'::jsonb);
  v_bad := jsonb_set(v_bad, '{stages,stage_0,true_operating_profit_pct}', '0.7'::jsonb);
  v_bad := jsonb_set(v_bad, '{stages,stage_0,growth_reserve_pct}', '0.2'::jsonb);
  v_bad := jsonb_set(v_bad, '{stages,stage_0,bad_debt_warranty_pct}', '0.0999'::jsonb);
  v_bad := jsonb_set(v_bad, '{stages,stage_0,unidentified_cost_contingency_pct}', '0'::jsonb);
  if not public.finance_plan_approvable(v_bad) then
    raise exception 'FAIL: hurdle total 0.9999 is not approvable';
  end if;

  -- Exactly 1.0. 0.7+0.2+0.1+0. Empty pools leave required revenue blank.
  -- That blank does not exempt the stage.
  v_bad := pg_temp.finance_v2_document('{}'::jsonb);
  v_bad := jsonb_set(v_bad, '{stages,stage_0,true_operating_profit_pct}', '0.7'::jsonb);
  v_bad := jsonb_set(v_bad, '{stages,stage_0,growth_reserve_pct}', '0.2'::jsonb);
  v_bad := jsonb_set(v_bad, '{stages,stage_0,bad_debt_warranty_pct}', '0.1'::jsonb);
  v_bad := jsonb_set(v_bad, '{stages,stage_0,unidentified_cost_contingency_pct}', '0'::jsonb);
  if public.finance_plan_approvable(v_bad) then
    raise exception 'FAIL: 0.7+0.2+0.1+0 looks approvable';
  end if;
  update public.finance_plans set inputs = v_bad where id = v_plan returning version into v_version;
  begin
    perform public.finance_approve_plan(v_plan, v_version);
    raise exception 'FAIL: 0.7+0.2+0.1+0 approve accepted';
  exception
    when check_violation then
      if sqlerrm not like '%finance_plan_not_approvable%' then
        raise exception 'FAIL: 0.7+0.2+0.1+0 message %', sqlerrm;
      end if;
  end;
  select status, version into v_status, v_version from public.finance_plans where id = v_plan;
  if v_status <> 'draft' or v_version <> 6 then
    raise exception 'FAIL: 0.7+0.2+0.1+0 changed % %', v_status, v_version;
  end if;

  v_bad := pg_temp.finance_v2_document('{}'::jsonb);
  v_bad := jsonb_set(v_bad, '{stages,stage_0,true_operating_profit_pct}', '0.25'::jsonb);
  v_bad := jsonb_set(v_bad, '{stages,stage_0,growth_reserve_pct}', '0.25'::jsonb);
  v_bad := jsonb_set(v_bad, '{stages,stage_0,bad_debt_warranty_pct}', '0.25'::jsonb);
  v_bad := jsonb_set(v_bad, '{stages,stage_0,unidentified_cost_contingency_pct}', '0.25'::jsonb);
  if public.finance_plan_approvable(v_bad) then
    raise exception 'FAIL: four quarters look approvable';
  end if;

  -- Known zero cost with a total of 1. Required revenue stays blank and approval is refused.
  v_bad := pg_temp.finance_v2_document('{}'::jsonb);
  v_bad := jsonb_set(v_bad, '{stages,stage_0,true_operating_profit_pct}', '0.7'::jsonb);
  v_bad := jsonb_set(v_bad, '{stages,stage_0,growth_reserve_pct}', '0.2'::jsonb);
  v_bad := jsonb_set(v_bad, '{stages,stage_0,bad_debt_warranty_pct}', '0.1'::jsonb);
  v_bad := jsonb_set(v_bad, '{stages,stage_0,unidentified_cost_contingency_pct}', '0'::jsonb);
  v_bad := jsonb_set(v_bad, '{stages,stage_0,owner_management_comp}', '0'::jsonb);
  v_bad := jsonb_set(v_bad, '{stages,stage_0,owner_shadow_hours}', '0'::jsonb);
  v_bad := jsonb_set(v_bad, '{owner_field_replacement,wage}', '0'::jsonb);
  v_bad := jsonb_set(v_bad, '{owner_field_replacement,burden}', '0'::jsonb);
  select jsonb_object_agg(grp, grp_obj) into v_pools
  from (
    select grp, jsonb_object_agg(line, jsonb_build_object('stage_0', 0)) as grp_obj
    from (values
      ('direct_production', 'fuel'),
      ('direct_production', 'consumables'),
      ('direct_production', 'job_rentals'),
      ('indirect_field', 'vehicle_payments'),
      ('indirect_field', 'maintenance'),
      ('indirect_field', 'equipment_financing'),
      ('indirect_field', 'tooling_ppe'),
      ('indirect_field', 'replacement_sinking_fund'),
      ('ga', 'office_shop'),
      ('ga', 'utilities'),
      ('ga', 'software'),
      ('ga', 'accounting_legal'),
      ('ga', 'office_misc'),
      ('sales', 'marketing'),
      ('sales', 'memberships'),
      ('sales', 'collateral'),
      ('insurance', 'gl_package'),
      ('insurance', 'commercial_auto'),
      ('insurance', 'umbrella'),
      ('insurance', 'workers_comp_fixed'),
      ('insurance', 'licensing')
    ) as pool_lines(grp, line)
    group by grp
  ) as pool_groups;
  v_bad := jsonb_set(v_bad, '{cost_pools}', v_pools);
  if public.finance_plan_approvable(v_bad) then
    raise exception 'FAIL: blank required revenue at total 1 looks approvable';
  end if;

  -- A blank hurdle on another stage is not exempt.
  v_bad := pg_temp.finance_v2_document('{}'::jsonb) #- '{stages,stage_2,growth_reserve_pct}';
  if public.finance_plan_approvable(v_bad) then
    raise exception 'FAIL: blank hurdle on stage_2 looks approvable';
  end if;

  v_bad := pg_temp.finance_v2_document('{}'::jsonb);
  v_bad := jsonb_set(v_bad, '{stages,stage_0,true_operating_profit_pct}', '0.7'::jsonb);
  v_bad := jsonb_set(v_bad, '{stages,stage_0,growth_reserve_pct}', '0.2'::jsonb);
  v_bad := jsonb_set(v_bad, '{stages,stage_0,bad_debt_warranty_pct}', '0.0999'::jsonb);
  v_bad := jsonb_set(v_bad, '{stages,stage_0,unidentified_cost_contingency_pct}', '0'::jsonb);
  update public.finance_plans set inputs = v_bad where id = v_plan returning version into v_version;
  perform public.finance_approve_plan(v_plan, v_version);
  select status into v_status from public.finance_plans where id = v_plan;
  if v_status <> 'approved' then
    raise exception 'FAIL: hurdle total 0.9999 did not approve';
  end if;

  -- D5: once comparison_plan_id is set, a later write cannot rebind it.
  insert into public.finance_monthly_actuals (
    tenant_id, month, schema_version,
    total_revenue, direct_residential_revenue, commercial_direct_revenue, portal_revenue
  )
  values ('tvg', date '2026-04-01', 1, 1000.00, 600.00, 300.00, 100.00)
  returning id into v_actual;
  update public.finance_monthly_actuals
  set comparison_plan_id = v_plan
  where id = v_actual
  returning comparison_plan_id, version into v_basis, v_actual_version;
  if v_basis is distinct from v_plan then
    raise exception 'FAIL: D5 association did not stick';
  end if;
  begin
    update public.finance_monthly_actuals
    set comparison_plan_id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb7'
    where id = v_actual;
    raise exception 'FAIL: D5 rebind accepted';
  exception
    when check_violation then
      if sqlerrm not like '%finance_actuals_basis_locked%' then
        raise exception 'FAIL: D5 message %', sqlerrm;
      end if;
  end;
  select comparison_plan_id, version into v_basis, v_version
  from public.finance_monthly_actuals where id = v_actual;
  if v_basis is distinct from v_plan or v_version is distinct from v_actual_version then
    raise exception 'FAIL: D5 row changed % %', v_basis, v_version;
  end if;

  -- D6: all three channels must equal total revenue. The prior amounts stay.
  begin
    update public.finance_monthly_actuals
    set portal_revenue = 200.00
    where id = v_actual;
    raise exception 'FAIL: D6 channel sum accepted';
  exception
    when check_violation then
      if sqlerrm not like '%finance_actuals_channel_reconcile%' then
        raise exception 'FAIL: D6 message %', sqlerrm;
      end if;
  end;
  select direct_residential_revenue, commercial_direct_revenue, portal_revenue, total_revenue
  into v_direct, v_commercial, v_portal, v_total
  from public.finance_monthly_actuals where id = v_actual;
  if v_direct is distinct from 600.00
    or v_commercial is distinct from 300.00
    or v_portal is distinct from 100.00
    or v_total is distinct from 1000.00
  then
    raise exception 'FAIL: D6 amounts changed % % % %', v_direct, v_commercial, v_portal, v_total;
  end if;

  insert into public.finance_plans (tenant_id, schema_version, inputs, notes)
  values ('tvg', 1, pg_temp.finance_v1_document(), 'historical-v1')
  returning id, version into v_hist, v_hist_version;
  if v_hist_version <> 1 then
    raise exception 'FAIL: historical v1 insert version %', v_hist_version;
  end if;
  perform public.finance_upgrade_draft_schema(v_hist, v_hist_version);
  select schema_version, version, status into v_hist_schema, v_hist_version, v_status
  from public.finance_plans where id = v_hist;
  if v_hist_schema <> 2 or v_status <> 'draft' or v_hist_version <> 2 then
    raise exception 'FAIL: v1 upgrade % % %', v_hist_schema, v_status, v_hist_version;
  end if;
  if jsonb_typeof((select inputs -> 'monthly_basis' from public.finance_plans where id = v_hist)) is distinct from 'object' then
    raise exception 'FAIL: v1 upgrade did not add monthly_basis';
  end if;
  perform public.finance_approve_plan(v_hist, v_hist_version);
  select status, schema_version into v_status, v_hist_schema from public.finance_plans where id = v_hist;
  if v_status <> 'approved' or v_hist_schema <> 2 then
    raise exception 'FAIL: upgraded v1 did not approve % %', v_status, v_hist_schema;
  end if;
  if (select status from public.finance_plans where id = v_plan) <> 'superseded' then
    raise exception 'FAIL: boundary plan was not superseded by the upgraded v1';
  end if;

  perform pg_temp.finance_clear();

  -- postgres has no JWT. Insert, actuals write, and approve RPC stay denied.
  begin
    insert into public.finance_plans (tenant_id, schema_version, inputs)
    values ('tvg', 2, pg_temp.finance_v2_document('{}'::jsonb));
    raise exception 'FAIL: postgres plan insert accepted';
  exception
    when insufficient_privilege then
      if sqlerrm not like '%finance_access_denied%' then
        raise exception 'FAIL: postgres plan insert %', sqlerrm;
      end if;
  end;
  begin
    update public.finance_monthly_actuals
    set source_note = 'postgres probe'
    where id = v_actual;
    raise exception 'FAIL: postgres actual update accepted';
  exception
    when insufficient_privilege then
      if sqlerrm not like '%finance_access_denied%' then
        raise exception 'FAIL: postgres actual update %', sqlerrm;
      end if;
  end;
  begin
    perform public.finance_approve_plan(v_plan, 1);
    raise exception 'FAIL: postgres approve accepted';
  exception
    when insufficient_privilege then
      if sqlerrm not like '%finance_access_denied%' then
        raise exception 'FAIL: postgres approve %', sqlerrm;
      end if;
  end;
  if (select source_note from public.finance_monthly_actuals where id = v_actual) is not null then
    raise exception 'FAIL: postgres actual probe wrote a note';
  end if;

  raise notice 'PASS: gate S corrective D1 D5 D6 invalid approve postgres denial';
end $$;

rollback;

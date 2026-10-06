#!/usr/bin/env bash
# Proves an approved row that fails the approvability contract aborts 20261006141000,
# and that the read-only scan sees it before that function exists.
# Disposable local database only. No replica mode. No hosted project.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
MIG="$ROOT/supabase/migrations"
TEST="$ROOT/supabase/tests/finance"
PSQL=(sudo -u postgres psql -v ON_ERROR_STOP=1)
DB="${FINANCE_APPROVE_ABORT_DB:-finance_gate_s_approve_abort}"
LOG="${APPROVE_ABORT_LOG:-/opt/cursor/artifacts/finance-gate-s-corrective/approvability-abort.log}"
mkdir -p "$(dirname "$LOG")"
: > "$LOG"

"${PSQL[@]}" -d postgres -c "select pg_terminate_backend(pid) from pg_stat_activity where datname = '$DB' and pid <> pg_backend_pid();" >/dev/null
"${PSQL[@]}" -d postgres -c "drop database if exists \"$DB\";"
"${PSQL[@]}" -d postgres -c "create database \"$DB\";"
"${PSQL[@]}" -d "$DB" -f "$TEST/local_auth_bootstrap.sql"
for file in \
  20261003053000_finance_stage_a_persistence.sql \
  20261003063000_finance_stage_a_security_fixes.sql \
  20261003113216_finance_one_draft_per_tenant.sql \
  20261003132212_finance_actuals_plan_independent.sql \
  20261003145000_finance_actuals_known_channel_ceiling.sql \
  20261003180000_finance_plan_monthly_basis.sql \
  20261003223000_finance_plan_v2_required_sections.sql \
  20261004120000_finance_version_conflict_pt409.sql \
  20261006140000_finance_v1_document_shape.sql
do
  echo "APPLY $file" | tee -a "$LOG"
  "${PSQL[@]}" -d "$DB" -f "$MIG/$file" >>"$LOG" 2>&1
done

"${PSQL[@]}" -d "$DB" -v ON_ERROR_STOP=1 <<'SQL' | tee -a "$LOG"
begin;
select set_config('request.jwt.claim.sub', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa9', true);
select set_config(
  'request.jwt.claims',
  json_build_object(
    'sub', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa9',
    'role', 'authenticated',
    'app_metadata', json_build_object('tenant_id', 'tvg', 'role', 'admin')
  )::text,
  true
);
set local role authenticated;
insert into public.finance_plans (tenant_id, schema_version, inputs, notes)
values (
  'tvg',
  2,
  jsonb_build_object(
    'structural', jsonb_build_object('weeks_per_year', 52, 'months_per_year', 12, 'days_per_month_ar', 30, 'rounding_increment_usd', 1),
    'stages', jsonb_build_object(
      'stage_0', jsonb_build_object('label', 'Stage 0', 'true_operating_profit_pct', 0, 'growth_reserve_pct', 0, 'bad_debt_warranty_pct', 0, 'unidentified_cost_contingency_pct', 0, 'owner_management_comp', -1),
      'stage_1', jsonb_build_object('label', 'Stage 1', 'true_operating_profit_pct', 0, 'growth_reserve_pct', 0, 'bad_debt_warranty_pct', 0, 'unidentified_cost_contingency_pct', 0),
      'stage_2', jsonb_build_object('label', 'Stage 2', 'true_operating_profit_pct', 0, 'growth_reserve_pct', 0, 'bad_debt_warranty_pct', 0, 'unidentified_cost_contingency_pct', 0),
      'stage_3', jsonb_build_object('label', 'Stage 3', 'true_operating_profit_pct', 0, 'growth_reserve_pct', 0, 'bad_debt_warranty_pct', 0, 'unidentified_cost_contingency_pct', 0)
    ),
    'staffing', '[]'::jsonb,
    'owner_field_replacement', jsonb_build_object('wage', 0, 'burden', 0),
    'cost_pools', '{}'::jsonb,
    'channels', '[]'::jsonb,
    'services', '{}'::jsonb,
    'monthly_basis', '{}'::jsonb
  ),
  'negative-owner-approved'
);
select public.finance_approve_plan((select id from public.finance_plans where notes = 'negative-owner-approved'), 1);
reset role;
commit;
SQL

scan_row="$("${PSQL[@]}" -d "$DB" -tA -F '|' -f "$TEST/preapply_v1_shape_scan.sql" | tr -d '[:space:]')"
echo "scan=$scan_row" | tee -a "$LOG"
if [[ "$scan_row" != "1|0|0|0|0|1" ]]; then
  echo "FAIL: approvability scan expected 1|0|0|0|0|1 and got $scan_row" | tee -a "$LOG"
  exit 1
fi

# Approve a negative stage-0 fuel pool under the pre-contract RPC.
# That supersedes the owner row. The scan must still see the approved row.
"${PSQL[@]}" -d "$DB" -v ON_ERROR_STOP=1 <<'SQL' | tee -a "$LOG"
begin;
select set_config('request.jwt.claim.sub', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa9', true);
select set_config(
  'request.jwt.claims',
  json_build_object(
    'sub', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa9',
    'role', 'authenticated',
    'app_metadata', json_build_object('tenant_id', 'tvg', 'role', 'admin')
  )::text,
  true
);
set local role authenticated;
insert into public.finance_plans (tenant_id, schema_version, inputs, notes)
values (
  'tvg',
  2,
  jsonb_set(
    jsonb_build_object(
      'structural', jsonb_build_object('weeks_per_year', 52, 'months_per_year', 12, 'days_per_month_ar', 30, 'rounding_increment_usd', 1),
      'stages', jsonb_build_object(
        'stage_0', jsonb_build_object('label', 'Stage 0', 'true_operating_profit_pct', 0, 'growth_reserve_pct', 0, 'bad_debt_warranty_pct', 0, 'unidentified_cost_contingency_pct', 0, 'owner_management_comp', 0, 'owner_shadow_hours', 0),
        'stage_1', jsonb_build_object('label', 'Stage 1', 'true_operating_profit_pct', 0, 'growth_reserve_pct', 0, 'bad_debt_warranty_pct', 0, 'unidentified_cost_contingency_pct', 0),
        'stage_2', jsonb_build_object('label', 'Stage 2', 'true_operating_profit_pct', 0, 'growth_reserve_pct', 0, 'bad_debt_warranty_pct', 0, 'unidentified_cost_contingency_pct', 0),
        'stage_3', jsonb_build_object('label', 'Stage 3', 'true_operating_profit_pct', 0, 'growth_reserve_pct', 0, 'bad_debt_warranty_pct', 0, 'unidentified_cost_contingency_pct', 0)
      ),
      'staffing', '[]'::jsonb,
      'owner_field_replacement', jsonb_build_object('wage', 0, 'burden', 0),
      'cost_pools', '{}'::jsonb,
      'channels', '[]'::jsonb,
      'services', '{}'::jsonb,
      'monthly_basis', '{}'::jsonb
    ),
    '{cost_pools}',
    (
      select jsonb_object_agg(grp, grp_obj)
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
      ) as pool_groups
    )
  ),
  'negative-pool-approved'
);
select public.finance_approve_plan((select id from public.finance_plans where notes = 'negative-pool-approved'), 1);
reset role;
commit;
SQL

pool_scan="$("${PSQL[@]}" -d "$DB" -tA -F '|' -f "$TEST/preapply_v1_shape_scan.sql" | tr -d '[:space:]')"
echo "pool_scan=$pool_scan" | tee -a "$LOG"
if [[ "$pool_scan" != "2|0|0|0|0|1" ]]; then
  echo "FAIL: negative-pool scan expected 2|0|0|0|0|1 and got $pool_scan" | tee -a "$LOG"
  exit 1
fi

# Approve 0.7+0.2+0.1+0 under the pre-contract RPC. Empty pools leave required
# revenue blank. The scan must still count that approved row.
"${PSQL[@]}" -d "$DB" -v ON_ERROR_STOP=1 <<'SQL' | tee -a "$LOG"
begin;
select set_config('request.jwt.claim.sub', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa9', true);
select set_config(
  'request.jwt.claims',
  json_build_object(
    'sub', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa9',
    'role', 'authenticated',
    'app_metadata', json_build_object('tenant_id', 'tvg', 'role', 'admin')
  )::text,
  true
);
set local role authenticated;
insert into public.finance_plans (tenant_id, schema_version, inputs, notes)
values (
  'tvg',
  2,
  jsonb_build_object(
    'structural', jsonb_build_object('weeks_per_year', 52, 'months_per_year', 12, 'days_per_month_ar', 30, 'rounding_increment_usd', 1),
    'stages', jsonb_build_object(
      'stage_0', jsonb_build_object('label', 'Stage 0', 'true_operating_profit_pct', 0.7, 'growth_reserve_pct', 0.2, 'bad_debt_warranty_pct', 0.1, 'unidentified_cost_contingency_pct', 0),
      'stage_1', jsonb_build_object('label', 'Stage 1', 'true_operating_profit_pct', 0, 'growth_reserve_pct', 0, 'bad_debt_warranty_pct', 0, 'unidentified_cost_contingency_pct', 0),
      'stage_2', jsonb_build_object('label', 'Stage 2', 'true_operating_profit_pct', 0, 'growth_reserve_pct', 0, 'bad_debt_warranty_pct', 0, 'unidentified_cost_contingency_pct', 0),
      'stage_3', jsonb_build_object('label', 'Stage 3', 'true_operating_profit_pct', 0, 'growth_reserve_pct', 0, 'bad_debt_warranty_pct', 0, 'unidentified_cost_contingency_pct', 0)
    ),
    'staffing', '[]'::jsonb,
    'owner_field_replacement', jsonb_build_object('wage', 0, 'burden', 0),
    'cost_pools', '{}'::jsonb,
    'channels', '[]'::jsonb,
    'services', '{}'::jsonb,
    'monthly_basis', '{}'::jsonb
  ),
  'boundary-total-approved'
);
select public.finance_approve_plan((select id from public.finance_plans where notes = 'boundary-total-approved'), 1);
reset role;
commit;
SQL

boundary_scan="$("${PSQL[@]}" -d "$DB" -tA -F '|' -f "$TEST/preapply_v1_shape_scan.sql" | tr -d '[:space:]')"
echo "boundary_scan=$boundary_scan" | tee -a "$LOG"
if [[ "$boundary_scan" != "3|0|0|0|0|1" ]]; then
  echo "FAIL: boundary scan expected 3|0|0|0|0|1 and got $boundary_scan" | tee -a "$LOG"
  exit 1
fi

set +e
"${PSQL[@]}" -d "$DB" -f "$MIG/20261006141000_finance_approve_requires_retention.sql" >>"$LOG" 2>&1
apply_status=$?
set -e
if [[ "$apply_status" -eq 0 ]]; then
  echo "FAIL: approvability migration committed" | tee -a "$LOG"
  exit 1
fi
if ! grep -q 'finance_approvability_impact_abort approved_not_approvable=1' "$LOG"; then
  echo "FAIL: abort message missing" | tee -a "$LOG"
  exit 1
fi
still="$("${PSQL[@]}" -d "$DB" -tA -c "select coalesce(to_regprocedure('public.finance_plan_approvable(jsonb)')::text, 'absent') || '|' || (select status from public.finance_plans where notes = 'negative-owner-approved') || '|' || (select status from public.finance_plans where notes = 'negative-pool-approved') || '|' || (select status from public.finance_plans where notes = 'boundary-total-approved');")"
echo "after_abort=$still" | tee -a "$LOG"
if [[ "$still" != "absent|superseded|superseded|approved" ]]; then
  echo "FAIL: expected absent|superseded|superseded|approved and got $still" | tee -a "$LOG"
  exit 1
fi
"${PSQL[@]}" -d postgres -c "drop database if exists \"$DB\";" >/dev/null
echo "PASS: approvability abort and inline scan" | tee -a "$LOG"

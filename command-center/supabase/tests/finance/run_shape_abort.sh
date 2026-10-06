#!/usr/bin/env bash
# Proves 20261006140000 aborts when stored rows would fail the new check,
# and that the read-only scan reports those rows before the new function exists.
# Disposable local databases only. No replica mode. No hosted project.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
MIG="$ROOT/supabase/migrations"
TEST="$ROOT/supabase/tests/finance"
PSQL=(sudo -u postgres psql -v ON_ERROR_STOP=1)
BASE=(
  20261003053000_finance_stage_a_persistence.sql
  20261003063000_finance_stage_a_security_fixes.sql
  20261003113216_finance_one_draft_per_tenant.sql
  20261003132212_finance_actuals_plan_independent.sql
  20261003145000_finance_actuals_known_channel_ceiling.sql
  20261003180000_finance_plan_monthly_basis.sql
  20261003223000_finance_plan_v2_required_sections.sql
  20261004120000_finance_version_conflict_pt409.sql
)
BAD_DB="${FINANCE_LOCAL_DB:-finance_gate_s_abort}"
CLEAN_DB="${FINANCE_LOCAL_DB_CLEAN:-finance_gate_s_abort_clean}"
LOG="${SHAPE_ABORT_LOG:-/opt/cursor/artifacts/finance-gate-s-corrective/shape-abort.log}"
mkdir -p "$(dirname "$LOG")"
: > "$LOG"

drop_db() {
  local name="$1"
  "${PSQL[@]}" -d postgres -c "select pg_terminate_backend(pid) from pg_stat_activity where datname = '$name' and pid <> pg_backend_pid();" >/dev/null
  "${PSQL[@]}" -d postgres -c "drop database if exists \"$name\";"
}

apply_base() {
  local name="$1"
  "${PSQL[@]}" -d postgres -c "create database \"$name\";"
  "${PSQL[@]}" -d "$name" -f "$TEST/local_auth_bootstrap.sql"
  for file in "${BASE[@]}"; do
    echo "APPLY $file" | tee -a "$LOG"
    "${PSQL[@]}" -d "$name" -f "$MIG/$file"
  done
}

drop_db "$BAD_DB"
apply_base "$BAD_DB"

"${PSQL[@]}" -d "$BAD_DB" -v ON_ERROR_STOP=1 <<'SQL' | tee -a "$LOG"
begin;
select set_config('request.jwt.claim.sub', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1', true);
select set_config(
  'request.jwt.claims',
  json_build_object(
    'sub', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',
    'role', 'authenticated',
    'app_metadata', json_build_object('tenant_id', 'tvg', 'role', 'admin')
  )::text,
  true
);
set local role authenticated;
insert into public.finance_plans (tenant_id, schema_version, inputs, notes)
values ('tvg', 1, '{"kept":true}'::jsonb, 'partial-v1-approved');
select public.finance_approve_plan((select id from public.finance_plans where notes = 'partial-v1-approved'), 1);
insert into public.finance_plans (tenant_id, schema_version, inputs, notes)
values ('tvg', 1, '{"kept":true}'::jsonb, 'partial-v1-draft');
reset role;
commit;
SQL

echo "OLD_FUNCTION_SCAN" | tee -a "$LOG"
old_count="$("${PSQL[@]}" -d "$BAD_DB" -tA -c "select count(*) filter (where schema_version = 1 and not public.finance_plan_document_ok(schema_version, inputs)) from public.finance_plans;")"
echo "old_v1_would_fail=$old_count" | tee -a "$LOG"
if [[ "$old_count" != "0" ]]; then
  echo "FAIL: old function was expected to under-count partial v1 rows" | tee -a "$LOG"
  exit 1
fi

echo "INLINE_SCAN" | tee -a "$LOG"
scan_row="$("${PSQL[@]}" -d "$BAD_DB" -tA -F '|' -f "$TEST/preapply_v1_shape_scan.sql")"
echo "scan=$scan_row" | tee -a "$LOG"
if [[ "$scan_row" != "2|2|2|1|0|1" ]]; then
  echo "FAIL: inline scan expected 2|2|2|1|0|1 and got $scan_row" | tee -a "$LOG"
  exit 1
fi

set +e
"${PSQL[@]}" -d "$BAD_DB" -f "$MIG/20261006140000_finance_v1_document_shape.sql" >>"$LOG" 2>&1
abort_status=$?
set -e
echo "ABORT_EXIT $abort_status" | tee -a "$LOG"
if [[ "$abort_status" -eq 0 ]]; then
  echo "FAIL: migration committed over partial v1 rows" | tee -a "$LOG"
  exit 1
fi
if ! grep -q 'finance_v1_shape_impact_abort total=2 v1=2 v1_would_fail=2 v2_would_fail=0' "$LOG"; then
  echo "FAIL: abort message missing counts" | tee -a "$LOG"
  exit 1
fi
"${PSQL[@]}" -d "$BAD_DB" -v ON_ERROR_STOP=1 <<'SQL' | tee -a "$LOG"
do $$
begin
  if public.finance_plan_document_ok(1, '{"kept":true}'::jsonb) is distinct from true then
    raise exception 'FAIL: rolled-back migration replaced the version 1 check';
  end if;
  if (select count(*) from public.finance_plans where notes like 'partial-v1-%') <> 2 then
    raise exception 'FAIL: abort removed or rewrote the partial rows';
  end if;
  raise notice 'PASS: old function still accepts partial v1 after rollback';
end $$;
SQL

drop_db "$BAD_DB"
drop_db "$CLEAN_DB"
apply_base "$CLEAN_DB"
echo "CLEAN_APPLY" | tee -a "$LOG"
"${PSQL[@]}" -d "$CLEAN_DB" -f "$MIG/20261006140000_finance_v1_document_shape.sql" >>"$LOG" 2>&1
if ! grep -q 'finance_v1_shape_impact total=0 v1=0 v1_would_fail=0 v2_would_fail=0' "$LOG"; then
  echo "FAIL: clean apply did not notice zeros" | tee -a "$LOG"
  exit 1
fi
"${PSQL[@]}" -d "$CLEAN_DB" -f "$MIG/20261006141000_finance_approve_requires_retention.sql"
"${PSQL[@]}" -d "$CLEAN_DB" -f "$MIG/20261006142000_finance_approve_trigger_guard.sql"
echo "AUTHORIZED_SEED" | tee -a "$LOG"
"${PSQL[@]}" -d "$CLEAN_DB" -f "$ROOT/tests/finance/seed-v1-historical.sql" | tee -a "$LOG"
"${PSQL[@]}" -d "$CLEAN_DB" -v ON_ERROR_STOP=1 <<'SQL' | tee -a "$LOG"
do $$
begin
  if (select status from public.finance_plans where id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1') is distinct from 'superseded' then
    raise exception 'FAIL: authorized seed did not supersede the version 1 plan';
  end if;
  if (select schema_version from public.finance_plans where id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1') is distinct from 1 then
    raise exception 'FAIL: authorized seed changed the version 1 schema';
  end if;
  if not exists (
    select 1 from public.finance_monthly_actuals
    where comparison_plan_id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1'
      and month = date '2025-11-01'
  ) then
    raise exception 'FAIL: authorized seed did not attach the November actual';
  end if;
  raise notice 'PASS: authorized historical seed';
end $$;
SQL
echo "CLEAN_SCAN" | tee -a "$LOG"
"${PSQL[@]}" -d "$CLEAN_DB" -f "$TEST/preapply_v1_shape_scan.sql" | tee -a "$LOG"

drop_db "$BAD_DB"
drop_db "$CLEAN_DB"
echo "PASS: shape abort, inline scan, and authorized historical seed" | tee -a "$LOG"

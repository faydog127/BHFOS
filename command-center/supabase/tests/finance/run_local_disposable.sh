#!/usr/bin/env bash
# Apply the finance migrations in timestamp order on a disposable local database,
# then run finance SQL tests 01-07. Drops the database when finished.
# Does not contact a hosted Supabase project. Does not set replica mode.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
MIG="$ROOT/supabase/migrations"
TEST="$ROOT/supabase/tests/finance"
DB="${FINANCE_LOCAL_DB:-finance_gate_s_local}"
PSQL=(sudo -u postgres psql -v ON_ERROR_STOP=1)

migrations=(
  20261003053000_finance_stage_a_persistence.sql
  20261003063000_finance_stage_a_security_fixes.sql
  20261003113216_finance_one_draft_per_tenant.sql
  20261003132212_finance_actuals_plan_independent.sql
  20261003145000_finance_actuals_known_channel_ceiling.sql
  20261003180000_finance_plan_monthly_basis.sql
  20261003223000_finance_plan_v2_required_sections.sql
  20261004120000_finance_version_conflict_pt409.sql
  20261006140000_finance_v1_document_shape.sql
  20261006141000_finance_approve_requires_retention.sql
)

tests=(
  01_rls_and_version.sql
  02_stage_a_security_fixes.sql
  03_one_draft_and_corrections.sql
  04_actuals_identity.sql
  05_known_channel_ceiling.sql
  06_monthly_basis.sql
  07_gate_s_corrective.sql
)

"${PSQL[@]}" -d postgres -c "select pg_terminate_backend(pid) from pg_stat_activity where datname = '$DB' and pid <> pg_backend_pid();" >/dev/null
"${PSQL[@]}" -d postgres -c "drop database if exists \"$DB\";"
"${PSQL[@]}" -d postgres -c "create database \"$DB\";"
"${PSQL[@]}" -d "$DB" -f "$TEST/local_auth_bootstrap.sql"

for file in "${migrations[@]}"; do
  echo "APPLY $file"
  "${PSQL[@]}" -d "$DB" -f "$MIG/$file"
done

for file in "${tests[@]}"; do
  echo "TEST $file"
  "${PSQL[@]}" -d "$DB" -f "$TEST/$file"
done

"${PSQL[@]}" -d postgres -c "drop database if exists \"$DB\";"
echo "PASS: disposable finance database dropped"

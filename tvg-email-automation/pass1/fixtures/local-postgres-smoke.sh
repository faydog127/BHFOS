#!/usr/bin/env bash
# Disposable local Postgres smoke for the TVG Email Pass 1 apply pack.
# Does not connect to Supabase. Refuses to run if a staging/production URL is set.
set -euo pipefail

if [[ -n "${TVG_EMAIL_DATABASE_URL:-}" || -n "${DATABASE_URL:-}" ]]; then
  echo "refusing: local smoke ignores TVG_EMAIL_DATABASE_URL and DATABASE_URL" >&2
  exit 2
fi

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
CONTAINER="${TVG_EMAIL_LOCAL_PG_CONTAINER:-tvg-email-pass1-pg}"
PORT="${TVG_EMAIL_LOCAL_PG_PORT:-55432}"

if ! command -v docker >/dev/null 2>&1; then
  echo "docker is not available; local SQL smoke skipped" >&2
  exit 3
fi

cleanup() {
  docker rm -f "$CONTAINER" >/dev/null 2>&1 || true
}
trap cleanup EXIT

docker rm -f "$CONTAINER" >/dev/null 2>&1 || true
docker run -d --name "$CONTAINER" \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=tvg_email_pass1 \
  -p "${PORT}:5432" \
  postgres:17-alpine >/dev/null

for _ in $(seq 1 40); do
  if docker exec "$CONTAINER" pg_isready -U postgres -d tvg_email_pass1 >/dev/null 2>&1; then
    break
  fi
  sleep 1
done

docker exec -i "$CONTAINER" psql -U postgres -d tvg_email_pass1 -v ON_ERROR_STOP=1 \
  < "$ROOT/fixtures/sql/local-crm-stub.sql"

docker exec -i "$CONTAINER" psql -U postgres -d tvg_email_pass1 -v ON_ERROR_STOP=1 -1 \
  -c "SELECT set_config('tvg_email_pass1.target_project', 'glkrykpksbsqmmilmjhs', false);" \
  -f - < "$ROOT/apply/20260924_tvg_email_pass1_v5.sql"

docker cp "$ROOT" "$CONTAINER:/opt/pack"
docker exec "$CONTAINER" psql -U postgres -d tvg_email_pass1 -v ON_ERROR_STOP=1 -1 \
  -f /opt/pack/fixtures/sql/local-smoke.sql

echo "local postgres smoke passed"

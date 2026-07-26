# MIL SQL contract tests

Plain SQL assertions for Media Intelligence Library schema and RLS structure. These complement Node unit tests (`npm run test:media-intel-helpers`) but require a live Postgres instance with MIL migrations applied.

## Prerequisites

- **Docker Desktop** (or another Docker engine) running — Supabase local stack depends on it.
- Supabase CLI available via `npx supabase` from `command-center/`.

## Run (recommended)

From `command-center/`:

```bash
npx supabase start
npx supabase db reset
```

Then execute tests with `psql` against the local DB (default port from `supabase/config.toml` is **25432**):

```bash
psql "postgresql://postgres:postgres@127.0.0.1:25432/postgres" \
  -f supabase/tests/mil/00_schema_contract.sql

psql "postgresql://postgres:postgres@127.0.0.1:25432/postgres" \
  -f supabase/tests/mil/01_rls_matrix.sql
```

Alternatively, if your project configures Supabase database testing:

```bash
npx supabase test db
```

(This repo does **not** currently wire pgTAP into `supabase test db`; the files above use `DO $$ … raise exception` blocks instead.)

## Files

| File | Asserts |
|---|---|
| `00_schema_contract.sql` | Derivative kinds incl. `public_safe`/`ai_safe`; customer permission gate; the nine finalization RPCs exist and are `service_role`-only; the retired `mil_finalize_upload_grant` / `mil_cleanup_expired_upload_grants` are gone; no `mil_staff_all*` policies; `mil_is_reviewer` excludes office |
| `01_rls_matrix.sql` | Capability-matrix policies via `pg_policies` — browse, reviewer write, owner-admin, creator reel, no `phone_uploader` policies |
| `02_upload_finalization_lifecycle.sql` | Structural contract for 20260726090000 — `abandoned_count`, grant finalize columns, `finalize_state` / canonical path / commit-proof constraints, `mil_integrity_alerts` RLS, `mil_manifest_entries.grant_id` partial unique index, `mil_assets_active_checksum_uniq`, no `replace()` path derivation, client write grants removed, retired batch write policies gone |
| `03_upload_lifecycle_behavior.sql` | Behavioral lifecycle, run inside a rolled-back transaction — lease contention, non-canonical quarantine rejection, MIME mismatch, catalog absent/mismatch at commit, successful commit, duplicate, quarantine bytes changed between attempts, expiry → abandonment, reconcile of a stranded `placed` grant, plus the counter and integrity-alert side effects |
| `04_upload_privilege_matrix.sql` | Behavioral privilege matrix — `authenticated`/`anon` are denied every lifecycle write and every finalization RPC, browse SELECT and the reviewer `mil_assets` UPDATE still work, `service_role` keeps its table and EXECUTE rights |

Note on grants: 20260726090000 states the surviving privileges explicitly (`grant select …`) instead of relying on the environment's default privileges. A disposable local stack and the hosted project do not start from the same table ACL, and `02`/`04` would otherwise pass or fail for reasons unrelated to the migration.

## Execution status

Executed successfully on disposable local Supabase after `npx supabase db reset` (2026-07-25):

- `mil 00_schema_contract: PASS`
- `mil 01_rls_matrix: PASS (structural)`
- `mil 02_upload_finalization_lifecycle: PASS`
- `mil 03_upload_lifecycle_behavior: PASS`
- `mil 04_upload_privilege_matrix: PASS`

These prove schema/RLS structure and RPC behavior on local Postgres only. They are **not** staging/production proof. `03` simulates storage by inserting into `storage.objects`; it does not exercise the Storage API, so the edge-side placement path is unproven here.

## Related

- Static contracts: `tests/unit/media-intel-contracts.test.mjs`
- Implementation status: `docs/media-intelligence/IMPLEMENTATION_STATUS.md`

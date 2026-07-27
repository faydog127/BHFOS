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
| `05_jwt_rls_behavior.sql` | JWT-seeded behavioral RLS — seeds `auth.users` + `app_user_roles`, acts as admin/reviewer/office/creator/technician via `request.jwt.claim.sub`, proves office≠reviewer, staff browse, collection membership writes, quarantine-only storage INSERT, creator/tech denied originals SELECT |

Note on grants: `20260726090000` states lifecycle privileges explicitly; `20260727130000` states the remaining client/service_role table privileges so RLS policies are reachable. A disposable local stack and the hosted project do not start from the same table ACL.

## Execution status

Executed successfully on disposable local Supabase (2026-07-25 after reset; re-verified 2026-07-27 recovery):

- `mil 00_schema_contract: PASS`
- `mil 01_rls_matrix: PASS (structural)`
- `mil 02_upload_finalization_lifecycle: PASS`
- `mil 03_upload_lifecycle_behavior: PASS`
- `mil 04_upload_privilege_matrix: PASS`
- `mil 05_jwt_rls_behavior: PASS` (2026-07-27; requires `20260727130000` client table grants)

These prove schema/RLS structure and RPC behavior on local Postgres only. They are **not** staging/production proof. `03`/`05` simulate storage by inserting into `storage.objects`; they do not exercise the Storage HTTP API, so the edge-side placement/sign path is unproven here.
- `mil 03_upload_lifecycle_behavior: PASS`
- `mil 04_upload_privilege_matrix: PASS`
- `mil 05_jwt_rls_behavior: PASS` (2026-07-27; requires `20260727130000` client table grants)

These prove schema/RLS structure and RPC behavior on local Postgres only. They are **not** staging/production proof. `03`/`05` simulate storage by inserting into `storage.objects`; they do not exercise the Storage HTTP API, so the edge-side placement/sign path is unproven here.

## Related

- Static contracts: `tests/unit/media-intel-contracts.test.mjs`
- Implementation status: `docs/media-intelligence/IMPLEMENTATION_STATUS.md`

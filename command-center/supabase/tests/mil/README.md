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
| `00_schema_contract.sql` | Derivative kinds incl. `public_safe`/`ai_safe`; customer permission gate; `mil_finalize_upload_grant` exists (service_role); no `mil_staff_all*` policies; `mil_is_reviewer` excludes office |
| `01_rls_matrix.sql` | Capability-matrix policies via `pg_policies` — browse, reviewer write, owner-admin, creator reel, no `phone_uploader` policies |

## Execution status

Executed successfully on disposable local Supabase after `npx supabase db reset` (2026-07-25):

- `mil 00_schema_contract: PASS`
- `mil 01_rls_matrix: PASS (structural)`

These prove schema/RLS structure on local Postgres only. They are **not** staging/production proof.

## Related

- Static contracts: `tests/unit/media-intel-contracts.test.mjs`
- Implementation status: `docs/media-intelligence/IMPLEMENTATION_STATUS.md`

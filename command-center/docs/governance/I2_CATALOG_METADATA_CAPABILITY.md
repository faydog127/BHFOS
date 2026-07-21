# I2 Bounded Catalog-Metadata Capability

> Adapter capability only. Does **not** apply Slice 2 migrations, deploy, or
> begin Slice 3. Live calls require a `database_read`-scoped Diagnostics OAuth
> token under existing Projects Read + Database Read scopes only.

## Purpose

Enable Orchestrator **A0** posture checks (RLS flags, policies, grants, schema
metadata, and one aggregate uniqueness precheck) without Founder Dashboard SQL
and without arbitrary SQL.

## Transport

`POST /v1/projects/{ref}/database/query/read-only` only.

- Agent never supplies SQL (`--sql` / `query` / `sql` params → DENY).
- Writable `.../database/query` → DENY.
- `execute-sql` Edge Function → DENY (unchanged).
- Project ref hard-locked to `wwyxohjnyqnegzbxtuxs`.

## Operations

See `catalog-ops.mjs` / CLI `catalog <op> …`.

Aggregate uniqueness precheck (S2 apply gate):

```bash
node tools/supabase-diagnostics-adapter/cli.mjs catalog catalog_quotes_s2_active_unique_conflict_counts
```

- Hard-locked to `public.quotes` (no table/predicate params).
- Predicate matches proposed `quotes_tenant_lead_active_unique` including `issued`.
- Returns only `conflict_group_count` and `conflicting_row_count` (response sanitized).

## Audit

Append-only JSONL via `I2_DIAGNOSTICS_AUDIT_LOG` or
`%LOCALAPPDATA%\BHFOS\production-diagnostics\adapter-audit.jsonl`.
Records: time, operation, params, result_class, http status — never tokens or
row dumps.

## Tests

```bash
npm run test:supabase-diagnostics-adapter
```

## Standing authority after merge + live verification

Once merged and live catalog calls succeed under approved OAuth scope, catalog
ops (including the aggregate precheck) are **A0** standing authority (no
per-query Founder approval).

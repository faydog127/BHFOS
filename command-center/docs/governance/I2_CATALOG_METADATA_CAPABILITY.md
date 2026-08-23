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

Slice 1 campaign (`NOS-I2-S1-EVIDENCE-01`) dependency-metadata (Stage A):

```bash
node tools/supabase-diagnostics-adapter/cli.mjs --dry-run-catalog catalog_object_dependencies --schema=public --table=organizations
```

- Input: `schema=public` plus one approved Slice 1 relation (`organizations`, `accounts`, `contacts`, `properties`, `leads`, `services_catalog`, `price_book`, `events`, `crm_tasks`, `app_user_roles`, `tenants`).
- Output after sanitization: `dependency_identity` and `dependency_type` only.
- Direct public catalog dependencies of that relation may appear as identity+type rows. No definitions, OIDs, or business-table rows.
- Unknown operations, unexpected parameters, non-public schemas, and non-Slice-1 tables fail closed.

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

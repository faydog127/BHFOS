# I2 Bounded Catalog-Metadata Capability

> Adapter capability only. Does **not** apply R-S1-01, deploy, or begin Slice 2.
> Live calls require a `database_read`-scoped Diagnostics OAuth token (separate
> Founder credential/scope provisioning after this code merges).

## Purpose

Enable Orchestrator **A0** posture checks (RLS flags, policies, grants, schema
metadata) without Founder Dashboard SQL and without arbitrary SQL.

## Transport

`POST /v1/projects/{ref}/database/query/read-only` only.

- Agent never supplies SQL (`--sql` / `query` / `sql` params → DENY).
- Writable `.../database/query` → DENY.
- `execute-sql` Edge Function → DENY (unchanged).
- Project ref hard-locked to `wwyxohjnyqnegzbxtuxs`.

## Operations

See `catalog-ops.mjs` / CLI `catalog <op> --schema=public --table=estimates`.

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
ops are **A0** standing authority (no per-query Founder approval).

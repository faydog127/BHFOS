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

Slice 1 campaign Stage C aggregate-count templates (adapter-owned; no caller table/column/predicate/grouping/SQL/URL/project-ref input):

```bash
node tools/supabase-diagnostics-adapter/cli.mjs --dry-run-catalog catalog_organizations_count_all
```

- Applicable families from the Stage C schema manifest: `count_all`, `count_by_boolean`, `count_by_category_with_other`.
- Packet-quality families added only where Stage B proved the path:
  - `scope_quality` on proven `tenant_id` columns (`contacts`, `leads`, `price_book`, `events`, `crm_tasks`). Keys: `operation_id`, `null_count`, `tvg_count`, `default_count`, `other_count`.
  - `required_field_quality` on proven `is_nullable=NO` text scope columns (`contacts.tenant_id`, `leads.tenant_id`). Keys: `operation_id`, `present_count`, `null_or_blank_count`.
  - `duplicate_quality` for proven unique business keys `email`, `phone`, `slug`, `code`, and `(tenant_id, code)`. Keys: `operation_id`, `duplicate_group_count`, `duplicate_row_count`. Key values are never returned.
  - `relationship_null_reference` for proven local FK columns (null/non-null only; no join). Keys: `operation_id`, `null_count`, `non_null_count`.
- Each operation returns exactly one sanitized row: fixed `operation_id` plus numeric counts.
- `count_all` keys: `operation_id`, `row_count`.
- `count_by_boolean` keys: `operation_id`, `true_count`, `false_count`, `null_count`.
- `count_by_category_with_other` keys: `operation_id`, `null_or_blank_count`, `other_count`. The manifest does not list recognized category values, so all non-blank values contribute only to `other_count`. Category keys are never returned.
- Missing required relation or column fails closed (query error or empty sanitized row → DENY). Unexpected response fields are stripped.
- Omitted as `STAGE_C_METADATA_GAP` (unproven Stage B path): orphan-reference joins; hierarchy joins; catalog/price-book reconciliation; events payload JSON uniques; scope quality on `organizations`, `accounts`, `services_catalog`, `app_user_roles`, `tenants`, and `properties`; `app_user_roles` tenant binding; required-present on columns whose `is_nullable=NO` was not proven.
- Also omitted: `count_by_name_or_identity`, `count_by_timestamp_bucket`, `group_by_uuid_fk`, `freeform_predicate`.
- Omitted columns: `source_url`, `source_detail`, `utm_*`, `marketing_source_detail`, `home_image_source`, names, notes, UUID FK identities as output.
- `services_catalog` has no category family. `events`, `crm_tasks`, `app_user_roles`, and `tenants` have no boolean family.
- Stage C authorizes local templates and tests only. It does not authorize hosted aggregate execution, R1/S1 activation, or credential use.

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

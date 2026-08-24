# Supabase Diagnostics Adapter (G2.3B-B2D corrected)

Bounded allowlist facade for Production Diagnostics. **No credential is issued
or connected until Founder authorization after Architecture Guard approval of
G2.3B-B2D.**

## Guarantees

- Hard endpoint allowlist (`allowlist.json`) — project metadata + health + **bounded catalog**
- Hard project-ref lock: `wwyxohjnyqnegzbxtuxs` (adapter isolation; **not** a claim that the OAuth token is project-scoped)
- No agent-controlled URL, path, query, project ref, or HTTP method bypass
- No function-body retrieval; Edge Function ops deferred
- No agent-provided log SQL
- **No agent-supplied SQL**; catalog uses adapter-owned SELECT templates only
- Catalog transport: `POST .../database/query/read-only` only (writable `/database/query` DENY)
- No secrets or API-key retrieval
- No Auth-user access
- No function deploy/mutation
- No migrations apply or configuration changes
- No project listing / org listing / network restrictions / network bans / upgrade surfaces via adapter
- OAuth access token via `I2_SUPABASE_OAUTH_ACCESS_TOKEN` env only — never CLI argv, never returned to the agent
- Audit log for catalog ops (operation/time/params/result_class)

## Commands

```bash
node tools/supabase-diagnostics-adapter/cli.mjs --self-test
npm run test:supabase-diagnostics-adapter

# Dry-run catalog (no network):
node tools/supabase-diagnostics-adapter/cli.mjs --dry-run-catalog catalog_rls_flags --schema=public --table=estimates

# Live catalog (requires database_read-scoped token — separate Founder scope auth):
node tools/supabase-diagnostics-adapter/cli.mjs catalog catalog_rls_flags --schema=public --table=estimates
node tools/supabase-diagnostics-adapter/cli.mjs catalog catalog_quotes_s2_active_unique_conflict_counts
node tools/supabase-diagnostics-adapter/cli.mjs --dry-run-catalog catalog_object_dependencies --schema=public --table=organizations
node tools/supabase-diagnostics-adapter/cli.mjs --dry-run-catalog catalog_organizations_count_all
node tools/supabase-diagnostics-adapter/cli.mjs --dry-run-catalog catalog_organizations_count_by_boolean_is_partner
node tools/supabase-diagnostics-adapter/cli.mjs --dry-run-catalog catalog_organizations_count_by_category_type_with_other
node tools/supabase-diagnostics-adapter/cli.mjs --dry-run-catalog catalog_contacts_count_scope_quality_tenant_id
node tools/supabase-diagnostics-adapter/cli.mjs --dry-run-catalog catalog_contacts_count_duplicate_email
node tools/supabase-diagnostics-adapter/cli.mjs --dry-run-catalog catalog_contacts_count_null_reference_organization_id
```

Stage C Slice 1 aggregates (local templates only; do not execute against production from this stage):

- Families implemented: `count_all`, `count_by_boolean`, `count_by_category_with_other`, plus packet-quality families proven by Stage B: `scope_quality`, `required_field_quality`, `duplicate_quality`, `relationship_null_reference`
- Each operation has zero caller params. Relation, columns, and predicates are hard-coded.
- Response after sanitization: exactly one row with `operation_id` plus numeric counts. Category keys, emails, phones, IDs, and JSON are never returned; non-blank unrecognized values contribute only to `other_count`.
- Families omitted as `STAGE_C_METADATA_GAP` when Stage B did not prove the path: orphan-reference joins, hierarchy joins, catalog/price-book reconciliation, events payload-expression uniques, scope quality on objects with no tenant column, app_user_roles tenant binding.
- Also omitted: `count_by_name_or_identity`, `count_by_timestamp_bucket`, `group_by_uuid_fk`, `freeform_predicate`.
- URL/detail/UTM/name/notes columns are not treated as categories even if listed by mistake.
- Project ref remains `wwyxohjnyqnegzbxtuxs`.

See `docs/governance/I2_CATALOG_METADATA_CAPABILITY.md` and `docs/governance/decisions/NOS_I2_S1_STAGE_C_AGGREGATES_EVIDENCE.md`.
## Credential issuance — Network OS Slice 1 campaign

For control-plane release `NOS-I2-S1-EVIDENCE-01`, requires approved Founder
Decision Packet **NOS-R1-S1-I2-CAP-01**, separate exact PR/SHA review and merge
authorization, approved merge SHA, and `FOUNDER_RUN_READY`. This campaign does
not reopen closed G2.3.

Inventory names (values never in repo):

- `I2_SUPABASE_OAUTH_CLIENT_ID`
- `I2_SUPABASE_OAUTH_CLIENT_SECRET` (if issued)
- `I2_SUPABASE_OAUTH_ACCESS_TOKEN`
- `I2_SUPABASE_OAUTH_REFRESH_TOKEN`
- `I2_SUPABASE_OAUTH_TOKEN_EXPIRY`
- `SUPABASE_DIAGNOSTICS_PROJECT_REF` (= `wwyxohjnyqnegzbxtuxs`)
- `I2_DIAGNOSTICS_SECRET_ENV_FILE` (path to durable Diagnostics env file)

### Protected OAuth helper (Option B — Named Tunnel)

- **Public redirect URI:** `https://oauth-diagnostics.bhfos.com/oauth/callback`
- **Local listener:** `http://127.0.0.1:8765/oauth/callback` (plain HTTP loopback)
- Cloudflare **Named Tunnel** only (stable hostname; no random/temporary hostnames)
- Forwards **only** `/oauth/callback` to the local listener (Host rewritten to loopback)
- Tunnel credentials outside the repository
- Tunnel stops after every authorize attempt; public callback closure verified
- Windows browser launch uses approved Edge/Chrome **absolute** paths only
- Token `scope` when **present**: fail-closed ⊆ `projects:read` + `database:read` only; **both** required (`UNEXPECTED_SCOPE` / `MISSING_*` DENY otherwise)
- Token `scope` when **omitted/empty**: platform-attested OpenAPI omission — dual pre-store attestation required (projects GET + bounded catalog POST) before any durable token write
- Pre-store attestation fails closed unless both Projects Read (`project_admin_read`) and Database Read (`database_read`) succeed; safe failure reports capability + HTTP status + platform permission name only
- Quarantined tokens from failed attempts (including PR #58) must be replaced before B3

```bash
npm run test:supabase-oauth-helper
npm run test:supabase-oauth-tunnel
npm run test:supabase-oauth-launcher-preflight
# Live authorize only after FOUNDER_RUN_READY:
# set I2_FOUNDER_RUN_READINESS_VERDICT=FOUNDER_RUN_READY
# set I2_OAUTH_EXPECTED_SHA=<exact SHA>
node tools/supabase-diagnostics-adapter/oauth-authorize.mjs
```

Founder creates the OAuth app with the **exact HTTPS** redirect, places client
id/secret + tunnel credentials in Diagnostics env (outside repo), then runs the
helper once and approves the browser consent screen. The helper never prints
token values.

The campaign OAuth ceiling is **Projects Read + Database Read only**
(`projects:read` + `database:read`). The credential expires for governance
purposes at evidence completion or 2026-09-30 23:59 America/New_York, whichever
comes first, and must then be revoked and removed from the external Diagnostics
environment. Production negative-write requests are prohibited; post-revocation
verification retries an approved read endpoint only.

Legacy `SUPABASE_DIAGNOSTICS_ADAPTER_TOKEN` is **retired** — do not issue.

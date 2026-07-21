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
```

See `docs/governance/I2_CATALOG_METADATA_CAPABILITY.md`.
## Credential issuance

Requires Founder Decision Packet **G2.3B-B2D Option A** after Architecture Guard
approval of the corrected packet **and** the protected OAuth helper.

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

Legacy `SUPABASE_DIAGNOSTICS_ADAPTER_TOKEN` is **retired** — do not issue.

# Supabase Diagnostics Adapter (G2.3B-B2D corrected)

Bounded allowlist facade for Production Diagnostics. **No credential is issued
or connected until Founder authorization after Architecture Guard approval of
G2.3B-B2D.**

## Guarantees

- Hard endpoint allowlist (`allowlist.json`) — initially project metadata + health only
- Hard project-ref lock: `wwyxohjnyqnegzbxtuxs` (adapter isolation; **not** a claim that the OAuth token is project-scoped)
- No agent-controlled URL, path, query, project ref, or HTTP method bypass
- No function-body retrieval; Edge Function ops deferred
- No agent-provided log SQL
- No SQL execution / database queries
- No secrets or API-key retrieval
- No Auth-user access
- No function deploy/mutation
- No migrations or configuration changes
- No project listing / org listing / network restrictions / network bans / upgrade surfaces via adapter
- OAuth access token via `I2_SUPABASE_OAUTH_ACCESS_TOKEN` env only — never CLI argv, never returned to the agent

## Commands

```bash
node tools/supabase-diagnostics-adapter/cli.mjs --self-test
npm run test:supabase-diagnostics-adapter
```

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

### Protected OAuth helper

Plain HTTP loopback: `http://127.0.0.1:8765/oauth/callback` (no self-signed TLS).
Windows browser launch uses approved Edge/Chrome **absolute** paths only (no
explorer/cmd/PATH). Quarantined tokens from failed attempts must be replaced
before B3.

```bash
npm run test:supabase-oauth-helper
node tools/supabase-diagnostics-adapter/oauth-authorize.mjs
```

Founder creates the OAuth app + places client id/secret in Diagnostics env, then
runs the helper once and approves the browser consent screen. The helper never
prints token values.

Legacy `SUPABASE_DIAGNOSTICS_ADAPTER_TOKEN` is **retired** — do not issue.

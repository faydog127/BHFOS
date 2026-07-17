# Supabase Diagnostics Adapter (G2.3B-B2C)

Bounded allowlist facade for Production Diagnostics. **No credential is issued
or connected under B2C.**

## Guarantees

- Hard endpoint allowlist (`allowlist.json`)
- No function-body retrieval (`/body` prohibited)
- No agent-provided log SQL
- No SQL execution / database queries
- No secrets or API-key retrieval
- No Auth-user access
- No function deploy/mutation
- No migrations or configuration changes
- Migration-list: **unavailable** until account capability proven
- Internal credential (future) via `SUPABASE_DIAGNOSTICS_ADAPTER_TOKEN` env only — never CLI argv, never returned to the agent

## Commands

```bash
node tools/supabase-diagnostics-adapter/cli.mjs --self-test
npm run test:supabase-diagnostics-adapter
```

## Credential issuance

Requires Founder Decision Packet **G2.3B-B2D** (adapter design AG via PR `#54`).
Do not issue or connect a credential without that authorization.

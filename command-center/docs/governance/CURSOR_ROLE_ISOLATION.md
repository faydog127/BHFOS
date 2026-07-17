# Cursor Role Isolation — G2.3B-B2C

> Binding: separate chat tabs do **not** satisfy isolation. Each production role
> must use a distinct Cursor execution profile/environment, MCP config, and
> secret store. No production MCP credentials in one global Cursor config.
>
> No secret values in this document.

## Roles

| Role | Cursor execution type | MCP config location (repo template) | Secret-storage mechanism | Credentials exposed | Credentials explicitly unavailable | Startup method | Revocation |
| --- | --- | --- | --- | --- | --- | --- | --- |
| **Production Diagnostics** | Local (primary); optional dedicated cloud env later | `cursor-environments/production-diagnostics/mcp.json.template` → loaded only into Diagnostics profile (never default global) | Local: OS/secret-store → process env `GITHUB_PERSONAL_ACCESS_TOKEN` for MCP only. Cloud: Diagnostics-only Dashboard secrets | `I2_GITHUB_MCP_DIAGNOSTICS_PAT` (via env name only). Future: adapter-internal Supabase cred (not agent-visible) | Hostinger; Operator deploy; Release merge bots; UAT identities; Supabase until separate auth | Start Cursor with Diagnostics profile / worktree that copies **only** Diagnostics mcp template into that profile’s mcp config; export Diagnostics env from secret store | Revoke fine-grained PAT; delete Diagnostics env secret; restart MCP |
| **Production Operator** | Local (G2.3C); dedicated cloud env later | `cursor-environments/production-operator/mcp.json.template` | Operator secret store / env; Hostinger token **G2.3C only** via deploy CLI | None in G2.3B. Later: `HOSTINGER_API_TOKEN` runtime-only for mutation-gated CLI | Diagnostics GitHub PAT; Supabase adapter cred; UAT | Operator profile with Operator mcp template only; no Diagnostics servers | Revoke Operator secrets independently |
| **Release Agent** | Local or background for authorized merges | `cursor-environments/release-agent/mcp.json.template` | Release-only GitHub auth as required for merge (not Diagnostics PAT) | Release merge identity only when authorized | Diagnostics PAT; Hostinger; Supabase adapter; UAT | Release profile; gh auth as Release identity | Revoke Release credentials |
| **Independent UAT** | Local (later G2.3D) | `cursor-environments/independent-uat/mcp.json.template` | UAT secret store; synthetic I3 later | None in G2.3B | Diagnostics PAT; Hostinger; Operator; Supabase adapter | UAT profile only | Revoke UAT identities |

## Hard rules

1. Do **not** place `I2_GITHUB_MCP_DIAGNOSTICS_PAT` / `GITHUB_PERSONAL_ACCESS_TOKEN` in user-global `~/.cursor/mcp.json` shared by all agents.
2. Do **not** commit token values; templates use env placeholders only.
3. Operator / Release / UAT templates must **not** declare the Diagnostics GitHub MCP server.
4. Hostinger remains `READ_ONLY_CAPABILITY_UNAVAILABLE` for Diagnostics and all G2.3B roles.

## Isolation proof

Run from `command-center/`:

```bash
npm run test:cursor-role-isolation
```

The test fails if:
- any non-Diagnostics template references Diagnostics GitHub MCP or `GITHUB_PERSONAL_ACCESS_TOKEN` / `I2_GITHUB_MCP`
- Diagnostics template lacks `GITHUB_READ_ONLY` / read-only enforcement
- any template embeds a token-like literal
- Operator template includes Hostinger token placeholder before G2.3C authorization marker says deferred

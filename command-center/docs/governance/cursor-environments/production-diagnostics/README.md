# Production Diagnostics — GitHub MCP (G2.3B-B2C)

> Names and wiring only. **Never** put the PAT value in this file, chat, or repo.

## Identity

| Field | Value |
| --- | --- |
| Inventory name | `I2_GITHUB_MCP_DIAGNOSTICS_PAT` |
| Owner | Dedicated machine GitHub identity (not founder personal) |
| Scope | `faydog127/BHFOS` only |
| Permissions | Metadata, Contents, Actions, Pull requests, Commit statuses: **read**; Administration: **read** (branch-protection/rulesets only) |
| Expiration | ≤ 90 days |
| MCP | Official `ghcr.io/github/github-mcp-server` |
| Read-only | `GITHUB_READ_ONLY=1` |
| Toolsets | `context,repos,pull_requests,actions` only |

## Secret injection (local)

1. Store PAT only in the approved Diagnostics secret environment.
2. Export into the Diagnostics Cursor session process environment as
   `GITHUB_PERSONAL_ACCESS_TOKEN` (value never logged).
3. Copy `mcp.json.template` into the **Diagnostics profile** MCP config only
   (not global Cursor config used by other roles).
4. Restart MCP for that profile.

## Validation (after PAT exists)

- Read PR + check state for `faydog127/BHFOS`
- Confirm `get_me` / context shows machine identity
- Attempt write (e.g. create issue / merge) → denied by read-only MCP and/or API
- Revoke PAT → reads fail

## Branch-protection evidence

Prefer existing `npm run verify:branch-protection` under the same Diagnostics env
PAT when MCP lacks a dedicated ruleset tool. Do not expand toolsets to org-wide.

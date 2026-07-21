# Decision Packet — I2 Dual OAuth Pre-Store Attestation

> A1 remediation under A3 Diagnostics OAuth Database Read authorization.
> Does **not** apply R-S1-01, deploy, begin Slice 2, or expand OAuth scopes.

| Field | Value |
| --- | --- |
| Release ID | `I2-OAUTH-DUAL-ATTEST` |
| Risk tier | Tier 2 (diagnostics token-store hardening) |
| Base | `ceecbd7780c92ecf3093fc71cdd5063a130f0b59` |
| Scope | Production Diagnostics OAuth helper attestation only |

## Proposed correction

1. UX: consent copy states **Projects Read + Database Read only**.
2. Pre-store attestation stores tokens only when both succeed:
   - allowlisted `project_status` (Projects Read / `project_admin_read`);
   - bounded `catalog_relation_exists` POST read-only (Database Read / `database_read`).
3. Safe failure reports: capability name, HTTP status, platform permission — no secrets.
4. When token `scope` is present: require both `projects:read` and `database:read`; reject Write and others.

## Explicit non-goals

R-S1-01 apply · deploy · Slice 2 · Database Write · execute-sql · service-role · secrets display · broader scopes

## Required reviews

Security Guard · Architecture Guard at exact frozen head.

## Founder re-consent

Only after merge + Dashboard confirms both scopes + diagnostics worktree pinned to new main SHA.

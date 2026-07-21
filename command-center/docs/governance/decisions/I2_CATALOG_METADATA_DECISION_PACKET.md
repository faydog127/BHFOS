# Decision Packet — I2 Catalog-Metadata Capability

> Requests Founder merge authorization after Security + Architecture review.
> Does **not** apply R-S1-01, deploy, begin Slice 2, or expand OAuth scopes by itself.

| Field | Value |
| --- | --- |
| Release ID | `I2-CATALOG-METADATA` |
| Risk tier | Tier 2 (diagnostics capability; money_state consumers later) |
| Base | `3283191adbca325844c204a650015d95017d09ef` |
| Scope | Production Diagnostics adapter bounded catalog-metadata |

## Proposed correction

Add allowlisted catalog operations that POST only to
`/v1/projects/{ref}/database/query/read-only` with **adapter-owned** SELECT
templates. Agent SQL, writable query endpoint, execute-sql, row browsing, and
mutations remain DENY.

## Explicit non-goals

R-S1-01 apply · deploy · Slice 2 · Stripe · secrets display · live OAuth
`database_read` re-consent (separate Founder line after merge)

## Required reviews

Security Guard · Architecture Guard at exact frozen head.

## Founder merge line (after reviews)

> Approve merge of PR #<n> at `<frozen-head>`

## After merge

1. Separate Founder auth to grant/re-consent Diagnostics OAuth `database_read` if not already present.  
2. Live verify `catalog catalog_rls_flags --schema=public --table=estimates`.  
3. Then A0 standing authority for catalog posture checks.  
4. Re-run R-S1-01 live posture → aim for `SAFE_TO_AUTHORIZE_APPLY` or correction.

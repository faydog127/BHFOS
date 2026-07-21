# R-S1-01 A0 Live Posture Check — Evidence Note

> Pilot A0 (read-only). No Founder auth requested. No apply / deploy / Slice 2.
>
> Main: `0211ca691118fc1265b1849a6e3cfab80abdc445`  
> Migration SHA-256: `385404e1986012d83a75a3bc199f3b8b266cd1fa9d4befe77789d0f27598fcb2` (match)

## Disposition

**LIVE_CHECK_UNAVAILABLE**

## Approved paths used

| Path | Result |
| --- | --- |
| I2 adapter `--self-test` | PASS (SQL/`execute-sql` paths prohibited) |
| I2 `--dry-run migration_list` | **DENY** (unavailable / partner-gated) |
| I2 live `project-health` | HTTP 200; `db`/`auth`/`rest` = `ACTIVE_HEALTHY` |
| Customer row queries | **Not performed** |
| `execute-sql` | **Not used** |
| July 10 schema dump | **Not used as apply authority** |

## Live catalog fields (required for SAFE_TO_AUTHORIZE_APPLY)

| Field | Live value |
| --- | --- |
| `public.estimates` exists | UNKNOWN |
| `relrowsecurity` | UNKNOWN |
| `relforcerowsecurity` | UNKNOWN |
| Policies | UNKNOWN |
| Grants (anon/authenticated/service_role) | UNKNOWN |
| SELECT/UPDATE expectations | UNKNOWN (live) |

## Source-only (main SHA)

- No `.insert` into `estimates` in app create path; `assertEstimatesCreateAllowed` DENY.
- Remaining `estimates` uses: SELECT / UPDATE status / admin SELECT (`send-estimate`).
- Intended migration effect (when apply authorized): INSERT DENY only for app roles — **not confirmed live** without catalog read.

## Missing capability (escalate as A3 provisioning — not Founder SQL chore)

Bounded I2 / approved **database catalog metadata** read (RLS flags, policies, grants) without row data and without `execute-sql`.

## Pilot measurements (this activity)

| Metric | Value |
| --- | --- |
| M1 Founder interruptions requested | **0** |
| M2–M5 | n/a (not slice implementation) |

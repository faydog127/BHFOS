# Network OS — Implementation Status

**Branch:** `network-os/convention-demo-fast-lane`  
**Implementation HEAD:** `6f01afaf0a6fdad1e0c34be61ede89043c46c490`  
**Parent / base:** `326e7a2941b9333f341716fff199d6ef6c913b53` (`network-os/foundation`)  
**Draft PR:** https://github.com/faydog127/BHFOS/pull/141  
**Mission:** `NOS-CONVENTION-DEMO-BUILDER-01` Fast Convention Lane  
**Product / R1 / Slice 1 activation:** **None**

## Convention demo workflow (2026-08-24) — locally verified

| Field | Value |
|---|---|
| User workflow | Sign in → `/network-os/convention` attention shell → Service needs → Contacts → Catalog |
| Data | Session tenant + query-level `is_test_data=true` on `leads` / `contacts`; related `organizations` / `accounts` / `properties` by those IDs only; `services_catalog` active rows; `crm_tasks` / `events` only when linked to loaded test IDs |
| Writes | App-level insert/update returns `DEMO_WRITE_ISOLATION_BLOCKED` unless isolated demo tenant **and** `rlsEffectiveProven` |
| Isolation proof | **Not proven on hosted.** No isolated demo tenant is declared. Hosted RLS is unproven except source-present leads JWT policies. Customer scopes (`tvg`, `default`, …) cannot authorize writes |
| Evidence tier | **locally verified** (unit tests, lint, local build, identity guards). Automatic Vercel preview created. Not staging-verified, not production-verified, not merged |

## Database objects used (existing schema only)

| Object | Operation | Scope |
|---|---|---|
| `leads` | SELECT | `tenant_id` = session, `is_test_data` = true |
| `contacts` | SELECT | `tenant_id` = session, `is_test_data` = true |
| `organizations` | SELECT | `id` IN demo contact organization IDs |
| `accounts` | SELECT | `id` IN demo IDs AND `is_test_data` = true |
| `properties` | SELECT | `id` IN demo contact/lead property IDs; no address columns |
| `services_catalog` | SELECT | `is_active` = true (`tenant_id` unproven on hosted) |
| `crm_tasks` | SELECT | `tenant_id` = session AND `lead_id` IN demo IDs |
| `events` | SELECT | `tenant_id` = session AND `entity_id` IN demo IDs; no `payload` |
| `leads` insert/update | gated | Never called unless write gate passes |

No SQL, DDL, migrations, or schema changes.

## Local verification (this lane)

| Check | Result |
|---|---|
| `npm run test:network-os-convention` | 15 pass |
| `npm run test:ml-p1-s1-helpers` | 15 pass |
| `npm run test:identity-helpers` | 8 pass |
| `npm run guard:identity` | PASSED (571 files) |
| `npx eslint` on convention files | 0 errors |
| `npm run lint` | 0 errors; 25 pre-existing warnings, none in convention files |
| `npm run build:local` | pass; emits `ConventionRoutes-7c0f9d81.js` |
| `git diff --check` | clean |
| `npm run test:supabase-oauth-helper` | ok |
| `npm run test:founder-run-readiness` | self-tests pass |
| Hosted RLS negative test | **not run** — no isolated demo tenant / hosted proof |

## Remaining blockers

- Isolated demo tenant is not independently proven
- Effective hosted RLS is not independently proven for this lane
- Writes remain `DEMO_WRITE_ISOLATION_BLOCKED`
- Release 1 / Slice 1 remains inactive
- Browser USABLE walkthrough of the preview is not claimed here

## Exact next action

Architecture/Contract Guard review of draft PR #141. Do not merge, deploy production, or activate R1/S1 from this status.

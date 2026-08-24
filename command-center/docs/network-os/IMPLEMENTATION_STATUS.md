# Network OS — Implementation Status

**Branch:** `network-os/convention-demo-fast-lane`  
**Verified HEAD at this status edit:** local worktree on `network-os/convention-demo-fast-lane` (see git)  
**Base:** `network-os/foundation` @ `326e7a2941b9333f341716fff199d6ef6c913b53`  
**Mission:** `NOS-CONVENTION-DEMO-BUILDER-01` Fast Convention Lane  
**Product / R1 / Slice 1 activation:** **None**

## Convention demo workflow (2026-08-24) — SOURCE-PRESENT / locally verified

| Field | Value |
|---|---|
| User workflow | Sign in → `/network-os/convention` attention shell → Service needs → Contacts → Catalog |
| Data | Session tenant + query-level `is_test_data=true` on `leads` / `contacts`; related `organizations` / `accounts` / `properties` by those IDs only; `services_catalog` active rows; `crm_tasks` / `events` only when linked to loaded test IDs |
| Writes | App-level insert/update returns `DEMO_WRITE_ISOLATION_BLOCKED` unless isolated demo tenant **and** `rlsEffectiveProven` |
| Isolation proof | **Not proven.** No isolated demo tenant is declared. Hosted RLS is unproven except source-present leads JWT policies. Customer scopes (`tvg`, `default`, …) cannot authorize writes |
| Evidence tier | **locally verified** (unit tests). Not deployed, not staging-verified, not production-verified |

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

## Remaining blockers

- Isolated demo tenant is not independently proven
- Effective hosted RLS is not independently proven for this lane
- Writes remain `DEMO_WRITE_ISOLATION_BLOCKED`
- Release 1 / Slice 1 remains inactive

## Exact next action

Architecture/Contract Guard review of draft PR. Do not merge, deploy production, or activate R1/S1 from this status.

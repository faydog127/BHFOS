# Sprint 001 Bugfix 01

## Trigger
Desktop UAT failure on Jobs page:
1. `Start` action returned `No job row updated`.
2. Intermittent infinite spinner until hard reload.

## Root Causes
1. Jobs updates relied on `count` from update responses; in some paths this was null/empty and falsely treated as failure.
2. Tenant guard could remain blocking if `check_is_superuser` or refresh path hung/failed before releasing `isChecking`.

## Fixes Applied
1. Jobs update paths now verify success from returned updated row (`select(...).maybeSingle()`), not `count`.
   - [Jobs.jsx](c:\BHFOS\command-center\src\pages\crm\Jobs.jsx)
2. Tenant guard now has timeout-protected checks and guaranteed `isChecking` release in `finally`.
   - [TenantGuard.jsx](c:\BHFOS\command-center\src\components\TenantGuard.jsx)

## Validation
1. `npm run build`: PASS
2. `npm run lint`: PASS (warnings only, no new errors)

## Retest Focus
1. Open `/:tenantId/crm/jobs`.
2. Click `Start` on a scheduled row and verify transition to `in_progress`.
3. Confirm page no longer blocks indefinitely on initial load.

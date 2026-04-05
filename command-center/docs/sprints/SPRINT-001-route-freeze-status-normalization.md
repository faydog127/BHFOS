# Sprint Handoff

## Sprint Metadata
1. Sprint ID: `SPRINT-001`
2. Date: `2026-03-10`
3. Owner: `Codex`
4. Scope: Route ownership freeze + job/payment status normalization (case contract)

## Goal
Freeze CRM route ownership to the canonical App route tree and remove duplicated legacy route authority while normalizing job/payment status writes to lowercase/canonical values.

## In Scope
1. Route ownership hardening (legacy route shim + canonical route manifest alignment).
2. Job/payment status normalization in core write paths and query helpers.
3. Add migration for status casing cleanup and contract checks (`NOT VALID`).

## Out of Scope
1. Full lifecycle transition enforcement service refactor.
2. Startup performance/timing refactor.
3. Billing pipeline and email pipeline unification.

## Changes Delivered
1. Canonical route list added:
   - [canonicalCrmPaths.js](c:\BHFOS\command-center\src\routes\canonicalCrmPaths.js)
2. Legacy route entry converted to shim:
   - [Crm.jsx](c:\BHFOS\command-center\src\pages\Crm.jsx)
   - [CRMRoutes.jsx](c:\BHFOS\command-center\src\components\CRMRoutes.jsx)
3. Route manifest aligned to canonical list:
   - [routeManifest.js](c:\BHFOS\command-center\src\pages\crm\routeManifest.js)
   - [BuildHealth.jsx](c:\BHFOS\command-center\src\pages\crm\BuildHealth.jsx)
   - [App.jsx](c:\BHFOS\command-center\src\App.jsx)
4. Status helper + usage normalization:
   - [jobStatus.js](c:\BHFOS\command-center\src\lib\jobStatus.js)
   - [jobService.js](c:\BHFOS\command-center\src\services\jobService.js)
   - [Jobs.jsx](c:\BHFOS\command-center\src\pages\crm\Jobs.jsx)
   - [AppointmentScheduler.jsx](c:\BHFOS\command-center\src\pages\crm\appointments\AppointmentScheduler.jsx)
   - [JobCompletion.jsx](c:\BHFOS\command-center\src\pages\crm\jobs\JobCompletion.jsx)
5. Migration added:
   - [20260310103000_normalize_jobs_status_contract.sql](c:\BHFOS\command-center\supabase\migrations\20260310103000_normalize_jobs_status_contract.sql)

## Validation Run
1. `npm run build`: PASS
2. `npm run lint`: PASS (warnings only, no errors)
3. `npm run test -- --runInBand`: FAIL (no `test` script exists in package.json)

## Acceptance Criteria Checklist
1. [x] Canonical CRM route manifest no longer depends on legacy `pages/crm/Crm.jsx`.
2. [x] Legacy `pages/Crm.jsx` no longer defines an independent route tree.
3. [x] Job status writes in touched flows are normalized to lowercase canonical values.
4. [x] Payment status writes in touched flows are normalized to lowercase canonical values.
5. [x] Migration added to normalize casing and add status/payment contract checks for new writes.

## UAT Checklist (Phone + Desktop)
1. [ ] Login to tenant and open `/:tenantId/crm/dashboard` and `/:tenantId/crm/jobs`.
2. [ ] In Jobs view, move a job to `in_progress`, then `completed`.
3. [ ] Record payment from the Jobs collection action and verify payment badge updates correctly.
4. [ ] Schedule an unscheduled/pending job and verify status remains `scheduled` after refresh.
5. [ ] Open Build Health and confirm route panel does not show old stale `/crm/...` route inventory.
6. [ ] Verify legacy URL `/crm/dashboard` still redirects correctly to tenant-scoped route.

## Risks / Assumptions
1. Existing data may include legacy statuses outside current contract list; constraints are `NOT VALID` to prevent deployment-blocking validation failures.
2. Additional status normalization may be needed in untouched modules/edge functions in later sprints.

## Rollback Plan
1. Revert touched source files listed above.
2. Drop new constraints if needed:
   - `alter table public.jobs drop constraint if exists jobs_status_contract_check;`
   - `alter table public.jobs drop constraint if exists jobs_payment_status_contract_check;`
3. Revert status normalization data changes via targeted SQL backup/restore if required.

## Recommendation
1. Go/No-Go: `GO TO UAT`
2. Reason: Build/lint gates pass and changes are scoped to route authority + status normalization with compatibility safeguards.


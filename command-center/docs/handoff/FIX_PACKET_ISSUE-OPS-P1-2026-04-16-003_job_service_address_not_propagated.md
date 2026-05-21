# Fix Packet — ISSUE-OPS-P1-2026-04-16-003 (Work order scheduling missing service address)

## 1) Issue ID
- ID: ISSUE-OPS-P1-2026-04-16-003
- Links:
  - Founder screenshot: Schedule Work Order modal shows blank “Service Address *” while scheduling `WO-2026-0001` (LOCAL).

## 2) Title
- Job/work order `service_address` not populated on quote acceptance; scheduling UI cannot prefill address

## 3) Severity
- P1 (operations friction/blocker: scheduling requires address; dispatch hygiene degraded)

## 4) Environment
- Observed: LOCAL
- Risk: likely impacts PROD unless job creation path already sets `jobs.service_address`

## 5) Layer(s)
- Data Truth (quote→job trigger writes)
- CRM Control (Work Orders scheduling modal prefill)
- Reconciliation (quote/lead/property → job address continuity)

## 6) Root cause
- Canonical quote→job trigger (`public.ensure_job_and_optional_draft_invoice_for_accepted_quote()`) inserts into `public.jobs` without setting `service_address`.
- The Work Orders scheduling modal (`src/pages/crm/Jobs.jsx`) only prefills from `job.service_address`; it does not look up the lead property address.

## 7) Evidence
- Runtime symptom:
  - Schedule Work Order modal shows blank “Service Address *” even though this is the job being scheduled.
- Repo evidence:
  - Trigger function: `supabase/migrations/20260416043000_remove_estimate_id_from_quote_job_trigger.sql` inserts `public.jobs (...)` without `service_address`.
  - UI uses `setScheduleAddress(job.service_address || '')`: `src/pages/crm/Jobs.jsx`.

## 8) Scope boundary
- IN SCOPE:
  - Populate `jobs.service_address` during quote acceptance/paid transitions using available data.
  - Keep the address as a plain string (existing contract).
- OUT OF SCOPE:
  - Rebuild lead/property/address data model.
  - UI redesign of scheduling.

## 9) Exact files/functions/tables affected
- DB function (migration override):
  - `public.ensure_job_and_optional_draft_invoice_for_accepted_quote()`
- Tables:
  - `public.jobs.service_address`
  - `public.quotes.service_address` (if present)
  - `public.leads.property_id` + `public.properties` (fallback address source)
- UI (unchanged, but depends on job field):
  - `src/pages/crm/Jobs.jsx`

## 10) Proposed change
- Add a forward migration that:
  1. Resolves `service_address` from:
     - `quotes.service_address` if present/non-empty
     - else `leads.property_id → properties` (address1/address2/city/state/zip)
  2. Writes `service_address` on job insert.
  3. On `ON CONFLICT (quote_id)`, backfills `jobs.service_address` if currently null/blank.
- Add a second migration to backfill existing jobs missing `service_address` (one-time data correction).

## 11) Risks
- Low risk (additive write to a nullable text field).
- If lead/property address is incomplete, `service_address` remains null and the UI will still require manual entry (expected).

## 12) Validation steps
- LOCAL:
  1. Create a lead with property address (or ensure quote has `service_address`).
  2. Accept/approve quote.
  3. Confirm `public.jobs.service_address` is populated.
  4. Open Work Orders → Schedule modal; confirm address is prefilled.
  5. Run `scripts/runtime/rvh-p1-c-scheduling-chain.ps1` and confirm it no longer fails address validation when scheduling.

## 13) Rollback plan
- Roll back by restoring the prior function body via a migration (or revert this migration and re-apply).

## 14) Status
- Current: Implemented (LOCAL)
- Evidence:
  - Local DB now has `0` jobs with missing/blank `service_address` after backfill.

## 15) Owner
- Owner: Erron
- Reviewer: Erron
- Date opened: 2026-04-16
- Date closed:

# Fix Packet — ISSUE-OPS-P1-2026-04-16-004 (Work Order v1 Functional Redesign)

## 1) Issue ID
- ID: ISSUE-OPS-P1-2026-04-16-004
- Links:
  - Template: `docs/handoff/FIX_PACKET_TEMPLATE.md`
  - Related packets:
    - Address propagation (LOCAL): `docs/handoff/FIX_PACKET_ISSUE-OPS-P1-2026-04-16-003_job_service_address_not_propagated.md`
    - Local invoice/runtime blockers: `docs/handoff/FIX_PACKET_ISSUE-OPS-P1-2026-04-16-002_local_invoice_screen_runtime_failures.md`
  - RVH chains referenced:
    - `scripts/runtime/rvh-p1-b-quote-job-dispatch.ps1`
    - `scripts/runtime/rvh-p1-c-scheduling-chain.ps1`
    - `scripts/runtime/rvh-p1-d-job-scheduling.ps1`

## 2) Title
- Short title: Work Order v1 contract + gap map + smallest safe remediation plan

## 3) Severity
- P1 (operations blocked / degraded: work orders are missing required execution data, are hard to use in the field, and scheduling/dispatch consistency is fragile)

## 4) Environment
- Affected: MULTI (LOCAL + PROD observed behavior divergence is likely until v1 contract is implemented + drift addressed)
- Target for fix + validation: LOCAL → (no staging) → PROD (controlled)

## 5) Layer(s)
- Data Truth (Supabase schema/migrations/RLS)
- CRM Control (app routes/UI/service layer)
- Integrations (Calendar scheduling surfaces; invoice/payment coupling where relevant)
- Reconciliation (dispatch board depends on operational projection view)

## 6) Root cause
- The repo currently treats “Work Orders” as “Jobs” with a small scheduling/payment snapshot, but there is no locked, end-to-end Work Order definition that includes the minimum execution data the field needs. As a result, UI/screens and DB contracts are inconsistent, and multiple scheduling surfaces exist without a single “source-of-truth” contract.
- Classification (schema-related only):
  - Mixed:
    - B) Code drift: code references fields/routes that are not provably present in `supabase/migrations/` (example: `technician_notes` usage in `src/pages/crm/jobs/JobCompletion.jsx` with no matching migration found).
    - A) DB drift: NOT VERIFIED in this packet (requires PROD schema dump confirmation per ULSIA).

## 7) Evidence
- Runtime error text (exact):
  - NOT PROVIDED in this packet (packet is contract + gap map). See local runtime evidence referenced by related packets and founder screenshots.
- Where observed (URL/screen/endpoint):
  - Work Orders UI (local): `/tvg/crm/jobs` (Work Order Record + Schedule modal)
  - Dispatch board (local): `/tvg/crm/dispatch` (implemented by `src/pages/crm/Schedule.jsx`)
- Repro steps (smallest):
  1. Approve a quote → creates a job/work order.
  2. Open Work Orders → open Work Order Record.
  3. Attempt to schedule/dispatch → observe required execution fields are either missing, weak, or scattered across screens.
- Repo evidence (file path + key references):
  - Work Orders manager + Record modal + Schedule modal: `src/pages/crm/Jobs.jsx`
    - Record fields present: status, payment terms, scheduled_start, technician, service_address, total_amount (see “Work Order Record” dialog).
    - Schedule modal only prefills address from `job.service_address` (see `openScheduleModal` + `setScheduleAddress(job.service_address || '')`).
  - Dispatch board depends on operational projection view and has its own schedule editor: `src/pages/crm/Schedule.jsx`
    - Data: `workOrderBoardService.fetchWorkOrders` (same service as Work Orders list).
  - Board data source: `src/services/workOrderBoardService.js` selects from `job_operational_state_v1`, falls back to `jobs` if the view is missing.
  - Operational projection view: `supabase/migrations/20260314113000_add_work_order_operational_projection.sql` creates `public.job_operational_state_v1`.
  - Work order numbering + jobs scheduling fields: `supabase/migrations/20260225201000_add_work_order_sequence_and_job_fields.sql` adds `work_order_number`, `scheduled_start/end`, `technician_id`, `service_address`, `access_notes`, etc + `public.next_work_order_number(...)`.
  - Status contract guardrails: `supabase/migrations/20260310103000_normalize_jobs_status_contract.sql` adds `jobs_status_contract_check` + `jobs_payment_status_contract_check` (NOT VALID).
  - Scheduling writes go through edge function: `supabase/functions/work-order-update/index.ts` (enforces dispatchable address + scheduled_start for dispatchable statuses).
  - Address propagation into `jobs.service_address` (LOCAL): `supabase/migrations/20260416210000_backfill_job_service_address_on_quote_accept.sql` + `supabase/migrations/20260416213000_backfill_existing_jobs_service_address.sql`.
- DB evidence:
  - Canonical schema source-of-truth: `supabase/migrations/`
  - Primary tables/views in play:
    - `public.jobs` (work order record)
    - `public.job_operational_state_v1` (dispatch board projection)
- RVH artifacts (if used):
  - NOT ATTACHED to this packet (must be attached when execution begins).
- Notes on redaction (tokens/PII removed): YES

## 8) Scope boundary
- IN SCOPE:
  - Lock a Work Order v1 contract (definition + required execution data).
  - Map current repo schema/UI to that contract (EXISTS/WEAK/MISSING).
  - Propose smallest safe, additive remediation packets (DB + edge function + UI touch points).
  - Define rollout shape (LOCAL → PROD) + RVH validations to run.
- OUT OF SCOPE:
  - UI redesign / mockups / “make it pretty”.
  - Re-architecting estimates vs quotes (tracked separately; only a contract dependency here).
  - Rebuilding dispatch/calendar architecture or adding new scheduling engines.
  - Report automation system redesign (only define v1 hooks/outputs).
- Explicit “do not touch” list:
  - Deploy scripts
  - Unrelated modules (marketing, partners, unrelated diagnostics)
  - Do not introduce `dispatch_id` (technician assignment must use `technicians.user_id` only)
  - Do not let UI write fields that do not exist in `supabase/migrations/`
  - Do not make `job_number` the primary work order ID when `work_order_number` exists

## 9) Exact files/functions/tables affected
- Files (current state evidence / likely touch points):
  - `src/pages/crm/Jobs.jsx` (Work Orders list + record modal + schedule modal)
  - `src/pages/crm/Schedule.jsx` (Dispatch board UI; depends on operational projection)
  - `src/services/workOrderBoardService.js` (board query; view fallback)
  - `src/services/jobService.js` (invokes edge functions; local fallback update)
  - `src/pages/crm/jobs/JobCompletion.jsx` (exists, but NOT VERIFIED wired into routing)
- Edge functions:
  - `supabase/functions/work-order-update/index.ts` (scheduling/status transitions + conflict checks + invoice/payment coupling)
  - (Indirect, for money loop coupling) `supabase/functions/invoice-update-status/index.ts` (invoked by `jobService.recordPayment`) — exact file NOT VERIFIED in this packet.
- Tables/views/RPCs (canonical from migrations):
  - `public.jobs`
  - `public.work_order_sequences`
  - `public.job_operational_state_v1`
  - `public.next_work_order_number(text, timestamptz)`
  - Related: `public.leads`, `public.properties`, `public.contacts`, `public.quotes`, `public.invoices`

## 10) Proposed change

### Guardrails (LOCKED)
1. Technician assignment:
   - Canonical key: `jobs.technician_id -> technicians.user_id`
   - Do not use `dispatch_id`
2. Schema/UI integrity:
   - If a field is in UI, it must exist in canonical migrations first
3. Work order identity:
   - Canonical display ID: `work_order_number`
   - `job_number` stays legacy/internal only

### Prerequisite packets (must land before heavy UI work)
- Packet A: Work Order v1 fields (schema first)
  - `docs/handoff/FIX_PACKET_ISSUE-OPS-P1-2026-04-16-006_work_order_v1_job_fields_addition.md`
- Packet B: Technician ID contract unification
  - `docs/handoff/FIX_PACKET_ISSUE-OPS-P1-2026-04-16-005_technician_id_contract_unification.md`
- Packet C: Work order identity consistency
  - `docs/handoff/FIX_PACKET_ISSUE-OPS-P1-2026-04-16-007_work_order_identity_consistency.md`
- Packet D: Dispatch readiness invariant
  - `docs/handoff/FIX_PACKET_ISSUE-OPS-P1-2026-04-16-009_dispatch_readiness_invariant.md`
- Packet E: Scheduling source-of-truth contract
  - `docs/handoff/FIX_PACKET_ISSUE-OPS-P1-2026-04-16-008_scheduling_source_of_truth_contract.md`
- Packet F: Schema/UI drift cleanup (stop phantom fields)
  - `docs/handoff/FIX_PACKET_ISSUE-OPS-P1-2026-04-16-010_schema_ui_drift_cleanup_work_orders.md`

### Work Order v1 contract (FULL)
This is the required v1 structure. Each section lists **must-have now** fields (v1) and optional **later** expansions.

1) **Job Overview**
   - Must-have now:
     - Work order identifier: `jobs.work_order_number` (canonical display ID)
     - Job status: `jobs.status` (see status contract migration)
     - Payment status: `jobs.payment_status`
     - Customer: `leads.first_name/last_name`, `leads.phone`, `leads.email`
     - Service type label: `leads.service` (fallback) and/or `jobs.scope_summary` (if added)
   - Later:
     - Dedicated `job_number` retirement plan and legacy mapping policy

2) **Access & Arrival**
   - Must-have now:
     - Full dispatchable address: `jobs.service_address` (street + city + state)
     - Access notes/instructions: `jobs.access_notes`
     - Scheduled start/end: `jobs.scheduled_start`, `jobs.scheduled_end`
     - Technician assignment: `jobs.technician_id` (optional allowed, but v1 should support it)
   - Later:
     - Gate codes, lockbox, arrival window, on-site contact override

3) **Job Scope**
   - Must-have now:
     - Scope summary (short): **NEW (proposal)** `jobs.scope_summary` (text) OR store in `jobs.access_notes` if forced (not preferred)
     - Special conditions (short): **NEW (proposal)** `jobs.special_conditions` (text)
   - Later:
     - Structured line-items at the job level (if required beyond quote/invoice items)

4) **Property & System Info**
   - Must-have now:
     - Property address is already covered by `jobs.service_address` (v1 minimum)
     - Property notes: **NEW (proposal)** `jobs.property_notes` (text)
   - Later:
     - Dedicated property link from job (`jobs.property_id`) if/when needed (NOT PROPOSED for v1 unless proven necessary)
     - System details (dryer location, HVAC notes, etc.)

5) **Execution Plan**
   - Must-have now:
     - Checklist placeholder: **NEW (proposal)** `jobs.execution_checklist` (jsonb) OR `jobs.execution_checklist_text` (text)
   - Later:
     - Structured checklist items with timestamps + accountability

6) **Upsell Opportunities**
   - Must-have now:
     - Placeholder notes only: **NEW (proposal)** `jobs.upsell_notes` (text)
   - Later:
     - Catalog-driven upsell engine

7) **Execution Capture**
   - Must-have now:
     - Findings/observations: **NEW (proposal)** `jobs.execution_findings` (jsonb array of strings) OR `jobs.execution_findings_text` (text)
     - Photo placeholders: **NEW (proposal)** `jobs.execution_photos` (jsonb) (store references/URLs only)
   - Later:
     - Real media upload pipeline + structured measurements

8) **Completion**
   - Must-have now:
     - Completion notes: **NEW (proposal)** `jobs.technician_notes` (text) (aligns with existing UI usage)
     - Completed timestamp: `jobs.completed_at` (already migrated)
     - Status transition: `completed`
   - Later:
     - Customer signature, QA checklist, internal review

9) **Report Output**
   - Must-have now:
     - Report link reference (if produced): **NEW (proposal)** `jobs.report_url` (text) OR `jobs.report_ref` (text)
   - Later:
     - Full report generation automation + Drive persistence linkage

10) **Follow-Up Triggers**
   - Must-have now:
     - Follow-up required flag: **NEW (proposal)** `jobs.follow_up_required` (boolean)
     - Follow-up notes: **NEW (proposal)** `jobs.follow_up_notes` (text)
   - Later:
     - Auto-create `public.crm_tasks` from rule triggers (overdue, missing data, post-service)

### Current system mapped to contract (EXISTS / WEAK / MISSING)
Status legend:
- EXISTS = present in schema + surfaced in UI/service paths
- WEAK = partially present (missing required constraints, not surfaced, inconsistent, or not reliably populated)
- MISSING = not present (or not provable from migrations) and/or not wired into UI/service paths

1) Job Overview — **EXISTS**
   - Evidence:
     - UI record modal shows work order label, status, payment status, customer identity: `src/pages/crm/Jobs.jsx`
     - Schema has `jobs.work_order_number`, `jobs.status`, `jobs.payment_status`: `supabase/migrations/20260225201000_add_work_order_sequence_and_job_fields.sql` + `supabase/migrations/20260310103000_normalize_jobs_status_contract.sql`
   - Notes:
     - Work order label is derived from `work_order_number` then `job_number` fallback: `src/pages/crm/Jobs.jsx` and `src/pages/crm/Schedule.jsx` (potential mismatch if legacy data exists).

2) Access & Arrival — **WEAK**
   - Evidence:
     - Scheduling modal requires manual address and only prefills from `job.service_address`: `src/pages/crm/Jobs.jsx`
     - Dispatchable address enforcement + scheduled_start enforcement for dispatch statuses: `supabase/functions/work-order-update/index.ts`
     - Address backfill landed (LOCAL): `supabase/migrations/20260416210000_backfill_job_service_address_on_quote_accept.sql` + `supabase/migrations/20260416213000_backfill_existing_jobs_service_address.sql`
   - Notes:
     - Multiple scheduling surfaces exist (Work Orders modal + Dispatch board editor + Calendar), which creates operator confusion (contract needs “one booking engine” rule).

3) Job Scope — **MISSING (NOT VERIFIED as explicit work order fields)**
   - Evidence:
     - No `jobs.scope_summary` column is defined in `supabase/migrations/` (search required if added later).
     - Dispatch UI *attempts* to use `job.scope_summary` (fallbacks to lead.service): `src/pages/crm/Schedule.jsx`
   - Runtime evidence required:
     - Confirm whether PROD has an out-of-band column (DB drift) via schema dump (ULSIA artifact).

4) Property & System Info — **MISSING**
   - Evidence:
     - Jobs schema includes `service_address` only; no property/system fields beyond that in migrations: `supabase/migrations/20260101_create_money_loop_core_tables.sql` + `20260225201000...`
     - No work-order UI sections for property/system info: `src/pages/crm/Jobs.jsx`

5) Execution Plan — **MISSING**
   - Evidence:
     - No checklist fields/tables in migrations for jobs (v1 plan data): `supabase/migrations/` (no canonical checklist schema found)
     - No checklist UI in Work Orders record modal: `src/pages/crm/Jobs.jsx`

6) Upsell Opportunities — **MISSING**
   - Evidence:
     - No upsell fields surfaced in Work Orders UI: `src/pages/crm/Jobs.jsx`

7) Execution Capture — **WEAK / NOT VERIFIED**
   - Evidence:
     - A “JobCompletion” UI exists with findings/notes/photos placeholders: `src/pages/crm/jobs/JobCompletion.jsx`
     - That screen is NOT VERIFIED wired into routing (no route reference found in `src/App.jsx`).
   - Runtime evidence required:
     - Confirm if any field execution capture persists to DB (migrations do not define `technician_notes`; see Completion section below).

8) Completion — **WEAK**
   - Evidence:
     - `jobs.completed_at` exists: `supabase/migrations/20260314090000_add_jobs_completed_at.sql`
     - Completion notes used by UI: `src/pages/crm/jobs/JobCompletion.jsx` reads `data.technician_notes`
     - BUT `technician_notes` is NOT VERIFIED present in migrations (code drift risk).

9) Report Output — **MISSING / NOT VERIFIED**
   - Evidence:
     - Work Orders UI does not link/store report output: `src/pages/crm/Jobs.jsx`
     - Some report email template exists (hygiene report): `src/pages/crm/jobs/JobCompletion.jsx` references `src/templates/HygieneReportTemplateV2` (template existence does not prove pipeline).
   - Runtime evidence required:
     - Identify where reports are persisted (Drive / DB) and how they are referenced from jobs/invoices.

10) Follow-Up Triggers — **WEAK**
   - Evidence:
     - `public.crm_tasks` exists in schema: `supabase/migrations/20260101_create_money_loop_core_tables.sql`
     - Dispatch due/overdue operational timing exists via `job_operational_state_v1`: `supabase/migrations/20260314113000_add_work_order_operational_projection.sql`
   - Notes:
     - No explicit “follow_up_required” fields or UI controls exist (must be introduced for v1).

### Must-have now vs later (founder split)
- Must-have now (v1):
  - customer contact
  - full address
  - date/time
  - technician
  - service type
  - scope summary
  - special conditions
  - access instructions
  - checklist
  - photo capture placeholders
  - completion notes
  - follow-up flag
- Later:
  - advanced upsell engine
  - vendor workflow automation
  - signature capture
  - customer-facing portal
  - rich reporting automation

### Smallest safe remediation packets (PROPOSAL ONLY)
These are intentionally additive and staged so we don’t break production.

Packet A — **Data contract for Work Order v1 (DB-only, additive)**
- New migrations (proposal):
  - Add columns to `public.jobs`:
    - `scope_summary text` (or `service_scope_summary text` if naming conflicts exist)
    - `special_conditions text`
    - `property_notes text`
    - `execution_checklist jsonb`
    - `execution_findings jsonb`
    - `execution_photos jsonb`
    - `technician_notes text` (align with existing UI usage)
    - `report_url text`
    - `follow_up_required boolean not null default false`
    - `follow_up_notes text`
- Keep constraints soft first (NOT VALID or enforced in edge function), then tighten after data backfill.
- Evidence dependencies:
  - Jobs table exists + prior WO fields: `supabase/migrations/20260101_create_money_loop_core_tables.sql` + `20260225201000...`

Packet B — **Edge function update for v1 fields (controlled write-surface)**
- Update `supabase/functions/work-order-update/index.ts` to:
  - accept and persist new v1 fields (pass-through patch) (exact changes depend on current `buildPatch` implementation; NOT VERIFIED in this packet)
  - enforce only the existing dispatch safety gates (scheduled_start + dispatchable address) and avoid new strictness until UI is updated

Packet C — **UI capture (no redesign; additive fields only)**
- Touch points:
  - `src/pages/crm/Jobs.jsx`: extend “Work Order Record” dialog to include:
    - scope summary + special conditions
    - access instructions (reuse `access_notes`)
    - checklist placeholder (textarea or simple list editor)
    - follow-up required + notes
  - `src/pages/crm/Schedule.jsx`: ensure it displays scope label consistently (prefer `scope_summary`, fallback to `leads.service`)
- Guardrail:
  - No layout redesign; add fields under existing record modal in clearly labeled blocks.

Packet D — **Completion wiring (minimal)**
- Decide ONE minimal completion path:
  - Either add a route + link to `src/pages/crm/jobs/JobCompletion.jsx`, OR embed completion notes in existing record modal.
- Persist completion notes (`technician_notes`) + ensure `completed_at` is set.
- Defer report emailing/receipt automation unless required for v1 operations.

### Migration plan (if any)
- New migration filename(s): TBD (create when packet is approved).
- Why migration is warranted:
  - v1 requires fields that do not exist in canonical schema today (per `supabase/migrations/`), and UI already expects some of them (e.g., `technician_notes`, `scope_summary`) → codify to stop drift.

### Configuration/env changes (if any)
- None required for v1 contract fields (email/report automation may require env, but is explicitly “later” unless forced).

## 11) Risks
- Primary risk:
  - Adding columns is low risk; the bigger risk is inconsistent meaning across screens (multiple scheduling surfaces + legacy identifier fallbacks) unless we lock the contract and update UI consistently.
- Side effects:
  - Dispatch board depends on `job_operational_state_v1`; adding columns does not change the view unless we modify it (not proposed for v1).
- Data integrity concerns:
  - If v1 fields are introduced without backfill defaults, older jobs may appear “missing required fields” (handle with soft gating + gradual enforcement).
- Security/RLS concerns:
  - Work-order writes go through edge function; ensure new fields do not open anonymous write paths. Any public surfaces must remain read-only unless explicitly designed.

## 12) Validation steps
- Preflight gates:
  - `pwsh -NoProfile -File scripts/runtime/assert-env-safe.ps1`
- Automated checks (LOCAL):
  - `pwsh -NoProfile -File scripts/runtime/rvh-p1-b-quote-job-dispatch.ps1` (job creation + dispatch visibility)
  - `pwsh -NoProfile -File scripts/runtime/rvh-p1-c-scheduling-chain.ps1` (scheduling + board consistency)
  - `pwsh -NoProfile -File scripts/runtime/rvh-p1-d-job-scheduling.ps1` (job scheduling updates + enforcement)
- Manual checks (only if necessary):
  - Use Work Order v1 checklist references in `docs/runtime-validation/manual-checklists.md` (if/when populated)
- DB assertions (examples; exact SQL to be finalized when columns exist):
  - `select work_order_number, status, scheduled_start, service_address, technician_id from public.jobs where id = <job_id>;` (fields present and consistent)

## 13) Rollback plan
- Code rollback:
  - Revert the UI/edge function patches that add v1 fields (keep old behavior).
- DB rollback:
  - Compensating migration to remove added columns is possible but not preferred; instead leave columns unused if rollback is needed.
- Operational rollback:
  - Keep enforcement gates limited to existing dispatch safety checks until v1 is stable.

## 14) Status
- Current: Proposed (contract + gap map complete; no code changes in this packet)
- Blockers (if any):
  - None to write this plan; execution will require confirming drift vs migrations for any fields already present in PROD.
- Next action:
  1. Approve Packet A (schema) + Packet C (UI capture) as the initial v1 slice.
  2. Implement locally behind RVH validation.
  3. Only then plan PROD rollout under controlled window.

## 15) Owner
- Owner: Erron
- Reviewer: Erron
- Date opened: 2026-04-16
- Date closed:

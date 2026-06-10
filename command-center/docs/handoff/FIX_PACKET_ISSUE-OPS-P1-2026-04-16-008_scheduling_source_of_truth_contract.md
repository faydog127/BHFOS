# Fix Packet — ISSUE-OPS-P1-2026-04-16-008 (Scheduling source-of-truth contract)

## 1) Issue ID
- ID: ISSUE-OPS-P1-2026-04-16-008
- Links:
  - Technician contract (prereq): `docs/handoff/FIX_PACKET_ISSUE-OPS-P1-2026-04-16-005_technician_id_contract_unification.md`
  - Work Order v1 packet: `docs/handoff/FIX_PACKET_ISSUE-OPS-P1-2026-04-16-004_work_order_v1_functional_redesign.md`

## 2) Title
- Choose one authoritative scheduler record and define the mirror rule (`appointments` vs `jobs.scheduled_*`)

## 3) Severity
- P1 (operations integrity: two independent schedulers cause drift and “where is the real schedule?” failures)

## 4) Environment
- Target: LOCAL first (then controlled PROD rollout later)

## 5) Layer(s)
- Data Truth (schema contracts)
- CRM Control (Work Orders + Dispatch scheduling surfaces)
- Integrations (edge functions + RVH)

## 6) Decision (contract)
- Scheduling source-of-truth: `public.appointments`
- Operational mirror: `public.jobs.scheduled_start/scheduled_end/service_address/technician_id`

## 7) Mirror rule
- If `appointments.job_id` is set:
  - `appointments` is authoritative.
  - On appointment insert/update, mirror schedule fields onto the linked `jobs` row.
- `jobs` remains the execution surface (dispatch board, work-order operational view), but it must stay consistent with `appointments`.

## 8) Authoritative create/update path
- Calendar/booking path:
  - `supabase/functions/create-appointment`
  - `supabase/functions/update-appointment-status`
- Work-order scheduling path (Work Orders + Dispatch):
  - `supabase/functions/work-order-update` MUST upsert a linked appointment (with `job_id`) whenever a work order is scheduled/updated.

## 9) Who writes schedule / who reads schedule
- Writes:
  - Edge functions only (no direct UI writes to tables).
  - Scheduling screens call `work-order-update`, which becomes the single write entrypoint for work-order scheduling.
- Reads:
  - Calendar reads `appointments`.
  - Dispatch/Work Orders read `jobs` / `job_operational_state_v1` (mirror).

## 10) Exact files/functions/tables affected
- Migrations:
  - (new) add `appointments.job_id` + sync trigger
- Tables:
  - `public.appointments` (add `job_id`, define uniqueness, sync trigger)
  - `public.jobs` (mirror target only)
- Edge functions:
  - `supabase/functions/work-order-update/index.ts` (upsert appointment + conflict check source)
- Scripts:
  - `scripts/runtime/rvh-p1-d-job-scheduling.ps1` (should assert appointment mirror exists)

## 11) Proposed change (smallest safe)
1. Schema:
   - Add `appointments.job_id uuid references jobs(id) on delete set null`
   - Enforce at most one appointment per job (`unique(job_id)`)
   - Add trigger: when `appointments.job_id` is set, mirror schedule fields into `jobs`
2. Edge:
   - Change conflict checks to query `appointments` (authoritative) instead of `jobs`
   - When a job is scheduled via `work-order-update`, upsert `appointments` row keyed by `job_id` and set `reminders_enabled=false` by default (avoid side effects)

## 12) Risks
- Without a staging environment, this must be LOCAL-proven and then rolled out to PROD with tight guardrails.
- If any legacy path still writes `jobs.scheduled_*` directly (bypassing edge), drift is still possible (must be removed/blocked over time).

## 13) Validation steps
- LOCAL:
  - `scripts/runtime/rvh-p1-d-job-scheduling.ps1` must pass and assert:
    - job scheduled
    - linked appointment exists for `appointments.job_id = jobs.id`
  - `scripts/runtime/rvh-p1-c-scheduling-chain.ps1` still passes (booking/calendar unaffected)

## 14) Rollback plan
- Schema:
  - Drop trigger + constraint; keep column if needed (low risk)
- Edge:
  - Revert `work-order-update` changes

## 15) Status
- Current: LOCAL validated
- Evidence (LOCAL):
  - Migration: `supabase/migrations/20260416224500_packet_008_appointments_job_link_and_sync.sql`
  - RVH-P1-D: `rvh_p1-d_20260416_210829_562b99` (artifacts: `tmp/runtime/2026-04-16/local/rvh_p1-d_20260416_210829_562b99`)
  - RVH-P1-C: `rvh_p1-c_20260416_210851_a6f2f1` (artifacts: `tmp/runtime/2026-04-16/local/rvh_p1-c_20260416_210851_a6f2f1`)
- Next action:
  - Proceed to Packet 006 only if you accept this contract (appointments authoritative; jobs mirror).

## 16) Owner
- Owner: Erron
- Reviewer: Erron
- Date opened: 2026-04-16
- Date closed:

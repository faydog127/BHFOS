# Fix Packet — ISSUE-OPS-P1-2026-04-16-009 (Dispatch readiness invariant)

## 1) Issue ID
- ID: ISSUE-OPS-P1-2026-04-16-009
- Links:
  - Work Order v1 packet: `docs/handoff/FIX_PACKET_ISSUE-OPS-P1-2026-04-16-004_work_order_v1_functional_redesign.md`
  - Technician contract: `docs/handoff/FIX_PACKET_ISSUE-OPS-P1-2026-04-16-005_technician_id_contract_unification.md`
  - Scheduling SoT: `docs/handoff/FIX_PACKET_ISSUE-OPS-P1-2026-04-16-008_scheduling_source_of_truth_contract.md`

## 2) Title
- Centralize “dispatchable” readiness: address + scheduled_start/end + technician assignment

## 3) Severity
- P1 (operations: jobs can be marked scheduled/dispatchable while missing required execution data)

## 4) Environment
- Affected: MULTI (LOCAL + PROD drift risk)
- Target: LOCAL first → PROD (controlled rollout)

## 5) Layer(s)
- CRM Control (Dispatch + Work Orders)
- Integrations (edge enforcement + appointment→job mirror trigger)

## 6) Root cause
- The system has multiple write paths that can result in `jobs.status='scheduled'` without the full dispatchable invariant.
  - `work-order-update` enforced `scheduled_start` + address, but did not require `technician_id` or `scheduled_end`.
  - `sync_job_schedule_from_appointment()` could promote `jobs.status='scheduled'` on appointment `confirmed/rescheduled` without checking readiness.

## 7) Evidence
- Edge readiness checks: `supabase/functions/work-order-update/index.ts`
- Appointment→job mirroring trigger (Packet 008): `supabase/migrations/20260416224500_packet_008_appointments_job_link_and_sync.sql`
- RVH updated to assert missing-tech scheduling is rejected: `scripts/runtime/rvh-p1-d-job-scheduling.ps1`
- LOCAL RVH proof (PASS): `rvh_p1-d_20260416_232031_eff394` (artifacts under `tmp/runtime/2026-04-16/local/rvh_p1-d_20260416_232031_eff394/`)

## 8) Scope boundary
- IN SCOPE:
  - Define one invariant and enforce it centrally in the edge write path.
  - Tighten appointment→job status promotion so DB doesn’t mark jobs scheduled when not dispatchable.
  - Keep UI changes out of this packet (UI will naturally surface edge errors).
- OUT OF SCOPE:
  - Dispatch redesign or Work Order UI redesign.

## 9) Exact files/functions/tables affected
- Edge functions:
  - `supabase/functions/work-order-update/index.ts`
- Local fallback (only used when local edge auth fails):
  - `src/services/jobService.js`
- DB:
  - `public.sync_job_schedule_from_appointment()` (updated via new migration)
  - `public.jobs`, `public.appointments`
- RVH:
  - `scripts/runtime/rvh-p1-d-job-scheduling.ps1`

## 10) Proposed change
- Invariant (locked, v1):
  - If `status` is set to `scheduled`, `en_route`, or `in_progress`, then the job MUST have:
    - dispatchable `service_address`
    - `scheduled_start`
    - `scheduled_end`
    - assigned `technician_id` (canonical = `technicians.user_id`)
- Enforcement plan (LOCAL first):
  1. Edge: `work-order-update` returns HTTP 400 with a clear error if invariant not met.
  2. DB: `sync_job_schedule_from_appointment()` only promotes `jobs.status='scheduled'` when the appointment row is dispatch-ready.
  3. RVH: add a negative case proving scheduling without technician is rejected.

## 11) Risks
- Enforcing technician assignment at `scheduled` blocks “schedule first, assign later” behavior. This is intentional per the locked scheduling contract (Packet 008).

## 12) Validation steps
- RVH (LOCAL):
  - `supabase db reset --yes`
  - `pwsh -NoProfile -File scripts/runtime/rvh-p1-d-job-scheduling.ps1 -SkipStart -BestEffortCleanup`
  - Confirm:
    - missing-tech scheduling returns 400 + Technician error
    - normal scheduling succeeds and creates/updates appointment mirror

## 13) Rollback plan
- Revert edge readiness checks and revert `sync_job_schedule_from_appointment()` body via a new migration (do not edit old migrations).

## 14) Status
- Current: LOCAL validated (RVH PASS)

## 15) Owner
- Owner: Erron
- Reviewer: Erron
- Date opened: 2026-04-16
- Date closed:

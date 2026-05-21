# Fix Packet — ISSUE-OPS-P1-2026-04-16-005 (Technician ID contract unification: Jobs ↔ Dispatch ↔ Edge)

## 1) Issue ID
- ID: ISSUE-OPS-P1-2026-04-16-005
- Links:
  - Work Order v1 packet: `docs/handoff/FIX_PACKET_ISSUE-OPS-P1-2026-04-16-004_work_order_v1_functional_redesign.md`

## 2) Title
- Unify technician assignment to one key: `jobs.technician_id = technicians.user_id` (no `dispatch_id`)

## 3) Severity
- P1 (operations integrity: technician assignment + scheduling conflict checks can silently drift between screens)

## 4) Environment
- Affected: MULTI (observed in LOCAL; likely in PROD if legacy data exists)
- Target for fix + validation: LOCAL → PROD (controlled)

## 5) Layer(s)
- Data Truth (jobs/technicians schema)
- CRM Control (Work Orders + Dispatch UI selection)
- Integrations (edge function `work-order-update` conflict checks)

## 6) Root cause
- The CRM treats technician assignment inconsistently:
  - Work Orders UI can write `jobs.technician_id` as `technicians.user_id`.
  - Dispatch UI selection logic references `dispatch_id` (not present in canonical technicians schema).
  - Some existing data/scripts may store `jobs.technician_id` as `technicians.id`.
- This breaks the invariant “a technician assignment means the same thing everywhere”.

## 7) Evidence
- Repo evidence:
  - Canonical technicians schema (no `dispatch_id`): `supabase/migrations/20260318160000_add_technicians_table_for_dispatch.sql`
  - Work Orders writes `technician_id` using `tech.user_id`: `src/pages/crm/Jobs.jsx`
  - Dispatch selection logic considers `dispatch_id`: `src/pages/crm/Schedule.jsx`
  - Edge conflict checks filter `jobs.technician_id`: `supabase/functions/work-order-update/index.ts`
- DB evidence:
  - Canonical `jobs.technician_id` exists: `supabase/migrations/20260225201000_add_work_order_sequence_and_job_fields.sql`

## 8) Scope boundary
- IN SCOPE:
  - Make `technicians.user_id` the only assignment key.
  - Remove/stop using `dispatch_id` logic.
  - Normalize existing `jobs.technician_id` values when they match `technicians.id`.
- OUT OF SCOPE:
  - Re-architect technicians/auth model.
  - Add new scheduling features.

## 9) Exact files/functions/tables affected
- Files:
  - `src/pages/crm/Schedule.jsx`
  - `src/pages/crm/Jobs.jsx`
  - `src/pages/crm/appointments/AppointmentScheduler.jsx`
  - `src/components/appointments/AppointmentBooking.jsx`
- Edge functions:
  - `supabase/functions/work-order-update/index.ts`
  - `supabase/functions/create-appointment/index.ts`
  - `supabase/functions/update-appointment-status/index.ts`
- Tables/views/RPCs:
  - `public.jobs.technician_id`
  - `public.technicians (id, user_id, full_name, ...)`
  - `public.job_operational_state_v1`
  - `public.appointments.technician_id`
 - Scripts (local validation/proof):
  - `scripts/runtime/rvh-p1-d-job-scheduling.ps1`
  - `scripts/appointment-reminder-proof.mjs`

## 10) Proposed change
- Summary:
  - `jobs.technician_id` stores `technicians.user_id` only.
  - Dispatch UI treats `jobs.technician_id` as `user_id`.
  - Appointments store technician identity as `technicians.user_id` (FK-backed for PostgREST joins).
  - Jobs/appointments currently storing `technicians.id` are migrated to `technicians.user_id` when possible.
- Patch plan:
  1. Update `src/pages/crm/Schedule.jsx`:
     - Remove `dispatch_id` from technician identity.
     - `resolveTechnicianSelection(...)` returns `entry.user_id`.
     - `getTechnicianDisplayName(...)` matches on `entry.user_id` (allow legacy read fallback on `entry.id` only).
  2. Audit `src/pages/crm/Jobs.jsx` to ensure all writes send `technician_id = technicians.user_id` (already aligned).
  3. Update appointment booking/scheduler UI to send `technician_id = technicians.user_id`.
  4. Add a one-time data correction + FK migration:
     - When `jobs.technician_id = technicians.id`, rewrite to `technicians.user_id` (when not null).
     - When `appointments.technician_id = technicians.id`, rewrite to `technicians.user_id` (when not null).
     - Switch appointments FK to `technicians(user_id)` to keep PostgREST joins valid.
- Migration plan:
  - New migration filename: `supabase/migrations/20260416220000_unify_technician_id_on_user_id.sql`
  - Why migration is warranted:
    - Prevent two different ID meanings from coexisting across environments.

## 11) Risks
- Legacy jobs with `technician_id` that cannot be mapped to a `technicians.user_id` will remain unassigned.

## 12) Validation steps
- RVH (update/add as needed):
  - RVH-WO-2 (planned): assign technician in Work Orders → verify Dispatch shows same technician.
- DB assertions:
  - `select count(*) from public.jobs j join public.technicians t on t.id = j.technician_id;` should be `0` after normalization (no rows storing technicians.id).
  - `select count(*) from public.appointments a join public.technicians t on t.id = a.technician_id;` should be `0` after normalization.
 - Local scripts:
  - `pwsh -NoProfile -File scripts/runtime/rvh-p1-d-job-scheduling.ps1 -BestEffortCleanup`

## 13) Rollback plan
- Code rollback:
  - Revert `src/pages/crm/Schedule.jsx` changes.
- DB rollback:
  - Avoid if possible; use backup if needed.

## 14) Status
- Current: LOCAL validated (RVH-P1-D passed after `supabase db reset`)
- Next action:
  - Run RVH and confirm technician selection works across Work Orders, Dispatch, and Appointments.

- Evidence (LOCAL):
  - RVH run: `rvh_p1-d_20260416_194032_89c0d5`
  - Artifacts: `tmp/runtime/2026-04-16/local/rvh_p1-d_20260416_194032_89c0d5`

## 15) Owner
- Owner: Erron
- Reviewer: Erron
- Date opened: 2026-04-16
- Date closed:

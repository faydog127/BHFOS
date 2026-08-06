# R3 — Scheduling for Operations Plan

**Branch:** `stabilize/r3-scheduling-operations`  
**Worktree:** `F:\Dev\BHFOS-stabilize-r3-scheduling`  
**Base:** `origin/main` @ `de304c15bb8b6636c8fa8b8477785190c49929c2` (R2 tip)

## Goal

Technicians can see and navigate their schedule from the phone. When a work order is linked to a calendar appointment, office users edit schedule on Calendar — not by dual-writing job times.

## Includes

| ID | Intent |
| --- | --- |
| B-005 | Mount read-only Tech Schedule with multi-day navigation |
| B-016 | Jobs + Dispatch schedule fields read-only when `appointments.job_id` links the job |

## Excludes

- Dispatch AI / route optimization  
- Work order board rewrite  
- Migrations  
- Forcing new appointment↔job links (link must already exist via Packet 008 `job_id`)

## Surfaces

| Surface | Change |
| --- | --- |
| `TechRoutes` / `TechLayout` | `/tech/schedule` route + bottom nav |
| `TechSchedule` | Tenant filter, roster identity, day scroller, View Details → job |
| `Jobs.jsx` | Linked appointment lookup; lock schedule fields; Calendar CTA |
| `Schedule.jsx` (Dispatch) | Same lock for datetime / tech / address |
| `jobAppointmentSchedule.js` | Shared linked-appointment helpers |

## Acceptance

- Tech opens Schedule and can move across days  
- Linked job schedule fields are not editable on Jobs/Dispatch  
- Unlinked jobs keep current schedule editing behavior  

## Validation

```bash
npm run test:scheduling-contracts
npm run lint
npm run build:local
```

## Production verification (after deploy)

Synthetic tech login → open Schedule → change day. Optional: linked appointment job shows locked schedule on Jobs/Dispatch.

## R3B follow-up — appointment trigger enum safety

| Field | Value |
| --- | --- |
| Status | Migration opened (not merged/deployed in this planning step) |
| Symptom | Production cannot write `appointments.job_id` or `appointments.technician_id` |
| Error | `invalid input value for enum appointment_status: ""` |
| Cause | `appointments_prevent_overlap` + `sync_job_schedule_from_appointment` used `coalesce(status, '')` against enum `appointment_status` |
| Repair | `20260716003000_fix_appointment_trigger_enum_safety.sql` — cast `status::text` before coalesce |
| Out of scope | Scheduling redesign, automatic job↔appointment linking, data backfill, frontend changes |
| After migration deploy | Re-run blocked R3 B-016 production smoke (linked lock on Jobs + Dispatch) |

**B-005:** complete and production-verified.  
**B-016:** frontend behavior deployed with PR #44; DB write path unblocked by R3B; production verification still required after migration.

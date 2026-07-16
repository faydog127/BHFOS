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

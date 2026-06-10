# Fix Packet — ISSUE-OPS-P1-2026-04-16-007 (Work Order identity consistency)

## 1) Issue ID
- ID: ISSUE-OPS-P1-2026-04-16-007
- Links:
  - Work Order v1 packet: `docs/handoff/FIX_PACKET_ISSUE-OPS-P1-2026-04-16-004_work_order_v1_functional_redesign.md`

## 2) Title
- Lock `work_order_number` as the only human-facing Work Order identifier everywhere

## 3) Severity
- P1 (operations clarity: mismatched IDs across screens makes dispatch/scheduling verification unreliable)

## 4) Environment
- Target: LOCAL → PROD (controlled)

## 5) Layer(s)
- CRM Control (Work Orders / Dispatch / Invoice builder / Kanban cards)
- Runtime Validation (RVH data assertions)

## 6) Contract (locked rule)
- Canonical human-facing WO ID: `jobs.work_order_number` (uppercased)
- Legacy/internal: `jobs.job_number` (may exist, but must never “win” over `work_order_number` in UI)

## 7) Fallback rule (only when work_order_number missing)
1. If `work_order_number` present → display it
2. Else if `job_number` present → display it
3. Else → display `WO-LEGACY-<first8(job.id)>`

## 8) Proposed change (smallest safe)
- Create one shared helper so all screens compute the same label:
  - `src/lib/workOrderIdentity.js` → `getWorkOrderDisplayId(job)`
- Update all human-facing surfaces to use the helper.
- Add RVH assertion that `jobs.work_order_number` is set and matches `WO-YYYY-####`.

## 9) Exact files affected
- New helper:
  - `src/lib/workOrderIdentity.js`
- Screens aligned:
  - `src/pages/crm/Jobs.jsx`
  - `src/pages/crm/Schedule.jsx`
  - `src/pages/crm/InvoiceBuilder.jsx`
  - `src/pages/crm/jobs/JobCompletion.jsx`
  - `src/components/crm/jobs/JobManager.jsx`
  - `src/components/crm/kanban/KanbanCard.jsx`
- RVH:
  - `scripts/runtime/rvh-p1-d-job-scheduling.ps1`

## 10) Risks
- Low (display-layer + test assertions).
- Legacy rows without `work_order_number` will still show a fallback; this packet does not backfill `work_order_number` for old rows (that remains a separate decision if needed).

## 11) Validation steps
- LOCAL:
  - Run `scripts/runtime/rvh-p1-d-job-scheduling.ps1` and confirm it asserts:
    - `jobs.work_order_number` is non-empty
    - format matches `WO-YYYY-####`
  - Manual spot-check (UI):
    - Open a scheduled job in Work Orders and Dispatch and confirm the same label is shown.

## 12) Rollback plan
- Revert helper + import changes in the affected screens.
- Revert RVH assertions if needed.

## 13) Status
- Current: LOCAL validated
- Evidence (LOCAL):
  - RVH-P1-D: `rvh_p1-d_20260416_225108_2e4f74` (artifacts: `tmp/runtime/2026-04-16/local/rvh_p1-d_20260416_225108_2e4f74`)

## 14) Owner
- Owner: Erron
- Reviewer: Erron
- Date opened: 2026-04-16
- Date closed:

# Fix Packet — ISSUE-OPS-P1-2026-04-16-010 (Schema/UI drift cleanup: Work Orders + Dispatch)

## 1) Issue ID
- ID: ISSUE-OPS-P1-2026-04-16-010
- Links:
  - Work Order v1 fields packet: `docs/handoff/FIX_PACKET_ISSUE-OPS-P1-2026-04-16-006_work_order_v1_job_fields_addition.md`

## 2) Title
- Align UI with locked Work Order + Dispatch contracts (no “optional” fields for dispatchable actions; remove phantom writes)

## 3) Severity
- P1 (ops friction + integrity: UI allows actions that server will reject; phantom writes create false confidence)

## 4) Environment
- Affected: MULTI
- Target: LOCAL → PROD (controlled)

## 5) Layer(s)
- Data Truth (migrations canonical)
- CRM Control (UI references)
- Integrations (edge invariants now stricter than UI)

## 6) Root cause
- Backend contracts were tightened (Packet 009), but the UI still:
  - Marks technician assignment as optional in scheduling flows
  - Enables schedule/start actions before dispatchable readiness is met
  - Contains a tech completion component that writes non-schema job fields (`signature_url`, `photos_json`)

## 7) Evidence
- Scheduling modal shows `Technician (optional)` and allows schedule without technician: `src/pages/crm/Jobs.jsx`
- Dispatch save path can schedule without technician (prior to Packet 010 cleanup): `src/pages/crm/Schedule.jsx`
- Phantom job writes in tech completion wizard:
  - `signature_url`, `photos_json`, `satisfaction_rating`: `src/components/tech/JobCompletionWizard.jsx`

## 8) Scope boundary
- IN SCOPE:
  - Action-state alignment: disable/block schedule/start until dispatchable readiness is met.
  - Terminology cleanup: remove “optional” language where the contract is required.
  - Remove phantom job writes in unused/experimental components.
- OUT OF SCOPE:
  - Full Work Order UI redesign or completion product work.

## 9) Exact files/functions/tables affected
- Files:
  - `src/pages/crm/Jobs.jsx`
  - `src/pages/crm/Schedule.jsx`
  - `src/components/tech/JobCompletionWizard.jsx`
- Contracts referenced:
  - Packet 009 readiness invariant (edge): `supabase/functions/work-order-update/index.ts`
  - Dispatch address validation helper: `src/lib/dispatchAddress.js`

## 10) Proposed change
- Patch plan:
  1. Jobs scheduling modal:
     - Change technician label to required
     - Disable Confirm Schedule unless address is dispatchable + technician selected + start/duration valid
     - Surface inline missing-field guidance
  2. Dispatch primary action (“Start Job”):
     - Disable Start when dispatchable readiness is not met
     - Show a clear “Start blocked” explanation listing missing fields
  3. Tech completion wizard:
     - Stop writing non-existent job columns
     - Map checklist/photos to the real Packet 006 columns (`execution_checklist`, `execution_photos`, `execution_findings`)

## 11) Risks
- Stricter UI gates can block previously-allowed “schedule first, assign later” behavior (intended; matches Packet 009 invariant).

## 12) Validation steps
- `npm run lint` (no new errors)
- `npm run build` (passes)
- RVH backend regression (LOCAL): `rvh_p1-d_20260416_234350_fdd380` (artifacts under `tmp/runtime/2026-04-16/local/rvh_p1-d_20260416_234350_fdd380/`)
- Manual (LOCAL):
  - Jobs → Schedule modal: Confirm Schedule disabled until tech + dispatchable address are set
  - Dispatch: “Start Job” disabled when required fields are missing; message lists missing fields

## 13) Rollback plan
- Revert UI-only changes.

## 14) Status
- Current: Implemented (LOCAL)

## 15) Owner
- Owner: Erron
- Reviewer: Erron
- Date opened: 2026-04-16
- Date closed:

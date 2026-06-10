# Fix Packet — ISSUE-OPS-P1-2026-04-16-006 (Work Order v1: add real job fields in canonical schema)

## 1) Issue ID
- ID: ISSUE-OPS-P1-2026-04-16-006
- Links:
  - Work Order v1 packet: `docs/handoff/FIX_PACKET_ISSUE-OPS-P1-2026-04-16-004_work_order_v1_functional_redesign.md`

## 2) Title
- Add Work Order v1 fields to `public.jobs` (schema first; UI cannot write phantom fields)

## 3) Severity
- P1 (operations: work orders cannot capture required execution data reliably)

## 4) Environment
- Affected: MULTI
- Target for fix + validation: LOCAL → PROD (controlled)

## 5) Layer(s)
- Data Truth (Supabase migrations)
- CRM Control (Work Orders modal + Dispatch read-only views)

## 6) Root cause
- Work Order v1 requires execution fields that do not exist in canonical migrations while UI already references some of them.
- Classification:
  - B) Code drift → remediation: new migration + then UI wiring.

## 7) Evidence
- Repo evidence:
  - `src/pages/crm/Schedule.jsx` references `job.scope_summary` (not in migrations).
  - `src/components/tech/JobCompletionWizard.jsx` references `signature_url`/`photos_json` (not in migrations).
- Canonical schema evidence:
  - `public.jobs` exists: `supabase/migrations/20260101_create_money_loop_core_tables.sql`
  - Work order fields already present: `supabase/migrations/20260225201000_add_work_order_sequence_and_job_fields.sql`

## 8) Scope boundary
- IN SCOPE:
  - Add exactly the approved fields to `public.jobs`.
  - Do not introduce `dispatch_id`, `signature_url`, or `photos_json`.
- OUT OF SCOPE:
  - UI layout redesign.
  - Report automation pipeline.

## 9) Exact files/functions/tables affected
- Tables/views/RPCs:
  - `public.jobs`
  - (follow-up) `public.job_operational_state_v1` if/when new fields must appear on the board

## 10) Proposed change
- New columns on `public.jobs` (approved):
  - `scope_summary text`
  - `special_conditions text`
  - `property_notes text`
  - `execution_checklist jsonb not null default '[]'::jsonb`
  - `execution_findings jsonb not null default '[]'::jsonb`
  - `execution_photos jsonb not null default '[]'::jsonb`
  - `technician_notes text`
  - `customer_summary text`
  - `follow_up_required boolean not null default false`
  - `follow_up_notes text`
  - `report_url text`
- App rules (initial, not DB constraints yet):
  - Require `scope_summary` for completion flow.
  - If `follow_up_required=true`, require `follow_up_notes`.
- Migration plan:
  - New migration filename: `supabase/migrations/20260416xxxx00_work_order_v1_job_fields.sql`
  - Why migration is warranted: establishes canonical schema so UI/edge can persist.

## 11) Risks
- Low risk (additive columns).
- If PROD has DB drift (non-canonical `jobs`), follow drift protocol; do not force-add outside migrations.

## 12) Validation steps
- DB assertions:
  - Verify columns exist via `information_schema.columns`.
- RVH:
  - Add RVH-WO-3/4/5 after UI wiring; schema-only validation for this packet.

## 13) Rollback plan
- Compensating migration to drop columns (only if absolutely necessary).

## 14) Status
- Current: LOCAL validated
- Evidence (LOCAL):
  - Migration: `supabase/migrations/20260416230000_work_order_v1_job_fields.sql`
  - Edge support: `supabase/functions/work-order-update/index.ts`
  - RVH-P1-D: `rvh_p1-d_20260416_221538_f998aa` (artifacts: `tmp/runtime/2026-04-16/local/rvh_p1-d_20260416_221538_f998aa`)

## 15) Owner
- Owner: Erron
- Reviewer: Erron
- Date opened: 2026-04-16
- Date closed:

# Fix Packet — DRIFT-001 (`public.leads.updated_at` missing in PROD)

## 1) Issue ID
- ID: DRIFT-001
- Links:
  - Drift report: `docs/handoff/DRIFT_REPORT_2026-04-16.md`
  - Rollout plan: `docs/handoff/PROD_ROLLOUT_PLAN_DRIFT-001_leads_updated_at.md`

## 2) Title
- Add missing `public.leads.updated_at` in PROD (unblocks scheduling + dispatch saves)

## 3) Severity
- P1 (operations blocked: scheduling/dispatch writes fail)

## 4) Environment
- Affected: PROD (`app.bhfos.com`)
- Target for fix + validation: LOCAL → PROD (no staging exists)

## 5) Layer(s)
- Data Truth (Supabase schema/migrations)
- CRM Control (dispatch/scheduling UI writes)

## 6) Root cause
- **Classification:** A) DB drift
- PROD has a legacy `public.leads` table shape that predates the canonical migration shape; `CREATE TABLE IF NOT EXISTS ...` cannot “upgrade” it, so `updated_at` stayed missing while app code writes it.

## 7) Evidence
- Runtime error text (exact):
  - `column leads.updated_at does not exist`
- Where observed:
  - Dispatch/Scheduling flows in `app.bhfos.com` (write path updates `leads.updated_at`)
- Smallest repro:
  1. Open Dispatch board
  2. Save dispatch changes for a job that has `lead_id`
  3. Observe failure when updating lead metadata
- Repo evidence:
  - `src/pages/crm/Schedule.jsx:1056` updates `public.leads.updated_at` during dispatch save.
- Canonical schema evidence:
  - `supabase/migrations/20260101_create_money_loop_core_tables.sql:69` defines `public.leads.updated_at timestamptz not null default now()`.
- PROD schema evidence:
  - `tmp/prod_public.sql:8126` shows `CREATE TABLE IF NOT EXISTS "public"."leads" (...)` without `updated_at`.
- Notes on redaction (tokens/PII removed): YES

## 8) Scope boundary
- IN SCOPE:
  - Add missing `updated_at` column to `public.leads` in PROD (idempotent drift-fix)
- OUT OF SCOPE:
  - Scheduling UI redesign, dispatch logic redesign, payment/invoice logic, deploy scripts
- Do not touch:
  - Any non-leads schema drift items (DRIFT-002+)

## 9) Exact files/functions/tables affected
- Migration:
  - `supabase/migrations/20260416184500_drift_fix_leads_add_updated_at.sql`
- Tables:
  - `public.leads`
- App write path impacted (proves why this is blocking):
  - `src/pages/crm/Schedule.jsx`

## 10) Proposed change
- Summary:
  - Add `public.leads.updated_at` (timestamptz, default now(), not null) in a drift-fix migration.
  - Backfill `updated_at` from `last_touch_at` (or `created_at`) for existing rows.
- Patch plan:
  1. Apply `supabase/migrations/20260416184500_drift_fix_leads_add_updated_at.sql` to PROD (SQL Editor fallback if migration history mismatch blocks `db push`).
  2. Post-verify schema + run minimal CRM click-path validation.

## 11) Risks
- Primary risk:
  - `ALTER TABLE` requires a lock; on a very large `public.leads` this can briefly block writes.
- Side effects:
  - Adds a new column; no behavior change unless code reads/writes it (it already does).
- Data integrity:
  - Backfill uses `last_touch_at`/`created_at`; this is best-effort and not a full historical truth.

## 12) Validation steps
- Preflight gates:
  - Fresh PROD schema dump confirms `updated_at` missing before the rollout.
- Manual checks (PROD, low-activity window):
  1. Dispatch: Save a dispatch change for a job with a `lead_id` → must succeed.
  2. Leads list / customer selectors: must load without column errors.
- DB assertions (PROD, read-only queries):
  - `select column_name from information_schema.columns where table_schema='public' and table_name='leads' and column_name='updated_at';` → returns 1 row.
  - `select count(*) from public.leads where updated_at is null;` → returns 0.

## 13) Rollback plan
- DB rollback:
  - This is an additive drift-fix; preferred rollback is **no rollback** (leave the column).
  - Emergency-only (not recommended): drop the column (reintroduces the original failure):
    - `alter table public.leads drop column if exists updated_at;`
- Operational rollback:
  - If anything unexpected happens during the window: STOP writes, revert via rollback artifact, and defer.

## 14) Status
- Current: Proposed
- Next action: Execute `docs/handoff/PROD_ROLLOUT_PLAN_DRIFT-001_leads_updated_at.md`

## 15) Owner
- Owner:
- Reviewer:
- Date opened: 2026-04-16
- Date closed:


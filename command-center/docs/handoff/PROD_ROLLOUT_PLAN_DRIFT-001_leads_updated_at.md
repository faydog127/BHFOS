# PROD Rollout Plan — DRIFT-001 (`public.leads.updated_at`)

Objective: restore PROD scheduling/dispatch stability by aligning PROD `public.leads` to canonical schema expectations:
- Add missing `public.leads.updated_at` required by CRM write paths.

Scope boundary:
- IN: One additive schema drift-fix on `public.leads`
- OUT: Any other drift items (invoices tokens, invoice numbering, etc.), UI redesign, deploy scripts

Target change set:
1) `supabase/migrations/20260416184500_drift_fix_leads_add_updated_at.sql`

Rollback artifact:
- `docs/handoff/rollback/PROD_PRE_2026-04-16_DRIFT-001_leads_updated_at.sql`

---

## Preconditions (must be true before any PROD write)

1) Fresh dump confirms starting state
- Run:
  - `C:\Users\ol_ma\.supabase\bin\supabase.exe --workdir c:\BHFOS\command-center db dump --linked --schema public --file tmp\prod_public_pre_drift001.sql`
- Confirm:
  - `CREATE TABLE IF NOT EXISTS "public"."leads" (` exists
  - No `updated_at` column in that table definition

2) Confirm canonical intent (why this change is justified)
- Confirm in repo:
  - `supabase/migrations/20260101_create_money_loop_core_tables.sql` defines `public.leads.updated_at` (canonical contract)

3) Window + operator
- Choose a low-activity window (15–30 min).
- One owner to execute, one reviewer to observe.

---

## Safety gates (stop conditions)

STOP immediately if any are true:
- You cannot get a fresh schema dump (auth/access blocked).
- You discover the leads table is extremely large and the lock window is not acceptable (reschedule the window).
- Any other unrelated migration/DDL is accidentally in scope.

---

## Execution options (choose one)

### Option A — Apply via `supabase db push` (preferred if migration history is clean)

1) Dry-run (no writes)
- Run:
  - `C:\Users\ol_ma\.supabase\bin\supabase.exe --workdir c:\BHFOS\command-center db push --linked --dry-run`
- Expected:
  - ONLY `20260416184500_drift_fix_leads_add_updated_at.sql`
- If more than that appears: STOP.

2) Apply (writes)
- Run:
  - `C:\Users\ol_ma\.supabase\bin\supabase.exe --workdir c:\BHFOS\command-center db push --linked`

### Option B — Supabase SQL Editor fallback (recommended if migration history mismatch blocks push)

Use this when `db push` is blocked by remote migration history mismatch.

1) Open Supabase → SQL Editor (PROD project)
2) Paste the exact contents of:
   - `supabase/migrations/20260416184500_drift_fix_leads_add_updated_at.sql`
3) Execute once
4) Save the SQL Editor run output (screenshot or exported results) into your runtime artifacts folder for the window.

---

## Post-rollout verification (must pass)

1) Post-dump schema confirmation
- Run:
  - `C:\Users\ol_ma\.supabase\bin\supabase.exe --workdir c:\BHFOS\command-center db dump --linked --schema public --file tmp\prod_public_post_drift001.sql`
- Confirm:
  - `public.leads` includes `updated_at`

2) DB assertions (PROD; read-only)
- Confirm:
  - `select count(*) from public.leads where updated_at is null;` → 0

3) Minimal CRM runtime validation (PROD; controlled)
- Dispatch save path:
  1. Open Dispatch board
  2. Select a job with `lead_id`
  3. Change a dispatch-editable field (e.g., service text)
  4. Click save
  5. Must succeed (no `leads.updated_at` error)

---

## Rollback

Preferred rollback: none (this is additive).

Emergency-only:
- Use `docs/handoff/rollback/PROD_PRE_2026-04-16_DRIFT-001_leads_updated_at.sql` for:
  - Evidence of starting state
  - Optional `DROP COLUMN` command (not recommended; reintroduces the original failure)

---

## Success criteria

- Scheduling/Dispatch pages no longer throw `column leads.updated_at does not exist`
- Dispatch save succeeds for jobs tied to a lead
- No unexpected errors appear during the window


# PROD Rollout Plan — `ISSUE-OPS-P1-2026-04-16-001` (Quote → Job contract alignment)

Objective: align PROD quote→job behavior to the locked business contract:
- Quote Approved/Accepted → create `job`
- New job status = `unscheduled`
- Job identity is canonical on `jobs.quote_id` (not `jobs.estimate_id`)

Scope boundary:
- IN: Supabase DB migration(s) affecting only quote→job triggers/functions
- OUT: Scheduling/dispatch UI, invoice redesign, deploy scripts, n8n

Target change set:
1. `supabase/migrations/20260416043000_remove_estimate_id_from_quote_job_trigger.sql`
   - Updates `public.ensure_job_and_optional_draft_invoice_for_accepted_quote()` to stop inserting/upserting `estimate_id` into `public.jobs`.
2. `supabase/migrations/20260416043500_drop_legacy_on_quote_approved_v2_trigger.sql`
   - Drops legacy PROD drift trigger `on_quote_approved_v2` (non-canonical job creation path).

Rollback artifact (copy/paste ready):
- `docs/handoff/rollback/PROD_PRE_2026-04-16_quote_job_trigger_and_legacy_trigger.sql`

---

## Preconditions (must be true before any PROD write)

1) Confirm read-only drift evidence is still current (fresh dump)
- Run:
  - `C:\Users\ol_ma\.supabase\bin\supabase.exe --workdir c:\BHFOS\command-center db dump --linked --schema public --file tmp\prod_public_pre_rollout.sql`
- Confirm in the dump:
  - `ensure_job_and_optional_draft_invoice_for_accepted_quote()` still inserts `estimate_id` into `public.jobs`
  - Legacy trigger exists:
    - `CREATE OR REPLACE TRIGGER "on_quote_approved_v2" ... EXECUTE FUNCTION "public"."handle_quote_approval_v2"();`

2) Confirm the contract link exists in PROD schema
- Confirm in the dump:
  - `public.jobs` contains `quote_id` (it should)

3) Confirm removing `estimate_id` from job writes won’t break downstream logic
- Repo proof (already done for LOCAL): no `jobs.estimate_id` reads were found.
- PROD reality check (required):
  - Search `tmp/prod_public_pre_rollout.sql` for other *active* triggers/functions that read `public.jobs.estimate_id`.
  - If anything depends on it for correctness (not just legacy storage), STOP and revise plan.

4) Change window + operator
- Pick a low-activity window (15–30 min).
- Assign 1 owner to execute, 1 reviewer to observe.

---

## Safety gates (stop conditions)

STOP immediately if any are true:
- `supabase db push --dry-run` shows it will apply more than the 2 migrations above.
- The pre-rollout dump does not match expected starting state (meaning the environment is not what we think).
- The CLI requests applying role changes / seed changes unexpectedly.
- Any customer-impact signal appears during the window:
  - quote approvals erroring
  - jobs not being created
  - dispatch breaking/emptying unexpectedly
  - elevated errors in `public.public_events` for `public_quote_approve`

---

## Execution steps (PROD write)

### Deployment method note (important)
This repo’s local migrations are currently **not guaranteed to match** the remote migration history table.
If `supabase db push --dry-run` reports **“Remote migration versions not found in local migrations directory”**, do **not** force a push.
Use the **SQL Editor fallback** below for this narrowly-scoped change, and treat migration history reconciliation as a separate governed task.

### Step 1 — Verify remote migration state (no writes)
- Run:
  - `C:\Users\ol_ma\.supabase\bin\supabase.exe --workdir c:\BHFOS\command-center migration list --linked`
- Save output to a timestamped text file under `tmp/prod-rollout/YYYY-MM-DD/`.

### Step 2 — Dry-run the push (no writes)
- Run:
  - `C:\Users\ol_ma\.supabase\bin\supabase.exe --workdir c:\BHFOS\command-center db push --linked --dry-run`
- Expected:
  - ONLY:
    - `20260416043000_remove_estimate_id_from_quote_job_trigger.sql`
    - `20260416043500_drop_legacy_on_quote_approved_v2_trigger.sql`
- If more appear: STOP.
- Repeat this dry-run earlier in the day (preflight) so you don't discover surprises during the maintenance window.

### Step 3 — Apply migrations (writes)
- Run:
  - `C:\Users\ol_ma\.supabase\bin\supabase.exe --workdir c:\BHFOS\command-center db push --linked`
- Capture console output.

### SQL Editor fallback (writes; use only if `db push` is blocked)
If `db push` is blocked by remote migration history drift, apply the change directly in Supabase SQL Editor:

1) Paste the function body from:
   - `supabase/migrations/20260416043000_remove_estimate_id_from_quote_job_trigger.sql`

2) Paste the trigger drop from:
   - `supabase/migrations/20260416043500_drop_legacy_on_quote_approved_v2_trigger.sql`

3) Save the SQL Editor execution screenshot/output to the artifact bundle folder.

### Step 4 — Post-rollout schema verification (read-only)
- Run:
  - `C:\Users\ol_ma\.supabase\bin\supabase.exe --workdir c:\BHFOS\command-center db dump --linked --schema public --file tmp\prod_public_post_rollout.sql`
- Confirm in the dump:
  - `ensure_job_and_optional_draft_invoice_for_accepted_quote()` no longer includes `estimate_id` in the `insert into public.jobs` path.
  - Trigger `on_quote_approved_v2` no longer exists.
  - Canonical triggers still exist:
    - `trg_quotes_normalize_status`
    - `trg_quotes_ensure_job_and_invoice`

---

## Runtime validation (PROD)

Constraint: no staging exists. PROD validation must be controlled.

### Minimum acceptable validation (P1)
Perform exactly one controlled quote approval after rollout:
- Create/locate a quote that is safe to approve (real workflow; avoid test spam).
- Approve it.
- Confirm in UI:
  - a job is created exactly once
  - job shows `unscheduled`
  - work order number exists
  - dispatch can see the job

If your policy requires PROD-read-only for “tests”, then:
- Defer runtime proof until the next real customer quote approval happens naturally, and treat that event as the validation.

Evidence to capture:
- Screenshot of quote status + work order/job created (redact PII)
- Any error toast/console output (if present)

---

## Success criteria

- Quote approval does not error
- Job created exactly once per quote (`jobs.quote_id` unique behavior preserved)
- `job.status = unscheduled`
- Dispatch sees job as `unscheduled` (not “ready for execution”)
- No new errors observed in the approval path

---

## Rollback plan (if needed)

Rollback trigger: business-impacting break (job not created, dispatch broken, approvals erroring).

Action:
- Paste and run:
  - `docs/handoff/rollback/PROD_PRE_2026-04-16_quote_job_trigger_and_legacy_trigger.sql`
  in Supabase SQL editor (or apply via a controlled DB session).

Post-rollback check:
- Re-dump schema to `tmp/prod_public_post_rollback.sql` and confirm the prior definition is restored.

---

## Ownership / Status

- Owner: Erron
- Reviewer: Erron (self-review against fix packet + rollout checklist)
- Planned window: Next low-activity evening block after jobs are complete (default: 7:30 PM–9:00 PM local time)
- Validation preference: Defer runtime validation to the next real quote approval event unless explicitly approved for one controlled live approval during the maintenance window.
- Status: Approved (ready to execute when window opens)

## Artifact bundle location (local workspace)

Keep the rollout evidence in one place:
- `tmp/prod-rollout/2026-04-16/`

Minimum files to capture per rollout:
- `prod_migration_list_pre.txt`
- `prod_db_push_dry_run.txt`
- `prod_public_pre_rollout.sql`
- `prod_public_post_rollout.sql`
- `repo_snapshot.txt` (git SHA + local status + which migrations were pushed)

# Fix Packet

## 1) Issue ID
- ID: `ISSUE-OPS-P1-2026-04-16-001`
- Links:
  - ULSIA item: (add if/when captured in ULSIA table)
  - RVH chain/run: `RVH-P1-B` run_id `rvh_p1-b_20260416_002249_56f1a7` (latest) and `rvh_p1-b_20260415_234742_c235ad` (prior)

## 2) Title
- `Quote approval fails to create Job (quote→job trigger references jobs.estimate_id)`

## 3) Severity
- P1 (Operations blocked)

## 4) Environment
- Affected: LOCAL (confirmed); likely MULTI (not yet verified in PROD)
- Target for fix + validation: LOCAL → (STAGING when exists) → PROD-READONLY (passive verification only)

## 5) Layer(s)
- Data Truth (Supabase schema/migrations)
- Integrations (Edge function: `public-quote-approve`)
- Reconciliation (Quote → Job → Dispatch chain)

## 6) Root cause
- Business contract (confirmed):
  - Jobs originate from **quotes**. Canonical relationship: `jobs.quote_id`.
  - `estimate_id` is not the canonical identifier for a job.
  - Clarification (operational semantics):
    - Quote **Approved/Accepted** should create a `job` in `unscheduled` (visible to dispatch, not yet execution-ready).
    - “Ready for execution” is a later gate that requires: `scheduled_start` (+ optional `scheduled_end`), `technician_id`, `service_address`, and minimum customer contact/scope data.
- Technical root cause:
  - Quote acceptance/approval triggers attempt to `insert into public.jobs (..., estimate_id, ...)` while `public.jobs` does not contain an `estimate_id` column. This causes the approval flow to fail and return a misleading `404 Not Found`.
- Classification (schema-related):
  - Internal mismatch inside `supabase/migrations/`:
    - Canonical table definition: `public.jobs` has `quote_id` but no `estimate_id` (`supabase/migrations/20260101_create_money_loop_core_tables.sql`)
    - Trigger functions later reference `jobs.estimate_id` (latest override: `supabase/migrations/20260403010404_fix_offline_paid_transitions.sql`)
  - Remediation: **new migration** to remove `estimate_id` from job insert paths (align to `quote_id` contract).

## 7) Evidence
- Runtime error text (exact):
  - `column "estimate_id" of relation "jobs" does not exist`
- Where observed:
  - LOCAL edge function `POST /functions/v1/public-quote-approve` returned `404 {"error":"Not found"}` while failing internally
- Repro steps (smallest):
  1) Start Supabase local
  2) Run `pwsh -NoProfile -File scripts/runtime/rvh-p1-b-quote-job-dispatch.ps1 -TenantId tvg -Environment local -SkipStart`
  3) Inspect `tmp/runtime/2026-04-15/local/rvh_p1-b_20260415_234742_c235ad/chainB/public-quote-approve.http.txt`
  4) Confirm internal failure evidence in DB (see below)
- Repo evidence (file path):
  - `supabase/functions/public-quote-approve/index.ts` (sets quote status to accepted/approved, which triggers DB job-ensure logic)
  - `supabase/migrations/20260314121500_realign_quote_approval_job_triggers.sql` (inserts `estimate_id` into `public.jobs`)
  - `supabase/migrations/20260403002429_enforce_quote_acceptance_job_invariant.sql` (upserts `estimate_id` into `public.jobs`)
  - `supabase/migrations/20260403004336_sync_quote_paid_to_invoice_and_job.sql` (sync logic references `estimate_id`)
  - `supabase/migrations/20260403010404_fix_offline_paid_transitions.sql` (latest override of the same trigger function; still references `estimate_id`)
- DB evidence (LOCAL):
  - `select column_name from information_schema.columns where table_schema='public' and table_name='jobs' and column_name='estimate_id';` → `(0 rows)`
  - Active trigger on `public.quotes` that causes the failure:
    - Trigger: `trg_quotes_ensure_job_and_invoice`
    - Function: `public.ensure_job_and_optional_draft_invoice_for_accepted_quote()`
  - `public.public_events` captured error metadata for the failed run:
    - kind=`public_quote_approve`, status=`not_found`, metadata.error=`column "estimate_id" of relation "jobs" does not exist`
    - run_id examples:
      - `rvh_p1-b_20260416_002249_56f1a7-qa1`
      - `rvh_p1-b_20260415_234742_c235ad-qa1`
- RVH artifacts:
  - `tmp/runtime/2026-04-16/local/rvh_p1-b_20260416_002249_56f1a7/`

- PROD-READ-ONLY drift evidence (schema dump):
  - Dump file: `tmp/prod_public.sql`
  - PROD trigger function still inserts into `public.jobs (..., estimate_id, ...)` inside `public.ensure_job_and_optional_draft_invoice_for_accepted_quote()`:
    - `tmp/prod_public.sql:1288` (function definition start; `estimate_id` included in `insert into public.jobs`)
  - PROD schema currently includes `public.jobs.estimate_id`:
    - `tmp/prod_public.sql:8081` (jobs table definition includes `"estimate_id" "uuid"`)

## 8) Scope boundary
- IN SCOPE:
  - Align quote→job trigger functions to the business contract:
    - job creation uses `quote_id`
    - no references to `jobs.estimate_id`
  - Ensure quote approval can create a job and dispatch projection can see it (RVH-P1-B)
  - Keep “approved/accepted” distinct from “ready for execution” (status semantics only; no UI changes required for this packet)
- OUT OF SCOPE:
  - Any redesign of quote/work order/invoice lifecycle
  - Any UI changes
  - Any deploy script changes
- Do not touch:
  - deploy scripts
  - unrelated edge functions

## 9) Exact files/functions/tables affected
- Migrations (new):
  - `supabase/migrations/20260416043000_remove_estimate_id_from_quote_job_trigger.sql` (applied LOCAL)
  - `supabase/migrations/20260416043500_drop_legacy_on_quote_approved_v2_trigger.sql` (applied LOCAL; PROD drift cleanup)
- Existing migrations implicated:
  - `supabase/migrations/20260314121500_realign_quote_approval_job_triggers.sql`
  - `supabase/migrations/20260403002429_enforce_quote_acceptance_job_invariant.sql`
  - `supabase/migrations/20260403004336_sync_quote_paid_to_invoice_and_job.sql`
  - `supabase/migrations/20260403010404_fix_offline_paid_transitions.sql`
- Edge functions:
  - `supabase/functions/public-quote-approve/index.ts`
- Tables/views/RPCs:
  - `public.jobs`
  - `public.job_operational_state_v1` (dispatch projection; validation surface)

## 10) Proposed change
- Summary:
  - Do **not** add `jobs.estimate_id`.
  - Add a migration that replaces the quote→job trigger function(s) so job creation does not reference `jobs.estimate_id` and remains canonical on `jobs.quote_id`.
- Patch plan:
  1) Create a new migration that runs:
     - `create or replace function public.ensure_job_and_optional_draft_invoice_for_accepted_quote()` with:
       - `insert into public.jobs (...)` **without** `estimate_id` in both:
         - accepted transition
         - paid transition
       - keep existing idempotency (`on conflict (quote_id)`)
  2) (Optional hygiene) Update legacy functions in `20260314121500_realign_quote_approval_job_triggers.sql` to remove `estimate_id` from their job inserts (may be unused but safe).
- Migration plan:
  - New migration filename (applied): `supabase/migrations/20260416043000_remove_estimate_id_from_quote_job_trigger.sql`
  - Why migration is warranted:
    - This is a runtime blocker in the canonical quote acceptance trigger.
    - The business contract is quote→job, so the trigger must match `jobs.quote_id` without referencing a non-existent `jobs.estimate_id`.
- Config/env changes:
  - None

## 11) Risks
- Primary risk:
  - Medium — changing trigger function logic impacts quote acceptance/paid transitions.
- Side effects:
  - Low if change is strictly “remove reference to a non-existent column”; idempotency remains on `quote_id`.
- Data integrity concerns:
  - Ensure the revised trigger still guarantees “1 job per quote” via existing unique index on `jobs.quote_id`.
- Security/RLS concerns:
  - DB function change should not change RLS; it runs as `security definer` as before.

## 12) Validation steps
- Preflight:
  - `pwsh -NoProfile -File scripts/runtime/assert-env-safe.ps1 -Environment local`
- Automated:
  - Re-run RVH-P1-B:
    - `pwsh -NoProfile -File scripts/runtime/rvh-p1-b-quote-job-dispatch.ps1 -TenantId tvg -Environment local -SkipStart`
  - Expected PASS signals:
    - `public-quote-approve` returns 200
    - `public.jobs` contains a row with `quote_id=<quote_id>`
    - `job_operational_state_v1` returns the job row
    - `jobs.service_address` and `jobs.work_order_number` are non-empty
- DB assertions:
  - `public-quote-approve` no longer emits `column "estimate_id" of relation "jobs" does not exist` (check `public.public_events.metadata->>'error'` for the run_id)

## 13) Rollback plan
- DB rollback:
  - Create a compensating migration to restore the previous trigger function definition(s) (from the current migration state) if unexpected behavior occurs.
- Code rollback:
  - Not required for this packet (migration-only fix)

## 14) Status
- Current: Implemented + Validated (LOCAL); PROD drift confirmed (read-only)
- Blockers:
  - None for LOCAL
  - STAGING is missing (cannot validate outside LOCAL yet)
- Next action:
  - Plan controlled PROD rollout of `supabase/migrations/20260416043000_remove_estimate_id_from_quote_job_trigger.sql` (write action; requires explicit approval + rollback plan).
  - Keep RVH-P1-B as the closure gate for any future changes to quote→job.
  - Rollout plan doc:
    - `docs/handoff/PROD_ROLLOUT_PLAN_ISSUE-OPS-P1-2026-04-16-001.md`

## Validation record (LOCAL)
- Migration applied:
  - `supabase migration up` applied `20260416043000_remove_estimate_id_from_quote_job_trigger.sql`
- RVH:
  - PASS: `rvh_p1-b_20260416_003449_492938` (artifacts under `tmp/runtime/2026-04-16/local/rvh_p1-b_20260416_003449_492938/`)

## 15) Owner
- Owner: (assign)
- Reviewer: (assign)
- Date opened: 2026-04-16
- Date closed:

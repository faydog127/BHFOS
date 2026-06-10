# Execution Board (Seed)

Purpose: keep stabilization work **visible** and prevent “chat-only state”.

Columns:
- **P0 Revenue**
- **P1 Operations**
- **Blocked / Needs Access**

## Seed cards (current known)

### P0 Revenue
- **Public-pay initiation fails without provider payment ID**
  - Evidence: `scripts/runtime/rvh-p0-a-revenue-chain.ps1` initially produced `Missing provider_payment_id` tasks until local bypass was enabled.
  - Impact: breaks Stripe “initiation-only” boundary; blocks real checkout session initiation proof until fixed.
- **Revenue chain validated (LOCAL)**
  - Evidence: RVH-P0-A PASS `rvh-p0-a-20260416_005248`
  - What is proven: invoice → pay initiation (test bypass) → webhook replay idempotency → invoice paid → exactly 1 transaction
  - Gap remaining: hosted/runtime proof (no staging; PROD remains read-only).
- **PROD runtime proof not possible yet**
  - Reason: no staging; PROD must stay read-only until isolation exists.
  - Trigger to resume: staging environment exists or strict `is_test_data` + tenant isolation in PROD is approved.

### P1 Operations
- **Quote approve → Job creation was failing (LOCAL fixed)**
  - Evidence (prior): `public.public_events` captured `column "estimate_id" of relation "jobs" does not exist` during quote approval; RVH-P1-B returned `404 {"error":"Not found"}` while failing internally.
  - Fix packet: `docs/handoff/FIX_PACKET_ISSUE-OPS-P1-2026-04-16-001_jobs_estimate_id.md`
  - Validation: RVH-P1-B PASS `rvh_p1-b_20260416_003449_492938` (LOCAL)
  - Current: LOCAL_PROVEN; needs PROD-READ-ONLY drift check + controlled rollout later.
- **Invoice guardrails require job_id + invoice_type**
  - Evidence: `scripts/stripe-intent-smoke-test.ps1` previously failed with `WORK_ORDER_REQUIRED`.
  - Impact: any code path that inserts invoices without `job_id` will fail at DB trigger.

- **Scheduling chain validated (LOCAL, appointments)**
  - Evidence: RVH-P1-C PASS `rvh_p1-c_20260416_015406_8f48c8`
  - What is proven: appointment creation via edge function + calendar list reload returns it
  - Gap remaining: PROD drift item `leads.updated_at` still needs controlled migration (see drift report).

- **Job scheduling validated (LOCAL, dispatch path)**
  - Evidence: RVH-P1-D PASS `rvh_p1-d_20260416_020126_d0068d`
  - What is proven: unscheduled job → scheduled via `work-order-update` with required fields (scheduled_start/end + technician) and dispatch projection updates

### Blocked / Needs Access
- **Staging isolation**
  - Missing: staging Supabase project + staging n8n + Stripe test mode.
  - Minimal unblock: create staging Supabase project (separate URL/ref) and staging n8n instance; configure Stripe test keys.
- **PROD rollout pending: align quote→job trigger to `quote_id` contract**
  - Evidence: `tmp/prod_public.sql:1288` shows `ensure_job_and_optional_draft_invoice_for_accepted_quote()` still inserting `estimate_id` into `public.jobs` (legacy behavior).
  - Fix exists + validated locally: `docs/handoff/FIX_PACKET_ISSUE-OPS-P1-2026-04-16-001_jobs_estimate_id.md`
  - Guardrail: no staging; PROD change requires explicit approval + rollback plan + RVH rerun in the first available safe environment.

## System Gaps / Future Build (do not build yet)
- **COMMAND BOARD (Execution Layer)**
  - Central place to track:
    - Active Issues (P0/P1)
    - Customer Scenarios
    - System Gaps
    - Next Actions
  - Separate from Ops Visibility and Diagnostics
  - Purpose: decision + execution control, not system monitoring

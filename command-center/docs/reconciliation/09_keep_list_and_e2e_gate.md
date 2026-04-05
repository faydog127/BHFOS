# Keep List and E2E Gate

Date: 2026-02-24
Scope: `c:\BHFOS` working tree triage for POS/quote/invoice flow stabilization.

## Decision Rule
- Keep anything directly supporting tenant CRM, quote send/approve, invoice creation, or payment loop.
- Quarantine anything that is duplicate deployment payload, legacy mirror, temp artifacts, or unrelated platform noise.
- Mark E2E readiness per flow so cleanup does not break currently working behavior.

## Keep Now (High Value)

### Core app runtime
- `command-center/src/**`
- `command-center/public/**`
- `command-center/index.html`
- `command-center/vite.config.js`
- `command-center/package.json`
- `command-center/package-lock.json`
- `command-center/postcss.config.js`
- `command-center/tailwind.config.js`

Reason:
- This is the active CRM frontend serving tenant routes and proposal/invoice UI.
- Contains current build stamp wiring (`BHFSidebar`, `EnterpriseSidebar`) for deployment verification.

### Core edge functions (quote/invoice/payment path)
- `command-center/supabase/functions/send-estimate/**`
- `command-center/supabase/functions/public-quote/**`
- `command-center/supabase/functions/public-quote-approve/**`
- `command-center/supabase/functions/invoices-list/**`
- `command-center/supabase/functions/quotes-list/**`
- `command-center/supabase/functions/send-invoice/**`
- `command-center/supabase/functions/public-invoice/**`
- `command-center/supabase/functions/public-pay/**`
- `command-center/supabase/functions/stripe-webhook/**`
- `command-center/supabase/functions/payment-webhook/**`
- Shared libs required by those:
  - `command-center/supabase/functions/_shared/**`
  - `command-center/supabase/functions/_lib/**`

Reason:
- These files currently implement send, approval decision, auto-job creation, invoice lifecycle entry points, and public payment entry points.

### Schema and migration history
- `command-center/supabase/migrations/**`
- `command-center/supabase/config.toml`

Reason:
- Required for environment parity and reproducible state.
- Includes tenant/cost/quote/invoice related schema deltas needed by current logic.

### Test and operations scripts
- `command-center/scripts/**`
- `command-center/tests/**`
- `command-center/tools/**`
- `command-center/docs/**`

Reason:
- Contains stabilization checklists and runtime verification artifacts already in use.

## Quarantine (Do Not Deploy / Do Not Treat as Source of Truth)

### Duplicate/mirror trees
- `Website/command-center/**`
- `command-center_old/**`

Reason:
- High probability duplicate payload and drift source.
- Keeping this in active deployment path increases accidental regression risk.

### Temp and one-off artifacts
- `tmpclaude-*/**`
- `supabase/tmpclaude-*/**`
- `supabase/migrations/tmpclaude-*`
- `_snapshot/**`
- `debug.log`
- `docs.zip`
- `command-center/_tmp_check_*.mjs`

Reason:
- Non-production artifacts, debugging leftovers, or archive output.

### Legacy/unrelated roots (for current flow)
- root `Website/**` outside explicit tenant app migration plan
- root `re-group/**` (historical docs only)

Reason:
- Not needed to stabilize the active quote-to-invoice path.

## E2E Gate (Current State)

### A. Proposal list and filtering
- Status: PASS (observed in live app UI)
- Notes:
  - Proposal filter tabs (`all/draft/sent/accepted`) are functioning.

### B. Send estimate from CRM
- Status: PARTIAL PASS
- Notes:
  - Send flow works with admin override modal for missing cost snapshot.
  - Works for operational sending, but guardrail policy decision still open for long-term model.

### C. Customer approve/decline action
- Status: PASS (edge-hosted confirmation)
- Notes:
  - `public-quote-approve` returns a human confirmation page when app confirmation route is not configured.
  - This is valid fallback behavior and currently avoids broken redirects.

### D. Redirect to app confirmation route
- Status: BLOCKED BY DEPLOYMENT TARGET
- Notes:
  - Requires actual SPA route hosted on app domain (`/quote-confirmation`) and environment routing alignment.

### E. Auto-invoice creation on approval
- Status: INTENTIONALLY DISABLED (policy lock)
- Evidence:
  - `public-quote-approve` now creates/updates work order only.
  - Invoice issuance is gated in CRM billing flow.
- Remaining check:
  - Confirm Invoice Builder enforces work-order billing guardrails in live environment.

### F. Invoice list UI
- Status: PARTIAL
- Notes:
  - Invoices page now queries table directly (reduces edge-function auth churn).
  - Historical browser errors need re-check on deployed build after cleanup.

## Smoke Checkpoint (2026-02-24, post-deploy probe)

Commands run from `command-center` with proxy vars cleared:
- `node scripts/_tmp_cors_check.mjs`
- `node scripts/_tmp_edge_probe.mjs`
- `node scripts/_tmp_quote_invoice_linkage.mjs`

Results:
- `quotes-list` CORS preflight: `200`, `access-control-allow-origin=https://app.bhfos.com`
- `invoices-list` CORS preflight: `200`, `access-control-allow-origin=https://app.bhfos.com`
- `quotes-list` anon call: `200`
- `invoices-list` anon call: `200`
- `quotes-list` service call: `200`
- `invoices-list` service call: `200`
- Approved to invoice linkage:
  - `approved_quotes=23`
  - `invoices_total=36`
  - `approved_without_invoice=0`
- Full runtime harness (`scripts/prove-a-exec-2-staging.mjs`, `NO_STRIPE=1`): PASS
  - `run_id=aexec2stg_81e8fdbf`
  - `public-quote` 200
  - `public-invoice` 200
  - `public-quote-approve` burst 200
  - `public-pay` initiation checks returned valid `payment_intent_id`
  - quote refresh burst did not create follow-up task spam

Implication:
- Backend/API path for proposals + invoices is healthy at this checkpoint.
- If UI still shows empty proposals/invoices, treat it as deployment cache/build mismatch first (not an edge/CORS outage).

### G. Build reproducibility
- Status: BLOCKED IN CURRENT SHELL
- Notes:
  - `npm run build` failed in this shell with `spawn EPERM` while loading Vite/esbuild config.
  - Needs rerun in clean local shell/session to confirm deterministic build.

## Next Cleanup Action (Safe Sequence)
1. Freeze and tag keep paths above.
2. Remove quarantine paths from deployment scope (not necessarily delete yet; move/backup first).
3. Rebuild and publish only from `command-center/dist`.
4. Run final E2E smoke:
   - Send estimate
   - Approve from email
   - Confirm approval page
   - Confirm quote status change + work order creation
   - Create invoice from work order and confirm invoice visibility in invoice UI

## Decision Point After Smoke
- If smoke passes end-to-end from keep set only: proceed with structured cleanup of quarantined paths.
- If smoke fails: fix only inside keep paths; do not reintroduce mirror trees.

## Locked Phase 1 (90-Day Freeze) - Billing and Flow Policy

This section is the operational freeze contract for Phase 1. Any exception is P0-only (security, legal/compliance, data integrity, or revenue-blocking outage).

### Entity hierarchy
1. Quote
2. Work Order (auto-created on quote approval)
3. Invoice(s)
4. Payment(s)

### Quote rules
- Statuses: `draft`, `sent`, `approved`, `rejected`, `expired`
- Approved quote is read-only.
- Quote total is the contract ceiling unless changed by approved change-order logic.

### Work order rules
- Statuses: `open`, `scheduled`, `in_progress`, `ready_to_invoice`, `completed`, `closed`, `cancelled`
- Work order cannot be closed unless:
  - status is `completed`
  - balance is `0`

### Invoice rules (flexible, controlled)
- Invoice types: `deposit`, `progress`, `final`
- Invoice allowed only if:
  - linked work order exists
  - work order is not `cancelled`
  - invoice type is selected
  - remaining balance is auto-calculated
  - partner approval is recorded before release
- No manual balance math.
- No orphan invoice.

### Deposit thresholds
- Under `$4,000`: no deposit
- `$4,000` to `$15,000`: 40% deposit
- Above `$15,000`: structured deposit + progress billing

### Explicitly deferred until after freeze
- Milestone engine objects and milestone-level gating
- Enterprise AR automation trees
- Franchise-enforcement rule packs

## Phase 1 UX Scope (Pricebook + Operating Metrics)

### Pricebook selection UX (implemented in Proposal Builder)
- Category-first filter chips to reduce scroll hunting.
- Search filter across code/name/category/description.
- Quick-pick buttons for high-frequency services.
- Quick-build templates for common quote patterns.
- Existing pricing source-of-truth remains unchanged (`price_book` + `quote_items`).

### Operator visibility (implemented in CRM Hub)
- Close rate card:
  - won quotes (`accepted`/`approved`) divided by actioned quotes
- Money generated card:
  - paid invoices + partial collected amount

Purpose: make the live CRM usable now for close-rate and cash tracking while Phase 1 POS flow stabilizes.

## Deployment Update - 2026-02-24

### Edge functions deployed (production project: `wwyxohjnyqnegzbxtuxs`)
- `send-estimate` version `87` at `2026-02-24 21:04:30 UTC`
- `public-quote` version `23` at `2026-02-24 21:04:53 UTC`
- `public-quote-approve` version `39` at `2026-02-25 03:06:38 UTC`
- `kanban-move` version `9` at `2026-02-25 03:06:15 UTC`

### Policy behavior now live in functions
- Quote validity window set to 7 days when `send-estimate` sends.
- Quote `status='sent'`, `sent_at`, and `valid_until` stamped at send time.
- Public approval blocks expired quotes (returns `QUOTE_EXPIRED` and does not approve).
- Public quote view disables approve/decline actions when quote is expired.
- Email body includes:
  - 72-hour scheduling-priority hold
  - 30-day honored pricing after acceptance

### Frontend build artifacts prepared
- Build completed locally with current code.
- Deployment archive created: `dist-deploy-20260224-161105.zip`
- `dist/index.html` last build timestamp: `2026-02-24 15:52:58` (local)

### Remaining manual production step
- Upload `dist` contents (or unzip deployment archive) to `app.bhfos.com/public_html`.
- Run live smoke from production email link:
  1. Send quote
  2. Approve quote
  3. Confirm `/quote-confirmation` page lands
  4. Confirm quote status + job creation
  5. Create/send invoice from CRM against created work order

### Update - Jobs Scheduling Bridge (2026-02-25)
- `src/pages/crm/Jobs.jsx` now includes an explicit **Schedule** action for `UNSCHEDULED`/`pending_schedule` jobs.
- New scheduling modal captures:
  - start date/time
  - duration (minutes)
  - optional technician assignment
  - service address
- Schedule confirm updates job row to `status='scheduled'` with `scheduled_start`/`scheduled_end` and optional `technician_id`.
- This closes the immediate operational gap between quote approval (`UNSCHEDULED` job) and dispatch-ready state.

### Update - Schedule & Dispatch Board (2026-02-25)
- `src/pages/crm/Schedule.jsx` now includes a dedicated **Work Order Dispatch** section in `/crm/schedule`.
- New dispatch tabs: `Unscheduled`, `Scheduled`, `In Progress`, `Completed`, `All`.
- Ops can now execute the core lifecycle from one screen:
  - `UNSCHEDULED`/`pending_schedule` -> **Schedule**
  - `scheduled`/`pending_schedule`/`on_hold` -> **Start**
  - `in_progress` -> **Complete**
- Scheduling modal added on `/crm/schedule` (start, duration, technician, service address) using same update pattern as Jobs page.
- Existing appointment request management remained active below the dispatch section at this checkpoint.
- Future direction is now explicitly different:
  - Schedule should stay execution-only.
  - Appointment intake should move to Call Console.
  - See `docs/reconciliation/10_schedule_call_console_future_work.md`.
- Production compatibility fix: removed embedded `jobs -> technicians` select in this screen and now resolves technician names from the separately fetched `technicians` list. This avoids PostgREST schema-cache relationship errors on tenants without that FK relation.

### Update - Work Order Numbering + Address Guardrail (2026-02-25)
- Added migration: `supabase/migrations/20260225201000_add_work_order_sequence_and_job_fields.sql`
  - Adds/normalizes jobs fields used by dispatch (`work_order_number`, `job_number`, `quote_number`, `scheduled_start`, `scheduled_end`, `technician_id`, `service_address`, `payment_status`, `total_amount`, `priority`, `access_notes`).
  - Adds `work_order_sequences` table.
  - Adds atomic DB function `public.next_work_order_number(tenant, created_at)` that returns `WO-YYYY-XXXX`.
  - Adds unique index on `(tenant_id, work_order_number)` (non-null rows).
- Updated `supabase/functions/public-quote-approve/index.ts`
  - On quote approval, attempts DB-atomic WO allocation via `next_work_order_number`.
  - Copies service address from lead property relation into job at creation.
  - Stores `work_order_number` + `job_number` + `quote_number` + `total_amount` + `payment_status='unpaid'` on job creation where schema supports it.
  - Includes backward-compatible fallback insert if a column is missing, so approval flow does not break during staged rollout.
- Updated `supabase/functions/kanban-move/index.ts`
  - Applies same WO numbering/address strategy when jobs are created from Kanban transitions.
- Updated scheduling UI guardrails:
  - `src/pages/crm/Schedule.jsx` and `src/pages/crm/Jobs.jsx` now require `Service Address` before confirming schedule.
  - Dispatch cards/modal now show improved WO label and reference context (legacy-safe fallback for older jobs).

### Update - Phase 1 Invoice Guardrails (2026-02-25)
- Added migration: `supabase/migrations/20260225213000_phase1_invoice_guardrails.sql`
  - Adds invoice fields: `invoice_type`, `release_approved`, `release_approved_at`, `release_approved_by`.
  - Drops one-invoice-per-work-order unique index to allow phased billing (`deposit/progress/final`).
  - Adds trigger guardrails on `invoices`:
    - requires linked work order
    - blocks cancelled work-order billing
    - requires release approval before `status='sent'`
    - blocks totals exceeding linked work-order contract amount
- Updated `supabase/functions/kanban-move/index.ts`
  - Auto-created invoice rows are now `draft` (not `sent`) with `invoice_type='final'`.
  - Existing invoice lookup now safely limits to one row if job has multiple invoices.
- Updated `src/pages/crm/InvoiceBuilder.jsx`
  - Billing blocked only when work-order status is missing or `cancelled` (per locked policy).
  - Existing release approval + remaining balance checks retained before send.

### Update - Quote Address Enforcement (2026-02-26)
- Added migration: `supabase/migrations/20260226073000_add_quotes_service_address.sql`
  - Adds `quotes.service_address` for quote-stage address capture.
  - Includes best-effort backfill from `leads.property_id -> properties`.
- Updated `src/pages/crm/proposals/ProposalBuilder.jsx`
  - Service address is now required before quote save/send.
  - Service address input is visible in Customer Information.
  - Selecting a lead auto-populates service address from lead property when available.
- Updated `supabase/functions/send-estimate/index.ts`
  - Send guardrail now blocks email sends when service address is missing.
  - Email summary includes service address.
- Updated `supabase/functions/public-quote-approve/index.ts`
  - Work-order creation now prefers `quotes.service_address` and falls back to lead property address.

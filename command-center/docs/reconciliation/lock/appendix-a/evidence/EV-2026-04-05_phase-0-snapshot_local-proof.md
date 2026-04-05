# EV-2026-04-05 — Phase 0 Snapshot (P0-01 + P0-02 Local Proof)

## DO NOT CLAIM

- Do **not** claim “production-safe”, “ready to push”, or “Phase 0 READY” based on this snapshot.
- This is **local proof only** (local Supabase at `http://127.0.0.1:25431`).
- P0-02 is “done” for **local governance close** only; production readiness is gated by ticket `P0-02-PROD-VALIDATION`.
- Any future patch touching money-write paths must re-prove:
  - **dual idempotency** (event + money)
  - **concurrency-safe settlement** (invoice row locking + settlement derived from ledger/applications)

---

## Repo / Runtime

- Repo: `c:\BHFOS\command-center`
- Local Supabase: `http://127.0.0.1:25431`

## Minimal Env (for Node proof runners)

These proof runners read env vars and will 401 if the service key is missing/wrong:

- `SUPABASE_EDGE_URL` (default: `http://localhost:25431/functions/v1`)
- `SUPABASE_REST_URL` (default: `http://localhost:25431/rest/v1`)
- `SUPABASE_SERVICE_KEY` (service role key for the local project)
- `SUPABASE_ANON_KEY` (optional for some tests)
- `TEST_MODE=true` (required for local-only bypasses)

---

## Governance Status (2026-04-05)

- Phase 0 overall: **NOT_READY** until foundational locks are proven and follow-on gates are completed.
- P0-01: **LOCAL_PROVEN** (tenant isolation for public endpoints).
- P0-02 (B/C/D/E): **LOCAL_PROVEN** (money model lock locally proven).
- Production validation is explicitly tracked as a follow-on gate:
  - `docs/tickets/TICKET_P0-02_production-validation_post-local-gate.md`
  - Board: `tmp/tickets_board.md` (`P0-02-PROD-VALIDATION`)

---

## P0-01 — Tenant Isolation Lock (Public Endpoints)

### What changed (enforced)

- Public tenant resolution is **token-derived + mismatch-reject**.
- No `tenant_id || 'tvg'` fallback.

### Patched endpoints

- `supabase/functions/public-quote/index.ts`
- `supabase/functions/public-invoice/index.ts`
- `supabase/functions/public-pay/index.ts`
- `supabase/functions/public-quote-approve/index.ts`

### Proof artifacts

- Tests:
  - `supabase/tests/node/p0_01_tenant_isolation.test.js`
  - `supabase/tests/node/run-p0-01.js`
- Log: `tmp/p0-01-tenant-isolation-test.log`
- Evidence: `docs/reconciliation/lock/appendix-a/evidence/EV-2026-04-04_P0-01_tenant-isolation-lock.md`

---

## P0-02 — Money Model Lock (B/C/D/E locally proven)

### Shared doctrine (all slices)

- Settlement truth derives from **`public.transaction_applications`** joined to **successful** transactions.
- Patched paths must not treat additive mutation of “amount paid” as authoritative; recompute/derive from the ledger/applications.

### P0-02.B — Offline/Manual Writer Rebuild (Ledger-first)

- Minimum ledger primitives:
  - `public.transactions`
  - `public.transaction_applications`
  - `public.recalculate_invoice_settlement(invoice_id uuid)`
- Manual payment path is **duplicate-safe**, **reference-validated**, and **settlement-backed**.

Migrations (exact):
- `supabase/migrations/20260404203000_p0_02b_offline_manual_ledger.sql`
- `supabase/migrations/20260404204000_p0_02b_fix_record_offline_manual_payment.sql`
- `supabase/migrations/20260404205000_p0_02b_fix_tx_application_conflict.sql`
- `supabase/migrations/20260404235000_p0_02b_enforce_amount_precision.sql`

Artifacts:
- Evidence: `docs/reconciliation/lock/appendix-a/evidence/EV-2026-04-04_P0-02B_offline-manual-payment-writer.md`
- Log: `tmp/p0-02b-offline-manual-payment-test.log`
- Tests: `supabase/tests/node/p0_02b_offline_manual_payment.test.js` + `supabase/tests/node/run-p0-02b.js`

### P0-02.C — Webhook Rebuild (Dual Idempotency + Concurrency-safe Settlement)

- Event idempotency: `gateway_event_id`
- Financial idempotency: `provider_payment_id` / `provider_reference`
- Canonical ingest path: `public.record_stripe_webhook_payment(...)` (DB RPC)
- Concurrency safety: invoice row locking inside the RPC via `SELECT ... FOR UPDATE`

Migrations (exact):
- `supabase/migrations/20260404210000_p0_02c_webhook_rebuild_support.sql`
- `supabase/migrations/20260404221500_p0_02c_fix_webhook_rpc_idempotency.sql`
- `supabase/migrations/20260404223000_p0_02c_fix_webhook_rpc_conflict_target.sql`

Artifacts:
- Edge: `supabase/functions/payment-webhook/index.ts`
- Evidence: `docs/reconciliation/lock/appendix-a/evidence/EV-2026-04-04_P0-02C_payment-webhook-rebuild.md`
- Log: `tmp/p0-02c-payment-webhook-test.log`
- Tests: `supabase/tests/node/p0_02c_payment_webhook.test.js` + `supabase/tests/node/run-p0-02c.js`

### P0-02.D — Public-pay Boundary (Initiation-only + Duplicate-safe + Webhook Convergence)

- `public-pay` creates/updates a **public payment attempt** only.
- `public-pay` creates **0 transactions** and **0 applications**.
- Financial effect converges via `provider_payment_id` which webhook later uses to create the single financial effect.

Migrations (exact):
- `supabase/migrations/20260404230000_p0_02d_public_pay_initiation_attempts.sql`

Artifacts:
- Evidence: `docs/reconciliation/lock/appendix-a/evidence/EV-2026-04-04_P0-02D_public-pay-initiation-boundary.md`
- Log: `tmp/p0-02d-public-pay-test.log`
- Tests: `supabase/tests/node/p0_02d_public_pay.test.js` + `supabase/tests/node/run-p0-02d.js`

### Hardening applied post-D critique (exact artifacts)

- Webhook bypass gated to **local + explicit test mode**:
  - `supabase/functions/payment-webhook/index.ts`
- `invoices.provider_payment_id` made **DB-immutable once set**:
  - `supabase/migrations/20260404234000_p0_02d_invoice_provider_payment_id_immutability.sql`
- Webhook env var normalized: canonical `STRIPE_WEBHOOK_SECRET`
- Canonical event dedupe indexes:
  - `supabase/migrations/20260404234500_p0_02_event_dedupe_indexes.sql`
- Review gate: `npm run review:gate` passes (local)

### P0-02.E — Reconciliation Tools + Sweep Convergence (Detective + Recovery Router)

Tools:
- Queue: `public.reconciliation_queue`
- RPCs:
  - `public.reconcile_apply_webhook_transaction_to_invoice(...)`
  - `public.reconcile_capture_legacy_invoice_opening_balance(...)`

Sweep:
- Entry: `public.p0_02e_run_sweep(p_min_age_minutes, p_limit)`
- Recovery routes through the canonical pipeline:
  - `public.record_stripe_webhook_payment(...)`
  - deterministic `gateway_event_id = sweep:<provider_payment_id>`
- Drift detection flags only (`reconciliation_required`), never patches totals.
- Alert latch:
  - `public.reconciliation_alerts`
  - `public.ensure_reconciliation_alert(...)` (deterministic `alert_key`)

Sweep overlap model (important nuance):
- Overlap safety is **dedupe/idempotency-based**, not “single-worker/lock-based”.
- Duplicate sweep attempts can happen; financial uniqueness is enforced by DB constraints + deterministic ids, preventing double financial effects.

Migrations (exact):
- `supabase/migrations/20260405001000_p0_02e_reconciliation_tools.sql`
- `supabase/migrations/20260405002000_p0_02e_fix_legacy_capture_currency.sql`
- `supabase/migrations/20260405004000_p0_02e_sweep_recovery.sql`
- `supabase/migrations/20260405011000_p0_02e_sweep_recovery_v2.sql`

Artifacts:
- Evidence: `docs/reconciliation/lock/appendix-a/evidence/EV-2026-04-04_P0-02E_reconciliation-tools.md`
- Logs:
  - `tmp/p0-02e-reconciliation-test.log`
  - `tmp/p0-02e-sweep-test.log`
- Tests:
  - Tools: `supabase/tests/node/p0_02e_reconciliation.test.js` + `supabase/tests/node/run-p0-02e.js`
  - Sweep: `supabase/tests/node/p0_02e_sweep.test.js` + `supabase/tests/node/run-p0-02e-sweep.js`

---

## Tickets / Tracking

- Tickets board (declared single source in-repo): `tmp/tickets_board.md`
- Production validation gate:
  - `P0-02-PROD-VALIDATION` → `docs/tickets/TICKET_P0-02_production-validation_post-local-gate.md`
- Sweep survivability test-spec/hardening:
  - `P0-02E-SWEEP-HARDEN` → `docs/tickets/TICKET_P0-02E_sweep-production-survivability_test-spec.md`

If the team uses an external tracker/board, mirror these IDs there to avoid split tracking.

---

## How to rerun the key local proofs

- P0-01: `node supabase/tests/node/run-p0-01.js`
- P0-02.B: `node supabase/tests/node/run-p0-02b.js`
- P0-02.C: `node supabase/tests/node/run-p0-02c.js`
- P0-02.D: `node supabase/tests/node/run-p0-02d.js`
- P0-02.E tools: `node supabase/tests/node/run-p0-02e.js`
- P0-02.E sweep: `node supabase/tests/node/run-p0-02e-sweep.js`
- Review gate: `npm run review:gate`


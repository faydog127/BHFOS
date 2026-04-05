# EV-2026-04-04 — P0-02.E Reconciliation Tools (Local Proof)

## Summary

Objective: implement the missing “sweep later” layer so the system can deterministically resolve:

- webhook quarantines (unmapped payments, legacy-state quarantines)
- invoices flagged `reconciliation_required`
- legacy invoice money state without ledger (capture opening balance into ledger)

This is **local proof** only.

## Scope (Covered)

- DB view + RPCs:
  - `supabase/migrations/20260405001000_p0_02e_reconciliation_tools.sql`
  - `supabase/migrations/20260405002000_p0_02e_fix_legacy_capture_currency.sql`
- Tests:
  - `supabase/tests/node/p0_02e_reconciliation.test.js`
  - `supabase/tests/node/run-p0-02e.js`
- Output log:
  - `tmp/p0-02e-reconciliation-test.log`

## Coverage Boundary (Not Covered)

- UI for reconciliation (queue viewer / operator tooling)
- automated reconciliation heuristics
- refunds / reversals

## Reconciliation Surfaces (What E introduces)

### Operational queue

- View: `public.reconciliation_queue`
  - includes `invoices.reconciliation_required = true`
  - includes `stripe_webhook_events.reconciliation_required = true`

### Resolution RPCs (service-role only)

- `public.reconcile_apply_webhook_transaction_to_invoice(transaction_id, invoice_id, actor_user_id, note)`
  - applies a quarantined webhook `transactions` row to a known invoice via `transaction_applications`
  - binds tenant_id + invoice_id onto the transaction
  - clears reconciliation flags
  - updates webhook event row(s) to `processed_reconciled`

- `public.reconcile_capture_legacy_invoice_opening_balance(invoice_id, actor_user_id, note)`
  - for invoices with legacy `amount_paid > 0` and **no** ledger apps:
    - creates a ledger transaction (`source=legacy_import`)
    - creates a single application mapping
    - recomputes settlement (`recalculate_invoice_settlement`)
    - clears reconciliation flags

## Proof (Local)

### Test runner

- Runner: `supabase/tests/node/run-p0-02e.js`
- Log: `tmp/p0-02e-reconciliation-test.log`

### Proof objects (from the test log)

- `PROOF:p0_02e_legacy_capture`
  - legacy invoice opening balance captured into ledger
  - 1 transaction_application created
  - invoice reconciliation flag cleared

- `PROOF:p0_02e_quarantine_apply`
  - quarantined webhook transaction applied to a known invoice
  - 1 application created
  - webhook event reconciliation cleared and invoice_id set

## Sweep Convergence Addendum (2026-04-04)

Objective: prove `.E` acts as a **verifier + recovery router** (not a second settlement engine) across the required branches:

- dropped webhook recovery (replay canonical finalization)
- ghost intent cleanup (no financial effect)
- settlement drift detection (flag + alert only; no ad hoc math)
- ambiguous association quarantine (no application; alert only)
- legacy/corrupt invoice receives valid external money (ingest truth + flag reconciliation)
- sweep idempotency (rerun is no-op financially)
- late webhook vs sweep race (converges to one transaction/application/effect)
- batch safety (mixed batch branches + accurate summary counts)

Scope (Additive):

- DB:
  - `supabase/migrations/20260405004000_p0_02e_sweep_recovery.sql` (baseline sweep harness)
  - `supabase/migrations/20260405011000_p0_02e_sweep_recovery_v2.sql` (alert latch + corrected sweep)
- Tests:
  - `supabase/tests/node/p0_02e_sweep.test.js`
  - `supabase/tests/node/run-p0-02e-sweep.js`
- Output log:
  - `tmp/p0-02e-sweep-test.log`

Proof objects (from the sweep test log):

- `PROOF:p0_02e_sweep_recovery` (canonical recovery)
- `PROOF:p0_02e_sweep_ghost_cleanup` (ghost intent cleanup)
- `PROOF:p0_02e_sweep_drift_flag` (drift flagged; not fixed)
- `PROOF:p0_02e_sweep_ambiguous_quarantine` (quarantine surfaced; no application)
- `PROOF:p0_02e_sweep_legacy_ingest_flag` (legacy ingest + flag)
- `PROOF:p0_02e_sweep_idempotent` (rerun no-op)
- `PROOF:p0_02e_sweep_race_converged` (late webhook vs sweep race converged)
- `PROOF:p0_02e_sweep_batch` (batch summary correctness)

## Rollback Note

- These changes are additive (view + functions).
- Rollback is to remove the reconciliation functions/view and revert any operational usage.

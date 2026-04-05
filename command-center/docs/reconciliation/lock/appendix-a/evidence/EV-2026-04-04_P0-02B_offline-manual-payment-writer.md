# EV-2026-04-04 — P0-02.B Offline/Manual Payment Writer Rebuild

## Summary
- Objective: rebuild `invoice-update-status` manual/offline payment path to be **ledger-first**, **duplicate-safe**, and **settlement-backed**.
- Result (local): manual payments now create:
  - `payment_attempts` row
  - `transactions` row
  - `transaction_applications` row
  - invoice projection recomputed via `recalculate_invoice_settlement(invoice_id)`

## Scope (explicit)
- Schema (manual/offline only):
  - `supabase/migrations/20260404203000_p0_02b_offline_manual_ledger.sql`
  - `supabase/migrations/20260404204000_p0_02b_fix_record_offline_manual_payment.sql`
  - `supabase/migrations/20260404205000_p0_02b_fix_tx_application_conflict.sql`
- Settlement function:
  - `public.recalculate_invoice_settlement(uuid)` (in migration above)
- Manual writer:
  - `supabase/functions/invoice-update-status/index.ts`
- Tests + artifacts:
  - `supabase/tests/node/p0_02b_offline_manual_payment.test.js`
  - `supabase/tests/node/run-p0-02b.js`
  - `tmp/p0-02b-offline-manual-payment-test.log`
  - `tmp/p0-02b-db-proof.json`
  - `tmp/p0-02b-additive-mutation-scan.log`

## Out of scope (explicit)
- `supabase/functions/public-pay/index.ts`
- `supabase/functions/payment-webhook/index.ts`
- refunds / chargebacks / reversals
- event taxonomy redesign

## Hard rules (verified in scope)
- No authoritative additive mutation in the manual/offline writer path (`amount_paid += x`): `tmp/p0-02b-additive-mutation-scan.log`
- Settlement effect requires `transaction_applications` (no “ledger row only” settlement)
- Duplicate manual reference (normalized) returns existing transaction id and does not emit canonical payment event

## Duplicate response contract (implemented)
Minimum fields are present on manual/offline responses:
- First write:
  - `ok: true`
  - `duplicate: false`
  - `transaction_id: <new>`
  - `financial_effect_created: true`
  - `event_emitted: true`
- Duplicate:
  - `ok: true`
  - `duplicate: true`
  - `transaction_id: <existing>`
  - `financial_effect_created: false`
  - `event_emitted: false`

Compatibility:
- Response still includes `invoice` for existing UI consumers.

## Settlement function contract (implemented)
`recalculate_invoice_settlement(invoice_id)`:
- reads settlement-eligible applications (`transaction_applications`) joined to successful transactions (`transactions.status` in `succeeded|paid|success`)
- computes:
  - `amount_paid`
  - `balance_due`
  - `settlement_status` (`unpaid|partial|paid`)
  - `last_payment_at`
- updates invoice fields only through this recompute step (manual writer does not compute totals in application code).

## Manual reference contract (implemented)
Edge validation (function):
- trims + collapses whitespace
- rejects:
  - blank/whitespace
  - length < 4
  - 1–3 digit junk
  - banned low-signal values: `cash|paid|manual|offline|na|n/a|none|unknown|test`

DB validation (function `record_offline_manual_payment`):
- applies the same normalization + banned/low-signal rejection server-side
- enforces duplicate protection via uniqueness on `(tenant_id, invoice_id, manual_reference_norm)`.

## Atomicity model (explicit)
- Implemented as a **single DB transaction** inside `public.record_offline_manual_payment(...)`:
  - upsert attempt
  - insert/resolve transaction idempotently
  - insert application idempotently
  - update attempt resolution
  - recompute invoice settlement

## Legacy invoice handling (explicit)
Behavior:
- If `invoices.amount_paid > 0` **and** there are **no** `transaction_applications` for that invoice:
  - manual/offline payment recording is blocked with error `LEGACY_MONEY_STATE_MIGRATION_REQUIRED`.

Reason:
- Prevents silently overwriting historical mutable money state with a partial ledger (dual truth / reconciliation failure).

## Proof (local)
- Test run:
  - `tmp/p0-02b-offline-manual-payment-test.log`
- DB proof objects (rows + responses + reconciliation snapshot):
  - `tmp/p0-02b-db-proof.json`

Verified cases (from tests):
- first manual payment → creates attempt + transaction + application; invoice becomes `partial`
- duplicate manual payment (same reference) → same `transaction_id`, no new financial effect
- second manual payment → invoice becomes `paid`
- banned manual reference rejected (`400`)
- legacy invoice without ledger blocked

## Hardening Addendum (2026-04-04)

- Concurrency duplicate replay proof:
  - Test asserts concurrent same manual reference produces exactly **1** `transaction_application` and exactly **1** `OfflinePaymentRecorded` event.
- Amount precision discipline:
  - Migration: `supabase/migrations/20260404235000_p0_02b_enforce_amount_precision.sql`
  - Test asserts amounts with >2 decimals are rejected (`AMOUNT_PRECISION_INVALID` → `400`).
- Canonical event dedupe:
  - Index: `supabase/migrations/20260404234500_p0_02_event_dedupe_indexes.sql` (`events_offline_payment_recorded_tx_uq`)

## Rollback note
Rollback (local/dev):
- Stop using the manual/offline path in `invoice-update-status` (revert file) and redeploy edge functions.
- DB rollback should be controlled:
  - these migrations are additive (new tables + new columns + functions)
  - do not drop ledger tables without an explicit data retention decision.

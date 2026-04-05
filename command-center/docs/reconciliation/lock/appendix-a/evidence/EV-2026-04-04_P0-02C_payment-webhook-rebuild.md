# EV-2026-04-04 — P0-02.C Payment Webhook Rebuild (Local Proof)

## Summary

Objective: rebuild `payment-webhook` to be **transaction-first**, **dual-idempotent** (event + money), and **concurrency-safe** for invoice settlement.

This evidence packet is **local proof** only (not production proof).

## Scope (Covered)

- Edge function:
  - `supabase/functions/payment-webhook/index.ts`
- DB support + ingestion RPC:
  - `supabase/migrations/20260404210000_p0_02c_webhook_rebuild_support.sql`
  - `supabase/migrations/20260404221500_p0_02c_fix_webhook_rpc_idempotency.sql`
  - `supabase/migrations/20260404223000_p0_02c_fix_webhook_rpc_conflict_target.sql`
- Tests:
  - `supabase/tests/node/p0_02c_payment_webhook.test.js`
  - `supabase/tests/node/run-p0-02c.js`

## Coverage Boundary (Not Covered)

- `public-pay` refactor
- refunds / reversals / chargebacks
- UI changes
- event taxonomy redesign

## Locked Doctrine (What This Patch Enforces)

### Dual Idempotency

- **Network/event idempotency** keyed by `gateway_event_id` (`stripe_webhook_events.event_id`).
- **Financial idempotency** keyed by canonical `provider_payment_id` (Stripe PaymentIntent ID when available).

### Concurrency Safety

- Webhook ingestion uses an **invoice row lock** (`SELECT ... FOR UPDATE`) inside the RPC.
- Settlement recomputation is executed after each application and is safe under concurrent payments.

## Implementation Notes (High-Load-Bearing)

### Canonical `provider_payment_id` derivation

- `payment_intent.*` events: use object `id` (PaymentIntent ID).
- `charge.*` events: prefer `payment_intent` reference (so `charge.succeeded` + `payment_intent.succeeded` converge to the same financial idempotency key).

### Money write model

- No additive mutation of authoritative money truth.
- Financial effect is created only by inserting a `transaction_application`, followed by settlement recompute.
- Duplicate replay does not create a second application and does not emit a second canonical payment event.

## Proof (Required)

### Test Runner

- Runner: `supabase/tests/node/run-p0-02c.js`
- Output log: `tmp/p0-02c-payment-webhook-test.log`

### Proof Objects (From the Test Log)

The test log prints structured proof lines:

- `PROOF:event_replay`:
  - same `gateway_event_id` replay
  - **1** `stripe_webhook_events` row
  - **1** webhook transaction row
  - **1** application row
  - invoice `amount_paid` matches applied amount

- `PROOF:financial_idempotency`:
  - two different `gateway_event_id`s referencing the same **PaymentIntent**
  - **1** webhook transaction row
  - **1** application row
  - invoice `amount_paid` matches applied amount

- `PROOF:concurrency`:
  - two concurrent successful payments to the same invoice
  - **2** application rows
  - sum(applications) == invoice `amount_paid`
  - invoice `balance_due` reflects correct derived value

## Stop Conditions Check

All P0-02.C stop conditions are **NOT triggered** in local proof:

- duplicate replay did **not** create more than one application
- different events for one payment did **not** create more than one transaction/application
- concurrent payments produced correct final settlement (no last-writer-wins drift)

## Proof Completion Addendum (2026-04-04)

Additional proof gaps closed (tests added and passing):

- Out-of-order handling:
  - late `payment_intent.payment_failed` after success is **non-financial** (no new application, no settlement change).
- Ambiguous association:
  - unmapped payment creates **transaction only** (invoice_id null), **no application**, flagged quarantine/reconciliation.
- Legacy/corrupt invoice handling:
  - valid external money is ingested as a transaction, but **application is quarantined** and invoice flagged `reconciliation_required`.
- Canonical event dedupe assertions:
  - replay does not create duplicate `PaymentSucceeded` / `InvoicePaid` (guarded by `supabase/migrations/20260404234500_p0_02_event_dedupe_indexes.sql`).

## Operational Notes

- Local webhook signature verification is exercised by the test pack.
- If local edge runtime secrets differ between `.env` and `supabase/.env`, align your configuration so `STRIPE_WEBHOOK_SECRET` is consistent (avoid split sources).

## Rollback Note

- Rollback is safe by reverting:
  - `payment-webhook` to prior behavior (event receipt only)
  - DB RPC(s) introduced/overridden by the P0-02.C migrations

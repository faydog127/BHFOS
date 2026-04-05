# EV-2026-04-04 — P0-02.D Public-Pay Initiation Boundary (Local Proof)

## Summary

Objective: rebuild `public-pay` so it:

- **initiates** payment only (never becomes a second money authority)
- is **duplicate-safe** under retries/double-click/refresh
- converges with webhook settlement on the same **provider_payment_id**
- enforces **server-authoritative amount validation**
- preserves **P0-01 tenant isolation** (token-derived tenant + mismatch rejection)

This packet is **local proof** only.

## Scope (Covered)

- Edge function:
  - `supabase/functions/public-pay/index.ts`
- DB schema:
  - `supabase/migrations/20260404230000_p0_02d_public_pay_initiation_attempts.sql`
- Tests:
  - `supabase/tests/node/p0_02d_public_pay.test.js`
  - `supabase/tests/node/run-p0-02d.js`
- Output log:
  - `tmp/p0-02d-public-pay-test.log`

## Coverage Boundary (Not Covered)

- UI changes (`src/pages/public/PaymentPage.jsx` untouched)
- refunds / reversals
- event taxonomy redesign
- non-public payment writers (`invoice-update-status`, `payment-webhook` already covered elsewhere)

## Locked Doctrine (What This Patch Enforces)

### 1) Initiation is not settlement

- `public-pay` **must not**:
  - write `transactions`
  - write `transaction_applications`
  - mutate invoice settlement (`amount_paid += x`)
  - claim "paid" on initiation
- `public-pay` **may**:
  - create/resolve an initiation attempt record
  - return a checkout URL (initiation success only)
  - record `provider_payment_id` linkage for webhook convergence

### 2) Duplicate safety

- DB-backed idempotency prevents multiple uncontrolled provider objects for the same initiation attempt.
- Replays and concurrent calls return the same initiation outcome.

### 3) Convergence with webhook settlement

- `public-pay` returns and stores a canonical `provider_payment_id` (Stripe PaymentIntent id).
- `payment-webhook` uses that same `provider_payment_id` as financial idempotency key.

### 4) Server-authoritative amount

- The amount to charge is derived from the invoice server-side.
- If the client submits a mismatched amount, `public-pay` rejects with `400 Amount mismatch`.

### 5) Tenant isolation

- Tenant is derived from the token-bound invoice record.
- Request-supplied `tenant_id` is validation-only; mismatches reject with `403`.

## Evidence / Proof

### Test runner

- Runner: `supabase/tests/node/run-p0-02d.js`
- Log: `tmp/p0-02d-public-pay-test.log`

### Proof objects

The test emits:

- `PROOF:p0_02d` with:
  - initiation created **0** transactions
  - initiation created **0** applications
  - exactly **1** initiation attempt row
  - webhook settlement created **1** transaction + **1** application
  - invoice `amount_paid` == expected amount after webhook

## Stop Conditions Check

Stop conditions were **not** observed in local proof:

- repeated submit did not create multiple provider payment objects
- public-pay did not create final money effect
- client amount tampering was rejected
- tenant isolation mismatch was rejected
- initiation response did not imply paid (returns `payment_status: pending_confirmation`)

## Hardening Addendum (2026-04-04)

- Test-bypass invariant:
  - `x-test-pay: 1` is honored **only** when:
    - request is local, and
    - explicit test mode is enabled (`global_config.test_mode=true` or `TEST_MODE=true`)
- Provider pointer immutability (DB enforced):
  - Migration: `supabase/migrations/20260404234000_p0_02d_invoice_provider_payment_id_immutability.sql`
  - Once `invoices.provider_payment_id` is set, reassignment is blocked (`PROVIDER_PAYMENT_ID_IMMUTABLE`).
- Canonical initiation event dedupe:
  - Index: `supabase/migrations/20260404234500_p0_02_event_dedupe_indexes.sql` (`events_payment_initiated_checkout_session_uq`)

## Rollback Note

- Rollback by reverting `supabase/functions/public-pay/index.ts` and removing `public.public_payment_attempts`.
- Webhook settlement remains the canonical financial truth path (P0-02.C).

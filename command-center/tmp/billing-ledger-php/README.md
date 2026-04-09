# Billing Ledger PHP Skeleton (SQL-first, ledger-grade)

This folder is a **copy-friendly** PHP service-layer skeleton for the v1 billing ledger model:

- Append-only ledgers (`payment_allocations`, `credit_applications`, `invoice_writeoffs`)
- Clamp-at-zero invoice balances
- Deterministic lock order to avoid deadlocks
- DB-backed idempotency with **result replay**
- Partial, invoice-impacting refunds as atomic pairs:
  - `payment_refunds` row (processor truth)
  - negative `payment_allocations` row (invoice truth)

## Required SQL

- Idempotency replay registry: `tmp/billing-ledger-php/sql/0001_idempotency_registry.sql`
- Partial refund linkage: `tmp/billing-ledger-php/sql/0002_partial_refund_linkage.sql`
- Hardened views: `tmp/billing-ledger-php/sql/0003_views_balance_and_availability.sql`

## Lock order (non-negotiable)

To prevent deadlocks, every endpoint/service follows:

1. `idempotency_keys.begin(...)`
2. Lock funding object first:
   - payment: `payments ... FOR UPDATE`
   - credit memo: `credit_memos ... FOR UPDATE`
3. Lock invoice(s): `invoices ... FOR UPDATE ORDER BY invoice_record_id`
4. Lock dependent ledger rows last (only when needed), e.g. original allocation row for refund

## Idempotency semantics

The `IdempotencyRepo` stores a response payload in `idempotency_keys.response_json`:

- First request: inserts `in_progress`, runs operation, then updates to `completed` with `response_json`.
- Retry with same key+request: returns the prior response (no double-write).
- Reuse with different request: throws `ERR_IDEMPOTENCY_REUSE_MISMATCH`.

## Apply semantics: strict vs clamp

`ApplyPaymentService` / `ApplyCreditService` / `WriteOffService` support:

- `ApplyMode::STRICT`: reject if requested cents cannot be fully applied.
- `ApplyMode::CLAMP`: apply up to available amount (safe for “auto-apply” flows).

## Partial refunds (important)

This skeleton separates “mistake reversal” vs “refund adjustment”:

- Reversal (correcting an incorrect apply): negative row uses `reversal_of_payment_allocation_id` (1:1).
- Refund (processor refund impacting invoice): negative row uses `refund_of_payment_allocation_id` (many:1).

`RefundService::refundInvoiceImpacting(...)` enforces:

- Refund rows are append-only.
- Remaining refundable amount is derived as:
  - `original_applied - SUM(refund_adjustments)`

## Observability (thin hook)

Each money-moving service can emit a success event through `EventSink`:

- Interface: `tmp/billing-ledger-php/src/Contracts/EventSink.php`
- Default: `NullEventSink` (no-op)

Events are emitted **only on first execution**, not on idempotency replay.

## Files

- Contracts: `tmp/billing-ledger-php/src/Contracts/*`
- Repos (SQL): `tmp/billing-ledger-php/src/Repo/*`
- Services (business rules): `tmp/billing-ledger-php/src/Services/*`
- SQL addenda: `tmp/billing-ledger-php/sql/*`

# Billing Ledger Test Coverage Map (v1)

Goal: deployment confidence by covering **constraints**, **service behavior**, **concurrency**, **lifecycle sequences**, and **migration safety**.

This map reflects what is currently implemented under `tmp/billing-ledger-php/tests/*` (Docker + Postgres).

## 1) Constraint Tests (DB safety rails)

**Covered**
- Composite scope FK blocks cross-scope inserts:
  - Cross-payer insert fail (payment allocation): `tmp/billing-ledger-php/tests/001_invariants.sql:1`
  - Cross-currency insert fail (payment allocation): `tmp/billing-ledger-php/tests/003_constraints.sql:1`
  - Cross-billing-case insert fail (credit application): `tmp/billing-ledger-php/tests/003_constraints.sql:1`
- Sign discipline blocks illegal negative rows:
  - Negative allocation without reversal/refund link fails: `tmp/billing-ledger-php/tests/001_invariants.sql:1`
  - Negative allocation cannot be both reversal and refund adjustment: `tmp/billing-ledger-php/tests/001_invariants.sql:1`
- One-reversal-per-row uniqueness:
  - Duplicate reversal insert fails: `tmp/billing-ledger-php/tests/003_constraints.sql:1`
- `bigint` money columns: asserted structurally by the DDL under test:
  - Schema: `tmp/billing-ledger-php/sql/0000_schema.sql:1`
- Issued invoice immutability (optional trigger):
  - Trigger addendum: `tmp/billing-ledger-php/sql/0004_immutability_trigger.sql:1`
  - Mutation attempt fails: `tmp/billing-ledger-php/tests/003_constraints.sql:1`

**Gaps (DB-level)**
- Explicit constraint presence checks (pg_catalog assertions) for production migrations (names, columns, types).

## 2) Service Tests (valid operations behave correctly)

**Covered (DB-level behavior equivalents)**
- Balance-impacting status rules are correct via views:
  - Void invoice balance = 0: `tmp/billing-ledger-php/tests/001_invariants.sql:1`
  - Non-settled payments show 0 availability: `tmp/billing-ledger-php/tests/001_invariants.sql:1`
  - Non-issued credits show 0 availability: `tmp/billing-ledger-php/tests/001_invariants.sql:1`

**Gaps (true service-layer behavior)**
- Strict vs clamp mode behaviors (requires PHP runtime + DB):
  - Strict rejects partial apply, clamp applies min(...)
- Event emission / replay suppression (`EventSink`) assertions (requires PHP runtime).

## 3) Concurrency / Race Tests

**Covered**
- Two concurrent callers using the same idempotency key:
  - Second caller blocks and then replays: `tmp/billing-ledger-php/tests/002_concurrency.ps1:1`
- PHP service races against real DB:
  - apply-credit vs apply-credit on same credit memo balance: `tmp/billing-ledger-php/tests/006_php_race.ps1:1`
  - refund vs refund against same prior application: `tmp/billing-ledger-php/tests/006_php_race.ps1:1`

**Gaps**
- True money races require executable service code (row locks + caps), e.g.:
  - two concurrent applies against same invoice
  - apply vs refund race
  - credit memo apply races
  - (next) apply-payment vs apply-payment on same payment available
  - (next) apply-payment vs refund race on same payment/invoice

## 4) Replay / Recovery Tests

**Covered**
- Rollback after begin does not burn the key; retry is new:
  - `tmp/billing-ledger-php/tests/004_recovery.sql:1`
- Completed request replays prior response:
  - `tmp/billing-ledger-php/tests/004_recovery.sql:1`
- Same key + different hash is rejected (mismatch):
  - `tmp/billing-ledger-php/tests/001_invariants.sql:1`

**Gaps**
- “Crash after begin, before complete” persistence semantics (in-progress row) — requires a design decision:
  - TTL + reaper job, or “in_progress = duplicate” behavior, or an override/recovery workflow.

## 5) Ledger Lifecycle Sequence Tests (multi-step drift)

**Covered**
- Payment across multiple invoices + multiple partial refunds:
  - `tmp/billing-ledger-php/tests/005_lifecycle.sql:1`

**Gaps**
- Credit application reversal + re-apply to other invoice.
- Writeoff after partial payment + subsequent refund.
- Void invoice after allocation history (policy: balance view is zero, but downstream reporting rules must be explicit).

## 6) View / Query Contract Tests

**Covered**
- Views clamp + filter statuses as contract:
  - `tmp/billing-ledger-php/sql/0003_views_balance_and_availability.sql:1`
  - exercised in `001_invariants.sql`, `005_lifecycle.sql`.

**Gaps**
- Cross-check view outputs against raw ledger math for multiple fixtures (bigger matrix).

## 7) Migration / Rollback Safety

**Covered**
- Fresh install on empty DB + re-apply without error:
  - `tmp/billing-ledger-php/tests/run.ps1:1`

**Gaps**
- Real app migrations (Supabase `supabase/migrations/*`) need equivalent checks in `supabase/tests/node/*`.

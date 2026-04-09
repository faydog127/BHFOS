# Ledger Invariant Tests (Docker + Postgres)

Runs a disposable `postgres:16` container, applies the schema + SQL addenda, then executes:

- `001_invariants.sql` (DB invariants + view behavior + idempotency replay)
- `003_constraints.sql` (explicit DDL-break attempts)
- `004_recovery.sql` (rollback/retry semantics)
- `005_lifecycle.sql` (multi-step lifecycle sequences)
- `002_concurrency.ps1` (concurrent idempotency replay behavior)
- `006_php_race.ps1` (PHP services hitting real DB under race)

## Run

From repo root:

`pwsh -NoProfile -File tmp/billing-ledger-php/tests/run.ps1`

Race-only (fast path):

`pwsh -NoProfile -File tmp/billing-ledger-php/tests/run-races.ps1`

Soak (race-focused, 100 iterations; reuses one DB + one PHP image):

`pwsh -NoProfile -File tmp/billing-ledger-php/tests/soak-php-races.ps1 -Iterations 100`

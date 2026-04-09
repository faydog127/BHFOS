# EV-2026-04-08 — Billing Ledger Race + Soak (DB-backed)

## Status
- Status: `PASS`
- Date: `2026-04-08` (America/New_York)
- Owner: `Codex`
- Commit: `5862bf696f147cbbe13fb7a301b5cae4927236f5`

## What this proves
- DB-backed ledger services do not over-apply credit under contention (single-winner enforced by locks + caps).
- DB-backed refund adjustments do not exceed remaining refundable amount under contention.
- The above remains stable under repeated execution (100-iteration soak).

## How to reproduce (local)
- Full deck (schema re-apply + invariants + constraints + recovery + lifecycle + PHP races + concurrency):
  - `pwsh -NoProfile -File .\tmp\billing-ledger-php\tests\run.ps1`
- Race-only:
  - `pwsh -NoProfile -File .\tmp\billing-ledger-php\tests\run-races.ps1`
- Soak (100 iterations, reuses one DB + one PHP image):
  - `pwsh -NoProfile -File .\tmp\billing-ledger-php\tests\soak-php-races.ps1 -Iterations 100`

## Results (captured)
- Full deck: `ALL TESTS PASSED` (`tmp/billing-ledger-php/tests/run.ps1`)
- Race tests (PHP vs real Postgres):
  - Apply credit vs apply credit (strict mode): **1 success / 1 failure**, loser code `ERR_INSUFFICIENT_AVAILABLE`, final `credit_applications` sum = `2000`, remaining credit = `1000`. (`tmp/billing-ledger-php/tests/006_php_race.ps1`)
  - Refund vs refund against same original allocation: **1 success / 1 failure**, loser code `ERR_REFUND_EXCEEDS_REFUNDABLE`, final settled refunds = `1`, final refund-adjustment sum = `800`, invoice balance = `800`. (`tmp/billing-ledger-php/tests/006_php_race.ps1`)
- Soak: **100/100 PASS**, **0 FAIL** (logs: `tmp/billing-ledger-php/tests/_soak_php_race_logs/`).

## Artifact pointers
- Test harness + scripts:
  - `tmp/billing-ledger-php/tests/run.ps1`
  - `tmp/billing-ledger-php/tests/run-races.ps1`
  - `tmp/billing-ledger-php/tests/006_php_race.ps1`
  - `tmp/billing-ledger-php/tests/soak-php-races.ps1`
- Soak logs:
  - `tmp/billing-ledger-php/tests/_soak_php_race_logs/iter_###.log`

## Notes
- The soak runner intentionally reuses a single Postgres container and a single PHP runner image to keep a 100-iteration run under typical CI time limits.
- A NOTICE about missing triggers being skipped during migration re-apply is expected and does not affect correctness (the migrations drop-and-create triggers idempotently).


# Baseline — Ledger Lock (Layer 1–2)

Date locked: `2026-04-09` (America/New_York)

## Status

- Layer 1 (DB-backed ledger tests): **COMPLETE**
- Layer 2 (Orchestrator v2 judgment over observed artifacts): **COMPLETE**

## Baseline artifacts (SSOT)

Baseline run folder (self-contained, committed):
- `artifacts/runs/2026-04-09T03-54-25.639Z/`

Key files:
- Layer 2 observed judgment JSON: `artifacts/runs/2026-04-09T03-54-25.639Z/layer2_observed_judgment.json`
- Self-contained observed bundle copy: `artifacts/runs/2026-04-09T03-54-25.639Z/observed_bundle/`
- Run manifest (pointers + run_id): `artifacts/runs/2026-04-09T03-54-25.639Z/manifest.json`

## Required revalidation (do not skip)

Re-run the lock validation lane whenever any of these change:
- Ledger DDL / views / constraints / service behavior: `tmp/billing-ledger-php/**`
- Orchestrator evaluator / schemas / decision rules: `tmp/orchestrator-v2/**`
- Review gate enforcement or policy: `tools/review-gate.mjs`, `review-policy.json`
- Any change that touches `domain_tags` `money_state` scope and claims the lock still holds.

## CI lane (maintained standard)

The lightweight CI lane must run:
- Layer 1 deck: `pwsh -NoProfile -File ./tmp/billing-ledger-php/tests/run.ps1`
- Layer 2 evaluation (baseline bundle): `pwsh -NoProfile -File ./tmp/orchestrator-v2/runner/ci_layer2_eval.ps1`
- Layer 3 raw doc contract (baseline JSON → exact output): `node ./tmp/orchestrator-v2/layer3/validate_layer3_output.mjs --mode exact --json ./artifacts/runs/2026-04-08T21-02-02.110Z/layer2_observed_judgment.json --doc ./docs/reconciliation/lock/layer3/LAYER3_LEDGER_LOCK_JUDGMENT_RAW.md`

## Notes

- This baseline is **local/CI-grade proof**, not production validation.
- Do not claim `P0-02: PRODUCTION-VALIDATED` without separate production artifacts.

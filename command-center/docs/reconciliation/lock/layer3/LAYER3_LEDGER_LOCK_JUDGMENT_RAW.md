# Layer 3 (Raw) — Ledger Lock Judgment

Contract: `layer3_raw_v1`

Input: `./artifacts/tenants/vent-guys/runs/2026-04-09T03-54-25.639Z/layer2_observed_judgment.json`

## Snapshot
- tenant_id: `vent-guys`
- run_id: `2026-04-09T03:54:25.639Z`
- observed_bundle_root: `.\\artifacts\\tenants\\vent-guys\\runs\2026-04-09T03-54-25.639Z\observed_bundle`
- source_observed_bundle_root: `.\tmp\orchestrator-v2\observed\20260408_150010`
- verdict: `DEPLOY_CONFIDENCE_INCREASED`
- next_action_type: `confidence_rerun`
- failure_mechanism: `null`
- confidence_change: `unavailable_no_prior_run`

## Proven property status
- refund_cap_under_contention: `proven`
- repeated_run_determinism_under_contention: `proven`
- single_winner_credit_allocation: `proven`

## Result by test
- soak_credit_single_winner: `PASS` (results/soak_credit_single_winner.json)
- soak_refund_cap_under_contention: `PASS` (results/soak_refund_cap_under_contention.json)

## Run summary
- run_summary_line: `run_id=observed_soak_20260408_150010 pass=100 fail=0 mode=deterministic`
- scope: `bundle=tmp\orchestrator-v2\observed\20260408_150010\soak lane=soak`

## Deployment risks still open
- (none)

## Next best action
Proceed to Layer 3 document generation using this judgment output.

## Raw artifact gaps
- (none)


# EV-2026-04-08 — Layer 2 (Orchestrator v2) Observed Judgment Lock

## Status
- Status: `PASS`
- Date: `2026-04-08` (America/New_York)
- Owner: `Codex`

## What this proves
Layer 2 is closed for the two highest-risk contention invariants by:
- mechanically capturing an **observed** success artifact bundle (not hand-authored)
- running the **same** Layer 2 evaluator twice on the observed bundle (deterministic output)
- running the **same** evaluator against two negative controls:
  - environment failure → `DEPLOY_CAUTION`
  - invariant violation → `DEPLOY_BLOCKED`

## Observed success bundle (mechanically captured)
- Self-contained bundle root (copied from observed capture for gate evidence): `artifacts/runs/2026-04-09T03-54-25.639Z/observed_bundle/`
- Source capture root (not required for review gate once copied): `tmp/orchestrator-v2/observed/20260408_150010/`
- Full lane:
  - `artifacts/runs/2026-04-09T03-54-25.639Z/observed_bundle/full/run_summary.json`
- Soak lane:
  - `artifacts/runs/2026-04-09T03-54-25.639Z/observed_bundle/soak/run_summary.json`
  - `artifacts/runs/2026-04-09T03-54-25.639Z/observed_bundle/soak/soak_summary.json`
  - `artifacts/runs/2026-04-09T03-54-25.639Z/observed_bundle/soak/results/soak_credit_single_winner.json`
  - `artifacts/runs/2026-04-09T03-54-25.639Z/observed_bundle/soak/results/soak_refund_cap_under_contention.json`

## Layer 2 outputs (machine-checkable)
Observed success (evaluated twice; identical JSON output):
- `artifacts/runs/2026-04-09T03-54-25.639Z/observed_bundle/layer2_eval_1/judgment.json`
- `artifacts/runs/2026-04-09T03-54-25.639Z/observed_bundle/layer2_eval_1/judgment.md`
- `artifacts/runs/2026-04-09T03-54-25.639Z/observed_bundle/layer2_eval_2/judgment.json`
- `artifacts/runs/2026-04-09T03-54-25.639Z/observed_bundle/layer2_eval_2/judgment.md`

Negative controls (same evaluator, same contracts):
- Environment failure control:
  - `artifacts/runs/2026-04-09T03-54-25.639Z/observed_bundle/layer2_eval_env_control/judgment.md`
- Invariant violation control:
  - `artifacts/runs/2026-04-09T03-54-25.639Z/observed_bundle/layer2_eval_invariant_control/judgment.md`

## Key result (observed success)
- Expected: `DEPLOY_CONFIDENCE_INCREASED`
- Actual: `DEPLOY_CONFIDENCE_INCREASED`
- Proven properties (from authoritative run summary):
  - `single_winner_credit_allocation: proven`
  - `refund_cap_under_contention: proven`
  - `repeated_run_determinism_under_contention: proven`

## How to reproduce
- Capture observed bundle (full + soak):
  - `pwsh -NoProfile -File .\tmp\orchestrator-v2\runner\run_layer2_pipeline.ps1 -Mode capture -Iterations 100`
- Evaluate Layer 2 against observed bundle + negative controls:
  - `pwsh -NoProfile -File .\tmp\orchestrator-v2\runner\run_layer2_pipeline.ps1 -Mode evaluate -BundleRoot .\tmp\orchestrator-v2\observed\20260408_150010`
- Generate a self-contained run artifact folder + review gate submission:
  - `pwsh -NoProfile -File .\tmp\orchestrator-v2\runner\generate_layer2_review_input.ps1 -ObservedBundleRoot .\tmp\orchestrator-v2\observed\20260408_150010`

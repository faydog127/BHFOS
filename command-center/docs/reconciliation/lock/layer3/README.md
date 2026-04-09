# Layer 3 — Documents (Raw Contract + Human Review)

## SSOT hierarchy

1. **Layer 2 judgment JSON** (source data):
   - Baseline: `artifacts/runs/2026-04-08T21-02-02.110Z/layer2_observed_judgment.json`
2. **Layer 3 raw contract doc** (exact rendering; contract-locked):
   - `docs/reconciliation/lock/layer3/LAYER3_LEDGER_LOCK_JUDGMENT_RAW.md`
3. **Layer 3 review doc** (human-optimized; still exact + governed; must defer to SSOT above):
   - `docs/reconciliation/lock/layer3/LAYER3_LEDGER_LOCK_REVIEW_v1.md`

The review doc is not allowed to become a second source of truth.

## What each doc is for

- Raw contract doc:
  - exact, machine-checkable output contract
  - safe for CI gating and regression detection
- Review doc:
  - optimized for human scanning and review
  - still contract-locked and validated in CI

## Regenerate

- Raw:
  - `node tmp/orchestrator-v2/layer3/render_layer3_raw.mjs artifacts/runs/2026-04-08T21-02-02.110Z/layer2_observed_judgment.json docs/reconciliation/lock/layer3/LAYER3_LEDGER_LOCK_JUDGMENT_RAW.md`
- Review:
  - `node tmp/orchestrator-v2/layer3/render_layer3_review.mjs --json artifacts/runs/2026-04-08T21-02-02.110Z/layer2_observed_judgment.json --out docs/reconciliation/lock/layer3/LAYER3_LEDGER_LOCK_REVIEW_v1.md`

## Validate (CI enforced)

- Raw (exact):
  - `node tmp/orchestrator-v2/layer3/validate_layer3_output.mjs --mode exact --json artifacts/runs/2026-04-08T21-02-02.110Z/layer2_observed_judgment.json --doc docs/reconciliation/lock/layer3/LAYER3_LEDGER_LOCK_JUDGMENT_RAW.md`
- Review (exact by default):
  - `node tmp/orchestrator-v2/layer3/validate_layer3_review_output.mjs --mode exact --json artifacts/runs/2026-04-08T21-02-02.110Z/layer2_observed_judgment.json --doc docs/reconciliation/lock/layer3/LAYER3_LEDGER_LOCK_REVIEW_v1.md`
- Review (dev-only structural):
  - `node tmp/orchestrator-v2/layer3/validate_layer3_review_output.mjs --mode structural --doc docs/reconciliation/lock/layer3/LAYER3_LEDGER_LOCK_REVIEW_v1.md`


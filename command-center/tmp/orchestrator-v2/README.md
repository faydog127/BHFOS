# Orchestrator v2 Spec Pack (Repo Copy)

This folder contains the **repo-locked** v2 contracts for:

- Codex interpretation prompt
- Decision rules
- JSON schemas for per-test results, run summaries, soak summaries, and prior-run verdicts

## Canonical tokens

- Verdicts:
  - `DEPLOY_BLOCKED`
  - `DEPLOY_CAUTION`
  - `DEPLOY_CONFIDENCE_INCREASED`
- Next action types:
  - `code_fix`
  - `harness_fix`
  - `environment_fix`
  - `confidence_rerun`

## Files

- `tmp/orchestrator-v2/codex_orchestrator_prompt_v2.md`
- `tmp/orchestrator-v2/decision_rules_v2.md`
- `tmp/orchestrator-v2/run_summary_schema_v2.json`
- `tmp/orchestrator-v2/result_schema_v2.json`
- `tmp/orchestrator-v2/soak_summary_schema_v2.json`
- `tmp/orchestrator-v2/prior_run_verdict_schema_v2.json`

## Golden examples

Golden artifact bundles live under:

- `tmp/orchestrator-v2/examples/`

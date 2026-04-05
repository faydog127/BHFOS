# Review Gate Metrics (Crucible-Backed) — v2.0

This document defines **what `npm run review:gate` evaluates** for every submission.

Source of truth:

- Policy: `review-policy.json`
- Input: `review-input.json` (submission payload format)
- Gate: `tools/review-gate.mjs`

---

## Submission Identity (Anti-stale / Anti-reuse)

The gate requires:

- `gate_version` (format version)
- `change_id` (ticket/change identifier)
- `pr_id` (use `LOCAL` if not in PR)
- `source_commit` (git SHA-like hex)
- `run_id` (ISO datetime)
- `files_changed[]` (explicit non-empty list)
- `scope.included[]` must be a subset of `files_changed[]`

---

## Governance Authority (Who closes the loop)

The gate requires:

- `decider.name`
- `decider.role`
- `decider.approved_at` (ISO datetime)

---

## Trigger Discipline (No “safe change” disguise)

The gate requires:

- `domain_tags[]` (declared)
- `trigger_evidence.derived_domain_tags[]` (must include all declared `domain_tags`)
- `trigger_evidence.derivation_inputs[]` (must be non-empty; e.g. `git diff --name-only`)

---

## Scenario Discipline (No checkbox-only compliance)

When a submission touches any critical domain (`review-policy.json: critical_domains`), the gate requires at least **one scenario** for each category:

- `concurrency`
- `replay_idempotency`
- `bad_data`
- `dependency_failure`
- `human_error`

Each scenario must include:

- `scenario` (concrete failure case)
- `expected_behavior`
- `verification_method`
- `evidence_required[]`

---

## Concurrency Model Declaration (No unstated promises)

The gate requires:

- `concurrency_model.model` ∈ `{ dedupe_based | lock_based }`
- `concurrency_model.guarantees[]` (non-empty)
- `concurrency_model.non_guarantees[]` (non-empty)
- If `lock_based`: `concurrency_model.lock_strategy` required

---

## Operational Noise Budget (Alert/task spam prevention)

The gate requires:

- `ops_impact.alert_dedupe_identity`
- `ops_impact.max_open_alerts_per_entity`
- `ops_impact.task_dedupe_rule`

---

## Evidence + Coverage Quality (Proof over narrative)

The gate enforces:

- Required artifact types present:
  - `log`, `db_output`, `code_reference`, `manifest`, `test_result`
- Artifacts must not rely only on forbidden proof types.
- Artifact paths must exist (configurable) and required types must be non-empty.
- Artifact freshness vs `generated_at` (max age by policy).
- `code_reference.snippet` must exist and match file contents (when enabled).
- Coverage report required fields:
  - `files_analyzed`, `discovery_inputs`, `excluded_scope`, `uncertainty_boundaries`
- `coverage_report.files_analyzed[]` must include every file in `scope.included[]`

---

## Findings Completeness (No vague “no issues”)

The gate requires:

- `findings[]` non-empty
- Each finding must include:
  - `file proof` (`proof[]`)
  - `rule_violated`
  - `business_impact`
  - `recommended_action`
  - `verification_method`
  - `closure_evidence_required[]` (non-empty)

---

## Critical Domain Verification Requirements

For each `domain_tag` in a critical domain, the gate requires specific verification fields:

- `tenant_isolation` → `tenant_boundary_analysis`, `runtime_negative_test`, `rollback_plan`
- `money_state` → `idempotency_analysis`, `replay_test`, `rollback_plan`
- `acceptance_commit` → `atomicity_analysis`, `exactly_once_analysis`, `rollback_plan`
- `state_machine` → `migration_plan`, `legacy_data_plan`, `rollback_plan`
- `completion_gate` → `negative_test`, `positive_test`

Additionally:

- `money_state` requires `verification.replay_test`

---

## Readiness Label Guard (Prevents premature “production-safe” claims)

The gate enforces:

- `readiness.status` ∈ `{ NOT_READY | CONDITIONALLY_READY | READY }`
- `readiness.labels[]` must be from `allowed_readiness_labels` in policy
- If `readiness.labels` contains `P0-02: PRODUCTION-VALIDATED`:
  - `readiness.production_artifacts[]` must be non-empty

---

## Override Record (If used, must be explicit)

If `override` is present, the gate requires:

- `override.requested_by`
- `override.approved_by`
- `override.reason`
- `override.rollback_plan`
- `override.expires_at` (ISO datetime)


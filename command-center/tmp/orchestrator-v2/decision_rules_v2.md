# Decision Rules v2

This document defines the source-of-truth rules and promotion logic for Codex-driven deployment-readiness evaluation.

## 1. Responsibility split

### Orchestrator responsibilities
The orchestrator is responsible for:

- running tests
- counting pass/fail totals
- aggregating soak results
- determining failure mode:
  - deterministic
  - intermittent
  - unknown_insufficient_runs
- generating authoritative run summaries
- generating authoritative soak summaries
- computing artifact completeness
- generating promotion gate state
- supplying prior-run verdicts when trend comparison is desired

### Codex responsibilities
Codex is responsible for:

- interpreting structured artifacts
- classifying failure mechanism
- evaluating whether invariants were preserved
- determining whether previously proven properties remain proven
- summarizing current deployment risk
- selecting exactly one next best action

Codex must not recompute authoritative totals when orchestrator summaries are available.

## 2. Authoritative artifacts

When present, the following artifacts are authoritative and must override any attempt to recompute them from raw data:

- current run summary
- soak summary
- promotion gate
- artifact completeness
- prior run verdict
- failure mode

If raw logs and authoritative summaries disagree, that discrepancy must be reported as an artifact inconsistency or harness issue, not silently corrected by Codex.

## 3. Lane model

### Lane A — fast confidence
Purpose:
- rapid feedback on highest-risk paths

Typical contents:
- core race tests
- migration re-apply
- critical lifecycle test

### Lane B — full suite
Purpose:
- broad ledger correctness and migration safety

Typical contents:
- all SQL tests
- all PHP integration tests
- critical service-layer checks

### Lane C — soak
Purpose:
- validate repeated-run determinism under contention

Typical contents:
- race tests repeated 25 to 100 times or more

Rule:
Codex should receive the aggregate `soak_summary` plus failed iteration artifacts, not all raw iteration artifacts.

## 4. Failure mechanism vs failure mode

### Failure mechanism
Codex classifies failures into one of:

- business_logic_defect
- concurrency_defect
- migration_defect
- test_harness_defect
- environment_config_defect

### Failure mode
The orchestrator determines whether a failure pattern is:

- deterministic
- intermittent
- unknown_insufficient_runs

Codex must never invent a flaky classification from a single run.

## 5. Proven properties

A proven property is a behavior that has sufficient direct evidence behind it.

Examples:
- single-winner credit allocation under contention
- refund cap enforcement under contention

### Property status values
- proven
- unproven

### Downgrade rule
If new evidence invalidates or weakens a previously proven property, the property must be marked downgraded to unproven.

This is high severity.

## 6. Verdict rules

Use exactly one verdict:

- DEPLOY_BLOCKED
- DEPLOY_CAUTION
- DEPLOY_CONFIDENCE_INCREASED

### DEPLOY_BLOCKED
Use when any of the following are true:

- an invariant is violated
- over-allocation occurred
- over-refund occurred
- duplicate reversal or duplicate settlement occurred
- final DB state mismatched required invariants
- two concurrent winners occurred where one winner was required
- a previously proven property was downgraded to unproven
- soak summary shows unacceptable nondeterminism that directly affects correctness

### DEPLOY_CAUTION
Use when:

- single-run race tests pass, but soak has not yet been run
- evidence is incomplete
- harness or environment instability prevents clear interpretation
- important properties are not yet proven
- some risk remains open without direct correctness failure

### DEPLOY_CONFIDENCE_INCREASED
Use when:

- critical invariants passed
- expected loser codes matched
- final DB end-state matched
- critical concurrency paths passed
- no proven property regressed
- soak evidence is sufficient for the stated claim
- open risks are narrower than in the prior run or materially reduced in the current run

## 7. Confidence change rules

Codex may only state confidence change relative to a prior run when a `prior_run_verdict` artifact is provided.

If no prior-run artifact is present, output:

`CONFIDENCE CHANGE: unavailable_no_prior_run`

Do not infer trend from memory or from incomplete context.

## 8. Next-action rules

Codex must recommend exactly one next best action.

### Allowed next action types
- code_fix
- harness_fix
- environment_fix
- confidence_rerun

### Quality bar
The next action must be:

- specific
- surgical
- directly tied to observed evidence

Bad:
- "Investigate transactions"

Good:
- "Move available-balance recheck inside the locked transaction before insert"

## 9. Artifact gap rules

Codex must explicitly report missing evidence that limits confidence.

Examples:
- missing db snapshot
- missing worker stderr
- missing timing trace
- missing prior-run artifact for trend comparison

Missing artifacts should lower confidence, but should not be confused with logic defects.

## 10. Redaction rules

Artifacts intended for CI or shared review must follow redaction rules.

Minimum:
- customer IDs masked
- billing case IDs masked
- raw payloads excluded unless explicitly required for debugging

Codex should not require sensitive raw payloads when summary artifacts are sufficient.

## 11. Soak handling rules

For soak lanes:

- the orchestrator must aggregate results into a soak summary
- Codex should only inspect failed iterations unless deeper diagnosis needs a comparison sample
- Codex must not narrate all 100 runs individually
- Codex should rely on:
  - pass count
  - fail count
  - failure signatures
  - invariant pass rate
  - expected failure code match rate
  - promotion gate

This reduces token waste and prevents reasoning drift.

## 12. Promotion gate interpretation

Promotion gate fields are authoritative when present:

- lane_green
- merge_recommended
- deploy_recommended
- reason

Codex should interpret these fields, not recompute them.

If Codex believes the gate conflicts with evidence, it should say so explicitly as an inconsistency, not silently override it.


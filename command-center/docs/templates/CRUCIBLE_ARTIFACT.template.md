# Crucible Artifact (Template)

Use this template when a change needs a structured peer-review narrative that links to **gate-compliant evidence**.

SSOT rule:
- The canonical truth is the run artifacts + `review-input.json` evaluated by `npm run review:gate`.
- This document is a human-readable index into that evidence.

## Identity
- `change_id`:
- `run_id`:
- `source_commit`:
- `domain_tags`:

## Summary (1–2 paragraphs)
- What changed:
- Why it changed:
- What is proven locally (links below):

## Scope
- Included:
- Excluded:

## Scenarios (Required when critical domains triggered)
For each scenario category required by policy, document:
- Scenario:
- Expected behavior:
- Verification method:
- Evidence required (exact artifact links):

## Concurrency model
- Model: `lock_based` | `dedupe_based`
- Guarantees:
- Non-guarantees:
- Lock strategy (if lock_based):

## Ops impact
- Alert dedupe identity:
- Max open alerts per entity:
- Task dedupe rule:

## Artifacts (evidence links)
List concrete evidence artifacts with paths that exist in the repo/workspace:
- Logs:
- Test results:
- DB outputs:
- Manifest:
- Code references (file path + snippet):

## Findings
For each finding:
- Rule violated:
- Proof (paths/snippets/artifacts):
- Recommended action:
- Closure evidence required:

## Verification (critical-domain keys)
List the verification keys required by policy for any triggered domain tags, with links to proof.

## Readiness
- Status: `NOT_READY` | `CONDITIONALLY_READY` | `READY`
- Labels: `P0-02: LOCAL_PROVEN` / `P0-02: PRODUCTION-VALIDATED` (only when backed by artifacts)


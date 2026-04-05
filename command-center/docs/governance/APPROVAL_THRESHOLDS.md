# Approval Thresholds (Governance) — v2

Updated: 2026-04-05  
Scope: governance only (no runtime behavior change)

## Purpose
Define where autonomous execution must stop and where human authority is required.

## SSOT Rule
Automation may recommend every step, but the decision must be recorded in artifacts and aligned to `review:gate`.

## Core Rule
Automation may continue until it reaches a boundary involving risk ownership, production consequence, or governance change.

## Auto-continue allowed
The system may proceed without human interruption for:
- local proof runs
- artifact generation
- structured failure packet generation
- documentation drafts (non-canonical)
- local test reruns
- patch iteration within retry/cost limits
- review synthesis for non-release decisions

## Human approval required
A human decider is required for:
- production deployment in trigger domains
- accepted risk
- override usage
- doctrine changes
- break-glass operations
- irreversible data mutation
- any claim of `P0-02: PRODUCTION-VALIDATED`

## Trigger domains (must match gate)
Human approval is mandatory when the change touches any of:
- `tenant_isolation`
- `money_state`
- `acceptance_commit`
- `state_machine`
- `completion_gate`

If a domain is not in this list, it is not a trigger domain until policy is updated.

## Readiness mapping (must match gate schema)

Gate schema:
- `readiness.status`: `NOT_READY` | `CONDITIONALLY_READY` | `READY`
- `readiness.labels[]`: `P0-02: LOCAL_PROVEN` | `P0-02: PRODUCTION-VALIDATED`

Mapping table:

| Narrative claim | Required gate fields |
|---|---|
| NOT_READY | `readiness.status="NOT_READY"` |
| CONDITIONALLY_READY | `readiness.status="CONDITIONALLY_READY"` |
| LOCAL_PROVEN | `readiness.status="READY"` + `readiness.labels=["P0-02: LOCAL_PROVEN"]` (when the change is within P0-02 scope) |
| PRODUCTION-VALIDATED | `readiness.status="READY"` + `readiness.labels=["P0-02: PRODUCTION-VALIDATED"]` + `readiness.production_artifacts[]` non-empty |

Notes:
- “LOCAL_COMPLETE” is a narrative governance phrase; it is **not** an allowed `readiness.labels[]` value unless policy is updated.

## Override threshold
Overrides are allowed only when:
- `readiness.status="CONDITIONALLY_READY"`
- there is a written override record (`override.*`) including expiry and rollback plan
- scope is explicitly bounded
- decider explicitly approves

## Accepted-risk threshold
A risk may be accepted only when all are present:
- named owner
- reason
- probability + blast radius classification
- expiry date (must be after the run timestamp)
- revalidation trigger
- decider approval recorded

## Retry / self-heal threshold
Autonomous repair may retry only within bounded limits.

Default local bounds:
- max 3 consecutive self-heal attempts per run without materially different failure signature
- bounded cost threshold per run (if cost tracking is available)
- if limit is reached, stop and escalate to human

## Compliance threshold
Compliance-style outputs are advisory unless explicitly backed by a real legal or policy review workflow. AI may produce a compliance memo, but not legal sign-off.

## Final rule
Automation may recommend every step. It may not own the last word on production, risk, or doctrine.


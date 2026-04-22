# REVIEW_GATE_UPDATE_V1.md

## Purpose

Update `tools/review-gate.mjs` to enforce v1 vocabulary and prevent regression.

---

## Enforcement Objective

Reject changes that:
- introduce deprecated statuses
- introduce illegal statuses
- reintroduce `pipeline_stage` authority

---

## Inputs (Fail Closed if Missing)

- `SOURCE_OF_TRUTH_MAP.md`
- `STATUS_VOCABULARY_LOCK_V1.md`
- `P0_BREACH_PATCH_PACKET_V1.md`

---

## Vocabulary Enforcement

### Jobs (canonical)

Allowed:
- `unscheduled`
- `scheduled`
- `in_progress`
- `completed`
- `cancelled`
- `invoiced`

Reject:
- `pending`
- `pending_schedule`
- `en_route`

### Leads (canonical)

Allowed:
- `new`
- `contacted`
- `qualified`
- `converted`
- `lost`

Reject:
- `scheduled`

---

## Gate Rules

### G1
Reject deprecated job status writes.

### G2
Reject unknown job status values (no-new-status invariant).

### G3
Reject deprecated lead status writes.

### G4
Reject `pipeline_stage` used for:
- transitions
- mutation authority
- automation triggers

Allow only:
- reporting
- UI grouping
- analytics/display metadata

### G5
Reject any new status not in lock.

---

## Implementation Strategy

- Regex only (no AST)
- Scan changed files (pragmatic, narrow scope)
- Focus on **write/mutation/authority contexts**, not docs/comments

---

## Controller Guardrails

### Entity Ambiguity Trap
`scheduled` is valid for Jobs but invalid for Leads.

The gate must attempt to infer context (table names, file paths, SQL table names) and avoid false positives on valid Job usage.

### Git-Diff Execution Trap
Gate likely scans changed files via git.

The Crucible test must ensure the test file is included in scan scope (e.g., staged or injected).

---

## Acceptance Criteria

Must fail when:
- `jobs.status` is written as `pending` or `pending_schedule`
- `leads.status` is written as `scheduled`
- an unknown status is introduced in a jobs/leads write context
- `pipeline_stage` is used as execution authority

Must pass when:
- values only appear in docs/comments
- `pipeline_stage` is used for display/filtering only

---

## Final Instruction

Patch narrowly.
Do not expand scope.

Goal: stop drift from coming back.


# P0_BREACH_PATCH_PACKET_V1.md

## Purpose

This packet defines the **minimum immediate fixes** required to stabilize BHFOS vocabulary and stop execution drift after the v1 vocabulary lock.

This is **not** a redesign packet.
This is a **breach patch packet**.

It exists to fix only the live contradictions that currently create churn, failed assumptions, and contract mismatches.

---

## Scope Lock

This packet is limited to the following P0 issues:

1. `jobs.status = 'invoiced'` exists in live code/projections but is not allowed by the DB status contract
2. `jobs.status` pre-schedule drift exists across `unscheduled`, `pending_schedule`, and `pending`
3. `pipeline_stage` is still being used as execution authority in active paths

Anything outside these three issues is out of scope for this packet.

---

# 1. P0 BREACH: JOB STATUS `invoiced`

## Problem

Live code and operational projections use `jobs.status = 'invoiced'`, but the DB guardrail/check contract does not currently allow `invoiced`.

This is a live contract breach.

## Required Fix

Update the jobs status DB contract so that `invoiced` is a legal value.

## Authority

Source of truth for v1:
- `STATUS_VOCABULARY_LOCK_V1.md`

## Patch Goal

Bring DB constraint, code, and projection behavior into alignment.

## Acceptance Criteria

- DB status check or enum for `jobs.status` includes `invoiced`
- any validation helper or status normalization helper accepts `invoiced`
- no code path throws or rejects `invoiced` as invalid
- operational projection remains compatible

## Explicit Non-Goals

- do not redesign the full jobs state machine
- do not add new job statuses beyond the v1 lock

---

# 2. P0 BREACH: JOB PRE-SCHEDULE DRIFT

## Problem

The system currently uses multiple values for the same meaning:
- `unscheduled`
- `pending_schedule`
- `pending`

This creates translation tax and inconsistent routing.

## Required Fix

Adopt one canonical pre-schedule jobs state:
- `unscheduled`

Treat the following as deprecated aliases only:
- `pending`
- `pending_schedule`

## Patch Goal

Stop fresh writes of `pending` and `pending_schedule`.
Normalize legacy reads/writes toward `unscheduled`.

## Required Actions

- update normalization utilities to map:
  - `pending` -> `unscheduled`
  - `pending_schedule` -> `unscheduled`
- update write surfaces so they do not emit `pending` or `pending_schedule`
- update any DB-level contract or transition guard so `unscheduled` is the canonical write target

## Acceptance Criteria

- all newly written pre-schedule jobs use `unscheduled`
- alias values may still be read/mapped temporarily if legacy rows or old paths exist
- no new code emits `pending` or `pending_schedule`

## Explicit Non-Goals

- do not mass-normalize all historical records unless separately approved
- do not add ideal-state vocabulary in this packet

---

# 3. P0 BREACH: `pipeline_stage` SHADOW AUTHORITY

## Problem

`pipeline_stage` is still acting like execution logic in active code paths.

This violates the v1 lock and creates a competing shadow state machine.

## Required Fix

Demote `pipeline_stage` to reporting/display only.

## Patch Goal

Ensure canonical `status` is the only execution authority.

## Required Actions

- identify all code paths where `pipeline_stage` is used to:
  - drive routing
  - authorize transitions
  - trigger automations
  - control permissions
- remove execution authority from those paths
- retain `pipeline_stage` only for:
  - UI grouping
  - reporting
  - analytics/display metadata

## Acceptance Criteria

- no transition logic depends on `pipeline_stage`
- no permission or automation routing depends on `pipeline_stage`
- `status` is the sole execution authority in patched paths

## Explicit Non-Goals

- do not fully delete `pipeline_stage` field in this packet
- do not redesign CRM UX in this packet

---

# 4. OWNER-PATH ENFORCEMENT TARGETS

These P0 patches must respect the owner-path rules.

## Jobs owner path

Authorized write owner:
- `supabase/functions/work-order-update/index.ts`
- formally designated DB lifecycle triggers/functions

## Leads owner path

Authorized write owner for current transition cleanup:
- `supabase/functions/lead-update-stage/index.ts`
- `supabase/functions/kanban-move/index.ts` only where still active and not yet consolidated

## Rule

No patch may solve drift by introducing additional ad hoc raw writes.

---

# 5. IMPLEMENTATION ORDER

## Step 1

Patch DB and validation contract for `jobs.status = 'invoiced'`

## Step 2

Patch normalization/write surfaces so job pre-schedule writes collapse to `unscheduled`

## Step 3

Patch active `pipeline_stage` execution usage so it becomes reporting-only

## Step 4

Run verification against all patched paths

---

# 6. REQUIRED VERIFICATION

Verification must prove:

## Jobs

- write path can set `invoiced` without DB rejection
- write path emits `unscheduled` as canonical pre-schedule state
- deprecated aliases are not newly written

## Leads / Pipeline

- patched paths no longer depend on `pipeline_stage` for operational routing
- canonical `status` drives transition logic

## Governance

- no new vocabulary introduced
- no owner-path violations introduced

---

# 7. PATCH OUTPUTS REQUIRED

Implementation output must include:
- files changed
- exact contract changes made
- any migration added
- any normalization helper changes
- list of removed/changed `pipeline_stage` authority points
- verification evidence
- any residual risk not fixed in this packet

---

# 8. DONE DEFINITION

This packet is done only when:
- `invoiced` is legal across code + DB contract
- `unscheduled` is the only canonical pre-schedule jobs write value
- `pipeline_stage` no longer acts as execution authority in patched paths
- verification evidence exists
- no extra redesign work was introduced

---

# 9. EXECUTION RULE

This packet must be implemented as a **stabilization pass**, not a refactor spree.

The operator standard is:
- patch the breach
- verify the patch
- stop

Do not expand scope once implementation begins.


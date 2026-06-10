# DECISION_LOG.md

## Purpose

This document records locked governance and implementation decisions for BHFOS.

It exists to prevent:

* re-deciding settled issues
* reopening work without cause
* hidden overrides
* conflicting guidance across documents

If a decision is logged here as **LOCKED**, it may not be reopened unless the reopen rule is satisfied.

---

## Reopen Rule

A locked decision may be reopened only if at least one of the following is true:

1. A production issue or verified implementation failure is discovered
2. A direct contradiction is found between locked authority sources
3. An explicit owner override is recorded here

If reopened, the entry must be updated with:

* reopen date
* reopen reason
* owner
* replacement decision or re-lock outcome

---

## Decision Entry Template

### Decision ID

* ID: `DEC-XXXX`
* Title:
* Date Locked:
* Owner:
* Scope:
* Status: `LOCKED` | `REOPENED` | `SUPERSEDED`

### Decision

### Reason

### Authority Sources

*

### Supersedes

*

### Reopen Conditions

*

### Notes

*

---

# Locked Decisions

## DEC-0001 — V1 Vocabulary Lock Adopted

* ID: `DEC-0001`
* Title: V1 live vocabulary is the temporary system authority for status enforcement
* Date Locked: 2026-04-18
* Owner: Founder / BHFOS Controller
* Scope: Jobs, Leads, Appointments, Commercial naming, pipeline stage authority
* Status: `LOCKED`

### Decision

BHFOS v1 status enforcement uses **current live vocabulary**, not aspirational vocabulary.

The active vocabulary authority is `STATUS_VOCABULARY_LOCK_V1.md`.

### Reason

The system contained live conflicts across code, DB, and governance docs. Locking to live vocabulary was necessary to stop churn without introducing false architecture.

### Authority Sources

* `SOURCE_OF_TRUTH_MAP.md`
* `STATUS_VOCABULARY_LOCK_V1.md`

### Supersedes

* vocabulary portions of `STATUS_CONTRACTS.md` for enforcement purposes

### Reopen Conditions

* verified contradiction in live repo behavior
* approved v2 normalization effort

### Notes

* `STATUS_CONTRACTS.md` remains superseded until rewritten against the v1 lock

---

## DEC-0002 — P0 Vocabulary Patch Accepted

* ID: `DEC-0002`
* Title: P0 stabilization patch for vocabulary drift is accepted
* Date Locked: 2026-04-18
* Owner: Founder / BHFOS Controller
* Scope: jobs `invoiced`, pre-schedule jobs normalization, `pipeline_stage` execution authority removal in patched paths
* Status: `LOCKED`

### Decision

The P0 stabilization patch is accepted as complete.

This includes:

* legalization of `jobs.status = 'invoiced'` at DB contract level
* collapse of fresh pre-schedule job writes to `unscheduled`
* removal of `pipeline_stage` execution authority in patched paths

### Reason

These were the minimum live breaches preventing stable enforcement.

### Authority Sources

* `P0_BREACH_PATCH_PACKET_V1.md`
* accepted implementation result for `P0 VOCABULARY PATCH V1 — COMPLETE`

### Supersedes

* prior unresolved drift in jobs vocabulary and pipeline-stage execution behavior

### Reopen Conditions

* verified regression in patched paths
* DB/code contradiction discovered in patched scope

### Notes

* some legacy DB values remain intentionally allowed pending controlled tightening
* uppercase default mismatch on `UNSCHEDULED` remains deferred

---

## DEC-0003 — Review Gate Enforcement Selected as Immediate Anti-Regression Layer

* ID: `DEC-0003`
* Title: `tools/review-gate.mjs` is the immediate anti-regression enforcement layer for v1 vocabulary
* Date Locked: 2026-04-18
* Owner: Founder / BHFOS Controller
* Scope: changed-file enforcement for jobs/leads status writes and `pipeline_stage` authority patterns
* Status: `LOCKED`

### Decision

The review gate is adopted as the first machine-enforced anti-regression layer for v1 vocabulary control.

### Reason

After the P0 patch, the highest-value next move was to prevent deprecated or illegal status writes from re-entering through code changes.

### Authority Sources

* `SOURCE_OF_TRUTH_MAP.md`
* `REVIEW_GATE_UPDATE_V1.md`
* accepted implementation result for `REVIEW GATE UPDATE V1 — COMPLETE`

### Supersedes

* manual-only policing of vocabulary regression

### Reopen Conditions

* excessive false positives block valid work
* proven blind spot requires controlled expansion of gate logic

### Notes

* v1 gate is intentionally heuristic and narrow
* false negatives are more acceptable than false positives at this stage
* CI merge control target: workflow `CI`, job `review-gate` (required check name: `CI / review-gate` once branch protection is configured). Do not rename without updating `DECISION_LOG.md`.

---

## DEC-0004 — `pipeline_stage` Is Reporting-Only in V1

* ID: `DEC-0004`
* Title: `pipeline_stage` is not execution authority in v1
* Date Locked: 2026-04-18
* Owner: Founder / BHFOS Controller
* Scope: status routing, mutation authority, automation triggering, permission logic
* Status: `LOCKED`

### Decision

`pipeline_stage` may be used only for:

* reporting
* UI grouping
* analytics/display metadata

It may not be used for:

* choosing status transitions
* authorizing/denying mutations
* triggering automation side effects
* overriding canonical `status`

### Reason

`pipeline_stage` had become a shadow state machine and was a primary source of churn and contradictory behavior.

### Authority Sources

* `STATUS_VOCABULARY_LOCK_V1.md`
* `REVIEW_GATE_UPDATE_V1.md`
* accepted P0 patch + review gate results

### Supersedes

* all legacy assumptions treating `pipeline_stage` as operational authority

### Reopen Conditions

* none, unless entity model is formally redesigned and approved

### Notes

* residual reporting/grouping usage remains allowed

---

## DEC-0005 — Protocol Hierarchy Locked

* ID: `DEC-0005`
* Title: Source-of-truth hierarchy is the command structure for governance decisions
* Date Locked: 2026-04-18
* Owner: Founder / BHFOS Controller
* Scope: all governance, execution, and enforcement conflicts
* Status: `LOCKED`

### Decision

`SOURCE_OF_TRUTH_MAP.md` is the hierarchy authority for document precedence.

### Reason

Multiple documents had overlapping claims, causing doc resurrection and repeated re-evaluation.

### Authority Sources

* `SOURCE_OF_TRUTH_MAP.md`

### Supersedes

* ad hoc interpretation of which governance doc wins

### Reopen Conditions

* hierarchy conflict discovered in active usage
* governance architecture formally revised

### Notes

* Protocol beats lower-level execution guidance unless a temporary override is explicitly logged here

---

# Deferred Risks (Tracked; Not Reopening)

As of **2026-04-19**, these are known residual risks. They are tracked for visibility and planning, but **do not** reopen any `LOCKED` decision unless the Reopen Rule is met.

* raw-write ownership still not enforced at DB level
* terminal-state transition enforcement not yet implemented
* quote/invoice totals not yet server-authoritative everywhere
* cascade/orphan rules not yet formalized
* lead UI may still depend on `pipeline_stage` rendering assumptions until audited
* `src/pages/crm/Leads.jsx` still performs direct PostgREST writes to `public.leads` (including `status`) outside the lead owner paths

# Temporary Overrides

None currently logged.

---

# Superseded Decisions

None currently logged as formal entries.

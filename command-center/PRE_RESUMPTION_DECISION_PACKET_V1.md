# PRE_RESUMPTION_DECISION_PACKET_V1.md

## Purpose

This packet locks the final operational decisions required before resuming active code development.

It exists to:

* prevent immediate reintroduction of system drift
* clarify authority boundaries
* define execution order
* ensure all future work follows the established governance loop

---

## Status

LOCKED — This packet is in effect until superseded by a formal decision log entry.

---

# 1. MERGE AUTHORITY

## Decision

Merge authority is restricted to a single owner.

## Current State

* Owner: Founder (sole operator)

## Rules

* All changes must go through pull requests
* Direct pushes to `main` are prohibited
* `CI / review-gate` must pass before merge

## Rationale

Even as a solo operator, enforcing PR + gate discipline prevents accidental regression and maintains system integrity.

---

# 2. EXECUTION ORDER (NEXT HARDENING LANE)

## Decision

The next enforcement lane after current work is:

→ **H1b: Tenant Immutability**

Followed by:
→ **Money Loop Authority (server-side control of financial calculations)**

## Rules

* Do not run multiple enforcement packets in parallel
* Complete H1b fully before beginning Money Loop hardening

## Rationale

H1b secures tenant boundaries (data integrity foundation)
Money loop secures financial integrity (revenue protection)

---

# 3. DATABASE ROLLOUT PROCEDURE

## Decision

All DB tightening and schema changes must follow this sequence:

1. Local validation
2. Target environment inventory (staging/prod)
3. Explicit classification of all values
4. Controlled migration execution

## Mandatory Rule

> No DB migration is applied outside local without an inventory query first.

## Rationale

Prevents fail-closed production incidents and unintended data loss.

---

# 4. UI WRITE BOUNDARY (TEMPORARY EXCEPTION)

## Decision

Direct UI writes to `leads.status` are temporarily allowed.

## Constraints

* This is a known and logged exception
* It must not expand to other entities
* It must not introduce new status values

## Future Action

* Owner-path enforcement for leads will remove this exception in a future packet

## Rationale

Maintains current system operability while acknowledging enforcement gap

---

# 5. LEGACY FIELD POLICY (`pipeline_stage`, `stage`)

## Decision

Legacy fields remain active but restricted.

## Rules

* Allowed uses:
  * UI grouping
  * display
  * reporting

* Prohibited uses:
  * status authority
  * transition logic
  * mutation decisions
  * automation triggers

## Clarification

These fields are **not being removed yet**.
They are **frozen in a display-only role**.

## Future State

* Formal deprecation or removal will occur in a later controlled packet
* Any attempt to promote these fields back to operational authority requires a new decision log entry

## Rationale

Prevents regression into shadow-state behavior while avoiding premature removal

---

# 6. NO STEALTH ENTITIES RULE

## Decision

No new feature may introduce entities without explicit definition.

## Requirements (before coding new features)

* Define entity boundary (new table vs existing entity)
* Define allowed statuses
* Add statuses to `STATUS_VOCABULARY_LOCK_V1.md`

## Rationale

Prevents AI or developer from inventing uncontrolled schema or lifecycle logic

---

# 7. OPERATING RHYTHM (MANDATORY LOOP)

All work must follow this sequence:

1. Draft requirement
2. Run `REALITY_CHECK_TEMPLATE.md`
3. Create execution packet
4. Execute via PR
5. Review gate enforces
6. Merge

## Prohibited

* ad-hoc coding
* bypassing packet creation
* bypassing review gate

## Rationale

This replaces conversational iteration with controlled execution

---

# 8. NEXT ACTION

Proceed immediately to:

→ **H1b: Tenant Immutability Packet**

No additional governance work is required before this step.

---

# 9. OUTCOME

With this packet locked:

* authority is defined
* execution order is clear
* risks are acknowledged but contained
* development can resume without reintroducing churn

This marks the transition from **foundation building** to **controlled system execution**.


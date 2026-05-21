# SYSTEM_DEFINITION_V1.md

## Purpose

This document defines the **system boundary and identity of BHFOS v1**.

It answers one question clearly:

> What is BHFOS v1 *right now*?

This document is a **boundary definition**, not a roadmap or future architecture plan.

---

## Status

LOCKED — Active system definition for BHFOS v1

---

## What Is Already Established (Control Plane)

The following governance components are already active:

* `SOURCE_OF_TRUTH_MAP.md` — hierarchy of authority
* `DECISION_LOG.md` — closure of decisions
* `STATUS_VOCABULARY_LOCK_V1.md` — canonical status vocabulary
* Patch packets (P0, DB tightening, etc.) — execution artifacts
* `tools/review-gate.mjs` — enforcement mechanism
* GitHub Actions review gate job (`CI / review-gate`) — CI enforcement surface (becomes merge law when marked required in branch protection)

These define **how truth is decided and enforced**.

---

## System Boundary (What IS BHFOS v1)

BHFOS v1 consists of the following components:

* `command-center/` application
* Associated `supabase/` project backing command-center
* `tools/review-gate.mjs`
* GitHub Actions workflows that enforce governance (CI / review-gate)
* **TIS (Technology Integration Stack)** components that directly support or extend the command-center system (including automations, integrations, and supporting services used in production workflows)

### TIS Clarification

TIS is considered part of BHFOS v1 **only when it directly participates in system execution**, such as:

* automation pipelines tied to command-center data
* integrations that read/write governed entities
* supporting services that affect operational outcomes

TIS components that are experimental, disconnected, or not actively used in production are **not part of the governed system**.

Anything inside this boundary is governed by BHFOS v1 rules.

---

## Explicit Exclusions (What is NOT BHFOS v1)

The following are **not part of the governed system**:

* `legacy-crms/`
* experimental folders
* prototypes
* archived code
* any directory not explicitly included in the system boundary

These may exist in the monorepo but are **not governed** by BHFOS v1.

---

## Environments

BHFOS v1 recognizes the following environments:

* Local (development)
* Staging / Production (target environments)

### Database Rule

All DB changes must follow:

> Local → Inventory → Classification → Controlled rollout

No DB migration may be applied to staging or production without first running an inventory query.

---

## Trust Boundaries

Two execution lanes exist within BHFOS v1:

### 1. RLS Lane (Client / UI)

* Subject to row-level security
* Must operate within tenant constraints
* Limited authority

### 2. Service Role Lane (Backend / Edge Functions)

* Elevated privileges
* Must enforce tenant scope from verified sources
* Cannot bypass system rules (e.g., tenant immutability once enforced)

---

## Critical Entities & Ownership

Core system entities include:

* jobs
* leads
* quotes
* invoices
* appointments

Ownership and mutation rules are defined in:

→ `ENTITY_OWNERSHIP_AND_MUTATION_RULES.md`

This document must be treated as the authority for write-path control.

---

## No Stealth Entities Rule

No new entity may be introduced without:

1. Explicit definition of its boundary
2. Defined status vocabulary
3. Inclusion in `STATUS_VOCABULARY_LOCK_V1.md`

No AI or developer may implicitly create tables, states, or lifecycle logic.

---

## Legacy Field Policy

Fields such as:

* `pipeline_stage`
* `stage`

Are:

* allowed for display
* allowed for UI grouping
* allowed for reporting

They are NOT allowed for:

* execution authority
* state transitions
* mutation decisions
* automation triggers

These fields are frozen as display-only.

---

## Execution Implication

Any change inside the system boundary must follow the BHFOS execution loop:

1. Draft requirement
2. Reality Check (`REALITY_CHECK_TEMPLATE.md`)
3. Execution packet
4. PR submission
5. Review gate enforcement
6. Merge

### Outside the Boundary

Changes outside the defined system boundary:

* are not governed by BHFOS v1
* must be explicitly adopted before being brought under governance

---

## Relationship to Future Versions (V2, V3)

This document defines **current state only**.

Future system evolution (V2, V3) is:

* not enforced here
* not authoritative
* must be introduced through separate roadmap or packet-based processes

---

## Outcome

With this document:

* system scope is explicit
* governance applies only within defined boundaries
* monorepo ambiguity is removed
* future work cannot accidentally expand system scope

This is the **identity layer of BHFOS v1**.


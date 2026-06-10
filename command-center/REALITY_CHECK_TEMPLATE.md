# REALITY_CHECK_TEMPLATE.md

## Purpose

This template enforces the **Reality First Rule** for BHFOS.

No new governance document, protocol, or system rule may be created or modified unless it is grounded in **actual current system state**.

This prevents:

* aspirational architecture
* misaligned contracts
* repeated back-and-forth due to hidden contradictions

---

## When This Is Required

This template must be completed BEFORE:

* writing or modifying any Level 2 Governance Law
* creating new status models or entities
* redefining lifecycle logic
* introducing enforcement rules

---

## Reality Check Output (Required Sections)

### 1. Objective

What are you trying to define or change?

---

### 2. Current Database Reality

Provide **actual DB evidence** (not assumptions):

* Tables involved:
* Current status values observed:
* Constraints (CHECK / ENUM / FK):
* Defaults (including casing issues):
* Known inconsistencies:

Evidence must come from:

* migrations
* direct queries
* schema definitions

---

### 3. Current Code Reality

List actual behavior from code:

* Files writing to this entity:
* Functions mutating state:
* Status values being written:
* Any normalization logic:
* Any conflicting patterns:

Include file paths.

---

### 4. Active Execution Paths

Describe how the system currently behaves in practice:

* Entry point (e.g., lead creation, job creation)
* Transition flow
* Where state changes actually occur
* Any shadow logic (e.g., `pipeline_stage` usage)

---

### 5. Vocabulary Inventory (Preliminary)

List all observed values:

| Entity | Value | Location | Notes |
| ------ | ----- | -------- | ----- |
|        |       |          |       |

This must reflect **real usage**, not desired state.

---

### 6. Conflicts / Drift Identified

Explicitly list contradictions:

* DB vs Code mismatches
* Multiple values for same meaning
* Deprecated values still in use
* Shadow authority (e.g., pipeline_stage)

Be specific.

---

### 7. Mutation Ownership Reality

Identify who actually writes the data:

* Owner functions:
* Unauthorized raw writes:
* Automation paths:

---

### 8. Risk Assessment (If We Proceed Without Fixing Reality)

What breaks if you define rules before reconciling reality?

* enforcement failures
* false positives
* blocked valid flows
* hidden regressions

---

### 9. Decision Gate

You must answer this before proceeding:

> Is the system state sufficiently understood and consistent to define new governance?

* YES → proceed
* NO → STOP and create patch plan

---

## Enforcement Rule

> Any governance artifact created without a completed Reality Check is invalid.

---

## Output Standard

This document must be:

* evidence-based
* file-path referenced
* contradiction-aware
* concise but complete

No assumptions allowed.

---

## Outcome

This template ensures:

* governance is grounded in real system behavior
* no new “paper law” contradicts code or DB
* future decisions start from truth, not theory

This is the **precondition for all stable system design**.


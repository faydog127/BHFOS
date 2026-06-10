# SOURCE_OF_TRUTH_MAP.md

## Purpose

This document defines the **hierarchy of authority** for all governance, logic, and execution rules in BHFOS.

It eliminates conflicting instructions by establishing a **clear Chain of Command** across all documents.

If two sources conflict, this map determines which one wins.

---

## Core Rule (Non-Negotiable)

> If two documents conflict, the **higher-ranked source overrides automatically**.

No interpretation. No debate. No exceptions.

---

## Authority Levels

### LEVEL 1 — ENFORCED LAW (Machine Authority)

These are system-enforced constraints. They cannot be bypassed without code changes.

- Database Constraints (CHECK / ENUM / FK)
- `tools/review-gate.mjs`
- DB Triggers / Functions

**Rule:** If Level 1 rejects something, it is invalid regardless of any document.

---

### LEVEL 2 — GOVERNANCE LAW (Protocol Authority)

These define how the system *must behave* and are intended to be promoted into Level 1.

- `STATUS_VOCABULARY_LOCK_V1.md` (ACTIVE)
- `P0_BREACH_PATCH_PACKET_V1.md` (ACTIVE)
- `ENTITY_OWNERSHIP_AND_MUTATION_RULES.md` (ACTIVE)
- `SYSTEM_DEFINITION_V1.md` (ACTIVE)

**Rule:**
- Level 2 defines what must be enforced.
- Level 1 implements enforcement.

---

### LEVEL 3 — TRANSITION LAW (STRUCTURAL LOGIC)

- `STATUS_CONTRACTS.md` (**SUPERSEDED**)

**Rule:**
- Cannot override Level 2 vocabulary.
- Must be rewritten to align with `STATUS_VOCABULARY_LOCK_V1.md` before reuse.

---

### LEVEL 4 — OPERATIONAL REALITY

- Codebase (source of actual behavior)
- Database state
- `STATUS_REGISTRY.md` (future)

**Rule:**
- Level 4 defines reality.
- Level 2 defines what reality should become.

---

### LEVEL 5 — DECISION CONTROL

- `DECISION_LOG.md` (future)

**Rule:**
Decisions cannot be reopened unless:
- production issue occurs
- a direct contradiction is found
- explicit owner authorization is given

---

### LEVEL 6 — DESIGN / PLANNING

Non-authoritative (ideas, drafts, planning artifacts).

---

## Critical Governance Rule (Added)

> If Protocol (Level 2) conflicts with Execution (Level 3), Protocol wins **unless the Execution artifact is explicitly marked as a TEMPORARY OVERRIDE in `DECISION_LOG.md`.**

---

## Outdated Definition

A document is considered **OUTDATED** if:
- it conflicts with Level 2 authority
- it defines deprecated vocabulary
- it introduces competing execution logic

OUTDATED documents:
- may be referenced for context
- may NOT be used for decisions or enforcement

---

## Current System State (Explicit)

- Vocabulary authority = `STATUS_VOCABULARY_LOCK_V1.md`
- Patch authority = `P0_BREACH_PATCH_PACKET_V1.md`
- Mutation authority = `ENTITY_OWNERSHIP_AND_MUTATION_RULES.md`
- State machine contract = **NOT ACTIVE (pending rewrite)**

---

## Enforcement Direction

The system must evolve in this order:
1. Align reality (P0 patch)
2. Lock vocabulary
3. Enforce via review gate
4. Enforce via DB constraints/triggers
5. Rewrite state machine later

---

## Final Rule (Execution)

If a developer, AI, or system component must choose between sources:
1. Follow Level 1 (Enforced Law)
2. If not defined, follow Level 2 (Governance Law)
3. Ignore Level 6 entirely for execution decisions

# Command Center Continuity Protocol — Draft

**Date:** 2026-10-01  
**Status:** DRAFT — Founder direction confirmed in current interaction; governance merge not yet authorized  
**Applies to:** BHFOS Product & Build Command Center, Coordinator, Challenge Reviewer, Cursor / Builder, release agents and couriers  
**Purpose:** Prevent the Command Center itself from becoming the throughput bottleneck.

## Problem statement

The build process has repeatedly paused while waiting for a Command Center response even when the underlying work was routine, reversible, or already covered by an approved packet or delegated authority.

A thread change or temporary lack of Command Center availability must not freeze the entire delivery system.

The operating model already intends to preserve Founder focus and auto-continue routine work. This protocol makes the same principle explicit for Command Center availability.

## Core rule

> **Command Center approval is required for decisions, not acknowledgments.**

If an action is already authorized by the active release packet, decision register, delegated-authority policy, access matrix, and applicable security / financial controls, no separate Command Center ACK is required.

"Waiting for CC" is not a valid blocked state unless a **specific unresolved decision** exceeds standing authority.

## 1. No-ACK rule

Do not request or wait for a Command Center acknowledgment when all of the following are true:

- the active release / slice is implementation-authorized;
- the requested action is inside locked scope;
- the applicable decision has already been made;
- the action does not cross a Founder-only / Category C boundary;
- required tests / review evidence can be produced normally;
- no new architecture, business-rule, financial, security, compliance, customer-commitment, or data-authority decision is required.

Proceed and record the action.

## 2. Decision-needed rule

Escalate to Command Center only when a **new decision** is required.

The escalation packet must identify:

- exact decision needed;
- why existing authority does not resolve it;
- affected scope;
- viable options;
- recommendation;
- risk / reversibility;
- what work can continue without the decision.

Do not send a generic "what next?" or "please ACK" request.

## 3. Localized blocking

A blocked decision pauses only the work that actually depends on that decision.

Unrelated authorized work continues.

Example:

- unresolved Lessen write capability may block direct Lessen mutation;
- it must not block Unified Work Order modeling, HCP feasibility analysis, field UX, local tests, documentation, or other independent work.

## 4. Durable baton, not chat memory

Every active workstream must maintain a durable baton that allows a new Command Center thread or replacement agent to recover state without reconstructing the project from conversational memory.

Minimum baton contents:

- product / release identity;
- branch and exact HEAD;
- implementation authorization status;
- active scope;
- governing decisions;
- current phase;
- completed evidence;
- open blockers;
- decisions awaiting authority;
- exact next executable step;
- prohibited actions;
- links to PRs / evidence / source documents.

Chat is a communication surface, not the authoritative state store.

## 5. Thread-change recovery

When a Command Center conversation must change threads:

1. Coordinator / courier supplies the durable baton.
2. New Command Center instance checks the baton and repository evidence.
3. Previously decided matters are not re-asked.
4. Routine work continues under existing authority during the thread transition.
5. Only unresolved material decisions are presented.

A thread change must not automatically reset authorization, scope, or progress.

## 6. Proceed-and-notify rule

For routine Category A / B actions, the executing role proceeds under policy and writes the result to the baton / state ledger.

Notification may follow execution.

Do not convert routine notification into a precondition.

## 7. Challenge Reviewer boundary

Challenge review is required where the active packet or risk model requires it.

The Challenge Reviewer must pressure-test:

- domain ownership;
- architecture;
- security / RLS / authorization;
- financial integrity;
- lifecycle semantics;
- failure / retry behavior;
- acceptance evidence;
- design-system compliance where applicable.

The Challenge Reviewer is not an approval proxy for Founder-only decisions and should not create new routine stop points outside the active review policy.

## 8. Command Center outage behavior

If the Command Center is temporarily unavailable:

### Continue
- repository / PR inspection;
- documentation;
- tests;
- local proof;
- approved review dispatch;
- evidence collection;
- reversible preparation;
- work explicitly allowed by the active packet and delegated authority.

### Pause only affected action
- net-new product decision;
- material scope change;
- new implementation slice activation;
- financial authority change;
- security-boundary change;
- customer commitment outside standing policy;
- production mutation requiring Founder approval;
- irreversible data action;
- other explicit Category C / Founder-only boundary.

Do not freeze the entire program.

## 9. No repeated polling

A role that has already escalated a valid blocking decision must not repeatedly generate duplicate requests.

Record:

- blocker ID;
- decision requested;
- timestamp;
- affected work;
- continuing work;
- next check.

When authority responds, resume from the baton.

## 10. Self-contained courier packets

Every courier message to Command Center must be sufficient to decide without requiring the Command Center to search old threads.

Minimum format:

- **Context**
- **Current authority**
- **Exact state / SHA**
- **Decision required**
- **Options**
- **Recommendation**
- **Risk**
- **What continues regardless**
- **Requested ruling**

Do not bury the decision request in a long activity transcript.

## 11. Default resolution for non-material ambiguity

When an ambiguity is routine, reversible, and within scope, apply the existing governance default:

- preserve source authority;
- reduce rework;
- maintain compatibility with approved systems;
- prefer deterministic and auditable behavior;
- fail closed on security / money mutation;
- choose the smallest reversible implementation;
- document the choice.

Do not escalate merely because more than one reasonable coding implementation exists.

## 12. Definition of blocked

A workstream may use **BLOCKED — COMMAND CENTER DECISION** only when:

1. the required decision is named;
2. no current policy or prior decision resolves it;
3. the next affected action would exceed authority without the ruling; and
4. continuing that exact action would create material risk.

Otherwise use the appropriate working state and continue.

## 13. Throughput metric

Track:

- number of CC escalations;
- percentage resolved by existing policy without escalation;
- time work spent blocked solely on CC decision;
- number of duplicate / unnecessary ACK requests;
- number of thread transitions that caused rework;
- number of material decisions correctly escalated;
- number of unauthorized actions caused by over-delegation.

The goal is not zero escalation. The goal is **zero unnecessary waiting** while preserving human authority over consequential decisions.

## 14. Founder boundary

This protocol does not reduce Founder authority.

It reduces unnecessary synchronous dependence on the Command Center for already-authorized work.

Founder / Category C boundaries remain governed by the applicable BHFOS authority policy, production access matrix, active release packet, and newer explicit Founder directives.

## 15. Adoption status

This draft records the 2026-10-01 Founder direction that Command Center delay must be removed as a recurring process bottleneck.

Because adoption of a standing governance policy onto `main` is itself a governance action under the current approval thresholds, this file may be drafted and reviewed now but must not be represented as merged governing doctrine until the required governance merge authorization is recorded.

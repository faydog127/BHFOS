# Founder Approval Routing and Batching Protocol — Draft

**Date:** 2026-10-01  
**Status:** DRAFT — Founder direction confirmed in current interaction; governance merge not yet authorized  
**Applies to:** Grok / Persistent Build Coordinator, Courier, Command Center, Challenge Reviewer, Cursor / Builder, release agents  
**Purpose:** Remove the Founder from routine approval traffic while preserving Founder authority over material decisions.

## Core rule

> **Grok / Coordinator sends approval candidates to Command Center first, not to the Founder.**

Command Center is the approval triage layer.

The Founder is not the default approval queue and should not be asked to repeatedly approve routine, reversible, already-governed, or implementation-level choices.

## Routing sequence

1. Builder / reviewer / system identifies a decision or approval candidate.
2. Grok / Coordinator checks the active packet, authority policy, decision register, access matrix, prior rulings, and durable baton.
3. If already authorized, proceed and record the basis. Do not send an approval request.
4. If unresolved but routine, reversible, and within scope, send to Command Center.
5. Command Center resolves under existing product / build authority when possible.
6. Only when Command Center determines the matter crosses a Founder-only boundary is it included in the Founder decision queue.
7. Founder decisions are returned to Command Center, recorded durably, and propagated to Grok / Coordinator / Builder.

The Founder should never have to decide whether an issue is important enough for the Founder. Command Center performs that triage.

## What Grok / Coordinator must NOT send directly to Founder

Do not directly request Founder approval for:

- routine implementation choices inside an authorized slice;
- normal test / retry / remediation decisions;
- documentation corrections;
- reviewer-response remediation that preserves approved scope;
- branch / file / naming choices with no domain consequence;
- reversible UI implementation details inside the approved experience system;
- already-approved requirements restated in a new packet;
- repeated approval of the same decision at a later build step;
- routine evidence collection;
- read-only repository / PR / environment inspection;
- choices resolved by existing delegated-authority policy;
- requests whose only purpose is to obtain an ACK before continuing.

These go to Command Center when a decision is actually needed, or proceed automatically when authority already exists.

## Founder decision classes

Command Center escalates only matters that genuinely require Founder authority, including:

- material product-scope change;
- new release / implementation-slice activation where governance requires Founder authorization;
- material business-rule change;
- pricing / discount policy outside delegated limits;
- customer commitment outside standing authority;
- financial-authority or payment-rail change;
- security-boundary / accepted-risk decision;
- destructive or irreversible data action;
- legal / contract / regulatory implication;
- production action explicitly reserved to Founder;
- material spend / schedule exposure beyond delegated thresholds;
- doctrine / governance adoption that changes standing authority.

Existing governing policy remains controlling when it is more specific.

## Founder batching rule

Founder-required decisions should be **batched by workstream / release whenever waiting does not create immediate material risk**.

A Founder batch should contain only decisions that Command Center has already triaged as Founder-required.

Each batch item must include:

- short decision title;
- why Founder authority is required;
- recommended option;
- alternatives only if materially distinct;
- consequence of no decision;
- whether development can continue around the item;
- exact branch / PR / SHA when applicable.

Do not send raw reviewer discussions, long build transcripts, or duplicate requests to the Founder.

## Immediate Founder escalation exception

Do not wait for a batch when delay itself could create material harm, such as:

- active production money / auth / data-integrity incident;
- live customer commitment requiring immediate Founder authority;
- security incident with material exposure;
- irreversible action with an expiring decision window;
- legal / contractual deadline that cannot wait.

Even then, Command Center should first frame the exact decision unless technically unavailable.

## No repeated approval rule

Once a Founder decision is recorded for a defined scope, later agents may not ask the Founder to approve the same decision again merely because:

- the thread changed;
- the work moved from planning to coding;
- a different reviewer is now involved;
- the Coordinator changed;
- Cursor created a new PR;
- evidence was reformatted;
- the same rule is encountered on another normal execution step.

Re-approval is required only when the scope, risk, authority, or material facts changed.

## Approval ledger

Every decision should have a durable identity:

- decision ID;
- decision owner;
- authority level;
- scope;
- date;
- governing artifact / chat instruction if current-session authority is used;
- exact payload / ruling;
- expiry or revalidation trigger when applicable;
- related PR / SHA / release.

Grok / Coordinator must check the ledger before generating a new approval request.

## Command Center Founder-filter behavior

For each incoming approval candidate, Command Center chooses exactly one disposition:

- **ALREADY AUTHORIZED — PROCEED**
- **CC DECISION — PROCEED WITH RULING**
- **RETURN FOR MORE EVIDENCE — WORK CONTINUES WHERE POSSIBLE**
- **FOUNDER BATCH — NOT URGENT**
- **FOUNDER ESCALATION — URGENT**
- **REJECT / OUT OF SCOPE**

The Founder should receive only the last two categories.

## Development continuity

A pending Founder batch item blocks only the exact action that requires that decision.

Grok / Coordinator must identify what can continue and keep those lanes moving.

"Waiting for Founder" may not become a program-wide pause unless the unresolved decision truly controls the entire active release.

## Success measures

Track:

- raw approval candidates generated;
- percentage eliminated because authority already existed;
- percentage resolved by Command Center;
- percentage escalated to Founder;
- duplicate Founder approval requests;
- Founder approval interruptions per week;
- development time blocked waiting on Founder;
- development time blocked waiting on Command Center;
- incorrect non-escalation of a true Founder decision.

The target is not to remove Founder authority. The target is to make Founder attention scarce, deliberate, and high-value.

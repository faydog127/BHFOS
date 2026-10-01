# Cockpit Re-baseline — Challenge Review Packet

**Date:** 2026-10-01  
**Target PR:** #165  
**Target branch:** `planning/cockpit-rebaseline-2026-10-01`  
**Review type:** Product / architecture / operations / security / financial-integrity pressure test  
**Implementation authorization:** NONE

## Review objective

Pressure-test whether the proposed Cockpit direction can realistically serve as the unified operating control plane for TVG from intake through collected revenue while preserving source authority, financial integrity, field usability, degraded operation, and BHFOS product boundaries.

The reviewer should identify contradictions, hidden coupling, unsafe authority assumptions, missing domains, and scaling failure modes before release slicing.

## Founder business test

The initial proof question is:

> Can Cockpit help TVG reach and sustainably operate at $500K+ annual revenue without Erron becoming the human integration layer?

Reject any product direction that merely centralizes screens while leaving the Founder responsible for reconciliation, portal switching, exception discovery, or remembering customer-specific procedures.

## Required review dimensions

### 1. Product coherence

Check whether the charter clearly distinguishes:

- Cockpit as operating control plane;
- source systems as authoritative where applicable;
- Finance as governed financial capability / authority;
- Communications as interaction capability;
- Network OS and Partner OS as independent BHFOS products;
- TVG-specific proving-ground behavior vs reusable platform architecture.

Flag any area where Cockpit silently becomes a duplicate CRM, accounting system, marketplace, or Network OS.

### 2. Unified Work Order integrity

Test whether one Cockpit work identity can safely represent work from HCP, Lessen, Lula, direct customers, Pure Install / similar sources, and future Network OS events without:

- overwriting source IDs;
- conflating customer and source;
- losing provenance;
- creating duplicate billable work;
- creating duplicate invoices / payouts;
- hiding external state conflicts.

Specify any missing identity / reconciliation invariants.

### 3. Client / property / contact model

Pressure-test:

- person vs organization;
- property / service location;
- portfolio relationships;
- multiple contacts;
- source identities;
- duplicate merge;
- archive vs delete;
- customer-owned vs marketplace-provided records;
- historical retention;
- cross-entity TVG / BHIS separation.

Flag any design that would make future Network OS integration require shared authoritative tables.

### 4. Field execution

Test the proposed technician flow:

**My Work → Scope → Check In → Work → NTE / Change → Evidence → Closeout → Check Out**

Identify missing real-world states including:

- unable to access;
- customer unavailable;
- unsafe condition;
- partial completion;
- return trip;
- warranty / go-back;
- scope disagreement;
- no signal;
- portal unavailable;
- rejected NTE;
- NTE pending while base scope can continue;
- multi-tech / crew handoff;
- job spanning multiple days;
- technician reassignment;
- evidence rejected after departure.

### 5. NTE / change authority

Verify that the model can distinguish:

- pre-authorized NTE;
- customer-specific NTE ceiling;
- request vs approval;
- verbal vs documented approval;
- approved amount vs final amount;
- rejected / expired authorization;
- change affecting schedule / skill / material;
- source platform requirement;
- who may proceed and under what evidence.

No AI or technician should silently create customer financial commitments outside policy.

### 6. Finance boundary

Review the Cockpit ↔ Finance contract.

Required separation:

- operational status;
- quoted / authorized amount;
- completed scope;
- invoice-ready;
- invoice issued;
- payment / payout;
- reconciliation;
- direct cost;
- margin / planning read model.

Challenge any dual-writer design.

Current Finance PR #164 is planning implementation Steps 1–6 only, unmerged, non-persistent. Do not design as if it is already the production financial authority.

### 7. Communications boundary

Review the Cockpit ↔ Communications contract for:

- inbound email classification;
- identity resolution;
- attaching threads to client / property / work;
- routine response;
- approval-required response;
- NTE communication;
- scheduling;
- closeout;
- invoice / payment follow-up;
- review requests;
- unsubscribe / consent requirements where applicable;
- false association / wrong-recipient risk.

Current Email Pass 1 PR #162 is draft / unmerged. Do not assume customer sending capability is live.

### 8. Integration realism

For HCP, Lessen, Lula, email, calendar, Pure Install / similar sources:

- identify likely read capability;
- identify likely write capability;
- identify required contract / terms review;
- classify API / integration / ingestion / guided action / browser automation;
- identify actions that cannot safely be promised before verification.

The core technician workflow must remain stable even when a source remains Level 1 guided rather than fully integrated.

### 9. Degraded operation

Challenge whether field work can continue when:

- Cockpit unavailable;
- mobile data unavailable;
- external API unavailable;
- source portal unavailable;
- email unavailable;
- Finance unavailable;
- synchronization delayed.

Require explicit reconciliation after recovery and duplicate protection.

### 10. Security and authorization

Review:

- identity;
- role separation: Owner, Admin/Dispatcher, Technician;
- data scope;
- source-system credentials;
- write authority;
- customer data exposure;
- prompt injection;
- audit receipts;
- deletion;
- financial actions;
- external communications;
- compromised device;
- technician access termination.

Flag any workflow where chat alone implicitly grants authority.

### 11. Scale economics

Pressure-test the $500K target.

Cockpit should reduce:

- owner system-switching;
- admin touches per work order;
- time from completion to invoice readiness;
- missed follow-up;
- idle technician capacity;
- untracked NTE;
- uncollected / unreconciled revenue.

Challenge any slice plan that cannot show measurable operating leverage.

### 12. Product discipline

Reject scope that does not materially support:

- acquiring work;
- executing work;
- reducing administrative burden;
- increasing field utilization;
- reducing leakage;
- accelerating cash conversion;
- improving management control;
- protecting customer commitments and financial integrity.

Interesting AI features without a direct operational contribution are deferred.

### 13. Command Center continuity

Pressure-test `COMMAND_CENTER_CONTINUITY_PROTOCOL_DRAFT.md`.

Specifically check:

- whether "no ACK required" could accidentally bypass material decisions;
- whether block localization is safe;
- whether thread recovery has enough durable state;
- whether courier packets are self-contained;
- whether retry / escalation rules can produce silent drift;
- whether governance precedence is explicit enough.

The goal is zero unnecessary waiting, not zero human authority.

## Required reviewer output

Return one of:

- **PASS**
- **PASS WITH REQUIRED CORRECTIONS**
- **CHANGES REQUIRED**
- **BLOCKED — DECISION REQUIRED**

For every finding include:

1. severity;
2. affected section / domain;
3. evidence / reasoning;
4. required correction;
5. whether it blocks planning, release activation, or implementation;
6. whether existing authority can resolve it without Founder escalation.

Do not request Founder input for routine architecture or wording choices that can be resolved under existing governance.

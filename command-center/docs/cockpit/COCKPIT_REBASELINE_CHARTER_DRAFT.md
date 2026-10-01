# BHFOS Cockpit Re-baseline Charter — Draft

**Date:** 2026-10-01  
**Status:** DRAFT — Founder direction confirmed in current interaction; not merged; not implementation-authorized  
**Planning branch:** `planning/cockpit-rebaseline-2026-10-01`  
**Baseline:** `main@17f9228951d74824d9b6fb0eb704832befed2afc`  
**Initial proving ground:** The Vent Guys (TVG)  
**Initial business target:** Enable TVG to reach and sustainably operate at **$500,000+ annual revenue** without the Founder becoming the human integration layer.

## Product thesis

BHFOS Cockpit exists to **separate business growth from operational complexity**.

As customers, work sources, technicians, communications, financial obligations, and external platforms increase, Cockpit provides one operating model from first signal through collected revenue and follow-through.

The product is not merely a dashboard, chat shell, CRM, or portal aggregator. It is the **unified operating control plane** through which TVG personnel manage work while preserving the authority of the systems that legitimately own source records.

The field principle is:

> **One work order. One field workflow. One method of doing business.**

Customer- and platform-specific complexity belongs in the system, not in the technician's head.

## Why this is urgent

TVG cannot scale if the Founder must personally bridge portals, calls, emails, schedules, work-order systems, NTE requests, closeout requirements, invoices, payments, and follow-up.

The current fragmentation creates an owner-bandwidth constraint:

- work arrives through multiple systems and people;
- each source has its own process;
- information is distributed across portals, email, calls, scheduling tools, and operational software;
- follow-up, NTE, closeout, invoicing, and payment tracking can become separate workflows;
- technicians risk learning customer-specific software instead of one TVG operating method;
- administrative labor rises with every new account or work source;
- the Founder becomes the integration layer.

Cockpit succeeds when additional revenue, customers, work sources, and technicians do **not** require equivalent growth in owner intervention or manual coordination.

## Cradle-to-grave lifecycle

Cockpit shall support one coherent work lifecycle:

1. Signal / intake
2. Client and service-location resolution
3. Opportunity / request
4. Estimate / authorization when required
5. Unified TVG Work Order
6. Scheduling / dispatch
7. Technician assignment
8. Arrival / check-in
9. Field execution
10. NTE / change / exception handling
11. Evidence capture
12. Operational closeout
13. Customer / platform completion communication
14. Invoice-ready state
15. Invoice tracking
16. Payment / payout tracking
17. Reconciliation
18. Warranty / callback / dispute if applicable
19. Customer follow-up / retention
20. Explicit terminal disposition

A work order is not considered operationally complete merely because field labor stopped. Completion requires the required closeout, communication, financial handoff, and follow-through state to be known.

## Unified Work Order

Every piece of executable work receives an internal Cockpit work identity regardless of where it originated.

Example:

- Cockpit Work Order: `TVG-WO-10482`
- Source system: Lessen
- External reference: provider/source work-order ID
- Client / property / service location
- Service scope
- Required customer rules
- Assigned technicians
- Schedule
- NTE / change state
- Evidence state
- Closeout state
- Invoice / payout state
- Payment / reconciliation state
- Warranty / follow-up state

External identifiers remain namespaced by source and are never replaced by display-name matching.

## Customer-rule profiles

Adding a customer or work source should primarily be configuration, not a new way of operating.

A customer-rule profile may define:

- check-in / check-out requirements;
- NTE threshold and approval routing;
- required before/during/after evidence;
- completion checklist;
- service-level requirements;
- contact / escalation path;
- invoice / payout requirements;
- payment terms;
- warranty / go-back rules;
- communication expectations;
- source-system actions and integration capability;
- prohibited or restricted actions.

The technician sees the TVG workflow. Cockpit handles or guides the source-specific rules.

## Operating roles

### Owner
The Owner operates from decisions, capacity, exceptions, client health, revenue, cash, performance, and risk.

### Admin / Dispatcher
Administration manages intake quality, scheduling, client records, follow-up, NTE routing, closeout exceptions, invoice readiness, payment exceptions, and reconciliation queues.

### Technician
The technician operates from a mobile-first field workflow:

**My Work → Scope → Check In → Perform Work → NTE / Change if needed → Evidence → Closeout → Check Out**

The technician should not need to know which underlying platform owns the work except when a guided external action is unavoidable.

## Capacity and work-source strategy

Cockpit may normalize work from:

- Housecall Pro;
- Lessen;
- Lula;
- direct residential customers;
- direct multifamily / commercial clients;
- referral channels;
- Pure Install and similar capacity-filling work sources;
- future Network OS work;
- other approved sources.

Capacity-filling work must not displace higher-priority or higher-value committed work.

Future routing may consider:

- technician qualification;
- geography and travel;
- schedule gaps;
- estimated duration;
- revenue;
- expected margin;
- customer priority;
- service-level commitments;
- equipment / crew requirements;
- callback / warranty obligations.

## Financial integration boundary

Cockpit is **not** a second accounting ledger.

Cockpit owns the operational lifecycle and presents role-appropriate financial status. The governed Finance capability or designated accounting authority owns financial calculations, financial controls, invoice/payment authority, and reconciliation as explicitly defined.

The intended contract is:

**Operational facts from Cockpit → governed Finance layer → financial state / planning / reconciliation returned to Cockpit**

Operational and financial states remain distinct. For example:

- scheduled is not completed;
- completed is not invoice-ready;
- invoice-ready is not invoiced;
- invoiced is not collected;
- collected is not necessarily reconciled.

As of 2026-10-01, Finance PR #164 is **Steps 1–6 only, DO NOT MERGE, no persistence / migration / production deployment**. This charter defines the integration boundary without treating that lane as production-ready.

## Communications integration boundary

Communications shall be tied to the client / property / work-order context.

The intended communications functions include:

- email intake and classification;
- work-order / client association;
- routine response preparation;
- authorized response execution;
- scheduling communication;
- NTE / approval communication;
- completion / closeout communication;
- invoice / payment follow-up;
- review / retention follow-up;
- unresolved-reply and commitment detection.

Email remains authoritative for the message itself. Cockpit owns the operational relationship, follow-through state, and links to the source communication.

As of 2026-10-01, TVG Email Pass 1 PR #162 remains **draft and unmerged**. Cockpit shall not assume that unfinished email capability is already available.

## External-system authority

Cockpit shall not arbitrarily replace legitimate systems of record.

Every synchronized or actionable external record must preserve:

- source system;
- source identifier;
- last successful synchronization;
- freshness;
- source authority;
- actionable vs informational status;
- reconciliation state;
- direct source link when available;
- external action receipt when an action is executed.

Connector preference:

1. Supported API / webhooks
2. Approved third-party integration
3. Controlled email / document / data ingestion
4. Guided external action
5. Authorized browser automation only when justified and governed

An integration may progress from guided to assisted to integrated without changing the technician's core operating workflow.

## Client administration

Cockpit must support visible, governed client maintenance and conversational control.

Required capabilities include:

- create;
- edit;
- add / remove contacts;
- add / remove service locations;
- correct source attribution;
- merge verified duplicates;
- archive;
- restore;
- restricted permanent deletion;
- change history.

Normal "remove" behavior should generally be archive, not hard delete, when operational or financial history depends on the record.

## Exceptions are first-class work

Cockpit shall surface exceptions rather than require staff to hunt for them.

Examples:

- failed or missing check-in;
- stale synchronization;
- missing evidence;
- unapproved NTE;
- job unable to close;
- duplicate identity;
- failed external write;
- invoice not created / submitted;
- overdue payment;
- payout mismatch;
- unresolved email;
- callback / warranty;
- disputed scope;
- capacity gap;
- source-system outage.

The system should make normal work quiet and exceptions obvious.

## Degraded mode

Critical field operations must have a safe fallback.

An API outage, portal failure, poor signal, email failure, or Cockpit connector failure must not unnecessarily stop a technician from performing authorized work.

Each critical workflow shall define:

- offline / degraded capture where practical;
- queued synchronization;
- source reconciliation;
- duplicate protection;
- human escalation where required;
- explicit status when external confirmation is unavailable.

## Security and authority

Cockpit connects high-value systems and therefore requires:

- least privilege;
- separate read / prepare / write authority where possible;
- explicit source/data scopes;
- immutable action and approval receipts;
- no model access to raw credentials;
- prompt-injection defenses;
- identity and record-resolution confidence;
- safe retries and idempotency;
- human authority for material customer, financial, security, compliance, and irreversible actions unless a narrow standing rule explicitly authorizes otherwise.

## Product boundaries

Network OS and Partner OS remain independent products.

Cockpit may interoperate with them only through controlled APIs, events, contracts, or approved connectors. Cockpit shall not absorb their authoritative domain tables or make their independent usefulness depend on Cockpit.

## Initial success test

The primary proof-of-concept question is:

> **Can Cockpit help TVG reach and sustainably operate at $500,000+ annual revenue while reducing owner dependency and preventing administrative complexity from growing at the same rate as revenue?**

Measures should include:

- founder hours spent on portal / system switching;
- admin touches per completed work order;
- percentage of work completed through the standard TVG workflow;
- work orders with complete evidence and closeout;
- NTE cycle time;
- invoice-ready latency after field completion;
- invoice submission latency;
- payment / payout visibility and reconciliation exceptions;
- missed follow-ups;
- stale work;
- technician billable utilization;
- estimated vs actual labor;
- schedule / capacity utilization;
- revenue and margin by source / service / customer;
- work-source fill of otherwise idle capacity;
- first-time completion and callback / warranty rate;
- percentage of accepted work reaching an explicit terminal state;
- external-action failures and unresolved sync exceptions.

## Product discipline

Cockpit must end, not accelerate, solution chasing.

A new tool should be added only when:

1. a real Cockpit capability gap exists;
2. the current stack cannot reasonably satisfy the need;
3. the new tool produces a clear revenue, reliability, compliance, or labor benefit; and
4. it can integrate into the Cockpit operating model without creating another independent workflow.

## Build governance

This charter authorizes planning and re-baselining only.

No coding is authorized merely because this draft exists.

The previous Cockpit Slice 1 build packet is not to be used unchanged for new implementation because its approved scope predates this cradle-to-grave direction and explicitly excluded live field execution, external work-order actions, invoicing, payments, and multi-user field/admin operation.

A new release / slice requires:

- re-baselined Product Definition;
- workflow map;
- domain and authority model;
- connector feasibility;
- Finance contract;
- Communications contract;
- Definition of Ready;
- challenge review;
- explicit implementation activation under BHFOS governance.

## Command Center throughput principle

The Command Center is a **decision authority, not a synchronous semaphore**.

Routine work inside an approved release, standing policy, or delegated authority must not wait for a conversational acknowledgment from the Command Center. See `COMMAND_CENTER_CONTINUITY_PROTOCOL_DRAFT.md`.

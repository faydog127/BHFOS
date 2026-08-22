# ADR-NOS-002 — Service Need Authoritative Model

**Status:** Proposed — founder ratification required  
**Date:** 2026-08-22  
**Decision owner:** Founder  
**Product:** Network OS  
**Implementation authority:** None; architecture decision only

## Context

BHIS frequently learns about customer demand before there is an executable job. A property visit may reveal a vendor problem, future project, recurring opportunity, budget-cycle need, or service category where BHIS currently lacks Service Partner capacity.

Legacy BHFOS has Leads, Deals, Pipeline, and Jobs. None cleanly represents this managed-network demand state. Treating every identified need as a Lead or Work Order would either overload direct-sales semantics or create false operational work.

## Decision

Network OS will introduce **Service Need** as an authoritative domain object distinct from both customer relationship records and Work Orders.

A Service Need represents a known customer demand/opportunity that BHIS may need to qualify, develop capacity for, quote, defer, lose, convert to executable work, or recognize as recurring.

## Core identity and relationships

A Service Need will have a stable identity and may relate to:

- Organization.
- Portfolio/Region.
- Property/Facility.
- Contact.
- BHIS relationship owner.
- governed Service Catalog item(s).
- source Visit/Contact Event.
- attachments/evidence.
- zero, one, or multiple Work Orders.

A Service Need does not require a Work Order to exist.

## Lifecycle decision

The Phase 1 conceptual lifecycle supports:

- Identified.
- Qualifying.
- Service Partner Capacity Needed.
- Quote Requested.
- Quote Submitted.
- Approved.
- Scheduled/converted where useful to user workflow.
- Completed.
- Deferred.
- Lost.
- Recurring Opportunity.

Architecture may normalize these into state plus outcome/reason fields, but it must preserve the business meaning and history.

## Conversion rule

Creating executable work from a Service Need does not destroy or replace the Service Need.

The Service Need remains the demand/history parent and may generate:

- no Work Order;
- one Work Order;
- multiple Work Orders across properties, phases, visits, or occurrences where later requirements authorize it.

## Demand-intelligence rule

Service Need data must remain reportable even when no work is won or fulfilled. This is necessary for BHIS to identify:

- unmet service demand;
- geographic gaps;
- Service Partner recruiting priorities;
- deferred opportunities;
- recurring opportunities;
- customer relationship expansion.

## Legacy reuse decision

- Leads/Pipeline components may be reused for UI patterns, source attribution, follow-up, and stage visualization.
- Legacy `leads` will not become the authoritative Service Need record by simple rename.
- Jobs/Work Orders will not be used to represent pre-execution demand.
- Migration of any existing opportunity data requires explicit mapping rules.

## Consequences

### Positive

- BHIS can record what customers need before the network can fulfill it.
- Unfulfilled demand becomes strategic recruiting intelligence instead of disappearing.
- Work-order metrics are not polluted by opportunities that never became executable work.
- One customer need can later generate multiple execution records without losing the original context.

### Costs

- Adds a new authoritative domain and conversion/linkage logic.
- Existing Lead/Pipeline UI cannot be carried forward unchanged.
- Reporting must distinguish demand, approved work, and completed work.

### Risks

- Service Need and Work Order may become duplicative if field ownership is not explicit.
- Too many statuses could recreate legacy pipeline complexity.
- Users may skip Service Need capture if direct work creation is easier; UX must support fast conversion and authorized direct-intake paths.

## Rejected alternatives

| Alternative | Reason rejected |
|---|---|
| Rename `leads` to Service Needs | Carries direct-sales semantics and legacy coupling into Network OS |
| Create a Work Order for every request/idea | Pollutes execution workload and loses pre-work demand intelligence |
| Store needs only as relationship notes | Not reportable, matchable, or actionable enough for network planning |
| Delete Service Need after Work Order creation | Destroys demand lineage and one-to-many history |

## Implementation gate

Before implementation, the active release must define exact required fields, lifecycle transition rules, conversion permissions, Work Order linkage, reason codes, event history, migration rules, RLS/access, and acceptance tests for REQ-NOS-P1-004.

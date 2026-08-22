# ADR-NOS-001 — Customer Hierarchy Model

**Status:** Active — founder ratified 2026-08-22
**Date:** 2026-08-22  
**Decision owner:** Founder  
**Product:** Network OS  
**Implementation authority:** None; architecture decision only

**Ratification evidence:** `../NETWORK_OS_RELEASE1_SLICE1_FOUNDER_RATIFICATION_PACKET.md`

## Context

Network OS must support BHIS customer relationships at multiple levels without hard-coding the product around multifamily. The initial operating pattern is management/ownership company → region/portfolio → property/facility → optional building/unit/asset → contacts.

The copied foundation already contains `organizations`, `accounts`, and `contacts`, but the legacy direct-service model is flatter and commonly treats the customer/person or lead as the operational root. Network OS instead needs durable organization/property identity because Service Needs, Work Orders, relationship ownership, Service Partner rules, reporting, and future portfolio-level service programs depend on stable customer hierarchy.

## Decision

Network OS will use an explicit hierarchical customer-network model with the following logical entities:

1. **Organization** — ownership group, management company, operating company, institution, or other top-level customer organization.
2. **Portfolio/Region** — optional grouping layer owned by or associated with an Organization.
3. **Property/Facility** — the primary physical service location and operational customer context.
4. **Building/Unit/Asset** — optional subordinate service-location or asset context when required by a service or customer type.
5. **Contact** — a person identity that may hold one or more contextual roles across Organization, Portfolio, Property, or Facility.
6. **Relationship** — BHIS-owned account/relationship metadata associated with the appropriate customer context rather than embedded only in a Contact record.
7. **Visit/Contact Event** — durable relationship activity linked to the relevant customer context.

The architecture will not require every customer to use every hierarchy layer. Portfolio/Region and Building/Unit/Asset are optional.

## Identity rules

- Organization and Property/Facility must have stable Network OS identities independent of contacts, leads, or work orders.
- A Contact may be related to multiple customer contexts and may hold different roles in each context.
- Deleting or changing a contact must not destroy customer/property history.
- Work Orders and Service Needs must reference the Property/Facility directly when a physical service location exists.
- Organization-level service demand may exist without a specific Property/Facility only when the business process genuinely supports it.

## Relationship ownership

Relationship data such as BHIS owner, relationship status, last contact, next planned contact, customer preferences, vendor issues, and strategic notes belongs to a dedicated relationship/context layer rather than being stored exclusively on a contact or lead.

## Legacy reuse decision

- `organizations` is a strong candidate for reuse as the Organization identity if current constraints and semantics fit.
- `contacts` is a strong candidate for reuse as person identity.
- `accounts` may be reused selectively, but Network OS will not force all hierarchy semantics into a generic account-type field if that creates ambiguity.
- New explicit Portfolio/Region and Property/Facility structures may be introduced if the legacy model cannot represent them cleanly.
- `leads` will not be the authoritative customer hierarchy root.

## Future-market rule

The core hierarchy must support multifamily now and later customer types such as ALF/senior living, group homes, commercial/institutional, and government without requiring a new root customer model. Market-specific attributes belong in modular extensions or qualification/access rules.

## Consequences

### Positive

- Stable customer/property identity supports relationship history, demand intelligence, work coordination, portfolio reporting, and future service programs.
- Contacts can change without breaking property history.
- Future customer types can reuse the same core hierarchy.
- BHIS can manage relationships at property, regional, and organization levels.

### Costs

- Existing flat customer/account assumptions require reconciliation.
- Migration may require additive hierarchy records and relationship mapping.
- UI/navigation must support parent-child context without becoming cumbersome.

### Risks

- Over-generalizing the hierarchy could create unnecessary complexity.
- Reusing `accounts` without semantic cleanup could preserve legacy ambiguity.
- Property and organization duplicates could undermine reporting if identity rules are weak.

## Rejected alternatives

| Alternative | Reason rejected |
|---|---|
| Contact/lead is the customer root | Fails portfolio/property relationship model and loses durable physical-site identity |
| One generic `accounts` table with type strings for everything | Possible implementation detail, but rejected as the conceptual architecture because it hides important hierarchy semantics |
| Multifamily-specific property schema | Blocks clean expansion to future facility/customer types |
| Require all hierarchy levels for every customer | Creates unnecessary data-entry burden and weak adoption |

## Implementation gate

Before implementation, the active release must define exact reused/new records, uniqueness rules, parent-child constraints, migration behavior, RLS/access rules, and acceptance tests for REQ-NOS-P1-001 through REQ-NOS-P1-003.

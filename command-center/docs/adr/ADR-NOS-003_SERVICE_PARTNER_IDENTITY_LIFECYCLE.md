# ADR-NOS-003 — Service Partner Identity & Lifecycle

**Status:** Proposed — founder ratification required  
**Date:** 2026-08-22  
**Decision owner:** Founder  
**Product:** Network OS  
**Implementation authority:** None; architecture decision only

## Context

Network OS must treat companies that fulfill managed work as operational Service Partners. The copied foundation already contains partner prospects, partner onboarding, referral codes, commission/benefit concepts, realtor-oriented flows, partner status, and performance/SLA UI patterns.

Those assets are useful implementation inventory but do not represent the Network OS domain correctly. A Service Partner is not a referral partner, affiliate marketer, individual technician, or Partner OS tenant.

## Decision

Network OS will establish **Service Partner** as a distinct organization-level network identity with its own lifecycle, contacts, capability, geography, qualification state, restrictions, and operational history.

The collective fulfillment network is the **Service Partner Network**.

## Identity rules

- Service Partner identity represents the business/entity BHIS contracts with or coordinates for service fulfillment.
- A Service Partner may have multiple contacts.
- A Service Partner may participate in Network OS without adopting Partner OS.
- Service Partner identity is separate from BHIS customer identity even if a business could theoretically occupy both roles in different contexts.
- Service Partner identity is separate from internal technician/employee identity.
- Referral source and acquisition source are attributes/relationships, not the definition of Service Partner identity.

## Lifecycle decision

The conceptual lifecycle is:

Prospect → Contacted → Interested → Application Started → Application Submitted → Documentation Review → Approved → Active → Preferred

with controlled branches/states for:

- Restricted/Suspended.
- Inactive.

Lifecycle describes the Service Partner's network relationship state. It does **not** replace qualification status.

A Service Partner can be in an onboarding lifecycle stage while qualification evidence is being collected, and an Active Service Partner can later become ineligible for a particular job because a required qualification expires.

## Capability separation

Service Partner identity must not store all operational capability as a few free-text profile fields.

The architecture will support separate structured relationships for:

- governed services/capabilities;
- geography/coverage;
- property/facility experience;
- emergency/after-hours capability;
- crew/equipment/job-size facts where applicable;
- future availability/capacity;
- qualification layers/evidence;
- customer/property preferences/restrictions;
- observed work/performance history.

## Declared versus observed rule

Network OS will preserve a distinction between what the Service Partner declares and what BHIS later observes through actual work. Phase 1 may primarily capture declared capability, but the model must not prevent later observed-capability evidence from influencing matching and network planning.

## Legacy reuse decision

- `partner_prospects` is a migration/reuse candidate for prospect identity/source data.
- Existing partner list, onboarding, status, SLA, and performance UI patterns may be reused selectively.
- Referral codes, commissions, realtor persona, and referral tiers will not define Service Partner identity or lifecycle.
- Existing Partner OS or direct-service partner concepts must not silently become Network OS Service Partner authority.

## Partner OS boundary

Partner OS is a separate BHFOS product.

A Service Partner may later connect Partner OS to Network OS through controlled contracts. Network OS owns the Service Partner's managed-network identity, eligibility, offer/response history, and BHIS performance record. Partner OS owns the Service Partner's internal business operations.

## Consequences

### Positive

- Service Partner Network can grow independently of Partner OS adoption.
- Provider recruiting, onboarding, qualification, matching, and performance share one stable business identity.
- Referral/marketing semantics no longer distort fulfillment-network behavior.
- Future interoperability has a clean organization-level boundary.

### Costs

- Legacy partner records require classification and migration mapping.
- Existing partner UI and status logic need semantic cleanup.
- Capability/geography/qualification become related domains rather than a single simple profile.

### Risks

- If lifecycle and qualification are conflated, expired compliance could produce incorrect network status or eligibility.
- Duplicate Service Partner organizations could fragment work/performance history.
- Premature Partner OS coupling could create adoption friction and shared-data ownership problems.

## Rejected alternatives

| Alternative | Reason rejected |
|---|---|
| Reuse referral partner model unchanged | Referral/commission semantics do not represent operational fulfillment capacity |
| Service Partner equals Partner OS account/tenant | Makes Partner OS adoption a hidden dependency and breaks product independence |
| Service Partner equals individual technician | Wrong contractual/operational level for BHIS network coordination |
| Store capability only as profile text/tags | Insufficient for deterministic eligibility, density reporting, and future matching |

## Implementation gate

Before implementation, the active release must define organization identity/duplicate rules, lifecycle transition permissions, contact relationships, source attribution, capability/geography structures, internal-versus-external visibility, migration rules, RLS/access, and acceptance tests for REQ-NOS-P1-006 through REQ-NOS-P1-008 and REQ-NOS-P1-010.

# BHFOS V2 — BHIS Product-Direction Amendment

| Field | Value |
| --- | --- |
| Status | Proposed — not active |
| Version | 0.1 |
| Date | 2026-08-22 |
| Owner | Founder |
| Supporting reconciliation | `reviews/V2_BHIS_PRODUCT_DIRECTION_RECONCILIATION.md` |
| Implementation authority | None |

## Proposed amendment

BHFOS V2 shall be the operating platform for approved Black Horse service-delivery operations, initially supporting two first-party operating models:

1. **TVG Direct Services** — The Vent Guys owns the direct service relationship and primarily fulfills work through internal personnel/crews.
2. **BHIS Managed Services** — Black Horse Integrated Services (BHIS; blackhorseintegrated.com) owns and manages the service relationship and coordinates fulfillment through qualified internal, BHIS-network, customer-preferred, or customer-mandated fulfillment parties.

This amendment expands the approved product operating context; it does not authorize a generic multi-company SaaS platform, tenant provisioning/switching, per-tenant billing/configuration, franchise administration, or arbitrary third-party operating-company onboarding.

## Shared product promise

BHFOS should make service demand visible, the right work easier to coordinate, failures and exceptions harder to miss, outcomes easier to verify, customer relationships easier to deepen, provider capacity easier to understand, and operational/financial performance easier to manage.

BHFOS remains the authoritative system of record for implemented operational domains. External systems may orchestrate or deliver authorized actions but may not silently replace authoritative BHFOS state.

## BHIS operating purpose

BHIS is a managed service-delivery organization, not a contractor directory, referral marketplace, or open bidding marketplace.

BHFOS should enable BHIS to answer in real time:

- What do our customers need?
- Where do they need it?
- Which providers are eligible?
- Which providers are actually available?
- Which provider is most likely to execute successfully?
- What work is at risk?
- Which customers need attention?
- Where is provider capacity insufficient?
- What provider capabilities should BHIS recruit next?
- How well is the network performing?
- Is the network operating profitably?

## Core BHIS operating dimensions

BHIS product capabilities should support one or more of:

1. Customer Capacity.
2. Provider Density.
3. Service Coordination.
4. Customer Trust.
5. Demand-to-Capacity Matching.
6. Network Economics.

**Network Fulfillment Rate** is a primary long-term BHIS KPI, with a target of 95%+ in mature core markets. **First-Match Fulfillment Rate** is a companion network-quality indicator.

## Core product-domain changes

The Product Definition should be revised to:

- preserve and expand customer/contact/property/account management into organization, portfolio/region, property/facility, contact, building/unit/asset, relationship, visit, and account-growth intelligence;
- promote Commercial Account Management from strategic candidate toward shared core capability;
- add Service Need / demand intelligence as a record distinct from executable work;
- add a shared service taxonomy/catalog connecting demand, provider capability, qualification, pricing, work, and reporting;
- generalize work assignment around a fulfillment party rather than assuming an internal technician;
- add Provider Network Management as a core BHIS domain;
- add modular qualification layers for market, customer, property, and work-order eligibility;
- add provider geography, capacity, availability, declared versus observed capability, restrictions, acceptance behavior, and performance intelligence;
- add BHIS managed-service financial direction covering customer revenue, provider cost, margin, exception/rework cost, and reconciliation without setting financial policy;
- add territory and network-density intelligence;
- add service-program direction for recurring agreement-backed work;
- expand exception management to include ownership, due times, escalation, and structured reason codes;
- preserve MIL, evidence, inspection, communications, reporting, scheduling, field execution, audit, AI authority, and founder-by-exception principles as shared foundations.

## Qualification principle

Provider eligibility should use modular qualification layers such as Core BHIS, Multifamily, ALF/Senior Living, Group Home, Government/Institutional, customer-specific, property-specific, and work-order-specific requirements.

Qualification should collect objective facts and supporting evidence where practical rather than relying on subjective provider attestations.

## Matching principle

Initial provider matching should use deterministic mandatory eligibility filters followed by ranked recommendations and human selection/override. Machine-assisted ranking may be introduced only after sufficient real-world data, evaluation evidence, and separate authority exist.

## Customer-experience principle

BHIS owns the managed customer experience. The customer should not have to determine which provider to call, whether the provider is qualified, whether the provider responded, or who owns resolution when service fails.

Customer-preferred and customer-mandated vendors may be coordinated alongside BHIS network providers so BHIS can fill gaps without requiring customers to replace every existing vendor relationship.

## Learning-network principle

Every completed work order should improve usable operational intelligence, including provider responsiveness, actual capability/geographic reach, capacity, pricing/cost history, property requirements, customer preferences, service duration, exception causes, recurring opportunities, and future matching quality.

## Phased direction

Phase 1 focuses on the minimum operating foundation for BHIS: customer/property hierarchy, relationship/visit capture, service needs, provider prospecting/onboarding, capability/geography, qualification/compliance, provider lifecycle, basic work orders, manual assignment, scheduling/status, provider offer/response event capture, completion evidence, basic exception visibility, and basic dashboards.

Phase 2 optimizes the network through availability/capacity, density, performance, SLAs, exception/escalation management, territories, provider acceptance, customer trust, recurring service programs, and stronger network economics.

Phase 3 introduces intelligent coordination through eligibility automation, ranking/match scoring, dispatch recommendations, forecasting, territory intelligence, provider recruiting recommendations, and recurring-service identification.

These phases are product-planning direction only and are not releases.

## Governance effect if ratified

Ratification should cause a controlled update to the Product Definition and Decision Register. It should not activate implementation.

The existing prohibition on shared multi-tenant SaaS, franchise management, tenant switching, per-tenant configuration/billing, and cross-company administration remains in force unless separately superseded.

Requirements, architecture, implementation slices, migrations, deployments, provider/customer production onboarding, AI matching, autonomous dispatch, and financial policy remain separately gated.

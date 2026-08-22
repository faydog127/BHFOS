# BHFOS V2 — BHIS Product-Direction Reconciliation

| Field | Value |
| --- | --- |
| Status | Draft — founder review required |
| Date | 2026-08-22 |
| Owner | Founder |
| Scope | Product-direction reconciliation only |
| Implementation authority | None |

## 1. Purpose

This document reconciles the active BHFOS V2 Product Definition with the operating requirements for Black Horse Integrated Services (BHIS), whose public-facing business is blackhorseintegrated.com.

It does not authorize requirements, architecture, migrations, application code, releases, deployment, production changes, financial-policy changes, provider onboarding, customer onboarding, or automation activation.

## 2. Existing authority that remains valid

The following V2 directions remain materially aligned and should be preserved:

- BHFOS is an operating system rather than a collection of disconnected modules.
- Authoritative records, controlled handoffs, visible exceptions, recoverable failures, field usability, trustworthy reporting, and validated controls remain required.
- Customer, contact, property, and multi-property account management remain core.
- Scheduling, dispatch, capacity visibility, field execution, inspection, evidence, MIL, reporting, communication, financial operations, retention, and management visibility remain core.
- Founder-by-exception and controlled AI/automation authority remain binding principles.
- BHFOS remains the authoritative system of record; external orchestration, AI, communications, and integration systems may not silently become operational authority.
- Shared multi-tenant SaaS, franchise management, tenant switching, tenant billing, and cross-customer tenant administration remain outside the current program unless separately authorized.

## 3. Material conflict requiring amendment

The active Product Definition and DEC-V2-001/DEC-V2-012 define V2 as a dedicated single-company operating system for The Vent Guys (TVG).

BHIS introduces a second first-party Black Horse operating model:

1. TVG Direct Services — direct customer relationship with work fulfilled primarily by internal TVG personnel/crews.
2. BHIS Managed Services — BHIS owns and manages the customer service relationship while coordinating work through qualified internal, BHIS-network, customer-preferred, or customer-mandated fulfillment parties.

This is a product-scope change and cannot be introduced solely through lower-level requirements.

The amendment must not be interpreted as authorization for generic multi-tenancy, shared SaaS, franchise administration, or arbitrary external operating-company onboarding.

## 4. Reconciled product direction

BHFOS V2 should become the operating platform for approved Black Horse service-delivery operations, beginning with TVG Direct Services and BHIS Managed Services.

The shared core should support customer relationships, properties/facilities, service demand, work coordination, evidence, communications, financial controls, reporting, authoritative records, audit, and controlled automation.

Operating-model-specific capabilities may extend that core without duplicating the authoritative customer/property/work/evidence foundations.

## 5. BHIS operating model

BHIS is a managed service-delivery organization, not a contractor directory, referral marketplace, or open bidding marketplace.

BHIS develops direct customer relationships, discovers or receives service needs, maintains qualified provider capacity, selects and coordinates fulfillment, remains accountable for service execution and customer communication, validates completion, records provider performance, and uses accumulated operating data to improve future coordination.

The customer should not be required to determine which provider to call, whether the provider is qualified, whether the provider responded, or who owns resolution when a service problem occurs.

## 6. Six BHIS operating dimensions

Significant BHIS capabilities should improve at least one of these dimensions:

1. Customer Capacity — how many customer/property relationships BHIS can support effectively.
2. Provider Density — whether sufficient qualified provider coverage exists by geography and service capability.
3. Service Coordination — whether BHIS can reliably take a legitimate need through successful completion.
4. Customer Trust — whether customers increasingly rely on BHIS through repeat use, retention, referrals, relationship expansion, and satisfactory outcomes.
5. Demand-to-Capacity Matching — whether BHFOS can identify and coordinate the best eligible fulfillment option for a need.
6. Network Economics — whether BHIS can deliver the preceding outcomes with sustainable revenue, margin, provider cost, coordination cost, exception cost, and rework economics.

Network Fulfillment Rate should be a primary long-term BHIS KPI: the percentage of legitimate customer service requests fulfilled using qualified capacity already known to the network. Mature core-market target: 95%+.

First-Match Fulfillment Rate should be tracked as a companion indicator of network quality.

## 7. Shared core domain direction

The BHFOS shared core should be capable of representing, without premature implementation commitments:

- organizations, ownership/management groups, portfolios/regions, properties/facilities, buildings/units/assets, and contacts;
- relationship ownership, visits, relationship status, follow-ups, preferences, history, satisfaction, and account-growth intelligence;
- service taxonomy/catalog;
- service needs and opportunities as records distinct from work orders;
- customer and provider agreements, pricing/authorization rules, SLAs, NTE/PO/documentation requirements, and service programs;
- work orders and lifecycle events;
- fulfillment parties, including internal crews, BHIS network providers, customer-preferred vendors, customer-mandated vendors, and unresolved/TBD fulfillment;
- communications and operational event history;
- evidence, completion validation, reports, invoices, provider costs, and reconciliation;
- territories, geography, and coverage;
- exceptions, ownership, deadlines, escalation, and structured reason codes;
- authoritative audit and controlled automation.

Detailed schemas and workflow states require later requirements and architecture authority.

## 8. Provider Network becomes a core BHIS domain

Providers must be modeled as operational capacity rather than simple contacts.

The provider domain should eventually support:

- identity and lifecycle;
- services and specialties;
- property/facility experience;
- crews, equipment, job-size constraints, and operational capacity;
- geography and actual service reach;
- qualifications, compliance, documents, expirations, and agreements;
- availability and temporary restrictions;
- customer/property preferences and exclusions;
- offers, acceptance/decline behavior, and response times;
- completion, rework, complaint, documentation, invoice, and communication performance;
- pricing/cost history;
- provider-visible versus BHIS-internal information.

Provider intelligence should distinguish declared capability from observed capability so completed work can improve future matching.

## 9. Qualification-layer principle

Provider eligibility should be determined through modular qualification layers rather than hard-coded market-specific onboarding.

Potential layers include:

- Core BHIS Approved;
- Multifamily Approved;
- ALF / Senior Living Approved;
- Group Home Approved;
- Government / Institutional Approved;
- customer-specific qualification;
- property-specific qualification; and
- work-order-specific qualification.

A provider may qualify for one layer without qualifying for another. Eligibility should be based on factual data and documentation rather than provider opinion where objective facts can be collected.

## 10. Fulfillment-party principle

Work execution should not be architecturally limited to an internal technician.

A work order should be capable of identifying a fulfillment party, which may resolve to an internal operating crew, BHIS network provider, customer-preferred vendor, customer-mandated vendor, or other explicitly authorized fulfillment source.

This abstraction should allow TVG to remain a direct-service operator while also being eligible, where appropriate, to fulfill BHIS-managed work without creating a separate work-order system.

## 11. Service Need principle

A customer need is not automatically a work order.

BHFOS should distinguish relationship intelligence and service demand from executable work. A Service Need / Opportunity record should allow BHIS to capture unmet or future demand, aggregate that demand by geography/service/customer type, and compare it with known provider capacity.

This demand intelligence should eventually inform provider recruiting and territory development.

## 12. Matching principle

Initial matching should be deterministic and human-controlled:

1. Mandatory eligibility filtering.
2. Ranking of eligible providers.
3. Human selection/override.

Mandatory criteria may include service capability, geography, provider status, qualification/compliance, facility requirements, and explicit restrictions.

Ranking may later incorporate availability, distance, capacity, prior performance, acceptance/completion behavior, customer/property history, pricing, emergency capability, and similar-scope experience.

Machine-assisted ranking should follow sufficient real-world data and evaluation evidence. Human override remains required unless separately authorized.

## 13. Customer relationship and trust direction

Commercial Account Management should move from a strategic candidate toward a shared core relationship/account capability because BHIS requires durable management of organizations, portfolios, properties, contacts, visits, needs, recurring service, customer preferences, existing vendors, issues, account growth, and relationship history.

BHIS customer trust should be measurable through repeat bookings, retention, services per customer, referrals, regional introductions, satisfaction, complaint frequency, relationship expansion, and similar indicators.

Portfolio-level customer reporting should eventually demonstrate BHIS responsiveness, completion performance, SLA performance, open issues, service breadth, and managed value.

## 14. Recurring-service direction

Recurring work should be capable of being represented as a service program or agreement-backed plan that generates planned occurrences/work orders while retaining parent customer/property/program context.

A simple recurring flag on individual work orders should not be the only long-term model.

## 15. Provider acquisition direction

Event acquisition such as HUGE should use a general Provider Prospect Capture capability with source attribution rather than event-specific architecture.

Providers may enter the lifecycle as lightweight prospects and progress through qualification as demand warrants.

## 16. Exception and accountability direction

BHIS operations should be managed by exception rather than requiring coordinators to inspect every work order manually.

Exceptions should identify the condition, responsible owner, due time/SLA, escalation path, resolution, and structured reason where applicable.

Basic exception visibility and provider offer/response event capture should be treated as early operational needs because they generate the data required for later performance and matching intelligence.

## 17. Financial direction

BHIS introduces a managed-service financial model that may include separate customer revenue and provider cost on the same service-delivery chain.

Future requirements must account for customer pricing, provider cost, quotes, markups/service fees where approved, NTE limits, change authorization, customer invoicing, provider invoicing/payment state, margin, exception cost, rework cost, and reconciliation.

This amendment does not set pricing policy, markup policy, payment policy, accounting treatment, or financial authority.

## 18. External experiences

Architecture may anticipate future customer and provider self-service experiences, but Phase 1 adoption must not depend on every customer or provider learning a full portal.

BHIS staff-operated workflows and low-friction communication/action links may be used where separately authorized.

## 19. Future customer types

Multifamily is the initial BHIS market. The shared provider/qualification architecture should avoid hard-coding multifamily-specific assumptions that would require rebuilding the core for ALF/senior living, group homes, commercial/institutional, or government work.

Market-specific requirements should be modular qualification, access, documentation, safety, credential, and workflow extensions.

## 20. System-of-record principle

BHFOS must remain authoritative for customer/property relationships, service needs, work orders, assignments, provider eligibility and status, acceptance/decline events, schedules, completion state, exceptions, financial operational state, performance events, and human decisions where those capabilities are implemented.

Email, SMS, portals, n8n, AI systems, provider systems, and external integrations may initiate, deliver, or coordinate authorized actions but may not silently replace BHFOS as the system of record.

## 21. Capability disposition summary

| Existing / proposed area | Reconciled direction |
| --- | --- |
| Customer/contact/property/account management | Preserve and expand |
| Commercial Account Manager | Promote concept toward shared core relationship/account capability |
| Scheduling/dispatch/capacity | Preserve; generalize beyond internal technician assignment |
| Field execution/inspection/evidence/MIL | Preserve and reuse as fulfillment foundation |
| Work orders | Preserve; expand for managed-service lifecycle and fulfillment party |
| Management visibility | Preserve; add BHIS six-dimension scorecards |
| Exception control | Preserve and expand materially |
| Financial operations | Preserve; expand for customer/provider two-sided economics |
| Provider Network | New core BHIS domain |
| Provider qualification/compliance | New core BHIS domain |
| Provider capacity/density | New core BHIS domain |
| Provider matching/acceptance/performance | New core BHIS domain, phased |
| Service Need / demand intelligence | New shared core capability |
| Territory intelligence | New BHIS capability, phased |
| Coach's Corner | Remains deferred unless separately authorized |
| Shared multi-tenant SaaS / franchise management | Remains out of scope |

## 22. Phased product direction

### Phase 1 — Initial BHIS Operations

Product direction prioritizes customer/property hierarchy, relationship management, mobile visit capture, service needs/opportunities, provider prospecting/onboarding, service/geographic capability, qualification/compliance, provider lifecycle, basic work orders, manual provider assignment, scheduling/status, provider offer/response event capture, completion evidence, basic exception visibility, and basic operational dashboards.

### Phase 2 — Network Optimization

Product direction includes provider availability/capacity, density reporting, performance scoring, SLA tracking, richer exception/escalation management, territory management, provider acceptance workflow, customer trust metrics, repeat-service identification, service programs, and stronger network economics.

### Phase 3 — Intelligent Coordination

Product direction includes automated eligibility filtering, provider ranking/match scoring, dispatch recommendations, capacity/demand forecasting, territory opportunity intelligence, provider recruiting recommendations, and recurring-service identification.

These phases are planning direction only. They are not releases and do not authorize implementation.

## 23. Decision impact

A founder-approved amendment should:

- supersede or amend DEC-V2-001 so TVG-first no longer prohibits BHIS as an approved first-party operating model;
- amend DEC-V2-012 only to the extent necessary to replace the TVG-only operating-context language while preserving the prohibition on shared multi-tenant SaaS and tenant-oriented scope;
- preserve DEC-V2-002 through DEC-V2-011, DEC-V2-013, and DEC-V2-014 except for terminology references that must reflect the expanded approved operating context;
- revise V2_PRODUCT_DEFINITION.md from TVG-only product direction to the approved Black Horse operating-platform direction;
- promote Commercial Account Management toward core shared capability;
- add BHIS Managed Services and Provider Network as core product domains;
- leave implementation authority at None.

## 24. Required next controlled artifacts after ratification

If the founder ratifies this direction, subsequent controlled work should:

1. revise and activate the Product Definition under the approved decision;
2. reconcile the Workflow Map for TVG Direct Services and BHIS Managed Services;
3. populate the Capability Disposition Matrix with evidence-backed dispositions;
4. derive Phase 1 BHIS requirements into the Requirements Register;
5. define architecture only after approved requirements identify the required data and workflows;
6. activate an implementation release only after the Definition of Ready is satisfied.

## 25. Explicit non-authorizations

This reconciliation does not authorize:

- application code;
- database schema or migrations;
- provider or customer production onboarding;
- production data changes;
- deployments;
- n8n activation;
- AI provider matching;
- autonomous dispatch;
- pricing or markup policy;
- payment or accounting policy;
- a customer or provider portal;
- multi-tenant SaaS;
- franchise management; or
- an implementation release.

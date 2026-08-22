# BHFOS Network OS — Decision Register

| Field | Value |
| --- | --- |
| Status | Active register — Slice 1-applicable decisions ratified 2026-08-22; remaining decisions Proposed |
| Version | 0.3 |
| Date | 2026-08-22 |
| Owner | Founder |
| Implementation authority | None |
| Ratification evidence | `NETWORK_OS_RELEASE1_SLICE1_FOUNDER_RATIFICATION_PACKET.md`; `NETWORK_OS_FIELD_VISIT_CLOSEOUT_FOUNDER_DIRECTION.md` |

## Decision control

Network OS decisions become binding only after explicit founder approval and controlled activation. Draft/proposed decisions do not authorize implementation. Active product or architecture direction also does not authorize implementation unless an applicable release is separately activated.

## DEC-NOS-001 — Network OS product identity

| Field | Value |
| --- | --- |
| Status | Active — founder ratified 2026-08-22 |
| Decision owner | Founder |

Network OS is the BHFOS product for managed service networks. Black Horse Integrated Services (BHIS) is the initial operating company. Multifamily is the initial customer market.

Network OS is not a contractor directory, referral marketplace, lead marketplace, or open bidding marketplace.

## DEC-NOS-002 — BHFOS is a two-product family

| Field | Value |
| --- | --- |
| Status | Active — founder ratified 2026-08-22 |
| Decision owner | Founder |

BHFOS consists of two independent product lines:

- Partner OS for Service Partners and their internal service-company operations.
- Network OS for managed service networks.

Legacy V1/V2 terminology is historical and should not be used as the product identity going forward.

## DEC-NOS-003 — Independent products, integrated end state

| Field | Value |
| --- | --- |
| Status | Active — founder ratified 2026-08-22 |
| Decision owner | Founder |

Partner OS and Network OS must each remain independently operable. Their stated end state is controlled interoperability through explicit contracts/events.

Network OS remains authoritative for managed customer/network coordination records. Partner OS remains authoritative for the Service Partner's internal business operations.

## DEC-NOS-004 — Service Partner terminology

| Field | Value |
| --- | --- |
| Status | Active — founder ratified 2026-08-22 |
| Decision owner | Founder |

The standard product term for a service company that fulfills work through the managed network is **Service Partner**. The collective qualified fulfillment network is the **Service Partner Network**.

Legacy `provider` terminology may remain in historical artifacts and code until deliberately migrated.

## DEC-NOS-005 — BHIS owns the managed customer experience

| Field | Value |
| --- | --- |
| Status | Active — founder ratified 2026-08-22 |
| Decision owner | Founder |

BHIS remains the central point of accountability for managed service. The customer should not have to select the Service Partner, verify qualification, chase responses, or determine who owns resolution when service fails.

## DEC-NOS-006 — Six operating dimensions

| Field | Value |
| --- | --- |
| Status | Active — founder ratified 2026-08-22 |
| Decision owner | Founder |

Network OS product development should primarily improve Customer Capacity, Service Partner Density, Service Coordination, Customer Trust, Demand-to-Capacity Matching, or Network Economics.

Network Fulfillment Rate is a primary long-term KPI, with a 95%+ target in mature core markets. First-Match Fulfillment Rate is a companion network-quality metric.

## DEC-NOS-007 — Service Need is distinct from work order

| Field | Value |
| --- | --- |
| Status | Active — founder ratified 2026-08-22 |
| Decision owner | Founder |

Network OS should represent identified customer demand before executable work exists through a Service Need / Opportunity concept distinct from a work order.

## DEC-NOS-008 — Service Partners are operational capacity

| Field | Value |
| --- | --- |
| Status | Proposed |
| Decision owner | Founder |

Service Partners are not merely contacts. Network OS should eventually understand their capability, geography, qualification, availability, capacity, restrictions, observed behavior, performance, and economics.

## DEC-NOS-009 — Qualification layers

| Field | Value |
| --- | --- |
| Status | Proposed |
| Decision owner | Founder |

Service Partner eligibility should use modular qualification layers for market, customer, property/facility, and work-order requirements. Objective facts and supporting evidence should be preferred over subjective attestations.

## DEC-NOS-010 — Human-controlled matching first

| Field | Value |
| --- | --- |
| Status | Proposed |
| Decision owner | Founder |

Initial Service Partner matching should use deterministic mandatory eligibility filters, ranking where useful, and human selection/override. Machine-assisted ranking requires sufficient real-world data, evaluation evidence, and separate authority.

## DEC-NOS-011 — Existing customer vendors may remain

| Field | Value |
| --- | --- |
| Status | Proposed |
| Decision owner | Founder |

Network OS should be capable of coordinating customer-preferred and customer-mandated Service Partners alongside BHIS network Service Partners. BHIS does not require customers to replace every existing vendor relationship.

## DEC-NOS-012 — Network OS is the authoritative managed-network system of record

| Field | Value |
| --- | --- |
| Status | Active — founder ratified 2026-08-22 |
| Decision owner | Founder |

Network OS owns authoritative managed-network state for implemented domains. Email, SMS, portals, Partner OS, n8n, AI systems, and external integrations may deliver or execute authorized actions but may not silently replace Network OS authoritative state.

## DEC-NOS-013 — Partner OS adoption is optional initially

| Field | Value |
| --- | --- |
| Status | Proposed |
| Decision owner | Founder |

A Service Partner does not initially need Partner OS to participate in Network OS. Architecture should preserve the future business option for Partner OS to become preferred or required when network maturity, Service Partner value, adoption economics, competitive conditions, and explicit policy justify it.

## DEC-NOS-014 — Generic multi-tenant SaaS remains out of scope

| Field | Value |
| --- | --- |
| Status | Active — founder ratified 2026-08-22 |
| Decision owner | Founder |

Network OS is initially a dedicated BHIS operating system. Generic multi-tenant SaaS, franchise administration, arbitrary external operating-company onboarding, tenant switching, and per-tenant billing/configuration are not authorized without a new founder decision.

## DEC-NOS-015 — AI-native, exception-driven operation with controlled authority

| Field | Value |
| --- | --- |
| Status | Active — founder ratified 2026-08-22 |
| Decision owner | Founder |

Network OS should be automation-first and AI-assisted, with routine coordination reduced where deterministic controls and evidence permit. AI may assist or recommend but may not silently grant qualification, make final business decisions, change financial policy, authorize unusual customer commitments, or bypass human accountability.

## DEC-NOS-016 — Phase 1 establishes the minimum BHIS operating loop

| Field | Value |
| --- | --- |
| Status | Active — founder ratified 2026-08-22 |
| Decision owner | Founder |

Phase 1 product direction prioritizes customer/property hierarchy, relationship/visit capture, Service Needs, Service Partner prospecting/onboarding, capability/geography, qualification/compliance, Service Partner lifecycle, basic work orders, manual assignment, scheduling/status, offer/response event capture, completion evidence, basic exception visibility, and basic dashboards.

This decision does not authorize an implementation release.

## DEC-NOS-017 — Field activity closes with the next action in motion

| Field | Value |
| --- | --- |
| Status | Active — founder directed 2026-08-22 |
| Decision owner | Founder |

A boots-on-the-ground property visit is not complete when notes are merely
saved. The ordinary closeout must capture the outcome and cause an authorized
follow-up, promised action, or explicit no-follow-up disposition to be recorded
before the representative leaves the property.

The full closeout target is 2–3 minutes. Network OS must carry the next action,
update the authoritative account/property context, and resurface the account
when follow-up becomes due. No separate end-of-day CRM cleanup should be needed
for the ordinary path.

## DEC-NOS-018 — TIS is reusable source material, not a Network OS dependency

| Field | Value |
| --- | --- |
| Status | Active — founder directed 2026-08-22 |
| Decision owner | Founder |

Network OS may copy or adapt useful TIS field-prospecting patterns, including
property lookup, nearby-target discovery, routing, quick capture, contacts, and
visit history. The final BHIS field workflow must live natively inside Network
OS.

TIS is not a runtime dependency, system of record, required integration,
required product adoption, or authority for BHIS field-sales state. Reuse does
not authorize a TIS merge or implementation.

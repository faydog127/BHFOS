# BHFOS Network OS — Product Definition

| Field | Value |
| --- | --- |
| Status | Active — founder ratified 2026-08-22 |
| Version | 0.3 |
| Date | 2026-08-22 |
| Owner | Founder |
| Initial operating company | Black Horse Integrated Services (BHIS; blackhorseintegrated.com) |
| Implementation authority | None — product direction only |
| Ratification evidence | `NETWORK_OS_RELEASE1_SLICE1_FOUNDER_RATIFICATION_PACKET.md`; `NETWORK_OS_FIELD_VISIT_CLOSEOUT_FOUNDER_DIRECTION.md` |

## 1. Product identity

Network OS is the BHFOS product for managed service networks.

Its initial operating company is Black Horse Integrated Services (BHIS). Multifamily is the initial customer market. The product must remain independently operable from Partner OS while preserving controlled interoperability as the stated BHFOS product-family end state.

Network OS is not a contractor directory, referral marketplace, lead marketplace, or open bidding platform.

## 2. Product purpose

Network OS should enable BHIS to own and manage the customer service relationship from identified need through successful completion while coordinating qualified Service Partners and remaining accountable for responsiveness, execution, communication, exception resolution, and measurable customer value.

Network OS should answer, in real time:

- What do our customers need?
- Where do they need it?
- Which Service Partners can perform it?
- Which Service Partners are currently eligible and available?
- Which Service Partner is most likely to execute successfully?
- What work is currently at risk?
- Which customer relationships need attention?
- Where is Service Partner capacity insufficient?
- Which service categories should BHIS recruit next?
- How well is the Service Partner Network performing?
- Is the network operating profitably?

## 3. Product promise

Network OS should make customer demand visible, Service Partner capacity understandable, coordination reliable, exceptions hard to miss, outcomes easy to verify, customer relationships easier to deepen, and network performance measurable.

The customer should not have to determine which Service Partner to call, whether the Service Partner is qualified, whether the Service Partner responded, or who is responsible for resolving a failure. BHIS remains the central point of accountability.

## 4. Primary users

### BHIS management

Needs visibility into customer capacity, Service Partner density, service coordination, customer trust, matching efficiency, network economics, risks, exceptions, territory opportunity, and staffing/capacity needs.

### Relationship manager / territory manager

Needs fast access to assigned properties, contacts, visits, current needs, follow-ups, open opportunities, active work, customer issues, Service Partner coverage, and territory gaps.

### Service coordinator

Needs a controlled queue for service requests, Service Partner matching, offers, scheduling, active work, exceptions, escalations, customer communication, completion validation, and financial closeout.

### Service Partner

Needs low-friction access to authorized work offers, scope, location, timing, qualifications, instructions, acceptance/decline, clarification, scheduling, quotes where required, status updates, completion evidence, and invoice/cost submission where applicable.

A Service Partner does not initially need Partner OS in order to participate in Network OS.

### Customer contact

Needs a simple and dependable way to request service, understand status, approve work when needed, receive completion information, communicate with BHIS, and see measurable managed-service value.

## 5. Six operating dimensions

Every significant Network OS capability should improve at least one of these dimensions.

### 5.1 Customer Capacity

How many customer/property relationships can BHIS support effectively without service quality deteriorating?

### 5.2 Service Partner Density

Does BHIS have sufficient qualified Service Partner capacity by geography and service capability?

### 5.3 Service Coordination

Can BHIS reliably take a legitimate service need from request through successful completion?

### 5.4 Customer Trust

Are customers increasingly relying on BHIS through repeat use, retention, referrals, relationship expansion, and satisfactory outcomes?

### 5.5 Demand-to-Capacity Matching

Can Network OS identify and coordinate the best eligible Service Partner for a specific need?

### 5.6 Network Economics

Can BHIS deliver the preceding outcomes with sustainable revenue, margin, Service Partner cost, coordination cost, exception cost, and rework economics?

## 6. Primary network KPIs

### Network Fulfillment Rate

Percentage of legitimate customer service requests fulfilled using qualified capacity already known to the Service Partner Network.

Long-term target in mature core markets: **95%+**.

This metric should eventually be measurable by geography, service category, territory, customer type, and customer.

### First-Match Fulfillment Rate

Percentage of requests successfully accepted by the first recommended Service Partner.

This is a companion network-quality indicator and should be interpreted alongside time-to-match and average Service Partners contacted per successful assignment.

## 7. Core operating cycle

Customer relationship

→ BHIS discovers or receives a Service Need

→ Service Need is captured in Network OS

→ required service, geography, urgency, qualifications, timing, customer constraints, property constraints, and commercial rules are determined

→ eligible Service Partner capacity is identified

→ Service Partners are ranked or manually evaluated

→ work is offered and accepted

→ service is scheduled

→ work is performed

→ completion evidence is submitted

→ BHIS validates completion

→ customer is informed and confirms where required

→ customer and Service Partner financial state is recorded

→ Service Partner performance is updated

→ customer relationship intelligence is updated

→ future matching and network planning become more accurate

## 8. Customer and property hierarchy

Network OS should support a flexible hierarchy such as:

Management Company / Ownership Group

→ Region / Portfolio

→ Property / Facility

→ Building / Unit / Asset where applicable

→ Contacts

The architecture should support multifamily initially and avoid hard-coded assumptions that prevent later extension to assisted living/senior living, group homes, commercial/institutional customers, government customers, or other approved managed-service markets.

## 9. Relationship intelligence

Network OS should capture relationship information, not merely contact information.

The relationship model should eventually support:

- decision makers;
- property managers;
- maintenance supervisors/directors;
- regional managers;
- ownership/management affiliations;
- BHIS relationship owner;
- preferred communication method;
- last contact;
- next planned contact;
- relationship status;
- property-visit history;
- known vendor problems;
- current service needs;
- future service opportunities;
- customer preferences;
- existing vendor relationships;
- voluntarily supplied budget/approval requirements;
- customer satisfaction history;
- referral source;
- relationship expansion across services/properties.

Relationship statuses may include Prospect, Contacted, Relationship Developing, Active Customer, Strategic Account, Dormant, and Lost.

## 10. Field visit capture

Relationship and territory personnel should be able to record a basic property visit from a mobile device in approximately one minute.

The product direction should support fast capture of property, person contacted, date/time, visit outcome, needs identified, notes, follow-up requirement/date, photos, new contacts, and service opportunities.

Field adoption takes priority over excessive data-entry requirements.

Basic capture is only a subset of field closeout. A property visit is not
complete until the next action is already in motion. The ordinary full closeout
must fit the 2–3 minute rule and include the contact, outcome, pain points/service
needs, short voice-friendly notes, promised actions, and next-touch/return date.

Network OS should then send an approved follow-up or queue it for one-tap
approval, establish the next follow-up, update property/account history and
applicable opportunity/relationship state, and resurface the account when due.
No separate end-of-day CRM cleanup should be required for the ordinary path.

TIS may supply reusable field-prospecting patterns, but the authoritative field
workflow must be native to Network OS and must not depend on TIS at runtime.

## 11. Service Need and demand intelligence

A customer need is not automatically a work order.

Network OS should maintain a distinct Service Need / Opportunity record so BHIS can capture demand before executable work exists.

The Service Need model should eventually support customer, property, contact, service category, description, urgency, timing, recurring/one-time, current vendor situation, reason the current solution is inadequate, estimated scope, documents/media, voluntarily provided budget information, decision authority, status, relationship owner, and recommended next action.

Potential statuses include Identified, Qualifying, Service Partner Capacity Needed, Quote Requested, Quote Submitted, Approved, Scheduled, Completed, Deferred, Lost, and Recurring Opportunity.

Demand intelligence should be reportable by service, geography, customer type, customer, property, and territory so BHIS can identify market gaps and recruiting priorities.

## 12. Service taxonomy

Network OS should use a governed Service Catalog / Service Taxonomy as the common language connecting:

- customer demand;
- Service Partner capabilities;
- qualification requirements;
- pricing/commercial rules;
- work orders;
- reporting;
- matching;
- recruiting intelligence.

Broad categories such as Plumbing may contain more specific services such as emergency leak, water heater, drain clearing, fixture replacement, and repiping where operationally necessary.

## 13. Service Partner Network

Service Partners must be modeled as operational capacity rather than simple contact records.

The Service Partner domain should eventually support:

### Identity

Legal business name, DBA, contacts, phone, email, website, address, years in business, agreements, and tax/payment records where authorized.

### Service capability

Service categories, specialties, property/facility experience, emergency capability, after-hours availability, equipment capabilities, lift capability, crew size, active crews, typical job capacity, minimum job size, maximum practical job size, and similar operational facts.

### Geographic capability

Coverage by ZIP code, city, county, radius, region, and actual observed service reach.

### Qualification

Insurance, licenses, certifications, W-9, agreements, references, background requirements, compliance status, and expiration dates.

### Capacity and availability

Crew count, typical weekly capacity, workload, earliest availability, emergency availability, geographic constraints, seasonal constraints, temporary restrictions, and current availability state.

### Performance

Offer response, acceptance, schedule reliability, on-time arrival, completion, first-time completion, callback/rework, customer complaints, documentation quality, invoice accuracy, communication, compliance history, and other approved measures.

### Information visibility

Network OS must distinguish Service Partner-visible information from BHIS-internal scoring, risk notes, relationship notes, and management assessments.

## 14. Service Partner lifecycle

The Service Partner pipeline should support lightweight acquisition before full qualification.

Potential lifecycle:

Prospect

→ Contacted

→ Interested

→ Application Started

→ Application Submitted

→ Documentation Review

→ Approved

→ Active

→ Preferred

→ Restricted / Suspended

→ Inactive

Event-acquired Service Partners, including conference leads, should be captured quickly and progressively qualified as demand develops.

## 15. Service Partner acquisition

Network OS should support general Service Partner Prospect Capture with source attribution rather than event-specific architecture.

Sources may include industry events, referrals, customer introductions, outbound recruiting, website applications, associations, and other approved channels.

Event reporting should eventually show Service Partner leads, represented services, geography, applications started/submitted, approvals, and remaining critical coverage gaps.

## 16. Qualification layers

Service Partner eligibility should use modular qualification layers rather than hard-coded market-specific onboarding.

Potential layers include:

- Core BHIS Approved;
- Multifamily Approved;
- ALF / Senior Living Approved;
- Group Home Approved;
- Government / Institutional Approved;
- customer-specific qualification;
- property-specific qualification;
- work-order-specific qualification.

A Service Partner may qualify for one layer without qualifying for another.

Where possible, Network OS should collect objective facts and documentation rather than subjective attestations.

## 17. Customer-preferred and mandated Service Partners

BHIS does not need to replace every vendor already used by a customer.

Network OS should eventually distinguish:

- BHIS network Service Partners;
- customer-preferred existing Service Partners;
- customer-mandated Service Partners;
- preferred Service Partners for a specific customer/property;
- restricted or do-not-dispatch Service Partners.

This enables BHIS to coordinate existing vendor relationships while filling gaps through the Service Partner Network.

## 18. Work orders and managed-service lifecycle

Every executable customer service request should become a trackable work record.

The long-term lifecycle may include:

Request Received

→ Needs Review

→ Service Partner Matching

→ Offered

→ Accepted

→ Scheduled

→ En Route

→ On Site

→ Work in Progress

→ Completion Submitted

→ BHIS Review

→ Customer Confirmation

→ Completed

→ Invoiced

→ Closed

Additional states/exceptions may include Cancelled, Rescheduled, Customer Hold, Service Partner Declined, Scope Change, Additional Approval Required, Parts Required, Unable to Access, Rework Required, and Dispute.

Detailed state-machine architecture requires later approved requirements.

## 19. Service Partner offer and acceptance

Network OS should support offering authorized work to Service Partners.

The Service Partner should receive the information necessary to evaluate the work, including property/general location, scope, required completion window, access instructions, photos, pricing or quote requirements, special qualifications, and requested response time.

The Service Partner should eventually be able to Accept, Decline, Request Clarification, Propose Alternate Date/Time, and Submit Quote where required.

Network OS should retain offer time, open time where measurable and lawful, response time, decision, and structured reason codes.

## 20. Matching

Initial matching should be deterministic and human-controlled.

### Mandatory eligibility filters

Potential criteria include required service, service geography, active Service Partner status, compliance, required licenses/certifications, insurance, property/facility qualification, customer restrictions, and explicit exclusions.

### Ranking criteria

Eligible Service Partners may later be ranked using availability, distance, performance, acceptance rate, completion rate, customer feedback, callback/rework rate, price competitiveness, relationship history with property/customer, crew capacity, emergency capability, and prior similar-scope experience.

### Human authority

BHIS personnel retain the ability to override recommendations. Overrides should eventually become usable operational intelligence.

Machine-assisted ranking may be introduced only after sufficient real-world data, evaluation evidence, and separate authority exist.

## 21. Declared versus observed capability

Network OS should distinguish what a Service Partner states from what completed work demonstrates.

Examples include geographic reach, service capability, response time, emergency availability, crew capacity, practical job size, and willingness to accept work in certain markets.

Observed behavior should eventually improve future matching and recruiting intelligence.

## 22. Scheduling and status tracking

Network OS should support coordinated scheduling and status visibility without assuming Network OS is the Service Partner's internal workforce-management system.

A Service Partner using Partner OS may eventually synchronize authorized schedule/status events through controlled integration. A Service Partner not using Partner OS must still have a low-friction way to participate.

## 23. Completion documentation and evidence

Work completion should generate structured evidence appropriate to the service, customer, property, and qualification requirements.

Network OS should support completion photos/documents, checklist evidence, findings, scope changes, customer-facing reporting, and BHIS review before final closeout where required.

MIL and other reusable evidence infrastructure may be adapted from the existing BHFOS foundation where it fits the Network OS operating model.

## 24. Exception management

Network OS should manage by exception rather than requiring coordinators to manually inspect every active job.

Potential exceptions include:

- Service Partner has not responded;
- job not scheduled;
- Service Partner late/no-show;
- customer unavailable;
- service overdue;
- authorized scope exceeded;
- Service Partner documentation expired;
- completion evidence missing;
- customer complaint;
- callback/rework required;
- invoice discrepancy;
- SLA threatened;
- matching failure;
- access issue;
- pricing/approval issue.

An exception should eventually identify the condition, responsible owner, due time, escalation path, resolution, and structured reason code where applicable.

Basic exception visibility belongs early in Network OS because it is central to managed-service accountability.

## 25. Service-level measurement

Network OS should eventually measure:

### Customer response

Time to acknowledgment, assignment, and scheduled appointment.

### Service Partner execution

Acceptance rate, response time, on-time arrival, first-time completion, completion within SLA, callback rate, and rework rate.

### Operational completion

Service cycle time, completion-documentation time, invoice cycle time, and exception frequency.

Metrics should be available system-wide and by Service Partner, service category, territory, customer, property, and coordinator where appropriate.

## 26. Service Partner performance profile

Network OS should build an internal performance profile for every Service Partner.

Potential inputs include acceptance rate, response speed, schedule reliability, on-time arrival, completion percentage, first-time completion, callback/rework, customer complaints, satisfaction, documentation quality, invoice accuracy, communication, and compliance history.

Internal risk assessments and management notes must not automatically be visible to Service Partners.

## 27. Customer trust and relationship depth

Network OS should measure customer reliance on BHIS through indicators such as repeat bookings, active properties, jobs per property, service categories used, request frequency, retention, referrals, regional introductions, complaint frequency, satisfaction, and percentage of work authorized without competitive rebid where applicable.

**Services per customer** is a key relationship-expansion metric.

The product should make visible when a customer expands from one service into multiple service categories or properties.

## 28. Customer and staff capacity

Network OS should help management understand how many customer relationships and active service workflows BHIS personnel can effectively support.

Potential relationship-manager indicators include assigned properties, active opportunities, recent visits, follow-ups due, customer issues, revenue, and work-order volume.

Potential coordinator indicators include active work orders, jobs awaiting Service Partner, scheduled jobs, exception cases, customer escalations, and Service Partner escalations.

The long-term objective is to identify the workload point at which responsiveness or customer service begins to deteriorate.

## 29. Territory management

Properties and Service Partners should eventually be assignable to geographic territories.

A territory view should support prospective/current properties, contacts, last visit, next follow-up, open needs, active work, Service Partners, coverage gaps, and upcoming opportunities.

Map-based visualization may be introduced later.

## 30. Service Partner density and coverage

Network OS should make Service Partner density visible by service and geography.

Management should eventually be able to answer questions such as:

- How many approved plumbing Service Partners serve Orange County?
- How many turn crews serve Brevard County?
- Which service categories have only one qualified Service Partner?
- Where do we lack coverage?
- Where is BHIS overly dependent on a single Service Partner?

Initial density thresholds may be:

- Red: 0–1 qualified Service Partners;
- Yellow: 2;
- Green: 3+;
- Strong: 5+.

Thresholds should eventually be configurable.

## 31. Commercial agreements and rules

Network OS should eventually represent the commercial/operational rules governing customer and Service Partner relationships.

Customer-side rules may include MSA/property agreements, approved service categories, pricing schedules, NTE authorization, PO requirements, emergency limits, invoice requirements, payment terms, documentation requirements, SLA, and customer-specific Service Partner requirements.

Service Partner-side rules may include agreements, approved work types, pricing/cost rules, insurance/compliance obligations, payment terms, documentation expectations, and other authorized commercial controls.

A work order should eventually be able to determine which rules govern that job.

## 32. Network economics

Managed-service work may include separate customer revenue and Service Partner cost.

Future requirements should account for customer pricing, Service Partner cost, approved quotes, markups/service fees where separately authorized, NTE limits, change authorization, customer invoicing, Service Partner invoicing/payment state, gross contribution/margin, exception cost, rework cost, and reconciliation.

This Product Definition does not establish markup, payment, accounting, or financial authority policies.

## 33. Recurring service programs

Recurring work should eventually be represented as an agreement-backed Service Program or similar parent object that can generate planned occurrences/work orders while retaining customer/property/program context.

A simple recurring flag on individual work orders should not be the only long-term model.

This is particularly important for portfolio-level recurring services across multiple properties or units.

## 34. Customer reporting

Network OS should eventually provide portfolio-level reporting that demonstrates managed-service value.

Potential reporting includes request volume, completion rate, SLA performance, response time, open work, callbacks, service categories used, properties served, exceptions, and network fulfillment.

Customer reporting should help BHIS demonstrate accountability and relationship value rather than simply list completed work.

## 35. Communications and accountability record

Operational communications and events should form a traceable chain of accountability.

Examples include request received, BHIS acknowledgment, Service Partner offer, decline/acceptance, customer notification, en route, completion submitted, BHIS review, customer confirmation, and financial closeout.

Email, SMS, Partner OS, portals, n8n, AI systems, and external integrations may deliver authorized actions but may not silently replace Network OS authoritative state.

## 36. Reason codes

Important outcomes should use structured reason codes where practical rather than status alone.

Examples include Service Partner decline, lost opportunity, cancellation, rework, matching failure, external search required, late job, customer complaint, access failure, and scope change.

Structured reasons are required for reliable network intelligence.

## 37. Product-family interoperability

Partner OS and Network OS are separate BHFOS products with independent operating models, roadmaps, and authoritative records.

The stated end state is controlled interoperability.

### Network OS to Partner OS

Authorized managed work may be delivered into a Service Partner's normal Partner OS workflow.

### Partner OS to Network OS

Authorized acceptance, schedule, status, evidence, completion, financial, and exception events may be returned to Network OS.

### Authority boundary

Network OS remains authoritative for the managed customer relationship, Service Need, Service Partner selection, network coordination, SLA, customer communication, network performance, and managed-service financial state.

Partner OS remains authoritative for the Service Partner's internal service-company operations.

Integration must use controlled contracts/events rather than direct cross-product database ownership.

## 38. Partner OS adoption option

The architecture should preserve the business option for Partner OS to become a preferred or required operating connection for Service Partners participating in Network OS when network maturity, Service Partner value, adoption economics, competitive conditions, and explicit business policy justify it.

Mandatory Partner OS adoption is not a current Network OS architectural dependency.

## 39. AI-native and exception-driven operation

Network OS should be automation-first and AI-assisted while preserving authoritative records, deterministic controls, permissions, audit, financial controls, consent, human accountability, and manual takeover.

AI may assist with extraction, classification, prioritization, matching recommendations, missing-information detection, risk identification, forecasting, and other separately authorized tasks.

AI must not silently make final business decisions, change financial policy, grant qualification, authorize unusual customer commitments, or bypass human/controlled authority.

## 40. System-of-record principle

Network OS must remain authoritative for implemented customer/property relationships, Service Needs, work orders, Service Partner eligibility/status, offers, acceptance/decline events, schedules, completion state, exceptions, performance events, managed-service financial state, and human decisions within its scope.

External systems are adapters, delivery mechanisms, evidence sources, or execution tools unless explicitly authorized otherwise.

## 41. Product boundaries

Network OS does not currently authorize:

- generic multi-tenant SaaS;
- franchise administration;
- arbitrary external operating-company onboarding;
- open provider marketplace/bidding behavior;
- mandatory Partner OS adoption;
- autonomous Service Partner dispatch;
- machine-learned ranking without sufficient data/evaluation;
- pricing or markup policy;
- payment/accounting policy;
- architecture or schema implementation;
- production customer/Service Partner onboarding;
- release activation;
- production deployment.

## 42. Phase 1 — Initial Network OS operations

The first product phase should prioritize the minimum usable BHIS operating loop:

1. customer/property hierarchy;
2. contact and relationship management;
3. mobile property-visit capture;
4. Service Need/opportunity capture;
5. Service Partner prospect database;
6. Service Partner onboarding;
7. service/geographic capability;
8. qualification/compliance status;
9. Service Partner lifecycle;
10. basic work-order management;
11. manual Service Partner assignment;
12. scheduling/status tracking;
13. Service Partner offer/response event capture;
14. completion documentation;
15. basic exception visibility;
16. basic operational dashboards.

Phase 1 is product direction only. It is not a release and does not authorize implementation.

## 43. Phase 2 — Network optimization

Phase 2 product direction includes:

- Service Partner availability and capacity;
- network-density reporting;
- Service Partner performance scoring;
- SLA tracking;
- richer exception/escalation management;
- territory management;
- Service Partner acceptance workflow;
- customer trust metrics;
- repeat-service identification;
- recurring Service Programs;
- customer portfolio reporting;
- stronger network economics.

## 44. Phase 3 — Intelligent coordination

Phase 3 product direction includes:

- automated Service Partner eligibility filtering;
- ranked recommendations and match scoring;
- automated dispatch recommendations;
- capacity forecasting;
- demand forecasting;
- territory opportunity intelligence;
- Service Partner recruiting recommendations;
- automated recurring-service identification.

## 45. Product test

For each future Network OS capability, ask whether it materially improves at least one of:

- Customer Capacity;
- Service Partner Density;
- Service Coordination;
- Customer Trust;
- Demand-to-Capacity Matching;
- Network Economics.

Capabilities that do not materially improve one of these dimensions should generally remain secondary until the core managed-network operating platform is mature.

## 46. End state

Network OS succeeds when BHIS can reliably understand customer demand, Service Partner eligibility and availability, work at risk, customer relationships needing attention, network coverage gaps, recruiting priorities, operational performance, and network economics in real time.

The broader BHFOS end state is an independently useful Partner OS and independently useful Network OS that can interoperate through controlled contracts so managed work flows efficiently from the network into Service Partner operations and verified execution data flows back to the network.

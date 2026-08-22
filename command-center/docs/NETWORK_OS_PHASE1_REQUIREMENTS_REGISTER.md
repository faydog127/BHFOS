# BHFOS Network OS — Phase 1 Requirements Register

| Field | Value |
| --- | --- |
| Status | Draft — founder ratification required |
| Version | 0.1 |
| Date | 2026-08-22 |
| Owner | Founder |
| Product | Network OS |
| Initial operating company | Black Horse Integrated Services (BHIS) |
| Implementation authority | None — requirements baseline only |

## 1. Purpose

Define the minimum usable Network OS operating loop for BHIS and establish traceable Phase 1 requirements before architecture, schema, migrations, application implementation, release activation, or production onboarding.

## 2. Authority rule

No requirement in this register is authorized for implementation until it has:

- an approved Requirement ID;
- applicable active Network OS Decision IDs;
- an active Release ID;
- accepted architecture where required;
- explicit acceptance criteria;
- applicable data/security controls;
- a completed Definition of Ready assessment; and
- founder authorization where required by governance.

This register does not authorize code, schema, migrations, deployment, production data changes, customer onboarding, Service Partner onboarding, autonomous matching, financial policy, or mandatory Partner OS adoption.

## 3. Phase 1 success condition

Phase 1 is successful when BHIS can operate this closed loop inside Network OS:

**Customer / Property → Relationship / Visit → Service Need → Service Partner eligibility → Manual assignment / offer → Acceptance → Schedule → Work status → Completion evidence → BHIS review → Exception resolution → Close → Basic operational reporting**

The system must also support rapid Service Partner prospect capture and progressive onboarding so BHIS can build network density while customer demand develops.

## 4. Common data handling baseline

Unless a requirement states otherwise:

| Control | Phase 1 baseline |
| --- | --- |
| Customer/contact data | Confidential; PII minimized and role-limited |
| Property/access information | Confidential; Restricted when it exposes resident/security/access details |
| Service Partner business data | Internal/Confidential; compliance documents may be Restricted |
| Financial data | Confidential; payment credentials/secrets Restricted |
| Photos/media | Confidential by default; Restricted when resident/customer-sensitive |
| Audit/event data | Internal; must avoid unnecessary sensitive payload duplication |
| Test fixtures | Synthetic or specifically authorized redacted data only |
| AI use | Minimum necessary content; no autonomous qualification, dispatch, financial-policy decision, or final business decision |

---

# Phase 1 Requirements

## REQ-NOS-P1-001 — Customer organization and property hierarchy

| Field | Value |
| --- | --- |
| Status | Proposed |
| Product area | Customer / Property Management |
| Source | Network OS Product Definition §§8–9; BHIS operating requirements |
| Applicable decisions | DEC-NOS-001, DEC-NOS-005, DEC-NOS-012, DEC-NOS-014 |
| Release | None |
| Implementation authority | None |

### Requirement statement

Network OS shall represent BHIS customer relationships using a hierarchy that can support Management Company / Ownership Group → Region / Portfolio → Property / Facility → optional Building / Unit / Asset → Contacts without requiring multifamily-specific hard-coding in the shared core.

### Acceptance criteria

- A user can create, view, edit, and relate organizations, portfolios/regions, properties/facilities, and contacts.
- A property belongs to the correct parent organization and may optionally belong to a portfolio/region.
- Contacts can be associated with one or more relevant customer/property contexts and assigned roles.
- The hierarchy supports multifamily now without preventing later facility types through modular attributes/extensions.
- Customer/property records are searchable and navigable from parent to child and child to parent.
- Legacy flat-customer assumptions are not required for the Phase 1 workflow.

### Dependencies / blockers

- Architecture must determine reuse versus replacement of legacy `organizations`, `accounts`, `contacts`, and customer structures.
- Data migration policy from any existing BHIS records must be separately approved.

---

## REQ-NOS-P1-002 — Relationship intelligence and ownership

| Field | Value |
| --- | --- |
| Status | Proposed |
| Product area | Relationship Management |
| Source | Product Definition §9 |
| Applicable decisions | DEC-NOS-005, DEC-NOS-012 |
| Release | None |
| Implementation authority | None |

### Requirement statement

Network OS shall allow BHIS to manage relationship state for customer organizations and properties, not merely store contact information.

### Acceptance criteria

- A customer/property relationship can have a BHIS owner.
- The system records relationship status, last contact, next planned contact, preferred communication method, and notes.
- Users can record known vendor problems, current/future opportunities, customer preferences, and existing vendor relationships.
- Relationship follow-ups due can be surfaced in an operational queue or dashboard.
- Relationship history is auditable and does not silently overwrite material historical events.

---

## REQ-NOS-P1-003 — Mobile property visit capture

| Field | Value |
| --- | --- |
| Status | Proposed |
| Product area | Field Relationship Management |
| Source | Product Definition §10 |
| Applicable decisions | DEC-NOS-005, DEC-NOS-012 |
| Release | None |
| Implementation authority | None |

### Requirement statement

Network OS shall provide a mobile-first property visit capture workflow designed so a basic visit can be recorded in approximately one minute.

### Acceptance criteria

- Required basic fields are limited to property, person contacted, date/time, visit outcome, and notes/outcome as appropriate.
- User can optionally capture needs identified, follow-up required/date, photos, new contact, and Service Need opportunity.
- A visit can create or link a follow-up without re-entering the customer/property context.
- A visit can create a Service Need without requiring a work order.
- The workflow is usable on a phone-sized viewport and does not require navigating the office CRM layout.

---

## REQ-NOS-P1-004 — Service Need / Opportunity record

| Field | Value |
| --- | --- |
| Status | Proposed |
| Product area | Demand Intelligence |
| Source | Product Definition §11; DEC-NOS-007 |
| Applicable decisions | DEC-NOS-006, DEC-NOS-007, DEC-NOS-012 |
| Release | None |
| Implementation authority | None |

### Requirement statement

Network OS shall maintain a Service Need / Opportunity record distinct from a work order so BHIS can capture customer demand before executable work exists.

### Acceptance criteria

- A Service Need can be created from a customer/property/contact context or property visit.
- It records service category, description, urgency, estimated timing, one-time/recurring indicator, current vendor situation, reason current solution is inadequate, estimated scope, attachments, decision authority where known, BHIS owner, status, and recommended next action.
- Status supports at minimum Identified, Qualifying, Service Partner Capacity Needed, Quote Requested, Quote Submitted, Approved, Scheduled, Completed, Deferred, Lost, and Recurring Opportunity, subject to later state-machine normalization.
- Service Needs are reportable by customer, property, geography, service category, status, and owner.
- A Service Need may exist without a work order and may later produce one or more executable work records when separately approved.

---

## REQ-NOS-P1-005 — Governed Service Catalog / Taxonomy

| Field | Value |
| --- | --- |
| Status | Proposed |
| Product area | Shared Service Taxonomy |
| Source | Product Definition §12 |
| Applicable decisions | DEC-NOS-006, DEC-NOS-008, DEC-NOS-009 |
| Release | None |
| Implementation authority | None |

### Requirement statement

Network OS shall maintain a governed Service Catalog / Taxonomy that acts as the common service language across demand, Service Partner capability, qualification, work orders, reporting, and future matching.

### Acceptance criteria

- Services can be created, edited, activated/deactivated, categorized, and assigned stable identifiers.
- Taxonomy supports broad categories and more specific service types where operationally necessary.
- Service Needs and work orders reference governed service identifiers rather than only free text.
- Service Partner capability can be associated with governed service identifiers.
- The existing Service Catalog implementation may be reused only after its direct-booking assumptions are reconciled.

---

## REQ-NOS-P1-006 — Rapid Service Partner prospect capture

| Field | Value |
| --- | --- |
| Status | Proposed |
| Product area | Service Partner Acquisition |
| Source | Product Definition §§14–15 |
| Applicable decisions | DEC-NOS-004, DEC-NOS-008, DEC-NOS-013 |
| Release | None |
| Implementation authority | None |

### Requirement statement

Network OS shall allow BHIS to capture a Service Partner prospect quickly without requiring full qualification or onboarding at initial entry.

### Acceptance criteria

- Prospect capture supports company, contact, email, phone, service categories, primary geographic markets, crew count where known, market interest, willingness to subcontract/perform managed work, source, BHIS representative, and notes.
- Source attribution supports events, referrals, customer introductions, outbound recruiting, website/application sources, and other approved sources.
- A prospect can be saved incomplete and progressed later.
- Event capture does not require event-specific schema.
- Prospect records are distinct from customer prospects and referral partners.

---

## REQ-NOS-P1-007 — Service Partner lifecycle and onboarding

| Field | Value |
| --- | --- |
| Status | Proposed |
| Product area | Service Partner Network |
| Source | Product Definition §§13–16 |
| Applicable decisions | DEC-NOS-004, DEC-NOS-008, DEC-NOS-009, DEC-NOS-013 |
| Release | None |
| Implementation authority | None |

### Requirement statement

Network OS shall support progressive Service Partner onboarding and lifecycle management from prospect through active network participation.

### Acceptance criteria

- Lifecycle supports Prospect, Contacted, Interested, Application Started, Application Submitted, Documentation Review, Approved, Active, Preferred, Restricted/Suspended, and Inactive, subject to later controlled normalization.
- Service Partner identity, primary contacts, business information, service capabilities, and geography can be recorded before full approval.
- Progression into Approved/Active requires separately defined qualification checks rather than only a manually selected status.
- Internal notes and risk information can be segregated from Service Partner-visible information.
- Legacy referral-code/commission semantics do not determine Network OS Service Partner status.

---

## REQ-NOS-P1-008 — Service Partner capability and geography

| Field | Value |
| --- | --- |
| Status | Proposed |
| Product area | Service Partner Capacity Foundation |
| Source | Product Definition §13 |
| Applicable decisions | DEC-NOS-006, DEC-NOS-008, DEC-NOS-010 |
| Release | None |
| Implementation authority | None |

### Requirement statement

Network OS shall record objective Service Partner capability and geographic coverage needed for Phase 1 manual matching.

### Acceptance criteria

- Service Partner can be associated with one or more governed service categories/types.
- System records primary markets and supports at least county/city/ZIP/radius/region coverage in a controlled model; architecture may choose the initial minimum representation.
- System can determine whether a Service Partner claims to cover a target property using stored geography.
- Crew count, emergency capability, after-hours capability, property-type experience, and relevant equipment/job-size constraints can be recorded where known.
- Phase 1 distinguishes declared capability from future observed-performance intelligence.

---

## REQ-NOS-P1-009 — Qualification and compliance status

| Field | Value |
| --- | --- |
| Status | Proposed |
| Product area | Service Partner Qualification |
| Source | Product Definition §16; DEC-NOS-009 |
| Applicable decisions | DEC-NOS-008, DEC-NOS-009, DEC-NOS-012 |
| Release | None |
| Implementation authority | None |

### Requirement statement

Network OS shall support factual, evidence-based Service Partner qualification and compliance status sufficient to determine Phase 1 eligibility for managed work.

### Acceptance criteria

- System can record required insurance, licenses, certifications, W-9, agreements, references/background requirements where applicable, status, and expiration dates.
- Requirements are represented as BHIS/customer/property/work requirements rather than provider self-opinion questions.
- Missing or expired mandatory qualification can make a Service Partner ineligible for affected work.
- Phase 1 supports at least Core BHIS Approved and Multifamily Approved qualification layers, with extensibility for later layers.
- Qualification documents are access-controlled and expiration-sensitive.
- Approval actions are auditable and require authorized human action; AI cannot independently grant qualification.

---

## REQ-NOS-P1-010 — Customer/Property Service Partner preferences and restrictions

| Field | Value |
| --- | --- |
| Status | Proposed |
| Product area | Eligibility / Customer Rules |
| Source | Product Definition §17; DEC-NOS-011 |
| Applicable decisions | DEC-NOS-005, DEC-NOS-010, DEC-NOS-011 |
| Release | None |
| Implementation authority | None |

### Requirement statement

Network OS shall allow BHIS to record customer/property-specific Service Partner preferences and exclusions without requiring customers to replace existing vendors.

### Acceptance criteria

- Customer/property can identify BHIS network Service Partners, customer-preferred existing Service Partners, customer-mandated Service Partners, preferred Service Partners, and do-not-dispatch/restricted Service Partners.
- Mandatory/restricted rules affect manual eligibility presentation.
- Customer-owned vendor relationships can be coordinated even if they are not broadly preferred across the BHIS network.
- Restrictions include reason and effective status/date where appropriate and are auditable.

---

## REQ-NOS-P1-011 — Executable work order and managed-service lifecycle

| Field | Value |
| --- | --- |
| Status | Proposed |
| Product area | Service Coordination |
| Source | Product Definition §18 |
| Applicable decisions | DEC-NOS-005, DEC-NOS-012, DEC-NOS-016 |
| Release | None |
| Implementation authority | None |

### Requirement statement

Network OS shall create a trackable executable work record for approved service execution and maintain a managed-service lifecycle distinct from Service Need qualification.

### Acceptance criteria

- Work order links to customer, property/facility, Service Need where applicable, service taxonomy entry, scope, urgency, required completion window, relevant instructions, and attachments.
- Lifecycle supports the Phase 1 operating path: Request/Work Created → Needs Review → Service Partner Matching → Offered → Accepted → Scheduled → active execution statuses → Completion Submitted → BHIS Review → Completed/Closed.
- System supports Cancelled, Rescheduled, Customer Hold, Service Partner Declined, Scope Change, Additional Approval Required, Parts Required, Unable to Access, Rework Required, and Dispute as states or structured exceptions according to later architecture.
- Internal-technician assignment is not required as the primary Network OS ownership model.
- Material status transitions are timestamped and auditable.

---

## REQ-NOS-P1-012 — Manual eligibility review and Service Partner assignment

| Field | Value |
| --- | --- |
| Status | Proposed |
| Product area | Matching / Assignment |
| Source | Product Definition §20; DEC-NOS-010 |
| Applicable decisions | DEC-NOS-008, DEC-NOS-009, DEC-NOS-010, DEC-NOS-011, DEC-NOS-012 |
| Release | None |
| Implementation authority | None |

### Requirement statement

Phase 1 shall support deterministic eligibility filtering and human-controlled Service Partner selection without requiring machine-learned match scoring.

### Acceptance criteria

- For a work order, Network OS can present Service Partners that satisfy configured mandatory service, geography, active status, qualification/compliance, and customer/property restriction requirements.
- Ineligible Service Partners are excluded or clearly marked with the blocking reason.
- Authorized BHIS personnel can select/assign an eligible Service Partner.
- Authorized override of a non-preferred recommendation/ordering can be recorded with reason; bypass of mandatory legal/compliance requirements requires separately governed authority and is not implied by this requirement.
- Phase 1 does not require AI or ML ranking.

---

## REQ-NOS-P1-013 — Service Partner offer and response events

| Field | Value |
| --- | --- |
| Status | Proposed |
| Product area | Dispatch / Coordination |
| Source | Product Definition §19 |
| Applicable decisions | DEC-NOS-010, DEC-NOS-012, DEC-NOS-013 |
| Release | None |
| Implementation authority | None |

### Requirement statement

Network OS shall support offering managed work to a Service Partner and recording the response as authoritative network performance data.

### Acceptance criteria

- Offer includes property/general location, scope, required window, access instructions, relevant media, pricing/quote requirements, qualifications, and requested response time as applicable.
- Service Partner can respond Accept, Decline, Request Clarification, Propose Alternate Date/Time, or Submit Quote where required, through a low-friction mechanism that does not require Partner OS.
- System records time offered, response time, response decision, and structured decline/response reason where applicable.
- Accepted work cannot silently change Service Partner assignment without an auditable reassignment event.
- Communication delivery is not itself the authoritative acceptance record.

---

## REQ-NOS-P1-014 — Scheduling and operational status visibility

| Field | Value |
| --- | --- |
| Status | Proposed |
| Product area | Scheduling / Coordination |
| Source | Product Definition §22 |
| Applicable decisions | DEC-NOS-003, DEC-NOS-005, DEC-NOS-012 |
| Release | None |
| Implementation authority | None |

### Requirement statement

Network OS shall track the customer-facing service commitment and operational status without requiring ownership of the Service Partner's internal workforce calendar.

### Acceptance criteria

- Accepted work can be assigned a scheduled date/time or service window.
- System records schedule changes and responsible actor/source.
- Phase 1 supports operational visibility for at least Scheduled, En Route where supplied, On Site where supplied, Work in Progress where supplied, Completion Submitted, and completed/exception outcomes.
- Customer-facing status can be derived without exposing unnecessary Service Partner internal details.
- Future Partner OS synchronization is possible through explicit contracts, but Partner OS is not required for Phase 1.

---

## REQ-NOS-P1-015 — Completion evidence and BHIS review

| Field | Value |
| --- | --- |
| Status | Proposed |
| Product area | Evidence / Completion Validation |
| Source | Product Definition §23 |
| Applicable decisions | DEC-NOS-005, DEC-NOS-012, DEC-NOS-015 |
| Release | None |
| Implementation authority | None |

### Requirement statement

Network OS shall require and retain appropriate completion evidence before BHIS closes managed work where evidence is required by service/customer/property rules.

### Acceptance criteria

- Service Partner can submit completion photos/documents, notes/findings, checklist evidence, scope-change information, and other required artifacts.
- Evidence is linked to the correct work order and retains source/provenance information.
- BHIS can approve completion, request correction/missing evidence, or flag rework/exception.
- Work cannot reach final close where mandatory completion evidence or BHIS review remains unsatisfied.
- Operational MIL/media/checklist infrastructure may be reused after authority and data-classification review.

---

## REQ-NOS-P1-016 — Exception queue with ownership and resolution

| Field | Value |
| --- | --- |
| Status | Proposed |
| Product area | Exception Management |
| Source | Product Definition §24 |
| Applicable decisions | DEC-NOS-005, DEC-NOS-006, DEC-NOS-012, DEC-NOS-015, DEC-NOS-016 |
| Release | None |
| Implementation authority | None |

### Requirement statement

Network OS shall provide a central exception queue so BHIS coordinators and managers can manage work by exception rather than manually inspect every job.

### Acceptance criteria

- Exceptions can be created automatically or manually for at least Service Partner non-response, unscheduled accepted work, late/no-show where known, customer unavailable, overdue service, expired qualification affecting active work, missing completion evidence, customer complaint, callback/rework, access issue, pricing/approval issue, and matching failure.
- Each exception records type/reason, related record, priority/severity, owner, created time, due time where applicable, status, and resolution.
- Exceptions can be reassigned/escalated with an auditable history.
- Resolving an exception does not silently alter the underlying work-order history.
- Dashboard/queue supports filtering by owner, priority, age, customer/property, work order, and Service Partner where applicable.

---

## REQ-NOS-P1-017 — Communications and accountability event history

| Field | Value |
| --- | --- |
| Status | Proposed |
| Product area | Communications / Audit |
| Source | Product Definition §35 |
| Applicable decisions | DEC-NOS-005, DEC-NOS-012, DEC-NOS-015 |
| Release | None |
| Implementation authority | None |

### Requirement statement

Network OS shall maintain a traceable operational event history connecting customer communications, Service Partner communications, and authoritative workflow transitions.

### Acceptance criteria

- Relevant calls, SMS/email delivery events, offers, responses, schedule changes, completion submissions, BHIS review, customer notifications, and exception events can be associated with customer/property/work/Service Partner context.
- Communication channels are delivery adapters and do not silently overwrite authoritative state.
- Operational event history shows timestamp, actor/source, event type, related record, and outcome where applicable.
- Restricted content/secrets are not unnecessarily duplicated into logs/audit events.

---

## REQ-NOS-P1-018 — Basic Network OS operational dashboards

| Field | Value |
| --- | --- |
| Status | Proposed |
| Product area | Management Visibility |
| Source | Product Definition §§5–6, 25, 28, 30, 42 |
| Applicable decisions | DEC-NOS-006, DEC-NOS-016 |
| Release | None |
| Implementation authority | None |

### Requirement statement

Phase 1 shall provide basic management visibility into customer workload, Service Partner network status, active coordination, and exceptions using authoritative Network OS data.

### Acceptance criteria

At minimum, management can see:

- active/prospective customer properties;
- Service Needs by status/service/geography;
- Service Partner prospects and active/approved Service Partners;
- Service Partner counts by service category and geography at the fidelity supported in Phase 1;
- open work orders by lifecycle state;
- work awaiting Service Partner assignment/response;
- scheduled/active/completion-pending work;
- open exceptions by priority/owner/age;
- basic time-to-assignment and time-to-schedule where sufficient events exist;
- basic first-provider-response/acceptance counts where sufficient offer data exists.

Phase 1 dashboards may be operational rather than analytically sophisticated. They must not fabricate metrics when the required event data does not yet exist.

---

# Cross-cutting Phase 1 Requirements

## REQ-NOS-P1-019 — Authoritative state, audit, and role boundaries

| Field | Value |
| --- | --- |
| Status | Proposed |
| Product area | Platform Governance / Security |
| Source | Product Definition §§39–40; copied foundation controls |
| Applicable decisions | DEC-NOS-012, DEC-NOS-015 |
| Release | None |
| Implementation authority | None |

### Requirement statement

Network OS shall remain authoritative for implemented managed-network domains, with role-appropriate access, auditable material transitions, and controlled external adapters.

### Acceptance criteria

- Customer/property, Service Need, Service Partner qualification/status, work order, assignment, offer response, schedule, completion, exception, and human decision records have defined authoritative ownership.
- External communications, Partner OS, n8n, AI, and third-party systems cannot directly become the sole source of truth for these domains without a separate decision.
- Material state transitions retain actor/source and timestamp.
- Service Partner-visible information is separated from BHIS-internal risk/performance/management notes.
- Access controls and RLS/authorization tests are defined before production use.
- Test/training data is identifiable and cannot contaminate production reporting or communications.

---

## REQ-NOS-P1-020 — Phase 1 usability and low-friction external participation

| Field | Value |
| --- | --- |
| Status | Proposed |
| Product area | UX / Adoption |
| Source | Product Definition §§4, 10, 19, 22, 38 |
| Applicable decisions | DEC-NOS-003, DEC-NOS-013, DEC-NOS-016 |
| Release | None |
| Implementation authority | None |

### Requirement statement

Phase 1 shall minimize operational friction for BHIS field staff, coordinators, customers, and Service Partners and shall not depend on Partner OS adoption.

### Acceptance criteria

- Core BHIS coordinator workflows are optimized for exception-driven operation rather than deep menu navigation.
- Basic property visit capture is mobile-first and approximately one minute for ordinary visits.
- Service Partners can respond to work through a low-friction authorized experience without purchasing or adopting Partner OS.
- Customer-facing interactions require only the minimum necessary steps for request/status/approval/completion communication used in Phase 1.
- Network OS does not expose legacy direct-service modules as primary navigation merely because code exists.

---

# Deferred from Phase 1 implementation scope

The following are recognized product directions but are not required for the minimum Phase 1 operating loop unless a later release decision pulls them forward:

- real-time Service Partner capacity/workload management;
- Service Partner self-service availability management;
- configurable network-density thresholds and advanced coverage maps;
- full Service Partner performance scoring;
- mature SLA engine and automated escalation policies;
- territory management and map visualization;
- advanced customer trust metrics and portfolio reporting;
- agreement-backed recurring Service Programs;
- full two-sided Network Economics and reconciliation;
- automated eligibility workflows beyond deterministic Phase 1 filters;
- match scoring / machine-assisted ranking;
- automated dispatch recommendations;
- capacity/demand forecasting;
- recruiting recommendations;
- Partner OS integration;
- mandatory/preferred Partner OS participation policy;
- generic multi-tenant SaaS;
- ALF/group-home/government-specific qualification implementations beyond architectural extensibility.

# Definition of Ready inputs required before implementation

Before the first Network OS Phase 1 release can be activated, governance should require at minimum:

1. Founder ratification of the Network OS Product Definition and applicable Network OS decisions.
2. Founder approval of the Phase 1 requirements selected for the release.
3. A Network OS Workflow Map for the closed operating loop.
4. Architecture records defining authoritative domain boundaries, identity/roles, event/audit model, data classification, and external-adapter boundaries.
5. A schema/data migration plan that explicitly identifies which copied legacy structures are reused, adapted, migrated, isolated, or abandoned.
6. A security/RLS/authorization test plan.
7. A non-production environment and synthetic test-data plan.
8. Acceptance tests mapped to each active requirement.
9. Explicit release scope and implementation slices.
10. Founder release authorization under the controlled governance process.

# Disposition

This register translates the Network OS Product Definition into a Phase 1 requirements baseline. It intentionally favors a complete managed-service operating loop over broad feature coverage.

The next controlled artifact should be the **Network OS Phase 1 Workflow Map**, followed by domain/architecture reconciliation. No application implementation is authorized by this register.

# BHFOS Network OS — Phase 1 Domain & Architecture Reconciliation

| Field | Value |
| --- | --- |
| Status | Active direction for Release 1 / Slice 1 — exact designs pending |
| Version | 0.2 |
| Date | 2026-08-22 |
| Product | Network OS |
| Initial operating company | Black Horse Integrated Services (BHIS) |
| Implementation authority | None — architecture planning only |
| Founder direction | `NETWORK_OS_FIELD_VISIT_CLOSEOUT_FOUNDER_DIRECTION.md` |

## 1. Purpose

Reconcile the approved direction, Phase 1 requirements, workflow map, and copied legacy foundation into a clean Network OS domain model and architecture posture before implementation is authorized.

This document identifies authoritative domains, reuse/adaptation strategy, ownership boundaries, integration boundaries, and architecture decisions still required. It intentionally does not define final SQL schema, migration scripts, API payloads, page components, or implementation slices.

## 2. Architecture posture

Network OS should use **domain-first reuse**.

Existing code, tables, services, components, and workflows are implementation inventory. They are not automatically authoritative simply because they already exist.

The architecture should prefer:

- clean domain boundaries over legacy-table convenience;
- explicit authoritative ownership over hidden coupling;
- event history over destructive state overwrites;
- modular qualification and service taxonomy over market hard-coding;
- Service Partner coordination over technician-centric assumptions;
- low-friction adapters over forcing external users into the full internal application;
- controlled interoperability with Partner OS over shared database ownership.

## 3. Proposed authoritative domain map

### 3.1 Customer Network domain

Authoritative concepts:

- Organization / Ownership / Management Company.
- Portfolio / Region.
- Property / Facility.
- Optional Building / Unit / Asset.
- Contact.
- Contact role/context.
- Relationship.
- Relationship owner.
- Visit/contact event.
- Follow-up.
- Promised action / next action.
- Communication dispatch state.
- Due-follow-up attention state.

Primary requirements: REQ-NOS-P1-001, 002, 003, 021.

Legacy candidates for reuse/adaptation:

- `organizations`.
- `accounts`.
- `contacts`.
- customer/contact UI components.
- generic notes/activity patterns.

Architecture conclusion:

**Adapt, do not simply rename.** The copied foundation has useful organization/contact structures, but Network OS needs explicit portfolio/property/facility hierarchy and relationship intelligence that should not be hidden in generic account types or lead records.

Recommended direction:

- Preserve reusable organization/contact identity where semantics fit.
- Introduce explicit property/facility relationships if the legacy model cannot represent them cleanly.
- Do not require `lead` as the root customer object.
- Treat visit closeout as one governed workflow commitment: authoritative visit
  plus next-action state, with idempotent dispatch/outbox behavior so retries do
  not duplicate email, reminders, status transitions, or events.
- Separate communication intent, approval, delivery attempt, and confirmed
  delivery states; never infer delivery from a saved visit.
- Preserve interrupted/offline drafts without treating them as closed visits.
- Keep TIS outside the runtime/authority boundary; mine only reusable patterns
  that are deliberately adapted into native Network OS components.

### 3.2 Demand domain

Authoritative concepts:

- Service Need / Opportunity.
- Need status.
- Need source.
- Need owner.
- urgency/timing.
- current vendor context.
- scope and attachments.
- recommended next action.
- conversion/linkage to executable work.

Primary requirement: REQ-NOS-P1-004.

Legacy candidates:

- leads/deals/pipeline patterns.
- activity/source attribution.

Architecture conclusion:

**New authoritative domain required.** A Service Need must not be represented solely as a legacy `lead` row or a work order status because it has a different lifecycle and may never create work.

Recommended direction:

- Create a dedicated Service Need concept.
- Reuse pipeline UI/state patterns where useful.
- Permit one Service Need to create zero, one, or multiple work orders.

### 3.3 Service Taxonomy domain

Authoritative concepts:

- Service category.
- Service type/subtype.
- active/inactive state.
- stable identifier.
- optional metadata for qualification, evidence, property applicability, and future matching.

Primary requirement: REQ-NOS-P1-005.

Legacy candidate:

- `services_catalog` and Service Catalog UI.

Architecture conclusion:

**High-value adaptation.** Existing catalog structures are usable, but booking/quote assumptions must not define the new taxonomy.

Recommended direction:

- Preserve stable service identity where possible.
- Expand hierarchy/metadata incrementally.
- Use taxonomy IDs across Service Needs, Service Partner capability, and work.

### 3.4 Service Partner Network domain

Authoritative concepts:

- Service Partner organization.
- Service Partner contacts.
- lifecycle status.
- source/acquisition channel.
- service capability.
- geography.
- crew/equipment/capacity facts.
- availability state later.
- restrictions/preferences.
- internal notes.
- performance history later.

Primary requirements: REQ-NOS-P1-006, 007, 008, 010.

Legacy candidates:

- `partner_prospects`.
- Partners UI.
- onboarding/submission flows.
- partner-status/performance components.

Architecture conclusion:

**Adapt aggressively, but do not preserve legacy referral semantics as domain truth.** Existing partner machinery is a strong implementation starting point, but Service Partner identity must be detached from referral codes, commissions, realtor persona, and referral-tier assumptions.

Recommended direction:

- Treat existing partner records as migration/input candidates.
- Establish a clean Service Partner organization identity.
- Model lifecycle separately from qualification state.
- Model capability/geography separately enough to support matching and reporting.

### 3.5 Qualification domain

Authoritative concepts:

- qualification layer.
- requirement definition.
- requirement applicability.
- evidence/document.
- evidence status.
- issue/expiration date.
- approval/rejection.
- reviewer/authority.
- eligibility effect.

Primary requirement: REQ-NOS-P1-009.

Legacy candidates:

- partner submissions/onboarding docs.
- document upload/storage.
- compliance/status utilities.

Architecture conclusion:

**New explicit domain required.** Qualification cannot safely live as scattered booleans/columns on a Service Partner row.

Recommended direction:

- Separate requirement definitions from submitted evidence.
- Support layers such as Core BHIS and Multifamily without schema duplication.
- Allow customer/property/work-specific requirements later.
- Make expiration/invalid evidence affect eligibility deterministically.
- Preserve human approval authority and audit.

### 3.6 Preference / restriction domain

Authoritative concepts:

- customer-preferred Service Partner.
- customer-mandated Service Partner.
- property-specific preference.
- do-not-dispatch restriction.
- restriction reason/effective period.

Primary requirement: REQ-NOS-P1-010.

Legacy candidates:

- generic partner/account relationships and tags.

Architecture conclusion:

**Likely new relationship domain.** These rules directly affect matching and should not be stored only in free-text notes or generic tags.

### 3.7 Work Coordination domain

Authoritative concepts:

- Work Order.
- linked Service Need.
- customer/property context.
- service taxonomy.
- scope.
- urgency.
- required window.
- managed-service status.
- assignment state.
- commercial/approval constraints relevant to coordination.

Primary requirements: REQ-NOS-P1-011, 014.

Legacy candidates:

- `jobs`.
- work-order services.
- appointment linkage.
- job status utilities.
- office job execution UI.

Architecture conclusion:

**Adapt with a strict boundary.** Existing job lifecycle mechanics are valuable, but Network OS work cannot be defined by technician assignment or direct-service payment state.

Recommended direction:

- Preserve generic lifecycle/status mechanics where possible.
- Remove internal technician identity as a required ownership dimension.
- Link work explicitly to Service Need and Service Partner coordination objects.
- Separate operational status from exception/reason state where practical.

### 3.8 Matching / Eligibility domain

Authoritative concepts:

- eligibility evaluation.
- eligibility criteria/result.
- blocking reason.
- candidate list.
- human selection.
- override reason.

Primary requirement: REQ-NOS-P1-012.

Legacy candidates:

- none adequate.

Architecture conclusion:

**New domain/service required.** Matching should not be hard-coded into UI filters or ad hoc queries.

Recommended direction:

- Start deterministic.
- Inputs: service, geography, lifecycle, qualification, restrictions/preferences.
- Return candidate eligibility plus reasons.
- Keep ranking optional in Phase 1.
- Preserve evaluation evidence needed for later first-match metrics.

### 3.9 Offer / Acceptance domain

Authoritative concepts:

- work offer.
- offered Service Partner.
- offered time.
- response deadline.
- response type.
- response time.
- decline reason.
- clarification/alternate/quote response.
- reassignment history.

Primary requirement: REQ-NOS-P1-013.

Legacy candidates:

- communications infrastructure.
- appointment/dispatch interactions.

Architecture conclusion:

**New explicit domain required.** Offer/response history is essential for Network Fulfillment, First-Match Fulfillment, response-time metrics, and audit.

Recommended direction:

- Never store only `assigned_partner_id` on work and lose prior offers.
- Every offer/response remains historical.
- Network OS records authoritative response even when response arrives through SMS/email/phone/Partner OS.

### 3.10 Scheduling Commitment domain

Authoritative concepts:

- customer-facing service window.
- schedule status.
- schedule source/actor.
- change history.

Primary requirement: REQ-NOS-P1-014.

Legacy candidates:

- appointments/scheduling system.

Architecture conclusion:

**Adapt.** Existing appointment mechanics are useful. Network OS should own the managed commitment, not Service Partner workforce scheduling.

Recommended direction:

- One authoritative managed-service schedule/commitment record or equivalent event history.
- Future Partner OS synchronization via contract.
- Do not require Service Partner technician IDs.

### 3.11 Evidence / Completion domain

Authoritative concepts:

- completion submission.
- completion notes/findings.
- evidence item/media/document.
- checklist result.
- evidence requirement satisfaction.
- BHIS review.
- rework request.

Primary requirement: REQ-NOS-P1-015.

Legacy candidates:

- MIL/media.
- inspections/checklists.
- before/after collections.
- document delivery.

Architecture conclusion:

**Reuse infrastructure, add Network OS completion semantics.** The media/checklist foundation is strong, but operational evidence must be linked to the Network OS work and requirement model rather than marketing/creator workflows.

Recommended direction:

- Reuse storage/provenance/review patterns.
- Add explicit completion submission and BHIS review state.
- Separate operational evidence from marketing content permissions/use.

### 3.12 Exception domain

Authoritative concepts:

- exception type.
- reason code.
- related entity/entities.
- severity/priority.
- owner.
- due time.
- status.
- escalation history.
- resolution.

Primary requirement: REQ-NOS-P1-016.

Legacy candidate:

- `escalations` and Escalations UI.

Architecture conclusion:

**Adapt into a generic exception model.** Existing escalation patterns align well but are too lead-centric.

Recommended direction:

- Generic polymorphic or typed relationship to work/Service Partner/customer/qualification/etc., subject to architecture choice.
- Separate exception state from underlying work status.
- Preserve resolution history.

### 3.13 Communications / Operational Events domain

Authoritative concepts:

- operational event.
- communication delivery event/reference.
- actor/source.
- timestamp.
- related entity.
- event type.
- outcome.

Primary requirement: REQ-NOS-P1-017.

Legacy candidates:

- SMS/inbox/call logging.
- document delivery.
- audit/event patterns.

Architecture conclusion:

**Reuse adapters, introduce a clean event model.** Communication records and audit events should support, not replace, domain state.

Recommended direction:

- Domain transitions write durable events.
- External communication delivery references the associated business event/action.
- Do not duplicate restricted message payloads into broad audit logs.

### 3.14 Reporting / Scorecard domain

Authoritative concepts:

- operational projections/views derived from authoritative event/domain data.
- Phase 1 queues and counts.
- basic time-to-assignment/time-to-schedule.
- first-response/acceptance counts.

Primary requirement: REQ-NOS-P1-018.

Legacy candidates:

- dashboard/analytics components.
- CRM/Action hubs.

Architecture conclusion:

**Adapt UI/query patterns; rebuild metric definitions.** Do not retain direct-service KPIs simply because dashboards already exist.

### 3.15 Identity / Role / Authority domain

Authoritative concepts:

- BHIS internal roles.
- Service Partner external actor identity/access.
- customer external actor access later.
- adapter/service identity.
- authorization boundaries.

Primary requirements: REQ-NOS-P1-019, 020.

Legacy candidates:

- Supabase Auth.
- existing role/RLS patterns.
- training-mode/environment controls.

Architecture conclusion:

**Reuse platform identity where sound, redesign authorization for Network OS roles and external actors.**

Recommended minimum role families:

- Founder/Executive.
- BHIS Manager.
- Relationship/Territory Manager.
- Service Coordinator.
- Qualification/Compliance Reviewer if separated.
- Service Partner external actor.
- System/adapter identity.

Final RBAC/RLS mapping requires an ADR.

## 4. Domain relationship model — conceptual

The intended conceptual relationships are:

Organization
→ Portfolio/Region
→ Property/Facility
→ Contact / Relationship / Visit
→ Service Need
→ Work Order
→ Eligibility Evaluation
→ Work Offer(s)
→ Selected Service Partner
→ Schedule Commitment
→ Completion Submission / Evidence
→ BHIS Review
→ Exception(s) as needed
→ Closeout / reporting events

Service Partner
→ Capabilities
→ Geography
→ Qualification/Evidence
→ Preferences/Restrictions
→ Offer/Response history
→ Work history
→ future observed performance

Service Catalog
→ referenced by Service Need
→ referenced by Service Partner capability
→ referenced by qualification rules
→ referenced by Work Order
→ referenced by reporting/matching

## 5. Legacy structure disposition at architecture level

| Legacy structure/capability | Architecture posture |
| --- | --- |
| `organizations` | Candidate reuse if semantics support parent hierarchy cleanly |
| `accounts` | Review; do not make generic account type carry all Network OS hierarchy by default |
| `contacts` | Strong reuse candidate with relationship/context extensions |
| `leads` | Do not use as universal root object; selective reuse/migration only |
| `partner_prospects` | Migration/reuse candidate, but Service Partner domain needs cleaner semantics |
| `services_catalog` | Strong reuse/adaptation candidate |
| `jobs` | Reuse/adapt only after technician/payment assumptions are isolated |
| appointments/schedule | Strong mechanics reuse candidate |
| `escalations` | Strong pattern reuse; generic exception redesign required |
| invoices/quotes | Defer architecture decision until active financial scope is defined |
| media/MIL | Strong infrastructure reuse candidate for evidence |
| inspections/checklists | Strong selective reuse candidate |
| SMS/inbox/call logs | Adapter/event reuse candidate |
| audit/system health | Keep platform foundation |
| tenant utilities/`tenant_id` | Compatibility/security review required; must not drive product UX or multi-tenant scope |
| technician roster/payroll | Exclude from Network OS core |
| referral code/commission partner model | Exclude from Service Partner domain authority |

## 6. Status versus exception separation

A major architecture rule should be:

**Status describes where the work is in its normal lifecycle. Exception describes a condition requiring attention or deviation.**

Examples:

- `Scheduled` = status.
- `Service Partner late` = exception.
- `Completion Submitted` = status.
- `Missing evidence` = exception.
- `Accepted` = status.
- `Accepted but unscheduled` = exception.

Some conditions such as Unable to Access or Rework Required may need both lifecycle effect and exception representation. Architecture should choose a consistent pattern rather than growing an unbounded status enum.

## 7. Event model requirement

Network OS needs a durable operational event model sufficient to reconstruct key performance timings and accountability.

Minimum event characteristics:

- unique event identity;
- occurred_at timestamp;
- recorded_at timestamp if different;
- actor type/id or system source;
- event type;
- related domain object(s);
- structured metadata sufficient for the event without duplicating sensitive payloads;
- source channel/adapter where relevant;
- correlation/request identity where relevant.

Events should support later derivation of:

- time to acknowledgment;
- time to assignment;
- time to first offer;
- Service Partner response time;
- first-match acceptance;
- time to schedule;
- service cycle time;
- completion review time;
- exception frequency/aging.

## 8. External adapter architecture

External tools should integrate through narrow contracts rather than direct broad writes into authoritative tables.

Potential adapters:

- SMS/email delivery.
- n8n orchestration.
- Partner OS.
- accounting/QuickBooks.
- document storage/delivery.
- AI services.

Adapter rule:

- Network OS authorizes the business action.
- Adapter executes/delivers.
- Adapter reports outcome.
- Network OS reconciles and records authoritative state.

This follows the same system-of-record principle already established in the copied foundation's governed orchestration work.

## 9. Partner OS interoperability boundary

The architecture should anticipate but not implement prematurely:

### Network OS may eventually send

- work identity/reference;
- Service Partner assignment/offer context;
- property/general location;
- authorized scope;
- customer-required window;
- qualification/evidence requirements;
- approved commercial information needed by the Service Partner.

### Partner OS may eventually return

- accept/decline/clarification;
- scheduled commitment;
- permitted status events;
- evidence/completion submission;
- quote/cost/invoice information where authorized;
- exception notifications.

### Explicit prohibition

Neither product should directly own or mutate the other's internal tables.

Integration should use versioned contracts/events and idempotent processing.

## 10. Dedicated BHIS versus tenant architecture

Network OS is initially a dedicated BHIS operating system.

Existing `tenant_id` fields may remain temporarily for compatibility, RLS, migration safety, or shared platform utilities, but they must not create product behavior such as tenant selection, tenant provisioning, cross-company admin, or per-tenant commercial configuration.

Architecture must explicitly decide:

- whether existing tenant IDs are retained as a fixed BHIS scope key;
- where they can be removed safely;
- how RLS remains secure during migration;
- how Partner OS and Network OS environments/data stores remain isolated enough to avoid accidental cross-product coupling.

## 11. Data classification implications

### Restricted/high-sensitivity candidates

- property gate/access/security instructions;
- resident-sensitive photos/media;
- insurance/compliance documents containing PII or policy details;
- tax/payment forms;
- credentials/secrets;
- certain background/qualification records.

### Confidential candidates

- customer contacts;
- property/service history;
- Service Partner commercial terms;
- internal performance/risk notes;
- quotes/costs/margins;
- customer complaints.

Architecture must enforce least privilege and avoid exposing BHIS-internal scoring/risk notes to Service Partners.

## 12. Recommended bounded contexts

For implementation planning, the product can be treated as these bounded contexts:

1. **Customer Network** — organizations, portfolios, properties, contacts, relationships, visits.
2. **Demand** — Service Needs/opportunities.
3. **Service Catalog** — governed service taxonomy.
4. **Service Partner Network** — partner identity, lifecycle, capability, geography.
5. **Qualification** — requirements/evidence/approval/expiry.
6. **Coordination** — work orders, eligibility, assignment, offers, schedule commitments.
7. **Completion & Evidence** — submissions, checklists, media, BHIS review.
8. **Exceptions** — cross-domain attention and escalation.
9. **Communications & Events** — delivery adapters and operational history.
10. **Reporting** — queues, scorecards, operational metrics.
11. **Platform Control** — identity, authorization, audit, environment, integrations.

These are conceptual boundaries, not necessarily separate services or databases.

## 13. Architecture decisions required before implementation

The following ADRs/decisions should be completed before or as part of Release 1 Definition of Ready:

### ADR-NOS-001 — Customer hierarchy model
Decide how organization/portfolio/property/contact hierarchy is represented and which legacy structures are reused.

### ADR-NOS-002 — Service Need authoritative model
Define Service Need identity, lifecycle, and one-to-many/no-work relationship to Work Orders.

### ADR-NOS-003 — Service Partner identity and lifecycle model
Define separation from referral partners and legacy partner prospect semantics.

### ADR-NOS-004 — Qualification and eligibility model
Define layered requirements, evidence, expiry, approval, and deterministic eligibility evaluation.

### ADR-NOS-005 — Work coordination state model
Define normal work statuses, assignment semantics, schedule commitment, and separation from exceptions.

### ADR-NOS-006 — Offer/response history model
Define immutable offer/response records, reassignment, response reasons, and first-match measurement.

### ADR-NOS-007 — Exception model
Define generic exception ownership, due/escalation/resolution, and domain linkage.

### ADR-NOS-008 — Operational event/audit model
Define durable business events versus security audit logs and metric derivation.

### ADR-NOS-009 — Evidence/MIL integration
Define how completion submissions/checklists/media reuse existing infrastructure without inheriting marketing semantics.

### ADR-NOS-010 — Identity/RBAC/RLS
Define BHIS internal roles, Service Partner external access, adapter identities, and least-privilege policies.

### ADR-NOS-011 — Legacy tenant compatibility
Define handling of `tenant_id` and isolation of Network OS from Partner OS without enabling multi-tenant scope.

### ADR-NOS-012 — External adapter contracts
Define narrow integration pattern for communications, n8n, Partner OS, and future external systems.

## 14. Proposed first implementation slice boundary

The first implementation slice should not attempt the entire Phase 1 loop.

Recommended first slice after governance/DoR:

**Customer Network + Service Need foundation**

Target capabilities:

- organization/property/contact hierarchy;
- relationship owner/status;
- mobile/basic visit capture;
- Service Need creation/status;
- governed Service Catalog linkage;
- basic list/search/detail views;
- authoritative events/audit for these transitions.

Why first:

- It produces immediate BHIS relationship/demand value.
- It does not depend on Service Partner matching being complete.
- It establishes the customer/property identifiers every later work object needs.
- It lets real demand data begin accumulating before the Service Partner coordination engine is finished.
- It reduces risk compared with starting at work-order/dispatch complexity.

Second likely slice:

**Service Partner Network + Qualification foundation**

Third likely slice:

**Work Coordination + Offer/Acceptance + Exception queue**

Fourth likely slice:

**Completion Evidence + BHIS Review + basic dashboards**

These slice boundaries are recommendations only; release activation requires founder approval and Definition of Ready.

## 15. Migration posture

Do not perform a mass schema rename or destructive cleanup at the start.

Recommended migration strategy:

1. Inventory actual legacy tables/constraints/RLS/functions used by candidate reusable capabilities.
2. Design target Network OS domain model.
3. Identify rows/data that are true BHIS/Network OS assets versus Partner OS/direct-service data.
4. Create additive structures first where clean separation is required.
5. Migrate/copy only approved records with verification.
6. Redirect application reads/writes capability by capability.
7. Deprecate legacy paths only after validation.
8. Remove obsolete structures only in later authorized cleanup slices.

## 16. Architecture readiness conclusion

The copied foundation is structurally useful but should serve as a component and infrastructure library, not as the domain model by default.

Network OS requires several genuinely new authoritative concepts — especially Service Need, layered Qualification, Eligibility Evaluation, Work Offer/Response, generic Exceptions, and explicit managed-network relationship hierarchy.

The cleanest path is to establish those domains deliberately while adapting the strongest existing foundations around contacts/organizations, Service Catalog, work lifecycle mechanics, scheduling, evidence/MIL, communications, audit, and UI infrastructure.

The next controlled step should be to produce the first four ADRs needed for the recommended initial implementation slice and its immediate dependencies: Customer Hierarchy, Service Need, Service Partner Identity/Lifecycle, and Qualification/Eligibility. After those are reviewed, a concrete Release 1 / Slice 1 Definition of Ready can be assembled.

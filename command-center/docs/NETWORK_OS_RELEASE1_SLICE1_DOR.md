# BHFOS Network OS — Release 1 / Slice 1 Definition of Ready

| Field | Value |
| --- | --- |
| Status | Active readiness gate — not ready for implementation; release not activated |
| Version | 0.2 |
| Date | 2026-08-22 |
| Product | Network OS |
| Release | R1 — proposed |
| Slice | S1 — Customer Network + Service Need Foundation |
| Owner | Founder |
| Implementation authority | None |
| Founder direction ratified | 2026-08-22 |
| Ratification evidence | `NETWORK_OS_RELEASE1_SLICE1_FOUNDER_RATIFICATION_PACKET.md` |
| Diagnostics capability decision | `governance/decisions/NOS_R1_S1_I2_CAPABILITY_AND_AGGREGATE_TEMPLATE_DECISION_PACKET.md` — Founder approved, execution gates pending |
| Reconciled through source HEAD | `02b628b97b1b38f32fe7c8902fdbad34778cf3c4` plus ratification-record changes |

## 1. Purpose

Establish the exact readiness gate for the first Network OS implementation slice.

This document does not authorize coding. It identifies what is already defined, what still blocks implementation, and what evidence must exist before the founder may activate Release 1 / Slice 1.

## 2. Slice objective

Release 1 / Slice 1 should establish the minimum authoritative foundation needed for BHIS relationship and demand management before Service Partner coordination is implemented.

Target operating loop for this slice:

**Organization / Portfolio / Property / Contact → Relationship → Visit / Follow-up → Service Need → Service Catalog linkage → authoritative event history → basic operational visibility**

The slice should allow BHIS to begin capturing real customer relationships and demand without waiting for the Service Partner coordination engine.

## 3. In-scope requirements

The proposed Slice 1 requirements are:

- REQ-NOS-P1-001 — Customer organization and property hierarchy.
- REQ-NOS-P1-002 — Relationship intelligence and ownership.
- REQ-NOS-P1-003 — Mobile property visit capture.
- REQ-NOS-P1-004 — Service Need / Opportunity record.
- REQ-NOS-P1-005 — Governed Service Catalog / Taxonomy, limited to the functionality required by this slice.
- REQ-NOS-P1-017 — Communications and accountability event history, limited to relationship/visit/Service Need events required by this slice.
- REQ-NOS-P1-019 — Authoritative state, audit, and role boundaries, limited to the active slice domains.
- REQ-NOS-P1-020 — Phase 1 usability and low-friction participation, limited to BHIS internal/mobile workflows in this slice.

REQ-NOS-P1-018 — Basic operational dashboards may be partially included only to the extent needed for simple Slice 1 queues/counts. Full Phase 1 dashboards remain later work.

## 4. Explicitly out of scope for Slice 1

- Service Partner prospect/onboarding.
- qualification/compliance.
- deterministic eligibility.
- Service Partner matching.
- work offers/acceptance.
- managed-service Work Orders.
- Service Partner scheduling/dispatch.
- completion evidence.
- exception queue beyond errors directly necessary for Slice 1 integrity.
- customer/provider portals.
- Partner OS integration.
- AI matching or autonomous actions.
- pricing, quotes, invoicing, payments, network economics.
- territory maps.
- advanced reporting.
- generic multi-tenant SaaS.

## 5. Governing product and architecture artifacts

### Present

- Network OS Product Definition.
- Network OS Decision Register — Slice 1-applicable decisions Active.
- Network OS Capability Disposition.
- Network OS Phase 1 Requirements Register.
- Network OS Phase 1 Workflow Map.
- Network OS Phase 1 Domain & Architecture Reconciliation.
- ADR-NOS-001 — Customer Hierarchy Model.
- ADR-NOS-002 — Service Need Authoritative Model.
- ADR-NOS-003 — Service Partner Identity & Lifecycle.
- ADR-NOS-004 — Qualification & Eligibility Model.
- ADR-NOS-008 — Operational Event & Audit Model — Active.
- ADR-NOS-010 — Identity, RBAC & RLS — Active.
- ADR-NOS-011 — Legacy Tenant Compatibility — Active.
- Network OS Experience & Design System Definition — Active direction; exact tokens and canonical references pending.
- Release 1 / Slice 1 Founder Ratification & Readiness Reconciliation Packet — approved as written.
- Release 1 / Slice 1 Legacy Dependency Inventory — SOURCE-ONLY inventory complete; hosted-schema verification required.

### Required before activation

- Active Release 1 / Slice 1 record.
- Exact Slice 1 architecture designs required by the Active ADR implementation gates.
- Approved exact design tokens and canonical Slice 1 screen references under the Active Experience & Design System.
- Data/schema migration plan for Slice 1.
- validation/test plan.
- non-production environment declaration.
- implementation branch/worktree and work-item mapping.

## 6. Readiness checklist

### A. Product direction

| Gate | Status | Evidence / blocker |
| --- | --- | --- |
| Network OS product identity defined | READY | Product Definition exists |
| Slice supports Network OS product test | READY | Customer Capacity, Customer Trust, Demand Intelligence |
| Slice outcome is clear and bounded | READY | This document §2–4 |
| Product Definition ratified | READY | Founder ratified 2026-08-22 |
| Applicable decisions active | READY | DEC-NOS-001/002/003/004/005/006/007/012/014/015/016 Active |

### B. Requirements

| Gate | Status | Evidence / blocker |
| --- | --- | --- |
| Requirement IDs exist | READY | REQ-NOS-P1-001/002/003/004/005/017/019/020 |
| Acceptance criteria exist | READY | Phase 1 Requirements Register |
| Requirements trace to workflow | READY | Phase 1 Workflow Map |
| Requirements trace to architecture | READY | ADR-NOS-001/002/008/010/011 plus reconciliation |
| Slice requirements founder-approved | READY | Founder approved 2026-08-22 |

### C. Architecture

| Gate | Status | Evidence / blocker |
| --- | --- | --- |
| Customer hierarchy decision | READY | ADR-NOS-001 Active |
| Service Need decision | READY | ADR-NOS-002 Active |
| Domain boundaries defined | READY | Domain & Architecture Reconciliation |
| Identity / RBAC / RLS direction | READY | ADR-NOS-010 Active; exact Slice 1 permission/RLS design remains blocked |
| Operational event / audit direction | READY | ADR-NOS-008 Active; exact Slice 1 taxonomy/write design remains blocked |
| Legacy `tenant_id` compatibility direction | READY | ADR-NOS-011 Active; hosted dependency verification and canonical BHIS scope remain blocked |
| Legacy source dependency inventory | READY — SOURCE-ONLY | Repository schema/RLS/function/application dependencies classified; hosted verification remains required |
| Hosted schema/RLS/data-quality evidence | BLOCKED — CAPABILITY WORKSTREAM APPROVED | Founder authorized bounded collection and approved `NOS-R1-S1-I2-CAP-01`; exact-head review, `FOUNDER_RUN_READY`, provisioning, and collection remain incomplete |
| Exact target data model/schema | BLOCKED | Active direction exists; exact Slice 1 model not yet drafted |
| Migration/cutover plan | BLOCKED | Must map reused/new structures after target model is drafted |

### D. Experience / design

| Gate | Status | Evidence / blocker |
| --- | --- | --- |
| Premium product appearance is a governed requirement | READY | Founder-ratified design direction; no ad hoc stylistic changes permitted |
| Network OS Experience & Design System Definition | READY | Active direction; Tailgrids hierarchy recorded |
| Canonical Slice 1 desktop screens | BLOCKED | Customer/property, relationship, Service Need, basic home/list/detail |
| Canonical mobile visit screen | BLOCKED | Must validate one-minute capture target |
| Approved component/style tokens | BLOCKED | Typography, spacing, surfaces, tables, states, motion, iconography, color system |
| Ad hoc design-change prohibition in governance | READY | Recorded in the Active design-system authority artifact |

### E. Security / data handling

| Gate | Status | Evidence / blocker |
| --- | --- | --- |
| Data classification baseline exists | READY | Phase 1 Requirements Register |
| Least-privilege role direction | READY | ADR-NOS-010 Active |
| Slice 1 permission/RLS design and authorization test plan | BLOCKED | Exact matrix, policies, field strategy, and tests remain to be created |
| Restricted property/access data handling | PARTIAL | Classification known; exact field/storage/access rules pending |
| Test-data isolation | PARTIAL | Governance principle exists; environment/test plan pending |

### F. Environment / operations

| Gate | Status | Evidence / blocker |
| --- | --- | --- |
| Partner OS preserved independently | READY | Separate Partner OS baseline/archive already created |
| Network OS branch exists | READY | `network-os/foundation` |
| Authorized non-production Network OS environment | BLOCKED | Must be selected/declared |
| Production mutation blocked | READY AS GOVERNANCE | No production authority currently exists |
| Training/synthetic data strategy | BLOCKED | Must be written for Slice 1 |

### G. Validation

| Gate | Status | Evidence / blocker |
| --- | --- | --- |
| Acceptance criteria are testable | READY | Requirement-level criteria exist |
| Requirement-to-test traceability | BLOCKED | Validation matrix not yet created |
| Mobile usability validation | BLOCKED | Design artifact and test protocol needed |
| Duplicate identity tests | BLOCKED | Depends on data model/uniqueness rules |
| hierarchy integrity tests | BLOCKED | Depends on target schema |
| Service Need lifecycle tests | BLOCKED | Depends on final state design |
| RLS/security tests | BLOCKED | Depends on ADR-NOS-010 and schema |

## 7. Ratified architecture directions and remaining design blockers

The Founder ratified the required Slice 1 architecture directions on 2026-08-22. The release remains not implementation-ready because each Active ADR contains a release-specific implementation gate that has not yet been satisfied.

### ADR-NOS-008 — Operational Event & Audit Model

**Active direction.** Remaining gate: define the Slice 1 event taxonomy/versioning, event-write ownership, required events, audit retention/access, sensitive metadata controls, and acceptance tests.

### ADR-NOS-010 — Identity / RBAC / RLS

**Active direction.** Remaining gate: define the Slice 1 permission matrix, record/data scopes, restricted-field handling, RLS policies, service identities, authorization tests, and privileged-action audit requirements.

### ADR-NOS-011 — Legacy Tenant Compatibility

**Active direction.** Remaining gate: inventory touched `tenant_id` dependencies, define the canonical BHIS compatibility scope, document RLS implications and prohibited tenant behavior, and define migration/isolation tests.

ADR-NOS-003 and ADR-NOS-004 remain Proposed and are intended for a later Service Partner Network/Qualification slice. They do not block the core Customer Network + Service Need slice unless later detailed design reveals a material dependency, which must return to the Command Center.

## 8. Design gate added to Definition of Ready

The Founder approved the **Network OS Experience & Design System Definition** direction on 2026-08-22, including the following authority hierarchy:

**Tailgrids primitives → Black Horse Design Foundation → Network OS Product Experience System → governed Network OS components/patterns → application screens**

Release 1 / Slice 1 may not enter implementation until the remaining exact-token and canonical-screen gates are approved under that Active direction.

That artifact must at minimum define:

- product visual principles;
- typography system;
- spacing/grid system;
- surface/card/panel treatment;
- table/list density and interaction rules;
- form/input treatment;
- navigation structure;
- status and exception visual language;
- color roles and accessibility boundaries;
- iconography rules;
- motion/transition principles;
- mobile behavior;
- empty/loading/error states;
- canonical page shells;
- premium quality bar and visual QA criteria.

It must also record this authority rule:

> **No designer, developer, AI agent, contractor, or implementation team may introduce ad hoc stylistic changes outside the approved Network OS design system. Material stylistic changes require controlled design approval and an update to the governing design artifact before implementation.**

Slice 1 implementation must be checked against both functional acceptance criteria and the approved visual system.

## 9. Canonical Slice 1 screens required before coding

At minimum, design authority should approve:

1. Network OS home / attention shell at Slice 1 fidelity.
2. Customer organization / portfolio / property navigation pattern.
3. Property detail / relationship workspace.
4. Contact relationship treatment.
5. Service Need list.
6. Service Need detail/create/edit flow.
7. Mobile property visit capture.
8. Search / command / navigation treatment appropriate to Slice 1.

These screens are visual/interaction contracts, not disposable mockups.

## 10. Slice 1 target data-model questions

After the remaining blocking ADRs and design gate, the implementation design must answer:

- Which existing `organizations`, `accounts`, and `contacts` structures are reused versus extended?
- How are Portfolio/Region and Property/Facility represented?
- What uniqueness/deduplication rules exist for organizations, properties, and contacts?
- How are contextual contact roles represented?
- How is relationship ownership/status stored?
- How are visits/follow-ups modeled?
- What is the authoritative Service Need record?
- How does Service Need link to customer hierarchy and Service Catalog?
- How are Service Need lifecycle changes recorded?
- Which business events are persisted separately from security audit events?
- How is `tenant_id` handled on reused/new records?
- Which fields require Confidential versus Restricted access?

## 11. Proposed validation matrix categories

The Slice 1 validation plan should include:

- organization hierarchy creation/edit/navigation;
- optional hierarchy levels;
- property parent integrity;
- contact multi-context role behavior;
- relationship owner/status/follow-up behavior;
- one-minute mobile visit workflow usability;
- visit → Service Need creation without duplicate context entry;
- Service Need create/edit/status/reporting;
- Service Catalog stable-reference behavior;
- authorization/RLS by BHIS role;
- restricted property/access-data controls;
- duplicate/ambiguous organization/property handling;
- event/audit provenance;
- synthetic/training data isolation;
- responsive/premium design conformance;
- accessibility and keyboard/focus behavior for desktop workflows.

## 12. Release activation criteria

Release 1 / Slice 1 becomes **Ready** only when all of the following are true:

1. Network OS Product Definition is Active.
2. Applicable Network OS decisions are Active.
3. Slice 1 requirements are explicitly approved.
4. ADR-NOS-001 and ADR-NOS-002 are Active.
5. ADR-NOS-008, ADR-NOS-010, and ADR-NOS-011 are Active or otherwise explicitly satisfied by approved architecture decisions.
6. Network OS Experience & Design System Definition is approved and canonical Slice 1 screens are approved.
7. Target Slice 1 data model and migration plan are reviewed.
8. Authorized non-production environment is declared.
9. Security/RLS validation plan is complete.
10. Requirement-to-test validation matrix is complete.
11. Work items and implementation branch/worktree are identified.
12. Founder explicitly activates Release 1 / Slice 1.

## 13. Current readiness assessment

**Current state: NOT READY FOR IMPLEMENTATION.**

The product, requirements, workflow, and core domain direction are mature enough that remaining blockers are now specific rather than conceptual.

Founder ratification of product, requirements, architecture direction, and experience/design direction is complete. The SOURCE-ONLY legacy dependency inventory is also complete. The shortest path to implementation readiness is now:

1. Execute the approved `NOS-R1-S1-I2-CAP-01` diagnostics workstream through bounded Builder preparation, local proof, and independent exact-head Architecture Guard review.
2. After all packet gates pass and `FOUNDER_RUN_READY`, provision the protected I2 identity and collect the already-authorized hosted schema/RLS/dependency evidence; then implement/review and run the fixed aggregate templates.
3. Draft the exact Slice 1 domain/data model and migration/compatibility plan from source plus hosted evidence.
4. Define the Slice 1 permission matrix, RLS design, restricted-field strategy, and security tests.
5. Define the Slice 1 operational-event taxonomy, write ownership, retention/access, and provenance tests.
6. Define the exact Service Need fields, lifecycle transitions, reasons, permissions, and event behavior.
7. Approve exact design tokens, governed Tailgrids component adaptations, and canonical desktop/mobile screen references.
8. Declare the authorized non-production environment and synthetic/training-data strategy.
9. Create the requirement-to-test validation matrix and mobile usability protocol.
10. Identify bounded work items and an implementation branch/worktree only after the preceding gates are reviewed.
11. Perform a final Definition of Ready review.
12. Return to the Founder for a separate Release 1 / Slice 1 activation decision.

No code should begin before those gates are satisfied.

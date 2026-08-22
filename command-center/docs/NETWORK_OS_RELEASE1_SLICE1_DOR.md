# BHFOS Network OS — Release 1 / Slice 1 Definition of Ready

| Field | Value |
| --- | --- |
| Status | Draft — not ready for implementation |
| Version | 0.1 |
| Date | 2026-08-22 |
| Product | Network OS |
| Release | R1 — proposed |
| Slice | S1 — Customer Network + Service Need Foundation |
| Owner | Founder |
| Implementation authority | None |

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
- Network OS Decision Register — proposed decisions.
- Network OS Capability Disposition.
- Network OS Phase 1 Requirements Register.
- Network OS Phase 1 Workflow Map.
- Network OS Phase 1 Domain & Architecture Reconciliation.
- ADR-NOS-001 — Customer Hierarchy Model.
- ADR-NOS-002 — Service Need Authoritative Model.
- ADR-NOS-003 — Service Partner Identity & Lifecycle.
- ADR-NOS-004 — Qualification & Eligibility Model.

### Required before activation

- Founder ratification/activation of the Product Definition and decisions applicable to Slice 1.
- Founder approval of the Slice 1 requirements listed above.
- Active Release 1 / Slice 1 record.
- Architecture decisions for identity/RBAC/RLS, event/audit model, and legacy tenant compatibility sufficient for Slice 1.
- Experience & Design System Definition with canonical Slice 1 screens.
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
| Product Definition ratified | BLOCKED | Draft; founder activation required |
| Applicable decisions active | BLOCKED | Network OS decisions remain Proposed |

### B. Requirements

| Gate | Status | Evidence / blocker |
| --- | --- | --- |
| Requirement IDs exist | READY | REQ-NOS-P1-001/002/003/004/005/017/019/020 |
| Acceptance criteria exist | READY | Phase 1 Requirements Register |
| Requirements trace to workflow | READY | Phase 1 Workflow Map |
| Requirements trace to architecture | READY/PARTIAL | ADR-NOS-001/002 plus reconciliation; cross-cutting ADRs missing |
| Slice requirements founder-approved | BLOCKED | Explicit approval not yet recorded |

### C. Architecture

| Gate | Status | Evidence / blocker |
| --- | --- | --- |
| Customer hierarchy decision | READY FOR RATIFICATION | ADR-NOS-001 Proposed |
| Service Need decision | READY FOR RATIFICATION | ADR-NOS-002 Proposed |
| Domain boundaries defined | READY | Domain & Architecture Reconciliation |
| Identity / RBAC / RLS architecture | BLOCKED | ADR-NOS-010 required before implementation |
| Operational event / audit architecture | BLOCKED | ADR-NOS-008 required before implementation |
| Legacy `tenant_id` compatibility | BLOCKED | ADR-NOS-011 required before implementation |
| Exact target data model/schema | BLOCKED BY DESIGN | Created only after required ADRs and active slice authority |
| Migration/cutover plan | BLOCKED | Must map reused/new structures after target model is drafted |

### D. Experience / design

| Gate | Status | Evidence / blocker |
| --- | --- | --- |
| Premium product appearance is a governed requirement | READY AS FOUNDER DIRECTION | No ad hoc stylistic changes permitted |
| Network OS Experience & Design System Definition | BLOCKED | Must be created before implementation |
| Canonical Slice 1 desktop screens | BLOCKED | Customer/property, relationship, Service Need, basic home/list/detail |
| Canonical mobile visit screen | BLOCKED | Must validate one-minute capture target |
| Approved component/style tokens | BLOCKED | Typography, spacing, surfaces, tables, states, motion, iconography, color system |
| Ad hoc design-change prohibition in governance | BLOCKED | Must be recorded in design-system authority artifact |

### E. Security / data handling

| Gate | Status | Evidence / blocker |
| --- | --- | --- |
| Data classification baseline exists | READY | Phase 1 Requirements Register |
| Least-privilege role model | BLOCKED | ADR-NOS-010 |
| RLS/authorization test plan | BLOCKED | Follows ADR-NOS-010 and target schema |
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

## 7. Remaining blocking decisions

The slice is conceptually ready but not implementation-ready. The remaining blocking architecture decisions are:

### ADR-NOS-008 — Operational Event & Audit Model

Needed now because Slice 1 must preserve relationship visits, Service Need creation/status changes, actor/source, and later metric traceability without turning security audit logs into business history.

### ADR-NOS-010 — Identity / RBAC / RLS

Needed now to define who can create/edit customer/property relationships, Service Needs, visits, internal notes, and sensitive property/access information.

### ADR-NOS-011 — Legacy Tenant Compatibility

Needed now because copied components frequently query by `tenant_id`. Slice 1 must decide how Network OS remains securely BHIS-scoped without exposing tenant-selection/product behavior or accidentally coupling to Partner OS.

ADR-NOS-003 and ADR-NOS-004 are important for the next slice but do not block the core Customer Network + Service Need implementation once ratified, unless shared identity/security decisions depend on them.

## 8. Design gate added to Definition of Ready

Release 1 / Slice 1 may not enter implementation until an approved **Network OS Experience & Design System Definition** exists.

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

The shortest path to implementation readiness is:

1. Complete ADR-NOS-008 — Operational Event & Audit Model.
2. Complete ADR-NOS-010 — Identity / RBAC / RLS.
3. Complete ADR-NOS-011 — Legacy Tenant Compatibility.
4. Create and approve the Network OS Experience & Design System Definition and canonical Slice 1 screens.
5. Draft the exact Slice 1 target data model/migration plan.
6. Create the validation matrix and non-production environment declaration.
7. Ratify the Product Definition, decisions, ADRs, and Slice 1 requirements.
8. Activate Release 1 / Slice 1.

No code should begin before those gates are satisfied.

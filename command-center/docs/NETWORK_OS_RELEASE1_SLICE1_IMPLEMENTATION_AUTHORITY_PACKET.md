# BHFOS Network OS — Release 1 / Slice 1 Implementation Authority Packet

| Field | Value |
| --- | --- |
| Action ID | `NOS-R1-S1-IMPLEMENTATION-AUTHORITY-PACKET-01` |
| Status | Planner packet only — Release 1 / Slice 1 not activated; no product implementation authority |
| Version | 0.1 |
| Date | 2026-08-24 |
| Role | Independent Cursor cloud Release Planner |
| Product | Network OS |
| Proposed release | Release 1 |
| Proposed slice | Slice 1 — Customer Network + Service Need Foundation |
| Owner | Founder |
| Repository | `faydog127/BHFOS` |
| Baseline branch | `network-os/foundation` |
| Exact baseline HEAD | `326e7a2941b9333f341716fff199d6ef6c913b53` |
| Network OS product implementation authority | **None** |
| Release activation | **Inactive** |
| Planner verdict | `SLICE_1_IMPLEMENTATION_AUTHORITY_BLOCKED` |

> This is a documentation-only planner packet. It consolidates the existing
> Slice 1 readiness boundary at the exact baseline SHA. It does not invent
> product requirements, does not amend acceptance criteria, does not authorize
> coding, schema change, migration, environment mutation, deployment, merge,
> close, or activation, and does not rewrite governing artifacts that still
> conflict.

## Verdict

**`SLICE_1_IMPLEMENTATION_AUTHORITY_BLOCKED`**

Release 1 / Slice 1 remains inactive. Founder implementation authorization is
blocked until the material decisions in §9 are recorded. Hosted evidence
collection is complete enough to cite; unresolved metadata residuals remain
unproven; remaining product, design, architecture, schema/RLS, validation, and
environment gates from DOR v0.4 are still open.

This packet is **not** a Cursor implementation packet. Ratification packet
§12 step 6 still requires a later, separate Founder activation before any
implementation packet may be prepared.

---

## 1. Purpose and authority ceiling

This packet gives the Founder and later agents one controlled surface that:

1. states the exact included and excluded Slice 1 scope already ratified;
2. lists the governing requirement and decision IDs;
3. names the remaining material decisions that still block implementation
   authority;
4. records the treatment of documented metadata residuals;
5. states implementation, migration, deployment, and activation as **separate**
   boundaries;
6. returns one verdict.

It does **not**:

- implement Network OS product code or diagnostics code;
- access hosted systems or create credentials;
- migrate, deploy, close, or activate Slice 1;
- treat Command Center conversation state as a substitute for tracked
  repository authority;
- silently reconcile conflicting governing artifacts.

## 2. Exact-head verification

Required start SHA: `326e7a2941b9333f341716fff199d6ef6c913b53`
(`network-os/foundation`).

| Check | Result at planner open |
| --- | --- |
| Repository | `/workspace` → `faydog127/BHFOS` |
| Branch after checkout | `cursor/nos-r1-s1-implementation-authority-533d` created from the required SHA |
| HEAD after checkout | `326e7a2941b9333f341716fff199d6ef6c913b53` |
| HEAD subject | `Merge pull request #139 from faydog127/cursor/nos-i2-s1-governance-reconciliation-17b5` |
| Worktree at open | Clean |
| Evidence class | SOURCE-ONLY against tracked artifacts at this SHA |

Checkout matched the required SHA. Planner work after this section is
documentation only on the new branch.

## 3. Governing artifacts at this SHA

Authority for this packet is the tracked set below. Conversation, Command
Center operational labels, and untracked notes are not substitutes.

### 3.1 Binding Slice 1 readiness and ratification

| Artifact | Tracked status at baseline | Use in this packet |
| --- | --- | --- |
| `NETWORK_OS_RELEASE1_SLICE1_DOR.md` v0.4 | Active readiness gate — not ready for implementation; release not activated | Primary readiness gate |
| `NETWORK_OS_RELEASE1_SLICE1_FOUNDER_RATIFICATION_PACKET.md` v0.2 | Approved 2026-08-22; no implementation authority | Ratified boundary, requirements, ADRs, design direction |
| `NETWORK_OS_FIELD_VISIT_CLOSEOUT_FOUNDER_DIRECTION.md` | Active product/requirements direction; implementation not authorized | REQ-NOS-P1-021 / DEC-NOS-017/018 source |
| `NETWORK_OS_PRODUCT_DEFINITION.md` | Active product direction | Product identity only |
| `NETWORK_OS_DECISION_REGISTER.md` v0.3 | Slice 1-applicable decisions Active; later decisions Proposed | Decision IDs |
| `NETWORK_OS_PHASE1_REQUIREMENTS_REGISTER.md` v0.3 | Slice 1 requirements approved; remaining Phase 1 Proposed | Requirement IDs and existing acceptance criteria |
| `NETWORK_OS_PHASE1_WORKFLOW_MAP.md` v0.2 | Active workflow direction; implementation not authorized | Slice 1 workflow stages A–B only |
| `NETWORK_OS_PHASE1_DOMAIN_ARCHITECTURE_RECONCILIATION.md` v0.2 | Active direction; exact designs pending | Domain posture; remaining architecture list is challenged in §8 |
| `NETWORK_OS_EXPERIENCE_DESIGN_SYSTEM.md` | Active direction; exact tokens and screen references pending | Design gates |
| `NETWORK_OS_CAPABILITY_DISPOSITION.md` v0.2 | **Draft** — planning evidence only | Inventory only; not Active authority |
| `NETWORK_OS_RELEASE1_SLICE1_LEGACY_DEPENDENCY_INVENTORY.md` v0.1 | SOURCE-ONLY complete; hosted verification still required by its own §§11–13 | Source inventory; hosted claims challenged in §8 |
| ADR-NOS-001, 002, 008, 010, 011 | Active — founder ratified 2026-08-22; implementation gates unsatisfied | Architecture direction |
| ADR-NOS-003, 004 | Proposed | Later Service Partner slice; not Slice 1 authority |

### 3.2 Diagnostics evidence (cited; no secrets; no raw hosted payloads)

| Artifact / packet | Recorded result cited by DOR v0.4 §13.1 | Classification |
| --- | --- | --- |
| Stage B `STAGE_B_METADATA_COMPLETE` | 11 identified relations all PRESENT at `f5f0a14` | HOSTED METADATA COLLECTED |
| Stage B `catalog_constraints` | present count=0 | HOSTED METADATA COLLECTED; CONSTRAINT/FK UNRESOLVED |
| Stage C aggregate capability | Merged through PR #138; foundation tip `2a7cca80c3333edc88151273c4ba1d779eb7d1b2` | MERGED |
| Stage D `STAGE_D_AGGREGATES_COMPLETE` | 100/100 approved aggregate operations at `2a7cca80` | HOSTED AGGREGATES COLLECTED |
| Unexecuted `STAGE_C_METADATA_GAP` families | Remain unresolved | UNRESOLVED |
| `OAUTH_REVOCATION_VERIFIED` | JSON POST `/v1/oauth/revoke` HTTP 204 | REVOCATION VERIFIED |
| Closeout audit | `SLICE_1_EVIDENCE_READY_FOR_FOUNDER_CLOSEOUT` | EVIDENCE CAMPAIGN ONLY; DOR says Founder closeout not recorded |
| `NOS-R1-S1-I2-CAP-01` Revision 1 | Founder-approved diagnostics capability packet | Diagnostics only; no product implementation authority |

The 11 identified public Slice 1 candidate relations, from
`NOS-R1-S1-I2-CAP-01` §4 and the legacy inventory, are:

`organizations`, `accounts`, `contacts`, `properties`, `leads`,
`services_catalog`, `price_book`, `events`, `crm_tasks`, `app_user_roles`,
`tenants`.

**Do not treat those 11 PRESENT relations as 100 objects.**
**Do not treat 100/100 Stage D operations as execution of omitted constraint/FK
or `STAGE_C_METADATA_GAP` families.**

### 3.3 Command Center claim cited by this assignment

This assignment states that Founder closeout of the evidence campaign is now
complete per Command Center `CAMPAIGN_TEARDOWN_COMPLETE`, and that R1/S1 remains
inactive.

Tracked DOR v0.4 at this SHA still says Founder closeout has **not** been
recorded. No tracked artifact at this SHA contains the string
`CAMPAIGN_TEARDOWN_COMPLETE`. This planner did not access hosted systems and
did not inspect secret values.

That conflict is recorded in §8. It is not silently closed.

## 4. Exact included Slice 1 scope

Source: ratification packet §4 (APPROVED 2026-08-22) and DOR v0.4 §§2–3.

### 4.1 Objective

Establish the minimum authoritative Network OS foundation needed for BHIS
customer relationship and demand management **before** Service Partner
coordination is implemented.

### 4.2 Operating path

**Organization / Portfolio / Property / Contact → Relationship → Visit /
Follow-up → Service Need → Service Catalog linkage → authoritative event
history → basic operational visibility**

### 4.3 In-scope requirements

| ID | Controlled Slice 1 interpretation already approved |
| --- | --- |
| REQ-NOS-P1-001 | Organization → optional Portfolio/Region → Property/Facility hierarchy with stable identities and integrity rules |
| REQ-NOS-P1-002 | BHIS relationship owner, relationship state, follow-up, context, and durable history |
| REQ-NOS-P1-003 | Purpose-built mobile property visit capture; ordinary factual capture ≈ one minute |
| REQ-NOS-P1-004 | Authoritative Service Need distinct from work, with durable demand lineage and governed lifecycle |
| REQ-NOS-P1-005 | Governed Service Catalog / Taxonomy, **limited to the functionality required by this slice** |
| REQ-NOS-P1-017 | Communications and accountability event history, **limited to relationship/visit/Service Need events required by this slice** |
| REQ-NOS-P1-019 | Authoritative state, audit, and role boundaries, **limited to the active slice domains** |
| REQ-NOS-P1-020 | Phase 1 usability and low-friction participation, **limited to BHIS internal/mobile workflows in this slice** |
| REQ-NOS-P1-021 | Field visit closeout and next-action automation, including the 2–3 minute closeout SLA and no end-of-day CRM cleanup |
| REQ-NOS-P1-018 | **Limited contribution only**: simple Slice 1 queues/counts supported by authoritative Slice 1 data. Full Phase 1 dashboards remain later work |

Workflow-map coverage for this slice is **stage A** (relationship / visit /
closeout) and **stage B only to the extent of Service Need capture, catalog
linkage, and status recording**. Creating executable work, Service Partner
capacity development as an operating engine, quotes, and later Phase 1 stages
C–O are not Slice 1 implementation scope.

REQ-NOS-P1-004 may persist later status labels
(`Service Partner Capacity Needed`, `Quote Requested`, and similar) as
**recorded demand states**. Those labels are not authorization to implement
Service Partner matching, quoting, or Work Orders in Slice 1.

## 5. Exact excluded Slice 1 scope

Source: DOR v0.4 §4 and ratification packet §4. These remain out of scope
even if later Phase 1 requirements or the full workflow map mention them.

- Service Partner prospecting, onboarding, lifecycle, capability, geography,
  or qualification.
- Deterministic eligibility, matching, work offers/acceptance, or assignment.
- Managed-service Work Orders, scheduling, dispatch, execution, or completion
  evidence.
- Exception queue beyond errors directly necessary for Slice 1 integrity.
- Customer or Service Partner portals.
- Partner OS integration or runtime TIS dependency.
- AI matching or autonomous material actions.
- Pricing, quotes, invoicing, payments, or network economics.
- Territory maps or advanced reporting.
- Generic multi-tenant SaaS, tenant switching, or per-tenant branding.
- Implementation of future ALF, group-home, commercial, institutional, or
  government-specific extensions.
- Full Phase 1 dashboards (REQ-NOS-P1-018 beyond simple Slice 1 queues/counts).
- Diagnostics control-plane work beyond the already-closed evidence campaign
  (no new hosted collection, credentials, or adapter product features).
- Production mutation, customer email in production, migration apply, deploy,
  merge of product code, or Release 1 / Slice 1 activation.

ADR-NOS-003 and ADR-NOS-004 remain Proposed and are intended for a later
Service Partner Network / Qualification slice. They do not authorize Slice 1
work and do not become Slice 1 blockers unless a later detailed design proves
a material dependency, which must return to the Command Center (DOR v0.4 §7).

## 6. Governing requirement and decision IDs

### 6.1 Active decisions that govern Slice 1

DEC-NOS-001, DEC-NOS-002, DEC-NOS-003, DEC-NOS-004, DEC-NOS-005, DEC-NOS-006,
DEC-NOS-007, DEC-NOS-012, DEC-NOS-014, DEC-NOS-015, DEC-NOS-016, DEC-NOS-017,
DEC-NOS-018.

DEC-NOS-016 describes the **full Phase 1 loop**. It is Active product
direction and **does not** by itself authorize an implementation release or
expand Slice 1 to Service Partner / work-coordination scope.

### 6.2 Proposed decisions that do **not** govern Slice 1 implementation

DEC-NOS-008, DEC-NOS-009, DEC-NOS-010, DEC-NOS-011, DEC-NOS-013.

### 6.3 Active architecture decisions with unsatisfied implementation gates

| ADR | Active direction | Unsatisfied implementation gate |
| --- | --- | --- |
| ADR-NOS-001 | Customer hierarchy model | Exact reused/new records, uniqueness, parent-child constraints, migration, RLS/access, tests for REQ-NOS-P1-001–003 |
| ADR-NOS-002 | Service Need authoritative model | Exact fields, lifecycle transitions, conversion permissions, Work Order linkage boundary, reasons, events, migration, RLS/access, tests for REQ-NOS-P1-004 |
| ADR-NOS-008 | Operational event and audit model | Slice 1 taxonomy/versioning, write ownership, required events, retention/access, sensitive-metadata controls, tests for REQ-NOS-P1-017/019/021 |
| ADR-NOS-010 | Identity, RBAC, and RLS | Slice 1 permission matrix, record/data scopes, restricted-field handling, RLS policies, service identities, authorization tests, privileged-action audit; plus REQ-NOS-P1-021 send/approve/retry/view rules |
| ADR-NOS-011 | Legacy tenant compatibility | Touched `tenant_id` inventory for the slice, canonical BHIS compatibility scope, RLS implications, prohibited tenant UX, migration handling, isolation tests |

### 6.4 Diagnostics decision that does **not** confer product authority

`NOS-R1-S1-I2-CAP-01` authorizes the staged diagnostics evidence campaign only.
It does not activate Release 1 / Slice 1 and does not authorize product
implementation.

## 7. What is already decided versus what remains blocked

DOR v0.4 §6 remains the readiness checklist. This packet does not change those
statuses. Summary at baseline:

| Area | Ready now | Still blocked |
| --- | --- | --- |
| Product identity, Slice 1 outcome, Product Definition ratification | READY | No Active Release 1 / Slice 1 record; no implementation authority |
| Requirement IDs, requirement-level acceptance criteria, founder approval of Slice 1 requirements | READY | Exact field/lifecycle/transaction designs still missing |
| ADR existence and ratification for 001/002/008/010/011 | READY | Each ADR implementation gate unsatisfied |
| Experience system direction and Tailgrids hierarchy | READY | Exact tokens and canonical screen references |
| SOURCE-ONLY legacy inventory | READY — SOURCE-ONLY | Hosted constraint/FK and metadata-gap families unresolved; exact target model not drafted |
| Hosted schema/RLS/data-quality **collection** | COLLECTED (DOR §13.1) | Founder closeout **not recorded in DOR**; residuals unresolved |
| Exact target data model / migration plan | BLOCKED | Must be drafted without treating unproven FKs as proven |
| Permission/RLS design and authorization test plan | BLOCKED | |
| Restricted-field and test-data isolation | PARTIAL | Exact rules and environment plan pending |
| Authorized non-production environment | BLOCKED | Must be selected/declared |
| Training/synthetic data strategy | BLOCKED | |
| Requirement-to-test matrix, mobile usability, closeout SLA proof, duplicate/hierarchy/Need/RLS tests | BLOCKED | Depend on the missing designs |
| Production mutation | READY AS GOVERNANCE — no production authority exists | |

DOR current assessment: **NOT READY FOR IMPLEMENTATION.** This planner
concurs.

## 8. Challenged conflicts (not silently reconciled)

These conflicts remain open. This packet records both sides. It does not pick
a winner and does not rewrite the older artifact.

| ID | Artifact A | Artifact B | Conflict | Planner treatment |
| --- | --- | --- | --- | --- |
| C-01 | This assignment / Command Center `CAMPAIGN_TEARDOWN_COMPLETE` | DOR v0.4 header, §6.C hosted-evidence row, §13, §13.1 closeout audit | Assignment says Founder evidence-campaign closeout is complete. DOR v0.4 at this SHA says Founder closeout has not been recorded and next path step 1 is that recording. `CAMPAIGN_TEARDOWN_COMPLETE` is not a tracked string at this SHA | **Challenged.** Command Center teardown is an operational claim cited by the assignment. Tracked DOR remains the repository authority and still says closeout is unrecorded. This packet does not convert the Command Center label into a DOR closeout record. R1/S1 inactivity is agreed by both |
| C-02 | DOR v0.4 §9 canonical screens (8 contracts, including a separate Contact relationship treatment) | Ratification packet §10 and Experience System §27 (7 contracts; Contact is not a separate screen) | Screen-count and Contact-screen contract disagree | **Challenged.** Canonical-screen approval must name which list is authoritative. This packet does not collapse 8 into 7 |
| C-03 | Requirements Register acceptance criteria for REQ-NOS-P1-017, 018, 019, 020 | Ratification packet §8 controlled interpretations and DOR §§3–4 | Register ACs still mention Service Partner communications, work offers, work orders, qualification, and Service Partner response UX. Controlled Slice 1 interpretations limit those requirements to relationship/visit/Service Need, simple queues/counts, and BHIS internal/mobile workflows | **Challenged.** Slice 1 implementation, if later authorized, is bound by the **controlled interpretations**, not by the broader Phase 1 AC text. The register text is not amended here |
| C-04 | REQ-NOS-P1-005 applicable decisions include DEC-NOS-008 and DEC-NOS-009 | Decision Register: DEC-NOS-008/009 remain Proposed | An Active Slice 1 requirement cites Proposed Service Partner decisions | **Challenged.** Catalog-for-Slice-1 remains in scope. Service Partner capability association in the register AC is not Slice 1 implementation scope |
| C-05 | Domain Architecture §13–16 | DOR v0.4 §7 and ratification | Domain Architecture still lists ADR-NOS-003–007, 009, 012 as required before implementation and still says the next step is to produce ADR-003/004 before a DOR can be assembled. DOR exists (v0.4) and states 003/004 do not block this slice unless a material dependency appears | **Challenged.** Slice 1 architecture gates are ADR-001/002/008/010/011 plus exact designs. Later ADRs remain later-slice work unless a new material dependency is proven |
| C-06 | Domain Architecture §14 first-slice list | DOR / REQ-NOS-P1-021 / DEC-NOS-017 | First-slice recommendation omits field-visit closeout / next-action automation | **Challenged.** Founder-directed REQ-NOS-P1-021 is in Slice 1 scope. The older first-slice list is not used to drop it |
| C-07 | Legacy Dependency Inventory §§11–13 | DOR v0.4 §13.1–13.2 | Inventory still says hosted evidence is missing and next action is first collection. DOR cites Stage B/D collection complete, with residuals | **Challenged.** Collection status is superseded by DOR v0.4. Inventory remains SOURCE-ONLY. Eleven PRESENT relations plus 100/100 aggregates do **not** close hosted inventory verification while `catalog_constraints` present count=0 and `STAGE_C_METADATA_GAP` families remain unresolved |
| C-08 | Capability Disposition status **Draft** | DOR §5 lists it as Present | Presence is not ratification | **Challenged.** Draft disposition is planning evidence only |
| C-09 | Workflow Map status “Active direction for Release 1 / Slice 1 stages” | Workflow Map stages C–O and DOR §4 | The map contains the full Phase 1 loop; Slice 1 excludes Service Partner and work-coordination stages | **Challenged.** Only stages A and limited B apply to Slice 1 |
| C-10 | Requirements Register `Release` field = None on Slice 1 requirements | DOR / ratification treat those requirements as the Slice 1 baseline | No Active Release 1 / Slice 1 record exists | **Not a silent close.** This is an existing DOR activation gate, not a new product requirement |
| C-11 | Historical attempt / I2 authorization / secret-inventory / provisioning-checklist text | DOR v0.4 §13.2 | Older artifacts still describe pre-collection or pre-revocation state | Already challenged by DOR. This packet does not rewrite them |

DOR v0.4 already forbids treating `SLICE_1_EVIDENCE_READY_FOR_FOUNDER_CLOSEOUT`
as Founder closeout, activation, or implementation authority. This packet
repeats that prohibition. Command Center `CAMPAIGN_TEARDOWN_COMPLETE` does not
override it in the repository.

## 9. Remaining material decisions

Only these decision clusters still block Founder implementation authorization.
Routine drafting after a decision is not listed as a separate Founder decision
unless the governing ADR/DOR names it as a gate.

### 9.1 Product

| Decision | Why it is material | Governing IDs |
| --- | --- | --- |
| P-01. Record or refuse Command Center `CAMPAIGN_TEARDOWN_COMPLETE` as the Founder evidence-campaign closeout **in a tracked artifact** | DOR path step 1 is unrecorded closeout; assignment claims closeout is complete. Until recorded, repository authority and Command Center disagree | DOR v0.4 §13; C-01 |
| P-02. Exact Service Need fields, allowed lifecycle transitions, reasons/outcomes, permissions, and the Slice 1 boundary that records later statuses without implementing work/quotes/partners | ADR-002 implementation gate; REQ-004 AC names later states “subject to later state-machine normalization” | ADR-NOS-002; REQ-NOS-P1-004; DEC-NOS-007 |
| P-03. Field-closeout transaction policy: auto-send versus one-tap approval; sent/queued/failed recovery; promised-action ownership; interrupted/offline draft rules; voice-to-text permission/retention/correction | REQ-021 blockers; DEC-017; ADR-008/010 closeout clauses | REQ-NOS-P1-021; DEC-NOS-017/015; ADR-NOS-008/010 |
| P-04. Which simple queues/counts are the approved REQ-018 Slice 1 contribution | Full register AC is Phase 1; controlled interpretation is limited | REQ-NOS-P1-018; C-03 |
| P-05. Resolve C-03 (register AC versus controlled interpretation) so implementers are not handed two requirement texts | Otherwise Slice 1 can silently expand into Partner/work scope | REQ-NOS-P1-017/018/019/020; ratification §8 |

No new product requirements are introduced. P-02 through P-05 are the exact
designs the existing Active requirements already demand.

### 9.2 Design

| Decision | Why it is material | Governing IDs |
| --- | --- | --- |
| D-01. Approve exact Black Horse / Network OS tokens (typography, spacing/grid, surfaces, color roles, radius/elevation, iconography, control/table density, motion, mobile touch, accessibility) | Experience system §28 and DOR §6.D | Experience System; DOR §8 |
| D-02. Approve canonical Slice 1 visual/interaction references, after resolving C-02 (7 versus 8 screen contracts) | DOR §9; Experience System §27; ratification §10 | Same |
| D-03. Approve governed Tailgrids component adaptations required by those screens | Ad hoc styling is prohibited | Experience System authority rule |

### 9.3 Architecture

| Decision | Why it is material | Governing IDs |
| --- | --- | --- |
| A-01. Exact Slice 1 domain/data model: reuse versus new for `organizations` / `accounts` / `contacts` / properties; Portfolio/Region and Property/Facility representation; uniqueness/dedup; contextual contact roles; relationship ownership/status; visit/follow-up/promised-action model; outbox/idempotency boundary | DOR §10; ADR-001/002 gates; Domain Architecture remains exact-design pending | ADR-NOS-001/002; REQ-NOS-P1-001–004/021 |
| A-02. Slice 1 operational-event taxonomy, versioning, write ownership, required events, retention/access, sensitive-metadata controls | ADR-008 gate | ADR-NOS-008; REQ-NOS-P1-017/019/021 |
| A-03. Canonical BHIS `tenant_id` compatibility scope, touched-dependency inventory, prohibited tenant UX, and isolation tests | ADR-011 gate; source conflict `tvg` versus `default` is already inventoried | ADR-NOS-011; DEC-NOS-014 |
| A-04. Confirm ADR-003/004/005–007/009/012 remain **out** of Slice 1 unless a proven material dependency appears | C-05 | DOR §7 |

### 9.4 Schema / RLS

| Decision | Why it is material | Governing IDs |
| --- | --- | --- |
| S-01. Treatment of unresolved residuals: `catalog_constraints` present count=0 / unproven FKs, and unexecuted `STAGE_C_METADATA_GAP` families (see §10) | DOR forbids guessing join/constraint paths. Target model and migration cannot claim proven relationships those families did not prove | DOR §13; Stage C §10.3 |
| S-02. Exact target schema, constraints, and additive migration/cutover/rollback plan after S-01 | DOR §6.C exact model and migration rows are BLOCKED | ADR-NOS-001/002/011 |
| S-03. Slice 1 permission matrix, record/data scopes, restricted-field strategy, RLS policies, service identities, privileged-action audit | ADR-010 gate; DOR §6.E BLOCKED | ADR-NOS-010; REQ-NOS-P1-019/021 |

### 9.5 Validation

| Decision | Why it is material | Governing IDs |
| --- | --- | --- |
| V-01. Requirement-to-test validation matrix mapping each **controlled** Slice 1 AC to owner, method, and environment | DOR §6.G BLOCKED | DOR §11; Requirements Register |
| V-02. Mobile usability protocol for the one-minute capture and the ≤3-minute ordinary closeout | DOR §6.G; REQ-003/021 | Same |
| V-03. Security/RLS positive and negative test plan, including restricted property/access data and synthetic-data isolation | ADR-010; DOR §6.E–G | ADR-NOS-010/011 |

### 9.6 Environment

| Decision | Why it is material | Governing IDs |
| --- | --- | --- |
| E-01. Declare the authorized non-production Network OS environment and its access/data boundary | DOR §6.F BLOCKED | DOR §12 item 8 |
| E-02. Synthetic/training-data identification, isolation, cleanup, and non-confusion with production | DOR §6.F; REQ-019 | Same |

### 9.7 Explicitly **not** a remaining product-requirement decision

- Inventing additional Slice 1 requirements.
- Activating Service Partner, Work Order, pricing, portal, or Partner OS work.
- Re-running hosted diagnostics or creating credentials.
- Treating 11 PRESENT relations as complete object coverage.
- Treating 100/100 Stage D ops as omitted `STAGE_C_METADATA_GAP` families.
- Equating this planner packet with Founder activation.

Work-item mapping and an implementation branch/worktree are DOR §12 items 11
and remain **after** the decisions above, not instead of them.

## 10. Treatment of documented metadata residuals

### 10.1 Binding residual facts

From DOR v0.4 §13.1 and Stage C evidence §10.3:

1. **11 identified relations PRESENT** at Stage B SHA `f5f0a14`. This is
   relation-existence evidence for those 11 names. It is **not** 100-object
   coverage and is **not** proof of constraints, FKs, grants completeness, or
   row semantics.
2. **`catalog_constraints` present count=0.** Source-column →
   target-table.target-column paths are **unproven**.
   `fk_target_paths_unproven` remains a `STAGE_C_METADATA_GAP`.
3. **Stage D 100/100** counts approved aggregate operations that were
   executed. It does **not** execute omitted families.
4. Unexecuted `STAGE_C_METADATA_GAP` families remain unresolved:

| gap_id | Family | Objects | Missing capability |
| --- | --- | --- | --- |
| `scope_quality_no_tenant_column` | scope quality | `organizations`, `accounts`, `services_catalog`, `app_user_roles`, `tenants` | Stage B proved no tenant/scope column |
| `scope_quality_properties_unproven` | scope quality | `properties` | Tenant/scope column not proven; `properties.tenant_id` was not guessed |
| `fk_target_paths_unproven` | orphan-reference | all Slice 1 objects | `catalog_constraints` empty; FK target paths unproven |
| `hierarchy_join_paths_unproven` | hierarchy coverage | `organizations`, `accounts`, `properties`, `contacts`, `leads` | Local FK columns exist; joined hierarchy omitted |
| `catalog_price_book_reconciliation_unproven` | catalog reconciliation | `services_catalog`, `price_book` | Overlap / stable-reference join keys unproven |
| `app_user_roles_tenant_binding_unproven` | identity/scope integrity | `app_user_roles` | No `tenant_id`; tenant-binding omitted |
| `events_payload_expression_uniques` | duplicate quality | `events` | Payload JSON unique indexes are not typed columns |
| `required_field_nullability_incomplete` | required-field quality | all Slice 1 objects | `is_nullable=NO` proved only for `contacts.tenant_id`, `leads.tenant_id`, and `app_user_roles.user_id` |

### 10.2 Required treatment

- Keep these residuals **unresolved** until a later **authorized diagnostics**
  decision. Do not guess join or constraint paths (DOR v0.4 §13.3 item 2).
- Drafting a target model from **source plus hosted evidence that was
  actually collected** is allowed as readiness work. That draft must mark
  unproven relationships as unproven.
- Hosted metadata collection is **not** Slice 1 permission/RLS design, **not**
  exact target-model approval, and **not** ADR-NOS-011 hosted-dependency
  closeout (DOR v0.4 §13.2).
- `price_book` evidence does not make pricing/price-book a Slice 1 product
  domain. Catalog linkage for demand capture remains the Slice 1 catalog
  need.
- `leads` PRESENT does not make `leads` the authoritative customer or Service
  Need record (ADR-NOS-001/002; inventory executive finding 4).
- Campaign token-key names/status remain names-only. This packet does not
  inspect or request secret values.

## 11. Implementation boundaries and permitted file areas

### 11.1 This planner packet (now)

Permitted:

- `command-center/docs/NETWORK_OS_RELEASE1_SLICE1_IMPLEMENTATION_AUTHORITY_PACKET.md`
- ordinary documentation-branch commit and DRAFT PR against
  `network-os/foundation`

Forbidden in this action:

- product application code under `command-center/src/` or elsewhere;
- diagnostics adapter or I2 control-plane code;
- migrations, RLS SQL, seed data, environment config, secrets;
- `command-center/build-out.txt` (never modify, ignore, stage, or commit);
- acceptance-criteria edits in the Requirements Register, DOR, ADRs, or
  workflow map;
- hosted access, credential creation, campaign re-open, deploy, merge,
  close, or activation.

### 11.2 Later product implementation (not authorized)

No product file area is currently authorized. If, and only if, the Founder
later (a) records the remaining §9 decisions, (b) completes DOR review, and
(c) **separately activates** Release 1 / Slice 1, a later implementation
packet may propose a bounded fileset. Until then, the following is
**inventory guidance only**, drawn from the legacy inventory and domain
architecture:

Candidate later **read/adapt** surfaces (not copy-as-authority):

- `command-center/src/pages/crm/ContactsPage.jsx`
- `command-center/src/pages/crm/ServiceCatalog.jsx`
- organization/contact UI and generic notes/activity patterns
- communication infrastructure (`emailService` and related) as adapter
  mechanics only
- `command-center/src/contexts/SupabaseAuthContext.jsx`,
  `command-center/src/lib/tenantUtils.js` as identity/scope inventory

Must **not** become Slice 1 authority or primary navigation:

- `command-center/src/pages/crm/Leads.jsx` and lead-as-customer flows
- ML-P1 quote/job/invoice/payment services
- `TenantSwitcher` / URL-selected tenant as product behavior
- `price_book` as protected Network OS taxonomy
- Partner OS, payroll, technician dispatch, marketing, referral-partner
  systems
- diagnostics adapter (`command-center/tools/supabase-diagnostics-adapter/`)

Any later schema work would be a **separate migration authorization**, not an
implication of implementation authorization. See §13.

## 12. Acceptance tests and completion criteria

This section **documents** existing criteria. It does not add, remove, or
rewrite them.

### 12.1 Requirement-level acceptance criteria (already written)

Implementers, when later authorized, must use the acceptance criteria already
printed in `NETWORK_OS_PHASE1_REQUIREMENTS_REGISTER.md` **as limited by** the
controlled Slice 1 interpretations in the ratification packet §8 and DOR
§§3–4 (conflict C-03).

- REQ-NOS-P1-001 — hierarchy create/view/edit/relate; property parent;
  multi-context contacts; searchable parent/child navigation.
- REQ-NOS-P1-002 — owner, status, last/next contact, preferences, vendor
  context, follow-up queue, durable history.
- REQ-NOS-P1-003 — one-minute ordinary factual capture; optional need /
  follow-up / photo / contact / Service Need; no office-CRM layout.
- REQ-NOS-P1-004 — create from context or visit; required demand fields;
  reportable Need; may exist without a work order.
- REQ-NOS-P1-005 — governed identifiers for Slice 1 demand/catalog linkage
  only; Partner-capability association is later-slice text.
- REQ-NOS-P1-017 — Slice 1 relationship/visit/Need events with
  actor/source/time; adapters do not overwrite authority; no unnecessary
  sensitive duplication.
- REQ-NOS-P1-018 — simple queues/counts from authoritative Slice 1 data only.
- REQ-NOS-P1-019 — authoritative ownership for implemented Slice 1 domains;
  least privilege; RLS tests before production use; synthetic data isolation.
- REQ-NOS-P1-020 — BHIS internal/mobile low-friction workflows only.
- REQ-NOS-P1-021 — ≤3-minute ordinary closeout; next-action states; sent /
  queued / failed truthfulness; no end-of-day duplicate CRM cleanup;
  TIS-independent native workflow.

### 12.2 DOR proposed validation categories (already written)

DOR v0.4 §11 remains the validation-category list. It is not a completed
matrix. V-01 must map these categories to tests after the missing designs
exist.

### 12.3 Release 1 / Slice 1 Ready criteria (already written)

DOR v0.4 §12. All must be true before the release is **Ready**. Item 12 is a
**separate** Founder activation:

1. Product Definition Active.
2. Applicable decisions Active.
3. Slice 1 requirements explicitly approved.
4. ADR-NOS-001 and ADR-NOS-002 Active.
5. ADR-NOS-008, 010, 011 Active or otherwise explicitly satisfied.
6. Experience system approved **and** canonical Slice 1 screens approved.
7. Target data model and migration plan reviewed.
8. Authorized non-production environment declared.
9. Security/RLS validation plan complete.
10. Requirement-to-test matrix complete.
11. Work items and implementation branch/worktree identified.
12. Founder explicitly activates Release 1 / Slice 1.

Items 1–5 (artifact existence + ratification) are done. Items 6–12 are not.
Items 6–11 are the §9 design/environment/validation decisions. Item 12 is
activation, not implementation authorization by this packet.

### 12.4 Completion criteria for **this** planner action

This action is complete when:

- the consolidated packet exists on a documentation branch from exact SHA
  `326e7a2941b9333f341716fff199d6ef6c913b53`;
- one verdict is recorded;
- remaining blockers are only the material decisions in §9;
- one DRAFT PR is opened against `network-os/foundation`;
- no product code, diagnostics code, hosted access, credentials, migration,
  deploy, close, or activation occurred.

## 13. Separate boundaries — implementation, migration, deployment, activation

These four actions are not implied by one another. Each needs its own later
explicit authorization.

| Boundary | What it would authorize | Current state | May be implied by this packet? |
| --- | --- | --- | --- |
| **Implementation** | Bounded product coding against an activated release, after DOR gates and a later implementation packet | **None.** DOR: not ready; this verdict: BLOCKED | No |
| **Migration** | Create and/or apply schema/data migrations, including RLS SQL | **None.** Target model not drafted; residuals unproven; apply is a separate Founder/Category-C action | No |
| **Deployment** | Ship an approved SHA to any hosted Network OS environment | **None.** No authorized Network OS non-production environment is declared; production mutation is blocked | No |
| **Activation** | Founder moves Release 1 / Slice 1 to Active after DOR review | **Inactive.** Ratification and diagnostics closeout claims do not activate the release | No |

Related but distinct:

| Adjacent action | Current state |
| --- | --- |
| Diagnostics evidence campaign | Collection cited complete; DOR Founder closeout unrecorded; Command Center teardown claimed (C-01); campaign must not be re-opened by this packet |
| Merge of **this** docs PR | Ordinary review; does not activate Slice 1 |
| Merge of later product PRs | Requires activation + implementation authority + review/CI |
| Production | No authority |

Local commit ≠ remote write ≠ merge ≠ deploy ≠ activate.

## 14. Verdict (restated)

**`SLICE_1_IMPLEMENTATION_AUTHORITY_BLOCKED`**

Material decisions still required before Founder implementation authorization
can be considered:

1. **P-01** — Record or refuse Command Center `CAMPAIGN_TEARDOWN_COMPLETE` as
   tracked Founder evidence-campaign closeout (C-01). Repository DOR v0.4
   still says closeout is unrecorded.
2. **S-01** — Keep `catalog_constraints` present count=0 / unproven FKs and
   unexecuted `STAGE_C_METADATA_GAP` families unresolved; decide that any
   target model must treat them as unproven.
3. **A-01 / S-02 / P-02 / P-03** — Exact Slice 1 data model, Service Need
   lifecycle, and field-closeout transaction/approval/communication design.
4. **A-02 / S-03** — Exact Slice 1 event taxonomy and permission/RLS /
   restricted-field design.
5. **A-03** — Canonical BHIS compatibility scope and touched `tenant_id`
   handling.
6. **D-01 / D-02 / D-03** — Exact tokens, governed components, and canonical
   screens after resolving 7-versus-8 (C-02).
7. **P-04 / P-05** — Limited REQ-018 queues/counts and register-versus-
   controlled-interpretation conflict (C-03).
8. **V-01 / V-02 / V-03** — Validation matrix, mobile/closeout protocol, RLS
   test plan.
9. **E-01 / E-02** — Non-production environment declaration and
   synthetic/training-data strategy.
10. **Activation (separate)** — After the above and a final DOR review, a
    distinct Founder activation of Release 1 / Slice 1. That activation is
    still **not** this packet and is still **not** a migration or deploy
    grant.

Until those decisions exist, no Cursor implementation packet should be
prepared. Remaining readiness drafting (design tokens, model drafts, test
matrix) is governance/design work, not product implementation, and still
requires the decisions above rather than coding.

## 15. Explicit non-authorization

This packet does not authorize:

- application or database implementation;
- code generation or a Cursor implementation assignment;
- schema creation or modification;
- migrations or data movement;
- RLS or authorization-policy deployment;
- hosted diagnostics, OAuth, or credential creation;
- environment creation or mutation;
- Service Partner, matching, qualification, offers, work coordination,
  invoicing, or Partner OS integration;
- customer communications;
- branch merge, deployment, staging apply, or production action;
- Release 1 / Slice 1 activation;
- closing the DOR Founder-closeout row by implication.

Implementation authority remains **None**.

## 16. Exact next action

1. Founder or Command Center records a tracked treatment of C-01
   (`CAMPAIGN_TEARDOWN_COMPLETE` versus DOR “closeout not recorded”).
2. Keep residuals unresolved (S-01).
3. Produce the remaining §9 design artifacts as **docs-only readiness work**.
4. Independent DOR review at the then-current head.
5. Separate Founder activation decision.
6. Only after activation, a bounded implementation packet.

No Network OS product code should begin before those gates. The closed
diagnostics campaign does not activate or implement the product.

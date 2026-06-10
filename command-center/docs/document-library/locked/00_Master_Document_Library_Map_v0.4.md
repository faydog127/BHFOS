# 00 — Master Document Library Map
**BHFOS / The Vent Guys**
**Status:** ✅ Locked v0.4
**Owner:** Lead Systems Architect
**Last Updated:** 2026-04-10

---

## CHANGELOG

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| v0.1 | 2026-04-10 | Lead Architect | Initial draft. 12-bucket structure reviewed. 21 documents mapped. |
| v0.2 | 2026-04-10 | Lead Architect | 3-pass internal review + external review applied. Added `04b`, `05b`, `08b`, `08c`, `10b`, `12b`. Fixed 20 internal issues. Corrected dependency matrix. Added Owner + Status columns. Fixed governance paradox. Corrected lock criteria language. 26 documents. |
| v0.3 | 2026-04-10 | Lead Architect | Operator-level critique applied. Added `00b` (System Behavior Spec), `04c` (Audit Trail Spec), `05c` (Document Authority Hierarchy). Added State Enforcement Matrix requirement to `04b`. Bound `08b`/`08c` to finding-level data layer. Updated dependency matrix. 29 documents. |
| v0.4 | 2026-04-10 | Lead Architect | Applied `00b` v1.2 inserts. Updated `03` with full Asset/Zone entity hierarchy + 3 new runtime objects + `evidence_class` attribute. Added `04b` dependency on `00b`. Updated `09` upstream to include `00b`. Assigned tombstone classes to all `11a–11h`. Updated gate conditions for `04b`, `04`, `07`, `09`, `04c`. Added 6 V-series critique items to Section A. |

---

## SECTION A — STRUCTURAL CRITIQUE RECORD

> Complete history of holes identified, addressed, and closed. Every version's issues are preserved. Nothing is silently patched.

---

### v0.1 → v0.2: Internal Review (Rounds 1–3) — 20 Items

> Resolved in v0.2. Listed here for auditability.

| # | Severity | Issue | Disposition |
|---|----------|-------|-------------|
| H-01 | Low | "12-bucket" label vs. 13 entries (00–12) | Resolved: `00` = index. Buckets = `01–12`. |
| H-02 | High | Schema Versioning Policy absent | Added `12b`. Moved to Phase 1. Dependencies corrected to `01`, `05`. |
| H-03 | High | Renderer/Projection Rules buried as appendix | Promoted to standalone `05b`. Phase 1. |
| H-04 | Med | `11_Output_Document_Specs` is a folder, not a doc | Exploded into `11a–11h` individually. |
| H-05 | Med | Document Usage SOP absent | Added `10b`. Phase 6. |
| H-06 | Low | Build Roadmap has no home | Absorbed into Section C of this document. |
| H-07 | High | TIS Boundary Enforcement undocumented | Added as Appendix B inside `04`. Hard review gate, not advisory. |
| H-08 | Med | `11d` missing `11c` in Section B dependencies | Fixed. B/D now consistent. |
| H-09 | Low | Table sort error — `12`/`12b` before `11a–11h` | Fixed. Sort order now: 00–10b → 11a–11h → 12–12b. |
| H-10 | High | Governance paradox: `12` cited as gate but built in Phase 4 | Fixed. `12` moved to Phase 1. Active from Phase 2 onward. Retroactive review for Phase 0–1. |
| H-11 | High | `12b` in Phase 2 but first schema (`03`) in Phase 1 | Fixed. `12b` moved to Phase 1. |
| H-12 | Med | Purpose column mixed data projection with UX aspiration | Fixed. Purpose column now states data rendered, not feeling conveyed. |
| H-13 | High | "Technician (generates)" violates TIS/BHFOS guardrail | Fixed. Language changed to "field trigger" / "field use." |
| H-14 | Med | `10` → `10b` link in D unsubstantiated | Fixed. Removed. |
| H-15 | Low | Deferred documents not explicitly noted | Added Section F: Deferred Document Register. |
| H-16 | High | No Owner column | Added. |
| H-17 | High | No Status column | Added. |
| H-18 | Med | `11b` missing `11e` as upstream dependency | Fixed in B and D. |
| H-19 | Low | Document count stated as 21, was 22 | Fixed. |
| H-20 | Med | No changelog | Added. |

---

### v0.1 → v0.2: External Review — 8 Items

> Resolved in v0.2. Listed here for auditability.

| # | Severity | Issue | Disposition |
|---|----------|-------|-------------|
| E-01 | High | State Transition Model absent | Added `04b`. |
| E-02 | High | Renderer/Projection Rules needs standalone status | Resolved via H-03. |
| E-03 | High | Messaging Manifest absent | Added `08b`. |
| E-04 | High | Close Mechanics Model absent | Added `08c`. |
| E-05 | Med | Speed Budget undefined | Added as required section in `07` purpose and gate condition. |
| E-06 | Med | Lock criteria too rigid | Updated to v1 stability (~85%) with formal versioning for iteration. |
| E-07 | Med | No field feedback loop | Deferred as post-V1. Added to Section F. |
| E-08 | High | TIS boundary enforcement too soft | Elevated to hard build-stop gate. Noted in Phase 2 gate conditions. |

---

### v0.2 → v0.3: Operator Critique — 6 Items

> **Resolved in this version (v0.3).**

| # | Severity | Issue | Disposition |
|---|----------|-------|-------------|
| O-01 | **Critical** | **No System Behavior Spec.** No single document defines how the system behaves end-to-end in one coherent flow. Without it: engineers interpret the same architecture differently, documents stay individually correct but drift collectively, and integration bugs appear late and expensively. | **Added `00b_System_Behavior_Spec`.** Category 2. Placed in Phase 1 between `02` and `03`. Defines: full lifecycle walkthrough, object movement and mutation rules (when data is mutable vs. read-only), trigger points (render / sync / lock), and the complete flow from inspection to certificate. `03` now depends on `00b`. `07` now depends on `00b`. |
| O-02 | **High** | **State Enforcement Matrix absent from `04b`.** The State Transition Model defines what states exist but not what permissions and field locks apply per state. Without it: silent data corruption occurs (e.g., tech edits findings after "Presented," pricing changes after "Accepted"). | **Added State Enforcement Matrix as a required appendix to `04b`.** Columns: State / Editable Fields / Locked Fields / Allowed Actions. This is not optional content — it is a build-stop requirement. `04b` is not lockable without this matrix present and reviewed. |
| O-03 | **High** | **`08b`/`08c` not bound to the data layer.** Messaging Manifest and Close Mechanics risk becoming generic and theoretical if they are not explicitly mapped to finding types and severity levels. Generic messaging does not influence field behavior. | **Updated `08b` purpose and gate condition:** Required section is now "Finding → Message Mapping Rules" (finding type × severity → specific language pattern). **Updated `08c` purpose and gate condition:** Required section is now "Finding → Close Trigger Mapping" (high-severity clusters → urgency language; multi-category findings → bundle pitch framing). Both documents are not lockable without these mapping sections present. |
| O-04 | **High** | **No Audit Trail Spec.** No definition of who changed what, when, with what before/after values, and from what source (tech vs. office vs. system). Without it: disputes become unwinnable, scaling to franchise or regulated environments (mold, IAQ) is legally exposed. | **Added `04c_Audit_Trail_Spec`.** Category 2. Depends on `03`, `04b`. Blocks `04`. Defines: auditable events, actor types, record structure, immutability rules, retention policy. |
| O-05 | **High** | **No Document Authority Hierarchy.** The collection now has 26 documents (pre-v0.3). When conflicts arise between documents — e.g., Pricing Manifest vs. Estimate output, Messaging vs. Tech Notes, State Model vs. Workflow behavior — there is no defined source of truth. Dueling truths produce inconsistent builds. | **Added `05c_Document_Authority_Hierarchy`.** Category 3. Depends on `05`, `00b`. Defines the ranked authority chain: (1) Canonical Data Model — truth of structure; (2) State Transition Model + Enforcement Matrix — truth of behavior; (3) System Behavior Spec — truth of flow narrative; (4) Pricing Manifest — truth of cost; (5) Renderer/Projection Rules — output constraints only; (6) Document Contract Standard — output format; (7) Individual Output Specs — projections only. Lower-ranked documents may not override higher-ranked ones. |
| O-06 | **Med** | **Document explosion risk (21 → 26 docs) had no containment mechanism.** More documents without a conflict resolution model creates a higher-complexity system, not a higher-authority one. | **Resolved by O-05.** `05c` is the containment mechanism. Adding any new document now requires stating where it sits in the authority chain as part of the `12` review gate. Any document that cannot be placed in the hierarchy without ambiguity must not be added. |

---

### Confirmed Clean Areas (v0.3)

- Bucket sort: `00` → `00b` → `01–12b`. Clean.
- Spine: `01 → 00b → 03 → 04b → 04` correctly ordered.
- Output Documents (`11a–11h`) correctly deferred behind all foundational docs.
- `12` (Governance Checklist) now in Phase 1. Retroactive application to Phase 0–1 confirmed.
- `12b` (Schema Versioning) in Phase 1, before any schema iteration. Dependency chain correct.
- Lock criteria language updated to v1 stability threshold (~85%), not perfection. Formally tracked via `12b`.
- TIS boundary enforcement is a hard build-stop gate, not advisory documentation.

---


### v0.3 → v0.4: Post-Operator Critique — 6 Items

> **Resolved in this version (v0.4).**

| # | Severity | Issue | Disposition |
|---|----------|-------|-------------|
| V-01 | High | Artifact revocation / tombstoning absent. Superseded artifacts had no distribution enforcement. | Added `00b` Sections 9b.1–9b.5. Three artifact classes defined (Class I/II/III). `pending_supersession` state added. Delivery channel tracking requirement stated. Reopen-tombstone interaction defined. |
| V-02 | High | Status-level office authority undifferentiated. All hard-stop flags treated identically. | Replaced `00b` Section 3.6. Five hard-stop flags with differentiated continuation rules. `do_not_service` and `unsafe_entry_restriction` stop all activity; `payment_legal_hold` and `no_contracting_authority` block only new contracting. |
| V-03 | High | Sweep-to-context behavior undefined. | Added `00b` Section 6.3b. Evidence class split (`context` vs. `finding`), promotion as new record creation (not mutation), archive disposition, governance guardrails. |
| V-04 | Med | Tier 2 correction boundary too broad. Location corrections could sprawl. | Added `00b` Section 6.9b. Hard permit/prohibit list with asset-remapping rule. System enforcement language replacing UI prompt language. |
| V-05 | Med | Session-local precedence had no expiry or reconciliation enforcement. | Added `00b` Section 6.5b. Archive gate as state machine precondition. Reconciliation approver role defined. Full-offline edge case addressed. |
| V-06 | Low | Section 12.4 unnamed pricing authority. | Corrected to name `06_Pricing_Manifest_Framework` explicitly. |

---
## SECTION B — MASTER DOCUMENT TABLE

> Every document in the V1 collection. Sub-specs individually enumerated. Sorted by Doc ID.
>
> **Category Key:** 1 = Business-Facing Output | 2 = Core System Design | 3 = Governance | 4 = Build Planning | 5 = UX & Field Ops | 6 = Internal Operating
>
> **Status Key:** `⬜ Not Started` | `🔄 In Progress` | `✅ Locked`

| Doc ID | Name | Cat | Purpose | Owner | Primary Audience | Data Dependencies | Complexity | Tombstone Class | Status |
|--------|------|-----|---------|-------|-----------------|-------------------|------------|----------------|--------|
| **00** | Master Document Library Map | 4 | Index of entire V1 collection. Surfaces structure, build order, dependency chain, status, and version history. Updated whenever any document is added, retired, or its dependency changes. | Lead Architect | Architect, PM, Lead Eng, All Contributors | None — bootstrap | M | — | ✅ Locked |
| **00b** | System Behavior Spec | 2 | Defines the system's end-to-end behavior as one coherent narrative. Covers: full lifecycle walkthrough; object mutation rules; lock points A–G; render trigger rules; pricing freeze behavior; artifact revocation and tombstoning by class (I/II/III) including `pending_supersession` state and reopen interaction; authority-class split for field/office conflicts (Class A / Class B / five differentiated Hard-Stop flags); sweep-to-context capture behavior with evidence class split and immutable promotion model; session-local reconciliation clock with archive gate enforcement; Tier 2 correction boundaries with system-enforced tier validation; runtime conflict resolution with named governing documents; downstream revalidation rules. | Lead Architect + Lead Eng | Architect, Lead Eng, All Doc Authors | `01`, `02` | H | — | ✅ Locked |
| **01** | System Architecture Overview | 2 | Defines BHFOS vs. TIS responsibilities. Establishes system-of-record vs. field-client boundary. States where pricing, documents, and history live. The anchor every other document references. | Lead Architect | Architect, Lead Eng, PM | None — foundational anchor | H | — | ⬜ Not Started |
| **02** | V1 Scope and Boundaries | 4 | Explicit IN / OUT / DEFERRED list for V1. The Zero-Drift enforcement artifact. Any new feature must be validated against this document before being added to the build. | Architect + PM | Architect, PM, All Contributors | `01` | M | — | ⬜ Not Started |
| **03** | Canonical Data Model | 2 | Defines all system entities and field-level schemas. Includes runtime entities plus the Asset/Zone containment hierarchy (Property → Structure → Zone → System → Equipment) so findings can be bound to distinct assets; includes `evidence_class` (`context` | `finding`) on Evidence for render/QA rules. See Section B.1 for the full entity list and containment model. | Lead Eng + Architect | Architect, Lead Eng, All Doc Authors | `01`, `02`, `00b` | H | — | ⬜ Not Started |
| **04** | TIS Field and Sync Model | 2 | Defines TIS behavior end-to-end: draft objects, sync packages, sync states, conflict states, media upload behavior. Appendix B: TIS Boundary Rules — what TIS is **forbidden** from storing, processing, or generating. Boundary violations are a mandatory build stop. Any TIS feature not cleared against Appendix B is rejected at review. Depends on `04c` to know which sync events must emit audit records. | Lead Eng | Lead Eng, Field App Dev | `01`, `03`, `04b`, `04c` | H | — | ⬜ Not Started |
| **04b** | State Transition Model | 2 | Defines the formal session state machine: all valid states (e.g., `draft → open → in-progress → complete → synced → archived`), all valid transitions, and what triggers each transition. **Required appendix: State Enforcement Matrix** — columns: State / Editable Fields / Locked Fields / Allowed Actions. This matrix is mandatory. `04b` is not lockable without it. Without it: silent data corruption (post-"Presented" finding edits, post-"Accepted" pricing changes) becomes possible. **State Enforcement Matrix requirements from `00b` v1.2:** (1) Five Hard-Stop flag fields confirmed as read-only in all states — no write path from TIS; (2) Evidence entity includes `evidence_class` attribute (`context` | `finding`) as a state-tracked property; (3) `archived` state transition gate includes Class A field reconciliation as a required precondition — this is a state machine constraint, not a UI validation; (4) `pending_supersession` artifact status is a valid state-trackable event; (5) Full-offline sync: hard-stop check is the first operation on connectivity resume before any session data commits; (6) Explicit Correction/Revision state or transition path exists for Tier 2 corrections post-`presented` without allowing silent mutation. | Lead Eng + Architect | Lead Eng, Field App Dev | `03`, `00b` | H | — | ⬜ Not Started |
| **04c** | Audit Trail Spec | 2 | Defines the system's auditability layer. Specifies: auditable event types (state changes, field edits, document renders, sync events), actor type classification (technician / office / system), audit record structure (event, actor, timestamp, entity ID, before value, after value), immutability rules (audit records cannot be edited or deleted), and retention policy. Required for legal defensibility in regulated contexts (IAQ, mold). Required before `04` is drafted so that sync events know which records to emit. | Lead Eng + Architect | Lead Eng, Architect, Legal (future) | `03`, `04b` | M | — | ⬜ Not Started |
| **05** | Document Contract Standard | 3 | The mandatory template every output document spec must conform to. Invariants, inputs, outputs, ownership, lifecycle stage, versioning rules, rendering rules pointer. No `11x` spec may be drafted until this is locked. | Lead Architect | Architect, All Doc Authors | `03` | M | — | ⬜ Not Started |
| **05b** | Renderer and Projection Rules | 3 | Standalone constraint document. Defines: renderers never infer business logic; internal vs. external field visibility; customer-safe language rules; pricing field visibility controls. Any renderer or template violating these rules is failed at review. | Architect + Lead Eng | Lead Eng, All Doc Authors, Reviewers | `05` | M | — | ⬜ Not Started |
| **05c** | Document Authority Hierarchy | 3 | Defines the ranked chain of truth across the entire document collection. When any two documents conflict on a data point, behavior, or output, this hierarchy resolves it: (1) Canonical Data Model — truth of structure; (2) State Transition Model + Enforcement Matrix — truth of behavior and permissions; (3) System Behavior Spec — truth of end-to-end flow narrative; (4) Pricing Manifest — truth of cost; (5) Renderer/Projection Rules — output constraints only; (6) Document Contract Standard — output format; (7) Individual Output Specs — projections only, no authority. Lower-ranked documents may not override higher-ranked ones. Any new document added to the collection must be assigned a position in this hierarchy as part of its `12` review gate. | Lead Architect | Architect, All Contributors, Reviewers | `05`, `00b` | L | — | ⬜ Not Started |
| **06** | Pricing Manifest Framework | 6 | Defines pricing structure, line items, bundling rules, option tiers, and audience-gated visibility rules (which price field appears in which document, for which reader). Authority rank 4 per `05c`. | Ops Lead | Lead Eng, Ops Lead, Sales | `03`, `02` | H | — | ⬜ Not Started |
| **07** | Field Workflow Spec | 5 | End-to-end technician journey from app open to visit close. Covers operator mode, customer-present mode, offline/poor-signal behavior, and tap-by-tap flow overview. **Required section: Speed Constraints** — maximum taps per finding entry, maximum seconds per screen transition, maximum friction points per visit. Speed constraints are not aspirational — they are review-gate requirements. Depends on `00b` to ensure the workflow matches the system's lifecycle narrative. | Lead Eng + Ops Lead | Lead Eng, Field App Dev, Technicians | `03`, `04`, `04b`, `00b` | H | — | ⬜ Not Started |
| **08** | Customer Experience and Authority Spec | 5 | Defines what the customer sees at each visit stage. Language tone, authority signal requirements, premium-feel touchpoints. Maps customer touchpoints to output documents. Defines the Trust Stack: visual proof → structured explanation → consistent language → clear recommendation → controlled pricing reveal. | UX Lead | UX Lead, Sales, Ops | `07`, `06`, `03` | M | — | ⬜ Not Started |
| **08b** | Messaging Manifest | 5 | Defines technician-spoken language patterns. **Required section: Finding → Message Mapping Rules** — maps finding type × severity to specific language patterns, authority framing, and forbidden language. Example: Bio-Growth + High Severity → specific phrasing set. Example: Airflow + Medium → different tone and specificity. This binding to the finding data layer is mandatory. Generic messaging guidance that does not reference finding types and severities is not acceptable. `08b` is not lockable without the mapping section present and reviewed. | Sales Lead + UX Lead | Technicians, Sales, Ops | `08`, `03` | M | — | ⬜ Not Started |
| **08c** | Close Mechanics Model | 5 | Defines the customer decision pathway from problem understanding to solution agreement. **Required section: Finding → Close Trigger Mapping** — maps finding clusters to close approach (e.g., high-severity clusters → urgency framing; multi-category findings → bundle pitch; single low-severity → maintenance positioning). Objection handling patterns, decision trigger design, and recommendation hierarchy are all binding, not advisory. `08c` is not lockable without the mapping section present and reviewed. | Sales Lead | Sales, Technicians | `08`, `06`, `03` | M | — | ⬜ Not Started |
| **09** | Media Capture and Evidence Standard | 5 | Photo requirements, file naming convention, capture ordering, before/after rules, minimum acceptable evidence per finding type. All photo-bearing output documents are projections of evidence captured to this standard. | Lead Eng + Ops Lead | Technicians, QA, Lead Eng | `03`, `07`, `00b` | M | — | ⬜ Not Started |
| **10** | Customer Record Standard | 6 | Defines what must exist in a valid customer record: required fields, searchability requirements, recallability rules, data lifecycle (retention, archival, deletion). | Lead Eng + Ops Lead | Lead Eng, Ops | `03` | M | — | ⬜ Not Started |
| **10b** | Document Usage SOP | 6 | Per-document operational procedures: who can generate each output doc, who can edit it, at what visit stage it is issued, and what operational step follows generation. Written last because it governs the finalized output doc set. | Ops Lead | Ops Lead, Technicians, Sales | `05`, `11a–11h` | M | — | ⬜ Not Started |
| **— GROUP —** | *11 — Output Document Specs* | — | *Folder/grouping label only. Not a standalone document. Each sub-spec has its own contract, owner, dependencies, and review lifecycle.* | — | — | — | — | — | — |
| **11a** | Output Spec: Clear Air Checklist | 1 | Spec for the BHFOS-rendered checklist of session findings. Delivered at or after inspection. Data projected from: Session entity, Finding records, Evidence records per `03`. Rendered per `05`/`05b` constraints. | Ops Lead + Architect | Technician (field trigger), Customer (recipient) | `03`, `05`, `05b`, `09` | M | Class I | ⬜ Not Started |
| **11b** | Output Spec: Estimate / Proposal | 1 | Spec for the BHFOS-rendered pricing and scope options document. Multi-tier layout. Pricing data sourced strictly from `06`. Work scope framing sourced from `11e`. Close mechanics framing governed by `08c`. Pricing visibility rules enforced per `05b`. | Architect + Sales Lead | Customer, Sales | `03`, `05`, `05b`, `06`, `11e`, `08c` | H | Class II → Class III | ⬜ Not Started |
| **11c** | Output Spec: Photo-Evidence Report | 1 | Spec for the BHFOS-rendered labeled visual documentation of all findings. Evidence ordered and labeled per `09` standard. The core authority artifact behind the diagnosis. | Architect + Lead Eng | Customer, QA | `03`, `05`, `05b`, `09` | H | Class I | ⬜ Not Started |
| **11d** | Output Spec: IAQ Report | 1 | Spec for the BHFOS-rendered Indoor Air Quality authority document. Synthesizes finding data and photo evidence into a decision-grade narrative. Depends on `11c` being locked because IAQ narrative references and cites specific photo evidence. | Architect + Ops Lead | Customer, Property Manager, Partner | `03`, `05`, `05b`, `09`, `08`, `11c` | H | Class I (default; regulated-context escalation path to Class II) | ⬜ Not Started |
| **11e** | Output Spec: Work Scope | 1 | Spec for the BHFOS-rendered scope-boundary document. Defines what work will be performed, what is included, and what is excluded. Required upstream of Estimate because `11b` references scope definitions from this document. | Architect + Ops Lead | Customer, Technician (field reference) | `03`, `05`, `05b`, `06` | M | Class II | ⬜ Not Started |
| **11f** | Output Spec: Clean Air Certificate | 1 | Spec for the BHFOS-rendered post-service certificate. Issued upon job completion and QA sign-off. Data projected from: Session completion state, QA approval event per `04b`/`04c`. | Architect + UX Lead | Customer | `03`, `05`, `05b` | L | Class III | ⬜ Not Started |
| **11g** | Output Spec: Tabletop Presentation | 1 | Spec for the BHFOS-rendered in-home sales presentation flow. Synthesizes finding data, pricing tiers, authority language (`08b`), and close mechanics (`08c`) into a structured customer decision experience. Most complex output document. Built last. | Sales Lead + Architect | Technician (field use), Customer (recipient) | `03`, `05`, `05b`, `06`, `08`, `08b`, `08c` | H | Class I | ⬜ Not Started |
| **11h** | Output Spec: Leave-Behind Packet | 1 | Spec for the BHFOS-rendered post-visit reference material. Projects session summary, finding narrative (`08b` language), and next-step guidance. | UX Lead + Ops Lead | Customer | `03`, `05`, `05b`, `08`, `08b` | M | Class I | ⬜ Not Started |
| **12** | Review and Governance Checklist | 3 | Formal PR/review gate for all document specs and schema changes. Defines required fixtures, negative test cases, mandatory peer-review questions, and authority hierarchy placement requirement (per `05c`). Active from Phase 2 onward. Retroactively applied to Phase 0–1 docs before Phase 2 begins. | Lead Architect | Architect, Reviewers | `05` | L | — | ⬜ Not Started |
| **12b** | Schema Versioning Policy | 3 | Naming convention for all schema versions. Defines breaking vs. non-breaking changes. Rules for major vs. minor bumps. Migration expectations. Must be locked before any schema undergoes a second iteration. Governs schemas including `03` — does not require `03` to exist first. | Lead Eng + Architect | Lead Eng, Architect | `01`, `05` | M | — | ⬜ Not Started |


**Total V1 documents tracked: 29**
*(Backbone: `00`, `00b`, `01–12b`. Exploded output sub-specs: `11a–11h`. Additions in v0.3: `00b`, `04c`, `05c`. Deferred post-V1 items: see Section F.)*


### Section B.1 — Canonical Data Model v0.4 (Entity + Asset/Zone Model Detail)

This is the authoritative map-level statement of what `03` must include.

**Runtime Data Entities:**
Customer, Property, Session, Finding, Evidence, Interpretation, Recommendation, Estimate Option, Document Artifact, Audit Event, QA Approval Event, Certificate Eligibility Record.

**Spatial Reference Hierarchy (Asset/Zone Model):**
The following entities form a parent-child containment tree. This hierarchy is the authoritative reference for "distinct asset" determination in Tier 2 correction boundaries and multi-unit property reporting.

```
Property
  └── Structure        (physical building or unit: main house, garage, Unit 3A)
        └── Zone       (spatial area: first floor, attic, crawlspace)
              └── System    (mechanical system: HVAC, ventilation, ductwork)
                    └── Equipment  (specific piece: air handler, coil, blower motor)
```

Findings are associated with a location expressed as a path through this hierarchy. Minimum specificity: Zone level. Full specificity: Equipment level.

**Data Attribute Note:**
The Evidence entity must include an `evidence_class` attribute with permitted values: `context` | `finding`. This attribute governs whether an Evidence record satisfies finding evidence minimums and whether it is eligible for customer-facing renders.
---

## SECTION C — RECOMMENDED BUILD ORDER

> Sequenced by dependency. No document begins until everything it depends on has reached **v1 stability (~85%)**.
>
> **Lock definition:** Document has passed the `12` gate and version is recorded per `12b`. "Lock" means stable enough that downstream documents won't require upstream rewrites — not perfection. Post-lock iteration is permitted under `12b` version control.
>
> **Phase 0–1 review rule:** `12` does not exist during Phases 0–1. Phase 0–1 documents use architect sign-off only. Before Phase 2 begins, `12` is applied retroactively to all Phase 0–1 documents. Phase 2 and beyond require formal `12` gate to close any document.
>
> **TIS boundary gate:** Any `04` or `04b` content that touches TIS behavior requires explicit sign-off against Appendix B of `04`. Violation = build stop. Not a soft gate.
>
> **Authority placement gate (new in v0.3):** Any document added after Phase 1 must declare its position in the `05c` authority hierarchy as part of its `12` review submission.

---

### Phase 0 — Bootstrap (No Upstream Dependencies)

| Seq | Doc ID | Name | Gate Condition |
|-----|--------|------|----------------|
| 1 | `00` | Master Document Library Map | Architect confirms: all holes dispositioned, table complete, no circular dependencies. |
| 2 | `01` | System Architecture Overview | Architect + PM sign off. BHFOS/TIS boundary explicitly drawn. TIS forbidden-action list present. |

**→ `01` must be locked before any Phase 1 work begins.**

---

### Phase 1 — Spine (Depends on Phase 0)

> The logical skeleton and the behavioral narrative that holds it together. Every downstream artifact is a projection of what is defined and described here. Phase 1 uses architect sign-off as review gate. Retroactive `12` gate applied to all Phase 1 docs before Phase 2 begins.

| Seq | Doc ID | Name | Gate Condition |
|-----|--------|------|----------------|
| 3 | `02` | V1 Scope and Boundaries | IN / OUT / DEFERRED list agreed. Zero-drift line signed. |
| 4 | `00b` | System Behavior Spec | Full lifecycle walkthrough complete. Object mutation rules defined. Trigger points (render, sync, lock) specified. Engineers can read this and agree on system behavior without referencing `03`. |
| 5 | `03` | Canonical Data Model | All entities, all fields, all relationships agreed. Entities match the lifecycle objects described in `00b`. No output document may reference a field not defined here. |
| 6 | `05` | Document Contract Standard | Template and contract spec finalized. Renderer/Projection Rules pointer confirmed. |
| 7 | `05b` | Renderer and Projection Rules | All visibility rules, inference prohibitions, and customer language constraints defined. |
| 8 | `05c` | Document Authority Hierarchy | Full ranked authority chain defined. Conflict resolution rules stated. All six authority levels populated. |
| 9 | `12` | Review and Governance Checklist | Formal gate document ratified. Now active for all Phase 2+ work. Authority hierarchy placement check added as a required gate item. |
| 10 | `12b` | Schema Versioning Policy | Breaking change rules defined. Versioning convention agreed. No schema undergoes a second iteration without this locked. |

**→ Lock `02`, `00b`, `03`, `05`, `05b`, `05c`, `12`, `12b` before Phase 2. These are the highest-leverage locks in the entire build.**
**→ Retroactively apply `12` gate to `00` and `01` before Phase 2 begins.**

---

### Phase 2 — Core Models (Depends on Phase 1)

> State behavior, audit infrastructure, sync model, pricing, and record requirements. All Phase 2 documents require `12` gate passage to lock.

| Seq | Doc ID | Name | Gate Condition |
|-----|--------|------|----------------|
| 11 | `04b` | State Transition Model | All valid states and transitions defined. **State Enforcement Matrix (required appendix) present and reviewed.** Editable/locked fields per state defined. `04b` is not lockable without the matrix. TIS boundary gate applied. Additionally required: (1) Hard-Stop flag fields confirmed as read-only across all states with no TIS write path — each of the five flags validated individually; (2) Evidence entity `evidence_class` attribute (`context` | `finding`) included in the state-tracked schema; (3) `archived` transition precondition formally includes Class A reconciliation gate (pass / reject / defer-with-reason); (4) `pending_supersession` artifact status defined as a valid transition state for Class II and III artifacts; (5) Full-offline connectivity resume: hard-stop check defined as first sync operation; (6) Explicit Correction/Revision state or transition path exists for Tier 2 corrections post-`presented`. |
| 12 | `04c` | Audit Trail Spec | Auditable event types defined. Actor classification defined. Record structure specified. Immutability and retention rules stated. Additionally required: (1) Delivery channel tracking defined as an auditable record type — system must record what channels were used to deliver each Class II and Class III artifact; (2) `pending_supersession` entry, cancellation, and successor-issuance transitions are auditable events; (3) Hard-stop flag activation, push, and technician notification are auditable events; (4) Offline hard-stop resolution on connectivity resume is an auditable event. |
| 13 | `04` | TIS Field and Sync Model | Sync model complete. Appendix B (TIS Boundary Rules) reviewed and signed as hard build-stop constraint. Sync events confirmed to emit audit records per `04c`. Additionally required: (1) Appendix B must confirm all five Hard-Stop flags are read-only in TIS — write attempt generates error and audit event; (2) Hard-stop push on sync defined: TIS surfaces flag to technician immediately, applicable blocks enforce per Section 3.6 continuation rules; (3) Sync event payload includes `evidence_class` on all Evidence records; (4) Offline hard-stop behavior defined: If TIS is offline, hard-stop status cannot be confirmed. Maximum offline duration before offline-unconfirmed warning activates on contracting actions must be specified. On connectivity resume, hard-stop check is first sync operation. Any contracting actions taken during offline period that would have been blocked are flagged for office review. `do_not_service` and `unsafe_entry_restriction` override any prior authorization — work must stop even if previously authorized. |
| 14 | `06` | Pricing Manifest Framework | All line items, tiers, bundling rules, and audience visibility gates defined. Authority rank 4 confirmed per `05c`. |
| 15 | `10` | Customer Record Standard | Required fields, searchability rules, and data lifecycle defined. |

---

### Phase 3 — Field Operations Layer (Depends on Phase 2)

> How work happens in the field. Must be locked before any screen is built or output document is drafted.

| Seq | Doc ID | Name | Gate Condition |
|-----|--------|------|----------------|
| 16 | `07` | Field Workflow Spec | Full technician journey documented. **Speed Constraints section present:** maximum taps per finding, maximum seconds per screen transition, maximum friction points per visit. These are not aspirational — they are review-gate requirements. Workflow verified against `00b` lifecycle narrative. Additionally required: (1) Sweep-to-context capture mode tap sequence and mode indicator defined; (2) Promotion workflow from context to finding-class evidence — accessible, low-friction, clearly labeled; (3) Hard-stop surface UX: what the technician sees for each of the five hard-stop flags, which actions become unavailable, how to contact office; (4) Offline-unconfirmed warning UX for contracting actions when hard-stop status cannot be confirmed; (5) Tier 2 vs. Tier 3 correction type selection at revision initiation; (6) Delivery event recording: `07` must specify how artifact delivery events are recorded so that tombstone enforcement can be applied to delivered artifacts. Every customer-facing artifact delivery is a recordable event. |
| 17 | `09` | Media Capture and Evidence Standard | Photo requirements and minimum evidence-per-finding-type rules locked. QA personnel and at least one technician have reviewed and signed off. Additionally required: (1) `context` evidence class defined — labeling convention, storage behavior, exclusion from customer-facing renders, archive disposition (retained internally, not customer-accessible); (2) `finding` evidence class defined — minimum thresholds per finding type; (3) Explicit rule: context-class evidence does not count toward finding evidence minimums; (4) Promotion data operation defined in alignment with `00b` Section 6.3b: new `finding`-class record, source `context` record retained with `promoted_to` reference; (5) QA-reportable threshold for excessive context-only usage defined with a specific threshold. |

---

### Phase 4 — Experience and Authority Layer (Depends on Phase 3)

> Customer-facing posture, close mechanics, and message-to-data binding. Must be locked before any output document is drafted.

| Seq | Doc ID | Name | Gate Condition |
|-----|--------|------|----------------|
| 18 | `08` | Customer Experience and Authority Spec | Trust Stack defined. Language rules locked. Customer touchpoints mapped. |
| 19 | `08b` | Messaging Manifest | **Finding → Message Mapping Rules present and reviewed.** Mapping covers all finding types in `03` at all severity levels. Forbidden language list present. Sales Lead and at least one field technician sign off. `08b` is not lockable without the mapping section. |
| 20 | `08c` | Close Mechanics Model | **Finding → Close Trigger Mapping present and reviewed.** Mapping covers high-severity clusters, multi-category patterns, and single-issue scenarios. `08c` is not lockable without the mapping section. |

---

### Phase 5 — Output Document Specs (Depends on Phases 1–4)

> Surface documents only. Each drafted against a locked `05` contract, verified against `05b` renderer rules, and placed in the `05c` authority hierarchy. Build from simplest to most synthesized.

| Seq | Doc ID | Name | Sub-Order Rationale |
|-----|--------|------|----------------------|
| 21 | `11f` | Clean Air Certificate | Fewest dependencies. Good first pressure-test of the `05` contract format. |
| 22 | `11a` | Clear Air Checklist | First customer-facing artifact in the field flow. |
| 23 | `11e` | Work Scope | Required upstream of Estimate. Must be locked before `11b` begins. |
| 24 | `11h` | Leave-Behind Packet | No pricing logic. No synthesis required. Lower risk. |
| 25 | `11c` | Photo-Evidence Report | High complexity. Depends heavily on `09` being locked. |
| 26 | `11b` | Estimate / Proposal | Depends on `11e` (Work Scope) and `08c` (Close Trigger Mapping). Both must be locked. |
| 27 | `11d` | IAQ Report | Synthesis doc. Depends on `11c` being locked. |
| 28 | `11g` | Tabletop Presentation | Most complex output document. Synthesizes pricing, evidence, messaging, and close mechanics. Built last in all of Phase 5. |

---

### Phase 6 — Operational Procedures (Depends on Phase 5)

> Cannot be written until the documents it governs are finalized.

| Seq | Doc ID | Name | Gate Condition |
|-----|--------|------|----------------|
| 29 | `10b` | Document Usage SOP | All `11a–11h` locked. Per-document operational procedure written for each output. Ops Lead sign-off. |

---

## SECTION D — DEPENDENCY MATRIX

> Direct dependencies only. Upstream = must be locked first. Downstream = directly blocked.
> `00` downstream is meta (index role), not a data dependency.
> Transitive dependencies are not listed — they are implied through the chain.

| Doc ID | Upstream — Must Be Locked First | Downstream — Directly Blocked |
|--------|---------------------------------|-------------------------------|
| `00` | None | Meta only: map must be updated when any document below changes |
| `00b` | `01`, `02` | `03`, `04b`, `05c`, `07`, `09` |
| `01` | None | `02`, `00b`, `03`, `04`, `12b` |
| `02` | `01` | `00b`, `03`, `06` |
| `03` | `01`, `02`, `00b` | `04b`, `04c`, `05`, `06`, `07`, `09`, `10`, `11a–11h` |
| `04` | `01`, `03`, `04b`, `04c` | `07` |
| `04b` | `03`, `00b` | `04`, `04c`, `07` |
| `04c` | `03`, `04b` | `04`, `10b` |
| `05` | `03` | `05b`, `05c`, `11a–11h`, `12`, `12b` |
| `05b` | `05` | `11a–11h` |
| `05c` | `05`, `00b` | Governance reference for all conflict resolution (no direct downstream block, but required before any document disputes are resolved) |
| `06` | `03`, `02` | `11b`, `11e`, `11g`, `08c` |
| `07` | `03`, `04`, `04b`, `00b` | `08`, `09` |
| `08` | `07`, `06`, `03` | `08b`, `08c`, `11d`, `11g`, `11h` |
| `08b` | `08`, `03` | `11g`, `11h`, `10b` |
| `08c` | `08`, `06`, `03` | `11b`, `11g`, `10b` |
| `09` | `03`, `07`, `00b` | `11a`, `11c`, `11d` |
| `10` | `03` | None — terminal record standard |
| `10b` | `05`, `11a–11h` | None — terminal SOP |
| `11a` | `03`, `05`, `05b`, `09` | `10b` |
| `11b` | `03`, `05`, `05b`, `06`, `11e`, `08c` | `10b` |
| `11c` | `03`, `05`, `05b`, `09` | `11d`, `10b` |
| `11d` | `03`, `05`, `05b`, `09`, `08`, `11c` | `10b` |
| `11e` | `03`, `05`, `05b`, `06` | `11b`, `10b` |
| `11f` | `03`, `05`, `05b` | `10b` |
| `11g` | `03`, `05`, `05b`, `06`, `08`, `08b`, `08c` | `10b` |
| `11h` | `03`, `05`, `05b`, `08`, `08b` | `10b` |
| `12` | `05` | All Phase 2+ document reviews (hard gate) |
| `12b` | `01`, `05` | All schema iterations |

---

### Circular Dependency Verification

> Every dependency chain traced. No circular paths confirmed.

| Chain Checked | Result |
|---------------|--------|
| `00b` → `03` → `00b` | ❌ Not circular. `00b` blocks `03`. `03` does not block `00b`. |
| `04b` → `04c` → `04` → `04b` | ❌ Not circular. `04b` blocks `04c`. `04c` blocks `04`. `04` does not reference `04b`. |
| `05` → `05c` → `05` | ❌ Not circular. `05` blocks `05c`. `05c` does not block `05`. |
| `11b` → `11e` → `11b` | ❌ Not circular. `11e` blocks `11b`. `11b` does not block `11e`. |
| `11d` → `11c` → `11d` | ❌ Not circular. `11c` blocks `11d`. `11d` does not block `11c`. |
| `08c` → `11b` → `08c` | ❌ Not circular. `08c` blocks `11b`. `11b` does not reference `08c` as downstream. |
| `12b` → `03` → `12b` | ❌ Not circular. `12b` depends on `01`, `05` only — not `03`. Confirmed clean in v0.2. |

**No circular dependencies detected in v0.4.**

---

## SECTION E — MAP META

**What this document depends on:** Nothing. This is the bootstrap document.

**What depends on this document:** All contributors. This map is the entry point. No build work begins on any document without consulting Section C (build order) and Section D (dependency matrix). The `05c` authority hierarchy provides conflict resolution. The changelog provides version history.

**Update triggers:** This map must be updated when: (1) any document is added or retired, (2) any dependency changes, (3) any document's status changes, (4) V1 scope boundary shifts, (5) any authority hierarchy position in `05c` changes.

**Review gate:** This document passes review when: (1) all structural holes are acknowledged and dispositioned, (2) every V1 document has a row in the master table with all 10 columns populated, (3) dependency matrix has no circular dependencies (verified in Section D), (4) build order sequence is consistent with dependency matrix, (5) every document's authority hierarchy position is known or deferred to `05c`, (6) tombstone class (I/II/III) assignments for `11a–11h` are recorded in the master table (including `11b` II → III transition and `11d` regulated-context escalation note), (7) architect and PM have signed off.

---


## SECTION G — OPEN ITEMS NOT YET RESOLVED

> Two items identified in the operator critique remain open. They are not resolved by v0.4. They require dedicated attention before final lock.

| Item | Status | Required Before |
|------|--------|-----------------|
| `03` Asset/Zone schema fully specified (field-level definitions for Structure, Zone, System, Equipment and their relationship attributes) | ⬜ Not Started | Phase 2 begin (`04b` depends on knowing what "distinct asset" means at the field level) |
| Offline maximum sync gap value defined (the threshold after which offline-unconfirmed warning activates on contracting actions) | ⬜ Not Started | `04` and `07` lock (both reference this threshold but neither can define it without Ops Lead input on real field operating conditions) |

---
## SECTION F — DEFERRED DOCUMENT REGISTER

> Evaluated and deliberately excluded from V1. Not forgotten. Revisit triggers defined.

| Doc Name | Source | Why Deferred | Revisit Trigger |
|----------|--------|--------------|-----------------|
| Technician QA Standard | 6-bucket analysis | Core QA behavior captured inside `10b` (SOP) and `09` (evidence standard) for V1. Standalone QA doc is V2 scope. | When technician count > 3 or quality variance becomes measurable across visits. |
| Sales Presentation Standard | 6-bucket analysis | `08c` (Close Mechanics) and `11g` (Tabletop Spec) together cover V1 sales presentation requirements. Standalone standard is V2. | When second sales role is onboarded. |
| Partner Packets (PM / Realtor) | 6-bucket analysis | Downstream of authority docs being locked. No formal referral partner relationship to govern yet. | When first formal referral partner agreement is signed. |
| Advanced Maintenance Lifecycle Docs | 6-bucket analysis | Requires historical session data to be meaningful. Premature without recurring customer history. | After first 50 recurring customers. |
| Full Training Manual | 6-bucket analysis | `07` (Field Workflow) and `08b` (Messaging Manifest) cover V1 onboarding requirements. Full manual is V2. | When onboarding a new technician from scratch without prior context. |
| Commercial Edge Cases | 6-bucket analysis | V1 is residential. Commercial has different system types, access constraints, and decision-maker dynamics. | When first commercial job is formally scoped. |
| `13_Field_Feedback_and_Optimization_Model` | Operator review | Critical long-term learning loop (finding frequency, recommendation acceptance, pricing acceptance rates). Not blocking V1. System must generate data before this document can be meaningful. | After 6 months of live field data. |

---

*End of Document — v0.4*

# Master Map v0.4 — Final Delta
**BHFOS / The Vent Guys**
**Type:** Delta document. Replaces `Map_v0.4_gate_delta.md` entirely. Apply to `00_Master_Document_Library_Map v0.3`.
**Date:** 2026-04-10

---

## PRE-DELIVERY: 3-ROUND PEER REVIEW OF v0.3 GATE DELTA

> Summary of what each review round caught before this final version was written.

### Round 1 — Structural Completeness

| ID | Finding |
|----|---------|
| M-R1-01 | `03` entity list was appended with only 3 new entities (Audit Event, QA Approval Event, Certificate Eligibility Record). The full Asset/Zone reference hierarchy (Structure, Zone, System, Equipment) was not added. "Distinct asset" remains undefined in the data model. |
| M-R1-02 | Tombstone class assignment rule was added to Section E but no actual class assignments were made for `11a–11h`. Rule without assignment is not actionable for Phase 5 authors. |
| M-R1-03 | `04` gate condition mentions offline hard-stop enforcement but does not define the offline window rule (what happens during an entirely offline session where a hard-stop push never arrives). |
| M-R1-04 | Delivery channel tracking — a significant technical requirement implied by tombstoning rules — is not called out as a `04c` gate requirement in the delta. |
| M-R1-05 | `evidence_class` attribute added to `04b` gate condition but not to `03` entity schema. It is a data model attribute on the Evidence entity, not just an enforcement rule. |

### Round 2 — Cross-Document Consistency

| ID | Finding |
|----|---------|
| M-R2-01 | `11b` (Estimate) tombstone class assignment requires noting the Class II → Class III transition at acceptance. Static class assignment is insufficient — the lifecycle-dependent nature must be stated. |
| M-R2-02 | `11d` (IAQ Report) is informational pre-decision but may be used as a compliance document in regulated contexts. The class assignment must note this conditional. |
| M-R2-03 | `09` gate condition delta does not include delivery channel tracking or context photo archive disposition, both of which are required by `00b` Section 6.3b. |
| M-R2-04 | `04b` gate condition referenced "evidence_class" parenthetically but did not name it as a first-class gate requirement. It is as important as the hard-stop read-only rule. |
| M-R2-05 | The `05c` authority hierarchy in the map was not updated to reflect the tombstone class hierarchy (Class I/II/III) as part of the authority chain for artifact conflict resolution. |

### Round 3 — Implementation Specificity

| ID | Finding |
|----|---------|
| M-R3-01 | Asset/Zone hierarchy must be expressed as a containment model, not just an entity list. Property → Structure → Zone → System → Equipment is a parent-child containment tree. The map's description of `03` must communicate this so the schema author builds it correctly. |
| M-R3-02 | `07` gate condition delta does not include the delivery channel tracking requirement. `07` governs how artifacts are delivered to customers — it must specify how delivery events are recorded for tombstone enforcement. |
| M-R3-03 | `04c` gate conditions from v0.3 are correct but incomplete: they do not include the `pending_supersession` state as an auditable event class. `pending_supersession` transitions and cancellations must be auditable. |

---

## PART B — FINAL CORRECTED DELTA CONTENT

> Apply every block below to `00_Master_Document_Library_Map v0.3` in order.

---

## 1. CHANGELOG ENTRY

Add to the top of the document:

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| v0.4 | 2026-04-10 | Lead Architect | Applied `00b` v1.2 inserts. Updated `03` with full Asset/Zone entity hierarchy + 3 new runtime objects + `evidence_class` attribute. Added `04b` dependency on `00b`. Updated `09` upstream to include `00b`. Assigned tombstone classes to all `11a–11h`. Updated gate conditions for `04b`, `04`, `07`, `09`, `04c`. Added 6 V-series critique items to Section A. |

---

## 2. SECTION A — NEW CRITIQUE ITEMS

Add under a new header `v0.3 → v0.4: Post-Operator Critique — 6 Items`:

| # | Severity | Issue | Disposition |
|---|----------|-------|-------------|
| V-01 | High | Artifact revocation / tombstoning absent. Superseded artifacts had no distribution enforcement. | Added `00b` Sections 9b.1–9b.5. Three artifact classes defined (Class I/II/III). `pending_supersession` state added. Delivery channel tracking requirement stated. Reopen-tombstone interaction defined. |
| V-02 | High | Status-level office authority undifferentiated. All hard-stop flags treated identically. | Replaced `00b` Section 3.6. Five hard-stop flags with differentiated continuation rules. `do_not_service` and `unsafe_entry_restriction` stop all activity; `payment_legal_hold` and `no_contracting_authority` block only new contracting. |
| V-03 | High | Sweep-to-context behavior undefined. | Added `00b` Section 6.3b. Evidence class split (`context` vs. `finding`), promotion as new record creation (not mutation), archive disposition, governance guardrails. |
| V-04 | Med | Tier 2 correction boundary too broad. Location corrections could sprawl. | Added `00b` Section 6.9b. Hard permit/prohibit list with asset-remapping rule. System enforcement language replacing UI prompt language. |
| V-05 | Med | Session-local precedence had no expiry or reconciliation enforcement. | Added `00b` Section 6.5b. Archive gate as state machine precondition. Reconciliation approver role defined. Full-offline edge case addressed. |
| V-06 | Low | Section 12.4 unnamed pricing authority. | Corrected to name `06_Pricing_Manifest_Framework` explicitly. |

---

## 3. SECTION B — DOCUMENT TABLE UPDATES

### 3a. Update `00b` Purpose Column

Replace existing `00b` purpose text with:

> Defines the system's end-to-end behavior as one coherent narrative. Covers: full lifecycle walkthrough; object mutation rules; lock points A–G; render trigger rules; pricing freeze behavior; artifact revocation and tombstoning by class (I/II/III) including `pending_supersession` state and reopen interaction; authority-class split for field/office conflicts (Class A / Class B / five differentiated Hard-Stop flags); sweep-to-context capture behavior with evidence class split and immutable promotion model; session-local reconciliation clock with archive gate enforcement; Tier 2 correction boundaries with system-enforced tier validation; runtime conflict resolution with named governing documents; downstream revalidation rules.

---

### 3b. Update `03` Purpose Column — Full Entity List

Replace the entity list portion of `03`'s purpose column with:

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

### 3c. Update `04b` Purpose Column

Append to existing `04b` purpose text:

> **State Enforcement Matrix requirements from `00b` v1.2:** (1) Five Hard-Stop flag fields confirmed as read-only in all states — no write path from TIS; (2) Evidence entity includes `evidence_class` attribute (`context` | `finding`) as a state-tracked property; (3) `archived` state transition gate includes Class A field reconciliation as a required precondition — this is a state machine constraint, not a UI validation; (4) `pending_supersession` artifact status is a valid state-trackable event; (5) Full-offline sync: hard-stop check is the first operation on connectivity resume before any session data commits.

---

### 3d. Add `11a–11h` Tombstone Class Column

> **Action:** Add a `Tombstone Class` column to the master table in Section B, between `Complexity` and `Status`.
> Apply the following assignments:

| Doc ID | Name | Tombstone Class | Notes |
|--------|------|-----------------|-------|
| `11a` | Clear Air Checklist | **Class I** | Informational. Superseded and flagged if findings change. |
| `11b` | Estimate / Proposal | **Class II → Class III** | Class II when presented pre-acceptance. Transitions to Class III at moment of customer acceptance. System must track this transition. Pre-acceptance and post-acceptance versions are governed by their respective class at time of action. |
| `11c` | Photo-Evidence Report | **Class I** | Informational evidence artifact. Superseded and flagged if evidence materially changes post-presentation. |
| `11d` | IAQ Report | **Class I** | Informational pre-decision. **Note:** In regulated contexts (mold, IAQ compliance requirements), this artifact may require Class II treatment at the direction of office. V1 default is Class I; escalation path to Class II must exist. |
| `11e` | Work Scope | **Class II** | Decision-bearing once presented to customer as part of accepted scope. Tombstoned if scope changes post-presentation. |
| `11f` | Clean Air Certificate | **Class III** | Authorization-bearing from issuance. Immediately non-executable when superseded. Delivery channel tracking required. |
| `11g` | Tabletop Presentation | **Class I** | Presentation artifact. Informational. Not independently actionable. Any pricing elements shown must originate from a locked Estimate artifact — the Tabletop does not independently bear pricing authority. |
| `11h` | Leave-Behind Packet | **Class I** | Post-visit informational reference. Superseded and flagged if underlying session data changes materially. |

---

## 4. SECTION C — BUILD ORDER GATE CONDITION UPDATES

### Phase 2 — `04b` (State Transition Model)

**Append to existing gate condition:**

> Additionally required: (1) Hard-Stop flag fields confirmed as read-only across all states with no TIS write path — each of the five flags validated individually; (2) Evidence entity `evidence_class` attribute (`context` | `finding`) included in the state-tracked schema; (3) `archived` transition precondition formally includes Class A reconciliation gate (pass / reject / defer-with-reason); (4) `pending_supersession` artifact status defined as a valid transition state for Class II and III artifacts; (5) Full-offline connectivity resume: hard-stop check defined as first sync operation.

---

### Phase 2 — `04c` (Audit Trail Spec)

**Append to existing gate condition:**

> Additionally required: (1) Delivery channel tracking defined as an auditable record type — system must record what channels were used to deliver each Class II and Class III artifact; (2) `pending_supersession` entry, cancellation, and successor-issuance transitions are auditable events; (3) Hard-stop flag activation, push, and technician notification are auditable events; (4) Offline hard-stop resolution on connectivity resume is an auditable event.

---

### Phase 2 — `04` (TIS Field and Sync Model)

**Append to existing gate condition:**

> Additionally required: (1) Appendix B must confirm all five Hard-Stop flags are read-only in TIS — write attempt generates error and audit event; (2) Hard-stop push on sync defined: TIS surfaces flag to technician immediately, applicable blocks enforce per Section 3.6 continuation rules; (3) Sync event payload includes `evidence_class` on all Evidence records; (4) **Offline hard-stop behavior defined:** If TIS is offline, hard-stop status cannot be confirmed. Maximum offline duration before offline-unconfirmed warning activates on contracting actions must be specified. On connectivity resume, hard-stop check is first sync operation. Any contracting actions taken during offline period that would have been blocked are flagged for office review. `do_not_service` and `unsafe_entry_restriction` override any prior authorization — work must stop even if previously authorized.

---

### Phase 3 — `07` (Field Workflow Spec)

**Append to existing gate condition:**

> Additionally required: (1) Sweep-to-context capture mode tap sequence and mode indicator defined; (2) Promotion workflow from context to finding-class evidence — accessible, low-friction, clearly labeled; (3) Hard-stop surface UX: what the technician sees for each of the five hard-stop flags, which actions become unavailable, how to contact office; (4) Offline-unconfirmed warning UX for contracting actions when hard-stop status cannot be confirmed; (5) Tier 2 vs. Tier 3 correction type selection at revision initiation; (6) **Delivery event recording:** `07` must specify how artifact delivery events are recorded so that tombstone enforcement can be applied to delivered artifacts. Every customer-facing artifact delivery is a recordable event.

---

### Phase 3 — `09` (Media Capture and Evidence Standard)

**Append to existing gate condition:**

> Additionally required: (1) `context` evidence class defined — labeling convention, storage behavior, exclusion from customer-facing renders, archive disposition (retained internally, not customer-accessible); (2) `finding` evidence class defined — minimum thresholds per finding type; (3) Explicit rule: context-class evidence does not count toward finding evidence minimums; (4) Promotion data operation defined in alignment with `00b` Section 6.3b: new `finding`-class record, source `context` record retained with `promoted_to` reference; (5) QA-reportable threshold for excessive context-only usage defined with a specific threshold (e.g., sessions where context photos exceed finding photos by more than X:1 ratio with fewer than Y promotions).

---

## 5. SECTION D — DEPENDENCY MATRIX UPDATES

Apply the following changes to the Section D dependency matrix:

### `00b` upstream (no change — still `01`, `02`)

### `00b` downstream — Update
**Find:** `00b` downstream: `` `03`, `05c`, `07` ``
**Replace with:** `` `03`, `04b`, `05c`, `07`, `09` ``

Rationale: `00b` v1.2 now defines evidence class split (`09` must implement), Hard-Stop flag behavioral rules (`04b` must enforce in State Enforcement Matrix), and tombstone classes/reopen interaction (`04b` state machine).

### `03` downstream — Update
**Find:** `03` downstream: `` `04b`, `05`, `06`, `07`, `09`, `10`, `11a–11h` ``
**Replace with:** `` `04b`, `04c`, `05`, `06`, `07`, `09`, `10`, `11a–11h` ``

Rationale: `04c` Audit Trail Spec directly depends on `03`'s entity schema (audit records reference entity types defined in `03`). Already present in v0.3 partially — confirm this is explicit.

### `04b` upstream — Update
**Find:** `04b` upstream: `` `03` ``
**Replace with:** `` `03`, `00b` ``

Rationale: `04b` State Enforcement Matrix depends on behavioral definitions in `00b` v1.2 (Hard-Stop class, evidence_class, tombstone interactions).

### `09` upstream — Update
**Find:** `09` upstream: `` `03`, `07` ``
**Replace with:** `` `03`, `07`, `00b` ``

Rationale: `09` must implement the evidence class split (`context` | `finding`) defined in `00b` Section 6.3b.

### `11b` — Add tombstone class note
Add to `11b` row: "Tombstone Class: II (pre-acceptance) → III (post-acceptance). System must track class transition at decision event."

---

## 6. SECTION E — MAP META UPDATE

**Find:** Review gate item 7 (added in v0.3): *"Tombstone class (I/II/III) is assigned to every document in the `11a–11h` output spec group before Phase 5 begins..."*

**Replace with:**

> (7) Tombstone class (I/II/III) is assigned to all documents in the `11a–11h` output spec group. Assignments are recorded in the master table (Tombstone Class column). `11b`'s lifecycle-dependent class (II → III at acceptance) is noted. `11d`'s regulated-context escalation path is noted. Phase 5 authors must treat these assignments as hard constraints: tombstone class must be referenced in each `11x` spec's `05` contract and declared in its `12` gate review.

---

## 7. OPEN ITEMS NOT YET RESOLVED

> Two items identified in the operator critique remain open. They are not resolved by this delta. They require dedicated attention before final lock.

| Item | Status | Required Before |
|------|--------|-----------------|
| `03` Asset/Zone schema fully specified (field-level definitions for Structure, Zone, System, Equipment and their relationship attributes) | ⬜ Not Started | Phase 2 begin (`04b` depends on knowing what "distinct asset" means at the field level) |
| Offline maximum sync gap value defined (the threshold after which offline-unconfirmed warning activates on contracting actions) | ⬜ Not Started | `04` and `07` lock (both reference this threshold but neither can define it without Ops Lead input on real field operating conditions) |

---

*End of Map v0.4 Final Delta*
*Apply `00b` v1.2 inserts first. Apply this delta second. Output full Map v0.4 third.*

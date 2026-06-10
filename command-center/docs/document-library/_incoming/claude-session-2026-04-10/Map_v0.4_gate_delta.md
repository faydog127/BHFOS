# Master Map v0.4 — Gate Condition Delta
**BHFOS / The Vent Guys**
**Type:** Delta document. Apply these changes to `00_Master_Document_Library_Map v0.3` to produce v0.4.
**Date:** 2026-04-10

> These are targeted updates only. All existing content in v0.3 not referenced here is unchanged.

---

## CHANGELOG ENTRY TO ADD

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| v0.4 | 2026-04-10 | Lead Architect | Applied `00b` v1.1 inserts. Updated gate conditions for `04b`, `04`, `07`, `09`. Updated `00b` and `04b` purpose descriptions. Added 3 entities to `03` description. Updated `05c` authority chain to include tombstone class reference. |

---

## SECTION A — NEW CRITIQUE ITEMS TO ADD

Append the following rows to the Section A table under a new header:
**v0.3 → v0.4: Post-Operator Critique — 6 Items**

| # | Severity | Issue | Disposition |
|---|----------|-------|-------------|
| V-01 | High | Artifact revocation / tombstoning absent. Superseded artifacts had no distribution enforcement — a customer could still act on a superseded signature-bearing document. | Added `9b.1–9b.4` to `00b` v1.1. Three artifact classes defined (Informational / Decision-Bearing / Authorization-Bearing) with distinct revocation obligations. |
| V-02 | High | Status-level office authority undifferentiated. All sync conflicts treated as same risk class. Authorization and compliance status fields required absolute office authority, not soft precedence. | Replaced `00b` Section 3.6 with Class A / Class B split + Hard-Stop Status Class. Added Section 6.5b reconciliation clock. |
| V-03 | High | Sweep-to-context behavior undefined. Burst-mode gating penalized over-documentation. New pattern needed that preserves speed without weakening QA evidence record. | Added `00b` Section 6.3b: Sweep to Context, with evidence class split (context vs. finding), promotion workflow, and governance guardrails. |
| V-04 | Med | Tier 2 correction boundary too broad. "Location correction" could sprawl into commercial and authorization territory without hard criteria. | Added `00b` Section 6.9b: Tier 2 Correction Boundaries with explicit permit/prohibit list. Asset/zone remapping across distinct units explicitly requires Tier 3. |
| V-05 | Med | Session-local precedence had no expiry or reconciliation mechanism. Field values could float indefinitely and become shadow master records. | Added `00b` Section 6.5b with reconciliation clock, archive gate requirement, and explicit Class A / Class B / Hard-Stop handling. |
| V-06 | Low | Section 12.4 named "pricing authority" without citing the governing document. Ambiguous in a multi-contributor system. | Corrected `00b` Section 12.4 to name `06_Pricing_Manifest_Framework` explicitly. |

---

## SECTION B — DOCUMENT TABLE UPDATES

### Update: `00b` Purpose Column

**Find:** Current `00b` purpose text in the table.
**Replace with:**

> Defines the system's end-to-end behavior as one coherent narrative. Covers: full lifecycle walkthrough (session create → inspection → estimate → presentation → decision → service → QA → certificate → archive), object mutation rules, lock points (A–G), render trigger rules, pricing freeze behavior, artifact revocation and tombstoning by class (I/II/III), authority-class split for field/office conflicts (Class A / Class B / Hard-Stop), sweep-to-context capture behavior, session-local reconciliation rules, Tier 2 correction boundaries, runtime conflict resolution, and downstream revalidation rules. Engineers cannot misinterpret independently-correct documents if this doc defines how they interact.

---

### Update: `03` Purpose Column — Add 3 Entities

**Find:** The entity list in `03`'s purpose column, which currently ends with: `"...Document Artifact."`
**Append:** `", Audit Event, QA Approval Event, Certificate Eligibility Record"`

Full entity list should now read:
> Customer, Property, Session, Finding, Evidence, Interpretation, Recommendation, Estimate Option, Document Artifact, Audit Event, QA Approval Event, Certificate Eligibility Record.

---

### Update: `04b` Purpose Column

**Find:** Current `04b` purpose text.
**Append the following sentence:**

> State Enforcement Matrix must additionally define: (1) Hard-Stop Status Class fields as read-only across all states; (2) evidence class attribute (context vs. finding) as a trackable Evidence object property; (3) Class A field reconciliation as a required condition for the `archived` state transition.

---

## SECTION C — BUILD ORDER GATE CONDITION UPDATES

Apply the following additions to the Gate Condition column for each document in Section C.

---

### Phase 2 — `04b` (State Transition Model)
**Current gate condition:** "All valid states and transitions defined. State Enforcement Matrix present and reviewed..."
**Append:**
> Additionally required before lock: (1) Hard-Stop Status Class fields confirmed as read-only in all states with no write path from TIS; (2) Evidence object includes `evidence_class` attribute (`context` | `finding`) in the state-tracked schema; (3) `archived` transition gate includes Class A reconciliation condition with explicit pass/defer/reject paths.

---

### Phase 2 — `04` (TIS Field and Sync Model)
**Current gate condition:** "Sync model complete. Appendix B (TIS Boundary Rules) reviewed and signed as hard build-stop constraint..."
**Append:**
> Additionally required before lock: (1) Appendix B explicitly states Class B fields have no write path in TIS — any write attempt errors and emits an audit event; (2) Hard-stop status push behavior defined: TIS must surface status to technician on next sync, contracting actions blocked immediately; (3) Sync event payload includes `evidence_class` on all evidence records; (4) Offline behavior for hard-stop push defined: if TIS is offline when a hard-stop activates, the hard-stop must be enforced on next connectivity event without manual intervention.

---

### Phase 3 — `07` (Field Workflow Spec)
**Current gate condition:** "Full technician journey documented. Speed Constraints section present..."
**Append:**
> Additionally required before lock: (1) Sweep-to-context capture mode fully specified in tap sequence and UX behavior; (2) Hard-stop status surface UX behavior defined — what the technician sees and what actions become unavailable; (3) Promotion workflow from context-class to finding-class evidence is defined and low-friction; (4) Tier 2 vs. Tier 3 correction classification prompt defined at revision initiation point in workflow.

---

### Phase 3 — `09` (Media Capture and Evidence Standard)
**Current gate condition:** "Photo requirements and minimum evidence-per-finding-type rules locked. QA personnel and at least one technician sign off..."
**Append:**
> Additionally required before lock: (1) `context` evidence class defined — labeling convention, storage behavior, exclusion from customer-facing outputs; (2) `finding` evidence class defined — minimum thresholds per finding type; (3) Explicit rule: context-class evidence does not count toward finding evidence minimums; (4) Promotion workflow from context to finding class technically specified; (5) QA-reportable threshold for excessive context-only usage defined.

---

### Phase 4 — `08c` (Close Mechanics Model)
**Current gate condition:** "Finding → Close Trigger Mapping present and reviewed..."
**Append:**
> Additionally required before lock: Close mechanics must not reference pricing values directly. All price references must route through `06`. Close framing may reference pricing tier names and relative value language, but may not hard-code amounts.

---

## SECTION D — DEPENDENCY MATRIX UPDATES

The following additions are required to Section D:

### Update `00b` downstream row:
**Find:** `00b` downstream column, which currently reads: `` `03`, `05c`, `07` ``
**Replace with:** `` `03`, `04b`, `05c`, `07` ``

Rationale: `00b` v1.1 now defines Hard-Stop Status Class, evidence class split, and tombstone artifact classes — all of which `04b` directly depends on for the State Enforcement Matrix. Add `04b` as a direct downstream of `00b`.

---

### Update `04b` upstream row:
**Find:** `04b` upstream column, which currently reads: `` `03` ``
**Replace with:** `` `03`, `00b` ``

Rationale: `04b` State Enforcement Matrix now directly depends on behavioral definitions in `00b` (Hard-Stop Class, evidence class, tombstone triggers). `00b` must be locked before `04b` is drafted.

---

### Add dependency note for `09`:
`09` now depends on `00b` for the evidence class (context vs. finding) split definition. The evidence class is defined in `00b` Section 6.3b. `09` must implement this class structure.

**Find:** `09` upstream row, which currently reads: `` `03`, `07` ``
**Replace with:** `` `03`, `07`, `00b` ``

---

## SECTION E — MAP META UPDATE

**Find:** The existing Review Gate clause (item 5): "every document's authority hierarchy position is known or deferred to `05c`"
**Append as item 7:**
> (7) Tombstone class (I/II/III) is assigned to every document in the `11a–11h` output spec group before Phase 5 begins. This assignment is part of each `11x` document's `12` gate review. No output document spec is lockable without a tombstone class declaration.

---

*End of Map v0.4 Gate Delta*
*Apply inserts to `00b` first. Apply this delta to the map second. Output full v0.4 map third.*

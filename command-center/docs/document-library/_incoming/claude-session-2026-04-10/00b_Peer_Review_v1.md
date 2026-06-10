# 00b — System Behavior Spec: Peer Review
**BHFOS / The Vent Guys**
**Review Level:** 2nd-Level (Post-Draft, Pre-Lock)
**Document Under Review:** `00b_System_Behavior_Spec` Draft v1.0
**Reference Document:** `00_Master_Document_Library_Map` v0.3
**Reviewer Role:** Lead Systems Architect
**Date:** 2026-04-10

---

## PART 1 — COMPARE AND CONTRAST: SPEC vs. DELIVERY

> What the map (`00_Master_Document_Library_Map v0.3`) defined `00b` to be, and what the draft actually delivered.

### 1.1 Scope Fulfillment

| Required (per Map v0.3) | Delivered in Draft v1.0 | Verdict |
|-------------------------|------------------------|---------|
| Full lifecycle walkthrough (inspection open → estimate → report → close → certificate) | Sections 6.1–6.15. 15-stage narrative. More granular than specified. | ✅ Exceeds spec |
| Object movement through the system | Sections 4, 7 (mutation rules by object type) | ✅ Met |
| Mutation rules — when data is mutable vs. read-only | Section 7, with per-state and per-object breakdowns | ✅ Met |
| Trigger points — what fires a render, sync, and lock | Sections 8 (Lock Points A–G), 9 (Render Trigger Rules) | ✅ Exceeds spec |
| Connective tissue between architecture and schema | Section 3 (Runtime Principles), Section 12 (Conflict Resolution) | ✅ Exceeds spec |
| Pricing freeze behavior | Section 10 — not specified in map, delivered anyway | ✅ Exceeds spec |
| Audit trigger requirements | Section 11 — not specified in map at this layer, delivered anyway | ⚠️ Exceeds spec but creates conflict with `04c` (see R-08) |
| Runtime conflict resolution | Section 12 — not anticipated in map | ✅ Valuable addition |
| Downstream revalidation rules | Section 13 — not anticipated in map | ⚠️ Valuable but creates a second dependency matrix (see R-09) |
| Open questions list | Section 15 — not anticipated in map | ✅ Strong practice |
| Draft-to-lock readiness criteria | Section 14 — not anticipated in map | ✅ Strong practice |

**Overall scope verdict:** The document delivers everything the map required and adds significant value beyond it. The excess content is mostly correct. The two flagged `⚠️` items require structural resolution before lock, not deletion.

---

### 1.2 Dependency Compliance Check

> The map states `00b` depends on `01` (System Architecture Overview) and `02` (V1 Scope and Boundaries). `03` depends on `00b`. `05c` depends on `00b`. `07` depends on `00b`.

| Dependency Check | Finding |
|-----------------|---------|
| Does `00b` explicitly reference `01`? | ❌ No. `01` is never cited. `00b` defines architectural behavior but doesn't anchor itself to the architecture doc. |
| Does `00b` explicitly reference `02`? | ❌ No. The V1 Scope boundary is never mentioned. Nothing in `00b` says "this document governs V1 behavior only." |
| Does `00b` define behavior that `03` needs? | ✅ Yes. Section 4 lists runtime objects that `03` must formalize. |
| Does `00b` define flow that `07` must follow? | ✅ Yes. Sections 6, 8, and 9 describe the lifecycle `07` must execute in the field. |
| Does `00b` provide the conflict resolution basis that `05c` needs? | ✅ Yes. Section 12 partially overlaps with `05c`'s authority chain. (Requires coordination — see R-10.) |

**Dependency compliance verdict:** `00b` functions correctly as upstream of `03`, `05c`, and `07`. It fails to anchor itself to its own upstream (`01`, `02`). This is a structural deficiency, not a content deficiency.

---

### 1.3 New Content Not in the Map

The draft introduces content categories not anticipated in the map. These are net-positive additions but each requires a disposition:

| Content Added in `00b` Not in Map | Disposition Required |
|-----------------------------------|----------------------|
| 3 new Runtime Objects: Audit Event, QA Approval Event, Certificate Eligibility Record | `03`'s entity list in the map is incomplete. Must be updated before `03` is drafted. **Map update required.** |
| Pricing Behavior Rules (Section 10) | Valuable. Ensure this does not conflict with `06` (Pricing Manifest Framework). `06` is pricing truth. `00b` is behavioral framing only. |
| Audit Trigger Requirements (Section 11) | Scope overlap with `04c`. Requires structural resolution. |
| Downstream Revalidation Rules (Section 13) | Scope overlap with Map Section D. Requires structural resolution. |
| Runtime Conflict Resolution (Section 12) | Partially overlaps with `05c` authority hierarchy. Both can coexist if scoped correctly. |

---

## PART 2 — DEEP DIVE PEER REVIEW

> Findings organized by severity. Severity = impact on system integrity if unresolved before build.
> **Severity Key:** 🔴 Critical (build blocker) | 🟠 High (lock blocker) | 🟡 Medium (must address before Phase 5) | 🔵 Low (address before final archive)

---

### 🔴 CRITICAL — Build Blockers

These items block `04b`, `04c`, and `03` from being drafted correctly. They are not stylistic. They are engineering constraints.

---

**R-01: "Material" is undefined. It appears 12+ times and governs the entire audit boundary.**

Location: Sections 6.3, 6.4, 6.5, 6.6, 6.7, 6.8, 6.9, 7.x, 11.x throughout.

The word "material" determines when an audit event fires. It is the single most consequential word in this document. It appears in contexts like "material post-sync edits," "material change after presented," "materially changed," "material revision" — but it is never defined.

Examples of ambiguity this creates:
- Is changing a finding severity from 3 to 4 "material"?
- Is correcting a typo in a finding description "material"?
- Is adding a second photo of the same finding "material"?
- Is adding an interpretation note "material"?

If engineers define "material" differently, the audit trail will be inconsistent. One engineer will audit severity changes. Another won't. A third will audit everything. The audit trail becomes legally useless.

**Required fix:** Add a definition section (or at minimum a definitional note in Section 3 under Core Principles) that states:

> A "material change" is any modification that: (a) alters a value used to calculate or recommend a customer-facing output, (b) changes a severity classification, (c) adds or removes a finding or evidence record, or (d) affects the data basis of any customer-presented artifact. Formatting corrections, typo fixes, and internal admin notes that do not affect any of (a)–(d) are non-material.

This definition must then be referenced by `04c` as the governing rule for what gets audited.

---

**R-02: Open Question 3 is not an open question — it is a hard blocker for `04b` and `04c`.**

Location: Section 15, Question 3: "What exact persistence threshold defines transition from transient draft finding to auditable saved finding in TIS?"

This is not a question to resolve later. Lock Points A (Persisted Field Capture Threshold) and B (Sync Authority Threshold) are defined in Section 8, but their trigger conditions are empty without an answer to this question.

Lock Point A says it is "triggered when draft findings/evidence have crossed into persisted inspection record territory." But if there is no answer to when that crossing happens, Lock Point A has no trigger. If Lock Point A has no trigger, audit records will not fire consistently. If audit records don't fire consistently, `04c` is unimplementable.

This is a prerequisite for `04b`. `04b` defines state-based permissions. Those permissions depend on knowing when a finding becomes "persisted." Until this is resolved, `04b` and `04c` cannot be drafted.

**Required fix:** Escalate Question 3 to a **pre-Phase-2 blocker.** It must be resolved before `04b` is touched. Suggested resolution path: Ops Lead + Lead Eng define together what "persisted" means operationally in TIS (e.g., "a finding is persisted when the technician explicitly saves it OR when TIS writes to local storage on screen exit, whichever occurs first"). Lock that decision in `04b`'s first draft.

---

**R-03: The `declined` path is completely unspecified.**

Location: Section 5 (state list item 8: "`work_authorized` or `declined`"), Section 6.10.

The lifecycle narrative covers `declined` as a branch point. Nothing is said after that. The `declined` branch has real operational implications:

- Does a declined session move to `archived` immediately?
- Is there a follow-up task generated?
- Can a declined session be re-activated (customer changes their mind next week)?
- What is the status of the customer-presented artifacts after decline?
- Is there a "pending re-contact" state?
- Does the decline reason get captured?

This is not an edge case. Residential service businesses have a non-trivial decline rate. The declined session workflow is a first-class operational path, not an afterthought.

**Required fix:** Add Section 6.10b (or a subsection to 6.10): "Declined Session Behavior." Define: (1) immediate state after decline, (2) archive timing, (3) re-activation rules (if any), (4) artifact status, (5) follow-up workflow trigger. This decision requires Ops Lead sign-off.

---

**R-04: Three runtime objects introduced in Section 4 are not in `03`'s entity list per the map.**

Location: Section 4 — `Audit Event`, `QA Approval Event`, `Certificate Eligibility Record`.

The map's description of `03` (Canonical Data Model) lists these entities: Customer, Property, Session, Finding, Evidence, Interpretation, Recommendation, Estimate Option, Document Artifact. It does not include Audit Event, QA Approval Event, or Certificate Eligibility Record.

If these three objects are not added to `03`, one of the following is true:
- Audit Events have no field schema (engineers will invent schemas independently, producing inconsistency)
- QA Approval Events have no governed structure (QA will be implemented differently in TIS vs. BHFOS)
- Certificate Eligibility Records have no defined data requirements (certificate issuance logic has no authoritative data model)

The Projection Principle (Section 3.2) states: "All customer-facing documents are projections of governed system data." The certificate is a customer-facing document. If Certificate Eligibility Record isn't in `03`, the certificate has no governed data to project from.

**Required fix:** The `00_Master_Document_Library_Map v0.3` must be updated: `03`'s entity list in Section B must be expanded to include Audit Event, QA Approval Event, and Certificate Eligibility Record. This is a map update, not a `00b` update.

---

### 🟠 HIGH — Lock Blockers

These items must be resolved before `00b` can be locked. They do not block Phase 2 immediately but will cause downstream contradiction if unaddressed.

---

**R-05: `00b` does not reference its upstream dependencies `01` and `02`.**

Location: Sections 1 (Purpose), 2 (Scope).

The map states `00b` depends on `01` (System Architecture Overview) and `02` (V1 Scope and Boundaries). Neither document is referenced anywhere in `00b`.

Consequences:
- If `01` defines the BHFOS/TIS boundary differently than `00b` implies in Section 3.6 (Office System Authority Principle), there is no mechanism to detect the conflict.
- If `02` changes the V1 scope boundary (e.g., a state is deferred to V2), `00b` has no marker to indicate that some of its lifecycle states may be out of scope.
- Section 2 (Scope) says this document applies to "all V1 session-linked output documents" but makes no reference to how it knows what V1 includes.

**Required fix:** Add explicit `01` and `02` citations to Section 1 or Section 2. Minimum: a paragraph in Section 2 stating: "This document's behavior model is bounded by `02_V1_Scope_and_Boundaries`. Any lifecycle state, object, or behavior described here that falls outside V1 scope must be explicitly noted as deferred. This document also reflects the BHFOS/TIS responsibility split as defined in `01_System_Architecture_Overview`."

---

**R-06: Section 11 (Audit Trigger Requirements) creates a maintenance conflict with `04c`.**

Location: Sections 11.1–11.7 and the closing note: "These mandatory events must be implemented in `04c`."

The structure is: `00b` defines the full list of audit events, then delegates implementation to `04c`. This creates two sources of truth for what gets audited — one in `00b` and one in `04c`. If `04c` adds an event not in `00b`, or if `00b` is updated and `04c` isn't, the lists diverge.

**Required fix:** Section 11 of `00b` must be scoped to **rationale and categories only** — why each class of event is auditable, not the implementation-level event list. The specific named events (e.g., "finding severity changed," "estimate superseded") belong exclusively in `04c`. `00b` Section 11 should say: "The following categories of system events are mandatory audit targets. Complete event definitions, record structure, and implementation requirements are owned by `04c_Audit_Trail_Spec`."

This preserves the architectural intent of `00b` (behavior narrative) without creating a duplicate list that can drift.

---

**R-07: Section 13 (Downstream Revalidation Rules) creates a parallel dependency matrix.**

Location: Sections 13.1–13.5.

The `00_Master_Document_Library_Map v0.3` Section D is the canonical dependency matrix. Section 13 of `00b` is an independent revalidation matrix. They cover overlapping territory but are not identical. In particular, Section 13.3 lists `04c` as a direct revalidation target of `00b`. The map does not show `00b → 04c` as a direct dependency.

Two dependency matrices maintained independently will drift within weeks.

**Required fix:** Section 13 should be restructured as a pointer, not a parallel matrix. Replace with: "When this document changes, the revalidation impact must be assessed against `00_Master_Document_Library_Map Section D`. Any document that directly depends on `00b` (currently: `03`, `05c`, `07`) must be reviewed. Any document that transitively depends on `00b` through `03` must be checked for behavioral consistency. The full dependency chain is maintained in the map." Then note only the non-obvious revalidation dependencies not captured in the map (e.g., Section 13.4 and 13.5 are fine to retain as they flag non-obvious revalidation paths for `06`, `08b`, `08c` changes).

---

**R-08: Lock Point A trigger is undefined in implementation terms.**

Location: Section 8, Lock Point A — "Persisted Field Capture Threshold."

Description: "Triggered when draft findings/evidence have crossed into persisted inspection record territory."

This is connected to R-02 but distinct from it. Even if Open Question 3 is resolved at the conceptual level, Lock Point A must be defined in terms that an engineer can implement. "Persisted inspection record territory" is not an implementation signal. The trigger must be expressed as a system event or a data state transition.

Options:
- TIS writes finding to local persistent storage → triggers persistence?
- Technician explicitly saves?
- TIS sync heartbeat returns success?
- Time-based (all findings auto-persist after N minutes)?

**Required fix:** Once Question 3 is answered (R-02), Lock Point A must be restated as an implementable trigger condition. Add to Section 8, Lock Point A: "**Implementation trigger:** [to be completed after Question 3 is resolved]. Until this is defined, Lock Point A has no enforceable trigger."

---

**R-09: Offline / connectivity failure behavior is completely absent.**

This is not a minor edge case. TIS is a field app. Technicians work in basements, attics, and mechanical rooms. Persistent offline is a first-class operating condition.

Missing entirely:
- Where are audit events held when offline? (local queue? TIS local storage?)
- When do offline-generated audit events sync?
- What is the audit trail continuity rule during a multi-hour offline session?
- If a finding is created, modified, and deleted entirely within an offline period — does it appear in the audit trail at all?
- What happens if sync fails repeatedly (e.g., session spans multiple days offline)?

Section 6.5 handles successful sync. There is no corresponding section for sync failure, partial sync, or extended offline operation.

**Required fix:** Add Section 6.5b: "Sync Failure and Offline Behavior." Define at minimum: audit event queuing during offline, eventual-consistency rules for delayed sync, and conflict resolution when TIS and BHFOS have diverged during an offline period. This section must be co-authored with the `04` (TIS Sync Model) author.

---

**R-10: Section 12 (Runtime Conflict Resolution) is incomplete and partially redundant with `05c`.**

Location: Sections 12.1–12.5.

Issues:

**A — "Pricing authority wins" (12.4) doesn't name the authority document.** `06` is the Pricing Manifest Framework. It should be cited explicitly. "Pricing authority" is ambiguous — it could mean the manifest, it could mean the sales lead, it could mean the estimate output. State it: "`06_Pricing_Manifest_Framework` governs all pricing truth."

**B — The conflict chain is missing sync behavior conflict.** What happens when `04` (Sync Model) implies a behavior that conflicts with `07` (Field Workflow)? Who wins? Currently undefined.

**C — `00b`'s conflict resolution in Section 12 partially overlaps with `05c` (Document Authority Hierarchy).** `05c` defines the ranked authority chain for all documents. `00b` Section 12 defines runtime conflict resolution for behavioral overlaps. These are not the same problem but they use similar language. Without a clear scope boundary between them, contributors will consult one when they should consult the other.

**Required fix:**
- 12.4: Replace "pricing authority" with "`06_Pricing_Manifest_Framework`."
- Add 12.6: "Sync Behavior Conflict — if `04` and `07` conflict on sync timing, `04` governs sync mechanics, `07` governs field interaction with sync. Neither overrides the other on the other's domain."
- Add a note at the top of Section 12: "This section governs **runtime behavioral conflicts** — conflicts arising during system execution. It does not govern document-level authority conflicts, which are owned by `05c_Document_Authority_Hierarchy`. Consult `05c` for questions of which document wins when their static content disagrees."

---

### 🟡 MEDIUM — Must Address Before Phase 5

These items will not block Phases 2–4 but will cause output document spec errors if unresolved before Phase 5 begins.

---

**R-11: `synced_reviewable` has no defined initiation mechanism.**

Section 6.5 says the session enters `synced_reviewable` after sync. But it never says: who or what initiates the move FROM `synced_reviewable` to interpretation/recommendation assembly? Is this automatic? Does an office user need to explicitly "accept" the synced record? Is there a validation gate?

If it's automatic: what conditions must pass before auto-advance?
If it requires a human: which role? What do they verify?

This gap means `04b` will have an under-specified state transition.

---

**R-12: Section 6.9 (Reopen / Revision Behavior) — the two revision paths are not distinguished by rule.**

The section defines two actions:
1. Reopen mutable source objects → regenerate downstream as new version
2. Create corrected successor artifacts while preserving priors

It does not say when the system chooses option 1 vs. option 2. Is this a role-based decision? A state-based decision? The answer matters for `04b` (which handles state transitions) and `11x` specs (which handle artifact supersession).

The practical distinction is probably: if the session state allows reopening (Option 1), reopen. If the session is past a point where reopening is operationally disruptive (post-acceptance, post-QA), use successor artifact logic (Option 2). If that's the rule, state it explicitly.

---

**R-13: Render trigger "minimum source data preconditions" are enumerated nowhere.**

Section 9.1 says: "A document artifact may be rendered only when its minimum source data preconditions are satisfied." But those preconditions are never listed — not even at a high level.

This will cause every Output Spec author (Phase 5) to invent their own preconditions independently. The `11a` author will define one threshold. The `11d` author will define a different one. They will be inconsistent.

At a minimum, `00b` should provide a precondition framework for each artifact class:
- Checklist: minimum N findings with evidence attached
- Photo-Evidence Report: minimum evidence-per-finding-type per `09`
- Estimate: pricing manifest populated, scope defined
- Certificate: `qa_approved` state + completion evidence present

These don't need to be exhaustive. They need to establish the pattern that `11x` specs must fill in.

---

**R-14: Section 6.11 (Authorized Work Execution) is structurally thin.**

The section covers the basic concept but leaves critical gaps:
- No definition of "change order" (mentioned twice in `00b` without definition)
- No rule for who can authorize scope changes during work execution
- No definition of what constitutes a scope violation (work performed outside authorized scope)
- No audit requirement for scope change events listed in Section 11.7

If a technician performs unauthorized work, what happens to the record? This is a legal and operational exposure.

---

**R-15: Section 14, Criterion 7 is not verifiable.**

"Technician workflow in `07` can execute this behavior without contradiction."

A criterion that says "can" with no defined verification method is not a criterion — it is a hope. Before this document can be locked, there must be a formal cross-walk: every lifecycle stage in `00b` Section 6 mapped against the corresponding step in `07` Field Workflow Spec, with explicit sign-off. Until `07` exists, this criterion cannot pass. This is correct behavior (Phase 3 follows Phase 1), but the criterion should acknowledge this explicitly: "This criterion cannot pass until `07` is drafted and cross-walked against this document."

---

### 🔵 LOW — Address Before Final Archive

---

**R-16: No changelog.**

The document is "Draft v1.0" but has no version history table. Section 13 establishes that changes to `00b` trigger widespread revalidation. Without a changelog, there is no way to know which version triggered which revalidation cascade.

---

**R-17: Principles 3.3 (No Silent Mutation) and 3.7 (Explicit Reopen) are functionally the same principle at different lock thresholds.**

Both say: changes must be visible and traceable. The difference is: 3.3 says it generically, 3.7 says it specifically for post-lock behavior. Consider folding 3.7 into 3.3 as a "post-lock corollary" to reduce the principles list to 6 and avoid contributor confusion about which principle governs a given situation.

---

**R-18: Section 4 has no containment hierarchy.**

Runtime Objects are listed flat. Containment context (Session contains Findings, Findings have Evidence) is missing. Even a one-line hierarchy note would help contributors avoid building models where a Finding accidentally exists without a Session parent.

---

**R-19: Lock Point C has an edge case: informal verbal pricing.**

If a technician verbally states a rough price before the formal estimate is rendered, has Lock Point C triggered? Operationally, informal prices happen. The system's rule is only about rendered estimates — but if a customer later disputes a quoted price that was never formally rendered, the system has no record of it. Consider adding a note: "Informal verbal pricing by field technicians is outside the system's governance boundary. Only rendered estimate artifacts constitute governed price commitments."

---

## PART 3 — ITEMS REQUIRING MAP UPDATE

> Issues in `00b` that require updates to `00_Master_Document_Library_Map v0.3`, not just to `00b`.

| Map Update Required | Reason | Section in Map |
|--------------------|--------|----------------|
| `03` entity list must include: Audit Event, QA Approval Event, Certificate Eligibility Record | `00b` Section 4 introduces these as runtime objects. They require field schemas in `03`. | Section B, Doc `03` Purpose column |
| Dependency `00b → 04c` may need to be added directly | Section 13.3 implies `00b` changes trigger `04c` revalidation. Map currently shows `04c` depending on `03`, `04b` only. | Section D, `04c` upstream row |
| `00b` Purpose description should note pricing and audit behavior coverage | Map says "full lifecycle walkthrough, object movement, mutation rules, trigger points." Draft delivers pricing freeze rules and audit trigger categories not anticipated. These are scope expansions that the map should acknowledge. | Section B, Doc `00b` Purpose column |

---

## PART 4 — WHAT IS GENUINELY STRONG

> Recorded here because peer review that only identifies problems is not useful. These elements should not be changed.

**Section 3 — Core Runtime Principles:** The 7 principles are clean, testable, and non-overlapping (with the minor exception noted in R-17). "Regenerate, Do Not Hand-Edit" alone will prevent dozens of engineering arguments about whether to mutate an artifact in place or regenerate it. Keep this section.

**Section 8 — Lock Points A–G:** Naming lock points is a technique most systems skip. They describe "frozen states" but not the exact moment the freeze begins. The named lock points create shared language between engineering and operations. "We're past Lock Point D" is a meaningful statement. Keep and expand this model.

**Section 10 — Pricing Behavior Rules:** The distinction between working pricing and presented pricing is precise. Section 10.3 (every post-presentation price change requires a new version + audit entry + updated decision linkage) is the exact rule needed to make the estimate legally defensible. This section is stronger than most commercial systems produce. Keep it.

**Section 12.5 — Output Conflict:** "If a customer-facing artifact implies behavior not supported by source data or state rules, the output artifact is wrong and must be revised." This is the cleanest statement of document authority in the system. Every output document spec author should have this printed and posted. Keep it.

**Section 15 — Open Questions:** Five questions listed, each crisp and decision-requiring. This is the right format. The only change needed is escalating Question 3 to a blocker status (R-02).

**Section 16 — Bottom-Line Operating Rule:** "The system may be flexible before customer truth is established. After customer truth is established, the system must become explicit, versioned, and auditable." This is the controlling philosophy statement of the entire system. It should be in the document header, not the footer.

---

## PART 5 — REMEDIATION PRIORITY ORDER

> Recommended sequence for addressing findings before lock.

| Priority | Finding | Action Required | Owner |
|----------|---------|-----------------|-------|
| 1 | R-01 | Define "material change" in Section 3 | Lead Architect + Ops Lead |
| 2 | R-02 | Escalate Question 3 to Phase 2 blocker. Resolve before `04b` begins | Lead Eng + Ops Lead |
| 3 | R-03 | Add Section 6.10b: Declined Session Behavior | Ops Lead |
| 4 | R-04 | Update Map v0.3: add 3 new entities to `03` description | Lead Architect |
| 5 | R-05 | Add `01`/`02` citations to Section 1 and Section 2 | Lead Architect |
| 6 | R-06 | Restructure Section 11 to categories only; delegate event list to `04c` | Lead Architect + Lead Eng |
| 7 | R-07 | Replace Section 13 with pointer to Map Section D; retain only non-obvious revalidation paths | Lead Architect |
| 8 | R-08 | Mark Lock Point A trigger as "pending resolution of Question 3" | Lead Eng |
| 9 | R-09 | Add Section 6.5b: Sync Failure and Offline Behavior | Lead Eng |
| 10 | R-10 | Name `06` explicitly in 12.4; add 12.6; add scope boundary note at top of Section 12 | Lead Architect |
| 11 | R-11 | Define `synced_reviewable` initiation mechanism | Lead Eng + Ops Lead |
| 12 | R-12 | Define decision rule for reopen (Option 1) vs. successor artifact (Option 2) in Section 6.9 | Lead Architect |
| 13 | R-13 | Add precondition framework per artifact class to Section 9 | Lead Architect |
| 14 | R-14 | Expand Section 6.11 with change order definition and scope violation rule | Ops Lead |
| 15 | R-15 | Restate Criterion 7 as Phase-3-gated verification, not open aspiration | Lead Architect |
| 16 | R-16 | Add changelog table | Lead Architect |
| 17 | R-17 | Consider merging Principles 3.3 and 3.7 | Lead Architect |
| 18 | R-18 | Add one-line containment hierarchy to Section 4 | Lead Eng |
| 19 | R-19 | Add verbal pricing boundary note to Lock Point C | Ops Lead |

---

## PART 6 — LOCK READINESS ASSESSMENT

| Criterion | Status |
|-----------|--------|
| All Critical findings resolved | ❌ 4 Critical findings open (R-01 through R-04) |
| All High findings resolved | ❌ 6 High findings open (R-05 through R-10) |
| `01` and `02` explicitly cited | ❌ Missing |
| "Material change" defined | ❌ Missing |
| Declined path specified | ❌ Missing |
| New runtime objects added to Map `03` description | ❌ Map update required |
| Section 11 restructured to avoid `04c` duplication | ❌ Pending |
| Section 13 restructured to avoid Map Section D duplication | ❌ Pending |
| Offline behavior specified | ❌ Missing |
| Open Question 3 escalated and resolved | ❌ Blocker for `04b` |

**Lock readiness: NOT READY.**

The document is the right document. The structure is correct. The lifecycle narrative is strong. The pricing and audit behavior rules are genuinely valuable. But it cannot be locked in its current state because four critical items are undefined, and two of those items (R-01: "material" undefined, R-02: persistence threshold undefined) will produce irreconcilable disagreements during Phase 2 build.

**Recommended path to lock:** Address R-01 through R-05 first. These five changes convert the document from "strong draft" to "lockable spine." The remaining 14 items can follow in the background as `04b`, `04c`, and `07` are being drafted.

---

*End of Peer Review — `00b` Draft v1.0*
*Next action: Author addresses R-01 through R-05, resubmits for re-review before Phase 2 begins.*

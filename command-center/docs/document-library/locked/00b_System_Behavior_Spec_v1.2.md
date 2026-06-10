# 00b — System Behavior Spec
**BHFOS / The Vent Guys**  
**Status:** ✅ Locked v1.2  
**Owner:** Lead Architect + Lead Engineer  
**Last Updated:** 2026-04-10

---

## 1. Purpose

This document defines how the system behaves end-to-end as one coherent operating model.

It exists to eliminate interpretation drift between architecture, schema, workflow, sync behavior, pricing behavior, audit behavior, and output rendering.

This document is the source of truth for:
- lifecycle narrative
- object creation and mutation timing
- lock behavior
- render trigger behavior
- sync trigger behavior
- pricing freeze behavior
- document regeneration behavior
- audit trigger requirements

This document does **not** replace:
- `03_Canonical_Data_Model` as truth of structure
- `04b_State_Transition_Model` as truth of valid states and permissions
- `05c_Document_Authority_Hierarchy` as truth of document conflict resolution

It defines how those systems interact in runtime.

## 2. Scope

This document governs the full runtime flow from:

`session creation → inspection execution → findings capture → recommendation assembly → estimate generation → customer presentation → decision capture → service completion → QA closeout → certificate issuance → archive`

It applies to:
- BHFOS
- TIS field behavior
- all V1 session-linked output documents
- all pricing-bearing artifacts
- all auditable state-changing actions

It does not define UI layout or copywriting language except where behavior requires timing or lock logic.

---

## CHANGELOG

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| v1.2 | 2026-04-10 | Lead Architect | 3-round peer review of v1.1 inserts applied. Corrected: hard-stop continuation rules differentiated by flag type; promotion defined as new record creation (not mutation); archive reconciliation gate defined as state machine precondition; Tier 2 enforcement language corrected from UI to system enforcement; Asset/Zone dependency noted in 6.9b; `pending_supersession` state added; delivery channel tracking requirement stated explicitly; downstream tombstone table completed for all `11x` artifacts; reopen-tombstone interaction defined. |

---

## 3. Core Runtime Principles

### 3.1 Single Session Principle
A session is the governing runtime container for one visit or one service event.
All findings, evidence, recommendations, pricing options, render events, state changes, and completion records are attached to a session.

### 3.2 Projection Principle
All customer-facing documents are projections of governed system data. No output document creates truth. It only expresses truth already established elsewhere.

### 3.3 No Silent Mutation Principle
Any meaningful business change after initial capture must either:
- remain editable because the session is still in an allowed mutable state, or
- create an auditable update event because the session crossed a lock-sensitive threshold.

No material change may occur invisibly.

### 3.4 Controlled Freeze Principle
Not all data freezes at once.
Different objects lock at different moments based on operational risk.
Example:
- raw notes may remain editable longer than pricing
- pricing freezes earlier than final archival
- certificate eligibility freezes only after QA approval

### 3.5 Regenerate, Do Not Hand-Edit Principle
Generated outputs may be regenerated from source data, but not manually altered to introduce new business truth.
If an output changes, the source data must change first, then the output re-renders.

### 3.6 Office System Authority Principle

TIS may capture field data and initiate field actions, but BHFOS remains the authority for record permanence, pricing truth, final document generation, final history, and final audit continuity.

**Authority-Class Split:**

| Class | Field Covering | Conflict Resolution |
|-------|---------------|---------------------|
| A — Operational Convenience | Contact phone, visit notes, scheduling preferences, access instructions, prep notes | Field holds session-local precedence for active session. Reconciliation required before archive. Office master record is not updated until approved. |
| B — Authorization and Compliance Status | Service authorization status, contract authority confirmation, compliance flags, payment holds, safety restrictions | Office wins absolutely. TIS is read-only on Class B fields. No write path exists from TIS. |

**Hard-Stop Status Class (strict subset of Class B):**

Hard-stop flags are enumerable status values stored as discrete fields on the Customer or Property record. When any hard-stop flag is active, TIS enforces the corresponding block.

| Flag | Storage Model | Continuation Rule |
|------|--------------|-------------------|
| `do_not_service` | Boolean field on Property | **Stop all activity.** No continuation exception. Technician must cease work immediately and contact office. |
| `unsafe_entry_restriction` | Boolean field on Property | **Stop all activity.** No continuation exception. Safety reason. No entry or continuation permitted. |
| `compliance_restriction` | Boolean field on Property/Customer | **Block new contracting and document issuance.** Continuation of formally authorized in-progress work deferred to office determination. Office must be contacted before any further field action. |
| `no_contracting_authority` | Boolean field on Customer | **Block contracting actions only.** Estimate presentation, work authorization, and document issuance blocked. Active service already formally authorized may continue to completion. |
| `payment_legal_hold` | Boolean field on Customer | **Block contracting actions only.** Same rule as `no_contracting_authority`. Active authorized service may continue. Certificate issuance blocked until hold cleared. |

Rules governing all hard-stop flags:
- Hard-stop flags may only be set or cleared by an authorized BHFOS office user.
- TIS may not clear, override, or bypass any hard-stop flag.
- When a hard-stop flag activates during an active session, it is pushed to TIS on next sync. TIS must surface it to the technician immediately.
- **Offline hard-stop rule:** If TIS cannot confirm current hard-stop status due to offline condition, any contracting action (estimate presentation, work authorization) must display an explicit offline-unconfirmed warning. If offline duration exceeds the maximum sync gap defined in `04`, the technician must contact office to confirm authorization status before proceeding with contracting actions.
- For `do_not_service` and `unsafe_entry_restriction` activated during in-progress work: technician must be directed to stop, contact office, and await instruction. Prior authorization does not continue.
- For `no_contracting_authority` and `payment_legal_hold` activated during in-progress work: formally authorized scope may continue to completion, but no new authorizations, estimates, or document issuances may proceed. Office notification is required.
### 3.7 Explicit Reopen Principle
If a locked or presented record requires material revision, the system must explicitly reopen or version the affected object. It may not simply overwrite the prior business state.

---

## 4. Runtime Objects

The following objects participate in session behavior.

- Customer
- Property
- Session
- Finding
- Evidence
- Interpretation
- Recommendation
- Estimate Option
- Document Artifact
- Audit Event
- QA Approval Event
- Certificate Eligibility Record

Field-level definitions belong in `03`.
This document only governs runtime behavior of those objects.

---

## 5. Lifecycle States

The runtime lifecycle narrative in this document must remain compatible with `04b_State_Transition_Model`.

Primary session states for V1:
1. `draft`
2. `open`
3. `in_progress`
4. `complete_pending_sync`
5. `synced_reviewable`
6. `presented`
7. `customer_decision_recorded`
8. `work_authorized` or `declined`
9. `service_complete`
10. `qa_approved`
11. `certificate_eligible`
12. `archived`

`04b` remains the authoritative source for final state names and transition permissions.
This document defines what operationally happens in and between those states.

---

## 6. End-to-End Lifecycle Narrative

### 6.1 Session Creation
**Entry condition:** customer/property context exists or is created.

**Behavior:**
- a new session record is created
- session enters `draft`
- technician-facing prep data may be attached
- no customer-facing artifact may be issued
- no pricing may be finalized

**Objects created:**
- Session
- optional preliminary notes

**Mutable:**
- session metadata
- scheduling details
- preparatory notes

**Locked:**
- none

**Audit triggers:**
- session created
- session assigned or reassigned

---

### 6.2 Session Open / Visit Start
**Entry condition:** technician begins live field activity.

**Behavior:**
- session moves from `draft` to `open`, then to `in_progress` when active inspection work begins
- TIS may create draft findings and draft evidence
- field capture is provisional until sync or save checkpoints are reached

**Objects created or activated:**
- draft Finding records
- draft Evidence records
- optional draft Interpretation records

**Mutable:**
- findings
- evidence
- severity
- notes
- draft interpretation

**Locked:**
- pricing
- customer-facing documents
- service completion artifacts

**Audit triggers:**
- state changed to `open`
- state changed to `in_progress`

---

### 6.3 Findings Capture and Evidence Accumulation
**Behavior:**
- technician records observations
- technician attaches evidence
- technician may edit, merge, remove, or downgrade draft findings while session is still in mutable field state
- system may validate required evidence thresholds based on finding type

**Rules:**
- findings are editable while state remains within allowed pre-presentation capture states
- severity changes are auditable once the record has been saved beyond transient field draft
- evidence attachment order may change before presentation without reopening the session
- deletion of a saved finding requires an audit event once the finding has crossed initial persistence

**Mutable:**
- finding content
- severity
- evidence set
- interpretation notes
- recommendation draft linkage

**Locked:**
- estimate options
- customer-facing pricing

**Audit triggers:**
- finding created
- finding severity changed
- finding deleted after persistence
- evidence added
- evidence removed after persistence

---

### 6.3b Sweep-to-Context Photo Capture

**Purpose:**
Sweep to Context is a field capture mode for quickly capturing environmental and orientation photos during inspection without associating each photo to a specific finding at capture time. It exists to protect inspection speed without letting unassociated photos satisfy finding evidence requirements.

**Behavior:**
- Technician initiates a sweep action.
- Photos captured during sweep are stored as `evidence_class: context`.
- Context photos are retained internally in the session record.
- Context photos are not associated with any specific finding at capture time.
- Context photos are not included in any customer-facing document render unless explicitly promoted.

**Promotion Rule and Data Operation:**
- A `context`-class photo may be promoted to finding-level evidence at any time before the session reaches `archived`.
- **Promotion creates a new Evidence record of class `finding`** that references the same underlying media asset. It does not mutate the existing `context` record.
- The original `context`-class Evidence record is retained and marked with a `promoted_to` reference pointing to the new `finding`-class record.
- This immutable approach preserves the audit trail and the original capture context.
- The new `finding`-class record must reference an existing Finding. A Finding must already exist or be created at time of promotion.
- Promotion is an auditable event: new `finding`-class Evidence record ID, source `context` record ID, actor, timestamp, finding reference.

**Evidence Minimum Enforcement:**
- `context`-class Evidence does not satisfy finding evidence minimums per `09_Media_Capture_and_Evidence_Standard`.
- A Finding must have at least one `finding`-class Evidence item to pass QA.
- The system must track evidence class separately. A Finding with only `context` evidence must be flagged as evidence-deficient.

**Customer-Facing Rendering Rule:**
- Only `finding`-class Evidence is rendered in customer-facing documents.
- `context`-class Evidence is excluded from all `11x` output renders unless promoted first.

**Archive Disposition:**
- `context`-class Evidence records are archived with the session.
- They are accessible to authorized internal users for audit and QA review.
- They are not included in any customer-accessible artifact package.

**Governance Rule:**
- Sweep to Context is not a substitute for proper finding association.
- "Excessive" context usage without promotion is a QA-reportable behavior. The threshold for what constitutes excessive is defined in `09_Media_Capture_and_Evidence_Standard`.
- TIS must make the promotion workflow low-friction so that sweep does not become a documentation shortcut.

**Audit Triggers:**
- sweep mode initiated
- context photo captured (evidence_class: context)
- context photo promoted (new finding-class record created; source context record ID retained)
- finding closed at QA gate with zero finding-class evidence (QA deficiency flag)

---

### 6.4 Inspection Completion
**Entry condition:** technician has completed field capture for the inspection phase.

**Behavior:**
- session moves to `complete_pending_sync`
- system checks required fields, required evidence, and minimum capture thresholds
- technician may no longer casually continue editing without re-entering an editable capture mode if state rules require it

**Rules:**
- incomplete required capture blocks transition
- this is the first meaningful freeze threshold
- raw observational data should stabilize here unless explicitly reopened

**Mutable after transition:**
- limited corrections permitted per `04b`
- recommendations may still be assembled
- pricing may still be assembled

**Locked after transition:**
- deletion of persisted evidence without audit
- untracked finding removal

**Audit triggers:**
- state changed to `complete_pending_sync`
- completeness validation pass/fail

---

### 6.5 Sync and Office-Grade Record Formation
**Entry condition:** session data reaches BHFOS successfully.

**Behavior:**
- persisted field objects sync into BHFOS authority layer
- session enters `synced_reviewable`
- BHFOS becomes authoritative store of record for persisted data
- audit continuity begins from authoritative sync checkpoint forward

**Rules:**
- after successful sync, edits to persisted findings are no longer treated as casual field draft edits
- all material post-sync changes must generate auditable before/after records
- orphan draft artifacts in TIS may not supersede synced authority

**Mutable:**
- interpretations
- recommendation structure
- pricing composition
- permitted finding corrections subject to audit

**Locked:**
- pre-sync transient draft behavior

**Audit triggers:**
- sync succeeded
- sync failed
- sync conflict detected
- post-sync finding edited

---

### 6.5b Session-Local Precedence and Reconciliation Clock

**For Class A (Operational Convenience) fields:**

1. Session-local overrides of Class A fields persist only for the active session lifecycle.
2. The BHFOS master record is not updated until reconciliation is explicitly approved by an authorized BHFOS office user with record management permissions.
3. **The `archived` state transition is system-enforced to require reconciliation gate clearance.** The system blocks the `archived` transition until all open Class A conflicts have been resolved or explicitly deferred with reason. This is a state machine precondition, not a UI validation. (`04b` must implement this as a gate on the `archived` transition.)
4. Reconciliation options for each open Class A conflict:
   - **Accept field value:** session-local value replaces the master record value. Auditable.
   - **Reject field value:** master record value retained. Session-local override discarded. Auditable.
   - **Defer with reason:** conflict is flagged as unresolved. A reason is recorded. The master record is not updated. The session may archive with the deferral explicitly on record.
5. Session-local values that reach archive without resolution and without explicit deferral are treated as discarded and do not become master truth.
6. All reconciliation decisions are auditable: field name, session-local value, master value, resolution type, actor, timestamp.

**For Class B (Authorization/Compliance) fields:**
- No session-local value is created. TIS is read-only on all Class B fields.
- Any write attempt from TIS generates an immediate error event and an audit entry.

**For Hard-Stop status flags during active session:**
- When a hard-stop flag is pushed to TIS during an active session (on sync):
  - TIS surfaces the flag to the technician immediately.
  - Applicable blocks take effect as defined in Section 3.6.
  - The push event and technician notification are both auditable.
- **Full-offline hard-stop edge case:** If a session is conducted entirely offline and no sync occurs, TIS cannot receive a hard-stop push. On the next sync event (whenever connectivity resumes), hard-stop status check is the first operation before any session data commits. If a hard-stop is found: the applicable blocks activate, the technician is notified, and any contracting actions taken during the offline period that would have been blocked are flagged for office review.

---

### 6.6 Interpretation and Recommendation Assembly
**Behavior:**
- system or authorized office user assembles interpretation from findings and evidence
- recommendation pathways are tied to governed finding data
- recommendation set may be revised while session remains pre-presentation

**Rules:**
- recommendations may not contradict finding severity without explicit override record
- recommendation edits after sync are auditable
- interpretation text may be refined, but may not introduce unsupported facts absent linked findings/evidence

**Mutable:**
- interpretations
- recommendations
- bundling logic

**Locked:**
- final presentation artifacts once session reaches `presented`

**Audit triggers:**
- recommendation created
- recommendation materially changed
- unsupported override applied

---

### 6.7 Estimate Formation and Pricing Freeze Threshold
**Behavior:**
- estimate options are built from governed scope and pricing rules
- customer-safe pricing artifacts may now be rendered
- this stage establishes the first formal pricing freeze point

**Pricing Freeze Rule:**
The moment an estimate or proposal is first rendered for customer presentation, the pricing snapshot used for that artifact becomes frozen.

That means:
- the rendered estimate version is immutable
- the source pricing rules remain authoritative
- any later change to scope, quantity, tier, or line items requires a new estimate version, not silent overwrite

**Rules:**
- price-affecting changes after first render require version increment
- prior customer-presented estimate versions must remain historically accessible
- the system must distinguish between internal working estimate and customer-presented estimate

**Mutable before first customer render:**
- scope structure
- bundles
- estimate options
- tier naming

**Locked after first customer render of a given estimate version:**
- that estimate version's prices
- included scope lines for that version
- assumptions attached to that version

**Audit triggers:**
- estimate version created
- estimate version rendered
- pricing-affecting element changed after prior version existed
- estimate superseded by new version

---

### 6.8 Customer Presentation
**Entry condition:** at least one governed estimate version and supporting explanation artifacts exist.

**Behavior:**
- session enters `presented`
- checklist, evidence report, IAQ report, estimate, and presentation assets may be shown according to workflow
- customer-facing explanation operates from locked or versioned artifacts, not ad hoc verbal improvisation detached from system data

**Rules:**
- once in `presented`, findings that materially affect customer understanding require explicit reopen/version behavior before they change
- customer-facing documents shown during presentation become part of the business history
- technician may not alter the presented estimate in place

**Mutable:**
- customer notes
- non-material presentation notes
- internal follow-up actions

**Requires reopen or version:**
- finding severity changes
- recommendation changes that affect scope
- scope or price changes
- evidence changes that alter customer-facing support

**Audit triggers:**
- state changed to `presented`
- document artifact rendered for presentation
- presentation completed

---

### 6.9 Reopen / Revision Behavior
**Entry condition:** a material issue is discovered after presentation or after a locked threshold.

**Behavior:**
- the system does not overwrite the prior customer-presented truth
- instead it performs one of two actions:
  1. reopen mutable source objects where state rules allow, then regenerate downstream outputs as a new version
  2. create corrected successor artifacts while preserving prior versions

**Material revision includes:**
- finding added or removed
- severity changed
- evidence substantially changed
- recommendation changed
- scope changed
- price changed

**Rules:**
- all reopen actions are auditable
- the reason for revision is required
- downstream affected artifacts must be identified and revalidated

**Audit triggers:**
- session reopened
- revision reason captured
- superseded artifact marked inactive
- successor artifact created

---

### 6.9b Tier 2 Correction Boundaries

Tier 2 corrections may change artifact content. They operate under a hard constraint set. **The system must enforce tier classification before accepting a Tier 2 correction submission.** A Tier 2 submission containing any prohibited change is rejected by the system. The submitter must reclassify and resubmit as Tier 3.

**Permitted in Tier 2:**
- Correcting a location label within the same asset and zone (e.g., `"attic"` → `"second-floor attic access panel"`)
- Correcting an asset reference where the correction does not change which asset or zone bears the finding
- Fixing a typographic error in a finding description that does not change type, classification, or severity
- Updating a photo label where the underlying evidence content is unchanged

**Not Permitted in Tier 2 — Requires Tier 3 or Full Revision Workflow:**
- Changing the finding’s physical asset assignment to a different asset or system
- Moving the finding to a different zone outside the original correction boundary
- Altering severity, recommendation, or interpretation meaning
- Changing pricing-relevant scope language
- Any change that alters customer-facing recommendation framing or urgency
- **Finding remapped across distinct assets:** moving a finding from one asset to another is a finding reassignment, not a location correction. Requires successor artifact generation and an explicit audit reason. *(Definition of "distinct asset" is governed by the Asset/Zone reference hierarchy in `03`. Two findings are on distinct assets when they reference different nodes in the Structure → Zone → System → Equipment containment tree at the System level or above.)*

**Enforcement:**
- Tier classification is a system-validated field, not a free-text input.
- Tier 2 submissions are validated against the prohibited list before acceptance.
- Rejected Tier 2 attempts are auditable: submitted tier, rejection reason, actor, timestamp.

---

### 6.10 Customer Decision Capture
**Behavior:**
- customer decision is recorded after presentation
- session enters `customer_decision_recorded`
- branch occurs into `work_authorized` or `declined`

**Rules:**
- a decision record attaches to the estimate version actually presented and accepted or declined
- acceptance cannot point to an estimate version later overwritten or ambiguously replaced

**Audit triggers:**
- customer accepted option
- customer declined option
- accepted option linked to estimate version

---

### 6.11 Authorized Work Execution
**Entry condition:** customer authorizes work.

**Behavior:**
- authorized work scope becomes operationally active
- service execution may begin
- service completion data accumulates

**Rules:**
- authorized scope is bound to the accepted estimate version unless an approved change order or successor estimate is created
- service may not drift beyond authorized scope without revision workflow

**Audit triggers:**
- work authorization recorded
- scope activation recorded
- change order or revised authorization recorded

---

### 6.12 Service Completion
**Behavior:**
- technician records service completion
- session enters `service_complete`
- service outcome evidence and completion checks are attached

**Rules:**
- service completion does not itself make a certificate eligible
- QA or designated approval checkpoint must occur first

**Audit triggers:**
- state changed to `service_complete`
- completion evidence added
- completion exception logged

---

### 6.13 QA Review and Approval
**Behavior:**
- QA reviews required evidence, authorized scope completion, and record integrity
- session enters `qa_approved` only after review pass

**Rules:**
- failed QA blocks certificate eligibility
- QA findings may require reopen or remediation tasks
- QA approval is a separate auditable event from service completion

**Audit triggers:**
- QA review started
- QA approved
- QA failed
- QA-required correction issued

---

### 6.14 Certificate Eligibility and Issuance
**Behavior:**
- once QA approval exists and all certificate preconditions are satisfied, session enters `certificate_eligible`
- certificate artifact may be rendered
- certificate is issued from approved state data only

**Rules:**
- certificate may not be issued from mere service completion
- if post-QA changes affect completion truth, certificate eligibility must be reevaluated

**Audit triggers:**
- certificate eligibility achieved
- certificate rendered
- certificate issued
- certificate invalidated or superseded

---

### 6.15 Archive
**Behavior:**
- session enters `archived` after operational close
- record remains searchable and historically intact
- output documents remain historically traceable by version

**Rules:**
- archived records are not casually mutable
- any archival correction requires elevated override and audit

**Audit triggers:**
- state changed to `archived`
- archival override used

---

## 7. Mutation Rules by Object Type

### 7.1 Session
- freely editable in `draft`
- operationally editable in `open` and `in_progress`
- partially editable in `complete_pending_sync` and `synced_reviewable`
- controlled in `presented`
- mostly locked after customer decision except for completion and QA records
- locked in `archived` except authorized correction path

### 7.2 Finding
- freely editable before sync checkpoint
- auditable on all material post-sync edits
- material change after `presented` requires reopen/version behavior

### 7.3 Evidence
- freely attachable during field capture
- removable before sync checkpoint
- post-sync removal or replacement is auditable
- evidence change after `presented` that affects customer understanding requires successor artifact generation

### 7.4 Interpretation
- editable pre-presentation
- post-presentation edits require successor document logic if customer-facing artifacts are affected

### 7.5 Recommendation
- editable pre-presentation
- post-presentation recommendation changes require revision workflow if scope or urgency changes

### 7.6 Estimate Option
- mutable before first customer render
- version-frozen once rendered to customer
- any price-affecting change creates a new version

### 7.7 Document Artifact
- generated from source data
- never the origin of business truth
- once customer-presented or issued, historical version must persist
- corrected artifacts supersede but do not erase prior artifacts

---

## 8. Lock Points

The following lock points are mandatory runtime thresholds.

### Lock Point A — Persisted Field Capture Threshold
Triggered when draft findings/evidence have crossed into persisted inspection record territory.

Effect:
- deletions and material edits become auditable
- freeform silent cleanup ends

### Lock Point B — Sync Authority Threshold
Triggered when BHFOS successfully receives authoritative session data.

Effect:
- post-sync edits require authoritative before/after audit continuity
- TIS drafts cannot silently replace synced truth

### Lock Point C — First Customer Estimate Render
Triggered when a pricing-bearing estimate is first rendered for customer presentation.

Effect:
- estimate version freezes
- any price/scope change requires new version

### Lock Point D — Presented State Threshold
Triggered when customer-facing explanation and/or estimate presentation begins.

Effect:
- material finding/recommendation changes require explicit revision workflow
- previously presented artifacts become historical business records

### Lock Point E — Customer Decision Threshold
Triggered when acceptance or decline is recorded.

Effect:
- accepted version linkage becomes fixed
- downstream work must reference accepted version or formal revision

### Lock Point F — QA Approval Threshold
Triggered when QA approves service completion.

Effect:
- certificate path opens
- changes affecting completion truth require reevaluation

### Lock Point G — Archive Threshold
Triggered when session is archived.

Effect:
- operational editability closes
- only governed correction path remains

---

## 9. Render Trigger Rules

### 9.1 General Rule
A document artifact may be rendered only when its minimum source data preconditions are satisfied.

### 9.2 Render Does Not Create Authority
Rendering never creates truth. It snapshots truth currently in the source data.

### 9.3 Render Timing by Artifact Class

**Checklist / evidence-support artifacts**
- may render in pre-presentation reviewable stages
- must regenerate as new versions if material source truth changes after presentation threshold

**Estimate / proposal artifacts**
- may render only after pricing-bearing scope exists
- first customer render freezes version

**Certificate artifacts**
- may render only after QA approval and certificate eligibility

### 9.4 Regeneration Rule
If source data changes in a way that materially affects artifact meaning, the artifact must be regenerated as a successor version rather than hand-edited.

### 9.5 Supersession Rule
A successor artifact marks prior artifact status as superseded or historical, but prior artifact remains retained.

---

## 9b. Artifact Revocation and Tombstoning Rules

### 9b.1 Artifact Class Definitions

All Document Artifacts carry a tombstone class that governs their revocation behavior. Tombstone class is assigned in the Document Library Map per artifact and must be declared in each `11x` Output Spec.

| Class | Description | Examples |
|-------|-------------|---------|
| **Class I — Informational** | Pre-decision artifacts that support understanding but do not constitute a commitment | Clear Air Checklist, Photo-Evidence Report, IAQ Report (pre-decision), Leave-Behind Packet, Tabletop Presentation |
| **Class II — Decision-Bearing** | Artifacts presented to the customer as a basis for a decision or acceptance | Estimate / Proposal (pre-acceptance), Work Scope (pre-acceptance) |
| **Class III — Authorization-Bearing** | Artifacts that have been accepted, signed, or issued as a formal commitment | Accepted Estimate version (post-acceptance), Work Authorization, Clean Air Certificate |

Note: `11b` (Estimate / Proposal) transitions from Class II to Class III at the moment of customer acceptance. The system must track this transition. The pre-acceptance version is Class II. The accepted version becomes Class III.

### 9b.2 Revocation Rules by Class

**Class I:**
- Superseded via `superseded` status flag.
- Prior version retained and accessible to authorized internal users.
- No distribution enforcement required beyond the status flag.
- Customer-accessible prior versions show a superseded status indicator.

**Class II:**
- Must be tombstoned when superseded.
- Tombstoning means: artifact status set to `tombstoned` — non-presentable and non-actionable.
- **Prior delivery channels** must be prevented from surfacing a tombstoned Class II artifact as actionable. The system must enforce this through artifact status checks on every access attempt.
- **Delivery channel tracking is required for Class II artifacts.** The system must know what channels were used to deliver each Class II artifact so that tombstone enforcement can be applied. This requirement must be implemented in `04c` (Audit Trail Spec).
- The tombstoned artifact's status record must surface: superseded status, successor artifact reference (when available), and contact information for re-issuance.
- A successor artifact does not exist until it has been formally rendered and issued. **Do not tombstone before the successor is ready.** During the window between tombstone decision and successor issuance, the artifact enters `pending_supersession` status (see 9b.3).

**Class III:**
- Must be immediately non-executable when superseded.
- All delivery channels must enforce non-executability.
- Customer acceptance or signature must be bound to the specific active artifact version ID at execution time.
- A superseded Class III artifact may never be re-activated. Only a new artifact with a new issuance event and a new version ID may replace it.
- **Delivery channel tracking is required for Class III artifacts.** Same requirement as Class II. `04c` must specify implementation.
- Prior Class III artifact is retained in the audit record with `superseded` / `inactive` status.

### 9b.3 Pending Supersession State

When a tombstone decision has been made but the successor artifact is not yet ready, the artifact enters `pending_supersession`:

- The artifact is not yet tombstoned.
- No new customer actions are permitted on the artifact (non-signable, non-presentable for new decisions).
- The artifact remains visible to authorized internal users in its current state.
- The `pending_supersession` status is auditable.
- Once the successor artifact is formally issued, the prior artifact transitions to `tombstoned` (Class II) or `superseded_inactive` (Class III).
- If the pending supersession is cancelled (revision abandoned), the artifact returns to its prior active status. Cancellation is auditable with required reason.

### 9b.4 General Rules

- No artifact is deleted. All artifacts are retained.
- The current valid artifact for any type within a session is always determinable from session history.
- Re-issuance after tombstoning generates its own audit event: artifact re-issued, reason, actor, timestamp, new version ID.

**Reopen-to-Tombstone Interaction:**
When a session reopen (Section 6.9) results in material source data changes that affect an already-issued artifact:
- Class I artifacts: superseded on next regeneration.
- Class II artifacts: enter `pending_supersession` until revised version is ready, then tombstoned.
- Class III artifacts: enter `pending_supersession` until revised version is ready, then transition to `superseded_inactive`. The reopen reason must be captured and linked to the tombstone event.
- A reopen does not automatically tombstone. Tombstone occurs when a successor is ready to be issued. This preserves the rule: do not tombstone before the successor is ready.

### 9b.5 Downstream Impact of Tombstone Events

When any artifact is tombstoned or transitions to `superseded_inactive`, dependent artifacts must be assessed:

| Tombstoned Artifact | Dependent Artifacts Requiring Assessment |
|---------------------|------------------------------------------|
| Clear Air Checklist (`11a`) | Leave-Behind Packet (`11h`) if it references checklist findings |
| Estimate / Proposal (`11b`) | Work Scope (`11e`), Work Authorization, any certificate path |
| Photo-Evidence Report (`11c`) | IAQ Report (`11d`) if it cites specific photos |
| IAQ Report (`11d`) | Work Authorization if IAQ findings were the decision basis |
| Work Scope (`11e`) | Estimate (`11b`), Work Authorization |
| Work Authorization | Certificate eligibility, session archive readiness |
| Clean Air Certificate (`11f`) | Session archive (certificate state affects archival gate) |

---

## 10. Pricing Behavior Rules

### 10.1 Source of Pricing Truth
Pricing truth comes from governed pricing structures, not technician improvisation and not output documents.

### 10.2 Working Pricing vs Presented Pricing
The system must distinguish between:
- working pricing: editable internal formulation before customer render
- presented pricing: frozen estimate version shown to customer

### 10.3 Price Change After Presentation
Any change to quantity, tier, bundle, included line item, excluded line item, or discount logic after presentation requires:
- new estimate version
- audit entry
- updated decision linkage if customer later accepts

### 10.4 No In-Place Presented Price Edits
Presented estimate versions may not be edited in place.

### 10.5 Accepted Estimate Binding
When customer accepts, the accepted estimate version becomes the governing commercial reference for authorized work unless a change order or revised successor estimate is formally produced.

---

## 11. Audit Trigger Requirements

The following events are mandatory auditable events in V1.

### 11.1 State Events
- session created
- session assigned/reassigned
- every state transition
- reopen invoked
- archive invoked

### 11.2 Finding Events
- finding created after persistence threshold
- finding materially edited after persistence threshold
- severity changed
- finding deleted after persistence threshold

### 11.3 Evidence Events
- evidence added after persistence threshold
- evidence removed after persistence threshold
- evidence replaced after presentation threshold

### 11.4 Recommendation and Interpretation Events
- recommendation created
- recommendation materially changed
- unsupported override invoked
- interpretation materially changed after sync

### 11.5 Pricing and Estimate Events
- estimate version created
- estimate rendered
- estimate superseded
- accepted version linked
- price-affecting element changed after prior version exists

### 11.6 Document Events
- customer-facing artifact rendered
- customer-facing artifact superseded
- certificate issued
- certificate invalidated

### 11.7 Completion / QA Events
- work authorization recorded
- service completion recorded
- QA approved
- QA failed
- QA correction required

These mandatory events must be implemented in `04c` and emitted by any layer capable of causing them.

---

## 12. Runtime Conflict Resolution Rules

These rules govern behavioral conflict when multiple documents touch the same runtime situation.

### 12.1 Structure Conflict
If narrative flow conflicts with field structure, `03` wins on structure.

### 12.2 State Permission Conflict
If workflow convenience or narrative flow conflicts with allowed states or permissions, `04b` wins.

### 12.3 End-to-End Flow Conflict
If isolated workflow behavior or output assumptions conflict with end-to-end lifecycle coherence, this document (`00b`) wins on runtime sequencing and lifecycle intent, subject to `03` and `04b` for structure and permissions.

### 12.4 Pricing Conflict
If any workflow, output spec, messaging assumption, or field behavior conflicts with governed pricing rules, `06_Pricing_Manifest_Framework` governs. It is the sole pricing authority. No output document, technician practice, or field override may create pricing truth that does not originate from `06`.

### 12.5 Output Conflict
If a customer-facing artifact implies behavior not supported by source data or state rules, the output artifact is wrong and must be revised.

This section exists specifically to prevent drift between `00b`, `04b`, and `07`.

---

## 13. Downstream Revalidation Rules

When the following upstream documents change, downstream artifacts must be revalidated.

### 13.1 If `03` changes
Revalidate:
- `04b`
- `04c`
- `04`
- `07`
- `09`
- `10`
- all `11x`

### 13.2 If `04b` changes
Revalidate:
- `04`
- `07`
- any output or SOP behavior tied to state-based permissions

### 13.3 If `00b` changes
Revalidate:
- `03`
- `04b`
- `04c`
- `04`
- `07`
- pricing/render timing assumptions in `11b`, `11d`, `11f`, `11g`

### 13.4 If `06` changes
Revalidate:
- `08c`
- `11b`
- `11e`
- `11g`

### 13.5 If `08b` or `08c` changes
Revalidate:
- `11b`
- `11g`
- `11h`
- technician-facing SOP behavior where applicable

---

## 14. Draft-to-Lock Readiness Criteria

This document is ready for lock when all of the following are true:

1. every lifecycle state transition in this narrative maps cleanly to `04b`
2. every runtime object in this document exists in `03`
3. every lock point has an explicit corresponding enforcement path in `04b`
4. every mandatory audit trigger is represented in `04c`
5. pricing freeze behavior is accepted by operations and sales
6. document regeneration and supersession behavior is accepted for all pricing-bearing and authority-bearing outputs
7. technician workflow in `07` can execute this behavior without contradiction

---

## 15. Open Questions Requiring Decision Before Final Lock

1. Does `presented` begin at first visual display of any customer-facing artifact, or only when pricing-bearing artifacts are shown?
2. Is there a separate `change_order` object in V1, or does revised authorization remain a successor estimate version only?
3. What exact persistence threshold defines transition from transient draft finding to auditable saved finding in TIS?
4. Which user roles may reopen a presented or accepted session?
5. Does certificate invalidation require its own explicit state or only an event record?

These questions must be resolved before final lock.

---

## 16. Bottom-Line Operating Rule

The system may be flexible before customer truth is established.
After customer truth is established, the system must become explicit, versioned, and auditable.

That is the controlling behavior principle of V1.



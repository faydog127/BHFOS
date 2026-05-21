# 00b — System Behavior Spec
**BHFOS / The Vent Guys**  
**Status:** Draft v1.0  
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

---

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
TIS may capture field data and initiate field actions, but BHFOS remains the authority for:
- record permanence
- pricing truth
- final document generation
- final history
- final audit continuity

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
If any workflow, output spec, or messaging assumption conflicts with governed pricing rules, pricing authority wins.

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


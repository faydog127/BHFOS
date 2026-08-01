# BHFOS V2 — Product Definition Reconciliation Plan

| Field | Value |
| --- | --- |
| Status | Active |
| Version | 0.1 |
| Owner | Founder |
| Date | 2026-08-01 |
| Active governance baseline | `2b58749` |
| Prior product draft | Closed PR #125 at `d0f57b0` |
| Target document | `V2_PRODUCT_DEFINITION.md` |
| Implementation authority | None — product-definition planning only |

## Founder planning-process approval

Approved by the founder in PR #130 at commit `91a9673` as the active planning process for drafting and reviewing the Product Definition.

This approval does not ratify the Product Definition, approve requirements or architecture, authorize a release, or authorize application implementation, migrations, deployment, or production changes.

## Purpose

Reconcile the substantive product-definition research preserved in closed PR #125 with the active BHFOS V2 governance foundation.

This plan does not approve product scope, requirements, architecture, releases, migrations, or application implementation.

## Reconciliation precedence

Reconciliation must distinguish binding authority from supporting evidence.

### Binding authority

1. Active decisions in `V2_DECISION_REGISTER.md`
2. Active Command Center governance policies

### Supporting evidence

3. Ratified V1 closeout evidence
4. Recorded founder observations and product discussions
5. Closed PR #125
6. Competitor research, demonstrations, screenshots, and informal notes

Supporting evidence may inform the Product Definition but cannot override an active decision or become approved scope without founder ratification.

## Sources

- Active Command Center governance merged through PR #129
- Active DEC-V2-001 through DEC-V2-010
- Closed PR #125 product-definition draft
- V1 closeout and deferred-scope records
- Founder observations about office and field use
- Commercial Account Manager discussions
- Coach's Corner discussions
- Media Intelligence and marketing-content discussions
- Housecall Pro and competitor research

## Reconciliation principles

- Preserve useful product reasoning without importing stale authority.
- Do not treat a V1 behavior as a V2 requirement automatically.
- Do not treat a proposed capability as implementation scope.
- Keep the Product Definition focused on purpose, users, outcomes, principles, and boundaries.
- Move workflow detail into the Workflow Map.
- Move inherited-capability decisions into the Capability Disposition Matrix.
- Move implementation commitments into Requirements and Release Registers.
- Keep franchise and multi-tenant capability deferred under DEC-V2-010.
- Maintain explicit separation between product-definition ratification and implementation authorization.

## Reconciliation-plan acceptance criteria

Reconciliation is complete only when:

- every PR #125 section has a recorded disposition;
- every binding statement traces to active authority or explicit founder ratification;
- V1 rules are not imported automatically;
- current users are separated from future stakeholders;
- strategic product areas are separated from deferred capabilities;
- unresolved questions remain visible;
- workflow, architecture, requirements, and release detail remain in their proper documents;
- the Product Definition does not authorize application implementation.

## Source-section reconciliation

| Source section | Proposed disposition | Conflict or risk | Required resolution | Final disposition |
| --- | --- | --- | --- | --- |
| Business purpose | Preserve with revision | Franchise implications | Align with DEC-V2-001 and DEC-V2-010 | Pending |
| Product promise | Preserve and strengthen | Field adoption not explicit | Add fast capture and fallback-tool reduction | Pending |
| Primary users | Revise | Franchise operator listed as current user | Remove from current-user set | Pending |
| Revenue engines | Preserve with revision | Commercial strategy not explicit | Evaluate Commercial Account Manager as a strategic product area | Pending |
| Core operating loop | Preserve | Exception families incomplete | Acknowledge major branches without mapping detailed workflow | Pending |
| Product principles | Preserve and reconcile | Some wording implies implementation | Align with controlled terminology and authority boundaries | Pending |
| V1 inheritance rule | Preserve | Historical rules may appear binding | Require individual disposition | Pending |
| V2 boundaries | Rewrite | Planning and implementation authority blurred | Separate Product Definition authority from implementation authorization | Pending |
| Existing constraints | Rewrite substantially | V1 financial and operational rules imported silently | Classify each inherited rule | Pending |
| Outcomes and measures | Preserve as candidates | Adoption and fallback behavior missing | Add mobile intake and field-adoption measures | Pending |
| Product-definition gates | Rewrite | Ratification and implementation gates conflict | Separate the two gates | Pending |
| Planning sequence | Rewrite | Architecture and requirements ordering unclear | Use governed planning sequence | Pending |
| Discovery questions | Preserve and expand | Data, field, commercial, coaching, and consent gaps | Add explicit unresolved questions | Pending |

The `Final disposition` column remains `Pending` until the substantive Product Definition draft is reconciled.

## Founder-direction items requiring explicit treatment

### Fast capture and field adoption

The product outcome is practical capture of customer, property, appointment, add-on service, field action, time, mileage, evidence, and completion information in BHFOS rather than fallback to Notes, texts, memory, or disconnected tools because the system is slower or harder to use. Interrupted-network behavior remains discovery. This is a product outcome, not yet an implementation requirement.

### Coach's Corner

Coach's Corner is a proposed differentiator that would use business state and performance signals to offer small, practical business-growth challenges. It should be optional, achievable, non-punitive, and tied to observable outcomes where practical, with no forced gamification. It is deferred from early implementation unless separately authorized.

### Commercial Account Manager

Commercial Account Manager is a proposed dedicated-TVG product area covering customer, contact, property, and account hierarchy; multi-property relationships; recurring service; compliance evidence; account history; and account growth. It is explicitly not multi-tenancy or franchise architecture and is not assigned to the first release.

### Media Intelligence and marketing reuse

Operational evidence, customer reporting, internal training, and public marketing are separate purposes. Approval for one does not authorize the others. Customer consent, data classification, and public-use approval remain mandatory for any marketing reuse.

## Workflow exception families

The Product Definition should acknowledge estimate-only visits, same-visit work, unscheduled add-ons, return visits, unsafe-to-proceed work, commercial recurring service, multi-property accounts, change orders, and payment/reconciliation exceptions. Detailed states remain in the Workflow Map.

## Architecture neutrality

The Product Definition may set constraints but may not select PWA/native, Supabase topology, vendors, payment architecture, hosting, offline technique, AI vendor, or integration design.

## V1 financial and operational constraint disposition

Each inherited constraint must be classified as an active decision, proposed decision, requirement candidate, architecture candidate, risk-control candidate, capability-disposition item, or historical evidence only.

## AI and automation authority boundary

AI may assist analysis, drafting, and prioritization but may not authorize pricing, customer commitments, financial transactions, deployment, release activation, or founder decisions.

## Proposed structure for the reconciled Product Definition

1. Document authority and status
2. Business purpose
3. Product promise
4. Current users
5. Operating problem
6. Core operating loop
7. Strategic product areas
8. Revenue and operational outcomes
9. Product principles
10. Current boundaries and non-goals
11. V1 inheritance rule
12. Candidate success measures
13. Product-definition ratification gates
14. Implementation-authorization gates
15. Open discovery questions
16. Source and decision traceability

## Critique invocation rule

The three required critique rounds must be explicitly requested before a Product Definition draft is presented for founder approval:

1. Product and governance
2. Field and operational usability
3. Security, data, financial, legal, and architecture boundaries

The draft pull request must link the review records and state how every required finding was resolved, deferred, or rejected.

A review round may report that no material changes are required, but it may not be silently omitted.

## Required review and ratification sequence

1. Produce the reconciled Product Definition draft.
2. Verify it against DEC-V2-001 through DEC-V2-010.
3. Conduct the three required critique rounds.
4. Reconcile all required findings.
5. Add proposed DEC-V2-011 for Product Definition ratification.
6. Open a draft pull request.
7. Review the complete pull-request diff and required checks.
8. Record founder approval or requested changes.
9. Change the Product Definition and DEC-V2-011 to `Active` only after explicit founder approval.
10. Merge the ratified Product Definition.

Ratification of the Product Definition does not authorize application implementation.

An AI agent or reviewer may prepare the pull request, analyze the diff, identify conflicts, and recommend approval or changes. Only the founder may approve the Product Definition, activate the ratification decision, mark the Product Definition as `Active`, or authorize the merge.

## Pause and recovery rule

When Product Definition reconciliation is paused, blocked, or no longer the active planning task:

- update `V2_COMMAND_CENTER_INDEX.md`;
- record the pause or blocker in `V2_WEEKLY_LOG.md`;
- leave the Product Definition and reconciliation plan in Draft;
- identify the next required action before work resumes.

A paused reconciliation branch does not gain authority through age, partial completion, or prior discussion.

## Document lifecycle

This reconciliation plan is an active planning artifact only while the Product Definition remains under reconciliation.

After `V2_PRODUCT_DEFINITION.md` is ratified:

- change this plan's status to `Superseded`;
- record the ratified Product Definition version and merge SHA;
- retain this plan as historical evidence;
- do not revise it to mirror later Product Definition changes.

Later Product Definition changes require a new change record or reconciliation plan.

## Reconciliation-plan naming convention

Future reconciliation plans use:

`V2_<TARGET_DOCUMENT>_RECONCILIATION_PLAN.md`

They are stored under `command-center/docs/v2/reviews/`.

A reconciliation plan is historical evidence, not a substitute for the controlled target document.

## Source traceability

| Source | Reference | Authority | Current state |
| --- | --- | --- | --- |
| Governance foundation | Merge commit `2b58749` | Binding governance | Available |
| Active decisions | `V2_DECISION_REGISTER.md` | Binding decisions | Available |
| Prior Product Definition | Closed PR #125 at `d0f57b0` | Supporting evidence | Available |
| V1 closeout | `command-center/docs/v2-handoff/` | Ratified historical evidence | Available |
| Field and office observations | Specific source references not yet consolidated | Supporting evidence | Must be captured |
| Coach's Corner discussions | Specific source references not yet consolidated | Supporting evidence | Must be captured |
| Commercial Account Manager discussions | Specific source references not yet consolidated | Supporting evidence | Must be captured |
| Media Intelligence discussions | Merged Media Intelligence work plus related founder discussions | Supporting evidence | Exact references required |
| Housecall Pro and competitor research | Demonstration notes and screenshots | Supporting evidence | Exact references required |

A source marked `Must be captured` or `Exact references required` cannot support a binding Product Definition statement until its relevant finding has been recorded in a durable, traceable form. Missing sources remain explicit evidence gaps rather than being silently reconstructed from memory.

## Historical-source durability

Source material held only in a closed pull request or historical branch must be fully reconciled into a durable controlled document or archived before:

- the source branch is deleted;
- the repository is migrated;
- the source becomes inaccessible through normal project tooling.

Closed PR #125 must remain traceable until every retained or rejected section has a recorded disposition.

## Legal and compliance discovery questions

### Technician location

- Will location tracking occur only during active work activity?
- Will technicians use company-owned or personal devices?
- What notice and consent are required?
- Who may access current and historical location information?
- How long should location history be retained?
- How is off-hours tracking technically and procedurally prevented?

### Operational media

- What disclosure or consent is required for service-evidence photos and videos?
- May property interiors, identifying information, occupants, or personal belongings appear?
- What evidence is required operationally even when marketing consent is not granted?
- How long should operational media be retained?

### Public marketing media

- What separate consent authorizes public marketing use?
- Can approval be limited by media item, channel, campaign, or period?
- How is consent withdrawal handled?
- How is marketing media separated from restricted service evidence?

### Data rights and retention

- How will customer or technician deletion requests be handled?
- How will data-export requests be handled?
- Which records must be retained for legal, financial, warranty, safety, or dispute purposes?
- What information must be deleted when retention is no longer justified?

### Payment compliance

- How will the eventual payment architecture minimize PCI scope?
- How will BHFOS avoid storing raw payment-card data?
- Which payment identifiers or tokens may be retained?
- Which payment events require audit evidence and founder-approved financial controls?

These remain discovery questions. They do not make legal conclusions or select an implementation.

## Final alignment status

**ALIGNED FOR PLANNING COMMIT AND DRAFT PULL-REQUEST REVIEW**

**NOT PRODUCT-DEFINITION RATIFICATION**

**NOT IMPLEMENTATION AUTHORITY**

## Current conclusion

Closed PR #125 contains useful and largely compatible product reasoning, but it cannot be adopted unchanged. The highest-risk sections are franchise-user and future-tenant language, inherited V1 constraints presented as already binding, conflicting product-definition gates, ambiguous implementation terminology, and insufficient treatment of field adoption, Coach's Corner, and commercial-account strategy.

The next action is to review this reconciliation plan before rewriting `V2_PRODUCT_DEFINITION.md`.

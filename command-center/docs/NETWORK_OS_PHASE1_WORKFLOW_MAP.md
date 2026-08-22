# BHFOS Network OS — Phase 1 Workflow Map

| Field | Value |
| --- | --- |
| Status | Draft — founder ratification required |
| Version | 0.1 |
| Date | 2026-08-22 |
| Product | Network OS |
| Initial operating company | Black Horse Integrated Services (BHIS) |
| Implementation authority | None — workflow definition only |

## 1. Purpose

Define the minimum Phase 1 managed-service workflow for Network OS from relationship activity and customer demand through Service Partner coordination, completion validation, exception handling, and closeout.

This workflow map is implementation-neutral. It does not define database schema, APIs, migrations, automation engines, page structure, or release slices.

## 2. Actors

### BHIS relationship manager / territory manager
Owns customer relationship development, property visits, Service Need discovery, follow-up, and account growth.

### BHIS service coordinator
Owns managed-service coordination from approved work through Service Partner assignment, offer, scheduling, exception handling, completion review, and operational closeout.

### BHIS manager
Owns escalations, exception oversight, policy decisions within delegated authority, staffing/capacity review, and network performance review.

### Customer contact
Requests service, supplies context, provides approvals where needed, receives status/completion communication, and may confirm satisfaction/completion.

### Service Partner
Evaluates work offers, accepts/declines, proposes schedule/quote where needed, performs the service, reports status, and submits completion evidence.

### Network OS
Owns authoritative managed-network state, event history, eligibility evidence, workflow transitions, exception records, and management visibility for implemented domains.

### External adapters
Email, SMS, Partner OS, n8n, AI systems, accounting systems, storage, and other integrations may deliver authorized actions or evidence but do not silently replace Network OS authoritative state.

## 3. Phase 1 closed loop

Relationship / Visit

→ Service Need Identified

→ Service Need Qualified

→ Executable Work Created

→ Eligibility Review

→ Service Partner Selected

→ Work Offered

→ Service Partner Responds

→ Scheduled

→ Work Performed

→ Completion Submitted

→ BHIS Review

→ Exception/Rework if needed

→ Customer Informed / Confirmation where required

→ Work Closed

→ Relationship / performance / reporting data updated

## 4. Workflow stage A — Relationship development and property visit

### Trigger

A BHIS relationship/territory manager contacts or visits a prospective or active customer/property.

### Primary actor

BHIS relationship manager / territory manager.

### Inputs

- Customer organization/property context.
- Existing contacts and relationship history.
- Known follow-ups, needs, vendor issues, or active work.

### Actions

1. Select or create the customer/property context.
2. Record the visit/contact outcome.
3. Add/update contacts if needed.
4. Record notes and relationship intelligence.
5. Set next follow-up if needed.
6. Capture one or more Service Needs where discovered.

### Authoritative records affected

- Customer organization/property.
- Contact.
- Relationship record/status.
- Visit/contact event.
- Follow-up.
- Service Need, if created.

### Exit conditions

- Visit/contact saved.
- Follow-up recorded or intentionally absent.
- Any identified Service Need is captured separately from the visit.

### Exceptions

- Property/contact not found.
- Duplicate customer/property ambiguity.
- Restricted customer/property record access.

### Phase 1 requirements

REQ-NOS-P1-001, 002, 003, 004, 017, 019, 020.

## 5. Workflow stage B — Service Need capture and qualification

### Trigger

A need is identified during a visit/contact or received directly from a customer.

### Primary actor

Relationship manager or service coordinator.

### Inputs

- Customer/property/contact.
- Description of requested or observed need.
- Service category if known.
- Timing/urgency.
- Existing vendor situation.
- Attachments/photos where available.

### Actions

1. Create Service Need.
2. Select governed service category/type.
3. Record urgency, timing, scope, recurring/one-time indicator, and customer/vendor context.
4. Determine whether more information is required.
5. Determine whether the need is only an opportunity, requires Service Partner capacity development, requires quote activity, or is ready to become executable work.

### Authoritative status path

Identified → Qualifying → one of:

- Service Partner Capacity Needed;
- Quote Requested;
- Quote Submitted;
- Approved;
- Deferred;
- Lost;
- Recurring Opportunity.

Exact transition enforcement is deferred to architecture.

### Decision gate — executable work?

If sufficient scope/authority exists to coordinate service, create executable work.

If not, keep the Service Need active without creating a work order.

### Exceptions

- Missing customer/property context.
- Unknown/unsupported service category.
- Insufficient scope.
- Customer approval/budget authority unresolved.
- No known Service Partner capacity.

### Phase 1 requirements

REQ-NOS-P1-004, 005, 018, 019.

## 6. Workflow stage C — Service Partner prospect acquisition and onboarding

This workflow may occur independently of a specific work order.

### Trigger

BHIS identifies a potential Service Partner through an event, referral, customer introduction, outbound recruiting, application, or market-gap search.

### Primary actor

BHIS relationship/network manager or authorized coordinator.

### Actions

1. Capture lightweight Service Partner prospect.
2. Record source and initial service/geographic capability.
3. Progress through interest/application states.
4. Collect factual qualification evidence.
5. Review documentation.
6. Approve required qualification layers.
7. Activate the Service Partner when eligible for managed work.

### Lifecycle

Prospect → Contacted → Interested → Application Started → Application Submitted → Documentation Review → Approved → Active → Preferred / Restricted/Suspended / Inactive as appropriate.

### Authoritative records affected

- Service Partner identity.
- Contacts.
- Service capability.
- Geography.
- Qualification requirements/evidence.
- Qualification status.
- Lifecycle status.
- Internal notes/restrictions.

### Exceptions

- Missing mandatory qualification.
- Expired document.
- Disqualifying restriction.
- Duplicate Service Partner.
- Service/geography capability gap.

### Phase 1 requirements

REQ-NOS-P1-006, 007, 008, 009, 019, 020.

## 7. Workflow stage D — Executable work creation

### Trigger

A Service Need is approved for execution, or an authorized service request arrives with sufficient information to create work directly while preserving Service Need traceability where applicable.

### Primary actor

BHIS service coordinator.

### Actions

1. Create work order.
2. Link customer, property/facility, contact, and originating Service Need where applicable.
3. Assign governed service category/type.
4. Record scope, urgency, required completion window, access instructions, attachments, commercial/approval constraints known in Phase 1, and required qualification/evidence rules.
5. Move work into Needs Review / Service Partner Matching.

### Authoritative records affected

- Work order.
- Link to Service Need.
- Work requirements.
- Initial operational event history.

### Exceptions

- Service Need still lacks approval.
- Missing mandatory work details.
- Unknown property/access context.
- Commercial approval unresolved.

### Phase 1 requirements

REQ-NOS-P1-004, 005, 011, 017, 019.

## 8. Workflow stage E — Eligibility review

### Trigger

Work order enters Service Partner Matching.

### Primary actor

Network OS for deterministic filtering; BHIS coordinator for review/selection.

### Mandatory eligibility checks

At minimum, where data exists:

- Service capability.
- Geographic coverage.
- Active Service Partner status.
- Required qualification/compliance.
- Customer/property mandatory or restricted Service Partner rules.
- Explicit do-not-dispatch restrictions.

### Output

A list of eligible Service Partners with blocking reasons for ineligible candidates where operationally appropriate.

### Human decision

Coordinator selects the Service Partner to offer the work to.

### Override rule

Authorized humans may override preference/ranking/order with a recorded reason. Mandatory legal/compliance requirements are not bypassed merely by human preference.

### Exceptions

- No eligible Service Partner.
- Only customer-mandated Service Partner is ineligible.
- Qualification expired after candidate identification.
- Coverage data insufficient.

### Exception outcome

Create/raise Matching Failure or Service Partner Capacity Needed exception and route for human action/recruiting as appropriate.

### Phase 1 requirements

REQ-NOS-P1-008, 009, 010, 012, 016, 018, 019.

## 9. Workflow stage F — Work offer

### Trigger

Coordinator selects a Service Partner.

### Primary actor

BHIS service coordinator.

### Offer payload

Where applicable:

- Customer/property/general location.
- Service/scope.
- Required completion/service window.
- Access instructions.
- Relevant attachments/photos.
- Pricing/quote requirement.
- Required qualifications.
- Requested response deadline.

### Authoritative action

Network OS records the offer before/during delivery through the selected communication mechanism.

### Work status

Service Partner Matching → Offered.

### Event data

- Offered Service Partner.
- Offer timestamp.
- Delivery channel/source.
- Response deadline if applicable.

### Exceptions

- Delivery failure.
- Offer cannot be generated because required information is missing.
- Service Partner becomes ineligible before acceptance.

### Phase 1 requirements

REQ-NOS-P1-013, 017, 019, 020.

## 10. Workflow stage G — Service Partner response

### Trigger

Service Partner receives offer.

### Service Partner options

- Accept.
- Decline.
- Request Clarification.
- Propose Alternate Date/Time.
- Submit Quote where required.

### Accept path

1. Record acceptance event/time.
2. Lock current Service Partner assignment subject to governed reassignment.
3. Move work to Accepted.
4. Proceed to scheduling.

### Decline path

1. Record decline event/time.
2. Require/record structured decline reason where practical.
3. Return work to Service Partner Matching.
4. Preserve the declined-offer history.
5. Select next eligible Service Partner or create matching exception if no candidates remain.

### Clarification/alternate/quote path

1. Record response.
2. Route to coordinator.
3. Keep work in an explicit awaiting-decision state or exception until resolved.
4. If scope/schedule/price changes materially, preserve approval history.

### Exception triggers

- No response by required deadline.
- Response conflicts with customer window.
- Quote exceeds known approval/NTE boundary.
- Proposed alternate time threatens SLA/customer commitment.

### Phase 1 requirements

REQ-NOS-P1-013, 016, 017, 018, 019.

## 11. Workflow stage H — Scheduling

### Trigger

Service Partner accepts or BHIS accepts an approved alternate schedule.

### Primary actors

BHIS coordinator and Service Partner.

### Actions

1. Record scheduled date/time or service window.
2. Record schedule source/actor.
3. Notify customer as required.
4. Move work to Scheduled.

### Authority boundary

Network OS owns the managed-service commitment, not the Service Partner's internal employee calendar.

If Partner OS exists later, schedule events may synchronize through controlled contracts.

### Exceptions

- Accepted work remains unscheduled beyond threshold.
- Customer cannot accommodate proposed schedule.
- Access requirement unresolved.
- Service Partner reschedules.

### Phase 1 requirements

REQ-NOS-P1-014, 016, 017, 020.

## 12. Workflow stage I — Service execution/status

### Trigger

Scheduled service window begins / Service Partner reports status.

### Optional/available statuses

- En Route.
- On Site.
- Work in Progress.
- On Hold.
- Unable to Access.
- Parts Required.
- Scope Change / Additional Approval Required.

Network OS must not require status granularity that a non-Partner-OS Service Partner cannot realistically supply in Phase 1.

### Actions

1. Record supplied operational status.
2. Detect overdue/late/access/scope exceptions where data exists.
3. Notify customer when required.
4. Preserve all material status changes in event history.

### Exceptions

- No-show / late.
- Customer unavailable.
- Unable to access.
- Scope exceeds authorization.
- Parts required.
- Qualification expires during active assignment where material.
- Complaint during execution.

### Phase 1 requirements

REQ-NOS-P1-011, 014, 016, 017, 019.

## 13. Workflow stage J — Completion submission

### Trigger

Service Partner finishes the assigned work.

### Primary actor

Service Partner.

### Submission content

Where required by service/customer/property rules:

- Completion status.
- Completion notes/findings.
- Photos/documents.
- Checklist/evidence.
- Scope changes or additional work identified.
- Rework/callback concerns.
- Quote/invoice/cost information where included in the authorized Phase 1 flow.

### Authoritative status

Work In Progress → Completion Submitted.

### Validation before BHIS review

Network OS checks required evidence presence according to configured rules where available.

### Exceptions

- Missing mandatory evidence.
- Incomplete checklist.
- Completion conflicts with approved scope.
- Reported callback/rework need.
- Invoice/cost discrepancy if financial flow is active.

### Phase 1 requirements

REQ-NOS-P1-015, 016, 017, 019.

## 14. Workflow stage K — BHIS completion review

### Trigger

Completion Submitted.

### Primary actor

BHIS service coordinator or authorized reviewer.

### Review questions

- Was the authorized scope completed?
- Is required evidence present and usable?
- Are findings/scope changes properly documented?
- Is rework required?
- Does customer need additional communication/approval?
- Is financial documentation sufficient for the authorized process?

### Outcomes

#### Approve completion

Move to customer notification/confirmation or Completed depending on policy.

#### Request correction/evidence

Create exception and return to Service Partner for missing/corrected information without erasing original submission.

#### Rework required

Create Rework Required exception/workflow and preserve responsibility/reason.

#### Dispute/management review

Escalate to authorized BHIS manager.

### Phase 1 requirements

REQ-NOS-P1-015, 016, 017, 019.

## 15. Workflow stage L — Customer communication / confirmation

### Trigger

BHIS approves completion or requires customer action.

### Primary actor

BHIS service coordinator / automated delivery under approved authority.

### Actions

1. Send completion/status information to customer.
2. Deliver approved customer-facing report/evidence where applicable.
3. Request customer confirmation/satisfaction only where required by policy/work type.
4. Record customer response/complaint if received.

### Outcomes

- Customer accepts / no confirmation required → Completed.
- Customer reports issue → Customer Complaint / Rework / Dispute exception.

### Authority boundary

Customer communication delivery may be automated, but final dispute resolution or unusual commitments remain human-controlled.

### Phase 1 requirements

REQ-NOS-P1-015, 016, 017, 019, 020.

## 16. Workflow stage M — Exception management

Exception handling operates across every workflow stage.

### Core exception types for Phase 1

- Service Partner non-response.
- Matching failure.
- Accepted but unscheduled.
- Late/no-show where known.
- Customer unavailable.
- Unable to access.
- Service overdue/SLA threat.
- Scope/approval problem.
- Qualification/compliance problem.
- Missing completion evidence.
- Customer complaint.
- Callback/rework.
- Pricing/quote discrepancy.
- Integration/communication delivery failure where operationally material.

### Exception record minimum

- Type/reason.
- Related customer/property/Service Need/work/Service Partner where applicable.
- Priority/severity.
- Owner.
- Created time.
- Due time where applicable.
- Status.
- Resolution.
- Escalation history.

### Resolution rule

Resolving an exception closes the exception record but does not rewrite or erase the underlying workflow history.

### Escalation

Unresolved exceptions can be reassigned/escalated according to future policy. Phase 1 must at least support ownership and manual escalation.

### Phase 1 requirements

REQ-NOS-P1-016, 017, 018, 019.

## 17. Workflow stage N — Work closeout

### Trigger

BHIS completion is approved, required customer communication/confirmation is complete, and no blocking exception remains.

### Primary actor

BHIS service coordinator / authorized workflow logic.

### Actions

1. Mark work Completed/Closed according to later state design.
2. Preserve completion time and close actor/source.
3. Update originating Service Need status where appropriate.
4. Update relationship history.
5. Update Service Partner operational history.
6. Make work available for management reporting.
7. Trigger financial follow-up only if separately authorized in the active release.

### Blocking conditions

- Mandatory evidence missing.
- Open blocking rework/dispute.
- Required customer approval/confirmation outstanding.
- Required BHIS review incomplete.

### Phase 1 requirements

REQ-NOS-P1-004, 011, 015, 016, 017, 018, 019.

## 18. Workflow stage O — Learning loop

### Trigger

Work closes or material operational events occur.

### Phase 1 learning data

At minimum, preserve enough event history to later derive:

- Service Partner response time.
- Acceptance/decline behavior.
- Decline reasons.
- Time to assignment.
- Time to schedule.
- Completion outcomes.
- Rework/callback indicators.
- Geography/service fulfillment history.
- Customer/property service history.
- Service Need demand patterns.

### Phase 1 constraint

Phase 1 need not calculate a full performance score or machine-learned match score. It must capture the events needed to support those capabilities later.

### Phase 1 requirements

REQ-NOS-P1-013, 017, 018, 019.

## 19. Dashboard/attention workflow

Network OS should surface work requiring human attention rather than force users to inspect every record.

### Relationship manager attention

- Follow-ups due.
- Properties not contacted recently where policy applies.
- New Service Needs.
- Deferred opportunities needing review.

### Service coordinator attention

- Work awaiting eligibility review/assignment.
- Offers awaiting Service Partner response.
- Accepted work unscheduled.
- Active exceptions.
- Completion submitted awaiting BHIS review.
- Missing evidence.
- Customer complaints/rework.

### Management attention

- High-priority aged exceptions.
- Work unable to match.
- Service/geography coverage gaps.
- Customer relationships with unresolved issues.
- Coordinator workload/exception concentration.

### Phase 1 requirements

REQ-NOS-P1-002, 004, 016, 018.

## 20. Customer-request intake variants

Phase 1 should permit more than one authorized intake path without creating multiple authoritative workflows.

Potential intake sources:

- BHIS relationship manager creates Service Need after visit/call.
- BHIS coordinator enters customer request received by phone/email.
- Low-friction customer request form/link if separately authorized.
- Future integration/API source.

All accepted intake paths converge into authoritative Network OS Service Need/work records.

## 21. Service Partner response variants

Phase 1 should permit more than one authorized response channel without requiring Partner OS.

Potential channels:

- secure action link;
- lightweight Service Partner workspace;
- SMS/email action flow;
- coordinator-recorded phone response with actor/source attribution;
- future Partner OS integration.

The channel does not own assignment/acceptance state; Network OS does.

## 22. State ownership summary

| State/domain | Authoritative owner in Phase 1 |
| --- | --- |
| Customer organization/property/contact | Network OS |
| Relationship/visit/follow-up | Network OS |
| Service Need | Network OS |
| Service Catalog | Network OS |
| Service Partner identity/network status | Network OS |
| Service Partner qualification/eligibility | Network OS |
| Work order managed-service state | Network OS |
| Service Partner offer/response | Network OS |
| Managed-service schedule commitment | Network OS |
| Completion evidence reference/provenance | Network OS |
| Exception/escalation | Network OS |
| Customer-facing managed-service status | Network OS |
| Service Partner internal technician/workforce state | Service Partner / Partner OS if used, not Network OS |
| External communication delivery log | Adapter evidence + Network OS event linkage |

## 23. Required workflow events

Architecture should later define exact event names, but Phase 1 must preserve the ability to identify at least:

- relationship contact/visit recorded;
- Service Need created/status changed;
- work created;
- eligibility reviewed;
- Service Partner selected;
- offer sent;
- offer accepted/declined/clarification/alternate/quote response;
- schedule set/changed;
- operational status changed where supplied;
- completion submitted;
- evidence accepted/rejected/missing;
- BHIS review approved/rejected/rework;
- customer notified/complaint received where applicable;
- exception opened/assigned/escalated/resolved;
- work completed/closed.

## 24. Phase 1 workflow boundaries

The workflow map does not require Phase 1 to implement:

- full Service Partner real-time capacity management;
- Partner OS integration;
- autonomous dispatch;
- machine-learned ranking;
- automated provider recruiting recommendations;
- mature recurring Service Programs;
- complete two-sided financial reconciliation;
- advanced territory mapping;
- full customer portal;
- full Service Partner portal;
- generic multi-tenant SaaS.

## 25. Architecture questions created by this workflow

The following questions must be answered in the next architecture/domain reconciliation step:

1. Which existing legacy entities can safely represent customer organizations, properties, contacts, Service Partners, work, and events without semantic debt?
2. Which Network OS domains require new authoritative records rather than legacy-table reuse?
3. How should Service Need relate to work orders when one need creates multiple jobs or no job?
4. How should eligibility requirements and qualification evidence be represented without hard-coding multifamily?
5. How should Service Partner offer/response history be modeled so reassignment and first-match metrics are reliable?
6. Which work states are authoritative statuses versus exceptions/reason codes?
7. What is the minimum generic exception model?
8. What event/audit model is needed to calculate response, assignment, schedule, completion, and first-match metrics later?
9. How should evidence/MIL be linked to work while respecting access and retention boundaries?
10. How should existing `tenant_id` structures be handled in a dedicated BHIS Network OS without accidentally creating tenant-product behavior?
11. Which communication actions can be direct application flows and which should be adapter/orchestration flows?
12. How should future Partner OS contracts exchange work and events without shared database ownership?

## 26. Workflow readiness conclusion

This workflow map closes the product-to-requirements gap for the initial managed-service operating loop.

The next controlled artifact should be the **Network OS Phase 1 Domain & Architecture Reconciliation**, which maps these workflows and requirements against the copied foundation and determines authoritative domain boundaries, reuse/adaptation strategy, and the architecture decisions needed before an implementation release can be activated.

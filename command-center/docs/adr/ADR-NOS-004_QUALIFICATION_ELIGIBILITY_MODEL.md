# ADR-NOS-004 — Qualification & Eligibility Model

**Status:** Proposed — founder ratification required  
**Date:** 2026-08-22  
**Decision owner:** Founder  
**Product:** Network OS  
**Implementation authority:** None; architecture decision only

## Context

BHIS must know whether a Service Partner is actually eligible for a specific managed-service assignment. Eligibility can depend on core BHIS approval, service capability, geography, insurance, licenses/certifications, customer/property requirements, market/facility qualification, and explicit restrictions.

The copied foundation contains onboarding/document concepts, but scattered booleans, profile fields, or subjective attestations would not support future ALF, group-home, institutional, government, customer-specific, and work-specific qualification requirements safely.

Network OS also needs to distinguish a Service Partner's overall network lifecycle from eligibility for one particular job.

## Decision

Network OS will use a **layered, evidence-backed qualification model** and a **deterministic eligibility evaluation** for Phase 1.

Qualification answers: **What requirements has this Service Partner satisfied, based on what evidence and authority?**

Eligibility answers: **Given this specific work context, may this Service Partner be considered for assignment right now?**

These are related but separate concepts.

## Qualification model

The logical model will distinguish:

1. **Qualification Layer** — a reusable scope such as Core BHIS Approved, Multifamily Approved, future ALF/Senior Living Approved, Government Approved, or other controlled layer.
2. **Requirement Definition** — an objective requirement such as insurance type/limit, license, certification, W-9, agreement, background requirement, or other credential/fact.
3. **Applicability Rule** — where/when the requirement applies: layer, service, geography, customer, property/facility, or work context.
4. **Evidence/Fact** — submitted document or objective factual value supporting satisfaction.
5. **Review Decision** — authorized human approval/rejection/waiver where separately permitted.
6. **Validity Window** — issue/effective/expiration dates where applicable.

## Data-over-attestation rule

Qualification workflows should request objective facts or evidence rather than asking Service Partners to decide whether a requirement applies to themselves.

Prefer:

- enter license number;
- upload certificate;
- enter coverage dates/limits;
- identify employee/work facts;
- select services performed.

Avoid relying on statements such as "I believe this requirement applies to me."

## Phase 1 qualification layers

Phase 1 architecture must support at least:

- **Core BHIS Approved**.
- **Multifamily Approved**.

The model must allow future layers without adding market-specific columns to the Service Partner root record.

## Eligibility evaluation

For a specific Work Order, Phase 1 eligibility will deterministically evaluate configured mandatory criteria including, where applicable:

- governed service capability;
- geographic coverage;
- Service Partner lifecycle/active status;
- required qualification layers;
- required licenses/certifications/insurance/evidence validity;
- customer/property mandated or restricted Service Partner rules;
- explicit do-not-dispatch restrictions.

The evaluation returns an eligibility result and structured blocking reasons.

## Human authority

- Authorized humans approve/reject qualification evidence.
- AI may assist extraction, missing-information detection, or review preparation when separately authorized, but cannot independently grant qualification.
- Human selection may override preference/ranking/order, but ordinary assignment authority does not bypass mandatory legal/compliance requirements.
- Any future waiver authority must be explicitly defined, narrow, auditable, and separate from routine assignment override.

## Expiration behavior

Expired or invalid mandatory evidence must affect eligibility for work requiring that evidence.

The architecture should support proactive expiration visibility later, but Phase 1 must at minimum prevent stale mandatory qualification from silently appearing valid.

## Evaluation history

Eligibility should not exist only as a transient UI query.

Network OS must preserve enough evaluation/selection evidence to explain why a Service Partner was eligible or blocked at the time of assignment and to support future audit, matching analysis, and exception resolution. Exact persistence strategy is deferred to implementation design.

## Legacy reuse decision

- Existing document upload/storage and onboarding submission mechanics are reuse candidates.
- Existing compliance flags may be migration inputs but are not automatically authoritative under the new model.
- Qualification must not be represented only as booleans on `partner_prospects` or Service Partner profile.
- Existing RLS/audit patterns should be reused where sound.

## Consequences

### Positive

- One qualification architecture can support multifamily and later facility/customer types.
- Eligibility becomes explainable and deterministic.
- Expired evidence can reliably block affected work.
- Customer/property-specific requirements can be added without rebuilding the Service Partner model.
- Matching receives structured eligibility inputs rather than free-text judgments.

### Costs

- More domain structure than simple onboarding checkboxes.
- Requirement applicability and evidence review need careful UX.
- Migration of legacy compliance data requires verification rather than blind carryover.

### Risks

- Overly complex requirement configuration could slow onboarding.
- Incorrect applicability rules could wrongly block or allow Service Partners.
- Broad waiver capability could undermine the qualification system.
- Sensitive qualification documents require strict access and retention controls.

## Rejected alternatives

| Alternative | Reason rejected |
|---|---|
| Qualification booleans on Service Partner row | Cannot represent layered, expiring, evidence-backed, customer/work-specific requirements cleanly |
| One onboarding checklist for every market | Hard-codes current market and becomes unmanageable as BHIS expands |
| Service Partner self-attestation determines applicability | Transfers BHIS qualification policy to the Service Partner and weakens reliability |
| AI automatically approves qualification | Violates human authority and creates unacceptable compliance risk |
| Eligibility calculated only in frontend filters | Not authoritative, explainable, or reliable enough for audit and matching |

## Implementation gate

Before implementation, the active release must define requirement types, applicability precedence, evidence metadata, review permissions, validity/expiration rules, customer/property restrictions, eligibility evaluation contract, persistence/audit strategy, RLS/access controls, and acceptance tests for REQ-NOS-P1-009, REQ-NOS-P1-010, and REQ-NOS-P1-012.

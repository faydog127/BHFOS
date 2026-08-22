# ADR-NOS-010 — Identity, RBAC & RLS

**Status:** Active — founder ratified 2026-08-22
**Date:** 2026-08-22  
**Decision owner:** Founder  
**Product:** Network OS  
**Implementation authority:** None; architecture decision only

**Ratification evidence:** `../NETWORK_OS_RELEASE1_SLICE1_FOUNDER_RATIFICATION_PACKET.md`

## Context

Network OS will hold confidential customer, property, Service Partner, qualification, operational, and internal risk information. BHIS internal users require different authority levels, and Service Partners will eventually need narrow external participation without receiving broad access to BHIS data.

The copied foundation uses Supabase Auth and existing RLS/role patterns. Those mechanisms are useful, but Network OS needs an explicit authorization model aligned to managed-network domains rather than legacy technician/direct-service roles.

## Decision

Network OS will use centralized authenticated identity plus layered authorization:

1. **Authentication** establishes who or what is acting.
2. **RBAC** establishes the actor's broad role family and permitted capabilities.
3. **RLS/data-scope enforcement** constrains which records the actor may read or mutate.
4. **Domain authorization rules** enforce sensitive business actions such as qualification approval, override, restriction, and future financial authority.

UI visibility alone is never an authorization control.

## Initial role families

The architecture will support at least these conceptual role families:

- **Founder / Executive** — broad management visibility and controlled high-authority actions.
- **BHIS Manager** — operational oversight, escalations, assignments, approved management actions.
- **Relationship / Territory Manager** — assigned customer/property relationships, visits, Service Needs, follow-ups, and appropriate customer context.
- **Service Coordinator** — managed work coordination, Service Partner interaction, scheduling, exceptions, completion review within assigned scope.
- **Qualification / Compliance Reviewer** — Service Partner qualification/evidence review where separated from management.
- **Service Partner External Actor** — narrow access only to their organization and authorized offers/work/evidence actions.
- **System / Adapter Identity** — narrowly scoped service identity for approved integrations and background actions.

Exact permissions are release-specific and must follow least privilege.

## Slice 1 access posture

For Release 1 / Slice 1, internal BHIS roles may be simplified operationally, but the model must preserve future separation.

Slice 1 must specifically control:

- organization/property/contact creation and editing;
- relationship ownership/status/notes;
- visit/contact event creation;
- Service Need creation/edit/status changes;
- sensitive property/access information;
- internal strategic/customer notes;
- administrative configuration such as Service Catalog changes.

## Record-scope rule

Authorization should support scoped access by assignment/territory/customer context later without requiring a schema redesign.

Phase 1 may initially allow broader BHIS internal visibility if explicitly approved, but sensitive fields/actions still require role-based controls.

## External actor rule

A Service Partner external actor must never receive generic access to BHIS customer, Service Partner network, internal performance/risk, margin, unrelated work, or qualification-review data.

External access must be resource-scoped to the minimum authorized offer/work/evidence context.

Partner OS adoption is not required for this identity.

## Internal versus external information

Network OS must support separation between:

- information safe/necessary for Service Partner participation; and
- BHIS-internal management information such as performance assessments, risk notes, restrictions, matching rationale, margins, and internal customer strategy.

The data model and authorization model must not rely solely on UI hiding to enforce this separation.

## Sensitive-field rule

Restricted fields such as gate/access/security instructions, resident-sensitive information, tax/payment information, and certain qualification/background evidence require stronger access constraints than ordinary customer contact data.

Exact field-level or related-record isolation strategy is deferred to implementation design, but broad table access must not accidentally expose restricted content.

## System/adapter identities

External automations and integrations must use dedicated identities/scopes where supported.

They must not impersonate a broad founder/admin identity for routine operations.

Adapter permissions should be limited to the specific actions required by the integration contract.

## RLS rule

Where Supabase/Postgres remains the persistence platform, RLS will be treated as a primary data-boundary enforcement mechanism for client-accessible records.

Server-side/service-role access does not remove the requirement for application/domain authorization. Service-role credentials must not be exposed to clients.

## Audit rule

Privileged actions and material authorization changes must generate security/administrative audit evidence under ADR-NOS-008.

## Legacy reuse decision

- Supabase Auth is a strong reuse candidate.
- Existing RLS and role utilities may be reused only after Network OS authorization review.
- Legacy technician/payroll/direct-service roles will not define Network OS permissions.
- Existing `tenant_id` scoping is addressed separately in ADR-NOS-011.

## Consequences

### Positive

- Authorization follows business responsibility rather than screen navigation.
- External Service Partner participation can remain narrow and safe.
- Future territory/assignment scoping can be introduced without changing identity fundamentals.
- Sensitive BHIS internal intelligence can remain internal.

### Costs

- Permission matrices and RLS tests become mandatory release work.
- Some data may need separation into protected related records rather than convenient shared rows.
- External action links/workspaces require careful token/session design later.

### Risks

- Overly broad early internal access could become difficult to tighten if not documented.
- Incorrect RLS could expose cross-domain or restricted data.
- Service-role shortcuts could bypass intended controls if not governed.

## Rejected alternatives

| Alternative | Reason rejected |
|---|---|
| UI-only permissions | Not a security boundary |
| One admin/user role split | Too coarse for BHIS operations and external Service Partners |
| Give Service Partners ordinary internal accounts | Exposes unnecessary product/data surface and creates adoption friction |
| Use broad service-role credentials for integrations | Excessive blast radius and poor accountability |
| Reuse technician roles as-is | Direct-service workforce semantics do not match managed-network responsibilities |

## Implementation gate

Before implementation, the active release must define a Slice 1 permission matrix, record/data scopes, restricted-field handling, RLS policies, service identities, authorization tests, and privileged-action audit requirements for REQ-NOS-P1-019 and applicable Slice 1 requirements. For REQ-NOS-P1-021, the matrix must explicitly define who may auto-send, approve, edit, retry, cancel, or view field follow-up communications and voice-derived notes.

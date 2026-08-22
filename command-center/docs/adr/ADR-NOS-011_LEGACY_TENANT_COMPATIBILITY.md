# ADR-NOS-011 — Legacy Tenant Compatibility

**Status:** Active — founder ratified 2026-08-22
**Date:** 2026-08-22  
**Decision owner:** Founder  
**Product:** Network OS  
**Implementation authority:** None; architecture decision only

**Ratification evidence:** `../NETWORK_OS_RELEASE1_SLICE1_FOUNDER_RATIFICATION_PACKET.md`

## Context

The copied BHFOS foundation contains widespread `tenant_id` assumptions from the prior architecture. Network OS, however, is initially a dedicated operating system for BHIS rather than a generic multi-tenant SaaS product.

Removing every tenant reference before useful implementation would create unnecessary migration risk. Preserving tenant semantics as a product concept would create the opposite problem: hidden multi-tenant behavior, unnecessary UI/configuration, and accidental coupling with Partner OS or other businesses.

## Decision

Network OS will use a **single-BHIS compatibility scope** during the transition.

Existing `tenant_id` fields may remain where they provide migration safety, RLS compatibility, foreign-key stability, or reuse of proven infrastructure, but they are treated as an internal compatibility/security scope — not as a Network OS customer-facing product concept.

Network OS will not expose tenant selection, tenant provisioning, tenant switching, per-tenant branding, generic tenant administration, or multi-tenant commercial configuration unless a future product decision explicitly authorizes it.

## BHIS scope rule

All active Network OS production records in the initial product are expected to belong to the authorized BHIS Network OS scope unless a later architecture decision introduces another system-owned scope for a technical purpose.

The exact canonical BHIS scope identifier will be defined in implementation planning and must be consistent across migrated/reused structures.

## New-domain rule

New Network OS tables/domains should not automatically receive `tenant_id` merely because legacy tables have it.

For each new domain, implementation design must decide whether scope is required for:

- RLS/security;
- compatibility with reused structures;
- future-safe isolation;
- operational environment separation.

If scope is needed, it should be represented consistently and without enabling generic tenant behavior.

## Legacy-table rule

For reused legacy tables:

- preserve `tenant_id` initially where removing it would destabilize constraints, RLS, functions, views, or application code;
- constrain Network OS reads/writes to the approved BHIS scope;
- remove tenant-selection assumptions from UI/application behavior;
- document any legacy function/view that assumes arbitrary tenant switching;
- retire obsolete tenant machinery incrementally after the relevant capability is migrated and validated.

## Partner OS isolation

Partner OS and Network OS are separate products and must not share authoritative business state merely because they originated from the same repository/foundation.

A common legacy tenant mechanism must not be used as a substitute for product integration.

Future interoperability between Network OS and Partner OS must occur through approved contracts/events/APIs, not cross-product direct table ownership or arbitrary tenant switching.

## Environment rule

Development, test, staging, and production separation remains distinct from tenant scope.

A BHIS compatibility scope does not permit test/training data to coexist indistinguishably with production data. Synthetic/training records must remain identifiable and isolated according to release/environment policy.

## Migration posture

Tenant cleanup will be incremental:

1. Inventory `tenant_id` dependencies in each capability entering an authorized slice.
2. Classify each dependency as security-critical, compatibility-only, obsolete, or product-semantic.
3. Preserve security-critical/compatibility dependencies during migration.
4. remove product-semantic tenant behavior from Network OS UX and domain logic.
5. replace or retire obsolete tenant utilities only after tests confirm no required dependency remains.
6. revisit whether a simpler dedicated-BHIS scope model is warranted after the core Network OS migration stabilizes.

## RLS interaction

ADR-NOS-010 governs authorization. If existing RLS relies on `tenant_id`, the BHIS compatibility scope may remain part of the RLS predicate during transition.

This is acceptable only if:

- the BHIS scope is reliably derived and cannot be user-selected arbitrarily;
- external Service Partner actors remain further restricted to authorized resources;
- server/service identities do not bypass domain authorization merely because they know the BHIS scope;
- tests prove cross-scope leakage is impossible for any retained legacy data.

## Consequences

### Positive

- Avoids a risky big-bang tenant-removal migration.
- Prevents legacy multi-tenant concepts from shaping Network OS UX/product scope.
- Allows reuse of mature RLS/foreign-key infrastructure while domains are migrated.
- Keeps Partner OS separation explicit.

### Costs

- Some technical tenant machinery remains temporarily even though the product is dedicated to BHIS.
- Developers must understand the difference between compatibility scope and product tenancy.
- Cleanup becomes staged technical debt rather than immediate deletion.

### Risks

- Future developers may mistake retained `tenant_id` for permission to build multi-tenant features.
- Inconsistent BHIS scope IDs could fragment data or break RLS.
- Legacy functions that accept arbitrary tenant parameters may create security risk if not inventoried.

## Rejected alternatives

| Alternative | Reason rejected |
|---|---|
| Remove all `tenant_id` references before Slice 1 | High migration risk with little immediate product value |
| Preserve full generic multi-tenant behavior | Not current Network OS product direction and adds complexity |
| Use tenant switching to integrate Partner OS | Violates separate-product/system-of-record architecture |
| Ignore legacy tenant dependencies | Risks RLS failures, broken functions, and cross-scope data leakage |

## Implementation gate

Before Slice 1 implementation, Cursor's implementation packet must include an inventory of `tenant_id` dependencies touched by the slice, the canonical BHIS compatibility-scope strategy, RLS implications, prohibited tenant UX/behavior, migration handling, and tests proving scope isolation.


# BHFOS V2 — Decision Register

| Field | Value |
| --- | --- |
| Status | Active |
| Version | 0.3-draft |
| Owner | Founder |
| Last reviewed | 2026-08-22 |
| Implementation authority | Active governance authority; no implementation authority |

## Decision control

A decision remains binding until a superseding decision is marked `Active`. A proposed or reopened replacement does not suspend the current active decision unless the founder explicitly records a temporary suspension.

Decision statuses are `Proposed`, `Active`, `Rejected`, `Superseded`, and `Suspended`. The founder records approval, rejection, suspension, and supersession.

## Authority rule

Only the founder may approve product scope, release scope, financial-policy changes, production deployment authority, or a departure from the Definition of Ready or Definition of Done. AI agents may recommend or document a decision but cannot approve one.

## DEC-V2-001 — TVG-first product

| Field | Value |
| --- | --- |
| Status | Active |
| Date | 2026-08-01 |
| Decision owner | Founder |

V2 is first an in-house operating system for The Vent Guys. Future franchise compatibility may be preserved where practical, but shared multi-tenant SaaS development is not authorized without a new decision.

## DEC-V2-002 — Existing BHFOS repository remains authoritative

| Field | Value |
| --- | --- |
| Status | Active |
| Date | 2026-08-01 |
| Decision owner | Founder |

V2 continues within the existing `faydog127/BHFOS` repository, isolated through controlled branches and worktrees rather than a disconnected repository.

## DEC-V2-003 — Command Center is the product and build-control authority

| Field | Value |
| --- | --- |
| Status | Active |
| Date | 2026-08-01 |
| Decision owner | Founder |

Documents under `command-center/docs/v2/` are the authoritative V2 product and build-control system. Conversations, screenshots, and demonstrations are inputs, not final authority.

## DEC-V2-004 — Jira and Confluence will not be used initially

| Field | Value |
| --- | --- |
| Status | Active |
| Date | 2026-08-01 |
| Decision owner | Founder |

The initial solo-development process uses the repository-based Command Center, GitHub branches, pull requests, and automated validation instead of Jira or Confluence.

## DEC-V2-005 — Foundation ratification gate

| Field | Value |
| --- | --- |
| Status | Active |
| Date | 2026-08-01 |
| Decision owner | Founder |

### Decision

The V2 foundation becomes active authority only after reconciliation, review, founder approval, and formal pull-request review are recorded. Until then it authorizes documentation work only.

### Gate sequence

1. Reconciled documents are committed on the V2 branch.
2. Draft pull request is opened.
3. Pull request is reviewed against the alignment report.
4. Founder approval is recorded.
5. Applicable documents are changed from `Draft` to `Active` and merged.

## DEC-V2-008 — Founder retains approval authority

| Field | Value |
| --- | --- |
| Status | Active |
| Date | 2026-08-01 |
| Decision owner | Founder |

### Decision

Only the founder may approve product-scope changes, release authorization, release-scope changes, financial-policy changes, production deployment authority, emergency production exceptions, or departures from the Definition of Ready or Definition of Done.

AI agents, reviewers, and contractors may recommend, analyze, document, or implement authorized work but may not grant themselves authority.

## DEC-V2-006 — One active implementation slice at a time

| Field | Value |
| --- | --- |
| Status | Active |
| Date | 2026-08-01 |
| Decision owner | Founder |

The solo-development process permits no more than one active implementation slice at a time. Newly discovered ideas go to the appropriate intake or register instead of silently entering active work.

## DEC-V2-007 — GitHub remains the code source of truth

| Field | Value |
| --- | --- |
| Status | Active |
| Date | 2026-08-01 |
| Decision owner | Founder |

GitHub is authoritative for committed code history, branches, pull requests, and release SHAs. The local `F:` workspace is an active development environment, not the sole backup.

## DEC-V2-009 — Environment isolation is mandatory

| Field | Value |
| --- | --- |
| Status | Active |
| Date | 2026-08-01 |
| Decision owner | Founder |

### Decision

Development, testing, staging, and production must use clearly identified and controlled environments. Synthetic, test, training, or staging activity may not contaminate production customer communications, payment systems, accounting systems, reporting, or customer records. Production credentials may not be used as ordinary development credentials.

### Consequences

- Environment ownership must be defined during architecture.
- Deployment targets must be explicit.
- Test data must be identifiable.
- Production mutation requires specific authority.
- Validation evidence must identify the environment and exact version tested.

This policy does not prematurely decide the number of Supabase projects, hosting targets, or deployment architecture.

## DEC-V2-010 — Franchise capability is deferred

| Field | Value |
| --- | --- |
| Status | Active |
| Date | 2026-08-01 |
| Decision owner | Founder |

### Decision

V2 will not build multi-tenant, franchise-management, or cross-company data-isolation capabilities during the current TVG-first program. Architecture should avoid unnecessary barriers to future expansion, but franchise compatibility is not an active requirement and may not add present implementation complexity without a new founder decision.

### Consequences

- The TVG deployment remains dedicated.
- No speculative tenant abstraction is required.
- No capability may claim franchise support without separate authorization.
- Material architecture decisions may record future expansion consequences without implementing them.

## DEC-V2-011 — Product Definition ratification

| Field | Value |
| --- | --- |
| Status | Active |
| Date | 2026-08-01 |
| Decision owner | Founder |
| Founder approval | Explicitly approved by the founder in PR #131 final ratification review on 2026-08-01 |

### Decision

The reconciled `V2_PRODUCT_DEFINITION.md` is ratified and this decision is Active through the formal pull-request review, explicit founder approval, activation commit, and merge of PR #131.

### Consequences

- Product Definition ratification does not authorize requirements, architecture, releases, migrations, deployment, production changes, or application implementation.
- Unresolved product questions remain recorded and do not become silent scope.
- Implementation authorization remains a separate governed gate.

## DEC-V2-012 — Multi-tenancy requires demonstrated TVG operating maturity

| Field | Value |
| --- | --- |
| Status | Active |
| Date | 2026-08-01 |
| Decision owner | Founder |
| Founder approval | Explicitly approved by the founder in PR #131 final ratification review on 2026-08-01 |

### Decision

BHFOS V2 is designed and built as a single-company operating system for The Vent Guys. Multi-tenancy is reserved for a separate future build requiring explicit founder authorization. Existing `tenant_id` fields may remain where needed for compatibility, security, data integrity, or migration safety, but they must not drive current product design or create multi-tenant scope.

Multi-tenancy may be reconsidered only after the founder confirms approved stability, working-module, adoption, workflow-reliability, operational-maturity, security, financial-control, maintainability, and external-business-case benchmarks. Passing those benchmarks permits reconsideration only; it does not authorize a multi-tenant build.

### Consequences

- Normal users enter the TVG workspace without tenant selection or switching.
- No tenant provisioning, per-tenant configuration or billing, cross-company administration, franchise controls, or tenant-oriented module design is authorized in the current program.
- Existing tenant-related structures require dependency, architecture, security, and migration analysis before any remediation.
- This decision supersedes the future-readiness portion of DEC-V2-010 while preserving DEC-V2-010's prohibition on current franchise and multi-company scope.

## DEC-V2-013 — Adopt an AI-native, founder-by-exception operating model

| Field | Value |
| --- | --- |
| Status | Active |
| Date | 2026-08-01 |
| Decision owner | Founder |
| Founder approval | Explicitly approved by the founder in PR #131 final ratification review on 2026-08-01 |

### Decision

BHFOS V2 is an automation-first, AI-assisted operating platform for The Vent Guys. It should reduce routine administrative, analytical, coordination, reporting, marketing, financial, retention, and follow-up work so the founder operates primarily through strategy, approvals, exceptions, and performance review.

Every AI or automation capability must have an explicit authority level from assistance through governed execution within approved limits. Authority must grow only after the underlying module, deterministic controls, evaluation evidence, failure recovery, and human-accountability requirements are satisfied.

### Consequences

- AI may assist, recommend, execute low-risk reversible actions, or execute governed actions within approved limits as explicitly authorized.
- AI may not independently authorize pricing-policy changes, unusual customer commitments, out-of-limit financial transactions, public use of restricted media, production deployment, release activation, governance decisions, or founder decisions.
- This decision establishes product direction and governance; it does not authorize any individual AI implementation, requirement, architecture, release, deployment, or production change.

## DEC-V2-014 — Review Board authority remains in BHFOS; n8n orchestrates execution

| Field | Value |
| --- | --- |
| Status | Active |
| Date | 2026-08-05 |
| Decision owner | Founder |
| Founder approval | Explicit approval recorded on 2026-08-05 |
| Implementation authority | Planning and controlled design only; none for migrations, application code, production changes, release activation, or n8n activation |
| Architecture record | [ADR-DEC-V2-014](./ADR-DEC-V2-014_REVIEW_BOARD_AUTHORITY_AND_N8N_INTEGRATION.md) |

### Decision

BHFOS shall own authoritative Review Board requests, runs, idempotency, claims, leases, state transitions, provider-action reservations, artifacts, costs, reconciliation, append-only audit evidence, and human decisions. n8n is approved only as the orchestration and provider-coordination layer.

n8n may execute only claimed work and may perform a provider action only after BHFOS authorizes the exact logical action. n8n must report progress and results through narrow authenticated services and may not directly write authoritative Review Board tables using broad `service_role` access.

Multi-model reviewers, if separately authorized, must operate as blind independent critics behind deterministic validation and a governed adjudication step. No AI model or n8n workflow may make the final business decision.

### Consequences

- The Review Board authority layer must exist in BHFOS before n8n becomes the authoritative integration.
- A Drive file, provider execution, or n8n execution history is evidence or delivery output, not the system of record.
- Request-scoped authorization, atomic duplicate protection, provider-action reservations, reconciliation, and human-decision boundaries are required.
- TVG remains the single-company operating context; this decision creates no multi-tenant product scope.
- This decision establishes architecture and planning authority only. Implementation remains blocked until an active Release ID and the complete Definition of Ready gate are satisfied.

## DEC-V2-015 — Expand approved operating context to TVG Direct Services and BHIS Managed Services

| Field | Value |
| --- | --- |
| Status | Proposed |
| Date | 2026-08-22 |
| Decision owner | Founder |
| Supporting amendment | [V2_BHIS_PRODUCT_DIRECTION_AMENDMENT](./V2_BHIS_PRODUCT_DIRECTION_AMENDMENT.md) |
| Supporting reconciliation | [V2_BHIS_PRODUCT_DIRECTION_RECONCILIATION](./reviews/V2_BHIS_PRODUCT_DIRECTION_RECONCILIATION.md) |
| Implementation authority | None |

### Proposed decision

BHFOS V2 shall become the operating platform for approved Black Horse service-delivery operations, initially supporting TVG Direct Services and Black Horse Integrated Services (BHIS) Managed Services.

TVG Direct Services retains the direct-service operating model. BHIS Managed Services owns and manages customer service relationships while coordinating qualified fulfillment through internal, BHIS-network, customer-preferred, or customer-mandated fulfillment parties.

This decision expands the approved first-party operating context but does not authorize generic multi-tenant SaaS, tenant provisioning/switching, per-tenant configuration or billing, franchise administration, cross-company tenant administration, or arbitrary external operating-company onboarding.

BHIS is a managed service-delivery organization, not a contractor directory, referral marketplace, or open bidding marketplace. BHFOS remains the authoritative operational system of record where capabilities are implemented.

### Proposed consequences

- Upon activation, this decision supersedes DEC-V2-001's TVG-only product boundary while preserving its prohibition on shared multi-tenant SaaS without separate authority.
- Upon activation, DEC-V2-012 must be amended/superseded only as necessary to remove the TVG-only operating-context restriction; its multi-tenancy prohibition remains materially binding.
- Commercial Account Management moves toward a shared core relationship/account capability.
- Provider Network, provider qualification, provider capacity/density, managed-service coordination, Service Need/demand intelligence, and network economics become approved BHIS product domains.
- Work-order architecture may later be designed around an authorized fulfillment-party concept rather than assuming only an internal technician, subject to approved requirements and architecture.
- Multifamily is the initial BHIS market; future ALF/senior living, group-home, commercial/institutional, and government qualification layers may be anticipated without implementing them prematurely.
- DEC-V2-013's AI-native/founder-by-exception direction remains binding and extends conceptually to the approved operating context after corresponding Product Definition terminology is ratified.
- DEC-V2-014's system-of-record and human-decision boundaries remain binding; terminology referring to TVG-only context requires later controlled reconciliation.
- No implementation, release, migration, deployment, provider/customer production onboarding, AI matching, autonomous dispatch, or financial-policy authority is granted.

### Activation gate

This decision remains Proposed until the founder explicitly approves the product-scope change, the Product Definition amendment is reconciled through formal pull-request review, applicable controlled documents are updated, and activation is recorded according to DEC-V2-005 and DEC-V2-008.

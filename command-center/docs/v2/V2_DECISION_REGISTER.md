
# BHFOS V2 — Decision Register

| Field | Value |
| --- | --- |
| Status | Draft |
| Version | 0.1 |
| Owner | Founder |
| Last reviewed | 2026-08-01 |
| Implementation authority | Governance draft; not yet active |

## Decision control

A decision remains binding until a superseding decision is marked `Active`. A proposed or reopened replacement does not suspend the current active decision unless the founder explicitly records a temporary suspension.

Decision statuses are `Proposed`, `Active`, `Rejected`, `Superseded`, and `Suspended`. The founder records approval, rejection, suspension, and supersession.

## Authority rule

Only the founder may approve product scope, release scope, financial-policy changes, production deployment authority, or a departure from the Definition of Ready or Definition of Done. AI agents may recommend or document a decision but cannot approve one.

## DEC-V2-001 — TVG-first product

| Field | Value |
| --- | --- |
| Status | Proposed |
| Date | 2026-08-01 |
| Decision owner | Founder |

V2 is first an in-house operating system for The Vent Guys. Future franchise compatibility may be preserved where practical, but shared multi-tenant SaaS development is not authorized without a new decision.

## DEC-V2-002 — Existing BHFOS repository remains authoritative

| Field | Value |
| --- | --- |
| Status | Proposed |
| Date | 2026-08-01 |
| Decision owner | Founder |

V2 continues within the existing `faydog127/BHFOS` repository, isolated through controlled branches and worktrees rather than a disconnected repository.

## DEC-V2-003 — Command Center is the product and build-control authority

| Field | Value |
| --- | --- |
| Status | Proposed |
| Date | 2026-08-01 |
| Decision owner | Founder |

Documents under `command-center/docs/v2/` are the authoritative V2 product and build-control system. Conversations, screenshots, and demonstrations are inputs, not final authority.

## DEC-V2-004 — Jira and Confluence will not be used initially

| Field | Value |
| --- | --- |
| Status | Proposed |
| Date | 2026-08-01 |
| Decision owner | Founder |

The initial solo-development process uses the repository-based Command Center, GitHub branches, pull requests, and automated validation instead of Jira or Confluence.

## DEC-V2-005 — Foundation ratification gate

| Field | Value |
| --- | --- |
| Status | Proposed |
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
| Status | Proposed |
| Date | 2026-08-01 |
| Decision owner | Founder |

### Decision

Only the founder may approve product-scope changes, release authorization, release-scope changes, financial-policy changes, production deployment authority, emergency production exceptions, or departures from the Definition of Ready or Definition of Done.

AI agents, reviewers, and contractors may recommend, analyze, document, or implement authorized work but may not grant themselves authority.

## DEC-V2-006 — One active implementation slice at a time

| Field | Value |
| --- | --- |
| Status | Proposed |
| Date | 2026-08-01 |
| Decision owner | Founder |

The solo-development process permits no more than one active implementation slice at a time. Newly discovered ideas go to the appropriate intake or register instead of silently entering active work.

## DEC-V2-007 — GitHub remains the code source of truth

| Field | Value |
| --- | --- |
| Status | Proposed |
| Date | 2026-08-01 |
| Decision owner | Founder |

GitHub is authoritative for committed code history, branches, pull requests, and release SHAs. The local `F:` workspace is an active development environment, not the sole backup.

## DEC-V2-009 — Environment isolation is mandatory

| Field | Value |
| --- | --- |
| Status | Proposed |
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
| Status | Proposed |
| Date | 2026-08-01 |
| Decision owner | Founder |

### Decision

V2 will not build multi-tenant, franchise-management, or cross-company data-isolation capabilities during the current TVG-first program. Architecture should avoid unnecessary barriers to future expansion, but franchise compatibility is not an active requirement and may not add present implementation complexity without a new founder decision.

### Consequences

- The TVG deployment remains dedicated.
- No speculative tenant abstraction is required.
- No capability may claim franchise support without separate authorization.
- Material architecture decisions may record future expansion consequences without implementing them.

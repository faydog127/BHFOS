# DECISION — Command Center v1 Approved

**Date:** 2025-12-17  
**Decided By:** Human (Product Owner)  
**Status:** Accepted

## Context
Approve the scope for the Re-Group Command Center v1 (read-only mirror) and its supporting tasks to avoid scope drift during implementation.

## Decision
- Proceed with Command Center v1 as a read-only GitHub mirror with the defined pages and constraints in the Horizons requirements (2025-12-17).
- Implement via TASK-001 through TASK-004 (scaffold, GitHub read client, Re-Group markdown viewer, caching/refresh).
- No GitHub write actions (approvals/comments) until v1.1.

## Rationale
- Keeps GitHub as the single source of truth while providing a non-coder dashboard.
- Phased approach reduces risk: scaffold first, then read-only data, then caching.
- Aligns with H1 goal and avoids premature platform changes.

## Rejected Options
- Building approvals/actions in v1 (postponed to v1.1).
- Adding a separate task database (GitHub remains the source of truth).

## Consequences
- Faster delivery of a usable read-only dashboard.
- Write actions explicitly deferred; requires separate approval for v1.1.

## Rollback / Reversal Conditions
- If GitHub API or auth constraints block progress, pause and revisit scope before adding write actions.

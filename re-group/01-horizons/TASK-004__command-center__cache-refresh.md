# TASK-004 — Command Center Caching & Refresh

**Date:** 2025-12-17  
**Owner:** Human  
**Status:** Ready  
**Horizon:** H1

## Goal
Reduce API calls and keep data feeling responsive.

## Must
- ISR revalidate ≈60 seconds OR server cache with ~60s TTL
- Optional “Refresh” button to bypass cache

## Acceptance Criteria
- Reloading the same page repeatedly doesn’t hammer GitHub API
- Data updates within roughly 60 seconds

## Out of Scope
- Complex cache invalidation rules
- Client-side polling

## Test / Verification Steps
- Hit pages repeatedly and verify GitHub rate limits aren’t triggered
- Update data in GitHub and confirm it appears within ~60 seconds

## Rollback Plan
- Remove caching layer and refresh control

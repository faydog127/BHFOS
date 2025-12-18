# TASK-002 — Command Center GitHub Read Client

**Date:** 2025-12-17  
**Owner:** Human  
**Status:** Ready  
**Horizon:** H1

## Goal
Fetch GitHub data server-side using env vars.

## Env Vars
- `GITHUB_TOKEN`
- `GITHUB_OWNER`
- `GITHUB_REPO`

## Must Fetch
- Open PRs (REST API)
- Recent commits (REST API)

## Acceptance Criteria
- `/prs` shows real PRs (title, author, updated, link)
- `/` shows PR count + recent commits count (or simple list)
- No secrets in browser (token not referenced in client bundle)
- Friendly error message if token missing/invalid

## Out of Scope
- Approvals/actions
- Complex filtering/sorting
- User login

## Test / Verification Steps
- Set env vars locally; confirm `/prs` renders PRs from the repo
- Confirm build output does not include `GITHUB_TOKEN`
- Break the token intentionally and see a friendly error

## Rollback Plan
- Remove GitHub client module and env var references

# TASK-001 — Command Center App Scaffold (Next.js)

**Date:** 2025-12-17  
**Owner:** Human  
**Status:** Ready  
**Horizon:** H1

## Goal
Create `/command-center` Next.js App Router app and deploy on Vercel.

## Scope
- Create Next.js App Router app under `/command-center`
- TypeScript enabled
- Basic layout + navigation
- Routes exist but can be placeholder content

## Routes (placeholders OK)
- `/` Dashboard
- `/prs` PR list
- `/prs/[id]` PR detail
- `/re-group` list markdown docs
- `/re-group/[slug]` render markdown doc

## Acceptance Criteria
- `npm install` and `npm run dev` works inside `/command-center`
- `npm run build` succeeds
- Vercel deploy succeeds with Root Directory = `command-center`
- Each route loads without error (can show “Coming soon”)

## Out of Scope
- GitHub API integration
- Auth UI
- Styling beyond minimal readability

## Test / Verification Steps
- `npm install` then `npm run dev` in `/command-center` starts without errors
- `npm run build` passes
- Visit each route locally: `/`, `/prs`, `/prs/placeholder`, `/re-group`, `/re-group/placeholder`

## Rollback Plan
- Revert the `/command-center` directory addition and related configs

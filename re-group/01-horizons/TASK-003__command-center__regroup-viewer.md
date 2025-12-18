# TASK-003 — Re-Group Markdown Viewer (GitHub Contents API)

**Date:** 2025-12-17  
**Owner:** Human  
**Status:** Ready  
**Horizon:** H1

## Goal
Read and render `/re-group/**/*.md` from GitHub.

## Must
- `/re-group` lists markdown files (path + last updated if available)
- `/re-group/[slug]` renders markdown content
- Support frontmatter if present (gray-matter)

## Acceptance Criteria
- Renders `re-group/04-implementation/current-sprint.md`
- Renders at least one decision file from `re-group/03-decisions/` (once created)
- Works on Vercel

## Out of Scope
- Offline caching beyond what is in TASK-004
- Editing or writing markdown

## Test / Verification Steps
- View `/re-group` and confirm files list from repo
- Open `/re-group/...` pages for sprint and decision docs
- Check rendering on Vercel preview

## Rollback Plan
- Remove markdown viewer routes/components and related fetch calls

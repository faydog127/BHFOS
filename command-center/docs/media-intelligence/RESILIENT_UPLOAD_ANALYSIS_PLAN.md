# MIL — Resilient Mobile Upload + Visible AI Analysis (execution plan)

**Commit base:** `d0d6312457125e8d88cada5e6aadc090eb5078e7`  
**Staging:** `mil.bhfos.com` · Supabase `sdzhdupekcnekesbtxsl` only  
**Evidence before change:** non-resumable signed PUT; IndexedDB batch-id only; analyze invoke-on-demand; Review Queue is only rich AI UI; no polling.

## Root causes

1. Single-request PUT + in-memory `File` / session token → screen-off / refresh loses recoverable upload work.
2. Finalize queues `ai_analyze` jobs but nothing drains them unless staff clicks; UI does not auto-refresh or surface a plain-language outcome outside Review Queue.

## Design (smallest coherent vertical)

### Client queue (IndexedDB)

- DB `mil-upload-queue` v2: items with `clientUploadId`, metadata, optional `Blob`, grant/session refs (no secrets longer than needed), byte progress, phase, errors, `assetId`.
- Session token kept in memory only; re-validate / re-create session on recovery.
- If Blob missing after restart → status `needs_reselect` + checksum/metadata match on reselect.

### Transport

- Prefer Supabase **signed TUS**: `…/storage/v1/upload/resumable/sign` + `x-signature: <mint token>` (preserves quarantine grant path; no RLS bypass).
- Fallback: existing signed PUT when TUS unavailable.
- Chunk ~6 MiB; concurrency 2; exponential backoff; Wake Lock secondary only.
- Edge: `refresh_upload_grant` for expired signature; mint accepts `clientUploadId` for idempotent re-mint.

### Finalization / analysis

- Keep existing complete_file finalize + checksum dedupe.
- After successful commit, edge triggers internal analyze (service-role invoke) so phone dumps get analysis without a second staff click.
- Analyze: richer structured contract (`mil-v2`), server validation, honest video/oversized skips; raise AI-safe byte default for field photos.
- Client: after finalize, poll asset + latest `mil_ai_analyses` until terminal; Review Queue + All Media show useful outcome card.

### Login destination

- Narrow fix only if a small `next=` / returnTo preservation exists; otherwise document.

### Deploy

- Migration to staging only; deploy `media-intel-upload-session` + `media-intel-analyze`; package + Hostinger `mil-staging` only.

### Rollback

- Prior MIL archive + redeploy; function redeploy prior versions; migration additive (no destructive DB rollback).

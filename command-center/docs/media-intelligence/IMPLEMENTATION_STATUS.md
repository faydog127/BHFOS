# Media Intelligence Library — Implementation Status

**Branch:** `feat/media-intelligence-library`  
**Baseline:** `9369d206bfbcaf32267e9e88518b222146e11de8`  
**Architecture:** Single-company (see `SINGLE_COMPANY_CORRECTION.md`)  
**Working tree:** pre-staging hardening — **no remote migration apply, no edge deploy, no merge, no prod**

**Last consolidated review:** 2026-07-25

## Status buckets (used throughout MIL docs)

| Bucket | Meaning |
|---|---|
| **1. Implemented and locally proven** | Source + unit/contract tests pass (`npm run test:media-intel-helpers`); behavior verified without live Supabase |
| **2. Implemented but requiring staging proof** | SQL/edge code exists in repo; not applied/deployed to an authorized staging project |
| **3. Scaffold/UI only** | Routes/components present; end-to-end behavior not proven against live DB/storage |
| **4. Deferred** | Explicitly out of scope for this slice |
| **5. Disabled pending safe implementation** | Code path exists but intentionally returns blocked/disabled until a proven pipeline exists |

## Migrations (all **2 — staging proof required**)

| File | Scope |
|---|---|
| `20260725120000_media_intelligence_library.sql` | Core `mil_*` schema, buckets, role helpers, RLS baseline, derivative kinds incl. `public_safe` / `ai_safe`, customer-permission gates |
| `20260725130000_media_intel_access_sessions.sql` | Upload sessions, grant binding, bearer phone upload |
| `20260725140000_media_intel_pre_staging_hardening.sql` | Capability-matrix RLS (drops `mil_staff_all_*`), SECURITY DEFINER RPCs, `mil_finalize_upload_grant`, `mil_is_reviewer` excludes `office` |
| `20260725150000_media_intel_analyze_honesty.sql` | Honest analyze skip reasons (`skipped_needs_ai_safe_derivative`, etc.) |

None of the above are applied outside disposable local testing. **Do not treat RLS or storage behavior as proven until staging apply + pgTAP/SQL tests run.**

## Edge functions (all **2 — deploy required**)

| Function | Status |
|---|---|
| `media-intel-upload-session` | **2** — mint/complete with quarantine → trusted checksum → `mil_finalize_upload_grant` |
| `media-intel-sign` | **2** — server-side signed URL minting (replaces client `createSignedUrl`) |
| `media-intel-analyze` | **2** — invoke-on-demand only; no background worker drains `mil_processing_jobs` |
| `media-intel-promote-website` | **5** — `prepare_public_safe` / `promote` return **503 `not_implemented`**; `unpublish` only |
| `media-intel-creator-admin` | **2** — invite/assign/revoke creators (requires deploy) |
| `media-intel-reel-upload` | **2** — creator reel PUT via signed URL (requires deploy) |

Shared CORS helper: `supabase/functions/_shared/milCors.ts` (**1** — imported by every `media-intel-*` function).

## Client / UI

| Area | Status | Notes |
|---|---|---|
| Product routes `/media/*`, `/creator/*`, `/media/upload` | **1 + 3** | Wired in `App.jsx`; pages are scaffold until staging data exists |
| CRM alias `/crm/media/*` → `/media/*` | **1** | Redirect only; grants no extra access |
| `MediaSessionGuard` + capability guards | **1** | Client hints; **RLS is authoritative** |
| Resumable upload + checksum de-dupe + IndexedDB recovery | **1** | Unit tests; staff uploads use `mil/quarantine/` path |
| Practical max upload **250 MB** | **1** | `checksum.js` / `constants.js`; not 2 GB (memory/hashing honesty) |
| Phone upload link format `#session=` | **1** | Fragment preferred over `?session=` (see `MediaSettings.jsx`, `MediaMobileUpload.jsx`) |
| Client `signedUrl()` / `audit()` | **5** | Throw — use `requestSignedMediaUrl` + server RPC audit |
| Grid thumb derivatives (client JPEG) | **3** | Preview path exists; staff cannot write trusted derivatives to storage (quarantine-only INSERT policy) |
| Review queue, collections, B&A, creator workspace, reel review | **3** | UI + RPC wiring; needs staging proof |
| Dashboard counts | **3** | Queries `mil_*` tables (empty until migrations applied) |
| Settings / approved-to-post | **1** | Explicit “no social publishing” copy |

## Security / access hardening (**1** locally, **2** on live DB)

- **Capability-matrix RLS** replaces broad `mil_staff_all_*` policies (**1** in migration source; **2** until applied).
- **`mil_is_reviewer()`** = admin, manager, media_reviewer only — **office excluded** from reviewer write surfaces (**1** contract tests + SQL tests).
- **`phone_uploader` is NOT a product library role** — phone dumps authorized only by bearer upload session tokens minted by owner/admin (**1**).
- **Atomic `mil_finalize_upload_grant`** (service_role only): edge hashes quarantine bytes before finalize (**1** source + unit tests; **2** e2e).
- **No client `mil_audit_events` inserts** — privileged mutations audit via `mil_audit_insert()` inside RPCs (**1**).
- **No social publishing** (**1** UI + docs).

## AI / processing queue (honest)

- `mil_processing_jobs` rows are created `queued` on finalize, but **there is no always-on worker**.
- **`media-intel-analyze` is invoke-on-demand** (client `queueAiAnalysis` calls the edge function directly). Uninvoked jobs stay `queued` forever — that reflects real architecture, not a hidden background worker claim.
- OpenAI path requires key; no-key → honest skip (**1** edge source + tests).
- Near-duplicate perceptual similarity, HEIC worker, video thumbs/transcripts: **4 — deferred**.

## Website promotion (**5**)

`prepare_public_safe` and `promote` are **disabled (503)** until a proven decode → re-encode → strip pipeline exists. Marker-only EXIF removal does **not** prove public safety. `unpublish` remains for pulling existing public copies.

## Backup / restore / export

Documented in `BACKUP_RESTORE_EXPORT.md`. Procedures are **2 — not proven recoverable** (no restore drill executed in this worktree).

## Tests

| Suite | Status |
|---|---|
| `npm run test:media-intel-helpers` | **1** — unit/contract tests (Node, no Docker) |
| `tests/unit/media-intel-contracts.test.mjs` | **1** — static cross-file contracts |
| `supabase/tests/mil/*.sql` | **1** — executed after local `npx supabase db reset` (PASS) |
| Local `supabase db reset` | **1** — applied all four MIL migrations on disposable local stack (2026-07-25). Requires conditional skip in `20260721120000_ml_p1_rs101_deny_estimates_insert.sql` when `public.estimates` is absent. **Not applied to staging/production.** |

## Explicit non-goals (**4**)

Social connections, scheduling, automatic publishing, facial recognition, phone deletion, destructive de-dupe, production deploy, vent-guys.com changes, new domains/subdomains, multi-tenant MIL product architecture, artificial organization/account/company/workspace ownership entities for MIL.

## Remaining for Definition of Done (requires owner authorization)

1. Apply migrations + deploy edge functions to authorized staging Supabase
2. Run `supabase/tests/mil/*.sql` after reset; capture evidence
3. End-to-end acceptance scenarios (upload → review → creator → unpublish)
4. Accessibility + responsive screenshot suite
5. Large synthetic library performance harness
6. Owner authorization before CRM staging deploy / merge

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
| `20260726090000_media_intel_upload_finalization_lifecycle.sql` | Durable upload finalization state machine; `abandoned_count`; `mil_integrity_alerts`; nine `service_role`-only RPCs; **drops** `mil_finalize_upload_grant` and `mil_cleanup_expired_upload_grants`; removes client write grants on all lifecycle tables |

None of the above are applied outside disposable local testing. **Do not treat RLS or storage behavior as proven until staging apply + pgTAP/SQL tests run.**

### Why 20260726090000 exists

The previous one-shot `mil_finalize_upload_grant` inserted the `mil_assets` row and
*then* asked storage to place the bytes. An interruption between those two steps
left a library entry for media that did not exist, and the phone had already been
told "uploaded" — the worst possible failure for someone who is about to clear
their camera roll. Finalization is now a persisted state machine
(`minted → placing → placed → committed | duplicate | failed | abandoned`), and the
commit transaction proves the final object is visible in `storage.objects` before
an asset row can exist. An interrupted transfer is reconciled from recorded state
instead of guessed at.

Two further consequences of that migration:

- **Client writes are gone, not just policy-restricted.** `INSERT`/`UPDATE`/`DELETE`
  on `mil_upload_batches`, `mil_upload_grants`, `mil_manifest_entries`,
  `mil_upload_sessions` and `mil_integrity_alerts` are revoked from `authenticated`
  and `anon`; `mil_assets` keeps `UPDATE` for the reviewer policy but loses
  `INSERT`/`DELETE`. Correct-looking RLS on a table the role can still write is not
  a control.
- **Surviving grants are stated explicitly.** The migration re-grants `SELECT`
  (and the reviewer `UPDATE`) rather than trusting whatever default privileges an
  environment happened to have, because the local disposable stack and the hosted
  project do not start from the same table ACL.

## Edge functions (all **2 — deploy required**)

| Function | Status |
|---|---|
| `media-intel-upload-session` | **2** — mint/complete driving the finalization state machine: begin (lease) → re-hash quarantine → place with `upsert:false` → mark placed → commit with catalog proof |
| `media-intel-upload-reconcile` | **2** — `health` / `run` / `grant`; finishes or fails stranded grants and sweeps quarantine bytes whose grant is already safe. Requires `MIL_RECONCILE_KEY`; **no schedule is configured** |
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
| Upload client (`uploadManager.js`) | **1** | Rewritten onto `media-intel-upload-session`. The browser no longer writes batches, manifests, grants or asset rows, and no longer constructs storage paths — every path is minted by the server |
| Upload resumability | **4 — deferred** | **Uploads are not resumable in this release.** The previous IndexedDB/TUS resume path was removed with the client rewrite: it resumed against client-chosen paths that the server no longer trusts. An interrupted transfer must be re-selected and re-sent |
| Honest per-file upload states | **1** | `uploaded` / `duplicate` / `pending_reconcile` / `in_progress` / `expired` / `revoked` / `failed` / `skipped`. Only an explicit **200** becomes a success state; a `202 pending_reconcile` is shown as unfinished, never as saved |
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
- **Durable finalization lifecycle** (service_role only, nine RPCs): the edge re-hashes the quarantine bytes on **every** attempt, places with `upsert:false`, and the database proves storage-catalog visibility inside the commit transaction (**1** source + unit + local SQL behavior tests; **2** e2e).
- **Time-based leases** on grant finalization, so a dead worker releases the grant instead of blocking it forever, and two workers cannot finalize one grant (**1** local behavior test).
- **Storage/DB divergence is recorded, not swallowed** — `mil_integrity_alerts` (owner/admin SELECT only) captures bytes-without-a-row, row-without-bytes, checksum drift and catalog mismatch (**1**).
- **Lifecycle tables are not client-writable at the grant level**, not merely policy-filtered (**1** local privilege matrix test).
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
| `supabase/tests/mil/*.sql` | **1** — five files, all PASS after local `npx supabase db reset` (schema contract, RLS matrix, lifecycle structure, lifecycle behavior, privilege matrix) |
| Local `supabase db reset` | **1** — applied all five MIL migrations on disposable local stack (2026-07-25). Requires conditional skip in `20260721120000_ml_p1_rs101_deny_estimates_insert.sql` when `public.estimates` is absent. **Not applied to staging/production.** |

### What the tests do **not** prove

- `03_upload_lifecycle_behavior.sql` simulates storage by inserting into
  `storage.objects`. It proves the SQL side of placement and commit; it does not
  exercise the Storage API, so the edge's `upload`/`download`/`remove` calls are
  unproven outside a deployed environment.
- No test covers two concurrent HTTP finalizes of the same grant end-to-end. The
  lease contention path is proven at the SQL level only.
- Nothing here proves hosted behavior. Every edge-function claim is **2**.

## Explicit non-goals (**4**)

Social connections, scheduling, automatic publishing, facial recognition, phone deletion, destructive de-dupe, production deploy, vent-guys.com changes, new domains/subdomains, multi-tenant MIL product architecture, artificial organization/account/company/workspace ownership entities for MIL.

## Residual risks after the finalization lifecycle change (honest)

| Risk | Standing |
|---|---|
| **Hosted behavior is unproven** | The migration has never been applied outside a disposable local stack and neither edge function has been deployed. Everything below is source-level reasoning until staging says otherwise |
| **No reconcile schedule** | Nothing runs `media-intel-upload-reconcile` on a timer. Stranded grants are reconciled only when a failing finalize invokes it inline, or when an operator calls it. Until a schedule exists, `pending_reconcile` files can stay pending indefinitely — visibly, in the manifest and in `mil_integrity_alerts` |
| **250 MB per-file ceiling** | The edge must hold the whole object in memory to hash it. Longer phone videos will be rejected rather than silently truncated. Raising `MIL_MAX_UPLOAD_BYTES` without confirming edge memory headroom will turn rejections into crashes |
| **No resumable uploads** | Removed with the client rewrite (see the client table). A dropped connection means re-selecting the file. Desktop owner/admin uploads use the same session path — there is no TUS fallback for them |
| **Reel lifecycle** | Untouched by this change and still unproven. Out of scope |
| **`queueAiAnalysis` is broken** | The client-side analyze trigger does not reliably reach `media-intel-analyze`. Jobs stay `queued`. Not repaired here — repairing it was explicitly out of scope, and pretending analysis runs would be worse than leaving it visibly queued |
| **Quarantine retention** | Bytes for `failed` and `abandoned` grants are deliberately **not** deleted, so a customer's only copy is never destroyed by an automated sweep. Those objects accumulate and need an operator decision, not a cron job |
| **Backfill of pre-existing grants** | The migration classifies existing rows from `completed_at` and asset ownership. Any historical row that was already inconsistent stays inconsistent — it is labelled, not repaired |

## Remaining for Definition of Done (requires owner authorization)

1. Apply migrations + deploy edge functions to authorized staging Supabase
2. Set `MIL_RECONCILE_KEY` in staging edge secrets **before** deploying either upload function
3. Run `supabase/tests/mil/*.sql` after reset; capture evidence
3. End-to-end acceptance scenarios (upload → review → creator → unpublish)
4. Accessibility + responsive screenshot suite
5. Large synthetic library performance harness
6. Owner authorization before CRM staging deploy / merge

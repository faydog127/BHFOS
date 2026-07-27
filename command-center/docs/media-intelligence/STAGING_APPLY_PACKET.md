# Media Intelligence — Staging Apply Packet (prep only)

**Status:** DOCUMENT ONLY — not an authorization to apply or deploy.  
**Packet baseline (historical):** authored against MIL packet baseline `c1767e4427e24d0a9c45638bf8fdd7607d0ab8b9`; subsequent local accepted cycle is recorded in `IMPLEMENTATION_STATUS.md`.  
**Execution tip:** do **not** treat any fixed SHA in this packet as the live apply tip. Capture `git rev-parse HEAD` (and confirm clean intended tree) **immediately before** staging apply/deploy.  
**Hard stop:** Founder must explicitly authorize remote migration apply, edge deploy, CRM staging deploy, merge, and any reconcile scheduler.

Related: [`ENV_CONTRACT.md`](./ENV_CONTRACT.md), [`RECONCILE_OPERATOR.md`](./RECONCILE_OPERATOR.md), [`IMPLEMENTATION_STATUS.md`](./IMPLEMENTATION_STATUS.md), [`BACKUP_RESTORE_EXPORT.md`](./BACKUP_RESTORE_EXPORT.md).

## Target

Authorized **staging** Supabase project only (never production from this packet). Inspection buckets/tables stay untouched.

## Ordered migrations (apply exactly once, in filename order)

| Version | File |
|---|---|
| `20260725120000` | `supabase/migrations/20260725120000_media_intelligence_library.sql` |
| `20260725130000` | `supabase/migrations/20260725130000_media_intel_access_sessions.sql` |
| `20260725140000` | `supabase/migrations/20260725140000_media_intel_pre_staging_hardening.sql` |
| `20260725150000` | `supabase/migrations/20260725150000_media_intel_analyze_honesty.sql` |
| `20260726090000` | `supabase/migrations/20260726090000_media_intel_upload_finalization_lifecycle.sql` |
| `20260727120000` | `supabase/migrations/20260727120000_media_intel_website_public_bucket.sql` |
| `20260727130000` | `supabase/migrations/20260727130000_media_intel_client_table_grants.sql` |

Notes:

- `20260726090000` drops `mil_finalize_upload_grant` / `mil_cleanup_expired_upload_grants` and revokes client writes on lifecycle tables.
- `20260727130000` is required so capability-matrix RLS is reachable (`GRANT` + RLS). Without it, PostgREST can fail with permission denied even when policies look correct.
- Local disposable stacks may need the existing conditional skip in `20260721120000_ml_p1_rs101_deny_estimates_insert.sql` when `public.estimates` is absent — staging TVG schema should already have estimates.

## Edge functions to deploy (after secrets)

Deploy all under `supabase/functions/`:

| Function | Notes |
|---|---|
| `media-intel-upload-session` | Finalization state machine; may invoke reconcile inline |
| `media-intel-upload-reconcile` | Requires `MIL_RECONCILE_KEY`; `verify_jwt = true` |
| `media-intel-sign` | Replaces client `createSignedUrl` |
| `media-intel-analyze` | Invoke-on-demand only; optional `OPENAI_API_KEY` |
| `media-intel-promote-website` | Promote still **503** `not_implemented`; unpublish works |
| `media-intel-creator-admin` | Invite/assign/revoke |
| `media-intel-reel-upload` | Creator reel PUT via signed URL |

Shared: `supabase/functions/_shared/milCors.ts`, `milRoles.ts`.

**Order constraint:** set `MIL_RECONCILE_KEY` **before** deploying upload-session / upload-reconcile so indeterminate finalize can hand off and operator runs are not 503 `not_configured`.

## Secrets checklist (staging edge)

| Secret | Required | Notes |
|---|---|---|
| `MIL_RECONCILE_KEY` | **Yes** before upload functions | ≥32 bytes entropy; never `VITE_*` / browser |
| `OPENAI_API_KEY` | Optional | Without it, analyze skips honestly (`skipped_no_key`) |
| `MIL_OPENAI_MODEL` | Optional | Default `gpt-4o-mini` |
| `MIL_MAX_UPLOAD_BYTES` | Optional | Default 250 MB |

Do **not** enable a reconcile cron/scheduler without separate Founder auth. Manual runbook: [`RECONCILE_OPERATOR.md`](./RECONCILE_OPERATOR.md).

## Pre-apply verification (local — already used)

```bash
cd command-center
npm run test:media-intel-helpers
# Expected: all pass (127+ at last recovery sync)

# Against disposable local DB after migrations applied:
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/mil/00_schema_contract.sql
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/mil/01_rls_matrix.sql
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/mil/02_upload_finalization_lifecycle.sql
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/mil/03_upload_lifecycle_behavior.sql
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/mil/04_upload_privilege_matrix.sql
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/mil/05_jwt_rls_behavior.sql
```

## Post-apply evidence plan (staging — after Founder auth)

Capture and attach to the release baton / evidence manifest:

1. Migration versions present in `supabase_migrations.schema_migrations` for all seven rows above.
2. SQL suite `00`–`05` PASS against staging (or a staging-clone disposable DB with same ACLs).
3. Edge deploy list + project ref + deploy timestamps.
4. `media-intel-upload-reconcile` `action=health` with `configured: true`, `scheduler: "none — …"`.
5. Smoke: mint upload session → PUT quarantine → complete → asset visible **or** honest `pending_reconcile`.
6. Smoke: review verify / B&A confirm / collections membership / unpublish (promote still 503).
7. Smoke: creator reel upload + reel review approve (manual post only — no publish).
8. Confirm no reconcile schedule exists unless separately authorized.

## Explicit non-actions in this packet

- No remote `db push` / migration apply from Build Controller chats without Founder go.
- No Hostinger / CRM staging frontend deploy from this packet alone.
- No merge to `main`.
- No production apply.
- No vent-guys.com or inspection storage changes.
- No social publishing / scheduler activation.

## Founder gate (copy/paste when authorizing)

> Authorize staging MIL apply for project `<ref>`: apply the seven migrations listed in `STAGING_APPLY_PACKET.md`, set `MIL_RECONCILE_KEY`, deploy the seven `media-intel-*` edge functions, run SQL `00`–`05` + smoke checklist, and record evidence. Do **not** enable reconcile cron. Do **not** promote to production.

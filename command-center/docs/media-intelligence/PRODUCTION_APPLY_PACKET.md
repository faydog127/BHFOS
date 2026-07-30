# Media Intelligence — Production Apply Packet

**Status:** Founder-authorized production release plan for MIL (single-company TVG).  
**Product home:** authenticated CRM on `https://app.bhfos.com` (see `ACCESS_ARCHITECTURE.md` — no permanent separate MIL domain).  
**Staging remains:** `https://mil.bhfos.com` → Supabase `sdzhdupekcnekesbtxsl` (do not overwrite staging while promoting).  
**Production Supabase:** `wwyxohjnyqnegzbxtuxs` only.  
**Never touch from this packet:** `glkrykpksbsqmmilmjhs`, `rngfowbxiqeyslnncblw`, inspection buckets/tables, vent-guys.com.

Related: [`STAGING_APPLY_PACKET.md`](./STAGING_APPLY_PACKET.md), [`ENV_CONTRACT.md`](./ENV_CONTRACT.md), [`RECONCILE_OPERATOR.md`](./RECONCILE_OPERATOR.md), [`IMPLEMENTATION_STATUS.md`](./IMPLEMENTATION_STATUS.md).

## Hard stops

- Capture `git rev-parse HEAD` immediately before each mutating step; do not apply an stale tip.
- Prefer **merge to `main` (or merge-ready tip + CI green)** before production DB/edge/frontend mutation.
- Do **not** treat `VITE_SUPABASE_ANON_KEY`, any browser JWT, or `SUPABASE_SERVICE_ROLE_KEY` as `SUPABASE_ACCESS_TOKEN`.
- Do **not** enable reconcile cron, website **promote**, or real-customer contributor invites in this packet.
- Website `prepare_public_safe` / `promote` stay **503** until a separate proven public-safe pipeline release.

## Ordered release sequence

| Step | Action | Gate |
|---|---|---|
| 0 | Branch tip clean of secrets; local `npm run test:media-intel-helpers` PASS | Local |
| 1 | Open PR `feat/media-intelligence-library` → `main`; CI green | GitHub |
| 2 | Founder/authorized merge to `main` | Human merge |
| 3 | Apply **all** MIL migrations below to `wwyxohjnyqnegzbxtuxs` | `SUPABASE_ACCESS_TOKEN` + project link |
| 4 | Set production edge secrets (names only below) | Management / CLI secrets |
| 5 | Deploy all seven `media-intel-*` edge functions to production | Same project |
| 6 | Confirm Auth redirect allow-list includes `https://app.bhfos.com` (+ localhost if needed) | Auth settings |
| 7 | Production CRM build (`VITE_*` → `wwyxohjnyqnegzbxtuxs`) + Hostinger deploy target `production` (`app.bhfos.com`) | `HOSTINGER_API_TOKEN` |
| 8 | Post-prod smoke (synthetic only) + record evidence in `IMPLEMENTATION_STATUS.md` | Owner / UAT |

## Migrations (apply exactly once, filename order)

| Version | File |
|---|---|
| `20260725120000` | `supabase/migrations/20260725120000_media_intelligence_library.sql` |
| `20260725130000` | `supabase/migrations/20260725130000_media_intel_access_sessions.sql` |
| `20260725140000` | `supabase/migrations/20260725140000_media_intel_pre_staging_hardening.sql` |
| `20260725150000` | `supabase/migrations/20260725150000_media_intel_analyze_honesty.sql` |
| `20260726090000` | `supabase/migrations/20260726090000_media_intel_upload_finalization_lifecycle.sql` |
| `20260727120000` | `supabase/migrations/20260727120000_media_intel_website_public_bucket.sql` |
| `20260727130000` | `supabase/migrations/20260727130000_media_intel_client_table_grants.sql` |
| `20260727140000` | `supabase/migrations/20260727140000_media_intel_finalize_rpc_execute_acl.sql` |
| `20260728010000` | `supabase/migrations/20260728010000_media_intel_client_upload_id.sql` |
| `20260728120000` | `supabase/migrations/20260728120000_media_intel_quality_cleanup_lifecycle.sql` |
| `20260728140000` | `supabase/migrations/20260728140000_media_intel_contributor_workspace.sql` |

Preflight (read-only): list `supabase_migrations.schema_migrations` on production and skip any version already present. Never re-apply a version that is already recorded.

## Edge functions (after secrets)

| Function | Notes |
|---|---|
| `media-intel-upload-session` | Finalization state machine |
| `media-intel-upload-reconcile` | Requires `MIL_RECONCILE_KEY`; `verify_jwt = true` |
| `media-intel-sign` | Replaces client `createSignedUrl` |
| `media-intel-analyze` | Optional `OPENAI_API_KEY`; honest skip without it |
| `media-intel-promote-website` | Promote remains **503**; unpublish allowed |
| `media-intel-creator-admin` | Invite/assign/revoke |
| `media-intel-reel-upload` | Creator reel PUT |

Shared: `supabase/functions/_shared/milCors.ts`, `milRoles.ts`.

**Order constraint:** set `MIL_RECONCILE_KEY` before deploying upload-session / upload-reconcile.

## Production edge secrets (names only)

| Secret | Required | Notes |
|---|---|---|
| `MIL_RECONCILE_KEY` | **Yes** | ≥32 bytes entropy; **new** value for production (do not copy staging) |
| `OPENAI_API_KEY` | Recommended for analysis | Production-scoped; never `VITE_*` |
| `MIL_OPENAI_MODEL` | Optional | Default `gpt-4o-mini` |
| `MIL_MAX_UPLOAD_BYTES` | Optional | Default 250 MB |
| `MIL_ALLOWED_ORIGINS` | Recommended | Must include `https://app.bhfos.com` |

## Frontend / Hostinger

| Item | Value |
|---|---|
| Deploy target id | `production` (`tools/deploy-lib.mjs`) |
| Domain | `app.bhfos.com` |
| Remote root | `public_html` |
| Build | `npm run build:prod` with production `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY` for `wwyxohjnyqnegzbxtuxs` |
| Artifact scan | Bundle must contain **only** `wwyxohjnyqnegzbxtuxs` (no staging ref); no `SUPABASE_ACCESS_TOKEN` / `sbp_*` / service-role values |
| Neighbors | Confirm `bhfos.com` / `mil.bhfos.com` still healthy after CRM deploy |
| Rollback | Keep prior production zip archive before mutate deploy |

`mil.bhfos.com` stays the **staging** Hostinger target (`mil-staging`). Do not redeploy staging as “production.”

## Post-prod smoke (synthetic only)

1. Owner/admin login on `app.bhfos.com` → `/media/dashboard` loads.
2. Upload one synthetic image → appears in Review / library (or honest pending path).
3. On-demand analyze config_status honest if key missing; analysis OK if key set.
4. Keep / Archive / Trash on synthetic asset (no permanent delete of real media).
5. Distinct contributor path (staging identities must **not** be reused on prod): invite/assign synthetic contributor → preview/download working copy → submit → owner review.
6. Confirm promote still 503; unpublish path reachable for owner/admin.
7. Confirm no reconcile schedule exists unless separately authorized.
8. Record SHAs, migration versions, edge deploy times, and smoke results in `IMPLEMENTATION_STATUS.md`.

## Explicit non-actions

- No reconcile cron/scheduler.
- No website promote enablement.
- No vent-guys.com or inspection storage changes.
- No production data rewrite / drop of historical financial tables.
- No use of staging project as production backend for `app.bhfos.com`.

## Founder gate (copy/paste)

> Authorize production MIL release for Supabase `wwyxohjnyqnegzbxtuxs` and Hostinger `app.bhfos.com`: merge `feat/media-intelligence-library` after CI green; apply the eleven migrations in `PRODUCTION_APPLY_PACKET.md` (skip any already present); set production `MIL_RECONCILE_KEY` (+ optional `OPENAI_API_KEY` / `MIL_ALLOWED_ORIGINS`); deploy the seven `media-intel-*` edge functions; production-build and deploy CRM frontend; run synthetic smoke only. Do **not** enable reconcile cron. Do **not** enable website promote. Leave `mil.bhfos.com` / `sdzhdupekcnekesbtxsl` as staging.

# Media Intelligence Library — Backup, Restore, Export, Rollback

**Status honesty:** This document describes **intended** procedures. Backup/restore has **not** been proven recoverable in this worktree — no full restore drill, no cross-project replication test, no checksum reconciliation after restore. Treat everything below as **2 — implemented but requiring staging proof** until an owner-authorized drill passes with evidence.

## Scope

Covers private MIL data in Supabase:

- Tables prefixed `mil_*`
- Buckets `media-intel-originals`, `media-intel-derivatives`
- Related audit rows in `mil_audit_events`
- Optional promotions recorded in `mil_website_promotions` (public copies live in `website-public-media` / `website_media`)

Does **not** replace inspection backup procedures.

## What is locally proven vs not

| Item | Status |
|---|---|
| Export SQL / CLI examples below | **1** — documented commands |
| Logical DB dump of `mil_*` | **2** — not executed end-to-end here |
| Storage prefix sync | **2** — not executed end-to-end here |
| Restore into staging + RLS spot-check | **2** — not executed |
| Derivative regeneration worker | **4 — deferred** (no always-on worker; analyze is invoke-on-demand) |
| Rollback SQL | **2** — manual destructive script; not dry-run on staging |

## Database backup

```bash
# Logical backup of MIL tables (adjust connection)
pg_dump "$DATABASE_URL" \
  --format=custom \
  --table='public.mil_*' \
  --file="mil-db-$(date +%Y%m%d).dump"
```

Or use Supabase Dashboard → Database → Backups (project-level PITR if enabled).

**Gap:** Restoring only `mil_*` tables without matching storage objects yields a broken library (orphan DB rows or orphan objects). A recoverable backup must include **both** DB and storage prefixes below.

## Original media backup

```bash
# Using Supabase CLI / storage API with service role (never commit the key)
supabase storage cp -r ss://media-intel-originals ./backups/media-intel-originals
supabase storage cp -r ss://media-intel-derivatives ./backups/media-intel-derivatives
```

Prefer object-storage replication or scheduled `rclone` sync against the project storage endpoint.

**Gap:** Quarantine paths (`mil/quarantine/…`) may exist mid-upload; manifests must be exported to reconcile partial transfers.

## Metadata export

```sql
copy (
  select a.*, v.*
  from mil_assets a
  left join mil_verified_metadata v on v.asset_id = a.id
) to stdout with csv header;
```

Also export:

- `mil_upload_batches` + `mil_manifest_entries` (transfer reconciliation)
- `mil_upload_sessions` + `mil_upload_grants` (phone session audit trail)
- `mil_asset_relationships` (before/after)
- `mil_collections` + `mil_collection_items`
- `mil_reel_projects` + `mil_reel_versions`
- `mil_audit_events`

## Derivative regeneration

Derivatives are disposable **if** originals + checksums remain intact. **No automated regeneration worker is deployed.**

If derivatives are lost:

1. Keep `mil_assets.original_*` / checksum fields intact.
2. Re-queue `mil_processing_jobs` with `job_type = 'derivative'` (manual or future worker).
3. Re-run preview generation (today: partial client grid thumbs only; trusted derivatives require a future server worker).
4. Do **not** overwrite originals.

`public_safe` / website promotion pipeline is **disabled (503)** — do not assume website-safe derivatives can be rebuilt yet.

## Restore procedure (unproven — staging drill required)

1. Restore DB dump for `mil_*` tables into a **staging** project first.
2. Restore storage prefixes `mil/originals/...`, `mil/derivatives/...`, `mil/reels/...`, `mil/quarantine/...`, `mil/uploads/...` into the private buckets.
3. Verify RLS helpers (`mil_current_role`, `mil_can_browse_library`, `mil_is_reviewer`, creator capability functions) and storage policies — run `supabase/tests/mil/*.sql` after `supabase db reset`.
4. Spot-check signed URL access for staff vs creator via `media-intel-sign` (edge deploy required).
5. Confirm website promotions still point at `website-public-media` paths (public copies may exist independently of MIL DB).
6. Reconcile checksums: sample assets — DB `checksum_sha256` must match re-hashed storage bytes.

**Failure modes not yet tested:** partial storage restore, grant/session expiry during restore, duplicate asset IDs across projects, unpublish after restore.

## Rollback of this feature migration

Migration files (all unapplied outside disposable local testing):

- `20260725120000_media_intelligence_library.sql`
- `20260725130000_media_intel_access_sessions.sql`
- `20260725140000_media_intel_pre_staging_hardening.sql`
- `20260725150000_media_intel_analyze_honesty.sql`

Rollback (staging only; destructive — confirm backups):

```sql
begin;
drop table if exists public.mil_reel_upload_grants cascade;
drop table if exists public.mil_upload_grants cascade;
drop table if exists public.mil_upload_sessions cascade;
drop table if exists public.mil_website_promotions cascade;
drop table if exists public.mil_reel_source_media cascade;
drop table if exists public.mil_reel_versions cascade;
drop table if exists public.mil_reel_projects cascade;
drop table if exists public.mil_creator_assignments cascade;
drop table if exists public.mil_asset_relationships cascade;
drop table if exists public.mil_collection_items cascade;
drop table if exists public.mil_collections cascade;
drop table if exists public.mil_privacy_findings cascade;
drop table if exists public.mil_quality_scores cascade;
drop table if exists public.mil_verified_metadata cascade;
drop table if exists public.mil_ai_analyses cascade;
drop table if exists public.mil_asset_tags cascade;
drop table if exists public.mil_permitted_uses cascade;
drop table if exists public.mil_derivatives cascade;
drop table if exists public.mil_manifest_entries cascade;
drop table if exists public.mil_processing_jobs cascade;
drop table if exists public.mil_audit_events cascade;
drop table if exists public.mil_assets cascade;
drop table if exists public.mil_upload_batches cascade;
drop table if exists public.mil_tag_vocabulary cascade;
-- Optionally remove storage policies/buckets after confirming no needed objects remain.
commit;
```

Do **not** drop `website-public-media` or `website_media` as part of MIL rollback.

## Portability

Originals + checksums + manifests + verified metadata CSV/JSON are sufficient to rebuild the library outside this app **in theory**. Prefer keeping phone/source backups until transfer manifests reconcile. **Recoverability is not PASS until a staged restore drill succeeds.**

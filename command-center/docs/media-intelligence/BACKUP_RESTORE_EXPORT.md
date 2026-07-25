# Media Intelligence Library — Backup, Restore, Export, Rollback

## Scope

Covers private MIL data in Supabase:

- Tables prefixed `mil_*`
- Buckets `media-intel-originals`, `media-intel-derivatives`
- Related audit rows in `mil_audit_events`
- Optional promotions recorded in `mil_website_promotions` (public copies live in `website-public-media` / `website_media`)

Does **not** replace inspection backup procedures.

## Database backup

```bash
# Logical backup of MIL tables (adjust connection)
pg_dump "$DATABASE_URL" \
  --format=custom \
  --table='public.mil_*' \
  --file="mil-db-$(date +%Y%m%d).dump"
```

Or use Supabase Dashboard → Database → Backups (project-level PITR if enabled).

## Original media backup

```bash
# Using Supabase CLI / storage API with service role (never commit the key)
supabase storage cp -r ss://media-intel-originals ./backups/media-intel-originals
supabase storage cp -r ss://media-intel-derivatives ./backups/media-intel-derivatives
```

Prefer object-storage replication or scheduled `rclone` sync against the project storage endpoint.

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
- `mil_asset_relationships` (before/after)
- `mil_collections` + `mil_collection_items`
- `mil_reel_projects` + `mil_reel_versions`
- `mil_audit_events`

## Derivative regeneration

Derivatives are disposable. If lost:

1. Keep `mil_assets.original_*` intact.
2. Re-queue `mil_processing_jobs` with `job_type = 'derivative'`.
3. Re-run preview generation workers/edge jobs.
4. Do **not** overwrite originals.

## Restore procedure

1. Restore DB dump for `mil_*` tables into a staging project first.
2. Restore storage prefixes `mil/originals/...`, `mil/derivatives/...`, `mil/reels/...`, `mil/uploads/...` into the private buckets.
3. Verify RLS helpers (`mil_current_role`, staff/creator capability functions) and storage policies.
4. Spot-check signed URL access for staff vs creator.
5. Confirm website promotions still point at `website-public-media` paths (public copies may already exist independently).

## Rollback of this feature migration

Migration file: `supabase/migrations/20260725120000_media_intelligence_library.sql`

Rollback (staging only; destructive — confirm backups):

```sql
begin;
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

Originals + checksums + manifests + verified metadata CSV/JSON are sufficient to rebuild the library outside this app. Prefer keeping phone/source backups until transfer manifests reconcile.

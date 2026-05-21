begin;

-- Phase 1.5: Photo upload state tracking.
-- Purpose:
-- - allow inspection submission while uploads are still resolving
-- - block completion until uploads resolve
-- - keep evidence records persisted even when media isn't yet uploaded

alter table public.inspection_photos
  add column if not exists upload_state text not null default 'complete',
  add column if not exists storage_uploaded_at timestamptz,
  add column if not exists storage_error text;

-- Backfill existing rows.
update public.inspection_photos
set upload_state = 'complete'
where upload_state is null
   or btrim(upload_state) = '';

-- Enforce vocabulary.
alter table public.inspection_photos
  drop constraint if exists inspection_photos_upload_state_vocabulary_chk;

alter table public.inspection_photos
  add constraint inspection_photos_upload_state_vocabulary_chk
  check (lower(upload_state) in ('pending', 'complete', 'failed'));

create index if not exists inspection_photos_tenant_inspection_upload_state_idx
  on public.inspection_photos (tenant_id, inspection_id, upload_state);

commit;


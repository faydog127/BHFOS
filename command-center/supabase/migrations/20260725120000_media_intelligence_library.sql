-- Media Intelligence Library (MIL) — single-company schema for The Vent Guys.
-- No tenant_id, no multi-tenant product concepts.
-- AI suggests; humans verify. Private originals never public by default.

begin;

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Role helpers (user identity + app_user_roles.role only)
-- ---------------------------------------------------------------------------
create or replace function public.mil_normalize_role(p_role text)
returns text
language sql
immutable
as $$
  select case lower(btrim(coalesce(p_role, '')))
    when 'admin' then 'admin'
    when 'super_admin' then 'admin'
    when 'owner' then 'admin'
    when 'manager' then 'manager'
    when 'office' then 'office'
    when 'csr' then 'office'
    when 'media_reviewer' then 'media_reviewer'
    when 'reviewer' then 'media_reviewer'
    when 'reel_creator' then 'reel_creator'
    when 'creator' then 'reel_creator'
    when 'contributor' then 'reel_creator'
    when 'phone_uploader' then 'phone_uploader'
    when 'uploader' then 'phone_uploader'
    when 'technician' then 'technician'
    when 'tech' then 'technician'
    else 'unauthenticated'
  end;
$$;

create or replace function public.mil_current_role()
returns text
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_role text;
begin
  if auth.uid() is null then
    return 'unauthenticated';
  end if;

  -- Deterministic MIL role when legacy app_user_roles has multiple rows per user:
  -- prefer MIL-relevant roles by priority, then newest created_at.
  -- Do not require or filter by tenant_id (legacy column may exist on app_user_roles).
  select r.role into v_role
  from public.app_user_roles r
  where r.user_id = auth.uid()
  order by
    case public.mil_normalize_role(r.role)
      when 'admin' then 1
      when 'manager' then 2
      when 'media_reviewer' then 3
      when 'office' then 4
      when 'reel_creator' then 5
      when 'phone_uploader' then 6
      when 'technician' then 7
      else 99
    end,
    r.created_at desc nulls last
  limit 1;

  if v_role is null or btrim(v_role) = '' then
    return 'unauthenticated';
  end if;

  return public.mil_normalize_role(v_role);
end;
$$;

-- Library staff may browse private originals / library surfaces.
-- Technicians are NOT library staff by default (field CRM/tech roles stay separate).
create or replace function public.mil_is_staff()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.mil_current_role() in ('admin', 'manager', 'office', 'media_reviewer');
$$;

create or replace function public.mil_is_owner_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.mil_current_role() in ('admin', 'manager');
$$;

-- Reviewer roles only. Office may browse/upload but must not write review surfaces
-- via this helper (capability matrix is refined in the hardening migration).
create or replace function public.mil_is_reviewer()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.mil_current_role() in ('admin', 'manager', 'media_reviewer');
$$;

create or replace function public.mil_is_creator()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.mil_current_role() = 'reel_creator';
$$;

create or replace function public.mil_is_phone_uploader()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.mil_current_role() = 'phone_uploader';
$$;

-- ---------------------------------------------------------------------------
-- Private storage buckets
-- Paths: mil/originals|derivatives|reels|uploads/...
-- ---------------------------------------------------------------------------
do $$
begin
  if to_regclass('storage.buckets') is not null then
    -- Defense-in-depth bucket limits (edge/RPC still authoritative).
    -- 250 MiB matches practical client hashing / phone-transfer honesty; not 2 GiB.
    insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    values (
      'media-intel-originals',
      'media-intel-originals',
      false,
      262144000,
      array[
        'image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/heic', 'image/heif', 'image/gif',
        'video/mp4', 'video/quicktime', 'video/webm', 'video/x-m4v'
      ]
    )
    on conflict (id) do update set
      public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

    insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    values (
      'media-intel-derivatives',
      'media-intel-derivatives',
      false,
      262144000,
      array[
        'image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/heic', 'image/heif', 'image/gif',
        'video/mp4', 'video/quicktime', 'video/webm', 'video/x-m4v'
      ]
    )
    on conflict (id) do update set
      public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;
  end if;
end $$;

do $$
begin
  if to_regclass('storage.objects') is null then
    return;
  end if;

  drop policy if exists "MIL originals readable by staff tenant" on storage.objects;
  drop policy if exists "MIL originals insertable by staff tenant" on storage.objects;
  drop policy if exists "MIL originals no update" on storage.objects;
  drop policy if exists "MIL originals no delete authenticated" on storage.objects;
  drop policy if exists "MIL originals service role" on storage.objects;
  drop policy if exists "MIL derivatives readable by tenant capability" on storage.objects;
  drop policy if exists "MIL derivatives insertable by staff tenant" on storage.objects;
  drop policy if exists "MIL derivatives service role" on storage.objects;
  drop policy if exists "MIL derivatives creator reel upload" on storage.objects;
  drop policy if exists "MIL derivatives creator reel read" on storage.objects;
  drop policy if exists "MIL originals readable by staff" on storage.objects;
  drop policy if exists "MIL originals insertable by staff" on storage.objects;
  drop policy if exists "MIL derivatives readable by staff" on storage.objects;
  drop policy if exists "MIL derivatives insertable by staff" on storage.objects;

  create policy "MIL originals readable by staff"
    on storage.objects for select to authenticated
    using (
      bucket_id = 'media-intel-originals'
      and name like 'mil/%'
      and public.mil_is_staff()
    );

  -- Authenticated clients may only write quarantine paths. Final originals are
  -- placed by service-role after grant finalization (no live signed-upload on final path).
  create policy "MIL originals quarantine insert by staff"
    on storage.objects for insert to authenticated
    with check (
      bucket_id = 'media-intel-originals'
      and name like 'mil/quarantine/%'
      and public.mil_is_staff()
    );

  create policy "MIL originals service role"
    on storage.objects for all to service_role
    using (bucket_id = 'media-intel-originals')
    with check (bucket_id = 'media-intel-originals');

  create policy "MIL derivatives readable by staff"
    on storage.objects for select to authenticated
    using (
      bucket_id = 'media-intel-derivatives'
      and name like 'mil/%'
      and public.mil_is_staff()
    );

  create policy "MIL derivatives quarantine insert by staff"
    on storage.objects for insert to authenticated
    with check (
      bucket_id = 'media-intel-derivatives'
      and name like 'mil/quarantine/%'
      and public.mil_is_staff()
    );

  -- Creators must NOT insert/read storage directly under mil/reels/%.
  -- Reel uploads use server-minted grants + service-role completion.
  drop policy if exists "MIL derivatives creator reel upload" on storage.objects;
  drop policy if exists "MIL derivatives creator reel read" on storage.objects;

  create policy "MIL derivatives service role"
    on storage.objects for all to service_role
    using (bucket_id = 'media-intel-derivatives')
    with check (bucket_id = 'media-intel-derivatives');
end $$;

-- ---------------------------------------------------------------------------
-- Tables (no tenant_id)
-- ---------------------------------------------------------------------------
create table if not exists public.mil_tag_vocabulary (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  label text not null,
  category text not null default 'general',
  synonyms text[] not null default '{}',
  is_system boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.mil_upload_batches (
  id uuid primary key default gen_random_uuid(),
  source_label text,
  source_phone text,
  source_person text,
  uploader_user_id uuid references auth.users(id) on delete set null,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  status text not null default 'open'
    check (status in ('open', 'uploading', 'interrupted', 'completed', 'cancelled')),
  success_count integer not null default 0,
  failed_count integer not null default 0,
  skipped_count integer not null default 0,
  duplicate_count integer not null default 0,
  notes text,
  client_session_key text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists mil_upload_batches_started_idx
  on public.mil_upload_batches (started_at desc);

create table if not exists public.mil_assets (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid references public.mil_upload_batches(id) on delete set null,
  media_kind text not null check (media_kind in ('photo', 'video', 'other')),
  mime_type text not null,
  byte_size bigint not null check (byte_size >= 0),
  checksum_sha256 text not null,
  original_filename text not null,
  capture_taken_at timestamptz,
  orientation text check (orientation is null or orientation in ('portrait', 'landscape', 'square', 'unknown')),
  width integer,
  height integer,
  duration_ms integer,
  original_bucket text not null default 'media-intel-originals',
  original_path text not null,
  processing_status text not null default 'uploaded'
    check (processing_status in ('uploaded', 'queued', 'analyzing', 'analyzed', 'processing_failed')),
  human_review_status text not null default 'pending'
    check (human_review_status in ('pending', 'in_review', 'verified', 'rejected', 'archived')),
  privacy_status text not null default 'needs_review'
    check (privacy_status in ('clear', 'needs_review', 'needs_redaction', 'restricted')),
  publication_readiness text not null default 'not_approved'
    check (publication_readiness in ('not_approved', 'approved_for_use', 'retired')),
  rights_status text not null default 'ownership_unknown'
    check (rights_status in (
      'tvg_owned', 'employee_supplied', 'contractor_supplied', 'customer_supplied',
      'ownership_unknown', 'permission_confirmed', 'permission_unknown', 'public_use_prohibited'
    )),
  customer_permission_status text not null default 'unknown'
    check (customer_permission_status in ('unknown', 'confirmed', 'denied', 'not_required')),
  is_preferred_of_duplicate_group boolean not null default false,
  duplicate_of_asset_id uuid references public.mil_assets(id) on delete set null,
  exclude_from_ai boolean not null default false,
  archived_at timestamptz,
  created_by_user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (original_bucket, original_path)
);

create index if not exists mil_assets_created_idx on public.mil_assets (created_at desc);
create index if not exists mil_assets_checksum_idx on public.mil_assets (checksum_sha256);
create index if not exists mil_assets_review_idx on public.mil_assets (human_review_status);
create index if not exists mil_assets_processing_idx on public.mil_assets (processing_status);
create index if not exists mil_assets_privacy_idx on public.mil_assets (privacy_status);
create index if not exists mil_assets_capture_idx on public.mil_assets (capture_taken_at);

create table if not exists public.mil_manifest_entries (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references public.mil_upload_batches(id) on delete cascade,
  asset_id uuid references public.mil_assets(id) on delete set null,
  original_filename text not null,
  capture_taken_at timestamptz,
  mime_type text,
  byte_size bigint,
  checksum_sha256 text,
  upload_status text not null default 'pending'
    check (upload_status in (
      'pending', 'uploading', 'uploaded', 'failed', 'skipped', 'duplicate', 'cancelled'
    )),
  duplicate_status text not null default 'none'
    check (duplicate_status in ('none', 'exact', 'near_suggested')),
  processing_status text not null default 'pending',
  error_message text,
  retry_count integer not null default 0,
  tus_upload_url text,
  client_file_key text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists mil_manifest_batch_idx on public.mil_manifest_entries (batch_id);

create table if not exists public.mil_derivatives (
  id uuid primary key default gen_random_uuid(),
  asset_id uuid not null references public.mil_assets(id) on delete cascade,
  kind text not null check (kind in (
    'grid_thumb', 'detail_preview', 'website_optimized', 'creator_download',
    'redacted_public', 'video_thumb', 'video_preview', 'reel_version', 'heic_preview',
    'public_safe', 'ai_safe'
  )),
  bucket text not null default 'media-intel-derivatives',
  object_path text not null,
  mime_type text,
  byte_size bigint,
  width integer,
  height integer,
  strip_exif boolean not null default false,
  parent_derivative_id uuid references public.mil_derivatives(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (bucket, object_path)
);

create index if not exists mil_derivatives_asset_idx on public.mil_derivatives (asset_id, kind);

create table if not exists public.mil_permitted_uses (
  asset_id uuid not null references public.mil_assets(id) on delete cascade,
  use_key text not null check (use_key in (
    'internal', 'inspection_report', 'website', 'social_media',
    'reel_creation', 'commercial_proposal', 'training'
  )),
  approved boolean not null default false,
  approved_by uuid references auth.users(id) on delete set null,
  approved_at timestamptz,
  notes text,
  primary key (asset_id, use_key)
);

create table if not exists public.mil_asset_tags (
  id uuid primary key default gen_random_uuid(),
  asset_id uuid not null references public.mil_assets(id) on delete cascade,
  tag_id uuid references public.mil_tag_vocabulary(id) on delete set null,
  tag_slug text not null,
  source text not null check (source in ('ai_suggested', 'human_verified', 'human_added')),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists mil_asset_tags_asset_idx on public.mil_asset_tags (asset_id);

create table if not exists public.mil_ai_analyses (
  id uuid primary key default gen_random_uuid(),
  asset_id uuid not null references public.mil_assets(id) on delete cascade,
  provider text not null default 'openai',
  model text,
  prompt_version text not null default 'mil-v1',
  analyzed_at timestamptz not null default now(),
  overall_confidence numeric(4,3),
  suggested jsonb not null default '{}'::jsonb,
  explanation text,
  status text not null default 'succeeded'
    check (status in ('queued', 'running', 'succeeded', 'failed', 'skipped_no_key', 'skipped_duplicate')),
  error_message text,
  created_at timestamptz not null default now()
);

create index if not exists mil_ai_analyses_asset_idx
  on public.mil_ai_analyses (asset_id, analyzed_at desc);

create table if not exists public.mil_verified_metadata (
  asset_id uuid primary key references public.mil_assets(id) on delete cascade,
  service_category text,
  work_phase text check (work_phase is null or work_phase in (
    'before', 'during', 'after', 'inspection', 'completed_work', 'unknown'
  )),
  condition_notes text,
  location_component text,
  narrative text,
  public_caption text,
  alt_text text,
  unsuitable_uses text[] not null default '{}',
  verified_by uuid references auth.users(id) on delete set null,
  verified_at timestamptz,
  updated_at timestamptz not null default now()
);

create table if not exists public.mil_quality_scores (
  id uuid primary key default gen_random_uuid(),
  asset_id uuid not null references public.mil_assets(id) on delete cascade,
  purpose text not null check (purpose in (
    'homepage_hero', 'website_service_proof', 'google_business_profile',
    'social_photo', 'reel_short_video', 'inspection_report',
    'commercial_proposal', 'training', 'internal_docs'
  )),
  source text not null check (source in ('ai_suggested', 'human_verified')),
  score numeric(4,3),
  suitable boolean,
  explanation text,
  focus numeric(4,3),
  exposure numeric(4,3),
  resolution numeric(4,3),
  composition numeric(4,3),
  stability numeric(4,3),
  evidentiary_value numeric(4,3),
  marketing_value numeric(4,3),
  privacy_risk numeric(4,3),
  created_at timestamptz not null default now(),
  unique (asset_id, purpose, source)
);

create table if not exists public.mil_privacy_findings (
  id uuid primary key default gen_random_uuid(),
  asset_id uuid not null references public.mil_assets(id) on delete cascade,
  finding_key text not null,
  severity text not null default 'warning'
    check (severity in ('info', 'warning', 'block')),
  source text not null check (source in ('ai_suggested', 'human_verified')),
  details text,
  created_at timestamptz not null default now()
);

create table if not exists public.mil_collections (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  cover_asset_id uuid references public.mil_assets(id) on delete set null,
  owner_user_id uuid references auth.users(id) on delete set null,
  visibility text not null default 'internal'
    check (visibility in ('internal', 'creator_shared', 'archived')),
  content_brief text,
  due_date date,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.mil_collection_items (
  collection_id uuid not null references public.mil_collections(id) on delete cascade,
  asset_id uuid not null references public.mil_assets(id) on delete cascade,
  sort_order integer not null default 0,
  notes text,
  added_by uuid references auth.users(id) on delete set null,
  added_at timestamptz not null default now(),
  primary key (collection_id, asset_id)
);

create table if not exists public.mil_asset_relationships (
  id uuid primary key default gen_random_uuid(),
  left_asset_id uuid not null references public.mil_assets(id) on delete cascade,
  right_asset_id uuid not null references public.mil_assets(id) on delete cascade,
  relationship_type text not null check (relationship_type in (
    'possible_before_after', 'before_after', 'during', 'detail_of',
    'context_of', 'associated_video', 'near_duplicate', 'live_photo_pair'
  )),
  verification_status text not null default 'unverified'
    check (verification_status in ('unverified', 'confirmed', 'rejected')),
  proposed_by text not null default 'ai' check (proposed_by in ('ai', 'human')),
  verified_by uuid references auth.users(id) on delete set null,
  verified_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  check (left_asset_id <> right_asset_id)
);

create index if not exists mil_asset_rel_status_idx
  on public.mil_asset_relationships (verification_status);

create table if not exists public.mil_creator_assignments (
  id uuid primary key default gen_random_uuid(),
  asset_id uuid references public.mil_assets(id) on delete cascade,
  collection_id uuid references public.mil_collections(id) on delete cascade,
  creator_user_id uuid not null references auth.users(id) on delete cascade,
  assigned_by uuid references auth.users(id) on delete set null,
  status text not null default 'active'
    check (status in ('active', 'revoked', 'completed')),
  notes text,
  created_at timestamptz not null default now(),
  revoked_at timestamptz,
  check (asset_id is not null or collection_id is not null)
);

create index if not exists mil_creator_assign_user_idx
  on public.mil_creator_assignments (creator_user_id, status);

create table if not exists public.mil_reel_projects (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  creator_user_id uuid not null references auth.users(id) on delete cascade,
  collection_id uuid references public.mil_collections(id) on delete set null,
  status text not null default 'creator_draft'
    check (status in (
      'creator_draft', 'submitted_for_review', 'revision_requested',
      'approved_to_post', 'denied', 'superseded', 'archived'
    )),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.mil_reel_versions (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.mil_reel_projects(id) on delete cascade,
  version_number integer not null,
  status text not null default 'creator_draft'
    check (status in (
      'creator_draft', 'submitted_for_review', 'revision_requested',
      'approved_to_post', 'denied', 'superseded', 'archived'
    )),
  storage_bucket text not null default 'media-intel-derivatives',
  storage_path text not null,
  thumbnail_path text,
  mime_type text,
  byte_size bigint,
  creator_notes text,
  submitted_at timestamptz,
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  review_decision text check (review_decision is null or review_decision in (
    'approved', 'denied', 'revision_requested'
  )),
  review_notes text,
  created_at timestamptz not null default now(),
  unique (project_id, version_number)
);

create table if not exists public.mil_reel_source_media (
  reel_version_id uuid not null references public.mil_reel_versions(id) on delete cascade,
  asset_id uuid not null references public.mil_assets(id) on delete restrict,
  primary key (reel_version_id, asset_id)
);

create table if not exists public.mil_website_promotions (
  id uuid primary key default gen_random_uuid(),
  asset_id uuid not null references public.mil_assets(id) on delete restrict,
  derivative_id uuid not null references public.mil_derivatives(id) on delete restrict,
  website_media_id uuid,
  promoted_by uuid references auth.users(id) on delete set null,
  promoted_at timestamptz not null default now(),
  notes text
);

create table if not exists public.mil_processing_jobs (
  id uuid primary key default gen_random_uuid(),
  asset_id uuid references public.mil_assets(id) on delete cascade,
  batch_id uuid references public.mil_upload_batches(id) on delete cascade,
  job_type text not null check (job_type in (
    'derivative', 'ai_analyze', 'near_dupe', 'ba_propose', 'exif_strip', 'promote_website'
  )),
  status text not null default 'queued'
    check (status in ('queued', 'running', 'succeeded', 'failed', 'cancelled')),
  attempts integer not null default 0,
  last_error text,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.mil_audit_events (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid references auth.users(id) on delete set null,
  action text not null,
  target_type text not null,
  target_id uuid,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists mil_audit_created_idx
  on public.mil_audit_events (created_at desc);

create or replace function public.mil_touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists mil_upload_batches_updated on public.mil_upload_batches;
create trigger mil_upload_batches_updated
  before update on public.mil_upload_batches
  for each row execute function public.mil_touch_updated_at();

drop trigger if exists mil_assets_updated on public.mil_assets;
create trigger mil_assets_updated
  before update on public.mil_assets
  for each row execute function public.mil_touch_updated_at();

drop trigger if exists mil_collections_updated on public.mil_collections;
create trigger mil_collections_updated
  before update on public.mil_collections
  for each row execute function public.mil_touch_updated_at();

drop trigger if exists mil_reel_projects_updated on public.mil_reel_projects;
create trigger mil_reel_projects_updated
  before update on public.mil_reel_projects
  for each row execute function public.mil_touch_updated_at();

create or replace function public.mil_enforce_public_use_gates()
returns trigger
language plpgsql
as $$
declare
  v_asset public.mil_assets%rowtype;
begin
  if new.use_key in ('website', 'social_media', 'reel_creation') and new.approved is true then
    select * into v_asset from public.mil_assets where id = new.asset_id;
    if v_asset.rights_status in ('ownership_unknown', 'permission_unknown', 'public_use_prohibited')
       or v_asset.customer_permission_status not in ('confirmed', 'not_required')
       or v_asset.privacy_status in ('needs_review', 'needs_redaction', 'restricted') then
      raise exception 'Public/marketing use blocked until rights, customer permission (confirmed|not_required), and privacy are cleared';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists mil_permitted_uses_gate on public.mil_permitted_uses;
create trigger mil_permitted_uses_gate
  before insert or update on public.mil_permitted_uses
  for each row execute function public.mil_enforce_public_use_gates();

-- Eligibility (verified + privacy clear + reel_creation approved) does NOT grant access.
-- Access requires an active direct assignment or active assigned collection for this creator.
-- Revoked assignments (status <> 'active') immediately deny access / new signed links.
create or replace function public.mil_creator_can_view_asset(p_asset_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.mil_assets a
    where a.id = p_asset_id
      and a.privacy_status = 'clear'
      and a.human_review_status = 'verified'
      and a.archived_at is null
      and exists (
        select 1 from public.mil_permitted_uses u
        where u.asset_id = a.id
          and u.use_key = 'reel_creation'
          and u.approved = true
      )
      and (
        exists (
          select 1 from public.mil_creator_assignments ca
          where ca.creator_user_id = auth.uid()
            and ca.status = 'active'
            and ca.asset_id = a.id
            and ca.revoked_at is null
        )
        or exists (
          select 1
          from public.mil_creator_assignments ca
          join public.mil_collection_items ci on ci.collection_id = ca.collection_id
          where ca.creator_user_id = auth.uid()
            and ca.status = 'active'
            and ca.revoked_at is null
            and ci.asset_id = a.id
        )
      )
  );
$$;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.mil_tag_vocabulary enable row level security;
alter table public.mil_upload_batches enable row level security;
alter table public.mil_assets enable row level security;
alter table public.mil_manifest_entries enable row level security;
alter table public.mil_derivatives enable row level security;
alter table public.mil_permitted_uses enable row level security;
alter table public.mil_asset_tags enable row level security;
alter table public.mil_ai_analyses enable row level security;
alter table public.mil_verified_metadata enable row level security;
alter table public.mil_quality_scores enable row level security;
alter table public.mil_privacy_findings enable row level security;
alter table public.mil_collections enable row level security;
alter table public.mil_collection_items enable row level security;
alter table public.mil_asset_relationships enable row level security;
alter table public.mil_creator_assignments enable row level security;
alter table public.mil_reel_projects enable row level security;
alter table public.mil_reel_versions enable row level security;
alter table public.mil_reel_source_media enable row level security;
alter table public.mil_website_promotions enable row level security;
alter table public.mil_processing_jobs enable row level security;
alter table public.mil_audit_events enable row level security;

-- Capability-matrix RLS is installed in 20260725140000_media_intel_pre_staging_hardening.sql
-- (replaces broad mil_staff_all_* FOR ALL policies). Creator SELECT policies remain here
-- as a baseline and are refined/recreated in the hardening migration.

drop policy if exists mil_creator_select_assets on public.mil_assets;
create policy mil_creator_select_assets on public.mil_assets
  for select to authenticated
  using (public.mil_is_creator() and public.mil_creator_can_view_asset(id));

drop policy if exists mil_creator_select_derivatives on public.mil_derivatives;
create policy mil_creator_select_derivatives on public.mil_derivatives
  for select to authenticated
  using (
    public.mil_is_creator()
    and public.mil_creator_can_view_asset(asset_id)
    and kind in ('grid_thumb', 'detail_preview', 'creator_download', 'video_thumb', 'video_preview')
  );

drop policy if exists mil_creator_select_verified on public.mil_verified_metadata;
create policy mil_creator_select_verified on public.mil_verified_metadata
  for select to authenticated
  using (public.mil_is_creator() and public.mil_creator_can_view_asset(asset_id));

drop policy if exists mil_creator_select_uses on public.mil_permitted_uses;
create policy mil_creator_select_uses on public.mil_permitted_uses
  for select to authenticated
  using (public.mil_is_creator() and public.mil_creator_can_view_asset(asset_id));

drop policy if exists mil_creator_select_collections on public.mil_collections;
create policy mil_creator_select_collections on public.mil_collections
  for select to authenticated
  using (
    public.mil_is_creator()
    and visibility = 'creator_shared'
    and archived_at is null
    and exists (
      select 1 from public.mil_creator_assignments ca
      where ca.collection_id = mil_collections.id
        and ca.creator_user_id = auth.uid()
        and ca.status = 'active'
        and ca.revoked_at is null
    )
  );

drop policy if exists mil_creator_select_collection_items on public.mil_collection_items;
create policy mil_creator_select_collection_items on public.mil_collection_items
  for select to authenticated
  using (
    public.mil_is_creator()
    and exists (
      select 1 from public.mil_collections c
      join public.mil_creator_assignments ca on ca.collection_id = c.id
      where c.id = mil_collection_items.collection_id
        and ca.creator_user_id = auth.uid()
        and ca.status = 'active'
        and ca.revoked_at is null
        and c.visibility = 'creator_shared'
    )
  );

drop policy if exists mil_creator_select_assignments on public.mil_creator_assignments;
create policy mil_creator_select_assignments on public.mil_creator_assignments
  for select to authenticated
  using (public.mil_is_creator() and creator_user_id = auth.uid());

-- Phone dumps use scoped bearer sessions (service role), not a client phone_uploader role.

insert into public.mil_tag_vocabulary (slug, label, category, is_system, synonyms)
values
  ('heavy-lint', 'Heavy lint', 'condition', true, array['lint buildup','packed lint']),
  ('restricted-airflow', 'Restricted airflow', 'condition', true, array['low airflow']),
  ('damaged-transition-hose', 'Damaged transition hose', 'condition', true, array['torn hose']),
  ('crushed-hose', 'Crushed hose', 'condition', true, array[]::text[]),
  ('disconnected-duct', 'Disconnected duct', 'condition', true, array[]::text[]),
  ('dirty-register', 'Dirty register', 'condition', true, array[]::text[]),
  ('contaminated-return', 'Contaminated return', 'condition', true, array[]::text[]),
  ('roof-termination', 'Roof termination', 'component', true, array[]::text[]),
  ('exterior-termination', 'Exterior termination', 'component', true, array[]::text[]),
  ('bird-guard', 'Bird guard or screen', 'component', true, array['screen','guard']),
  ('equipment-setup', 'Equipment setup', 'process', true, array[]::text[]),
  ('cleaning-in-progress', 'Cleaning in progress', 'process', true, array['during']),
  ('completed-cleaning', 'Completed cleaning', 'process', true, array['after','clean']),
  ('dryer-vent', 'Dryer vent', 'service', true, array['dryer']),
  ('air-duct', 'Air duct', 'service', true, array['duct','hvac']),
  ('commercial', 'Commercial', 'service', true, array['multifamily'])
on conflict (slug) do nothing;

commit;

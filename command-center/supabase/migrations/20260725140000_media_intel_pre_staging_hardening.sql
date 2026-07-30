-- Media Intelligence Library — pre-staging hardening (single-company).
-- Capability-matrix RLS, SECURITY DEFINER RPCs, grant finalization, reel upload grants.
-- No tenant_id / organization_id columns.

begin;

-- ---------------------------------------------------------------------------
-- 1. Asset checksum tracking + grant revoke column (needed by finalize RPC)
-- ---------------------------------------------------------------------------
alter table public.mil_assets
  add column if not exists checksum_status text not null default 'unverified'
    check (checksum_status in ('unverified', 'verified', 'mismatch', 'pending')),
  add column if not exists client_checksum_sha256 text;

alter table public.mil_upload_grants
  add column if not exists revoked_at timestamptz;

comment on column public.mil_assets.checksum_status is
  'Server-side checksum verification state for quarantine → original promotion.';
comment on column public.mil_assets.client_checksum_sha256 is
  'Client-computed SHA-256 at upload time; compared during grant finalization.';

-- ---------------------------------------------------------------------------
-- 2. Creator assignment XOR + active partial uniques
-- ---------------------------------------------------------------------------
alter table public.mil_creator_assignments
  drop constraint if exists mil_creator_assignments_check;

alter table public.mil_creator_assignments
  drop constraint if exists mil_creator_assignments_one_target;

alter table public.mil_creator_assignments
  add constraint mil_creator_assignments_one_target
  check ((asset_id is null) <> (collection_id is null));

create unique index if not exists mil_creator_assignments_active_asset_uniq
  on public.mil_creator_assignments (creator_user_id, asset_id)
  where status = 'active' and revoked_at is null and asset_id is not null;

create unique index if not exists mil_creator_assignments_active_collection_uniq
  on public.mil_creator_assignments (creator_user_id, collection_id)
  where status = 'active' and revoked_at is null and collection_id is not null;

-- ---------------------------------------------------------------------------
-- 3. Reel version uniqueness (explicit index; table may already have UNIQUE)
-- ---------------------------------------------------------------------------
create unique index if not exists mil_reel_versions_project_version_uniq
  on public.mil_reel_versions (project_id, version_number);

-- ---------------------------------------------------------------------------
-- 4. Role helpers + audited insert helper
-- ---------------------------------------------------------------------------
create or replace function public.mil_is_reviewer()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.mil_current_role() in ('admin', 'manager', 'media_reviewer');
$$;

create or replace function public.mil_is_office()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.mil_current_role() = 'office';
$$;

create or replace function public.mil_can_browse_library()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.mil_current_role() in ('admin', 'manager', 'office', 'media_reviewer');
$$;

create or replace function public.mil_audit_insert(
  p_action text,
  p_target_type text,
  p_target_id uuid,
  p_details jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  insert into public.mil_audit_events (actor_user_id, action, target_type, target_id, details)
  values (auth.uid(), p_action, p_target_type, p_target_id, coalesce(p_details, '{}'::jsonb))
  returning id into v_id;
  return v_id;
end;
$$;

revoke all on function public.mil_audit_insert(text, text, uuid, jsonb) from public;

-- ---------------------------------------------------------------------------
-- 5. Drop broad legacy policies (if any were applied in earlier drafts)
-- ---------------------------------------------------------------------------
do $$
declare
  r record;
begin
  for r in
    select schemaname, tablename, policyname
    from pg_policies
    where schemaname = 'public'
      and (
        policyname like 'mil_staff_all_%'
        or policyname like 'mil_phone_%'
        or policyname in (
          'mil_reel_staff_all',
          'mil_reel_creator_all',
          'mil_reel_broad_select',
          'mil_phone_uploader_all',
          'mil_staff_all'
        )
      )
  loop
    execute format('drop policy if exists %I on %I.%I', r.policyname, r.schemaname, r.tablename);
  end loop;
end $$;

-- Drop hardening targets so this migration is idempotent on re-run.
drop policy if exists mil_browse_assets on public.mil_assets;
drop policy if exists mil_browse_upload_batches on public.mil_upload_batches;
drop policy if exists mil_browse_manifest_entries on public.mil_manifest_entries;
drop policy if exists mil_browse_derivatives on public.mil_derivatives;
drop policy if exists mil_browse_asset_tags on public.mil_asset_tags;
drop policy if exists mil_browse_ai_analyses on public.mil_ai_analyses;
drop policy if exists mil_browse_verified_metadata on public.mil_verified_metadata;
drop policy if exists mil_browse_quality_scores on public.mil_quality_scores;
drop policy if exists mil_browse_privacy_findings on public.mil_privacy_findings;
drop policy if exists mil_browse_collections on public.mil_collections;
drop policy if exists mil_browse_collection_items on public.mil_collection_items;
drop policy if exists mil_browse_asset_relationships on public.mil_asset_relationships;
drop policy if exists mil_browse_permitted_uses on public.mil_permitted_uses;
drop policy if exists mil_browse_tag_vocabulary on public.mil_tag_vocabulary;
drop policy if exists mil_browse_processing_jobs on public.mil_processing_jobs;
drop policy if exists mil_browse_reel_projects on public.mil_reel_projects;
drop policy if exists mil_browse_reel_versions on public.mil_reel_versions;
drop policy if exists mil_browse_reel_source_media on public.mil_reel_source_media;
drop policy if exists mil_browse_website_promotions on public.mil_website_promotions;
drop policy if exists mil_browse_audit_events on public.mil_audit_events;
drop policy if exists mil_creator_assignments_select on public.mil_creator_assignments;
drop policy if exists mil_creator_assignments_owner_all on public.mil_creator_assignments;
drop policy if exists mil_website_promotions_owner_all on public.mil_website_promotions;
drop policy if exists mil_permitted_uses_owner_all on public.mil_permitted_uses;
drop policy if exists mil_reviewer_write_verified_metadata on public.mil_verified_metadata;
drop policy if exists mil_reviewer_write_privacy_findings on public.mil_privacy_findings;
drop policy if exists mil_reviewer_write_asset_relationships on public.mil_asset_relationships;
drop policy if exists mil_reviewer_write_asset_tags on public.mil_asset_tags;
drop policy if exists mil_library_staff_write_upload_batches on public.mil_upload_batches;
drop policy if exists mil_reviewer_owner_update_assets on public.mil_assets;
drop policy if exists mil_library_staff_write_collections on public.mil_collections;
drop policy if exists mil_library_staff_write_collection_items on public.mil_collection_items;
drop policy if exists mil_creator_select_reel_projects on public.mil_reel_projects;
drop policy if exists mil_creator_insert_reel_projects on public.mil_reel_projects;
drop policy if exists mil_creator_update_reel_projects on public.mil_reel_projects;
drop policy if exists mil_creator_select_reel_versions on public.mil_reel_versions;
drop policy if exists mil_owner_update_reel_projects on public.mil_reel_projects;
drop policy if exists mil_owner_update_reel_versions on public.mil_reel_versions;
drop policy if exists mil_library_staff_update_upload_batches on public.mil_upload_batches;

-- ---------------------------------------------------------------------------
-- 6. Library browse SELECT policies
-- ---------------------------------------------------------------------------
create policy mil_browse_assets on public.mil_assets
  for select to authenticated
  using (public.mil_can_browse_library());

create policy mil_browse_upload_batches on public.mil_upload_batches
  for select to authenticated
  using (public.mil_can_browse_library());

create policy mil_browse_manifest_entries on public.mil_manifest_entries
  for select to authenticated
  using (public.mil_can_browse_library());

create policy mil_browse_derivatives on public.mil_derivatives
  for select to authenticated
  using (public.mil_can_browse_library());

create policy mil_browse_asset_tags on public.mil_asset_tags
  for select to authenticated
  using (public.mil_can_browse_library());

create policy mil_browse_ai_analyses on public.mil_ai_analyses
  for select to authenticated
  using (public.mil_can_browse_library());

create policy mil_browse_verified_metadata on public.mil_verified_metadata
  for select to authenticated
  using (public.mil_can_browse_library());

create policy mil_browse_quality_scores on public.mil_quality_scores
  for select to authenticated
  using (public.mil_can_browse_library());

create policy mil_browse_privacy_findings on public.mil_privacy_findings
  for select to authenticated
  using (public.mil_can_browse_library());

create policy mil_browse_collections on public.mil_collections
  for select to authenticated
  using (public.mil_can_browse_library());

create policy mil_browse_collection_items on public.mil_collection_items
  for select to authenticated
  using (public.mil_can_browse_library());

create policy mil_browse_asset_relationships on public.mil_asset_relationships
  for select to authenticated
  using (public.mil_can_browse_library());

create policy mil_browse_permitted_uses on public.mil_permitted_uses
  for select to authenticated
  using (public.mil_can_browse_library());

create policy mil_browse_tag_vocabulary on public.mil_tag_vocabulary
  for select to authenticated
  using (public.mil_can_browse_library());

create policy mil_browse_processing_jobs on public.mil_processing_jobs
  for select to authenticated
  using (public.mil_can_browse_library());

create policy mil_browse_reel_projects on public.mil_reel_projects
  for select to authenticated
  using (public.mil_can_browse_library());

create policy mil_browse_reel_versions on public.mil_reel_versions
  for select to authenticated
  using (public.mil_can_browse_library());

create policy mil_browse_reel_source_media on public.mil_reel_source_media
  for select to authenticated
  using (public.mil_can_browse_library());

create policy mil_browse_website_promotions on public.mil_website_promotions
  for select to authenticated
  using (public.mil_can_browse_library());

-- ---------------------------------------------------------------------------
-- 7–9. Creator assignments + audit + owner-only surfaces
-- ---------------------------------------------------------------------------
create policy mil_creator_assignments_select on public.mil_creator_assignments
  for select to authenticated
  using (
    public.mil_is_owner_admin()
    or (public.mil_is_creator() and creator_user_id = auth.uid())
  );

create policy mil_creator_assignments_owner_all on public.mil_creator_assignments
  for all to authenticated
  using (public.mil_is_owner_admin())
  with check (public.mil_is_owner_admin());

create policy mil_browse_audit_events on public.mil_audit_events
  for select to authenticated
  using (public.mil_can_browse_library());

create policy mil_website_promotions_owner_all on public.mil_website_promotions
  for all to authenticated
  using (public.mil_is_owner_admin())
  with check (public.mil_is_owner_admin());

-- ---------------------------------------------------------------------------
-- 10–12. Reviewer / library staff write matrix
-- ---------------------------------------------------------------------------
create policy mil_reviewer_write_verified_metadata on public.mil_verified_metadata
  for all to authenticated
  using (public.mil_is_reviewer())
  with check (public.mil_is_reviewer());

create policy mil_reviewer_write_privacy_findings on public.mil_privacy_findings
  for all to authenticated
  using (public.mil_is_reviewer())
  with check (public.mil_is_reviewer());

create policy mil_reviewer_write_asset_relationships on public.mil_asset_relationships
  for all to authenticated
  using (public.mil_is_reviewer())
  with check (public.mil_is_reviewer());

create policy mil_reviewer_write_asset_tags on public.mil_asset_tags
  for all to authenticated
  using (public.mil_is_reviewer())
  with check (public.mil_is_reviewer());

create policy mil_permitted_uses_owner_all on public.mil_permitted_uses
  for all to authenticated
  using (public.mil_is_owner_admin())
  with check (public.mil_is_owner_admin());

create policy mil_library_staff_write_upload_batches on public.mil_upload_batches
  for insert to authenticated
  with check (public.mil_can_browse_library());

create policy mil_library_staff_update_upload_batches on public.mil_upload_batches
  for update to authenticated
  using (public.mil_can_browse_library())
  with check (public.mil_can_browse_library());

create policy mil_reviewer_owner_update_assets on public.mil_assets
  for update to authenticated
  using (public.mil_is_reviewer() or public.mil_is_owner_admin())
  with check (public.mil_is_reviewer() or public.mil_is_owner_admin());

create policy mil_library_staff_write_collections on public.mil_collections
  for all to authenticated
  using (public.mil_can_browse_library())
  with check (public.mil_can_browse_library());

create policy mil_library_staff_write_collection_items on public.mil_collection_items
  for all to authenticated
  using (public.mil_can_browse_library())
  with check (public.mil_can_browse_library());

-- ---------------------------------------------------------------------------
-- 13. Creator reel project / version policies
-- ---------------------------------------------------------------------------
create policy mil_creator_select_reel_projects on public.mil_reel_projects
  for select to authenticated
  using (public.mil_is_creator() and creator_user_id = auth.uid());

create policy mil_creator_insert_reel_projects on public.mil_reel_projects
  for insert to authenticated
  with check (
    public.mil_is_creator()
    and creator_user_id = auth.uid()
    and status = 'creator_draft'
  );

-- Creators may only keep drafts editable via RLS. Transitions to
-- submitted_for_review must go through mil_submit_reel_version RPC.
create policy mil_creator_update_reel_projects on public.mil_reel_projects
  for update to authenticated
  using (
    public.mil_is_creator()
    and creator_user_id = auth.uid()
    and status in ('creator_draft', 'revision_requested')
  )
  with check (
    public.mil_is_creator()
    and creator_user_id = auth.uid()
    and status in ('creator_draft', 'revision_requested')
  );

create policy mil_creator_select_reel_versions on public.mil_reel_versions
  for select to authenticated
  using (
    public.mil_is_creator()
    and exists (
      select 1
      from public.mil_reel_projects p
      where p.id = mil_reel_versions.project_id
        and p.creator_user_id = auth.uid()
    )
  );

create policy mil_owner_update_reel_projects on public.mil_reel_projects
  for update to authenticated
  using (public.mil_is_owner_admin())
  with check (public.mil_is_owner_admin());

create policy mil_owner_update_reel_versions on public.mil_reel_versions
  for update to authenticated
  using (public.mil_is_owner_admin())
  with check (public.mil_is_owner_admin());

-- Creators have NO insert/update/delete on mil_reel_versions (RPC / edge only).

-- ---------------------------------------------------------------------------
-- 14. SECURITY DEFINER RPCs (authenticated; finalize is service_role only)
-- ---------------------------------------------------------------------------
create or replace function public.mil_verify_asset(p_asset_id uuid, p_patch jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;
  if not public.mil_is_reviewer() then
    raise exception 'Only reviewers may verify asset metadata';
  end if;
  if not exists (select 1 from public.mil_assets where id = p_asset_id) then
    raise exception 'Asset not found';
  end if;

  insert into public.mil_verified_metadata (
    asset_id,
    service_category,
    work_phase,
    condition_notes,
    location_component,
    narrative,
    public_caption,
    alt_text,
    unsuitable_uses,
    verified_by,
    verified_at,
    updated_at
  )
  values (
    p_asset_id,
    p_patch->>'service_category',
    p_patch->>'work_phase',
    p_patch->>'condition_notes',
    p_patch->>'location_component',
    p_patch->>'narrative',
    p_patch->>'public_caption',
    p_patch->>'alt_text',
    coalesce(
      (select array_agg(value) from jsonb_array_elements_text(coalesce(p_patch->'unsuitable_uses', '[]'::jsonb)) as t(value)),
      '{}'::text[]
    ),
    auth.uid(),
    now(),
    now()
  )
  on conflict (asset_id) do update set
    service_category = excluded.service_category,
    work_phase = excluded.work_phase,
    condition_notes = excluded.condition_notes,
    location_component = excluded.location_component,
    narrative = excluded.narrative,
    public_caption = excluded.public_caption,
    alt_text = excluded.alt_text,
    unsuitable_uses = excluded.unsuitable_uses,
    verified_by = auth.uid(),
    verified_at = now(),
    updated_at = now();

  update public.mil_assets
  set human_review_status = 'verified', updated_at = now()
  where id = p_asset_id;

  perform public.mil_audit_insert(
    'human_verification',
    'mil_assets',
    p_asset_id,
    jsonb_build_object('patch', coalesce(p_patch, '{}'::jsonb))
  );
end;
$$;

create or replace function public.mil_set_permitted_use(
  p_asset_id uuid,
  p_use_key text,
  p_approved boolean,
  p_notes text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;
  if not public.mil_is_owner_admin() then
    raise exception 'Only owner/admin may set permitted uses';
  end if;
  if not exists (select 1 from public.mil_assets where id = p_asset_id) then
    raise exception 'Asset not found';
  end if;

  insert into public.mil_permitted_uses (asset_id, use_key, approved, approved_by, approved_at, notes)
  values (
    p_asset_id,
    p_use_key,
    coalesce(p_approved, false),
    auth.uid(),
    case when coalesce(p_approved, false) then now() else null end,
    p_notes
  )
  on conflict (asset_id, use_key) do update set
    approved = excluded.approved,
    approved_by = auth.uid(),
    approved_at = case when excluded.approved then now() else null end,
    notes = excluded.notes;

  perform public.mil_audit_insert(
    'permitted_use_change',
    'mil_assets',
    p_asset_id,
    jsonb_build_object('use_key', p_use_key, 'approved', p_approved, 'notes', p_notes)
  );
end;
$$;

create or replace function public.mil_review_reel_version(
  p_version_id uuid,
  p_decision text,
  p_notes text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_version public.mil_reel_versions%rowtype;
  v_new_status text;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;
  if not public.mil_is_owner_admin() then
    raise exception 'Only owner/admin may review reel versions';
  end if;
  if p_decision not in ('approved', 'denied', 'revision_requested') then
    raise exception 'Invalid review decision';
  end if;

  select * into v_version
  from public.mil_reel_versions
  where id = p_version_id
  for update;

  if not found then
    raise exception 'Reel version not found';
  end if;
  if v_version.status <> 'submitted_for_review' then
    raise exception 'Reel version must be submitted_for_review to review';
  end if;

  v_new_status := case p_decision
    when 'approved' then 'approved_to_post'
    when 'denied' then 'denied'
    else 'revision_requested'
  end;

  update public.mil_reel_versions
  set
    status = v_new_status,
    review_decision = p_decision,
    review_notes = nullif(btrim(coalesce(p_notes, '')), ''),
    reviewed_by = auth.uid(),
    reviewed_at = now()
  where id = p_version_id;

  update public.mil_reel_projects
  set status = v_new_status, updated_at = now()
  where id = v_version.project_id;

  perform public.mil_audit_insert(
    'reel_' || p_decision,
    'mil_reel_versions',
    p_version_id,
    jsonb_build_object(
      'decision', p_decision,
      'notes', nullif(btrim(coalesce(p_notes, '')), ''),
      'notes_provided', coalesce(btrim(coalesce(p_notes, '')) <> '', false)
    )
  );
end;
$$;

create or replace function public.mil_submit_reel_version(p_version_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_version public.mil_reel_versions%rowtype;
  v_project public.mil_reel_projects%rowtype;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  select * into v_version
  from public.mil_reel_versions
  where id = p_version_id
  for update;

  if not found then
    raise exception 'Reel version not found';
  end if;
  if v_version.status <> 'creator_draft' then
    raise exception 'Reel version must be creator_draft to submit';
  end if;

  select * into v_project
  from public.mil_reel_projects
  where id = v_version.project_id;

  if not found then
    raise exception 'Reel project not found';
  end if;

  if not (
    public.mil_is_owner_admin()
    or (public.mil_is_creator() and v_project.creator_user_id = auth.uid())
  ) then
    raise exception 'Only the owning creator or owner/admin may submit reel versions';
  end if;

  update public.mil_reel_versions
  set status = 'submitted_for_review', submitted_at = now()
  where id = p_version_id;

  update public.mil_reel_projects
  set status = 'submitted_for_review', updated_at = now()
  where id = v_version.project_id;

  perform public.mil_audit_insert(
    'reel_submission',
    'mil_reel_versions',
    p_version_id,
    '{}'::jsonb
  );
end;
$$;

create or replace function public.mil_set_asset_archive_state(p_asset_id uuid, p_action text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;
  if not public.mil_is_owner_admin() then
    raise exception 'Only owner/admin may change archive state';
  end if;
  if p_action not in ('archive', 'restore', 'restrict', 'unrestrict') then
    raise exception 'Invalid archive action';
  end if;
  if not exists (select 1 from public.mil_assets where id = p_asset_id) then
    raise exception 'Asset not found';
  end if;

  if p_action = 'archive' then
    update public.mil_assets
    set archived_at = now(), updated_at = now()
    where id = p_asset_id;
  elsif p_action = 'restore' then
    update public.mil_assets
    set archived_at = null, updated_at = now()
    where id = p_asset_id;
  elsif p_action = 'restrict' then
    update public.mil_assets
    set privacy_status = 'restricted', updated_at = now()
    where id = p_asset_id;
  else
    update public.mil_assets
    set privacy_status = 'needs_review', updated_at = now()
    where id = p_asset_id;
  end if;

  perform public.mil_audit_insert(
    'asset_' || p_action,
    'mil_assets',
    p_asset_id,
    jsonb_build_object('action', p_action)
  );
end;
$$;

create or replace function public.mil_assign_creator(
  p_creator_user_id uuid,
  p_asset_id uuid,
  p_collection_id uuid,
  p_notes text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;
  if not public.mil_is_owner_admin() then
    raise exception 'Only owner/admin may assign creators';
  end if;
  if (p_asset_id is null) = (p_collection_id is null) then
    raise exception 'Exactly one of asset_id or collection_id must be provided';
  end if;

  insert into public.mil_creator_assignments (
    asset_id,
    collection_id,
    creator_user_id,
    assigned_by,
    status,
    notes
  )
  values (
    p_asset_id,
    p_collection_id,
    p_creator_user_id,
    auth.uid(),
    'active',
    p_notes
  )
  returning id into v_id;

  perform public.mil_audit_insert(
    'creator_assigned',
    'mil_creator_assignments',
    v_id,
    jsonb_build_object(
      'creator_user_id', p_creator_user_id,
      'asset_id', p_asset_id,
      'collection_id', p_collection_id,
      'notes', p_notes
    )
  );

  return v_id;
end;
$$;

revoke all on function public.mil_verify_asset(uuid, jsonb) from public;
revoke all on function public.mil_set_permitted_use(uuid, text, boolean, text) from public;
revoke all on function public.mil_review_reel_version(uuid, text, text) from public;
revoke all on function public.mil_submit_reel_version(uuid) from public;
revoke all on function public.mil_set_asset_archive_state(uuid, text) from public;
revoke all on function public.mil_assign_creator(uuid, uuid, uuid, text) from public;

grant execute on function public.mil_verify_asset(uuid, jsonb) to authenticated;
grant execute on function public.mil_set_permitted_use(uuid, text, boolean, text) to authenticated;
grant execute on function public.mil_review_reel_version(uuid, text, text) to authenticated;
grant execute on function public.mil_submit_reel_version(uuid) to authenticated;
grant execute on function public.mil_set_asset_archive_state(uuid, text) to authenticated;
grant execute on function public.mil_assign_creator(uuid, uuid, uuid, text) to authenticated;

-- ---------------------------------------------------------------------------
-- 15. Grant finalization (service_role only)
-- ---------------------------------------------------------------------------
create or replace function public.mil_finalize_upload_grant(
  p_grant_id uuid,
  p_verified_checksum text,
  p_stored_mime text,
  p_stored_bytes bigint,
  p_is_duplicate boolean default false,
  p_duplicate_asset_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_grant public.mil_upload_grants%rowtype;
  v_session public.mil_upload_sessions%rowtype;
  v_final_path text;
  v_media_kind text;
  v_mime text;
  v_manifest_id uuid;
begin
  select * into v_grant
  from public.mil_upload_grants
  where id = p_grant_id
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'grant_not_found');
  end if;

  if v_grant.completed_at is not null then
    return jsonb_build_object(
      'ok', true,
      'status', 'already_completed',
      'grant_id', p_grant_id,
      'asset_id', v_grant.asset_id,
      'batch_id', v_grant.batch_id
    );
  end if;

  select * into v_session
  from public.mil_upload_sessions
  where id = v_grant.session_id;

  if not found then
    raise exception 'Upload session not found for grant';
  end if;
  if v_session.revoked_at is not null then
    raise exception 'Upload session revoked';
  end if;
  if v_session.expires_at <= now() then
    raise exception 'Upload session expired';
  end if;
  if v_grant.revoked_at is not null then
    raise exception 'Upload grant revoked';
  end if;
  if v_grant.expires_at <= now() then
    raise exception 'Upload grant expired';
  end if;

  v_mime := lower(btrim(coalesce(p_stored_mime, '')));
  if v_mime = '' then
    raise exception 'Invalid stored mime type';
  end if;
  if v_mime not in (
    'image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/heic', 'image/heif', 'image/gif',
    'video/mp4', 'video/quicktime', 'video/webm', 'video/x-m4v'
  ) then
    raise exception 'Stored mime type not allowed: %', v_mime;
  end if;

  -- Authoritative stored MIME must match the grant, with jpg/jpeg equivalence only.
  if not (
    v_mime = lower(v_grant.content_type)
    or (v_mime in ('image/jpg', 'image/jpeg') and lower(v_grant.content_type) in ('image/jpg', 'image/jpeg'))
  ) then
    raise exception 'Stored mime type does not match grant content_type';
  end if;

  if p_stored_bytes is null or p_stored_bytes <= 0 or p_stored_bytes > v_grant.max_bytes then
    raise exception 'Invalid stored object size';
  end if;

  if p_verified_checksum is null or btrim(p_verified_checksum) = ''
     or not (lower(p_verified_checksum) ~ '^[a-f0-9]{64}$') then
    raise exception 'Invalid verified checksum';
  end if;

  -- Claim the grant before any downstream inserts (replay-safe under FOR UPDATE).
  update public.mil_upload_grants
  set completed_at = now()
  where id = p_grant_id
    and completed_at is null;

  if not found then
    select * into v_grant from public.mil_upload_grants where id = p_grant_id;
    return jsonb_build_object(
      'ok', true,
      'status', 'already_completed',
      'grant_id', p_grant_id,
      'asset_id', v_grant.asset_id,
      'batch_id', v_grant.batch_id
    );
  end if;

  if p_is_duplicate then
    if p_duplicate_asset_id is null then
      raise exception 'duplicate_asset_id required when p_is_duplicate is true';
    end if;
    if not exists (
      select 1 from public.mil_assets
      where id = p_duplicate_asset_id and archived_at is null
    ) then
      raise exception 'Duplicate asset not found or archived';
    end if;

    insert into public.mil_manifest_entries (
      batch_id,
      asset_id,
      original_filename,
      mime_type,
      byte_size,
      checksum_sha256,
      upload_status,
      duplicate_status,
      processing_status
    )
    values (
      v_grant.batch_id,
      p_duplicate_asset_id,
      v_grant.original_filename,
      v_mime,
      p_stored_bytes,
      lower(p_verified_checksum),
      'duplicate',
      'exact',
      'skipped'
    )
    returning id into v_manifest_id;

    update public.mil_upload_batches
    set
      duplicate_count = duplicate_count + 1,
      updated_at = now()
    where id = v_grant.batch_id;

    perform public.mil_audit_insert(
      'upload_duplicate',
      'mil_upload_grants',
      p_grant_id,
      jsonb_build_object(
        'batch_id', v_grant.batch_id,
        'manifest_id', v_manifest_id,
        'duplicate_asset_id', p_duplicate_asset_id,
        'checksum', lower(p_verified_checksum)
      )
    );

    return jsonb_build_object(
      'ok', true,
      'status', 'duplicate',
      'grant_id', p_grant_id,
      'existing_asset_id', p_duplicate_asset_id,
      'manifest_id', v_manifest_id
    );
  end if;

  v_final_path := replace(v_grant.object_path, 'mil/quarantine/', 'mil/originals/');
  v_media_kind := case
    when v_mime like 'video/%' then 'video'
    when v_mime like 'image/%' then 'photo'
    else 'other'
  end;

  insert into public.mil_assets (
    id,
    batch_id,
    media_kind,
    mime_type,
    byte_size,
    checksum_sha256,
    client_checksum_sha256,
    checksum_status,
    original_filename,
    original_bucket,
    original_path,
    processing_status,
    human_review_status,
    privacy_status,
    created_by_user_id
  )
  values (
    v_grant.asset_id,
    v_grant.batch_id,
    v_media_kind,
    v_mime,
    p_stored_bytes,
    lower(p_verified_checksum),
    lower(p_verified_checksum),
    'verified',
    v_grant.original_filename,
    v_grant.bucket,
    v_final_path,
    'queued',
    'pending',
    'needs_review',
    v_session.created_by
  );

  insert into public.mil_manifest_entries (
    batch_id,
    asset_id,
    original_filename,
    mime_type,
    byte_size,
    checksum_sha256,
    upload_status,
    duplicate_status,
    processing_status
  )
  values (
    v_grant.batch_id,
    v_grant.asset_id,
    v_grant.original_filename,
    v_mime,
    p_stored_bytes,
    lower(p_verified_checksum),
    'uploaded',
    'none',
    'queued'
  )
  returning id into v_manifest_id;

  insert into public.mil_processing_jobs (asset_id, batch_id, job_type, status)
  values (v_grant.asset_id, v_grant.batch_id, 'ai_analyze', 'queued');

  update public.mil_upload_batches
  set
    success_count = success_count + 1,
    updated_at = now()
  where id = v_grant.batch_id;

  perform public.mil_audit_insert(
    'upload_finalized',
    'mil_assets',
    v_grant.asset_id,
    jsonb_build_object(
      'grant_id', p_grant_id,
      'batch_id', v_grant.batch_id,
      'session_id', v_grant.session_id,
      'manifest_id', v_manifest_id,
      'original_path', v_final_path,
      'checksum', lower(p_verified_checksum)
    )
  );

  return jsonb_build_object(
    'ok', true,
    'status', 'uploaded',
    'grant_id', p_grant_id,
    'asset_id', v_grant.asset_id,
    'batch_id', v_grant.batch_id,
    'manifest_id', v_manifest_id,
    'original_path', v_final_path
  );
end;
$$;

revoke all on function public.mil_finalize_upload_grant(uuid, text, text, bigint, boolean, uuid) from public;
grant execute on function public.mil_finalize_upload_grant(uuid, text, text, bigint, boolean, uuid) to service_role;

-- ---------------------------------------------------------------------------
-- 16. Reel upload grants (server-minted creator reel uploads)
-- ---------------------------------------------------------------------------
create table if not exists public.mil_reel_upload_grants (
  id uuid primary key default gen_random_uuid(),
  creator_user_id uuid not null references auth.users(id) on delete cascade,
  project_id uuid not null references public.mil_reel_projects(id) on delete cascade,
  version_id uuid not null references public.mil_reel_versions(id) on delete cascade,
  version_number integer not null,
  object_path text not null unique,
  bucket text not null default 'media-intel-derivatives',
  content_type text not null,
  max_bytes bigint not null check (max_bytes > 0),
  expires_at timestamptz not null,
  completed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists mil_reel_upload_grants_creator_idx
  on public.mil_reel_upload_grants (creator_user_id, completed_at);

create index if not exists mil_reel_upload_grants_version_idx
  on public.mil_reel_upload_grants (version_id, expires_at desc);

comment on table public.mil_reel_upload_grants is
  'Server-minted one-time reel upload grants. Creators must not write mil/reels/% storage directly.';

alter table public.mil_reel_upload_grants enable row level security;

drop policy if exists mil_reel_upload_grants_select on public.mil_reel_upload_grants;

create policy mil_reel_upload_grants_select on public.mil_reel_upload_grants
  for select to authenticated
  using (
    public.mil_is_owner_admin()
    or (public.mil_is_creator() and creator_user_id = auth.uid())
  );

-- ---------------------------------------------------------------------------
-- 17. Website prepare/promote disabled until public-safe transform is proven
-- ---------------------------------------------------------------------------
comment on table public.mil_website_promotions is
  'Website prepare/promote is disabled until a proven public-safe transform pipeline (EXIF/metadata strip + derivative verification) is validated end-to-end. Promotion must never copy private originals.';

comment on column public.mil_processing_jobs.job_type is
  'promote_website jobs remain disabled in pre-staging until public-safe transform is proven.';

-- ---------------------------------------------------------------------------
-- 18. Session quota columns (idempotent if 130000 already created table)
-- ---------------------------------------------------------------------------
alter table public.mil_upload_sessions
  add column if not exists max_file_count integer not null default 200,
  add column if not exists max_cumulative_bytes bigint not null default 5368709120,
  add column if not exists max_concurrent_grants integer not null default 5;

-- ---------------------------------------------------------------------------
-- 19. Cleanup helpers for expired grants / abandoned quarantine markers
-- ---------------------------------------------------------------------------
create or replace function public.mil_cleanup_expired_upload_grants()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  n integer;
begin
  -- Revoke unused expired grants (do NOT mark completed — that would forge success).
  -- Physical quarantine object deletion is a separate service-role storage sweep.
  with expired as (
    update public.mil_upload_grants g
    set revoked_at = now()
    where g.completed_at is null
      and g.revoked_at is null
      and g.expires_at <= now()
    returning g.id
  )
  select count(*)::integer into n from expired;
  return coalesce(n, 0);
end;
$$;

revoke all on function public.mil_cleanup_expired_upload_grants() from public;
grant execute on function public.mil_cleanup_expired_upload_grants() to service_role;

comment on function public.mil_cleanup_expired_upload_grants() is
  'Revokes expired unused grants so they cannot finalize. Quarantine object deletion is a separate service-role storage sweep.';

commit;

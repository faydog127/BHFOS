-- MIL Quality Cleanup lifecycle: archive / trash / restore / permanent delete (retention).
-- AI may only recommend disposition; humans act. Permanent delete is owner/admin after 30 days.

-- ---------------------------------------------------------------------------
-- 1. Columns
-- ---------------------------------------------------------------------------
alter table public.mil_assets
  add column if not exists trashed_at timestamptz,
  add column if not exists purge_eligible_at timestamptz,
  add column if not exists lifecycle_reason text,
  add column if not exists lifecycle_kept_at timestamptz,
  add column if not exists lifecycle_changed_by uuid references auth.users(id) on delete set null,
  add column if not exists lifecycle_changed_at timestamptz,
  add column if not exists ai_lifecycle_recommendation text,
  add column if not exists ai_quality_issues text[] not null default '{}',
  add column if not exists ai_usability text;

alter table public.mil_assets
  drop constraint if exists mil_assets_ai_lifecycle_recommendation_check;
alter table public.mil_assets
  add constraint mil_assets_ai_lifecycle_recommendation_check
  check (
    ai_lifecycle_recommendation is null
    or ai_lifecycle_recommendation in ('keep', 'keep_internal', 'archive', 'trash', 'human_review')
  );

alter table public.mil_assets
  drop constraint if exists mil_assets_ai_usability_check;
alter table public.mil_assets
  add constraint mil_assets_ai_usability_check
  check (
    ai_usability is null
    or ai_usability in ('good', 'usable', 'limited', 'poor', 'unusable', 'unknown')
  );

comment on column public.mil_assets.trashed_at is
  'Soft-trash timestamp. Excluded from library/marketing/creator/AI until restored or permanently deleted.';
comment on column public.mil_assets.purge_eligible_at is
  'Earliest time owner/admin may permanently delete (trashed_at + 30 days).';
comment on column public.mil_assets.lifecycle_kept_at is
  'Human chose Keep / Keep-internal from cleanup or review; leaves Quality Cleanup queue.';
comment on column public.mil_assets.ai_lifecycle_recommendation is
  'AI advisory disposition only. Never auto-applies archive/trash/delete.';

create index if not exists mil_assets_trashed_at_idx
  on public.mil_assets (trashed_at)
  where trashed_at is not null;

create index if not exists mil_assets_purge_eligible_idx
  on public.mil_assets (purge_eligible_at)
  where trashed_at is not null;

create index if not exists mil_assets_ai_lifecycle_rec_idx
  on public.mil_assets (ai_lifecycle_recommendation)
  where archived_at is null and trashed_at is null and lifecycle_kept_at is null;

-- Active checksum uniqueness: neither archived nor trashed.
drop index if exists public.mil_assets_active_checksum_uniq;
create unique index mil_assets_active_checksum_uniq
  on public.mil_assets (checksum_sha256)
  where archived_at is null and trashed_at is null;

comment on index public.mil_assets_active_checksum_uniq is
  'One active (non-archived, non-trashed) asset per checksum.';

-- ---------------------------------------------------------------------------
-- 2. Creator visibility: exclude trash
-- ---------------------------------------------------------------------------
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
      and a.trashed_at is null
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
-- 3. Lifecycle RPCs
-- ---------------------------------------------------------------------------
create or replace function public.mil_set_asset_lifecycle(
  p_asset_id uuid,
  p_action text,
  p_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_asset public.mil_assets%rowtype;
  v_reason text := nullif(trim(coalesce(p_reason, '')), '');
  v_bucket text;
  v_path text;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;
  if p_action not in ('keep', 'archive', 'trash', 'restore', 'permanent_delete') then
    raise exception 'Invalid lifecycle action';
  end if;

  select * into v_asset from public.mil_assets where id = p_asset_id for update;
  if not found then
    raise exception 'Asset not found';
  end if;

  if p_action = 'permanent_delete' then
    if not public.mil_is_owner_admin() then
      raise exception 'Only owner/admin may permanently delete';
    end if;
    if v_asset.trashed_at is null then
      raise exception 'Asset must be in Trash before permanent delete';
    end if;
    if v_asset.purge_eligible_at is null or v_asset.purge_eligible_at > now() then
      raise exception 'Permanent delete is not eligible until the 30-day retention period ends';
    end if;
    if exists (
      select 1 from public.mil_reel_source_media rsm where rsm.asset_id = p_asset_id
    ) then
      raise exception 'Cannot permanently delete: asset is linked to a reel. Unlink first.';
    end if;
    if exists (
      select 1 from public.mil_website_promotions wp where wp.asset_id = p_asset_id
    ) then
      raise exception 'Cannot permanently delete: asset was promoted to the website. Remove promotion first.';
    end if;

    v_bucket := v_asset.original_bucket;
    v_path := v_asset.original_path;

    -- Best-effort storage object removal (DB row is authoritative for MIL visibility).
    begin
      delete from storage.objects
      where bucket_id = v_bucket
        and name = v_path;
    exception when others then
      null;
    end;
    begin
      delete from storage.objects o
      using public.mil_derivatives d
      where d.asset_id = p_asset_id
        and o.bucket_id = d.bucket
        and o.name = d.object_path;
    exception when others then
      null;
    end;

    delete from public.mil_assets where id = p_asset_id;

    perform public.mil_audit_insert(
      'asset_permanent_delete',
      'mil_assets',
      p_asset_id,
      jsonb_build_object(
        'action', 'permanent_delete',
        'reason', v_reason,
        'original_bucket', v_bucket,
        'original_path', v_path
      )
    );
    return jsonb_build_object('ok', true, 'action', 'permanent_delete', 'assetId', p_asset_id);
  end if;

  if p_action in ('keep', 'archive', 'trash', 'restore') then
    if not (public.mil_is_owner_admin() or public.mil_is_reviewer()) then
      raise exception 'Only owner/admin or media reviewer may change lifecycle state';
    end if;
  end if;

  if p_action = 'keep' then
    update public.mil_assets
    set
      archived_at = null,
      trashed_at = null,
      purge_eligible_at = null,
      lifecycle_kept_at = now(),
      lifecycle_reason = v_reason,
      lifecycle_changed_by = auth.uid(),
      lifecycle_changed_at = now(),
      exclude_from_ai = false,
      updated_at = now()
    where id = p_asset_id;
  elsif p_action = 'archive' then
    update public.mil_assets
    set
      archived_at = coalesce(archived_at, now()),
      trashed_at = null,
      purge_eligible_at = null,
      lifecycle_kept_at = null,
      lifecycle_reason = v_reason,
      lifecycle_changed_by = auth.uid(),
      lifecycle_changed_at = now(),
      exclude_from_ai = true,
      updated_at = now()
    where id = p_asset_id;
  elsif p_action = 'trash' then
    update public.mil_assets
    set
      trashed_at = coalesce(trashed_at, now()),
      purge_eligible_at = coalesce(purge_eligible_at, coalesce(trashed_at, now()) + interval '30 days'),
      archived_at = null,
      lifecycle_kept_at = null,
      lifecycle_reason = v_reason,
      lifecycle_changed_by = auth.uid(),
      lifecycle_changed_at = now(),
      exclude_from_ai = true,
      updated_at = now()
    where id = p_asset_id;
  elsif p_action = 'restore' then
    update public.mil_assets
    set
      archived_at = null,
      trashed_at = null,
      purge_eligible_at = null,
      lifecycle_kept_at = null,
      lifecycle_reason = v_reason,
      lifecycle_changed_by = auth.uid(),
      lifecycle_changed_at = now(),
      exclude_from_ai = false,
      updated_at = now()
    where id = p_asset_id;
  end if;

  perform public.mil_audit_insert(
    'asset_lifecycle_' || p_action,
    'mil_assets',
    p_asset_id,
    jsonb_build_object('action', p_action, 'reason', v_reason)
  );

  return jsonb_build_object('ok', true, 'action', p_action, 'assetId', p_asset_id);
end;
$$;

create or replace function public.mil_set_assets_lifecycle(
  p_asset_ids uuid[],
  p_action text,
  p_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_ok int := 0;
  v_fail int := 0;
  v_errors jsonb := '[]'::jsonb;
  v_result jsonb;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;
  if p_action = 'permanent_delete' then
    raise exception 'Bulk permanent delete is not allowed';
  end if;
  if p_asset_ids is null or cardinality(p_asset_ids) = 0 then
    raise exception 'No asset ids provided';
  end if;
  if cardinality(p_asset_ids) > 50 then
    raise exception 'Bulk lifecycle is limited to 50 assets';
  end if;

  foreach v_id in array p_asset_ids
  loop
    begin
      v_result := public.mil_set_asset_lifecycle(v_id, p_action, p_reason);
      v_ok := v_ok + 1;
    exception when others then
      v_fail := v_fail + 1;
      v_errors := v_errors || jsonb_build_array(
        jsonb_build_object('assetId', v_id, 'error', SQLERRM)
      );
    end;
  end loop;

  return jsonb_build_object(
    'ok', v_fail = 0,
    'succeeded', v_ok,
    'failed', v_fail,
    'errors', v_errors
  );
end;
$$;

-- Compat: archive/restore via lifecycle (reviewer-capable); restrict stays owner/admin.
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
  if p_action in ('archive', 'restore') then
    perform public.mil_set_asset_lifecycle(p_asset_id, p_action, null);
    return;
  end if;
  if not public.mil_is_owner_admin() then
    raise exception 'Only owner/admin may change archive state';
  end if;
  if p_action not in ('restrict', 'unrestrict') then
    raise exception 'Invalid archive action';
  end if;
  if not exists (select 1 from public.mil_assets where id = p_asset_id) then
    raise exception 'Asset not found';
  end if;

  if p_action = 'restrict' then
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

revoke all on function public.mil_set_asset_lifecycle(uuid, text, text) from public;
revoke all on function public.mil_set_assets_lifecycle(uuid[], text, text) from public;
grant execute on function public.mil_set_asset_lifecycle(uuid, text, text) to authenticated;
grant execute on function public.mil_set_assets_lifecycle(uuid[], text, text) to authenticated;
grant execute on function public.mil_set_asset_archive_state(uuid, text) to authenticated;

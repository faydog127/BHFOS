-- Contributor self-upload: own-upload visibility + auto-assign after finalize.
-- Batches labeled source_label = 'contributor_self' (minted by create_contributor_session).

begin;

-- ---------------------------------------------------------------------------
-- 1. Creators may view their own non-trashed uploads before verify/privacy-clear
--    (assigned library media still requires verified + clear + reel_creation).
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
      and a.trashed_at is null
      and a.archived_at is null
      and (
        -- Own contributor self-upload (or any asset they created) — pre-verify OK.
        (
          a.created_by_user_id = auth.uid()
          and public.mil_is_creator()
        )
        or (
          a.privacy_status = 'clear'
          and a.human_review_status = 'verified'
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
        )
      )
  );
$$;

comment on function public.mil_creator_can_view_asset(uuid) is
  'Creator may view assigned verified/clear reel_creation assets, or their own non-trashed uploads (contributor self-shot).';

-- ---------------------------------------------------------------------------
-- 2. After mil_assets insert from contributor_self batch: rights + assignment
-- ---------------------------------------------------------------------------
create or replace function public.mil_auto_assign_contributor_self_upload()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_label text;
  v_uploader uuid;
begin
  select b.source_label, b.uploader_user_id
    into v_label, v_uploader
  from public.mil_upload_batches b
  where b.id = new.batch_id;

  if coalesce(v_label, '') <> 'contributor_self' then
    return new;
  end if;

  if v_uploader is null then
    v_uploader := new.created_by_user_id;
  end if;
  if v_uploader is null then
    return new;
  end if;

  if new.trashed_at is not null or new.archived_at is not null then
    return new;
  end if;

  -- Attribute rights for contractor/contributor-supplied media.
  if new.rights_status is distinct from 'contractor_supplied' then
    update public.mil_assets
    set rights_status = 'contractor_supplied'
    where id = new.id
      and rights_status is distinct from 'contractor_supplied';
  end if;

  if not exists (
    select 1 from public.mil_creator_assignments ca
    where ca.creator_user_id = v_uploader
      and ca.asset_id = new.id
      and ca.status = 'active'
      and ca.revoked_at is null
  ) then
    begin
      insert into public.mil_creator_assignments (
        asset_id, collection_id, creator_user_id, assigned_by, status, notes, instructions
      ) values (
        new.id, null, v_uploader, v_uploader, 'active',
        'contributor_self',
        'Contributor self-upload — awaiting owner review.'
      );
    exception
      when unique_violation then
        null;
    end;
  end if;

  insert into public.mil_audit_events (actor_user_id, action, target_type, target_id, details)
  values (
    v_uploader,
    'contributor_self_upload_assigned',
    'mil_assets',
    new.id,
    jsonb_build_object('creator_user_id', v_uploader, 'batch_id', new.batch_id)
  );

  return new;
end;
$$;

drop trigger if exists mil_assets_contributor_self_upload_trg on public.mil_assets;
create trigger mil_assets_contributor_self_upload_trg
  after insert on public.mil_assets
  for each row
  execute function public.mil_auto_assign_contributor_self_upload();

commit;

-- Media Intelligence Library — unified content submissions (Release A).
-- Additive: one owner-visible submission record per deliberate submit.
-- Does not remove mil_assets intake or mil_reel_versions review workspace.

begin;

-- ---------------------------------------------------------------------------
-- 1. Tables
-- ---------------------------------------------------------------------------
create table if not exists public.mil_submissions (
  id uuid primary key default gen_random_uuid(),
  public_id text not null,
  submission_type text not null
    check (submission_type in ('reel', 'raw_video', 'social_post')),
  review_status text not null default 'draft'
    check (review_status in (
      'draft',
      'awaiting_owner_review',
      'changes_requested',
      'approved',
      'rejected',
      'ready_to_post'
    )),
  action_owner text not null default 'contributor'
    check (action_owner in ('contributor', 'owner')),
  title text,
  contributor_notes text,
  context_kind text not null default 'general'
    check (context_kind in ('assignment', 'campaign', 'job', 'general', 'other')),
  context_label text,
  assignment_id uuid references public.mil_creator_assignments(id) on delete set null,
  caption text,
  cta text,
  hashtags text,
  platforms text[] not null default '{}'::text[],
  proposed_post_at timestamptz,
  reel_project_id uuid references public.mil_reel_projects(id) on delete set null,
  current_reel_version_id uuid references public.mil_reel_versions(id) on delete set null,
  approved_reel_version_id uuid references public.mil_reel_versions(id) on delete set null,
  contributor_user_id uuid not null,
  latest_version_number integer not null default 1
    check (latest_version_number >= 1),
  submitted_at timestamptz,
  idempotency_key text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint mil_submissions_public_id_uniq unique (public_id),
  constraint mil_submissions_idempotency_uniq unique (contributor_user_id, idempotency_key)
);

create table if not exists public.mil_submission_assets (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references public.mil_submissions(id) on delete cascade,
  asset_id uuid not null references public.mil_assets(id) on delete restrict,
  version_number integer not null default 1 check (version_number >= 1),
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  constraint mil_submission_assets_uniq unique (submission_id, asset_id)
);

create index if not exists mil_submissions_review_idx
  on public.mil_submissions (review_status, action_owner, submitted_at desc);
create index if not exists mil_submissions_type_idx
  on public.mil_submissions (submission_type, review_status);
create index if not exists mil_submissions_contributor_idx
  on public.mil_submissions (contributor_user_id, created_at desc);
create index if not exists mil_submissions_reel_project_idx
  on public.mil_submissions (reel_project_id)
  where reel_project_id is not null;
create index if not exists mil_submission_assets_asset_idx
  on public.mil_submission_assets (asset_id);

-- ---------------------------------------------------------------------------
-- 2. Public ID helper
-- ---------------------------------------------------------------------------
create or replace function public.mil_generate_submission_public_id()
returns text
language plpgsql
volatile
as $$
declare
  v_id text;
  v_tries int := 0;
begin
  loop
    v_tries := v_tries + 1;
    v_id := 'SUB-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));
    exit when not exists (
      select 1 from public.mil_submissions s where s.public_id = v_id
    );
    if v_tries > 20 then
      raise exception 'Unable to allocate submission public_id';
    end if;
  end loop;
  return v_id;
end;
$$;

revoke all on function public.mil_generate_submission_public_id() from public;

-- ---------------------------------------------------------------------------
-- 3. Submit raw / social package (upload ≠ submit)
-- ---------------------------------------------------------------------------
create or replace function public.mil_submit_content_package(
  p_submission_type text,
  p_asset_ids uuid[],
  p_title text default null,
  p_contributor_notes text default null,
  p_context_kind text default 'general',
  p_context_label text default null,
  p_caption text default null,
  p_cta text default null,
  p_hashtags text default null,
  p_platforms text[] default null,
  p_proposed_post_at timestamptz default null,
  p_idempotency_key text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_ids uuid[];
  v_asset public.mil_assets%rowtype;
  v_id uuid;
  v_public_id text;
  v_existing public.mil_submissions%rowtype;
  v_title text;
  v_context text;
  v_sort int := 0;
  v_aid uuid;
begin
  if v_uid is null then
    raise exception 'Authentication required';
  end if;
  if not (
    public.mil_is_creator()
    or public.mil_is_owner_admin()
  ) then
    raise exception 'Only contributors or owner/admin may submit content packages';
  end if;
  if p_submission_type not in ('raw_video', 'social_post') then
    raise exception 'submission_type must be raw_video or social_post';
  end if;

  v_context := coalesce(nullif(btrim(coalesce(p_context_kind, '')), ''), 'general');
  if v_context not in ('assignment', 'campaign', 'job', 'general', 'other') then
    raise exception 'Invalid context_kind';
  end if;

  -- Idempotent replay
  if nullif(btrim(coalesce(p_idempotency_key, '')), '') is not null then
    select * into v_existing
    from public.mil_submissions
    where contributor_user_id = v_uid
      and idempotency_key = btrim(p_idempotency_key);
    if found then
      return jsonb_build_object(
        'id', v_existing.id,
        'public_id', v_existing.public_id,
        'review_status', v_existing.review_status,
        'submission_type', v_existing.submission_type,
        'submitted_at', v_existing.submitted_at,
        'already_submitted', true
      );
    end if;
  end if;

  select array_agg(distinct x order by x)
  into v_ids
  from unnest(coalesce(p_asset_ids, '{}'::uuid[])) as x
  where x is not null;

  if v_ids is null or coalesce(cardinality(v_ids), 0) < 1 then
    raise exception 'At least one asset is required';
  end if;
  if p_submission_type = 'raw_video' and cardinality(v_ids) < 1 then
    raise exception 'Raw video requires at least one asset';
  end if;

  foreach v_aid in array v_ids loop
    select * into v_asset from public.mil_assets where id = v_aid for share;
    if not found then
      raise exception 'Asset not found: %', v_aid;
    end if;
    if v_asset.created_by_user_id is distinct from v_uid
       and not public.mil_is_owner_admin() then
      raise exception 'Cannot submit assets you did not upload';
    end if;
    if v_asset.trashed_at is not null or v_asset.archived_at is not null then
      raise exception 'Cannot submit archived or trashed assets';
    end if;
    if exists (
      select 1
      from public.mil_submission_assets sa
      join public.mil_submissions s on s.id = sa.submission_id
      where sa.asset_id = v_aid
        and s.review_status in ('awaiting_owner_review', 'changes_requested', 'approved', 'ready_to_post')
    ) then
      raise exception 'Asset already belongs to an active submission';
    end if;
    if p_submission_type = 'raw_video' and v_asset.media_kind is distinct from 'video' then
      raise exception 'Raw video submissions require video assets';
    end if;
  end loop;

  select a.original_filename into v_title
  from public.mil_assets a
  where a.id = v_ids[1];
  v_title := coalesce(nullif(btrim(coalesce(p_title, '')), ''), v_title, 'Untitled submission');

  v_public_id := public.mil_generate_submission_public_id();

  insert into public.mil_submissions (
    public_id,
    submission_type,
    review_status,
    action_owner,
    title,
    contributor_notes,
    context_kind,
    context_label,
    caption,
    cta,
    hashtags,
    platforms,
    proposed_post_at,
    contributor_user_id,
    latest_version_number,
    submitted_at,
    idempotency_key
  ) values (
    v_public_id,
    p_submission_type,
    'awaiting_owner_review',
    'owner',
    v_title,
    nullif(btrim(coalesce(p_contributor_notes, '')), ''),
    v_context,
    nullif(btrim(coalesce(p_context_label, '')), ''),
    nullif(btrim(coalesce(p_caption, '')), ''),
    nullif(btrim(coalesce(p_cta, '')), ''),
    nullif(btrim(coalesce(p_hashtags, '')), ''),
    coalesce(p_platforms, '{}'::text[]),
    p_proposed_post_at,
    v_uid,
    1,
    now(),
    nullif(btrim(coalesce(p_idempotency_key, '')), '')
  )
  returning id into v_id;

  foreach v_aid in array v_ids loop
    insert into public.mil_submission_assets (submission_id, asset_id, version_number, sort_order)
    values (v_id, v_aid, 1, v_sort);
    v_sort := v_sort + 1;
  end loop;

  perform public.mil_audit_insert(
    'content_submission',
    'mil_submissions',
    v_id,
    jsonb_build_object(
      'submission_type', p_submission_type,
      'public_id', v_public_id,
      'asset_ids', to_jsonb(v_ids),
      'context_kind', v_context
    )
  );

  return jsonb_build_object(
    'id', v_id,
    'public_id', v_public_id,
    'review_status', 'awaiting_owner_review',
    'submission_type', p_submission_type,
    'submitted_at', now(),
    'already_submitted', false
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- 4. Dual-write reel submit → mil_submissions
-- ---------------------------------------------------------------------------
create or replace function public.mil_submit_reel_version(p_version_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_version public.mil_reel_versions%rowtype;
  v_project public.mil_reel_projects%rowtype;
  v_sub public.mil_submissions%rowtype;
  v_public_id text;
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

  -- Idempotent: already submitted is a no-op success (ensure unified row exists)
  if v_version.status = 'submitted_for_review' then
    select * into v_sub
    from public.mil_submissions
    where reel_project_id = v_version.project_id
    order by created_at desc
    limit 1
    for update;
    if found then
      update public.mil_submissions
      set
        review_status = 'awaiting_owner_review',
        action_owner = 'owner',
        current_reel_version_id = p_version_id,
        submitted_at = coalesce(submitted_at, now()),
        updated_at = now()
      where id = v_sub.id;
      return;
    end if;
    -- Legacy submitted reel without mil_submissions row — create it below
    select * into v_project
    from public.mil_reel_projects
    where id = v_version.project_id;
    if not found then
      raise exception 'Reel project not found';
    end if;
    v_public_id := public.mil_generate_submission_public_id();
    insert into public.mil_submissions (
      public_id,
      submission_type,
      review_status,
      action_owner,
      title,
      contributor_notes,
      context_kind,
      reel_project_id,
      current_reel_version_id,
      contributor_user_id,
      latest_version_number,
      submitted_at
    ) values (
      v_public_id,
      'reel',
      'awaiting_owner_review',
      'owner',
      coalesce(nullif(btrim(coalesce(v_project.title, '')), ''), 'Untitled reel'),
      v_version.creator_notes,
      'general',
      v_project.id,
      p_version_id,
      v_project.creator_user_id,
      coalesce(v_version.version_number, 1),
      coalesce(v_version.submitted_at, now())
    );
    return;
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

  select * into v_sub
  from public.mil_submissions
  where reel_project_id = v_project.id
  order by created_at desc
  limit 1
  for update;

  if found then
    update public.mil_submissions
    set
      review_status = 'awaiting_owner_review',
      action_owner = 'owner',
      current_reel_version_id = p_version_id,
      latest_version_number = greatest(latest_version_number, coalesce(v_version.version_number, 1)),
      title = coalesce(nullif(btrim(coalesce(title, '')), ''), v_project.title),
      contributor_notes = coalesce(v_version.creator_notes, contributor_notes),
      submitted_at = coalesce(submitted_at, now()),
      updated_at = now()
    where id = v_sub.id;
  else
    v_public_id := public.mil_generate_submission_public_id();
    insert into public.mil_submissions (
      public_id,
      submission_type,
      review_status,
      action_owner,
      title,
      contributor_notes,
      context_kind,
      reel_project_id,
      current_reel_version_id,
      contributor_user_id,
      latest_version_number,
      submitted_at
    ) values (
      v_public_id,
      'reel',
      'awaiting_owner_review',
      'owner',
      coalesce(nullif(btrim(coalesce(v_project.title, '')), ''), 'Untitled reel'),
      v_version.creator_notes,
      'general',
      v_project.id,
      p_version_id,
      v_project.creator_user_id,
      coalesce(v_version.version_number, 1),
      now()
    );
  end if;

  perform public.mil_audit_insert(
    'reel_submission',
    'mil_reel_versions',
    p_version_id,
    '{}'::jsonb
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- 5. Sync reel review decisions onto mil_submissions
-- ---------------------------------------------------------------------------
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
  v_review_status text;
  v_action_owner text;
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

  v_review_status := case p_decision
    when 'approved' then 'ready_to_post'
    when 'denied' then 'rejected'
    else 'changes_requested'
  end;

  v_action_owner := case p_decision
    when 'revision_requested' then 'contributor'
    else 'owner'
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

  update public.mil_submissions
  set
    review_status = v_review_status,
    action_owner = v_action_owner,
    approved_reel_version_id = case
      when p_decision = 'approved' then p_version_id
      else approved_reel_version_id
    end,
    current_reel_version_id = p_version_id,
    updated_at = now()
  where reel_project_id = v_version.project_id;

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

-- ---------------------------------------------------------------------------
-- 6. Owner decisions for raw / social submissions
-- ---------------------------------------------------------------------------
create or replace function public.mil_review_content_submission(
  p_submission_id uuid,
  p_decision text,
  p_notes text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sub public.mil_submissions%rowtype;
  v_status text;
  v_action text;
  v_asset_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;
  if not public.mil_is_owner_admin() then
    raise exception 'Only owner/admin may review content submissions';
  end if;
  if p_decision not in ('approve', 'reject', 'request_changes', 'accept_into_library', 'restrict') then
    raise exception 'Invalid review decision';
  end if;

  select * into v_sub
  from public.mil_submissions
  where id = p_submission_id
  for update;

  if not found then
    raise exception 'Submission not found';
  end if;
  if v_sub.submission_type = 'reel' then
    raise exception 'Use reel review for reel submissions';
  end if;
  if v_sub.review_status <> 'awaiting_owner_review' then
    raise exception 'Submission is not awaiting owner review';
  end if;

  if p_decision in ('approve', 'accept_into_library') then
    v_status := 'approved';
    v_action := 'owner';
  elsif p_decision = 'reject' then
    v_status := 'rejected';
    v_action := 'owner';
  elsif p_decision = 'request_changes' then
    v_status := 'changes_requested';
    v_action := 'contributor';
  else
    -- restrict: keep awaiting but mark linked assets restricted
    v_status := 'awaiting_owner_review';
    v_action := 'owner';
  end if;

  update public.mil_submissions
  set
    review_status = v_status,
    action_owner = v_action,
    contributor_notes = case
      when nullif(btrim(coalesce(p_notes, '')), '') is null then contributor_notes
      else contributor_notes
    end,
    updated_at = now()
  where id = p_submission_id;

  if p_decision in ('approve', 'accept_into_library') then
    for v_asset_id in
      select sa.asset_id from public.mil_submission_assets sa where sa.submission_id = p_submission_id
    loop
      update public.mil_assets
      set human_review_status = 'verified', updated_at = now()
      where id = v_asset_id
        and human_review_status = 'pending';
    end loop;
  elsif p_decision = 'reject' then
    for v_asset_id in
      select sa.asset_id from public.mil_submission_assets sa where sa.submission_id = p_submission_id
    loop
      update public.mil_assets
      set human_review_status = 'rejected', updated_at = now()
      where id = v_asset_id
        and human_review_status = 'pending';
    end loop;
  elsif p_decision = 'restrict' then
    for v_asset_id in
      select sa.asset_id from public.mil_submission_assets sa where sa.submission_id = p_submission_id
    loop
      update public.mil_assets
      set privacy_status = 'restricted', updated_at = now()
      where id = v_asset_id;
    end loop;
  end if;

  perform public.mil_audit_insert(
    'content_review_' || p_decision,
    'mil_submissions',
    p_submission_id,
    jsonb_build_object(
      'decision', p_decision,
      'notes', nullif(btrim(coalesce(p_notes, '')), ''),
      'review_status', v_status
    )
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- 7. RLS + grants
-- ---------------------------------------------------------------------------
alter table public.mil_submissions enable row level security;
alter table public.mil_submission_assets enable row level security;

drop policy if exists mil_browse_submissions on public.mil_submissions;
create policy mil_browse_submissions on public.mil_submissions
  for select to authenticated
  using (
    public.mil_can_browse_library()
    or (
      public.mil_is_creator()
      and contributor_user_id = auth.uid()
    )
  );

drop policy if exists mil_browse_submission_assets on public.mil_submission_assets;
create policy mil_browse_submission_assets on public.mil_submission_assets
  for select to authenticated
  using (
    exists (
      select 1
      from public.mil_submissions s
      where s.id = submission_id
        and (
          public.mil_can_browse_library()
          or (
            public.mil_is_creator()
            and s.contributor_user_id = auth.uid()
          )
        )
    )
  );

-- No direct client writes — SECURITY DEFINER RPCs only
revoke all on table public.mil_submissions from public, anon, authenticated;
revoke all on table public.mil_submission_assets from public, anon, authenticated;
grant select on public.mil_submissions to authenticated;
grant select on public.mil_submission_assets to authenticated;
grant select, insert, update, delete on public.mil_submissions to service_role;
grant select, insert, update, delete on public.mil_submission_assets to service_role;

revoke all on function public.mil_submit_content_package(
  text, uuid[], text, text, text, text, text, text, text, text[], timestamptz, text
) from public;
revoke all on function public.mil_review_content_submission(uuid, text, text) from public;
revoke all on function public.mil_submit_reel_version(uuid) from public;
revoke all on function public.mil_review_reel_version(uuid, text, text) from public;

grant execute on function public.mil_submit_content_package(
  text, uuid[], text, text, text, text, text, text, text, text[], timestamptz, text
) to authenticated;
grant execute on function public.mil_review_content_submission(uuid, text, text) to authenticated;
grant execute on function public.mil_submit_reel_version(uuid) to authenticated;
grant execute on function public.mil_review_reel_version(uuid, text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- 8. Deterministic backfill (idempotent)
--    - Existing submitted reels → mil_submissions
--    - Existing contributor_self pending assets → raw_video / photo as raw package
--      (old product treated finalize as deliberate owner handoff)
-- ---------------------------------------------------------------------------
insert into public.mil_submissions (
  public_id,
  submission_type,
  review_status,
  action_owner,
  title,
  contributor_notes,
  context_kind,
  reel_project_id,
  current_reel_version_id,
  contributor_user_id,
  latest_version_number,
  submitted_at,
  created_at,
  updated_at
)
select
  public.mil_generate_submission_public_id(),
  'reel',
  'awaiting_owner_review',
  'owner',
  coalesce(nullif(btrim(p.title), ''), 'Untitled reel'),
  v.creator_notes,
  'general',
  p.id,
  v.id,
  p.creator_user_id,
  coalesce(v.version_number, 1),
  coalesce(v.submitted_at, v.created_at, now()),
  coalesce(v.submitted_at, v.created_at, now()),
  now()
from public.mil_reel_versions v
join public.mil_reel_projects p on p.id = v.project_id
where v.status = 'submitted_for_review'
  and not exists (
    select 1 from public.mil_submissions s where s.reel_project_id = p.id
  );

-- One submission per contributor_self pending asset that is not already linked.
-- Uses a loop so each asset gets a stable submission_id without fragile joins.
do $$
declare
  r record;
  v_sub_id uuid;
begin
  for r in
    select
      a.id as asset_id,
      a.media_kind,
      a.original_filename,
      a.created_at,
      coalesce(a.created_by_user_id, b.uploader_user_id) as contributor_user_id
    from public.mil_assets a
    join public.mil_upload_batches b on b.id = a.batch_id
    where b.source_label = 'contributor_self'
      and a.human_review_status = 'pending'
      and a.archived_at is null
      and a.trashed_at is null
      and coalesce(a.created_by_user_id, b.uploader_user_id) is not null
      and not exists (
        select 1 from public.mil_submission_assets sa where sa.asset_id = a.id
      )
  loop
    insert into public.mil_submissions (
      public_id,
      submission_type,
      review_status,
      action_owner,
      title,
      context_kind,
      contributor_user_id,
      latest_version_number,
      submitted_at,
      created_at,
      updated_at
    ) values (
      public.mil_generate_submission_public_id(),
      case when r.media_kind = 'video' then 'raw_video' else 'social_post' end,
      'awaiting_owner_review',
      'owner',
      coalesce(nullif(btrim(r.original_filename), ''), 'Contributor upload'),
      'general',
      r.contributor_user_id,
      1,
      coalesce(r.created_at, now()),
      coalesce(r.created_at, now()),
      now()
    )
    returning id into v_sub_id;

    insert into public.mil_submission_assets (submission_id, asset_id, version_number, sort_order)
    values (v_sub_id, r.asset_id, 1, 0);
  end loop;
end;
$$;

commit;

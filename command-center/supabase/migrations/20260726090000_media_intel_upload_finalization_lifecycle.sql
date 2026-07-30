-- Media Intelligence Library — phone upload finalization lifecycle (single-company).
--
-- Problem this migration exists to solve: the previous one-shot
-- `mil_finalize_upload_grant` wrote the asset row and THEN asked storage to place
-- the bytes. Any failure after the DB write produced a library row whose original
-- object did not exist, and any failure before it produced stored bytes with no
-- row. Neither state was detectable, so the UI could report "uploaded" for media
-- that was not actually in the library.
--
-- The lifecycle below makes every intermediate state explicit and durable:
--   minted -> placing -> placed -> committed | duplicate | failed | abandoned
-- An asset row is only created after the final object is proven visible in the
-- storage catalog inside the same transaction as the insert.
--
-- Additive only: no destructive rewrite of existing MIL data. Two obsolete
-- functions are dropped after all call sites were updated in this same change.
-- No tenant_id / organization_id. Single company.

begin;

-- ---------------------------------------------------------------------------
-- 0. Pre-flight assertions
--    These fail loudly rather than silently skipping a constraint. An operator
--    who sees them knows exactly which rows must be reconciled before apply.
-- ---------------------------------------------------------------------------
do $$
declare
  v_bad integer;
begin
  select count(*) into v_bad
  from public.mil_upload_grants g
  where g.object_path is distinct from
    ('mil/quarantine/' || g.batch_id::text || '/' || g.asset_id::text || '/' || g.original_filename);

  if v_bad > 0 then
    raise exception
      'Cannot enforce canonical quarantine paths: % mil_upload_grants row(s) are not mil/quarantine/{batch}/{asset}/{filename}. Reconcile them before applying this migration.',
      v_bad;
  end if;
end $$;

do $$
declare
  v_dupes integer;
begin
  select count(*) into v_dupes
  from (
    select checksum_sha256
    from public.mil_assets
    where archived_at is null
    group by checksum_sha256
    having count(*) > 1
  ) d;

  if v_dupes > 0 then
    raise exception
      'Cannot create mil_assets_active_checksum_uniq: % checksum group(s) already have more than one active asset. Archive the redundant copies before applying this migration.',
      v_dupes;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 1. Immutable path / mime helpers
--    Used by both CHECK constraints and PL/pgSQL so the canonical form has
--    exactly one definition. Paths are CONSTRUCTED, never derived by replace()
--    on an attacker-influenced string.
-- ---------------------------------------------------------------------------
create or replace function public.mil_quarantine_object_path(
  p_batch_id uuid,
  p_asset_id uuid,
  p_filename text
)
returns text
language sql
immutable
as $$
  select 'mil/quarantine/' || p_batch_id::text || '/' || p_asset_id::text || '/' || p_filename;
$$;

create or replace function public.mil_original_object_path(
  p_batch_id uuid,
  p_asset_id uuid,
  p_filename text
)
returns text
language sql
immutable
as $$
  select 'mil/originals/' || p_batch_id::text || '/' || p_asset_id::text || '/' || p_filename;
$$;

comment on function public.mil_original_object_path(uuid, uuid, text) is
  'Canonical final original path. Constructed from bound grant columns — never derived by string replacement on a client-supplied path.';

create or replace function public.mil_normalize_media_mime(p_mime text)
returns text
language sql
immutable
as $$
  select case lower(btrim(coalesce(p_mime, '')))
    when 'image/jpg' then 'image/jpeg'
    else lower(btrim(coalesce(p_mime, '')))
  end;
$$;

create or replace function public.mil_media_mime_allowed(p_mime text)
returns boolean
language sql
immutable
as $$
  select public.mil_normalize_media_mime(p_mime) in (
    'image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif', 'image/gif',
    'video/mp4', 'video/quicktime', 'video/webm', 'video/x-m4v'
  );
$$;

-- ---------------------------------------------------------------------------
-- 2. Batch abandoned counter
-- ---------------------------------------------------------------------------
alter table public.mil_upload_batches
  add column if not exists abandoned_count integer not null default 0;

comment on column public.mil_upload_batches.abandoned_count is
  'Grants that expired without ever committing. Counted separately from failed_count so an unattended phone is not reported as a server failure.';

-- ---------------------------------------------------------------------------
-- 3. Grant finalization columns
-- ---------------------------------------------------------------------------
alter table public.mil_upload_grants
  add column if not exists finalize_state text not null default 'minted',
  add column if not exists finalize_reason text,
  add column if not exists verified_sha256 text,
  add column if not exists verified_mime text,
  add column if not exists verified_bytes bigint,
  add column if not exists final_object_path text,
  add column if not exists canonical_asset_id uuid,
  add column if not exists finalize_attempts integer not null default 0,
  add column if not exists finalize_lease_owner text,
  add column if not exists finalize_lease_expires_at timestamptz,
  add column if not exists commit_deadline_at timestamptz,
  add column if not exists upload_token_expires_at timestamptz,
  add column if not exists quarantine_cleanup_after timestamptz,
  add column if not exists quarantine_cleaned_at timestamptz;

-- Backfill: rows minted under the old one-shot finalize must not all appear as
-- 'minted'. A grant that completed and owns an asset row is committed; one that
-- completed without its own asset was a duplicate; a revoked incomplete grant is
-- abandoned. Anything else stays 'minted' and the sweep will classify it.
update public.mil_upload_grants g
set
  finalize_state = 'committed',
  canonical_asset_id = a.id,
  verified_sha256 = a.checksum_sha256,
  verified_mime = a.mime_type,
  verified_bytes = a.byte_size,
  final_object_path = a.original_path
from public.mil_assets a
where a.id = g.asset_id
  and g.completed_at is not null
  and g.finalize_state = 'minted';

update public.mil_upload_grants
set finalize_state = 'duplicate'
where completed_at is not null
  and finalize_state = 'minted';

update public.mil_upload_grants
set finalize_state = 'abandoned',
    finalize_reason = 'revoked_before_lifecycle_migration'
where completed_at is null
  and revoked_at is not null
  and finalize_state = 'minted';

alter table public.mil_upload_grants
  drop constraint if exists mil_upload_grants_finalize_state_check;

alter table public.mil_upload_grants
  add constraint mil_upload_grants_finalize_state_check
  check (finalize_state in ('minted', 'placing', 'placed', 'committed', 'duplicate', 'failed', 'abandoned'));

alter table public.mil_upload_grants
  drop constraint if exists mil_upload_grants_quarantine_path_check;

alter table public.mil_upload_grants
  add constraint mil_upload_grants_quarantine_path_check
  check (object_path = public.mil_quarantine_object_path(batch_id, asset_id, original_filename));

alter table public.mil_upload_grants
  drop constraint if exists mil_upload_grants_final_path_check;

alter table public.mil_upload_grants
  add constraint mil_upload_grants_final_path_check
  check (
    final_object_path is null
    or final_object_path = public.mil_original_object_path(batch_id, asset_id, original_filename)
  );

alter table public.mil_upload_grants
  drop constraint if exists mil_upload_grants_verified_sha_check;

alter table public.mil_upload_grants
  add constraint mil_upload_grants_verified_sha_check
  check (verified_sha256 is null or verified_sha256 ~ '^[a-f0-9]{64}$');

alter table public.mil_upload_grants
  drop constraint if exists mil_upload_grants_committed_requires_proof;

-- A committed grant must carry the evidence that justified the commit.
alter table public.mil_upload_grants
  add constraint mil_upload_grants_committed_requires_proof
  check (
    finalize_state <> 'committed'
    or (
      verified_sha256 is not null
      and verified_bytes is not null
      and verified_mime is not null
      and final_object_path is not null
      and canonical_asset_id is not null
    )
  );

create index if not exists mil_upload_grants_finalize_state_idx
  on public.mil_upload_grants (finalize_state, finalize_lease_expires_at);

create index if not exists mil_upload_grants_cleanup_idx
  on public.mil_upload_grants (quarantine_cleanup_after)
  where quarantine_cleaned_at is null;

create index if not exists mil_upload_grants_batch_idx
  on public.mil_upload_grants (batch_id, finalize_state);

comment on column public.mil_upload_grants.finalize_state is
  'minted -> placing -> placed -> committed|duplicate, or failed|abandoned. Only committed/duplicate are success states.';
comment on column public.mil_upload_grants.finalize_lease_owner is
  'Time-based lease holder. Prevents two workers finalizing one grant without holding a DB transaction open across storage I/O.';
comment on column public.mil_upload_grants.commit_deadline_at is
  'After this instant an unfinished grant is eligible for abandonment by the reconcile sweep.';
comment on column public.mil_upload_grants.upload_token_expires_at is
  'exp of the signed upload token issued at mint. Quarantine bytes are never deleted before this passes, so a slow client cannot lose an in-flight upload.';

-- ---------------------------------------------------------------------------
-- 4. Manifest entries bound to their grant (one row per grant)
-- ---------------------------------------------------------------------------
alter table public.mil_manifest_entries
  add column if not exists grant_id uuid references public.mil_upload_grants(id) on delete set null;

create unique index if not exists mil_manifest_entries_grant_uniq
  on public.mil_manifest_entries (grant_id)
  where grant_id is not null;

comment on column public.mil_manifest_entries.grant_id is
  'Binds the manifest line to the upload grant so retries update one row instead of inflating the manifest.';

-- ---------------------------------------------------------------------------
-- 5. One active asset per checksum
-- ---------------------------------------------------------------------------
create unique index if not exists mil_assets_active_checksum_uniq
  on public.mil_assets (checksum_sha256)
  where archived_at is null;

comment on index public.mil_assets_active_checksum_uniq is
  'Duplicate detection is advisory in the edge; this index is the actual guarantee that two active assets never share bytes.';

-- ---------------------------------------------------------------------------
-- 6. Integrity alerts (owner/admin visible, never client writable)
-- ---------------------------------------------------------------------------
create table if not exists public.mil_integrity_alerts (
  id uuid primary key default gen_random_uuid(),
  alert_key text not null,
  severity text not null default 'critical'
    check (severity in ('info', 'warning', 'critical')),
  grant_id uuid references public.mil_upload_grants(id) on delete set null,
  batch_id uuid references public.mil_upload_batches(id) on delete set null,
  asset_id uuid,
  bucket text,
  object_path text,
  details jsonb not null default '{}'::jsonb,
  acknowledged_at timestamptz,
  acknowledged_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists mil_integrity_alerts_open_idx
  on public.mil_integrity_alerts (created_at desc)
  where acknowledged_at is null;

create index if not exists mil_integrity_alerts_grant_idx
  on public.mil_integrity_alerts (grant_id);

comment on table public.mil_integrity_alerts is
  'Storage/DB divergence that a human must look at: bytes present with no row, row with no bytes, checksum drift, catalog mismatch.';

alter table public.mil_integrity_alerts enable row level security;

drop policy if exists mil_integrity_alerts_owner_select on public.mil_integrity_alerts;

create policy mil_integrity_alerts_owner_select on public.mil_integrity_alerts
  for select to authenticated
  using (public.mil_is_owner_admin());

-- ---------------------------------------------------------------------------
-- 7. Privilege hardening — the upload lifecycle is service_role only
--    RLS policies alone were not enough: the tables still carried the default
--    authenticated INSERT/UPDATE/DELETE grants, so a signed-in browser could
--    fabricate manifests, counters and asset rows.
-- ---------------------------------------------------------------------------
drop policy if exists mil_library_staff_write_upload_batches on public.mil_upload_batches;
drop policy if exists mil_library_staff_update_upload_batches on public.mil_upload_batches;

revoke insert, update, delete on public.mil_upload_batches from authenticated, anon;
revoke insert, update, delete on public.mil_upload_grants from authenticated, anon;
revoke insert, update, delete on public.mil_manifest_entries from authenticated, anon;
revoke insert, update, delete on public.mil_upload_sessions from authenticated, anon;
revoke insert, update, delete on public.mil_integrity_alerts from authenticated, anon;

-- mil_assets keeps UPDATE so the reviewer policy still works; creation and
-- deletion of library rows belong to the finalization RPCs only.
revoke insert, delete on public.mil_assets from authenticated, anon;

-- State the surviving privileges explicitly instead of inheriting whatever the
-- environment's default privileges happened to be. Local disposable stacks and
-- the hosted project do not start from the same table ACL, and "browse still
-- works" must not depend on that difference.
grant select on public.mil_upload_batches to authenticated;
grant select on public.mil_upload_grants to authenticated;
grant select on public.mil_manifest_entries to authenticated;
grant select on public.mil_upload_sessions to authenticated;
grant select on public.mil_integrity_alerts to authenticated;
grant select, update on public.mil_assets to authenticated;

-- The edge functions read these tables directly (not only through the definer
-- RPCs), so the service role needs its own table privileges.
grant select, insert, update, delete on public.mil_upload_batches to service_role;
grant select, insert, update, delete on public.mil_upload_grants to service_role;
grant select, insert, update, delete on public.mil_manifest_entries to service_role;
grant select, insert, update, delete on public.mil_upload_sessions to service_role;
grant select, insert, update, delete on public.mil_integrity_alerts to service_role;
grant select, insert, update, delete on public.mil_assets to service_role;

comment on table public.mil_upload_batches is
  'Upload batches are created and counted by the server only. Browser clients have SELECT and nothing else.';

-- ---------------------------------------------------------------------------
-- 8. Integrity alert writer
-- ---------------------------------------------------------------------------
create or replace function public.mil_raise_integrity_alert(
  p_alert_key text,
  p_severity text default 'critical',
  p_grant_id uuid default null,
  p_batch_id uuid default null,
  p_asset_id uuid default null,
  p_bucket text default null,
  p_object_path text default null,
  p_details jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_severity text;
begin
  v_severity := lower(btrim(coalesce(p_severity, 'critical')));
  if v_severity not in ('info', 'warning', 'critical') then
    v_severity := 'critical';
  end if;

  insert into public.mil_integrity_alerts (
    alert_key, severity, grant_id, batch_id, asset_id, bucket, object_path, details
  )
  values (
    p_alert_key, v_severity, p_grant_id, p_batch_id, p_asset_id, p_bucket, p_object_path,
    coalesce(p_details, '{}'::jsonb)
  )
  returning id into v_id;

  insert into public.mil_audit_events (actor_user_id, action, target_type, target_id, details)
  values (
    null,
    'mil_integrity_alert',
    'mil_integrity_alerts',
    v_id,
    jsonb_build_object('alert_key', p_alert_key, 'severity', v_severity, 'grant_id', p_grant_id)
      || coalesce(p_details, '{}'::jsonb)
  );

  return v_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- 9. Storage catalog probe
--    Reads storage.objects directly. When the catalog is not reachable the
--    probe reports that honestly instead of returning "absent", so callers
--    never treat an unavailable catalog as proof of anything.
-- ---------------------------------------------------------------------------
create or replace function public.mil_storage_catalog_probe(
  p_bucket text,
  p_object_path text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row record;
  v_found boolean := false;
begin
  if to_regclass('storage.objects') is null then
    return jsonb_build_object(
      'catalog_available', false,
      'present', false,
      'reason', 'storage_catalog_unavailable',
      'checked_at', now()
    );
  end if;

  for v_row in
    execute
      'select metadata from storage.objects where bucket_id = $1 and name = $2 limit 1'
      using p_bucket, p_object_path
  loop
    v_found := true;
    return jsonb_build_object(
      'catalog_available', true,
      'present', true,
      'bucket', p_bucket,
      'object_path', p_object_path,
      'bytes', coalesce(
        nullif(v_row.metadata->>'size', '')::bigint,
        nullif(v_row.metadata->>'contentLength', '')::bigint
      ),
      'mime', coalesce(
        nullif(v_row.metadata->>'mimetype', ''),
        nullif(v_row.metadata->>'contentType', '')
      ),
      'checked_at', now()
    );
  end loop;

  return jsonb_build_object(
    'catalog_available', true,
    'present', v_found,
    'bucket', p_bucket,
    'object_path', p_object_path,
    'checked_at', now()
  );
end;
$$;

comment on function public.mil_storage_catalog_probe(text, text) is
  'Presence/size/mime of a storage object as the database sees it. Proves catalog visibility; does NOT re-hash bytes.';

-- ---------------------------------------------------------------------------
-- 10. Absolute batch recount
--     Derived from grant states, never incremented. An interrupted worker can
--     therefore not leave a counter permanently wrong.
-- ---------------------------------------------------------------------------
create or replace function public.mil_recount_upload_batch(p_batch_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_batch public.mil_upload_batches%rowtype;
  v_total integer := 0;
  v_pending integer := 0;
  v_success integer := 0;
  v_duplicate integer := 0;
  v_failed integer := 0;
  v_abandoned integer := 0;
  v_skipped integer := 0;
  v_session_open boolean := false;
  v_status text;
  v_completed_at timestamptz;
begin
  if p_batch_id is null then
    return jsonb_build_object('ok', false, 'error', 'batch_id_required');
  end if;

  select * into v_batch
  from public.mil_upload_batches
  where id = p_batch_id
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'batch_not_found');
  end if;

  select
    count(*),
    count(*) filter (where finalize_state in ('minted', 'placing', 'placed')),
    count(*) filter (where finalize_state = 'committed'),
    count(*) filter (where finalize_state = 'duplicate'),
    count(*) filter (where finalize_state = 'failed'),
    count(*) filter (where finalize_state = 'abandoned')
  into v_total, v_pending, v_success, v_duplicate, v_failed, v_abandoned
  from public.mil_upload_grants
  where batch_id = p_batch_id;

  -- Skips never reach a grant (the file is rejected client-side before mint),
  -- so they are counted from the manifest rather than from grant states.
  select count(*) into v_skipped
  from public.mil_manifest_entries
  where batch_id = p_batch_id
    and upload_status = 'skipped';

  select exists (
    select 1
    from public.mil_upload_sessions s
    where s.batch_id = p_batch_id
      and s.revoked_at is null
      and s.expires_at > now()
  ) into v_session_open;

  if v_batch.status = 'cancelled' then
    v_status := 'cancelled';
  elsif v_total = 0 then
    v_status := 'open';
  elsif v_pending > 0 then
    v_status := 'uploading';
  elsif (v_failed + v_abandoned) > 0 then
    v_status := 'interrupted';
  elsif v_session_open then
    -- Nothing in flight, but the link is still live and may accept more files.
    v_status := 'uploading';
  else
    v_status := 'completed';
  end if;

  v_completed_at := case
    when v_status = 'completed' then coalesce(v_batch.completed_at, now())
    else null
  end;

  update public.mil_upload_batches
  set
    success_count = v_success,
    duplicate_count = v_duplicate,
    failed_count = v_failed,
    abandoned_count = v_abandoned,
    skipped_count = v_skipped,
    status = v_status,
    completed_at = v_completed_at,
    updated_at = now()
  where id = p_batch_id;

  return jsonb_build_object(
    'ok', true,
    'batch_id', p_batch_id,
    'status', v_status,
    'total_grants', v_total,
    'pending', v_pending,
    'success_count', v_success,
    'duplicate_count', v_duplicate,
    'failed_count', v_failed,
    'abandoned_count', v_abandoned,
    'skipped_count', v_skipped
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- 11. Begin finalize — acquire a time-based lease
-- ---------------------------------------------------------------------------
create or replace function public.mil_begin_upload_finalize(
  p_grant_id uuid,
  p_lease_owner text,
  p_lease_seconds integer default 120,
  p_commit_seconds integer default 900
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_grant public.mil_upload_grants%rowtype;
  v_session public.mil_upload_sessions%rowtype;
  v_lease_seconds integer;
  v_commit_seconds integer;
  v_next_state text;
begin
  if p_lease_owner is null or btrim(p_lease_owner) = '' then
    return jsonb_build_object('ok', false, 'status', 'lease_owner_required');
  end if;

  v_lease_seconds := greatest(least(coalesce(p_lease_seconds, 120), 900), 15);
  v_commit_seconds := greatest(least(coalesce(p_commit_seconds, 900), 86400), 60);

  select * into v_grant
  from public.mil_upload_grants
  where id = p_grant_id
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'status', 'grant_not_found');
  end if;

  -- Terminal success states short-circuit: a retry must never create a second asset.
  if v_grant.finalize_state = 'committed' then
    return jsonb_build_object(
      'ok', true, 'status', 'already_committed',
      'grant_id', v_grant.id, 'asset_id', v_grant.canonical_asset_id,
      'batch_id', v_grant.batch_id
    );
  end if;

  if v_grant.finalize_state = 'duplicate' then
    return jsonb_build_object(
      'ok', true, 'status', 'already_duplicate',
      'grant_id', v_grant.id, 'existing_asset_id', v_grant.canonical_asset_id,
      'batch_id', v_grant.batch_id
    );
  end if;

  if v_grant.finalize_state = 'abandoned' then
    return jsonb_build_object('ok', false, 'status', 'abandoned', 'grant_id', v_grant.id);
  end if;

  if v_grant.revoked_at is not null then
    return jsonb_build_object('ok', false, 'status', 'revoked', 'grant_id', v_grant.id);
  end if;

  if v_grant.expires_at <= now() then
    return jsonb_build_object('ok', false, 'status', 'expired', 'grant_id', v_grant.id);
  end if;

  select * into v_session
  from public.mil_upload_sessions
  where id = v_grant.session_id;

  if not found then
    return jsonb_build_object('ok', false, 'status', 'session_not_found');
  end if;
  if v_session.revoked_at is not null then
    return jsonb_build_object('ok', false, 'status', 'revoked', 'grant_id', v_grant.id);
  end if;
  if v_session.expires_at <= now() then
    return jsonb_build_object('ok', false, 'status', 'expired', 'grant_id', v_grant.id);
  end if;

  -- Another worker holds an unexpired lease. Report it; do not steal the grant.
  if v_grant.finalize_lease_expires_at is not null
     and v_grant.finalize_lease_expires_at > now()
     and v_grant.finalize_lease_owner is distinct from p_lease_owner then
    return jsonb_build_object(
      'ok', false, 'status', 'lease_held',
      'grant_id', v_grant.id,
      'lease_expires_at', v_grant.finalize_lease_expires_at
    );
  end if;

  v_next_state := case
    when v_grant.finalize_state = 'placed' then 'placed'
    else 'placing'
  end;

  update public.mil_upload_grants
  set
    finalize_state = v_next_state,
    finalize_attempts = finalize_attempts + 1,
    finalize_lease_owner = p_lease_owner,
    finalize_lease_expires_at = now() + make_interval(secs => v_lease_seconds),
    commit_deadline_at = coalesce(commit_deadline_at, now() + make_interval(secs => v_commit_seconds)),
    finalize_reason = case when finalize_state = 'failed' then null else finalize_reason end
  where id = p_grant_id
  returning * into v_grant;

  perform public.mil_recount_upload_batch(v_grant.batch_id);

  return jsonb_build_object(
    'ok', true,
    'status', case when v_grant.finalize_state = 'placed' then 'resume_placed' else 'begin' end,
    'grant_id', v_grant.id,
    'finalize_state', v_grant.finalize_state,
    'finalize_attempts', v_grant.finalize_attempts,
    'session_id', v_grant.session_id,
    'batch_id', v_grant.batch_id,
    'asset_id', v_grant.asset_id,
    'bucket', v_grant.bucket,
    'object_path', v_grant.object_path,
    'content_type', v_grant.content_type,
    'max_bytes', v_grant.max_bytes,
    'original_filename', v_grant.original_filename,
    'final_object_path', public.mil_original_object_path(v_grant.batch_id, v_grant.asset_id, v_grant.original_filename),
    'prior_verified_sha256', v_grant.verified_sha256,
    'prior_verified_bytes', v_grant.verified_bytes,
    'lease_owner', v_grant.finalize_lease_owner,
    'lease_expires_at', v_grant.finalize_lease_expires_at,
    'commit_deadline_at', v_grant.commit_deadline_at,
    'upload_token_expires_at', v_grant.upload_token_expires_at
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- 12. Mark placed — bytes are at the canonical final path and were re-hashed
-- ---------------------------------------------------------------------------
create or replace function public.mil_mark_upload_placed(
  p_grant_id uuid,
  p_lease_owner text,
  p_final_object_path text,
  p_verified_sha256 text,
  p_verified_mime text,
  p_verified_bytes bigint,
  p_lease_seconds integer default 120
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_grant public.mil_upload_grants%rowtype;
  v_expected_path text;
  v_mime text;
  v_lease_seconds integer;
begin
  v_lease_seconds := greatest(least(coalesce(p_lease_seconds, 120), 900), 15);

  select * into v_grant
  from public.mil_upload_grants
  where id = p_grant_id
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'status', 'grant_not_found');
  end if;

  if v_grant.finalize_lease_owner is distinct from p_lease_owner
     or v_grant.finalize_lease_expires_at is null
     or v_grant.finalize_lease_expires_at <= now() then
    return jsonb_build_object('ok', false, 'status', 'lease_lost', 'grant_id', p_grant_id);
  end if;

  if v_grant.finalize_state <> 'placing' then
    return jsonb_build_object(
      'ok', false, 'status', 'unexpected_state',
      'finalize_state', v_grant.finalize_state
    );
  end if;

  v_expected_path := public.mil_original_object_path(
    v_grant.batch_id, v_grant.asset_id, v_grant.original_filename
  );
  if p_final_object_path is distinct from v_expected_path then
    perform public.mil_raise_integrity_alert(
      'final_path_not_canonical', 'critical', v_grant.id, v_grant.batch_id, v_grant.asset_id,
      v_grant.bucket, p_final_object_path,
      jsonb_build_object('expected', v_expected_path)
    );
    return jsonb_build_object('ok', false, 'status', 'path_not_canonical', 'expected', v_expected_path);
  end if;

  if p_verified_sha256 is null or lower(p_verified_sha256) !~ '^[a-f0-9]{64}$' then
    return jsonb_build_object('ok', false, 'status', 'invalid_checksum');
  end if;

  v_mime := public.mil_normalize_media_mime(p_verified_mime);
  if not public.mil_media_mime_allowed(v_mime) then
    return jsonb_build_object('ok', false, 'status', 'mime_not_allowed', 'mime', v_mime);
  end if;
  if v_mime <> public.mil_normalize_media_mime(v_grant.content_type) then
    return jsonb_build_object('ok', false, 'status', 'mime_mismatch', 'mime', v_mime);
  end if;

  if p_verified_bytes is null or p_verified_bytes <= 0 or p_verified_bytes > v_grant.max_bytes then
    return jsonb_build_object('ok', false, 'status', 'invalid_bytes');
  end if;

  -- Bytes changed between two finalize attempts: the object under the grant is
  -- not the object we already verified. Never silently accept the new bytes.
  if v_grant.verified_sha256 is not null and v_grant.verified_sha256 <> lower(p_verified_sha256) then
    perform public.mil_raise_integrity_alert(
      'quarantine_bytes_changed', 'critical', v_grant.id, v_grant.batch_id, v_grant.asset_id,
      v_grant.bucket, v_grant.object_path,
      jsonb_build_object('previous_sha256', v_grant.verified_sha256, 'new_sha256', lower(p_verified_sha256))
    );
    return jsonb_build_object('ok', false, 'status', 'bytes_changed');
  end if;

  update public.mil_upload_grants
  set
    finalize_state = 'placed',
    final_object_path = v_expected_path,
    verified_sha256 = lower(p_verified_sha256),
    verified_mime = v_mime,
    verified_bytes = p_verified_bytes,
    finalize_lease_expires_at = now() + make_interval(secs => v_lease_seconds)
  where id = p_grant_id
  returning * into v_grant;

  return jsonb_build_object(
    'ok', true,
    'status', 'placed',
    'grant_id', v_grant.id,
    'final_object_path', v_grant.final_object_path,
    'lease_expires_at', v_grant.finalize_lease_expires_at
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- 13. Commit — the only place an mil_assets row is born
--     Catalog visibility is proven inside this transaction. If storage cannot
--     confirm the object, no asset row is created and the caller is told so.
-- ---------------------------------------------------------------------------
create or replace function public.mil_commit_upload_finalize(
  p_grant_id uuid,
  p_lease_owner text,
  p_outcome text default 'placed',
  p_catalog_present boolean default null,
  p_catalog_bytes bigint default null,
  p_catalog_mime text default null,
  p_duplicate_asset_id uuid default null,
  p_verified_sha256 text default null,
  p_verified_mime text default null,
  p_verified_bytes bigint default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_grant public.mil_upload_grants%rowtype;
  v_session public.mil_upload_sessions%rowtype;
  v_probe jsonb;
  v_catalog_bytes bigint;
  v_catalog_mime text;
  v_media_kind text;
  v_manifest_id uuid;
  v_cleanup_after timestamptz;
  v_dupe_checksum text;
  v_dupe_mime text;
  v_dupe_bytes bigint;
begin
  if p_outcome not in ('placed', 'duplicate') then
    return jsonb_build_object('ok', false, 'status', 'invalid_outcome');
  end if;

  select * into v_grant
  from public.mil_upload_grants
  where id = p_grant_id
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'status', 'grant_not_found');
  end if;

  if v_grant.finalize_state = 'committed' then
    return jsonb_build_object(
      'ok', true, 'status', 'already_committed',
      'grant_id', v_grant.id, 'asset_id', v_grant.canonical_asset_id, 'batch_id', v_grant.batch_id
    );
  end if;
  if v_grant.finalize_state = 'duplicate' then
    return jsonb_build_object(
      'ok', true, 'status', 'already_duplicate',
      'grant_id', v_grant.id, 'existing_asset_id', v_grant.canonical_asset_id, 'batch_id', v_grant.batch_id
    );
  end if;

  if v_grant.finalize_lease_owner is distinct from p_lease_owner
     or v_grant.finalize_lease_expires_at is null
     or v_grant.finalize_lease_expires_at <= now() then
    return jsonb_build_object('ok', false, 'status', 'lease_lost', 'grant_id', p_grant_id);
  end if;

  select * into v_session
  from public.mil_upload_sessions
  where id = v_grant.session_id;
  if not found then
    return jsonb_build_object('ok', false, 'status', 'session_not_found');
  end if;

  v_cleanup_after := coalesce(v_grant.upload_token_expires_at, v_grant.expires_at, now())
    + interval '15 minutes';

  -- ---------------------------------------------------------------- duplicate
  if p_outcome = 'duplicate' then
    if v_grant.finalize_state <> 'placing' then
      return jsonb_build_object(
        'ok', false, 'status', 'unexpected_state', 'finalize_state', v_grant.finalize_state
      );
    end if;
    if p_duplicate_asset_id is null then
      return jsonb_build_object('ok', false, 'status', 'duplicate_asset_id_required');
    end if;

    v_dupe_checksum := lower(coalesce(p_verified_sha256, ''));
    if v_dupe_checksum !~ '^[a-f0-9]{64}$' then
      return jsonb_build_object('ok', false, 'status', 'invalid_checksum');
    end if;
    v_dupe_mime := public.mil_normalize_media_mime(p_verified_mime);
    if not public.mil_media_mime_allowed(v_dupe_mime) then
      return jsonb_build_object('ok', false, 'status', 'mime_not_allowed');
    end if;
    v_dupe_bytes := p_verified_bytes;
    if v_dupe_bytes is null or v_dupe_bytes <= 0 or v_dupe_bytes > v_grant.max_bytes then
      return jsonb_build_object('ok', false, 'status', 'invalid_bytes');
    end if;

    -- The claimed duplicate must still be an active asset holding those exact bytes.
    if not exists (
      select 1 from public.mil_assets
      where id = p_duplicate_asset_id
        and archived_at is null
        and checksum_sha256 = v_dupe_checksum
    ) then
      return jsonb_build_object('ok', false, 'status', 'duplicate_target_invalid');
    end if;

    insert into public.mil_manifest_entries (
      batch_id, grant_id, asset_id, original_filename, mime_type, byte_size,
      checksum_sha256, upload_status, duplicate_status, processing_status
    )
    values (
      v_grant.batch_id, v_grant.id, p_duplicate_asset_id, v_grant.original_filename,
      v_dupe_mime, v_dupe_bytes, v_dupe_checksum, 'duplicate', 'exact', 'skipped'
    )
    on conflict (grant_id) where grant_id is not null do update set
      asset_id = excluded.asset_id,
      mime_type = excluded.mime_type,
      byte_size = excluded.byte_size,
      checksum_sha256 = excluded.checksum_sha256,
      upload_status = excluded.upload_status,
      duplicate_status = excluded.duplicate_status,
      processing_status = excluded.processing_status,
      error_message = null,
      updated_at = now()
    returning id into v_manifest_id;

    update public.mil_upload_grants
    set
      finalize_state = 'duplicate',
      finalize_reason = null,
      canonical_asset_id = p_duplicate_asset_id,
      verified_sha256 = v_dupe_checksum,
      verified_mime = v_dupe_mime,
      verified_bytes = v_dupe_bytes,
      completed_at = coalesce(completed_at, now()),
      finalize_lease_owner = null,
      finalize_lease_expires_at = null,
      quarantine_cleanup_after = v_cleanup_after
    where id = p_grant_id;

    insert into public.mil_audit_events (actor_user_id, action, target_type, target_id, details)
    values (
      v_session.created_by, 'upload_duplicate', 'mil_upload_grants', v_grant.id,
      jsonb_build_object(
        'batch_id', v_grant.batch_id,
        'manifest_id', v_manifest_id,
        'duplicate_asset_id', p_duplicate_asset_id,
        'checksum', v_dupe_checksum
      )
    );

    perform public.mil_recount_upload_batch(v_grant.batch_id);

    return jsonb_build_object(
      'ok', true, 'status', 'duplicate',
      'grant_id', v_grant.id, 'existing_asset_id', p_duplicate_asset_id,
      'manifest_id', v_manifest_id, 'batch_id', v_grant.batch_id,
      'quarantine_cleanup_after', v_cleanup_after
    );
  end if;

  -- ------------------------------------------------------------------ placed
  if v_grant.finalize_state <> 'placed' then
    return jsonb_build_object(
      'ok', false, 'status', 'unexpected_state', 'finalize_state', v_grant.finalize_state
    );
  end if;
  if v_grant.final_object_path is null or v_grant.verified_sha256 is null
     or v_grant.verified_bytes is null or v_grant.verified_mime is null then
    return jsonb_build_object('ok', false, 'status', 'missing_placement_proof');
  end if;

  v_probe := public.mil_storage_catalog_probe(v_grant.bucket, v_grant.final_object_path);

  if not coalesce((v_probe->>'catalog_available')::boolean, false) then
    update public.mil_upload_grants
    set finalize_state = 'failed',
        finalize_reason = 'storage_catalog_unavailable',
        finalize_lease_owner = null,
        finalize_lease_expires_at = null
    where id = p_grant_id;
    perform public.mil_recount_upload_batch(v_grant.batch_id);
    return jsonb_build_object('ok', false, 'status', 'catalog_unavailable', 'probe', v_probe);
  end if;

  if not coalesce((v_probe->>'present')::boolean, false) then
    perform public.mil_raise_integrity_alert(
      'final_object_absent_at_commit', 'critical', v_grant.id, v_grant.batch_id, v_grant.asset_id,
      v_grant.bucket, v_grant.final_object_path,
      jsonb_build_object('probe', v_probe, 'edge_reported_present', p_catalog_present)
    );
    update public.mil_upload_grants
    set finalize_state = 'failed',
        finalize_reason = 'final_object_absent_at_commit',
        finalize_lease_owner = null,
        finalize_lease_expires_at = null
    where id = p_grant_id;
    perform public.mil_recount_upload_batch(v_grant.batch_id);
    return jsonb_build_object('ok', false, 'status', 'catalog_absent', 'probe', v_probe);
  end if;

  v_catalog_bytes := nullif(v_probe->>'bytes', '')::bigint;
  v_catalog_mime := public.mil_normalize_media_mime(v_probe->>'mime');

  if v_catalog_bytes is distinct from v_grant.verified_bytes then
    perform public.mil_raise_integrity_alert(
      'final_object_size_mismatch', 'critical', v_grant.id, v_grant.batch_id, v_grant.asset_id,
      v_grant.bucket, v_grant.final_object_path,
      jsonb_build_object('verified_bytes', v_grant.verified_bytes, 'catalog_bytes', v_catalog_bytes)
    );
    update public.mil_upload_grants
    set finalize_state = 'failed',
        finalize_reason = 'final_object_size_mismatch',
        finalize_lease_owner = null,
        finalize_lease_expires_at = null
    where id = p_grant_id;
    perform public.mil_recount_upload_batch(v_grant.batch_id);
    return jsonb_build_object('ok', false, 'status', 'catalog_mismatch', 'probe', v_probe);
  end if;

  if coalesce(v_catalog_mime, '') = '' then
    -- Presence + exact size is still proof the object exists; record the gap.
    perform public.mil_raise_integrity_alert(
      'final_object_mime_absent', 'warning', v_grant.id, v_grant.batch_id, v_grant.asset_id,
      v_grant.bucket, v_grant.final_object_path,
      jsonb_build_object('verified_mime', v_grant.verified_mime)
    );
  elsif v_catalog_mime <> v_grant.verified_mime then
    perform public.mil_raise_integrity_alert(
      'final_object_mime_mismatch', 'critical', v_grant.id, v_grant.batch_id, v_grant.asset_id,
      v_grant.bucket, v_grant.final_object_path,
      jsonb_build_object('verified_mime', v_grant.verified_mime, 'catalog_mime', v_catalog_mime)
    );
    update public.mil_upload_grants
    set finalize_state = 'failed',
        finalize_reason = 'final_object_mime_mismatch',
        finalize_lease_owner = null,
        finalize_lease_expires_at = null
    where id = p_grant_id;
    perform public.mil_recount_upload_batch(v_grant.batch_id);
    return jsonb_build_object('ok', false, 'status', 'catalog_mismatch', 'probe', v_probe);
  end if;

  -- The caller's own view of the catalog disagreeing with ours is worth knowing
  -- about, but the database's in-transaction read is what decides.
  if p_catalog_present is not null and p_catalog_present is distinct from true then
    perform public.mil_raise_integrity_alert(
      'catalog_view_divergence', 'warning', v_grant.id, v_grant.batch_id, v_grant.asset_id,
      v_grant.bucket, v_grant.final_object_path,
      jsonb_build_object('caller_present', p_catalog_present, 'caller_bytes', p_catalog_bytes,
                         'caller_mime', p_catalog_mime, 'probe', v_probe)
    );
  end if;

  v_media_kind := case
    when v_grant.verified_mime like 'video/%' then 'video'
    when v_grant.verified_mime like 'image/%' then 'photo'
    else 'other'
  end;

  begin
    insert into public.mil_assets (
      id, batch_id, media_kind, mime_type, byte_size, checksum_sha256,
      client_checksum_sha256, checksum_status, original_filename, original_bucket,
      original_path, processing_status, human_review_status, privacy_status,
      created_by_user_id
    )
    values (
      v_grant.asset_id, v_grant.batch_id, v_media_kind, v_grant.verified_mime,
      v_grant.verified_bytes, v_grant.verified_sha256, v_grant.verified_sha256, 'verified',
      v_grant.original_filename, v_grant.bucket, v_grant.final_object_path,
      'queued', 'pending', 'needs_review', v_session.created_by
    );
  exception
    when unique_violation then
      -- Another finalize committed these exact bytes while we were placing ours.
      -- The object we just wrote is now orphaned; a human must decide, so this
      -- is reported as a failure rather than quietly relabelled a duplicate.
      perform public.mil_raise_integrity_alert(
        'concurrent_checksum_collision', 'critical', v_grant.id, v_grant.batch_id, v_grant.asset_id,
        v_grant.bucket, v_grant.final_object_path,
        jsonb_build_object('checksum', v_grant.verified_sha256, 'orphaned_object', v_grant.final_object_path)
      );
      update public.mil_upload_grants
      set finalize_state = 'failed',
          finalize_reason = 'concurrent_checksum_collision',
          finalize_lease_owner = null,
          finalize_lease_expires_at = null
      where id = p_grant_id;
      perform public.mil_recount_upload_batch(v_grant.batch_id);
      return jsonb_build_object('ok', false, 'status', 'checksum_conflict');
  end;

  insert into public.mil_manifest_entries (
    batch_id, grant_id, asset_id, original_filename, mime_type, byte_size,
    checksum_sha256, upload_status, duplicate_status, processing_status
  )
  values (
    v_grant.batch_id, v_grant.id, v_grant.asset_id, v_grant.original_filename,
    v_grant.verified_mime, v_grant.verified_bytes, v_grant.verified_sha256,
    'uploaded', 'none', 'queued'
  )
  on conflict (grant_id) where grant_id is not null do update set
    asset_id = excluded.asset_id,
    mime_type = excluded.mime_type,
    byte_size = excluded.byte_size,
    checksum_sha256 = excluded.checksum_sha256,
    upload_status = excluded.upload_status,
    duplicate_status = excluded.duplicate_status,
    processing_status = excluded.processing_status,
    error_message = null,
    updated_at = now()
  returning id into v_manifest_id;

  -- Queued only. There is no always-on worker; media-intel-analyze is invoked on
  -- demand. See IMPLEMENTATION_STATUS.md.
  insert into public.mil_processing_jobs (asset_id, batch_id, job_type, status)
  values (v_grant.asset_id, v_grant.batch_id, 'ai_analyze', 'queued');

  update public.mil_upload_grants
  set
    finalize_state = 'committed',
    finalize_reason = null,
    canonical_asset_id = v_grant.asset_id,
    completed_at = coalesce(completed_at, now()),
    finalize_lease_owner = null,
    finalize_lease_expires_at = null,
    quarantine_cleanup_after = v_cleanup_after
  where id = p_grant_id;

  insert into public.mil_audit_events (actor_user_id, action, target_type, target_id, details)
  values (
    v_session.created_by, 'upload_finalized', 'mil_assets', v_grant.asset_id,
    jsonb_build_object(
      'grant_id', v_grant.id,
      'batch_id', v_grant.batch_id,
      'session_id', v_grant.session_id,
      'manifest_id', v_manifest_id,
      'original_path', v_grant.final_object_path,
      'checksum', v_grant.verified_sha256,
      'catalog_probe', v_probe
    )
  );

  perform public.mil_recount_upload_batch(v_grant.batch_id);

  return jsonb_build_object(
    'ok', true,
    'status', 'committed',
    'grant_id', v_grant.id,
    'asset_id', v_grant.asset_id,
    'batch_id', v_grant.batch_id,
    'manifest_id', v_manifest_id,
    'original_path', v_grant.final_object_path,
    'quarantine_cleanup_after', v_cleanup_after,
    'catalog_probe', v_probe
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- 14. Fail — record an honest failure. Never a success path.
-- ---------------------------------------------------------------------------
create or replace function public.mil_fail_upload_finalize(
  p_grant_id uuid,
  p_lease_owner text,
  p_reason text,
  p_release_lease boolean default true
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_grant public.mil_upload_grants%rowtype;
  v_reason text;
begin
  v_reason := nullif(btrim(coalesce(p_reason, '')), '');
  if v_reason is null then
    v_reason := 'unspecified_failure';
  end if;

  select * into v_grant
  from public.mil_upload_grants
  where id = p_grant_id
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'status', 'grant_not_found');
  end if;

  if v_grant.finalize_state in ('committed', 'duplicate', 'abandoned') then
    return jsonb_build_object(
      'ok', false, 'status', 'terminal_state', 'finalize_state', v_grant.finalize_state
    );
  end if;

  if v_grant.finalize_lease_owner is not null
     and v_grant.finalize_lease_expires_at is not null
     and v_grant.finalize_lease_expires_at > now()
     and v_grant.finalize_lease_owner is distinct from p_lease_owner then
    return jsonb_build_object('ok', false, 'status', 'lease_held');
  end if;

  update public.mil_upload_grants
  set
    finalize_state = 'failed',
    finalize_reason = v_reason,
    finalize_lease_owner = case when p_release_lease then null else finalize_lease_owner end,
    finalize_lease_expires_at = case when p_release_lease then null else finalize_lease_expires_at end
  where id = p_grant_id;

  insert into public.mil_manifest_entries (
    batch_id, grant_id, original_filename, mime_type, byte_size, checksum_sha256,
    upload_status, processing_status, error_message, retry_count
  )
  values (
    v_grant.batch_id, v_grant.id, v_grant.original_filename,
    public.mil_normalize_media_mime(v_grant.content_type), v_grant.verified_bytes,
    v_grant.verified_sha256, 'failed', 'pending', v_reason, v_grant.finalize_attempts
  )
  on conflict (grant_id) where grant_id is not null do update set
    upload_status = 'failed',
    error_message = v_reason,
    retry_count = v_grant.finalize_attempts,
    updated_at = now();

  insert into public.mil_audit_events (actor_user_id, action, target_type, target_id, details)
  values (
    null, 'upload_finalize_failed', 'mil_upload_grants', v_grant.id,
    jsonb_build_object('reason', v_reason, 'batch_id', v_grant.batch_id,
                       'attempts', v_grant.finalize_attempts)
  );

  perform public.mil_recount_upload_batch(v_grant.batch_id);

  return jsonb_build_object(
    'ok', true, 'status', 'failed', 'grant_id', v_grant.id, 'reason', v_reason
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- 15. Abandon expired grants
--     A phone that walked out of range is not a server failure; it gets its own
--     counter. Quarantine bytes are retained (see quarantine_cleanup_after).
-- ---------------------------------------------------------------------------
create or replace function public.mil_abandon_expired_upload_grants(p_limit integer default 200)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row record;
  v_limit integer;
  v_abandoned integer := 0;
  v_orphans integer := 0;
  v_batches uuid[] := '{}';
begin
  v_limit := greatest(least(coalesce(p_limit, 200), 1000), 1);

  for v_row in
    select *
    from public.mil_upload_grants
    where finalize_state in ('minted', 'placing', 'placed')
      and (finalize_lease_expires_at is null or finalize_lease_expires_at <= now())
      and coalesce(commit_deadline_at, expires_at) <= now()
      and expires_at <= now()
    order by created_at
    limit v_limit
    for update skip locked
  loop
    -- Bytes exist at the final path with no asset row. Abandoning does not make
    -- that object disappear, so it is escalated rather than swept under a counter.
    if v_row.finalize_state = 'placed' then
      v_orphans := v_orphans + 1;
      perform public.mil_raise_integrity_alert(
        'abandoned_placed_grant_orphan_object', 'critical', v_row.id, v_row.batch_id, v_row.asset_id,
        v_row.bucket, v_row.final_object_path,
        jsonb_build_object('verified_sha256', v_row.verified_sha256, 'verified_bytes', v_row.verified_bytes)
      );
    end if;

    update public.mil_upload_grants
    set
      finalize_state = 'abandoned',
      finalize_reason = 'expired_without_commit:' || v_row.finalize_state,
      finalize_lease_owner = null,
      finalize_lease_expires_at = null,
      revoked_at = coalesce(revoked_at, now())
    where id = v_row.id;

    insert into public.mil_manifest_entries (
      batch_id, grant_id, original_filename, mime_type, byte_size, checksum_sha256,
      upload_status, processing_status, error_message, retry_count
    )
    values (
      v_row.batch_id, v_row.id, v_row.original_filename,
      public.mil_normalize_media_mime(v_row.content_type), v_row.verified_bytes,
      v_row.verified_sha256, 'cancelled', 'pending',
      'Upload grant expired before the transfer was confirmed. Keep the phone original.',
      v_row.finalize_attempts
    )
    on conflict (grant_id) where grant_id is not null do update set
      upload_status = 'cancelled',
      error_message = 'Upload grant expired before the transfer was confirmed. Keep the phone original.',
      updated_at = now();

    if not (v_row.batch_id = any(v_batches)) then
      v_batches := array_append(v_batches, v_row.batch_id);
    end if;
    v_abandoned := v_abandoned + 1;
  end loop;

  if array_length(v_batches, 1) is not null then
    for v_row in select unnest(v_batches) as batch_id loop
      perform public.mil_recount_upload_batch(v_row.batch_id);
    end loop;
  end if;

  return jsonb_build_object(
    'ok', true,
    'abandoned', v_abandoned,
    'orphaned_placed_objects', v_orphans,
    'batches_recounted', coalesce(array_length(v_batches, 1), 0)
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- 16. Reconcile — resolve grants stranded by a dead worker
--     Only two safe resolutions exist: finish a commit whose object storage can
--     confirm, or record an honest failure. Nothing here invents success.
-- ---------------------------------------------------------------------------
create or replace function public.mil_reconcile_upload_finalization(
  p_grant_id uuid default null,
  p_limit integer default 25,
  p_lease_owner text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row record;
  v_limit integer;
  v_lease_owner text;
  v_probe jsonb;
  v_commit jsonb;
  v_examined integer := 0;
  v_committed integer := 0;
  v_failed integer := 0;
  v_released integer := 0;
  v_waiting integer := 0;
  v_results jsonb := '[]'::jsonb;
begin
  v_limit := greatest(least(coalesce(p_limit, 25), 200), 1);
  v_lease_owner := coalesce(nullif(btrim(coalesce(p_lease_owner, '')), ''),
                            'reconcile:' || gen_random_uuid()::text);

  for v_row in
    select *
    from public.mil_upload_grants
    where finalize_state in ('placing', 'placed')
      and (p_grant_id is null or id = p_grant_id)
      and (finalize_lease_expires_at is null or finalize_lease_expires_at <= now())
    order by created_at
    limit v_limit
    for update skip locked
  loop
    v_examined := v_examined + 1;

    -- Take a short lease so mil_commit_upload_finalize sees a live owner.
    update public.mil_upload_grants
    set finalize_lease_owner = v_lease_owner,
        finalize_lease_expires_at = now() + interval '120 seconds'
    where id = v_row.id;

    if v_row.finalize_state = 'placed' then
      v_commit := public.mil_commit_upload_finalize(v_row.id, v_lease_owner, 'placed');

      if coalesce((v_commit->>'ok')::boolean, false) then
        v_committed := v_committed + 1;
        insert into public.mil_audit_events (actor_user_id, action, target_type, target_id, details)
        values (
          null, 'upload_finalize_reconciled', 'mil_upload_grants', v_row.id,
          jsonb_build_object(
            'resolution', 'committed_from_catalog_proof',
            -- Reconcile proves the object is in the catalog at the verified size.
            -- It cannot re-hash the bytes; the checksum it records is the one
            -- verified before placement.
            'proof_class', 'catalog_presence_and_size',
            'commit', v_commit
          )
        );
      else
        v_failed := v_failed + 1;
      end if;

      v_results := v_results || jsonb_build_array(
        jsonb_build_object('grant_id', v_row.id, 'from_state', 'placed', 'commit', v_commit)
      );
      continue;
    end if;

    -- finalize_state = 'placing': the worker died somewhere around placement.
    v_probe := public.mil_storage_catalog_probe(
      v_row.bucket,
      public.mil_original_object_path(v_row.batch_id, v_row.asset_id, v_row.original_filename)
    );

    if coalesce((v_probe->>'present')::boolean, false) then
      -- Bytes are at the final path but were never recorded as verified. A retry
      -- must re-hash them before trusting them, so this is surfaced, not healed.
      perform public.mil_raise_integrity_alert(
        'placing_grant_final_object_present_unverified', 'warning', v_row.id, v_row.batch_id,
        v_row.asset_id, v_row.bucket,
        public.mil_original_object_path(v_row.batch_id, v_row.asset_id, v_row.original_filename),
        jsonb_build_object('probe', v_probe)
      );
    end if;

    if coalesce(v_row.commit_deadline_at, v_row.expires_at) <= now() then
      -- Past the deadline: leave it for mil_abandon_expired_upload_grants, which
      -- owns the abandoned classification.
      update public.mil_upload_grants
      set finalize_lease_owner = null, finalize_lease_expires_at = null
      where id = v_row.id;
      v_waiting := v_waiting + 1;
    else
      -- Release the stale lease so the next client attempt can pick it up.
      update public.mil_upload_grants
      set finalize_lease_owner = null, finalize_lease_expires_at = null
      where id = v_row.id;
      v_released := v_released + 1;
    end if;

    v_results := v_results || jsonb_build_array(
      jsonb_build_object('grant_id', v_row.id, 'from_state', 'placing', 'probe', v_probe)
    );
  end loop;

  return jsonb_build_object(
    'ok', true,
    'examined', v_examined,
    'committed', v_committed,
    'failed', v_failed,
    'lease_released', v_released,
    'awaiting_abandonment', v_waiting,
    'results', v_results
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- 17. Retire the one-shot finalize + blind cleanup helpers
--     Every call site was moved to the lifecycle RPCs in this same change.
-- ---------------------------------------------------------------------------
drop function if exists public.mil_finalize_upload_grant(uuid, text, text, bigint, boolean, uuid);
drop function if exists public.mil_cleanup_expired_upload_grants();

-- ---------------------------------------------------------------------------
-- 18. Execution privileges — service_role only for every lifecycle RPC
-- ---------------------------------------------------------------------------
revoke all on function public.mil_raise_integrity_alert(text, text, uuid, uuid, uuid, text, text, jsonb) from public;
revoke all on function public.mil_storage_catalog_probe(text, text) from public;
revoke all on function public.mil_recount_upload_batch(uuid) from public;
revoke all on function public.mil_begin_upload_finalize(uuid, text, integer, integer) from public;
revoke all on function public.mil_mark_upload_placed(uuid, text, text, text, text, bigint, integer) from public;
revoke all on function public.mil_commit_upload_finalize(uuid, text, text, boolean, bigint, text, uuid, text, text, bigint) from public;
revoke all on function public.mil_fail_upload_finalize(uuid, text, text, boolean) from public;
revoke all on function public.mil_abandon_expired_upload_grants(integer) from public;
revoke all on function public.mil_reconcile_upload_finalization(uuid, integer, text) from public;

grant execute on function public.mil_raise_integrity_alert(text, text, uuid, uuid, uuid, text, text, jsonb) to service_role;
grant execute on function public.mil_storage_catalog_probe(text, text) to service_role;
grant execute on function public.mil_recount_upload_batch(uuid) to service_role;
grant execute on function public.mil_begin_upload_finalize(uuid, text, integer, integer) to service_role;
grant execute on function public.mil_mark_upload_placed(uuid, text, text, text, text, bigint, integer) to service_role;
grant execute on function public.mil_commit_upload_finalize(uuid, text, text, boolean, bigint, text, uuid, text, text, bigint) to service_role;
grant execute on function public.mil_fail_upload_finalize(uuid, text, text, boolean) to service_role;
grant execute on function public.mil_abandon_expired_upload_grants(integer) to service_role;
grant execute on function public.mil_reconcile_upload_finalization(uuid, integer, text) to service_role;

commit;

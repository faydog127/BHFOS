-- MIL upload finalization lifecycle — behavioral tests.
-- Usage: psql "$DATABASE_URL" -f supabase/tests/mil/03_upload_lifecycle_behavior.sql
-- Requires migrations through 20260726090000 and a storage schema (local Supabase).
--
-- These exercise the RPCs against real rows, including the failure boundaries
-- that the previous one-shot finalize could not express. Everything runs inside
-- one transaction and is rolled back, so the database is left untouched.

\set ON_ERROR_STOP on

begin;

-- ---------------------------------------------------------------------------
-- Boundary 1 — a non-canonical quarantine path cannot even be stored
-- ---------------------------------------------------------------------------
do $$
declare
  v_batch uuid;
  v_session uuid;
  v_asset uuid := gen_random_uuid();
begin
  insert into public.mil_upload_batches (source_label, status)
  values ('lifecycle boundary 1', 'open') returning id into v_batch;
  insert into public.mil_upload_sessions (batch_id, token_hash, expires_at)
  values (v_batch, 'test-' || gen_random_uuid()::text, now() + interval '1 hour')
  returning id into v_session;

  begin
    insert into public.mil_upload_grants (
      session_id, batch_id, asset_id, object_path, bucket, content_type,
      max_bytes, original_filename, expires_at
    )
    values (
      v_session, v_batch, v_asset, 'mil/quarantine/../../originals/evil.jpg',
      'media-intel-originals', 'image/jpeg', 1000, 'evil.jpg', now() + interval '1 hour'
    );
    raise exception 'FAIL boundary 1: a non-canonical quarantine path was accepted';
  exception
    when check_violation then null;
  end;
end $$;

-- ---------------------------------------------------------------------------
-- Boundaries 2-9 — the happy path and everything that can go wrong along it
-- ---------------------------------------------------------------------------
do $$
declare
  v_batch uuid;
  v_session uuid;
  v_grant uuid;
  v_grant2 uuid;
  v_asset uuid := gen_random_uuid();
  v_asset2 uuid := gen_random_uuid();
  v_file text := 'IMG_0001.jpg';
  v_file2 text := 'IMG_0002.jpg';
  v_qpath text;
  v_fpath text;
  v_sha text := repeat('a1', 32);
  v_bytes bigint := 4096;
  v_lease text := 'test-lease-primary';
  v_other text := 'test-lease-intruder';
  v_token_exp timestamptz := now() + interval '2 hours';
  v_r jsonb;
  v_count integer;
  v_row public.mil_upload_grants%rowtype;
  v_batch_row public.mil_upload_batches%rowtype;
begin
  insert into public.mil_upload_batches (source_label, status)
  values ('lifecycle main', 'open') returning id into v_batch;
  insert into public.mil_upload_sessions (batch_id, token_hash, expires_at)
  values (v_batch, 'test-' || gen_random_uuid()::text, now() + interval '1 hour')
  returning id into v_session;

  v_qpath := public.mil_quarantine_object_path(v_batch, v_asset, v_file);
  v_fpath := public.mil_original_object_path(v_batch, v_asset, v_file);

  insert into public.mil_upload_grants (
    session_id, batch_id, asset_id, object_path, bucket, content_type,
    max_bytes, original_filename, expires_at, upload_token_expires_at
  )
  values (
    v_session, v_batch, v_asset, v_qpath, 'media-intel-originals', 'image/jpeg',
    10485760, v_file, now() + interval '1 hour', v_token_exp
  )
  returning id into v_grant;

  -- Boundary 2 — begin acquires the lease and moves minted -> placing
  v_r := public.mil_begin_upload_finalize(v_grant, v_lease, 180, 900);
  if coalesce(v_r->>'status', '') <> 'begin' then
    raise exception 'FAIL boundary 2: begin returned %', v_r;
  end if;
  select * into v_row from public.mil_upload_grants where id = v_grant;
  if v_row.finalize_state <> 'placing' then
    raise exception 'FAIL boundary 2: expected placing, got %', v_row.finalize_state;
  end if;
  if v_row.commit_deadline_at is null then
    raise exception 'FAIL boundary 2: commit deadline was not set';
  end if;

  -- Boundary 3 — a second worker is refused while the lease is live
  v_r := public.mil_begin_upload_finalize(v_grant, v_other, 180, 900);
  if coalesce(v_r->>'status', '') <> 'lease_held' then
    raise exception 'FAIL boundary 3: concurrent begin returned %', v_r;
  end if;

  -- Boundary 4 — placement may only be recorded against the canonical path
  v_r := public.mil_mark_upload_placed(
    v_grant, v_lease, 'mil/originals/somewhere-else/' || v_file, v_sha, 'image/jpeg', v_bytes
  );
  if coalesce(v_r->>'status', '') <> 'path_not_canonical' then
    raise exception 'FAIL boundary 4: off-path placement returned %', v_r;
  end if;
  if not exists (
    select 1 from public.mil_integrity_alerts
    where grant_id = v_grant and alert_key = 'final_path_not_canonical'
  ) then
    raise exception 'FAIL boundary 4: no integrity alert for a non-canonical final path';
  end if;

  -- Boundary 5 — stored type must match the granted type
  v_r := public.mil_mark_upload_placed(v_grant, v_lease, v_fpath, v_sha, 'video/mp4', v_bytes);
  if coalesce(v_r->>'status', '') <> 'mime_mismatch' then
    raise exception 'FAIL boundary 5: mime mismatch returned %', v_r;
  end if;

  -- Placement recorded correctly
  v_r := public.mil_mark_upload_placed(v_grant, v_lease, v_fpath, v_sha, 'image/jpeg', v_bytes);
  if coalesce(v_r->>'ok', 'false') <> 'true' then
    raise exception 'FAIL: valid mark_placed returned %', v_r;
  end if;

  -- Boundary 6 — commit refuses when storage cannot show the object
  v_r := public.mil_commit_upload_finalize(v_grant, v_lease, 'placed');
  if coalesce(v_r->>'status', '') <> 'catalog_absent' then
    raise exception 'FAIL boundary 6: commit without a stored object returned %', v_r;
  end if;
  select count(*) into v_count from public.mil_assets where id = v_asset;
  if v_count <> 0 then
    raise exception 'FAIL boundary 6: an asset row was created without a stored object';
  end if;
  if not exists (
    select 1 from public.mil_integrity_alerts
    where grant_id = v_grant and alert_key = 'final_object_absent_at_commit'
  ) then
    raise exception 'FAIL boundary 6: no integrity alert for an absent final object';
  end if;

  -- Boundary 7 — commit refuses when the catalog disagrees about size
  insert into storage.objects (bucket_id, name, metadata)
  values (
    'media-intel-originals', v_fpath,
    jsonb_build_object('size', v_bytes + 17, 'mimetype', 'image/jpeg')
  );

  v_r := public.mil_begin_upload_finalize(v_grant, v_lease, 180, 900);
  if coalesce(v_r->>'ok', 'false') <> 'true' then
    raise exception 'FAIL boundary 7: could not retry a failed grant: %', v_r;
  end if;
  v_r := public.mil_mark_upload_placed(v_grant, v_lease, v_fpath, v_sha, 'image/jpeg', v_bytes);
  if coalesce(v_r->>'ok', 'false') <> 'true' then
    raise exception 'FAIL boundary 7: mark_placed retry returned %', v_r;
  end if;
  v_r := public.mil_commit_upload_finalize(v_grant, v_lease, 'placed');
  if coalesce(v_r->>'status', '') <> 'catalog_mismatch' then
    raise exception 'FAIL boundary 7: size mismatch commit returned %', v_r;
  end if;
  select count(*) into v_count from public.mil_assets where id = v_asset;
  if v_count <> 0 then
    raise exception 'FAIL boundary 7: an asset row was created despite a size mismatch';
  end if;

  -- Boundary 8 — commit succeeds only once storage agrees
  update storage.objects
  set metadata = jsonb_build_object('size', v_bytes, 'mimetype', 'image/jpeg')
  where bucket_id = 'media-intel-originals' and name = v_fpath;

  v_r := public.mil_begin_upload_finalize(v_grant, v_lease, 180, 900);
  v_r := public.mil_mark_upload_placed(v_grant, v_lease, v_fpath, v_sha, 'image/jpeg', v_bytes);
  v_r := public.mil_commit_upload_finalize(v_grant, v_lease, 'placed');
  if coalesce(v_r->>'status', '') <> 'committed' then
    raise exception 'FAIL boundary 8: commit returned %', v_r;
  end if;

  select * into v_row from public.mil_upload_grants where id = v_grant;
  if v_row.finalize_state <> 'committed' then
    raise exception 'FAIL boundary 8: grant state is %', v_row.finalize_state;
  end if;
  if v_row.canonical_asset_id <> v_asset then
    raise exception 'FAIL boundary 8: canonical_asset_id not recorded';
  end if;
  if v_row.quarantine_cleanup_after <= v_token_exp then
    raise exception 'FAIL boundary 8: quarantine cleanup (%) is not after upload token expiry (%)',
      v_row.quarantine_cleanup_after, v_token_exp;
  end if;

  if not exists (
    select 1 from public.mil_assets
    where id = v_asset
      and original_path = v_fpath
      and checksum_sha256 = v_sha
      and byte_size = v_bytes
      and checksum_status = 'verified'
  ) then
    raise exception 'FAIL boundary 8: asset row missing or wrong';
  end if;
  if not exists (
    select 1 from public.mil_manifest_entries
    where grant_id = v_grant and upload_status = 'uploaded' and asset_id = v_asset
  ) then
    raise exception 'FAIL boundary 8: manifest entry missing';
  end if;
  if not exists (
    select 1 from public.mil_processing_jobs where asset_id = v_asset and job_type = 'ai_analyze'
  ) then
    raise exception 'FAIL boundary 8: analysis job not queued';
  end if;

  select * into v_batch_row from public.mil_upload_batches where id = v_batch;
  if v_batch_row.success_count <> 1 or v_batch_row.failed_count <> 0 or v_batch_row.abandoned_count <> 0 then
    raise exception 'FAIL boundary 8: batch counters are %/%/%',
      v_batch_row.success_count, v_batch_row.failed_count, v_batch_row.abandoned_count;
  end if;

  -- Replay must not create a second asset
  v_r := public.mil_begin_upload_finalize(v_grant, v_lease, 180, 900);
  if coalesce(v_r->>'status', '') <> 'already_committed' then
    raise exception 'FAIL boundary 8: replay begin returned %', v_r;
  end if;
  v_r := public.mil_commit_upload_finalize(v_grant, v_lease, 'placed');
  if coalesce(v_r->>'status', '') <> 'already_committed' then
    raise exception 'FAIL boundary 8: replay commit returned %', v_r;
  end if;
  select count(*) into v_count from public.mil_assets where batch_id = v_batch;
  if v_count <> 1 then
    raise exception 'FAIL boundary 8: replay produced % assets', v_count;
  end if;

  -- Boundary 9 — identical bytes are recorded as a duplicate, not a second copy
  insert into public.mil_upload_grants (
    session_id, batch_id, asset_id, object_path, bucket, content_type,
    max_bytes, original_filename, expires_at, upload_token_expires_at
  )
  values (
    v_session, v_batch, v_asset2,
    public.mil_quarantine_object_path(v_batch, v_asset2, v_file2),
    'media-intel-originals', 'image/jpeg', 10485760, v_file2,
    now() + interval '1 hour', v_token_exp
  )
  returning id into v_grant2;

  v_r := public.mil_begin_upload_finalize(v_grant2, v_lease, 180, 900);
  v_r := public.mil_commit_upload_finalize(
    v_grant2, v_lease, 'duplicate', null, null, null, v_asset, v_sha, 'image/jpeg', v_bytes
  );
  if coalesce(v_r->>'status', '') <> 'duplicate' then
    raise exception 'FAIL boundary 9: duplicate commit returned %', v_r;
  end if;
  select count(*) into v_count from public.mil_assets where batch_id = v_batch;
  if v_count <> 1 then
    raise exception 'FAIL boundary 9: duplicate created a second asset (% total)', v_count;
  end if;
  select * into v_batch_row from public.mil_upload_batches where id = v_batch;
  if v_batch_row.duplicate_count <> 1 then
    raise exception 'FAIL boundary 9: duplicate_count is %', v_batch_row.duplicate_count;
  end if;
  if not exists (
    select 1 from public.mil_manifest_entries
    where grant_id = v_grant2 and upload_status = 'duplicate' and asset_id = v_asset
  ) then
    raise exception 'FAIL boundary 9: duplicate manifest entry missing';
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Boundary 10 — a duplicate claim must point at a real active asset
-- ---------------------------------------------------------------------------
do $$
declare
  v_batch uuid;
  v_session uuid;
  v_grant uuid;
  v_asset uuid := gen_random_uuid();
  v_file text := 'IMG_BAD_DUP.jpg';
  v_r jsonb;
begin
  insert into public.mil_upload_batches (source_label, status)
  values ('lifecycle boundary 10', 'open') returning id into v_batch;
  insert into public.mil_upload_sessions (batch_id, token_hash, expires_at)
  values (v_batch, 'test-' || gen_random_uuid()::text, now() + interval '1 hour')
  returning id into v_session;
  insert into public.mil_upload_grants (
    session_id, batch_id, asset_id, object_path, bucket, content_type,
    max_bytes, original_filename, expires_at
  )
  values (
    v_session, v_batch, v_asset,
    public.mil_quarantine_object_path(v_batch, v_asset, v_file),
    'media-intel-originals', 'image/jpeg', 1048576, v_file, now() + interval '1 hour'
  )
  returning id into v_grant;

  v_r := public.mil_begin_upload_finalize(v_grant, 'lease-10', 180, 900);
  v_r := public.mil_commit_upload_finalize(
    v_grant, 'lease-10', 'duplicate', null, null, null,
    gen_random_uuid(), repeat('b2', 32), 'image/jpeg', 512
  );
  if coalesce(v_r->>'status', '') <> 'duplicate_target_invalid' then
    raise exception 'FAIL boundary 10: bogus duplicate target returned %', v_r;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Boundary 11 — quarantine bytes changing between attempts is never accepted
-- ---------------------------------------------------------------------------
do $$
declare
  v_batch uuid;
  v_session uuid;
  v_grant uuid;
  v_asset uuid := gen_random_uuid();
  v_file text := 'IMG_SWAP.jpg';
  v_fpath text;
  v_r jsonb;
begin
  insert into public.mil_upload_batches (source_label, status)
  values ('lifecycle boundary 11', 'open') returning id into v_batch;
  insert into public.mil_upload_sessions (batch_id, token_hash, expires_at)
  values (v_batch, 'test-' || gen_random_uuid()::text, now() + interval '1 hour')
  returning id into v_session;
  insert into public.mil_upload_grants (
    session_id, batch_id, asset_id, object_path, bucket, content_type,
    max_bytes, original_filename, expires_at
  )
  values (
    v_session, v_batch, v_asset,
    public.mil_quarantine_object_path(v_batch, v_asset, v_file),
    'media-intel-originals', 'image/jpeg', 1048576, v_file, now() + interval '1 hour'
  )
  returning id into v_grant;

  v_fpath := public.mil_original_object_path(v_batch, v_asset, v_file);

  v_r := public.mil_begin_upload_finalize(v_grant, 'lease-11', 180, 900);
  v_r := public.mil_mark_upload_placed(v_grant, 'lease-11', v_fpath, repeat('c3', 32), 'image/jpeg', 900);
  if coalesce(v_r->>'ok', 'false') <> 'true' then
    raise exception 'FAIL boundary 11: first placement returned %', v_r;
  end if;

  v_r := public.mil_fail_upload_finalize(v_grant, 'lease-11', 'simulated_worker_crash');
  if coalesce(v_r->>'status', '') <> 'failed' then
    raise exception 'FAIL boundary 11: fail RPC returned %', v_r;
  end if;

  v_r := public.mil_begin_upload_finalize(v_grant, 'lease-11b', 180, 900);
  v_r := public.mil_mark_upload_placed(v_grant, 'lease-11b', v_fpath, repeat('d4', 32), 'image/jpeg', 900);
  if coalesce(v_r->>'status', '') <> 'bytes_changed' then
    raise exception 'FAIL boundary 11: changed bytes returned %', v_r;
  end if;
  if not exists (
    select 1 from public.mil_integrity_alerts
    where grant_id = v_grant and alert_key = 'quarantine_bytes_changed'
  ) then
    raise exception 'FAIL boundary 11: no integrity alert for changed bytes';
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Boundary 12 — an expired grant becomes abandoned, not failed
-- ---------------------------------------------------------------------------
do $$
declare
  v_batch uuid;
  v_session uuid;
  v_grant uuid;
  v_asset uuid := gen_random_uuid();
  v_file text := 'IMG_WALKED_AWAY.jpg';
  v_r jsonb;
  v_batch_row public.mil_upload_batches%rowtype;
  v_state text;
begin
  insert into public.mil_upload_batches (source_label, status)
  values ('lifecycle boundary 12', 'open') returning id into v_batch;
  insert into public.mil_upload_sessions (batch_id, token_hash, expires_at)
  values (v_batch, 'test-' || gen_random_uuid()::text, now() - interval '5 minutes')
  returning id into v_session;
  insert into public.mil_upload_grants (
    session_id, batch_id, asset_id, object_path, bucket, content_type,
    max_bytes, original_filename, expires_at
  )
  values (
    v_session, v_batch, v_asset,
    public.mil_quarantine_object_path(v_batch, v_asset, v_file),
    'media-intel-originals', 'image/jpeg', 1048576, v_file, now() - interval '1 minute'
  )
  returning id into v_grant;

  v_r := public.mil_abandon_expired_upload_grants(50);
  if coalesce((v_r->>'abandoned')::integer, 0) < 1 then
    raise exception 'FAIL boundary 12: abandon swept nothing: %', v_r;
  end if;

  select finalize_state into v_state from public.mil_upload_grants where id = v_grant;
  if v_state <> 'abandoned' then
    raise exception 'FAIL boundary 12: grant state is %', v_state;
  end if;

  select * into v_batch_row from public.mil_upload_batches where id = v_batch;
  if v_batch_row.abandoned_count <> 1 then
    raise exception 'FAIL boundary 12: abandoned_count is %', v_batch_row.abandoned_count;
  end if;
  if v_batch_row.failed_count <> 0 then
    raise exception 'FAIL boundary 12: an unattended phone was counted as a server failure';
  end if;
  if v_batch_row.status <> 'interrupted' then
    raise exception 'FAIL boundary 12: batch status is %', v_batch_row.status;
  end if;
  if not exists (
    select 1 from public.mil_manifest_entries where grant_id = v_grant and upload_status = 'cancelled'
  ) then
    raise exception 'FAIL boundary 12: abandoned grant has no manifest line';
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Boundary 13 — reconcile finishes a placed grant whose worker died
-- ---------------------------------------------------------------------------
do $$
declare
  v_batch uuid;
  v_session uuid;
  v_grant uuid;
  v_asset uuid := gen_random_uuid();
  v_file text := 'IMG_STRANDED.jpg';
  v_fpath text;
  v_sha text := repeat('e5', 32);
  v_bytes bigint := 2048;
  v_r jsonb;
  v_state text;
begin
  insert into public.mil_upload_batches (source_label, status)
  values ('lifecycle boundary 13', 'open') returning id into v_batch;
  insert into public.mil_upload_sessions (batch_id, token_hash, expires_at)
  values (v_batch, 'test-' || gen_random_uuid()::text, now() + interval '1 hour')
  returning id into v_session;
  insert into public.mil_upload_grants (
    session_id, batch_id, asset_id, object_path, bucket, content_type,
    max_bytes, original_filename, expires_at, upload_token_expires_at
  )
  values (
    v_session, v_batch, v_asset,
    public.mil_quarantine_object_path(v_batch, v_asset, v_file),
    'media-intel-originals', 'image/jpeg', 1048576, v_file,
    now() + interval '1 hour', now() + interval '2 hours'
  )
  returning id into v_grant;

  v_fpath := public.mil_original_object_path(v_batch, v_asset, v_file);
  insert into storage.objects (bucket_id, name, metadata)
  values ('media-intel-originals', v_fpath, jsonb_build_object('size', v_bytes, 'mimetype', 'image/jpeg'));

  v_r := public.mil_begin_upload_finalize(v_grant, 'lease-13', 180, 900);
  v_r := public.mil_mark_upload_placed(v_grant, 'lease-13', v_fpath, v_sha, 'image/jpeg', v_bytes);
  if coalesce(v_r->>'ok', 'false') <> 'true' then
    raise exception 'FAIL boundary 13: mark_placed returned %', v_r;
  end if;

  -- The worker dies here: the lease lapses with the bytes already in place.
  update public.mil_upload_grants
  set finalize_lease_expires_at = now() - interval '1 second'
  where id = v_grant;

  v_r := public.mil_reconcile_upload_finalization(v_grant, 5, 'reconcile-test');
  if coalesce((v_r->>'committed')::integer, 0) <> 1 then
    raise exception 'FAIL boundary 13: reconcile did not commit the stranded grant: %', v_r;
  end if;

  select finalize_state into v_state from public.mil_upload_grants where id = v_grant;
  if v_state <> 'committed' then
    raise exception 'FAIL boundary 13: grant state after reconcile is %', v_state;
  end if;
  if not exists (select 1 from public.mil_assets where id = v_asset and original_path = v_fpath) then
    raise exception 'FAIL boundary 13: reconcile committed without creating the asset';
  end if;
  if not exists (
    select 1 from public.mil_audit_events
    where target_id = v_grant
      and action = 'upload_finalize_reconciled'
      and details->>'proof_class' = 'catalog_presence_and_size'
  ) then
    raise exception 'FAIL boundary 13: reconcile did not record its proof class honestly';
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Two active assets can never share bytes
-- ---------------------------------------------------------------------------
do $$
declare
  v_sha text := repeat('f6', 32);
begin
  insert into public.mil_assets (
    media_kind, mime_type, byte_size, checksum_sha256, original_filename,
    original_bucket, original_path
  )
  values ('photo', 'image/jpeg', 10, v_sha, 'a.jpg', 'media-intel-originals', 'mil/originals/x/a.jpg');

  begin
    insert into public.mil_assets (
      media_kind, mime_type, byte_size, checksum_sha256, original_filename,
      original_bucket, original_path
    )
    values ('photo', 'image/jpeg', 10, v_sha, 'b.jpg', 'media-intel-originals', 'mil/originals/y/b.jpg');
    raise exception 'FAIL: two active assets were allowed to share a checksum';
  exception
    when unique_violation then null;
  end;
end $$;

rollback;

select 'mil 03_upload_lifecycle_behavior: PASS' as result;

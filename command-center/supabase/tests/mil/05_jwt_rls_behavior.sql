-- MIL JWT-seeded RLS behavioral tests.
-- Usage: psql "$DATABASE_URL" -f supabase/tests/mil/05_jwt_rls_behavior.sql
-- Requires migrations through 20260726090000 (local disposable stack).
--
-- Seeds auth.users + app_user_roles, then acts as each role via:
--   set_config('request.jwt.claim.sub' / 'request.jwt.claims') + set local role authenticated
-- Proves capability-matrix behavior that 01_rls_matrix only checks structurally.
-- Everything runs in one transaction and is rolled back.

\set ON_ERROR_STOP on

begin;

-- ---------------------------------------------------------------------------
-- Seed identities + one library asset (postgres / bypass RLS)
-- ---------------------------------------------------------------------------
do $$
declare
  v_admin uuid := 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1';
  v_reviewer uuid := 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2';
  v_office uuid := 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3';
  v_creator uuid := 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa4';
  v_tech uuid := 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa5';
  v_asset uuid := 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1';
  r record;
begin
  for r in
    select * from (values
      (v_admin, 'mil-jwt-admin@example.test', 'admin'),
      (v_reviewer, 'mil-jwt-reviewer@example.test', 'media_reviewer'),
      (v_office, 'mil-jwt-office@example.test', 'office'),
      (v_creator, 'mil-jwt-creator@example.test', 'reel_creator'),
      (v_tech, 'mil-jwt-tech@example.test', 'technician')
    ) as t(uid, email, role)
  loop
    insert into auth.users (
      instance_id, id, aud, role, email, encrypted_password,
      email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
      created_at, updated_at, confirmation_token, recovery_token,
      email_change_token_new, email_change
    ) values (
      '00000000-0000-0000-0000-000000000000',
      r.uid,
      'authenticated',
      'authenticated',
      r.email,
      crypt('test-password', gen_salt('bf')),
      now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{}'::jsonb,
      now(),
      now(),
      '',
      '',
      '',
      ''
    )
    on conflict (id) do nothing;

    -- Legacy app_user_roles.tenant_id is NOT NULL in this stack; MIL role
    -- helpers intentionally ignore tenant_id when resolving mil_current_role().
    insert into public.app_user_roles (user_id, role, tenant_id)
    values (r.uid, r.role, 'tvg');
  end loop;

  insert into public.mil_assets (
    id, media_kind, mime_type, byte_size, checksum_sha256,
    original_filename, original_path, created_by_user_id
  ) values (
    v_asset, 'photo', 'image/jpeg', 1024, repeat('ab', 32),
    'jwt-rls.jpg', 'mil/originals/' || v_asset::text || '/jwt-rls.jpg', v_admin
  );
end $$;

-- ---------------------------------------------------------------------------
-- Helpers in pg_temp (session-scoped; rolled back with the transaction)
-- ---------------------------------------------------------------------------
create function pg_temp.mil_test_become(p_uid uuid)
returns void
language plpgsql
as $$
begin
  perform set_config('request.jwt.claim.sub', p_uid::text, true);
  perform set_config(
    'request.jwt.claims',
    json_build_object('sub', p_uid::text, 'role', 'authenticated')::text,
    true
  );
  execute 'set local role authenticated';
end;
$$;

create function pg_temp.mil_test_clear_auth()
returns void
language plpgsql
as $$
begin
  execute 'reset role';
  perform set_config('request.jwt.claim.sub', '', true);
  perform set_config('request.jwt.claims', '', true);
end;
$$;

-- ---------------------------------------------------------------------------
-- 1. Role helper truth under JWT identity
-- ---------------------------------------------------------------------------
do $$
declare
  v_admin uuid := 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1';
  v_reviewer uuid := 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2';
  v_office uuid := 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3';
  v_creator uuid := 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa4';
  v_tech uuid := 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa5';
begin
  perform pg_temp.mil_test_become(v_admin);
  if not public.mil_is_reviewer() or not public.mil_can_browse_library() then
    raise exception 'FAIL: admin should be reviewer + library staff';
  end if;
  perform pg_temp.mil_test_clear_auth();

  perform pg_temp.mil_test_become(v_reviewer);
  if not public.mil_is_reviewer() or not public.mil_can_browse_library() then
    raise exception 'FAIL: media_reviewer should be reviewer + library staff';
  end if;
  perform pg_temp.mil_test_clear_auth();

  perform pg_temp.mil_test_become(v_office);
  if public.mil_is_reviewer() then
    raise exception 'FAIL: office must NOT be mil_is_reviewer()';
  end if;
  if not public.mil_can_browse_library() then
    raise exception 'FAIL: office should browse the library';
  end if;
  perform pg_temp.mil_test_clear_auth();

  perform pg_temp.mil_test_become(v_creator);
  if public.mil_can_browse_library() or public.mil_is_reviewer() then
    raise exception 'FAIL: reel_creator must not browse library or review';
  end if;
  perform pg_temp.mil_test_clear_auth();

  perform pg_temp.mil_test_become(v_tech);
  if public.mil_can_browse_library() or public.mil_is_reviewer() or public.mil_is_staff() then
    raise exception 'FAIL: technician must not be MIL library staff/reviewer';
  end if;
  perform pg_temp.mil_test_clear_auth();
end $$;

-- ---------------------------------------------------------------------------
-- 2. Browse SELECT — staff yes, creator/tech no
-- ---------------------------------------------------------------------------
do $$
declare
  v_admin uuid := 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1';
  v_office uuid := 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3';
  v_creator uuid := 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa4';
  v_tech uuid := 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa5';
  v_asset uuid := 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1';
  v_n integer;
begin
  perform pg_temp.mil_test_become(v_admin);
  select count(*) into v_n from public.mil_assets where id = v_asset;
  if v_n <> 1 then
    raise exception 'FAIL: admin should SELECT mil_assets (got %)', v_n;
  end if;
  perform pg_temp.mil_test_clear_auth();

  perform pg_temp.mil_test_become(v_office);
  select count(*) into v_n from public.mil_assets where id = v_asset;
  if v_n <> 1 then
    raise exception 'FAIL: office should SELECT mil_assets (got %)', v_n;
  end if;
  perform pg_temp.mil_test_clear_auth();

  perform pg_temp.mil_test_become(v_creator);
  select count(*) into v_n from public.mil_assets where id = v_asset;
  if v_n <> 0 then
    raise exception 'FAIL: reel_creator must not browse mil_assets without assignment (got %)', v_n;
  end if;
  perform pg_temp.mil_test_clear_auth();

  perform pg_temp.mil_test_become(v_tech);
  select count(*) into v_n from public.mil_assets where id = v_asset;
  if v_n <> 0 then
    raise exception 'FAIL: technician must not browse mil_assets (got %)', v_n;
  end if;
  perform pg_temp.mil_test_clear_auth();
end $$;

-- ---------------------------------------------------------------------------
-- 3. Reviewer writes — office denied, media_reviewer allowed
-- ---------------------------------------------------------------------------
do $$
declare
  v_reviewer uuid := 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2';
  v_office uuid := 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3';
  v_asset uuid := 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1';
  v_denied boolean;
  v_n integer;
begin
  perform pg_temp.mil_test_become(v_office);
  v_denied := false;
  begin
    insert into public.mil_verified_metadata (asset_id, narrative, verified_by)
    values (v_asset, 'office forged', v_office);
  exception
    when insufficient_privilege then v_denied := true;
    when others then
      if sqlerrm ilike '%policy%' or sqlstate = '42501' then
        v_denied := true;
      else
        perform pg_temp.mil_test_clear_auth();
        raise;
      end if;
  end;
  perform pg_temp.mil_test_clear_auth();
  if not v_denied then
    raise exception 'FAIL: office was permitted to INSERT mil_verified_metadata';
  end if;

  perform pg_temp.mil_test_become(v_reviewer);
  insert into public.mil_verified_metadata (asset_id, narrative, verified_by, verified_at)
  values (v_asset, 'reviewer ok', v_reviewer, now());
  select count(*) into v_n from public.mil_verified_metadata where asset_id = v_asset;
  if v_n <> 1 then
    raise exception 'FAIL: media_reviewer INSERT mil_verified_metadata failed';
  end if;

  update public.mil_assets
  set human_review_status = 'in_review'
  where id = v_asset;
  select count(*) into v_n
  from public.mil_assets
  where id = v_asset and human_review_status = 'in_review';
  if v_n <> 1 then
    raise exception 'FAIL: media_reviewer should UPDATE mil_assets review status';
  end if;
  perform pg_temp.mil_test_clear_auth();

  -- Reset status as postgres, then prove office UPDATE is a no-op under RLS.
  update public.mil_assets set human_review_status = 'pending' where id = v_asset;

  perform pg_temp.mil_test_become(v_office);
  update public.mil_assets
  set human_review_status = 'verified'
  where id = v_asset;
  perform pg_temp.mil_test_clear_auth();

  select count(*) into v_n
  from public.mil_assets
  where id = v_asset and human_review_status = 'verified';
  if v_n <> 0 then
    raise exception 'FAIL: office was able to UPDATE mil_assets review status';
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 4. Collections membership writes — office (staff) yes, technician no
-- ---------------------------------------------------------------------------
do $$
declare
  v_office uuid := 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3';
  v_tech uuid := 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa5';
  v_asset uuid := 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1';
  v_collection uuid;
  v_denied boolean;
  v_n integer;
begin
  perform pg_temp.mil_test_become(v_office);
  insert into public.mil_collections (title, description, owner_user_id, visibility)
  values ('JWT RLS collection', 'seeded by office', v_office, 'internal')
  returning id into v_collection;

  insert into public.mil_collection_items (collection_id, asset_id, added_by)
  values (v_collection, v_asset, v_office);

  select count(*) into v_n
  from public.mil_collection_items
  where collection_id = v_collection and asset_id = v_asset;
  if v_n <> 1 then
    raise exception 'FAIL: office should add collection membership';
  end if;

  delete from public.mil_collection_items
  where collection_id = v_collection and asset_id = v_asset;
  select count(*) into v_n
  from public.mil_collection_items
  where collection_id = v_collection;
  if v_n <> 0 then
    raise exception 'FAIL: office should remove collection membership';
  end if;
  perform pg_temp.mil_test_clear_auth();

  perform pg_temp.mil_test_become(v_tech);
  v_denied := false;
  begin
    insert into public.mil_collections (title, owner_user_id, visibility)
    values ('tech forged', v_tech, 'internal');
  exception
    when insufficient_privilege then v_denied := true;
    when others then
      if sqlerrm ilike '%policy%' or sqlstate = '42501' then
        v_denied := true;
      else
        perform pg_temp.mil_test_clear_auth();
        raise;
      end if;
  end;
  perform pg_temp.mil_test_clear_auth();
  if not v_denied then
    raise exception 'FAIL: technician was permitted to INSERT mil_collections';
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 5. Storage policy behavior (catalog rows; not Storage HTTP API)
-- ---------------------------------------------------------------------------
-- Note: unrelated inspection-photos policies on storage.objects reference
-- public.inspections. Without SELECT on that table, ANY storage.objects query
-- as authenticated errors while evaluating those policies. Grant SELECT for
-- this rolled-back transaction only so MIL storage policies can be exercised.
do $$
declare
  v_admin uuid := 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1';
  v_office uuid := 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3';
  v_creator uuid := 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa4';
  v_tech uuid := 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa5';
  v_asset uuid := 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1';
  v_path text := 'mil/originals/' || 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1' || '/jwt-rls.jpg';
  v_qpath text := 'mil/quarantine/jwt-seed/x.jpg';
  v_n integer;
  v_denied boolean;
begin
  if to_regclass('storage.objects') is null then
    raise exception 'FAIL: storage.objects missing — local Supabase storage required';
  end if;

  if to_regclass('public.inspections') is not null then
    execute 'grant select on public.inspections to authenticated';
  end if;

  -- Seed catalog rows as postgres (service path).
  insert into storage.objects (id, bucket_id, name, owner, metadata)
  values
    (gen_random_uuid(), 'media-intel-originals', v_path, v_admin, '{}'::jsonb),
    (gen_random_uuid(), 'media-intel-originals', v_qpath, v_admin, '{}'::jsonb)
  on conflict do nothing;

  -- Quarantine INSERT allowed for staff; final originals path INSERT must fail.
  perform pg_temp.mil_test_become(v_office);
  insert into storage.objects (id, bucket_id, name, owner, metadata)
  values (gen_random_uuid(), 'media-intel-originals', 'mil/quarantine/jwt-seed/office.jpg', v_office, '{}'::jsonb);

  v_denied := false;
  begin
    insert into storage.objects (id, bucket_id, name, owner, metadata)
    values (gen_random_uuid(), 'media-intel-originals', 'mil/originals/forged/final.jpg', v_office, '{}'::jsonb);
  exception
    when insufficient_privilege then v_denied := true;
    when others then
      if sqlerrm ilike '%policy%' or sqlstate = '42501' then
        v_denied := true;
      else
        perform pg_temp.mil_test_clear_auth();
        raise;
      end if;
  end;
  if not v_denied then
    raise exception 'FAIL: office was permitted to INSERT non-quarantine original path';
  end if;

  select count(*) into v_n
  from storage.objects
  where bucket_id = 'media-intel-originals' and name = v_path;
  if v_n <> 1 then
    raise exception 'FAIL: office/staff should SELECT mil originals storage row (got %)', v_n;
  end if;
  perform pg_temp.mil_test_clear_auth();

  perform pg_temp.mil_test_become(v_creator);
  select count(*) into v_n
  from storage.objects
  where bucket_id = 'media-intel-originals' and name = v_path;
  if v_n <> 0 then
    raise exception 'FAIL: creator must not SELECT mil originals storage (got %)', v_n;
  end if;
  perform pg_temp.mil_test_clear_auth();

  perform pg_temp.mil_test_become(v_tech);
  select count(*) into v_n
  from storage.objects
  where bucket_id = 'media-intel-originals' and name = v_path;
  if v_n <> 0 then
    raise exception 'FAIL: technician must not SELECT mil originals storage (got %)', v_n;
  end if;
  perform pg_temp.mil_test_clear_auth();

  -- Silence unused asset binding (documents the object under test).
  perform 1 from public.mil_assets where id = v_asset;
end $$;

select 'mil 05_jwt_rls_behavior: PASS' as result;

rollback;

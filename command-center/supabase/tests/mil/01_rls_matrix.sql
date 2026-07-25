-- MIL RLS capability matrix contract (structural — no role seed required)
-- Run after migrations apply. Documents expected policies via pg_policies queries.
--
-- Role matrix reference (enforcement split across helpers + policies + edge fns):
--
-- | Surface                         | Admin/Manager | Reviewer | Office | Creator | Session bearer |
-- |---------------------------------|---------------|----------|--------|---------|----------------|
-- | Browse mil_* (SELECT)           | Y             | Y        | Y      | partial | N              |
-- | Reviewer write metadata/tags    | Y             | Y        | N      | N       | N              |
-- | Owner-admin permitted uses      | Y             | N        | N      | N       | N              |
-- | Creator reel project SELECT     | Y (browse)    | Y        | Y      | own     | N              |
-- | Creator reel INSERT/UPDATE      | N             | N        | N      | own     | N              |
-- | Owner reel approve UPDATE       | Y             | N        | N      | N       | N              |
-- | Upload session/grant tables     | service edge  | —        | —      | —       | edge only      |
--
-- phone_uploader: NOT a library role — no mil_browse_* policy should reference it.
-- Session bearer auth is out-of-band (mil_upload_sessions token hash), not RLS role.

\set ON_ERROR_STOP on

-- ---------------------------------------------------------------------------
-- Required browse SELECT policies (library staff via mil_can_browse_library)
-- ---------------------------------------------------------------------------
do $$
declare
  v_missing text;
begin
  select string_agg(expected.tablename, ', ' order by expected.tablename)
  into v_missing
  from (
    values
      ('mil_assets'),
      ('mil_upload_batches'),
      ('mil_manifest_entries'),
      ('mil_derivatives'),
      ('mil_verified_metadata'),
      ('mil_ai_analyses'),
      ('mil_audit_events')
  ) as expected(tablename)
  left join pg_policies p
    on p.schemaname = 'public'
   and p.tablename = expected.tablename
   and p.policyname like 'mil_browse_%'
   and p.cmd = 'SELECT'
  where p.policyname is null;

  if v_missing is not null then
    raise exception 'Missing mil_browse_* SELECT policies on: %', v_missing;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Reviewer write policies must reference mil_is_reviewer(), not mil_can_browse_library()
-- ---------------------------------------------------------------------------
do $$
declare
  v_bad text;
begin
  select string_agg(policyname || ' on ' || tablename, '; ')
  into v_bad
  from pg_policies
  where schemaname = 'public'
    and policyname like 'mil_reviewer_write_%'
    and (
      coalesce(qual, '') not ilike '%mil_is_reviewer()%'
      or coalesce(with_check, qual, '') not ilike '%mil_is_reviewer()%'
    );

  if v_bad is not null then
    raise exception 'Reviewer write policies must use mil_is_reviewer(): %', v_bad;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Office must NOT receive reviewer write policies (mil_is_reviewer excludes office)
-- ---------------------------------------------------------------------------
do $$
declare
  v_count integer;
begin
  select count(*)
  into v_count
  from pg_policies
  where schemaname = 'public'
    and policyname like 'mil_reviewer_%'
    and (
      coalesce(qual, '') ilike '%office%'
      or coalesce(with_check, '') ilike '%office%'
    );

  if v_count > 0 then
    raise exception 'Found mil_reviewer_* policies referencing office directly (should use mil_is_reviewer only)';
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Owner-admin-only surfaces
-- ---------------------------------------------------------------------------
do $$
declare
  v_bad text;
begin
  select string_agg(policyname || ' on ' || tablename, '; ')
  into v_bad
  from pg_policies
  where schemaname = 'public'
    and policyname in (
      'mil_permitted_uses_owner_all',
      'mil_website_promotions_owner_all',
      'mil_creator_assignments_owner_all'
    )
    and (
      coalesce(qual, '') not ilike '%mil_is_owner_admin()%'
      or coalesce(with_check, qual, '') not ilike '%mil_is_owner_admin()%'
    );

  if v_bad is not null then
    raise exception 'Owner-admin policies must use mil_is_owner_admin(): %', v_bad;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Creator policies: SELECT/INSERT/UPDATE scoped to creator + assignment checks
-- ---------------------------------------------------------------------------
do $$
declare
  v_missing text;
begin
  select string_agg(expected.policyname, ', ')
  into v_missing
  from (
    values
      ('mil_creator_select_reel_projects'),
      ('mil_creator_insert_reel_projects'),
      ('mil_creator_update_reel_projects'),
      ('mil_creator_select_reel_versions')
  ) as expected(policyname)
  left join pg_policies p
    on p.schemaname = 'public'
   and p.policyname = expected.policyname
  where p.policyname is null;

  if v_missing is not null then
    raise exception 'Missing creator reel policies: %', v_missing;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- No phone_uploader library policies
-- ---------------------------------------------------------------------------
do $$
declare
  v_names text;
begin
  select string_agg(policyname || ' on ' || tablename, '; ')
  into v_names
  from pg_policies
  where schemaname = 'public'
    and (
      policyname ilike '%phone_uploader%'
      or coalesce(qual, '') ilike '%phone_uploader%'
      or coalesce(with_check, '') ilike '%phone_uploader%'
    );

  if v_names is not null then
    raise exception 'phone_uploader must not appear in MIL RLS policies (session bearer only): %', v_names;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- No forbidden broad policies
-- ---------------------------------------------------------------------------
do $$
declare
  v_names text;
begin
  select string_agg(policyname || ' on ' || tablename, '; ')
  into v_names
  from pg_policies
  where schemaname = 'public'
    and tablename like 'mil_%'
    and policyname in (
      'mil_staff_all',
      'mil_reel_staff_all',
      'mil_reel_creator_all',
      'mil_reel_broad_select',
      'mil_phone_uploader_all'
    );

  if v_names is not null then
    raise exception 'Forbidden broad MIL policies still present: %', v_names;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Future: role-seeded integration tests (require test users in app_user_roles)
-- ---------------------------------------------------------------------------
-- After seeding users, run as each role:
--   set local role authenticated;
--   set request.jwt.claim.sub = '<user_uuid>';
--   select count(*) from mil_assets;  -- expect 0+ for library staff, deny for technician
-- Session bearer flows cannot be tested via JWT role alone — use edge integration tests.

select 'mil 01_rls_matrix: PASS (structural)' as result;

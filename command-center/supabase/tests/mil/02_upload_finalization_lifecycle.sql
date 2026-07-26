-- MIL upload finalization lifecycle — structural contract tests.
-- Usage: psql "$DATABASE_URL" -f supabase/tests/mil/02_upload_finalization_lifecycle.sql
-- Requires migrations through 20260726090000.
--
-- Plain SQL assertions (no pgTAP). Each block raises on failure.

\set ON_ERROR_STOP on

-- ---------------------------------------------------------------------------
-- 1. Batch carries a separate abandoned counter
-- ---------------------------------------------------------------------------
do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'mil_upload_batches' and column_name = 'abandoned_count'
  ) then
    raise exception 'mil_upload_batches.abandoned_count missing';
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 2. Grant finalization columns
-- ---------------------------------------------------------------------------
do $$
declare
  v_col text;
begin
  foreach v_col in array array[
    'finalize_state', 'finalize_reason', 'verified_sha256', 'verified_mime', 'verified_bytes',
    'final_object_path', 'canonical_asset_id', 'finalize_attempts', 'finalize_lease_owner',
    'finalize_lease_expires_at', 'commit_deadline_at', 'upload_token_expires_at',
    'quarantine_cleanup_after', 'quarantine_cleaned_at'
  ]
  loop
    if not exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'mil_upload_grants' and column_name = v_col
    ) then
      raise exception 'mil_upload_grants.% missing', v_col;
    end if;
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- 3. finalize_state is constrained to the documented lifecycle
-- ---------------------------------------------------------------------------
do $$
declare
  v_def text;
  v_state text;
begin
  select pg_get_constraintdef(c.oid) into v_def
  from pg_constraint c
  join pg_class t on t.oid = c.conrelid
  join pg_namespace n on n.oid = t.relnamespace
  where n.nspname = 'public'
    and t.relname = 'mil_upload_grants'
    and c.conname = 'mil_upload_grants_finalize_state_check';

  if v_def is null then
    raise exception 'mil_upload_grants_finalize_state_check not found';
  end if;

  foreach v_state in array array['minted', 'placing', 'placed', 'committed', 'duplicate', 'failed', 'abandoned']
  loop
    if v_def not like '%''' || v_state || '''%' then
      raise exception 'finalize_state check missing %; got: %', v_state, v_def;
    end if;
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- 4. Paths are constrained to the canonical constructed form
-- ---------------------------------------------------------------------------
do $$
declare
  v_quarantine text;
  v_final text;
begin
  select pg_get_constraintdef(c.oid) into v_quarantine
  from pg_constraint c join pg_class t on t.oid = c.conrelid
  where t.relname = 'mil_upload_grants' and c.conname = 'mil_upload_grants_quarantine_path_check';

  select pg_get_constraintdef(c.oid) into v_final
  from pg_constraint c join pg_class t on t.oid = c.conrelid
  where t.relname = 'mil_upload_grants' and c.conname = 'mil_upload_grants_final_path_check';

  if v_quarantine is null then
    raise exception 'mil_upload_grants_quarantine_path_check not found';
  end if;
  if v_final is null then
    raise exception 'mil_upload_grants_final_path_check not found';
  end if;
  if v_quarantine not ilike '%mil_quarantine_object_path%' then
    raise exception 'quarantine path check must use the canonical constructor; got: %', v_quarantine;
  end if;
  if v_final not ilike '%mil_original_object_path%' then
    raise exception 'final path check must use the canonical constructor; got: %', v_final;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 5. No replace()-derived final path anywhere in the finalization functions
-- ---------------------------------------------------------------------------
do $$
declare
  v_src text;
  v_name text;
begin
  foreach v_name in array array[
    'mil_begin_upload_finalize', 'mil_mark_upload_placed', 'mil_commit_upload_finalize',
    'mil_reconcile_upload_finalization'
  ]
  loop
    select pg_get_functiondef(p.oid) into v_src
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = v_name;

    if v_src ilike '%replace(%mil/quarantine/%' then
      raise exception '% still derives the final path with replace()', v_name;
    end if;
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- 6. Integrity alerts: owner/admin SELECT only, no write policies
-- ---------------------------------------------------------------------------
do $$
declare
  v_rls boolean;
  v_write integer;
  v_select integer;
begin
  select relrowsecurity into v_rls
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relname = 'mil_integrity_alerts';

  if v_rls is null then
    raise exception 'mil_integrity_alerts table not found';
  end if;
  if not v_rls then
    raise exception 'mil_integrity_alerts must have row level security enabled';
  end if;

  select count(*) into v_select
  from pg_policies
  where schemaname = 'public' and tablename = 'mil_integrity_alerts' and cmd = 'SELECT';

  select count(*) into v_write
  from pg_policies
  where schemaname = 'public' and tablename = 'mil_integrity_alerts' and cmd <> 'SELECT';

  if v_select < 1 then
    raise exception 'mil_integrity_alerts needs an owner/admin SELECT policy';
  end if;
  if v_write > 0 then
    raise exception 'mil_integrity_alerts must have no client write policies';
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'mil_integrity_alerts'
      and qual ilike '%mil_is_owner_admin%'
  ) then
    raise exception 'mil_integrity_alerts SELECT must be gated by mil_is_owner_admin()';
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 7. Manifest entries bind to a grant, at most one row per grant
-- ---------------------------------------------------------------------------
do $$
declare
  v_def text;
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'mil_manifest_entries' and column_name = 'grant_id'
  ) then
    raise exception 'mil_manifest_entries.grant_id missing';
  end if;

  select indexdef into v_def
  from pg_indexes
  where schemaname = 'public' and indexname = 'mil_manifest_entries_grant_uniq';

  if v_def is null then
    raise exception 'mil_manifest_entries_grant_uniq missing';
  end if;
  if v_def not ilike '%unique%' or v_def not ilike '%where (grant_id is not null)%' then
    raise exception 'mil_manifest_entries_grant_uniq must be a partial unique index; got: %', v_def;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 8. One active asset per checksum
-- ---------------------------------------------------------------------------
do $$
declare
  v_def text;
begin
  select indexdef into v_def
  from pg_indexes
  where schemaname = 'public' and indexname = 'mil_assets_active_checksum_uniq';

  if v_def is null then
    raise exception 'mil_assets_active_checksum_uniq missing';
  end if;
  if v_def not ilike '%unique%'
     or v_def not ilike '%checksum_sha256%'
     or v_def not ilike '%where (archived_at is null)%' then
    raise exception 'mil_assets_active_checksum_uniq must be unique on checksum where archived_at is null; got: %', v_def;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 9. Upload lifecycle tables are not client-writable (table grants, not just RLS)
-- ---------------------------------------------------------------------------
do $$
declare
  v_table text;
  v_role text;
  v_priv text;
begin
  foreach v_table in array array[
    'mil_upload_batches', 'mil_upload_grants', 'mil_manifest_entries',
    'mil_upload_sessions', 'mil_integrity_alerts'
  ]
  loop
    foreach v_role in array array['authenticated', 'anon']
    loop
      foreach v_priv in array array['INSERT', 'UPDATE', 'DELETE']
      loop
        if has_table_privilege(v_role, 'public.' || v_table, v_priv) then
          raise exception '% must not have % on public.%', v_role, v_priv, v_table;
        end if;
      end loop;
    end loop;

    if not has_table_privilege('authenticated', 'public.' || v_table, 'SELECT') then
      raise exception 'authenticated lost SELECT on public.% (browse must still work)', v_table;
    end if;
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- 10. mil_assets: no client INSERT/DELETE, UPDATE retained for reviewers
-- ---------------------------------------------------------------------------
do $$
begin
  if has_table_privilege('authenticated', 'public.mil_assets', 'INSERT') then
    raise exception 'authenticated must not INSERT mil_assets — only the commit RPC creates assets';
  end if;
  if has_table_privilege('authenticated', 'public.mil_assets', 'DELETE') then
    raise exception 'authenticated must not DELETE mil_assets';
  end if;
  if not has_table_privilege('authenticated', 'public.mil_assets', 'UPDATE') then
    raise exception 'authenticated must retain UPDATE on mil_assets for the reviewer policy';
  end if;
  if not has_table_privilege('authenticated', 'public.mil_assets', 'SELECT') then
    raise exception 'authenticated must retain SELECT on mil_assets';
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 11. Retired batch write policies are gone
-- ---------------------------------------------------------------------------
do $$
declare
  v_names text;
begin
  select string_agg(policyname, ', ') into v_names
  from pg_policies
  where schemaname = 'public'
    and policyname in ('mil_library_staff_write_upload_batches', 'mil_library_staff_update_upload_batches');

  if v_names is not null then
    raise exception 'batch write policies still present: %', v_names;
  end if;
end $$;

select 'mil 02_upload_finalization_lifecycle: PASS' as result;

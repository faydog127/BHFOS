-- MIL upload lifecycle — behavioral privilege tests.
-- Usage: psql "$DATABASE_URL" -f supabase/tests/mil/04_upload_privilege_matrix.sql
-- Requires migrations through 20260726090000.
--
-- These actually attempt the writes as `authenticated` and `anon` rather than
-- reading a policy catalogue. A policy that looks right but sits on a table the
-- role can still write to is not a control, and only an attempted write shows
-- the difference.

\set ON_ERROR_STOP on

begin;

-- ---------------------------------------------------------------------------
-- 1. Client roles cannot write any upload lifecycle table
-- ---------------------------------------------------------------------------
do $$
declare
  v_role text;
  v_stmt text;
  v_denied boolean;
  v_attempts text[] := array[
    'insert into public.mil_upload_batches (source_label) values (''forged'')',
    'update public.mil_upload_batches set success_count = 999',
    'delete from public.mil_upload_batches',
    'insert into public.mil_manifest_entries (batch_id, original_filename) values (gen_random_uuid(), ''forged.jpg'')',
    'update public.mil_manifest_entries set upload_status = ''uploaded''',
    'insert into public.mil_upload_grants (session_id, batch_id, asset_id, object_path, content_type, max_bytes, original_filename, expires_at) values (gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), ''mil/quarantine/x'', ''image/jpeg'', 1, ''x.jpg'', now())',
    'update public.mil_upload_grants set finalize_state = ''committed''',
    'insert into public.mil_upload_sessions (token_hash, expires_at) values (''forged'', now())',
    'update public.mil_upload_sessions set expires_at = now() + interval ''1 year''',
    'insert into public.mil_integrity_alerts (alert_key) values (''forged'')',
    'update public.mil_integrity_alerts set acknowledged_at = now()',
    'delete from public.mil_integrity_alerts',
    'insert into public.mil_assets (media_kind, mime_type, byte_size, checksum_sha256, original_filename, original_path) values (''photo'', ''image/jpeg'', 1, ''deadbeef'', ''x.jpg'', ''mil/originals/x'')',
    'delete from public.mil_assets'
  ];
begin
  foreach v_role in array array['authenticated', 'anon']
  loop
    foreach v_stmt in array v_attempts
    loop
      v_denied := false;
      execute format('set local role %I', v_role);
      begin
        execute v_stmt;
      exception
        when insufficient_privilege then v_denied := true;
        when others then
          execute 'reset role';
          raise exception 'FAIL: % got unexpected % (%) running: %', v_role, sqlstate, sqlerrm, v_stmt;
      end;
      execute 'reset role';

      if not v_denied then
        raise exception 'FAIL: % was permitted to run: %', v_role, v_stmt;
      end if;
    end loop;
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- 2. Client roles cannot execute any finalization RPC
-- ---------------------------------------------------------------------------
do $$
declare
  v_role text;
  v_call text;
  v_denied boolean;
  v_calls text[] := array[
    'select public.mil_begin_upload_finalize(gen_random_uuid(), ''x'')',
    'select public.mil_mark_upload_placed(gen_random_uuid(), ''x'', ''p'', ''a'', ''image/jpeg'', 1)',
    'select public.mil_commit_upload_finalize(gen_random_uuid(), ''x'')',
    'select public.mil_fail_upload_finalize(gen_random_uuid(), ''x'', ''r'')',
    'select public.mil_recount_upload_batch(gen_random_uuid())',
    'select public.mil_abandon_expired_upload_grants(1)',
    'select public.mil_reconcile_upload_finalization(null, 1)',
    'select public.mil_storage_catalog_probe(''media-intel-originals'', ''mil/originals/x'')',
    'select public.mil_raise_integrity_alert(''forged'')'
  ];
begin
  foreach v_role in array array['authenticated', 'anon']
  loop
    foreach v_call in array v_calls
    loop
      v_denied := false;
      execute format('set local role %I', v_role);
      begin
        execute v_call;
      exception
        when insufficient_privilege then v_denied := true;
        when others then
          execute 'reset role';
          raise exception 'FAIL: % got unexpected % (%) calling: %', v_role, sqlstate, sqlerrm, v_call;
      end;
      execute 'reset role';

      if not v_denied then
        raise exception 'FAIL: % was permitted to call: %', v_role, v_call;
      end if;
    end loop;
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- 3. What clients must still be able to do
--    Browse SELECTs and the reviewer UPDATE on mil_assets stay intact; RLS (not
--    a missing grant) is what filters the rows.
-- ---------------------------------------------------------------------------
do $$
declare
  v_stmt text;
  v_allowed text[] := array[
    'select count(*) from public.mil_upload_batches',
    'select count(*) from public.mil_manifest_entries',
    'select count(*) from public.mil_assets',
    'select count(*) from public.mil_integrity_alerts',
    'update public.mil_assets set human_review_status = ''in_review'' where false'
  ];
begin
  foreach v_stmt in array v_allowed
  loop
    execute 'set local role authenticated';
    begin
      execute v_stmt;
    exception
      when others then
        execute 'reset role';
        raise exception 'FAIL: authenticated should still be able to run "%" but got % (%)',
          v_stmt, sqlstate, sqlerrm;
    end;
    execute 'reset role';
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- 4. service_role keeps the execute rights the edge functions depend on
-- ---------------------------------------------------------------------------
do $$
declare
  v_fn text;
begin
  foreach v_fn in array array[
    'public.mil_begin_upload_finalize(uuid, text, integer, integer)',
    'public.mil_mark_upload_placed(uuid, text, text, text, text, bigint, integer)',
    'public.mil_commit_upload_finalize(uuid, text, text, boolean, bigint, text, uuid, text, text, bigint)',
    'public.mil_fail_upload_finalize(uuid, text, text, boolean)',
    'public.mil_recount_upload_batch(uuid)',
    'public.mil_abandon_expired_upload_grants(integer)',
    'public.mil_reconcile_upload_finalization(uuid, integer, text)',
    'public.mil_storage_catalog_probe(text, text)',
    'public.mil_raise_integrity_alert(text, text, uuid, uuid, uuid, text, text, jsonb)'
  ]
  loop
    if not has_function_privilege('service_role', v_fn, 'EXECUTE') then
      raise exception 'FAIL: service_role cannot execute %', v_fn;
    end if;
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- 5. service_role keeps the direct table access the edge functions depend on
--    (upload-session and upload-reconcile read and update these tables outside
--    the definer RPCs).
-- ---------------------------------------------------------------------------
do $$
declare
  v_table text;
  v_priv text;
begin
  foreach v_table in array array[
    'mil_upload_batches', 'mil_upload_grants', 'mil_manifest_entries',
    'mil_upload_sessions', 'mil_integrity_alerts', 'mil_assets'
  ]
  loop
    foreach v_priv in array array['SELECT', 'INSERT', 'UPDATE', 'DELETE']
    loop
      if not has_table_privilege('service_role', 'public.' || v_table, v_priv) then
        raise exception 'FAIL: service_role lost % on public.%', v_priv, v_table;
      end if;
    end loop;
  end loop;
end $$;

rollback;

select 'mil 04_upload_privilege_matrix: PASS' as result;

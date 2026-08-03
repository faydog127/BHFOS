-- MIL Phase 2A isolated verification suite (disposable local DB only).
-- Invoked by tools/mil-phase2a-sql-smoke.mjs after Migration A+B apply.
-- Never run against wwyxohjnyqnegzbxtuxs / production.

\set ON_ERROR_STOP on

do $$
begin
  if current_setting('mil.phase2a_verify', true) is distinct from '1' then
    -- Allow direct psql when operator sets the GUC; the Node runner always sets it.
    perform set_config('mil.phase2a_verify', '1', true);
  end if;
end $$;

-- =====================================================================
-- 1. Creator role grant tenant handling
-- =====================================================================
do $$
declare
  v_actor uuid := gen_random_uuid();
  v_user uuid := gen_random_uuid();
  v_other uuid := gen_random_uuid();
  v_grant jsonb;
  v_grant2 jsonb;
  v_rev jsonb;
  v_roles int;
  v_audit int;
  v_err text;
begin
  insert into auth.users (
    id, instance_id, aud, role, email, encrypted_password,
    email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
    created_at, updated_at, confirmation_token, recovery_token,
    email_change_token_new, email_change
  ) values
    (v_actor, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
     'phase2a-actor@example.test', crypt('x', gen_salt('bf')), now(),
     '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb,
     now(), now(), '', '', '', ''),
    (v_user, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
     'phase2a-creator@example.test', crypt('x', gen_salt('bf')), now(),
     '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb,
     now(), now(), '', '', '', ''),
    (v_other, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
     'phase2a-other@example.test', crypt('x', gen_salt('bf')), now(),
     '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb,
     now(), now(), '', '', '', '')
  on conflict (id) do nothing;

  insert into public.app_user_roles (user_id, role, tenant_id)
  values (v_actor, 'admin', 'tvg');

  -- Valid MIL tenant grant
  v_grant := public.mil_grant_creator_role_audited(v_user, v_actor, '{"via":"phase2a"}'::jsonb, null, null);
  if coalesce((v_grant->>'ok')::boolean, false) is not true then
    raise exception 'VERIFY_FAIL creator grant did not succeed: %', v_grant;
  end if;
  if v_grant->>'tenant_id' is distinct from 'tvg' then
    raise exception 'VERIFY_FAIL creator grant tenant_id expected tvg got %', v_grant->>'tenant_id';
  end if;

  -- Duplicate grant idempotent
  v_grant2 := public.mil_grant_creator_role_audited(v_user, v_actor, '{"via":"phase2a-dup"}'::jsonb, null, null);
  if coalesce((v_grant2->>'ok')::boolean, false) is not true
     or coalesce((v_grant2->>'idempotent')::boolean, false) is not true then
    raise exception 'VERIFY_FAIL duplicate grant not idempotent: %', v_grant2;
  end if;

  -- Cross-tenant denied
  begin
    perform public.mil_grant_creator_role_audited(v_other, v_actor, '{}'::jsonb, null, 'other_co');
    raise exception 'VERIFY_FAIL cross-tenant grant should have been denied';
  exception when others then
    v_err := SQLERRM;
    if position('CROSS_TENANT_DENIED' in v_err) = 0 then
      raise exception 'VERIFY_FAIL expected CROSS_TENANT_DENIED got %', v_err;
    end if;
  end;

  -- Audit created
  select count(*)::int into v_audit
  from public.mil_audit_events
  where action = 'creator_invited' and target_id = v_user;
  if v_audit < 1 then
    raise exception 'VERIFY_FAIL creator invite audit missing';
  end if;

  -- Audit failure rolls back role row
  begin
    create temp table if not exists mil_phase2a_force_fail (x int);
    create or replace function pg_temp.mil_fail_creator_audit()
    returns trigger language plpgsql as $t$
    begin
      if NEW.action = 'creator_invited' and NEW.details ? 'force_fail' then
        raise exception 'forced audit failure';
      end if;
      return NEW;
    end;
    $t$;
    drop trigger if exists mil_phase2a_fail_audit on public.mil_audit_events;
    create trigger mil_phase2a_fail_audit
      before insert on public.mil_audit_events
      for each row execute function pg_temp.mil_fail_creator_audit();

    begin
      perform public.mil_grant_creator_role_audited(
        v_other, v_actor, '{"force_fail":true}'::jsonb, null, null
      );
      raise exception 'VERIFY_FAIL expected audit failure to abort grant';
    exception when others then
      if position('forced audit failure' in SQLERRM) = 0 then
        raise exception 'VERIFY_FAIL unexpected grant/audit error: %', SQLERRM;
      end if;
    end;

    select count(*)::int into v_roles
    from public.app_user_roles
    where user_id = v_other and public.mil_normalize_role(role) = 'reel_creator';
    if v_roles <> 0 then
      raise exception 'VERIFY_FAIL partial role row remained after audit failure';
    end if;

    drop trigger if exists mil_phase2a_fail_audit on public.mil_audit_events;
  end;

  -- Revoke works
  v_rev := public.mil_revoke_creator_access_audited(v_user, v_actor, '{}'::jsonb, null, null);
  if coalesce((v_rev->>'ok')::boolean, false) is not true
     or coalesce((v_rev->>'revokedRoleRows')::int, 0) < 1 then
    raise exception 'VERIFY_FAIL revoke failed: %', v_rev;
  end if;

  raise notice 'PASS creator_role_grant_tenant';
end $$;

-- =====================================================================
-- 2. Protected-column denial (PostgREST-equivalent authenticated role)
-- =====================================================================
do $$
declare
  v_admin uuid;
  v_asset uuid := gen_random_uuid();
  v_ok boolean;
begin
  select user_id into v_admin
  from public.app_user_roles
  where public.mil_normalize_role(role) = 'admin'
  order by created_at desc nulls last
  limit 1;
  if v_admin is null then
    raise exception 'VERIFY_FAIL no admin user for asset fixture';
  end if;

  insert into public.mil_assets (
    id, media_kind, mime_type, byte_size, checksum_sha256,
    original_filename, original_path, created_by_user_id
  ) values (
    v_asset, 'photo', 'image/jpeg', 1024, repeat('ab', 32),
    'phase2a-lock.jpg', 'mil/originals/' || v_asset::text || '/phase2a-lock.jpg', v_admin
  );

  perform set_config('request.jwt.claim.sub', v_admin::text, true);
  perform set_config(
    'request.jwt.claims',
    json_build_object('sub', v_admin::text, 'role', 'authenticated')::text,
    true
  );
  execute 'set local role authenticated';

  begin
    update public.mil_assets set human_review_status = 'verified' where id = v_asset;
    raise exception 'VERIFY_FAIL protected human_review_status update should be denied';
  exception when insufficient_privilege then
    null;
  when others then
    if SQLSTATE not in ('42501') then
      raise exception 'VERIFY_FAIL unexpected protected update error: % / %', SQLSTATE, SQLERRM;
    end if;
  end;

  begin
    update public.mil_assets set privacy_status = 'clear' where id = v_asset;
    raise exception 'VERIFY_FAIL protected privacy_status update should be denied';
  exception when insufficient_privilege then
    null;
  when others then
    if SQLSTATE not in ('42501') then
      raise exception 'VERIFY_FAIL unexpected privacy update error: % / %', SQLSTATE, SQLERRM;
    end if;
  end;

  -- Ordinary metadata still allowed
  update public.mil_assets set original_filename = 'phase2a-renamed.jpg' where id = v_asset;
  if not found then
    raise exception 'VERIFY_FAIL ordinary metadata update failed';
  end if;

  reset role;

  -- Compliance / lifecycle / permitted-use RPCs still succeed (SECURITY DEFINER)
  perform set_config('request.jwt.claim.sub', v_admin::text, true);
  perform set_config(
    'request.jwt.claims',
    json_build_object('sub', v_admin::text, 'role', 'authenticated')::text,
    true
  );

  -- Clear gates required by mil_enforce_public_use_gates before website approval
  perform public.mil_set_asset_compliance(
    v_asset, 'clear', 'tvg_owned', 'not_required', 'phase2a'
  );
  perform public.mil_set_permitted_use(v_asset, 'website', true, 'phase2a');
  perform public.mil_set_asset_lifecycle(v_asset, 'archive', 'phase2a verify');

  -- Rollback must not restore anonymous mutation (checked in post-rollback too)
  if has_table_privilege('anon', 'public.mil_assets', 'update') then
    raise exception 'VERIFY_FAIL anon must not have mil_assets UPDATE';
  end if;

  raise notice 'PASS protected_column_denial';
end $$;

-- =====================================================================
-- 3. Essential audit rollback (website unpublish mutation+audit atomicity)
-- =====================================================================
do $$
declare
  v_actor uuid;
  v_asset uuid;
  v_der uuid := gen_random_uuid();
  v_promo uuid := gen_random_uuid();
  v_pub_before int;
  v_pub_after int;
begin
  select user_id into v_actor from public.app_user_roles
  where public.mil_normalize_role(role) = 'admin' limit 1;
  select id into v_asset from public.mil_assets order by created_at desc limit 1;

  begin
    insert into public.mil_derivatives (id, asset_id, kind, bucket, object_path, mime_type)
    values (
      v_der, v_asset, 'website_optimized', 'website-public-media',
      'mil/website/' || v_asset::text || '-p2a.jpg', 'image/jpeg'
    );
  exception when others then
    select id into v_der from public.mil_derivatives where asset_id = v_asset limit 1;
  end;

  insert into public.mil_website_promotions (id, asset_id, derivative_id, promoted_by)
  values (v_promo, v_asset, v_der, v_actor);

  create or replace function pg_temp.mil_fail_unpub_audit()
  returns trigger language plpgsql as $t$
  begin
    if NEW.action = 'website_unpublish' and NEW.details ? 'force_fail' then
      raise exception 'forced unpublish audit failure';
    end if;
    return NEW;
  end;
  $t$;
  drop trigger if exists mil_phase2a_fail_unpub on public.mil_audit_events;
  create trigger mil_phase2a_fail_unpub
    before insert on public.mil_audit_events
    for each row execute function pg_temp.mil_fail_unpub_audit();

  select count(*)::int into v_pub_before
  from public.mil_website_promotions
  where id = v_promo and unpublished_at is null;

  begin
    perform public.mil_unpublish_website_audited(
      v_actor, v_asset, '{"force_fail":true}'::jsonb, null
    );
    raise exception 'VERIFY_FAIL expected unpublish audit failure';
  exception when others then
    if position('forced unpublish audit failure' in SQLERRM) = 0 then
      raise exception 'VERIFY_FAIL unexpected unpublish error: %', SQLERRM;
    end if;
  end;

  select count(*)::int into v_pub_after
  from public.mil_website_promotions
  where id = v_promo and unpublished_at is null;
  if v_pub_after <> v_pub_before then
    raise exception 'VERIFY_FAIL unpublish mutation not rolled back after audit failure';
  end if;

  drop trigger if exists mil_phase2a_fail_unpub on public.mil_audit_events;
  raise notice 'PASS essential_audit_rollback';
end $$;

-- =====================================================================
-- 4. Outbox stale claim / duplicate projection / sanitization / terminal
-- =====================================================================
do $$
declare
  v_id uuid;
  v_id2 uuid;
  v_claimed public.mil_audit_outbox%rowtype;
  v_proj1 jsonb;
  v_proj2 jsonb;
  v_events int;
  v_row public.mil_audit_outbox%rowtype;
  v_safe text;
begin
  v_id := public.mil_outbox_enqueue(
    'access', 'phase2a_stale_claim', 'mil_assets', null, null,
    '{"note":"stale"}'::jsonb, 'phase2a:stale:' || gen_random_uuid()::text
  );

  update public.mil_audit_outbox
  set status = 'processing',
      claimed_by = 'crashed-worker',
      claimed_at = now() - interval '20 minutes',
      attempt_count = 1
  where id = v_id;

  select * into v_claimed
  from public.mil_outbox_claim_batch(5, 'recover-worker', 8, 300)
  where id = v_id;
  if v_claimed.id is null then
    raise exception 'VERIFY_FAIL stale processing row was not reclaimed';
  end if;

  -- Duplicate projection prevention
  v_proj1 := public.mil_outbox_project_one(v_id);
  if coalesce((v_proj1->>'ok')::boolean, false) is not true then
    raise exception 'VERIFY_FAIL first projection failed: %', v_proj1;
  end if;
  -- Reset to processing to simulate reprocess attempt after deliver race
  update public.mil_audit_outbox
  set status = 'processing', completed_at = null, claimed_at = now() - interval '20 minutes'
  where id = v_id;
  v_proj2 := public.mil_outbox_project_one(v_id);
  if coalesce((v_proj2->>'ok')::boolean, false) is not true then
    raise exception 'VERIFY_FAIL reproject should be idempotent ok: %', v_proj2;
  end if;
  select count(*)::int into v_events from public.mil_audit_events where outbox_id = v_id;
  if v_events <> 1 then
    raise exception 'VERIFY_FAIL expected exactly 1 projected event, got %', v_events;
  end if;

  -- Duplicate idempotency key
  v_id2 := public.mil_outbox_enqueue(
    'access', 'phase2a_dup_key', 'mil_assets', null, null,
    '{}'::jsonb, 'phase2a:fixed-idempotency-key'
  );
  if public.mil_outbox_enqueue(
    'access', 'phase2a_dup_key', 'mil_assets', null, null,
    '{}'::jsonb, 'phase2a:fixed-idempotency-key'
  ) is distinct from v_id2 then
    raise exception 'VERIFY_FAIL duplicate idempotency key should return same outbox id';
  end if;

  -- Retry backoff + terminal failure
  v_id := public.mil_outbox_enqueue(
    'access', 'phase2a_fail_path', 'mil_assets', null, null,
    '{}'::jsonb, 'phase2a:fail:' || gen_random_uuid()::text
  );
  update public.mil_audit_outbox set attempt_count = 1, status = 'processing' where id = v_id;
  perform public.mil_outbox_mark_failure(
    v_id,
    'SQLSTATE',
    'violates unique constraint "mil_assets_pkey" bucket media-intel-originals path mil/x/y token sbp_SECRET',
    8
  );
  select * into v_row from public.mil_audit_outbox where id = v_id;
  if v_row.status is distinct from 'failed' then
    raise exception 'VERIFY_FAIL expected failed status after backoff mark';
  end if;
  if v_row.next_retry_at <= now() then
    raise exception 'VERIFY_FAIL backoff next_retry_at not in future';
  end if;
  v_safe := coalesce(v_row.last_error_message, '');
  if v_safe ~* 'media-intel-originals|mil/x|sbp_|mil_assets_pkey' then
    raise exception 'VERIFY_FAIL unsanitized failure message: %', v_safe;
  end if;

  update public.mil_audit_outbox set attempt_count = 8, status = 'processing' where id = v_id;
  perform public.mil_outbox_mark_failure(v_id, 'SQLSTATE', 'permission denied for table mil_assets', 8);
  select * into v_row from public.mil_audit_outbox where id = v_id;
  if v_row.status is distinct from 'terminal_failed' then
    raise exception 'VERIFY_FAIL expected terminal_failed';
  end if;

  -- Completed row not reclaimed
  v_id := public.mil_outbox_enqueue(
    'access', 'phase2a_done', 'mil_assets', null, null,
    '{}'::jsonb, 'phase2a:done:' || gen_random_uuid()::text
  );
  update public.mil_audit_outbox
  set status = 'delivered', completed_at = now(), claimed_at = now() - interval '1 hour'
  where id = v_id;
  if exists (
    select 1 from public.mil_outbox_claim_batch(50, 'no-reclaim', 8, 300) c where c.id = v_id
  ) then
    raise exception 'VERIFY_FAIL delivered row was reclaimed';
  end if;

  -- Sanitizer unit checks
  v_safe := public.mil_sanitize_outbox_error(
    'Object missing in media-intel-derivatives mil/quarantine/reels/x sdzhdupekcnekesbtxsl bearer abc.def'
  );
  if v_safe ~* 'media-intel-derivatives|mil/quarantine|sdzhdupekcnekesbtxsl|bearer abc' then
    raise exception 'VERIFY_FAIL sanitizer leaked sensitive text: %', v_safe;
  end if;

  raise notice 'PASS outbox_lease_idempotency_sanitize';
end $$;

-- =====================================================================
-- 5. Two simultaneous workers (SKIP LOCKED)
-- =====================================================================
do $$
declare
  v_a uuid;
  v_b uuid;
  v_c1 uuid;
  v_c2 uuid;
begin
  v_a := public.mil_outbox_enqueue('access','w1','mil_assets',null,null,'{}'::jsonb,'phase2a:w:'||gen_random_uuid()::text);
  v_b := public.mil_outbox_enqueue('access','w2','mil_assets',null,null,'{}'::jsonb,'phase2a:w:'||gen_random_uuid()::text);

  select id into v_c1 from public.mil_outbox_claim_batch(1, 'worker-a', 8, 300) limit 1;
  select id into v_c2 from public.mil_outbox_claim_batch(1, 'worker-b', 8, 300) limit 1;
  if v_c1 is null or v_c2 is null then
    raise exception 'VERIFY_FAIL both workers should claim a row';
  end if;
  if v_c1 = v_c2 then
    raise exception 'VERIFY_FAIL workers claimed the same row';
  end if;
  raise notice 'PASS simultaneous_workers';
end $$;

-- =====================================================================
-- 6. Upload audit coexistence (Migration A + old-edge-equivalent inserts)
-- =====================================================================
do $$
declare
  v_actor uuid := gen_random_uuid();
  v_batch uuid;
  v_session uuid;
  v_session2 uuid;
  v_grant uuid;
  v_asset uuid;
  v_count int;
  v_key text;
begin
  insert into auth.users (
    id, instance_id, aud, role, email, encrypted_password,
    email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
    created_at, updated_at, confirmation_token, recovery_token,
    email_change_token_new, email_change
  ) values (
    v_actor, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
    'phase2a-upload-audit@example.test', crypt('x', gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb,
    now(), now(), '', '', '', ''
  ) on conflict (id) do nothing;

  insert into public.mil_upload_batches (source_label, uploader_user_id, status)
  values ('phase2a-coexist', v_actor, 'open')
  returning id into v_batch;

  insert into public.mil_upload_sessions (
    batch_id, token_hash, created_by, expires_at
  ) values (
    v_batch, 'phase2a-coexist-' || v_actor::text, v_actor, now() + interval '1 hour'
  ) returning id into v_session;

  -- Old-edge-equivalent second insert (same logical create)
  insert into public.mil_audit_events (actor_user_id, action, target_type, target_id, details)
  values (v_actor, 'upload_session_created', 'mil_upload_sessions', v_session, '{"via":"old_edge"}'::jsonb);

  select count(*) into v_count
  from public.mil_audit_events
  where event_key = 'upload_session_created:' || v_session::text;
  if v_count <> 1 then
    raise exception 'VERIFY_FAIL session create coexistence expected 1 got %', v_count;
  end if;

  -- Contributor action name maps to same logical create key
  insert into public.mil_upload_sessions (
    batch_id, token_hash, created_by, expires_at
  ) values (
    v_batch, 'phase2a-contrib-' || v_actor::text, v_actor, now() + interval '1 hour'
  ) returning id into v_session2;

  insert into public.mil_audit_events (actor_user_id, action, target_type, target_id, details)
  values (
    v_actor, 'contributor_upload_session_created', 'mil_upload_sessions', v_session2,
    '{"via":"old_edge"}'::jsonb
  );
  select count(*) into v_count
  from public.mil_audit_events
  where event_key = 'upload_session_created:' || v_session2::text;
  if v_count <> 1 then
    raise exception 'VERIFY_FAIL contributor create coexistence expected 1 got %', v_count;
  end if;

  insert into public.mil_assets (
    media_kind, mime_type, byte_size, checksum_sha256, original_filename,
    original_path, batch_id
  ) values (
    'photo', 'image/jpeg', 10, repeat('a', 64), 'coexist.jpg',
    'mil/quarantine/phase2a/coexist-' || v_actor::text || '.jpg', v_batch
  ) returning id into v_asset;

  insert into public.mil_upload_grants (
    session_id, batch_id, asset_id, object_path, content_type, max_bytes,
    original_filename, expires_at
  ) values (
    v_session, v_batch, v_asset,
    public.mil_quarantine_object_path(v_batch, v_asset, 'coexist.jpg'),
    'image/jpeg', 1024, 'coexist.jpg', now() + interval '1 hour'
  ) returning id into v_grant;

  insert into public.mil_audit_events (actor_user_id, action, target_type, target_id, details)
  values (v_actor, 'upload_session_mint', 'mil_upload_grants', v_grant, '{"via":"old_edge"}'::jsonb);

  select count(*) into v_count
  from public.mil_audit_events
  where event_key = 'upload_grant_minted:' || v_grant::text;
  if v_count <> 1 then
    raise exception 'VERIFY_FAIL grant mint coexistence expected 1 got %', v_count;
  end if;

  update public.mil_upload_sessions set revoked_at = now() where id = v_session;
  insert into public.mil_audit_events (actor_user_id, action, target_type, target_id, details)
  values (v_actor, 'upload_session_revoked', 'mil_upload_sessions', v_session, '{"via":"old_edge"}'::jsonb);

  select count(*) into v_count
  from public.mil_audit_events
  where event_key = 'upload_session_revoked:' || v_session::text;
  if v_count <> 1 then
    raise exception 'VERIFY_FAIL revoke coexistence expected 1 got %', v_count;
  end if;

  -- Access/advisory rows with null event_key remain repeatable
  insert into public.mil_audit_events (actor_user_id, action, target_type, target_id, details)
  values
    (v_actor, 'access_probe', 'mil_assets', v_asset, '{}'::jsonb),
    (v_actor, 'access_probe', 'mil_assets', v_asset, '{}'::jsonb);
  select count(*) into v_count
  from public.mil_audit_events
  where action = 'access_probe' and target_id = v_asset and event_key is null;
  if v_count < 2 then
    raise exception 'VERIFY_FAIL access audits should remain non-unique';
  end if;

  v_key := public.mil_audit_derive_event_key('upload_session_mint', v_grant);
  if v_key is distinct from ('upload_grant_minted:' || v_grant::text) then
    raise exception 'VERIFY_FAIL derive_event_key mismatch: %', v_key;
  end if;

  raise notice 'PASS upload_audit_coexistence';
end $$;

-- =====================================================================
-- 7. Reel mint idempotency (sequential + scope denial + new op)
-- =====================================================================
do $$
declare
  v_actor uuid := gen_random_uuid();
  v_creator uuid := gen_random_uuid();
  v_other uuid := gen_random_uuid();
  v_op uuid := gen_random_uuid();
  v_op2 uuid := gen_random_uuid();
  v_project uuid;
  v_project2 uuid;
  v_m1 jsonb;
  v_m2 jsonb;
  v_versions int;
  v_grants int;
  v_audits int;
  v_err text;
begin
  insert into auth.users (
    id, instance_id, aud, role, email, encrypted_password,
    email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
    created_at, updated_at, confirmation_token, recovery_token,
    email_change_token_new, email_change
  ) values
    (v_actor, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
     'phase2a-reel-actor@example.test', crypt('x', gen_salt('bf')), now(),
     '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb,
     now(), now(), '', '', '', ''),
    (v_creator, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
     'phase2a-reel-creator@example.test', crypt('x', gen_salt('bf')), now(),
     '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb,
     now(), now(), '', '', '', ''),
    (v_other, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
     'phase2a-reel-other@example.test', crypt('x', gen_salt('bf')), now(),
     '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb,
     now(), now(), '', '', '', '')
  on conflict (id) do nothing;

  insert into public.mil_reel_projects (title, creator_user_id, status)
  values ('phase2a mint', v_creator, 'creator_draft')
  returning id into v_project;

  v_m1 := public.mil_mint_reel_upload_grant_audited(
    v_actor, v_creator, v_project, null, null, 'video/mp4', 1024,
    null, null, null, v_op
  );
  if coalesce((v_m1->>'ok')::boolean, false) is not true then
    raise exception 'VERIFY_FAIL reel mint first call failed: %', v_m1;
  end if;

  v_m2 := public.mil_mint_reel_upload_grant_audited(
    v_actor, v_creator, v_project, null, null, 'video/mp4', 1024,
    null, null, null, v_op
  );
  if coalesce((v_m2->>'adopted')::boolean, false) is not true then
    raise exception 'VERIFY_FAIL sequential retry must adopt: %', v_m2;
  end if;
  if v_m1->>'grantId' is distinct from v_m2->>'grantId'
     or v_m1->>'versionId' is distinct from v_m2->>'versionId' then
    raise exception 'VERIFY_FAIL sequential retry changed ids';
  end if;

  select count(*) into v_versions from public.mil_reel_versions where project_id = v_project;
  select count(*) into v_grants from public.mil_reel_upload_grants where project_id = v_project;
  select count(*) into v_audits
  from public.mil_audit_events
  where action = 'reel_upload_grant_minted'
    and target_id = (v_m1->>'grantId')::uuid;
  if v_versions <> 1 or v_grants <> 1 or v_audits <> 1 then
    raise exception 'VERIFY_FAIL expected one version/grant/audit got %/%/%',
      v_versions, v_grants, v_audits;
  end if;

  insert into public.mil_reel_projects (title, creator_user_id, status)
  values ('phase2a mint other', v_creator, 'creator_draft')
  returning id into v_project2;

  begin
    perform public.mil_mint_reel_upload_grant_audited(
      v_actor, v_creator, v_project2, null, null, 'video/mp4', 1024,
      null, null, null, v_op
    );
    raise exception 'VERIFY_FAIL same op different project should deny';
  exception when others then
    v_err := SQLERRM;
    if position('REEL_MINT_OP_PROJECT_MISMATCH' in v_err) = 0 then
      raise exception 'VERIFY_FAIL expected REEL_MINT_OP_PROJECT_MISMATCH got %', v_err;
    end if;
  end;

  begin
    perform public.mil_mint_reel_upload_grant_audited(
      v_actor, v_other, v_project, null, null, 'video/mp4', 1024,
      null, null, null, v_op
    );
    raise exception 'VERIFY_FAIL different creator same op should not reuse ledger';
  exception when others then
    v_err := SQLERRM;
    -- Different creator + same op against foreign project → creator mismatch
    if position('REEL_MINT_CREATOR_MISMATCH' in v_err) = 0
       and position('Reel project not found' in v_err) = 0 then
      -- New mint for other creator on this project is denied by creator mismatch.
      raise exception 'VERIFY_FAIL expected creator mismatch got %', v_err;
    end if;
  end;

  v_m2 := public.mil_mint_reel_upload_grant_audited(
    v_actor, v_creator, v_project, null, null, 'video/mp4', 2048,
    null, null, null, v_op2
  );
  if coalesce((v_m2->>'ok')::boolean, false) is not true
     or coalesce((v_m2->>'adopted')::boolean, false) is true then
    raise exception 'VERIFY_FAIL new operation should create new version: %', v_m2;
  end if;
  if v_m2->>'grantId' is not distinct from v_m1->>'grantId' then
    raise exception 'VERIFY_FAIL new operation reused grant';
  end if;

  select count(*) into v_versions from public.mil_reel_versions where project_id = v_project;
  if v_versions <> 2 then
    raise exception 'VERIFY_FAIL expected 2 versions after new op got %', v_versions;
  end if;

  raise notice 'PASS reel_mint_idempotency';
end $$;

select 'PHASE2A_VERIFICATION_PASS' as result;

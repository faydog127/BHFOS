-- MIL Phase 2A ROLLBACK PACKAGE
-- Reverses Migration A (20260802120000) + Migration B (20260802130000) schema/ACL
-- changes without deleting audit history or outbox records.
--
-- Modes:
--   FULL ROLLBACK — restore pre-Phase-2A privilege shape for authenticated
--                   (does NOT re-enable anon mutation).
--   EMERGENCY DISABLE — leave lockdown in place; only drop new RPCs/triggers
--                       that break live traffic (see section E).
--
-- NEVER: delete mil_audit_events, delete mil_audit_outbox rows, DROP outbox
-- table with CASCADE that would destroy evidence, GRANT mutation to anon.
--
-- Canonical plane remains mil.bhfos.com / sdzhdupekcnekesbtxsl.
-- Do not run against wwyxohjnyqnegzbxtuxs.

begin;

-- ===========================================================================
-- E. EMERGENCY DISABLE (safe subset — run alone if full rollback is too broad)
-- ===========================================================================
-- drop trigger if exists mil_trg_audit_upload_session on public.mil_upload_sessions;
-- drop trigger if exists mil_trg_audit_upload_grant on public.mil_upload_grants;
-- (keep mil_set_asset_compliance; clients may already call it)

-- ===========================================================================
-- FULL ROLLBACK
-- ===========================================================================

-- 1. Drop Phase 2A triggers
drop trigger if exists mil_trg_audit_upload_session on public.mil_upload_sessions;
drop trigger if exists mil_trg_audit_upload_grant on public.mil_upload_grants;
drop function if exists public.mil_trg_audit_upload_session();
drop function if exists public.mil_trg_audit_upload_grant();
drop trigger if exists mil_trg_audit_events_event_key on public.mil_audit_events;
drop function if exists public.mil_trg_audit_events_event_key();
drop function if exists public.mil_audit_derive_event_key(text, uuid);
drop index if exists public.mil_audit_events_event_key_uidx;

-- 2. Drop Phase 2A RPCs (explicit signatures)
drop function if exists public.mil_outbox_project_one(uuid);
drop function if exists public.mil_outbox_mark_failure(uuid, text, text, integer);
drop function if exists public.mil_outbox_mark_delivered(uuid);
drop function if exists public.mil_outbox_claim_batch(integer, text, integer);
drop function if exists public.mil_outbox_claim_batch(integer, text, integer, integer);
drop function if exists public.mil_outbox_enqueue(text, text, text, uuid, uuid, jsonb, text);
drop function if exists public.mil_record_access_audit(uuid, text, text, uuid, jsonb, text);
drop function if exists public.mil_sanitize_outbox_error(text);
drop function if exists public.mil_grant_creator_role_audited(uuid, uuid, jsonb, text);
drop function if exists public.mil_grant_creator_role_audited(uuid, uuid, jsonb, text, text);
drop function if exists public.mil_revoke_creator_access_audited(uuid, uuid, jsonb, text);
drop function if exists public.mil_revoke_creator_access_audited(uuid, uuid, jsonb, text, text);
drop function if exists public.mil_resolve_role_tenant(uuid, uuid, text);
drop function if exists public.mil_mint_reel_upload_grant_audited(
  uuid, uuid, uuid, text, uuid, text, bigint, text, uuid, text
);
drop function if exists public.mil_mint_reel_upload_grant_audited(
  uuid, uuid, uuid, text, uuid, text, bigint, text, uuid, text, uuid
);
drop function if exists public.mil_complete_reel_upload_audited(
  uuid, uuid, text, text, bigint, text, text
);
drop function if exists public.mil_unpublish_website_audited(uuid, uuid, jsonb, text);
drop function if exists public.mil_set_asset_compliance(uuid, text, text, text, text);
drop table if exists public.mil_reel_mint_operations;

-- 3. Restore mil_revoke_upload_session with inline audit (pre-trigger behavior)
create or replace function public.mil_revoke_upload_session(p_session_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.mil_is_owner_admin() then
    raise exception 'Only owner/admin may revoke upload sessions';
  end if;
  update public.mil_upload_sessions
  set revoked_at = now()
  where id = p_session_id
    and revoked_at is null;
  insert into public.mil_audit_events (actor_user_id, action, target_type, target_id, details)
  values (auth.uid(), 'upload_session_revoked', 'mil_upload_sessions', p_session_id, '{}'::jsonb);
  return found;
end;
$$;

revoke all on function public.mil_revoke_upload_session(uuid) from public, anon;
grant execute on function public.mil_revoke_upload_session(uuid) to authenticated, service_role;

-- 4. Restore mil_current_role ordering without id tie-break (pre-Phase-2A shape)
create or replace function public.mil_current_role()
returns text
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_role text;
begin
  if auth.uid() is null then
    return 'unauthenticated';
  end if;
  select r.role into v_role
  from public.app_user_roles r
  where r.user_id = auth.uid()
  order by
    case public.mil_normalize_role(r.role)
      when 'admin' then 1
      when 'manager' then 2
      when 'media_reviewer' then 3
      when 'office' then 4
      when 'reel_creator' then 5
      when 'phone_uploader' then 6
      when 'technician' then 7
      else 99
    end,
    r.created_at desc nulls last
  limit 1;
  if v_role is null or btrim(v_role) = '' then
    return 'unauthenticated';
  end if;
  return public.mil_normalize_role(v_role);
end;
$$;

-- 5. Reverse Migration B column privilege design. Restore pre-Phase-2A
--    table-level authenticated UPDATE on mil_assets (20260727130000).
--    Does NOT grant to anon.
revoke update on public.mil_assets from authenticated, anon, public;
grant update on public.mil_assets to authenticated;

-- 6. Reverse Migration B table write revokes (restore authenticated DML on
--    sensitive tables as of 20260727130000). Does NOT grant to anon.
grant insert, update, delete on public.mil_permitted_uses to authenticated;
grant insert, update, delete on public.mil_creator_assignments to authenticated;
grant insert, update, delete on public.mil_website_promotions to authenticated;

-- mil_audit_events: keep client inserts revoked (pre-Phase-2A hardening intent)
revoke insert, update, delete on public.mil_audit_events from authenticated, anon, public;
grant select on public.mil_audit_events to authenticated;

-- 7. Outbox table: PRESERVE rows. Drop policies only; do not DROP TABLE.
drop policy if exists mil_browse_audit_outbox on public.mil_audit_outbox;
revoke all on public.mil_audit_outbox from public, anon, authenticated;
-- service_role retains access for operator recovery
grant select, insert, update, delete on public.mil_audit_outbox to service_role;

-- Optional destructive step (NOT part of default rollback — leave commented):
-- drop table if exists public.mil_audit_outbox;

-- 8. Re-affirm intentional authenticated EXECUTE (post-rollback)
grant execute on function public.mil_verify_asset(uuid, jsonb) to authenticated, service_role;
grant execute on function public.mil_set_permitted_use(uuid, text, boolean, text) to authenticated, service_role;
grant execute on function public.mil_set_asset_lifecycle(uuid, text, text) to authenticated, service_role;
grant execute on function public.mil_set_assets_lifecycle(uuid[], text, text) to authenticated, service_role;
grant execute on function public.mil_set_asset_archive_state(uuid, text) to authenticated, service_role;
grant execute on function public.mil_assign_creator(uuid, uuid, uuid, text, timestamptz, text, text, text) to authenticated, service_role;
grant execute on function public.mil_review_reel_version(uuid, text, text) to authenticated, service_role;
grant execute on function public.mil_submit_reel_version(uuid) to authenticated, service_role;

-- HARD RULE: never re-enable anonymous mutation
revoke insert, update, delete on all tables in schema public from anon;
-- (scoped reminder — operators should still verify mil_% specifically)

commit;

-- ===========================================================================
-- POST-ROLLBACK VERIFICATION QUERIES (run manually, read-only)
-- ===========================================================================
-- select proname from pg_proc p join pg_namespace n on n.oid=p.pronamespace
--  where n.nspname='public' and proname like 'mil_set_asset_compliance';
--  -- expect 0 rows after full rollback
--
-- select count(*) from public.mil_audit_outbox; -- history preserved
-- select count(*) from public.mil_audit_events;
--
-- select has_table_privilege('anon', 'public.mil_assets', 'insert'); -- expect false
--
-- Frontend rollback: redeploy archive for SHA d90eb8fc622b (or last known good)
--   Hostinger target mil-production / mil-staging alias; build-info check.
-- Edge rollback: redeploy prior media-intel-* bundles to sdzhdupekcnekesbtxsl.
-- DB emergency-disable: comment block E above (drop triggers only).

-- MIL Phase 2A Migration B — RESTRICTIVE LOCKDOWN
-- Apply ONLY after Migration A + new edge/frontend are live and verified.
-- Canonical plane: mil.bhfos.com + sdzhdupekcnekesbtxsl
-- Does NOT re-enable anonymous mutation. Does NOT delete audit/outbox history.
--
-- Call-site inventory (why this is safe after code deploy):
--   mil_permitted_uses writes     → UI uses mil_set_permitted_use RPC only
--   mil_creator_assignments writes → mil_assign_creator / revoke RPCs + creator-admin
--   mil_website_promotions writes → edge promote/unpublish (service_role)
--   mil_assets protected columns  → mil_verify_asset / mil_set_asset_* / mil_set_asset_compliance
--   mil_audit_events inserts      → SECURITY DEFINER / service_role only
--   anon EXECUTE on write RPCs    → never used by browser (anon key + JWT still authenticated)
-- Deployed tip d90eb8f still uses RPCs for permitted use / lifecycle / verify; direct
-- PATCH of protected fields is not a supported product path.

begin;

-- ---------------------------------------------------------------------------
-- 1. Revoke anonymous INSERT/UPDATE/DELETE on all mil_* tables
-- ---------------------------------------------------------------------------
do $$
declare
  r record;
begin
  for r in
    select tablename
    from pg_tables
    where schemaname = 'public'
      and tablename like 'mil_%'
  loop
    execute format(
      'revoke insert, update, delete on public.%I from anon, public',
      r.tablename
    );
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- 2. RPC-only sensitive tables (authenticated SELECT retained)
-- ---------------------------------------------------------------------------
revoke insert, update, delete on public.mil_permitted_uses from authenticated, anon, public;
revoke insert, update, delete on public.mil_creator_assignments from authenticated, anon, public;
revoke insert, update, delete on public.mil_website_promotions from authenticated, anon, public;
revoke insert, update, delete on public.mil_audit_events from authenticated, anon, public;
revoke all on public.mil_audit_outbox from authenticated, anon, public;

grant select on public.mil_permitted_uses to authenticated;
grant select on public.mil_creator_assignments to authenticated;
grant select on public.mil_website_promotions to authenticated;
grant select on public.mil_audit_events to authenticated;

-- ---------------------------------------------------------------------------
-- 3. Effective mil_assets column lockdown
--    Table-level UPDATE overrides column-level REVOKEs in PostgreSQL.
--    Preferred design: revoke table UPDATE, grant UPDATE only on approved
--    non-protected ordinary metadata columns. SECURITY DEFINER RPCs retain
--    owner privileges and continue to mutate protected fields.
-- ---------------------------------------------------------------------------
revoke update on public.mil_assets from authenticated, anon, public;

-- Ordinary metadata that direct authenticated editing may still touch.
grant update (
  original_filename,
  orientation,
  width,
  height,
  duration_ms,
  capture_taken_at,
  exclude_from_ai,
  is_preferred_of_duplicate_group,
  updated_at
) on public.mil_assets to authenticated;

-- Explicitly keep protected/compliance/lifecycle/verification fields without
-- authenticated UPDATE (defense in depth; table revoke already removes them):
-- human_review_status, privacy_status, rights_status, customer_permission_status,
-- publication_readiness, archived_at, trashed_at, purge_eligible_at,
-- lifecycle_reason, lifecycle_kept_at, lifecycle_changed_by, lifecycle_changed_at,
-- processing_status, original_bucket, original_path, checksum_*, byte_size,
-- created_by_user_id, ai_*, media_kind, mime_type, batch_id, duplicate_of_asset_id.

-- ---------------------------------------------------------------------------
-- 4. Revoke anon EXECUTE on write-capable mil_* RPCs
-- ---------------------------------------------------------------------------
do $$
declare
  r record;
begin
  for r in
    select p.oid::regprocedure as sig
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in (
        'mil_audit_insert',
        'mil_verify_asset',
        'mil_set_permitted_use',
        'mil_set_asset_lifecycle',
        'mil_set_assets_lifecycle',
        'mil_set_asset_archive_state',
        'mil_set_asset_compliance',
        'mil_assign_creator',
        'mil_set_creator_assignment_status',
        'mil_revoke_creator_assignment',
        'mil_revoke_upload_session',
        'mil_review_reel_version',
        'mil_submit_reel_version',
        'mil_submit_content_package',
        'mil_review_content_submission',
        'mil_begin_upload_finalize',
        'mil_mark_upload_placed',
        'mil_commit_upload_finalize',
        'mil_fail_upload_finalize',
        'mil_abandon_expired_upload_grants',
        'mil_reconcile_upload_finalization',
        'mil_raise_integrity_alert',
        'mil_storage_catalog_probe',
        'mil_recount_upload_batch',
        'mil_finalize_upload_grant',
        'mil_cleanup_expired_upload_grants',
        'mil_generate_submission_public_id',
        'mil_grant_creator_role_audited',
        'mil_revoke_creator_access_audited',
        'mil_resolve_role_tenant',
        'mil_mint_reel_upload_grant_audited',
        'mil_complete_reel_upload_audited',
        'mil_unpublish_website_audited',
        'mil_outbox_enqueue',
        'mil_outbox_claim_batch',
        'mil_outbox_mark_delivered',
        'mil_outbox_mark_failure',
        'mil_outbox_project_one',
        'mil_record_access_audit'
      )
  loop
    execute format('revoke all on function %s from public, anon', r.sig);
  end loop;
end $$;

grant execute on function public.mil_verify_asset(uuid, jsonb) to authenticated, service_role;
grant execute on function public.mil_set_permitted_use(uuid, text, boolean, text) to authenticated, service_role;
grant execute on function public.mil_set_asset_lifecycle(uuid, text, text) to authenticated, service_role;
grant execute on function public.mil_set_assets_lifecycle(uuid[], text, text) to authenticated, service_role;
grant execute on function public.mil_set_asset_archive_state(uuid, text) to authenticated, service_role;
grant execute on function public.mil_set_asset_compliance(uuid, text, text, text, text) to authenticated, service_role;
grant execute on function public.mil_assign_creator(uuid, uuid, uuid, text, timestamptz, text, text, text) to authenticated, service_role;
do $$
begin
  grant execute on function public.mil_assign_creator(uuid, uuid, uuid, text)
    to authenticated, service_role;
exception when undefined_function then null;
end $$;
grant execute on function public.mil_set_creator_assignment_status(uuid, text) to authenticated, service_role;
grant execute on function public.mil_revoke_creator_assignment(uuid) to authenticated, service_role;
grant execute on function public.mil_revoke_upload_session(uuid) to authenticated, service_role;
grant execute on function public.mil_review_reel_version(uuid, text, text) to authenticated, service_role;
grant execute on function public.mil_submit_reel_version(uuid) to authenticated, service_role;
grant execute on function public.mil_submit_content_package(
  text, uuid[], text, text, text, text, text, text, text, text[], timestamptz, text
) to authenticated, service_role;
grant execute on function public.mil_review_content_submission(uuid, text, text) to authenticated, service_role;

revoke all on function public.mil_audit_insert(text, text, uuid, jsonb)
  from public, anon, authenticated;

-- HARD RULE affirmation: never restore anonymous mutation
revoke insert, update, delete on public.mil_assets from anon, public;

commit;

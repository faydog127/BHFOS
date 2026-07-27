-- Media Intelligence Library — state client + service_role table privileges.
--
-- Why this exists: capability-matrix RLS policies were written in
-- 20260725140000, and lifecycle tables were re-granted in 20260726090000.
-- Other mil_* tables still depended on ambient default privileges. On the
-- disposable local stack (and potentially hosted), authenticated / service_role
-- often retain only REFERENCES/TRIGGER/TRUNCATE — so PostgREST SELECT/INSERT
-- fails with "permission denied for table" even when RLS would allow the row.
-- Correct-looking RLS without GRANT is not a usable control.
--
-- This migration does not widen RLS. It only makes the intended policies
-- reachable. Lifecycle write revocations from 20260726090000 remain in force.

begin;

-- ---------------------------------------------------------------------------
-- Browse SELECT surfaces (mil_can_browse_library / creator SELECT policies)
-- ---------------------------------------------------------------------------
grant select on public.mil_derivatives to authenticated;
grant select on public.mil_verified_metadata to authenticated;
grant select on public.mil_ai_analyses to authenticated;
grant select on public.mil_asset_tags to authenticated;
grant select on public.mil_quality_scores to authenticated;
grant select on public.mil_privacy_findings to authenticated;
grant select on public.mil_collections to authenticated;
grant select on public.mil_collection_items to authenticated;
grant select on public.mil_asset_relationships to authenticated;
grant select on public.mil_permitted_uses to authenticated;
grant select on public.mil_tag_vocabulary to authenticated;
grant select on public.mil_processing_jobs to authenticated;
grant select on public.mil_reel_projects to authenticated;
grant select on public.mil_reel_versions to authenticated;
grant select on public.mil_reel_source_media to authenticated;
grant select on public.mil_website_promotions to authenticated;
grant select on public.mil_creator_assignments to authenticated;
grant select on public.mil_audit_events to authenticated;
grant select on public.mil_reel_upload_grants to authenticated;

-- mil_assets + lifecycle SELECT already granted in 20260726090000; restate.
grant select on public.mil_assets to authenticated;
grant select on public.mil_upload_batches to authenticated;
grant select on public.mil_upload_grants to authenticated;
grant select on public.mil_manifest_entries to authenticated;
grant select on public.mil_upload_sessions to authenticated;
grant select on public.mil_integrity_alerts to authenticated;

-- ---------------------------------------------------------------------------
-- Authenticated writes that RLS policies intentionally allow
-- ---------------------------------------------------------------------------
-- Reviewer write policies (mil_is_reviewer)
grant insert, update, delete on public.mil_verified_metadata to authenticated;
grant insert, update, delete on public.mil_privacy_findings to authenticated;
grant insert, update, delete on public.mil_asset_relationships to authenticated;
grant insert, update, delete on public.mil_asset_tags to authenticated;

-- Library staff collection membership (mil_can_browse_library)
grant insert, update, delete on public.mil_collections to authenticated;
grant insert, update, delete on public.mil_collection_items to authenticated;

-- Owner/admin surfaces (policies still gate rows)
grant insert, update, delete on public.mil_permitted_uses to authenticated;
grant insert, update, delete on public.mil_website_promotions to authenticated;
grant insert, update, delete on public.mil_creator_assignments to authenticated;

-- Creator reel surfaces (policies still gate ownership)
grant insert, update, delete on public.mil_reel_projects to authenticated;
grant insert, update, delete on public.mil_reel_versions to authenticated;
grant insert, update, delete on public.mil_reel_source_media to authenticated;

-- Reviewer/owner asset UPDATE (INSERT/DELETE stay revoked — finalize only)
grant update on public.mil_assets to authenticated;

-- ---------------------------------------------------------------------------
-- service_role: full table access for edge / SECURITY DEFINER companion paths
-- ---------------------------------------------------------------------------
grant select, insert, update, delete on public.mil_derivatives to service_role;
grant select, insert, update, delete on public.mil_verified_metadata to service_role;
grant select, insert, update, delete on public.mil_ai_analyses to service_role;
grant select, insert, update, delete on public.mil_asset_tags to service_role;
grant select, insert, update, delete on public.mil_quality_scores to service_role;
grant select, insert, update, delete on public.mil_privacy_findings to service_role;
grant select, insert, update, delete on public.mil_collections to service_role;
grant select, insert, update, delete on public.mil_collection_items to service_role;
grant select, insert, update, delete on public.mil_asset_relationships to service_role;
grant select, insert, update, delete on public.mil_permitted_uses to service_role;
grant select, insert, update, delete on public.mil_tag_vocabulary to service_role;
grant select, insert, update, delete on public.mil_processing_jobs to service_role;
grant select, insert, update, delete on public.mil_reel_projects to service_role;
grant select, insert, update, delete on public.mil_reel_versions to service_role;
grant select, insert, update, delete on public.mil_reel_source_media to service_role;
grant select, insert, update, delete on public.mil_website_promotions to service_role;
grant select, insert, update, delete on public.mil_creator_assignments to service_role;
grant select, insert, update, delete on public.mil_audit_events to service_role;
grant select, insert, update, delete on public.mil_reel_upload_grants to service_role;
grant select, insert, update, delete on public.mil_assets to service_role;
grant select, insert, update, delete on public.mil_upload_batches to service_role;
grant select, insert, update, delete on public.mil_upload_grants to service_role;
grant select, insert, update, delete on public.mil_manifest_entries to service_role;
grant select, insert, update, delete on public.mil_upload_sessions to service_role;
grant select, insert, update, delete on public.mil_integrity_alerts to service_role;

-- Defense in depth: clients must never truncate MIL library tables.
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
    execute format('revoke truncate on public.%I from authenticated, anon', r.tablename);
  end loop;
end $$;

commit;

-- Media Intelligence Library — submission/review RPC EXECUTE ACL hardening.
--
-- Forward-only. Does not alter 20260731120000.
--
-- Root cause: 20260731120000 revoked EXECUTE only FROM PUBLIC, then granted
-- authenticated. On hosted Supabase, CREATE FUNCTION also attaches a direct
-- EXECUTE grant to anon (via ALTER DEFAULT PRIVILEGES / create-time grants).
-- REVOKE … FROM PUBLIC does not remove that direct anon privilege — the same
-- class of defect remediated for finalization RPCs in
-- 20260727140000_media_intel_finalize_rpc_execute_acl.sql.
--
-- Intentional final ACL:
--   - Client submit/review RPCs: EXECUTE for authenticated (+ service_role for ops)
--   - Internal public_id helper: no browser-role EXECUTE
--   - PUBLIC and anon: no EXECUTE on any of these functions
-- Default privileges are left unchanged (not narrowed here) to avoid affecting
-- unrelated future functions in public.

begin;

-- Internal helper: not a client RPC.
revoke all on function public.mil_generate_submission_public_id()
  from public, anon, authenticated;

revoke all on function public.mil_submit_content_package(
  text, uuid[], text, text, text, text, text, text, text, text[], timestamptz, text
) from public, anon, authenticated;

revoke all on function public.mil_review_content_submission(uuid, text, text)
  from public, anon, authenticated;

revoke all on function public.mil_submit_reel_version(uuid)
  from public, anon, authenticated;

revoke all on function public.mil_review_reel_version(uuid, text, text)
  from public, anon, authenticated;

grant execute on function public.mil_submit_content_package(
  text, uuid[], text, text, text, text, text, text, text, text[], timestamptz, text
) to authenticated, service_role;

grant execute on function public.mil_review_content_submission(uuid, text, text)
  to authenticated, service_role;

grant execute on function public.mil_submit_reel_version(uuid)
  to authenticated, service_role;

grant execute on function public.mil_review_reel_version(uuid, text, text)
  to authenticated, service_role;

commit;

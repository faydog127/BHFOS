-- Media Intelligence Library - hosted finalization RPC EXECUTE ACL remediation.
--
-- Forward-only. Does not alter prior migration bodies.
--
-- Context: 20260726090000 revokes lifecycle RPC privileges FROM PUBLIC and
-- grants EXECUTE to service_role. On hosted Supabase, ALTER DEFAULT PRIVILEGES
-- can still leave direct EXECUTE grants for anon/authenticated when functions
-- are created. SQL contracts 00/04 require those roles cannot execute the nine
-- finalization RPCs. Explicitly revoke from anon and authenticated, then
-- re-affirm service_role EXECUTE only.

begin;

revoke all on function public.mil_raise_integrity_alert(text, text, uuid, uuid, uuid, text, text, jsonb)
  from public, anon, authenticated;
revoke all on function public.mil_storage_catalog_probe(text, text)
  from public, anon, authenticated;
revoke all on function public.mil_recount_upload_batch(uuid)
  from public, anon, authenticated;
revoke all on function public.mil_begin_upload_finalize(uuid, text, integer, integer)
  from public, anon, authenticated;
revoke all on function public.mil_mark_upload_placed(uuid, text, text, text, text, bigint, integer)
  from public, anon, authenticated;
revoke all on function public.mil_commit_upload_finalize(uuid, text, text, boolean, bigint, text, uuid, text, text, bigint)
  from public, anon, authenticated;
revoke all on function public.mil_fail_upload_finalize(uuid, text, text, boolean)
  from public, anon, authenticated;
revoke all on function public.mil_abandon_expired_upload_grants(integer)
  from public, anon, authenticated;
revoke all on function public.mil_reconcile_upload_finalization(uuid, integer, text)
  from public, anon, authenticated;

grant execute on function public.mil_raise_integrity_alert(text, text, uuid, uuid, uuid, text, text, jsonb)
  to service_role;
grant execute on function public.mil_storage_catalog_probe(text, text)
  to service_role;
grant execute on function public.mil_recount_upload_batch(uuid)
  to service_role;
grant execute on function public.mil_begin_upload_finalize(uuid, text, integer, integer)
  to service_role;
grant execute on function public.mil_mark_upload_placed(uuid, text, text, text, text, bigint, integer)
  to service_role;
grant execute on function public.mil_commit_upload_finalize(uuid, text, text, boolean, bigint, text, uuid, text, text, bigint)
  to service_role;
grant execute on function public.mil_fail_upload_finalize(uuid, text, text, boolean)
  to service_role;
grant execute on function public.mil_abandon_expired_upload_grants(integer)
  to service_role;
grant execute on function public.mil_reconcile_upload_finalization(uuid, integer, text)
  to service_role;

commit;

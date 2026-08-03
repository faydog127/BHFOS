-- Post-rollback verification (Phase 2A). Expect Phase 2A RPCs gone; anon still muted.
\set ON_ERROR_STOP on

do $$
begin
  if to_regprocedure('public.mil_set_asset_compliance(uuid, text, text, text, text)') is not null then
    raise exception 'POST_ROLLBACK_FAIL mil_set_asset_compliance still present';
  end if;
  if to_regprocedure('public.mil_grant_creator_role_audited(uuid, uuid, jsonb, text, text)') is not null then
    raise exception 'POST_ROLLBACK_FAIL mil_grant_creator_role_audited still present';
  end if;
  if to_regprocedure('public.mil_mint_reel_upload_grant_audited(uuid, uuid, uuid, text, uuid, text, bigint, text, uuid, text)') is not null
     or to_regprocedure('public.mil_mint_reel_upload_grant_audited(uuid, uuid, uuid, text, uuid, text, bigint, text, uuid, text, uuid)') is not null then
    raise exception 'POST_ROLLBACK_FAIL mil_mint_reel_upload_grant_audited still present';
  end if;
  if to_regclass('public.mil_reel_mint_operations') is not null then
    raise exception 'POST_ROLLBACK_FAIL mil_reel_mint_operations still present';
  end if;
  if to_regprocedure('public.mil_trg_audit_events_event_key()') is not null then
    raise exception 'POST_ROLLBACK_FAIL mil_trg_audit_events_event_key still present';
  end if;
  if has_table_privilege('anon', 'public.mil_assets', 'insert')
     or has_table_privilege('anon', 'public.mil_assets', 'update')
     or has_table_privilege('anon', 'public.mil_assets', 'delete') then
    raise exception 'POST_ROLLBACK_FAIL anon mutation restored on mil_assets';
  end if;
  -- History preserved
  perform 1 from public.mil_audit_outbox limit 1;
  perform 1 from public.mil_audit_events limit 1;
  raise notice 'PASS post_rollback';
end $$;

select 'PHASE2A_POST_ROLLBACK_PASS' as result;

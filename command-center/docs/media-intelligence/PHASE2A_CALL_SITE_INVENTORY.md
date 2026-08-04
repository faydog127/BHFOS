# Phase 2A — Call-site inventory for Migration B lockdown

SOURCE-ONLY call-site inventory supporting the A→code→B sequence. Does **not** prove
tip or remediated runtime safety after Migration B. Deployed tip:
`d90eb8fc622b` (pre-Phase-2A).

## Privileges revoked in Migration B

| Privilege | Deployed call sites (d90eb8f + remediated) | Safe after |
|---|---|---|
| anon INSERT/UPDATE/DELETE on `mil_%` | None (browser uses authenticated JWT) | Migration B anytime (defense in depth) |
| anon EXECUTE write RPCs | None | Migration B anytime |
| authenticated DML on `mil_permitted_uses` | `api.setPermittedUse` → `mil_set_permitted_use` RPC only | After code that never `.from('mil_permitted_uses').insert/update` |
| authenticated DML on `mil_creator_assignments` | `mil_assign_creator` / revoke RPCs; creator-admin assign | Same |
| authenticated DML on `mil_website_promotions` | `media-intel-promote-website` service_role | Same |
| authenticated UPDATE protected `mil_assets` columns | `mil_verify_asset`, `mil_set_asset_lifecycle`, `mil_set_asset_archive_state`, `mil_set_asset_compliance` | After frontend uses compliance RPC (remediated) / never PATCHes those columns |
| authenticated EXECUTE `mil_audit_insert` | None (client `audit()` throws) | Anytime |

## Compatibility sequencing

1. **Migration A** — mostly additive objects/RPCs, but also replaces `mil_current_role` /
   `mil_revoke_upload_session` and adds upload audit triggers. Tip impact is mitigated by
   `mil_audit_events.event_key` dedupe (old-edge second inserts become no-ops). Not “new objects unused.”
2. **Code deploy** — edge/frontend begin using new RPCs/sign policy / reel `operationId`.
3. **Migration B** — revoke direct writes only after live verification that RPC paths succeed.

Single-migration-first lockdown is **not** claimed safe for protected-column revokes against older clients that might PATCH `mil_assets` via PostgREST; hence the split.

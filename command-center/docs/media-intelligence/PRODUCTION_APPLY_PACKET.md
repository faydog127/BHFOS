# Media Intelligence — Production Apply Packet

**Status:** Phase 2A code merged to `feat/media-intelligence-library` — **hosted apply/deploy still requires separate Founder authorization**.  
**Authority:** Founder-ratified dual-plane declaration below. Legacy instructions that applied MIL to CRM Supabase are **void**.

## Phase 2A deployment boundary (post-merge)

| Field | Value |
|---|---|
| **Deployment-boundary SHA** | `63d619fcc3303f05a60888174585408b745f79fc` |
| Merge | PR [#132](https://github.com/faydog127/BHFOS/pull/132) merge commit into `feat/media-intelligence-library` |
| Certified Phase 2A parent | `20cdd2202dee68ca5901e0f2c9920d0e0f69c9de` (unchanged in ancestry) |
| Prior target parent | `dfa978d521798c5fb036d140127dd33d73c7707e` |
| Frontend package (local) | `tmp/mil-production-63d619fcc330-20260804T001318Z.zip` |
| Package SHA-256 | `DD97B56370E5874A9129091E326846C7F1079DF0E191DDEACFBF32B36C4DAD93` |
| build-info | `environment=mil-production` / `migrationVersion=20260802130000` / `frontendAssetVersion=31a5145632e3dc13` / `commitSha=63d619fcc330…` |
| Bundle binding | `sdzhdupekcnekesbtxsl` only; `wwyx…` absent; anon JWT only |

Rebuild frontend **only** from `63d619fcc3303f05a60888174585408b745f79fc` (not from pre-merge `20cdd22` alone) with MIL production public env before Hostinger deploy.

## Ratified production planes

| Plane | Host | Supabase backend | Hostinger deploy target |
|---|---|---|---|
| **MIL Production** | `https://mil.bhfos.com` | `sdzhdupekcnekesbtxsl` | `mil-production` (`mil-staging` = deprecated alias) |
| **CRM Production** | `https://app.bhfos.com` | `wwyxohjnyqnegzbxtuxs` | `production` |

### Binding rules

1. MIL production host is **`mil.bhfos.com`**.
2. MIL production backend is **`sdzhdupekcnekesbtxsl`**.
3. CRM production remains **`app.bhfos.com`**.
4. CRM backend remains **`wwyxohjnyqnegzbxtuxs`**.
5. **MIL migrations must not be applied to `wwyxohjnyqnegzbxtuxs`.**
6. **No data move** between `sdzh…` and `wwyx…` is part of this declaration or Phase 2A.
7. Thin legacy MIL rows that may exist on `wwyx…` are not removed by this packet; they are also not the live MIL plane.
8. Legacy packet steps that said “apply MIL migrations to `wwyx…`” or “leave mil.bhfos.com as staging” are **superseded**.

Related: [`PHASE2A_SECURITY_INTEGRITY_REPORT.md`](./PHASE2A_SECURITY_INTEGRITY_REPORT.md), [`ENV_CONTRACT.md`](./ENV_CONTRACT.md), [`ACCESS_ARCHITECTURE.md`](./ACCESS_ARCHITECTURE.md), [`STAGING_APPLY_PACKET.md`](./STAGING_APPLY_PACKET.md) (historical staging notes; host is now MIL Production).

## Phase 2A deployment order (requires Founder authorization)

Do **not** execute until authorized. Never target `wwyx…` for these steps. Deploy from boundary SHA **`63d619fcc3303f05a60888174585408b745f79fc`**.

1. Apply Migration A `20260802120000_media_intel_phase2a_additive.sql` to **`sdzhdupekcnekesbtxsl`**.
2. Deploy compatible edge functions + frontend (`mil-production` build-info) to mil.bhfos.com / `sdzh…`.
3. Live-verify new RPCs/signing/compliance paths on designated fixtures.
4. Apply Migration B `20260802130000_media_intel_phase2a_lockdown.sql` to **`sdzh…` only**.
5. Post-lockdown verification (anon denial, protected PATCH denial, outbox worker health).

Rollback SQL: [`../../supabase/rollbacks/phase2a_media_intel_rollback.sql`](../../supabase/rollbacks/phase2a_media_intel_rollback.sql).

## Historical CRM MIL promote notes (VOID for MIL plane)

The following historical steps referred to promoting MIL into CRM Supabase / `app.bhfos.com`. They are retained only as ledger context and **must not be executed for MIL**:

- Apply MIL migrations to `wwyxohjnyqnegzbxtuxs` — **FORBIDDEN for MIL**
- Treat `mil.bhfos.com` as non-production staging — **SUPERSEDED** (it is MIL Production)
- Bundle must contain only `wwyx…` for a MIL host deploy — **FORBIDDEN** (MIL host must use `sdzh…`)

CRM-only frontend deploys to `app.bhfos.com` / `wwyx…` remain a separate CRM concern and are outside Phase 2A MIL remediation.

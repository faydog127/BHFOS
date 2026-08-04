# Media Intelligence — Production Apply Packet

**Status:** Phase 2A partially hosted on MIL plane — control-plane gates required before further mutate steps.  
**Authority:** Founder-ratified dual-plane declaration below. Legacy instructions that applied MIL to CRM Supabase are **void**.  
**Control plane:** [`PHASE2A_CONTROL_PLANE.md`](./PHASE2A_CONTROL_PLANE.md)

## Phase 2A deployment boundary (post-merge)

| Field | Value |
|---|---|
| **Runtime edge source boundary** | `63d619fcc3303f05a60888174585408b745f79fc` |
| Merge | PR [#132](https://github.com/faydog127/BHFOS/pull/132) merge commit into `feat/media-intelligence-library` |
| Certified Phase 2A parent | `20cdd2202dee68ca5901e0f2c9920d0e0f69c9de` (unchanged in ancestry) |
| Hosted Migration A | **Already applied** on `sdzhdupekcnekesbtxsl` — do **not** re-apply |
| Hosted Migration B | **Absent** — do **not** apply until authorized after privileged verification + frontend decision |
| Phase 2A edges | **Deployed** (seven functions) — do **not** redeploy unless separately authorized |
| Live frontend | Prior `d90eb8f…` build — Phase 2A frontend **not** deployed |
| Bundle binding rule | `sdzhdupekcnekesbtxsl` only; `wwyx…` absent; anon JWT only |

Rebuild frontend only from a clean certified SHA with MIL production public env and `--rollout-stage=phase-a` (schema fields `20260802120000`). Control-plane commits alone do not authorize Hostinger deploy.

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

Related: [`PHASE2A_SECURITY_INTEGRITY_REPORT.md`](./PHASE2A_SECURITY_INTEGRITY_REPORT.md), [`PHASE2A_CONTROL_PLANE.md`](./PHASE2A_CONTROL_PLANE.md), [`ENV_CONTRACT.md`](./ENV_CONTRACT.md), [`ACCESS_ARCHITECTURE.md`](./ACCESS_ARCHITECTURE.md), [`STAGING_APPLY_PACKET.md`](./STAGING_APPLY_PACKET.md) (historical staging notes; host is now MIL Production).

## Phase 2A remaining deployment order (requires Founder authorization)

Do **not** execute until authorized. Never target `wwyx…` for these steps.  
**Prohibit** bare `supabase db push` while both A and B (or other pending migrations) are in play — use `npm run mil:apply-migration` with an explicit version.

1. **Verify** Migration A `20260802120000` is already recorded on **`sdzhdupekcnekesbtxsl`** (skip re-apply if present).
2. **Verify** seven Phase 2A edge functions remain ACTIVE; do not redeploy unless a separate authorization names versions.
3. Complete **synthetic privileged positive-path** verification (fixtures only; no real-customer mutations).
4. If authorized: deploy Phase 2A frontend (`mil-production`, `--rollout-stage=phase-a`, clean tree, `sdzh…` baked) to mil.bhfos.com.
5. Live-verify new RPCs/signing/compliance paths on designated fixtures.
6. If authorized: apply Migration B `20260802130000` to **`sdzh…` only** via single-migration wrapper with `--authorize-migration=20260802130000`.
7. Post-lockdown verification (anon denial, protected PATCH denial, outbox worker health).

Rollback SQL: [`../../supabase/rollbacks/phase2a_media_intel_rollback.sql`](../../supabase/rollbacks/phase2a_media_intel_rollback.sql).

## Historical CRM MIL promote notes (VOID for MIL plane)

**HISTORICAL — DO NOT EXECUTE**

The following historical steps referred to promoting MIL into CRM Supabase / `app.bhfos.com`. They are retained only as ledger context and **must not be executed for MIL**:

- Apply MIL migrations to `wwyxohjnyqnegzbxtuxs` — **FORBIDDEN for MIL**
- Treat `mil.bhfos.com` as non-production staging — **SUPERSEDED** (it is MIL Production)
- Bundle must contain only `wwyx…` for a MIL host deploy — **FORBIDDEN** (MIL host must use `sdzh…`)

CRM-only frontend deploys to `app.bhfos.com` / `wwyx…` remain a separate CRM concern and are outside Phase 2A MIL remediation.

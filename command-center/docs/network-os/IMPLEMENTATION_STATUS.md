# Network OS — Implementation Status

**Branch:** `hotfix/v1-crm-layout-hooks`  
**Merged PR:** https://github.com/faydog127/BHFOS/pull/146  
**Merge SHA:** `c4d344b13715914f0a452222fdb0a0417061d0bb`  
**Exact reviewed HEAD (parent 2):** `18ba8d097b5dc336f23719a89671c4062f32459e`  
**Production baseline (parent 1 / rollback):** `0d6bcbb8aa14a43b16dafa5314e156d852785ff5`  
**Mission:** `NOS-CONVENTION-SURGICAL-RELEASE-01`  
**Product / R1 / Slice 1 activation:** **None**  
**Hosted SQL / function deploy:** **Not this hop**  
**PRs 144 / 145:** remain open **draft**

## Reconfirm (before mutate)

| Gate | Result |
|---|---|
| PR 146 HEAD | `18ba8d097b5dc336f23719a89671c4062f32459e` |
| Ancestry | ordinary `0d6bcbb8` → `f066ae6` → `18ba8d0`; base was `hotfix/v1-crm-layout-hooks` @ `0d6bcbb8` |
| CI on that HEAD | green — lint, identity_contracts, supabase_oauth_helper, founder_run_readiness, control_plane_lane, build, ledger_lock |
| Guard review | `5014743916` present (`CONVENTION_SURGICAL_INTEGRATION_GUARD_APPROVED`) |

## Merge

Ordinary GitHub merge commit (no squash, no rebase, no force-push):

- Merge SHA: `c4d344b13715914f0a452222fdb0a0417061d0bb`
- Parents: `0d6bcbb8aa14a43b16dafa5314e156d852785ff5` + `18ba8d097b5dc336f23719a89671c4062f32459e`
- Tree of merge equals `18ba8d0`

## Live production at capture (before Hostinger upload)

Browser-read `https://app.bhfos.com/build-info.json` (curl is Cloudflare-challenged):

| Field | Value |
|---|---|
| commitSha | `0d6bcbb8aa14a43b16dafa5314e156d852785ff5` |
| branch | `hotfix/v1-crm-layout-hooks` |
| environment | `production` |
| releaseId | `v2.5.0` |
| generatedAt | `2026-08-14T01:20:52.219Z` |

Immediate browser health (no login, not full E2E): `/` and `/select-tenant` show CRM **Select Workspace**; `/network-os/convention/join` still SPA-falls back to tenant select (join not hosted yet). Title: The Vent Guys CRM. Not Website/bhfos-site.

## Rollback artifact (verified)

Preserved locally (gitignored `command-center/tmp/` + `/opt/cursor/artifacts/rollback/`):

| Artifact | Purpose |
|---|---|
| `tmp/rollback-live-prod-0d6bcbb8aa14-root.zip` | Live captured SPA (index.html, assets, build-info, favicon) — Hostinger-extractable root |
| `tmp/rollback-live-prod-0d6bcbb8aa14.zip` | Same files under a folder prefix |
| `tmp/rollback-prod-baseline-0d6bcbb8aa14a43b16dafa5314e156d852785ff5.tar.gz` | Exact git source tree of `0d6bcbb8` |
| `tmp/ROLLBACK_RESTORE_0d6bcbb8.md` | Restore command |

**How to restore:** frontend forward-redeploy only. No DB reverse. From `command-center/` with operator `HOSTINGER_API_TOKEN` present (never printed):

```
node tools/deploy-hostinger-static.mjs --execute --environment=production \
  --app=crm \
  --authorization=NOS-CONVENTION-SURGICAL-RELEASE-01-ROLLBACK-0d6bcbb8 \
  --sha=0d6bcbb8aa14a43b16dafa5314e156d852785ff5 \
  --archive=tmp/rollback-live-prod-0d6bcbb8aa14-root.zip \
  --i-understand-production
```

Then confirm live `build-info.json` commitSha is again `0d6bcbb8aa14a43b16dafa5314e156d852785ff5`.

## Combined SPA build (locally verified, not hosted)

`npm run build` at merge SHA `c4d344b` with production allowlist reconstructed from the **already-public** live bundle (same Supabase project ref as live CRM). Not a convention-only bundle.

| Check | Result |
|---|---|
| `dist/build-info.json` | commitSha `c4d344b13715914f0a452222fdb0a0417061d0bb`, branch `hotfix/v1-crm-layout-hooks`, environment `production` |
| `health-probe --dir=dist` | HEALTHY |
| `verify-build-info --require-release` | PASSED |
| CRM auth / tenant / deep-links in dist | `/select-tenant`, login, `/quotes/`, `quote-confirmation`, CRMHub/Jobs/Leads/Settings present |
| Convention join/thanks in dist | `ConventionJoinRoutes-2991c373.js`; `/network-os/convention/join` + thanks present |
| Demo wildcard `/network-os/convention/*` | **absent** |
| Secret scan of dist | 0 findings |
| Deploy dry-run | plan OK; target `production` / `app.bhfos.com` / `public_html`; 114 files; credentials **absent** in this environment |
| Deploy archive | `tmp/production-c4d344b13715-20260825T041709Z.zip` |

`build-info.migrationVersion` is the newest **source** SQL filename prefix in this tree (`20260824154100`). That is **not** a hosted apply.

## Hostinger production upload

**Not executed.** Established path is `command-center/tools/deploy-hostinger-static.mjs --execute --environment=production`. This environment has no `HOSTINGER_API_TOKEN` / `API_TOKEN`. Token was not invented and was not read from chat. Website/bhfos-site was not used.

## Evidence (label honestly)

| Claim | Tier |
|---|---|
| PR 146 merge onto hotfix | **merged** @ `c4d344b` |
| Combined SPA contents | **locally verified** @ `c4d344b` |
| Live CRM still `0d6bcbb8` | **production** (browser `build-info.json` + tenant-select chrome) |
| Hosted replace of `app.bhfos.com` | **Not done** |
| Hosted SQL / function deploy | **Not done** |
| R1 / Slice 1 | **Inactive** |

## Not this hop

- PRs 144 and 145 stay draft.
- Website/bhfos-site is not the convention app.
- No force-push, amend, rebase, squash, or history rewrite.
- No `SUPABASE_DB_PASSWORD` use. No hosted data/SQL modification.
- No full browser E2E (separate independent Browser QA agent).

## Exact next action

Inject operator `HOSTINGER_API_TOKEN` into this Release Runner environment, then execute the already-built combined archive to `https://app.bhfos.com` via `deploy-hostinger-static.mjs --execute --environment=production --sha=c4d344b13715914f0a452222fdb0a0417061d0bb --i-understand-production`. Immediate health: live CRM still loads; join path exists; no CRM wipe. On regression, restore the `0d6bcbb8` rollback zip.

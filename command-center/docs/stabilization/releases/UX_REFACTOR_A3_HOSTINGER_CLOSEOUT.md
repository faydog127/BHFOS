# UX-REFACTOR A3 — Hostinger production deploy closeout

| Field | Value |
| --- | --- |
| Slice | UX-REFACTOR |
| Gate | A3 Hostinger deploy |
| Disposition | **UX_REFACTOR_PRODUCTION_DEPLOY_PASS** |
| Authorized | Founder 2026-07-23 — Hostinger only; no DB migrations; no Stripe/auto-charge; no S7; no Photo Bundles |
| Target | https://app.bhfos.com |
| Deployed SHA | `c469f7c8174642f40ca60756c124dec63a80bb10` |
| Founder typed SHA note | Typed `c469f7c0388fc…` (hybrid of tip prefix + prior prod suffix). Unique main tip `c469f7c…` resolved to full SHA above; prior prod retained as rollback. |
| Authorization ref | `Founder-UX-REFACTOR-A3-Hostinger-c469f7c` |
| Deployed at | 2026-07-24T01:25:29Z (build-info generatedAt) |
| Worktree | `F:\Dev\BHFOS-ux-refactor` |

## Pre-deploy snapshot (rollback point)

| Field | Value |
| --- | --- |
| Prior prod SHA | `fcc1fccf0388fc896e29e13f0b6261265f60e9d5` |
| Prior migrationVersion | `20260723201000` |
| Rollback procedure | Standard snapshot rollback = redeploy retained prior SHA archive / rebuild+deploy `fcc1fcc…` via `deploy-hostinger-static.mjs --execute` (no DB reverse) |
| Local new archive | `command-center/crm-c469f7c81746.zip` |

## Bounds respected

- No Supabase migrations applied
- No Stripe / auto-charge changes
- No S7 / Photo Bundles work
- `migrationVersion` remained `20260723201000`

## Validation

| Check | Result |
| --- | --- |
| health-probe `https://app.bhfos.com` | **HEALTHY** |
| build-info `commitSha` | `c469f7c8174642f40ca60756c124dec63a80bb10` |
| build-info `migrationVersion` | `20260723201000` |
| Shell markers | Main bundle: `Work Orders`, `crm-mobile-bottom-nav`, `crm-nav-divider`. Lazy chunk `CrmPageHeader-52e92b9d.js`: `crm-page-header` (HTTP 200 on prod). |

## Next

UX-REFACTOR production chrome is live. Residuals remain non-blocking. Further Hostinger deploys still require Access Matrix **S**.

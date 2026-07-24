# V1 Evidence Manifest

| Field | Value |
| --- | --- |
| Closeout date | 2026-07-24 |
| Branch | `docs/v1-production-closeout` |
| Repo | https://github.com/faydog127/BHFOS |

## Evidence class legend

| Class | Meaning |
| --- | --- |
| **production evidence** | Observed this session from live endpoints or validated production artifacts |
| **repository evidence** | Present in `origin/main` / named SHA tree |
| **documentary evidence** | Prior closeout / decision packet / residual register |
| **reviewer report** | Peer-review or critique document |
| **inference** | Logical conclusion from other evidence |
| **unresolved** | Could not independently verify this session |

## Session production probes (2026-07-24)

| ID | Probe | Result | Class |
| --- | --- | --- | --- |
| E-PROD-01 | `GET https://app.bhfos.com/build-info.json` | HTTP 200 JSON | production evidence |
| E-PROD-02 | build-info `commitSha` | `c469f7c8174642f40ca60756c124dec63a80bb10` | production evidence |
| E-PROD-03 | build-info `migrationVersion` | `20260723201000` | production evidence |
| E-PROD-04 | build-info `generatedAt` | `2026-07-24T01:25:29.547Z` | production evidence |
| E-PROD-05 | build-info `frontendAssetVersion` | `12613602e4dbebdf` | production evidence |
| E-PROD-06 | build-info `environment` | `production` | production evidence |
| E-PROD-07 | HTML title at app root | “The Vent Guys CRM” (SPA shell) | production evidence |
| E-PROD-08 | Cloudflare bot interstitial on naive fetch | Observed then cleared; JSON endpoint returned cleanly | production evidence |

## Repository state (this session)

| ID | Fact | Value | Class |
| --- | --- | --- | --- |
| E-REPO-01 | `git rev-parse origin/main` | `2557ba28490ae38970b3a32de95130746a5b9333` | repository evidence |
| E-REPO-02 | `origin/main` subject | Merge PR #122 (`ux/v2-polish`) | repository evidence |
| E-REPO-03 | Commits ahead of prod UI tip | **13** (`c469f7c…` → `2557ba2…`) | repository evidence |
| E-REPO-04 | Code commits undeployed (src) | `0e592b2` (UX-POLISH), `db2bec9` (UXV2) | repository evidence |
| E-REPO-05 | Latest migration filename | `20260723201000_ml_p1_s8_definer_auth_hotfix.sql` | repository evidence |
| E-REPO-06 | SHA-256 of tip migration | `3B7F975AB64EB121D17896A800FB9E0796CE1403636429F7E6AF4CC54828DEC4` | repository evidence |
| E-REPO-07 | SHA-256 of S8 remediation migration | `7EBAB73E39F48B8B6A4058C476456A2751A15C08DE3DF15369E157E1A5349CBE` | repository evidence |
| E-REPO-08 | Prod UI tip still shows shell label | `"BHF CRM"` in `BHFCrmLayout.jsx` @ `c469f7c` | repository evidence |
| E-REPO-09 | Primary worktree `F:\Dev\BHFOS` | Dirty (TIS files) @ `98e77602ece3be140be1620582607d5e33f50ef3` detached | repository evidence |
| E-REPO-10 | Closeout worktree | `F:\Dev\BHFOS-v1-closeout` clean @ `2557ba2` | repository evidence |

## Documentary production authorities (cited, not re-executed)

| ID | Artifact | Claims used | Class |
| --- | --- | --- | --- |
| E-DOC-01 | `docs/stabilization/releases/UX_REFACTOR_A3_HOSTINGER_CLOSEOUT.md` | Hostinger deploy PASS @ `c469f7c…` | documentary evidence |
| E-DOC-02 | `docs/stabilization/releases/ML-P1_SLICE8_REMEDIATION_A3_CLOSEOUT.md` | Migrations applied; project `wwyxohjnyqnegzbxtuxs`; checksums match E-REPO-06/07 | documentary evidence |
| E-DOC-03 | `docs/stabilization/releases/ML-P1_SLICE6_A3_POSTAPPLY_CLOSEOUT.md` | auto-send/auto-charge OFF; checkout/offline/refunds/recon ON | documentary evidence |
| E-DOC-04 | `docs/governance/decisions/ML-P1_SLICE5_DECISION_PACKET.md` | Invoice immutability / void / write-off authority | documentary evidence |
| E-DOC-05 | `docs/governance/decisions/ML-P1_SLICE6_DECISION_PACKET.md` | No saved cards / portal / Terminal | documentary evidence |
| E-DOC-06 | Evidence JSON `docs/stabilization/releases/evidence/ml-p1-s8-remediation-prod-validation-S8-VAL-1784854621806.json` | URL `https://wwyxohjnyqnegzbxtuxs.supabase.co` | documentary evidence |

## Unresolved this session

| ID | Item | Why unresolved |
| --- | --- | --- |
| E-GAP-01 | Live `schema_migrations` row listing | No Founder-authorized DB session used |
| E-GAP-02 | Live `global_config` payment flags | Not re-queried; rely on E-DOC-03 |
| E-GAP-03 | Edge Function deploy versions / last-updated timestamps | Supabase Management API not invoked |
| E-GAP-04 | Whether `invoice-save` Edge remains reachable in prod routing | Source exists; prod route matrix not re-probed |
| E-GAP-05 | QuickBooks external sync of staging invoices | Ops/Founder non-code (R-UXP-03) |
| E-GAP-06 | Authenticated browser click-through of full money loop | Not performed this session |
| E-GAP-07 | SECURITY DEFINER grant matrix as currently applied | Not re-queried from `pg_proc` / ACL catalogs |

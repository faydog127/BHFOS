# Network OS — Implementation Status

**Branch after merge:** `network-os/foundation`
**Merged increment HEAD (PR 142 parent):** `03073f40499b5a3fa53054a3b0a26e3b8fbe5d96`
**Merge commit:** `9087e814de088d93a6de863407dc702fa0530c86`
**Merge parents:** `326e7a2941b9333f341716fff199d6ef6c913b53` + `03073f40499b5a3fa53054a3b0a26e3b8fbe5d96`
**Base at merge:** `network-os/foundation` `326e7a2941b9333f341716fff199d6ef6c913b53`
**PR:** https://github.com/faydog127/BHFOS/pull/142 (**merged**, ordinary merge, no squash, no force)
**Mission recorded here:** NOS-CONVENTION-PR142-RELEASE-01
**Product / R1 / Slice 1 activation:** **None**
**PR 140 / PR 141:** parked / frozen / not this increment

Do **not** equate: source-present · hosted-applied · merged · frontend-deployed · production-usable.

## Convention write path — verified state (2026-08-24)

| Surface | Evidence tier | Result |
|---|---|---|
| Isolated table + helper + HTTP owner @ pin `03073f4` | source-present + checksums | blobs match hosted-apply pin (comment 5399523492) |
| Hosted apply on project-ref `wwyxohjnyqnegzbxtuxs` | hosted-applied + function-deployed | table + helper present; function `network-os-provider-interest-intake` ACTIVE, `verify_jwt=false`; origin secret **name** `CONVENTION_INTAKE_ALLOWED_ORIGINS` present |
| PR 142 merge into `network-os/foundation` | **merged** | ordinary merge `9087e81`; pin is second parent |
| Names-only durable bind (Erron Fayson → `bhis_convention_intake`) | hosted grant | match class **PRESENT**; one row inserted; durable role count **1**; no UUID/email/phone printed |
| Frontend on `https://app.bhfos.com` | **not this increment** | live `build-info` is `environment=production`, `branch=hotfix/v1-crm-layout-hooks`, generated 2026-08-14. Join `/network-os/convention/join` redirects to `/select-tenant`. Provider interest form is **not** REACHABLE. |
| Browser synth e2e | **not run** | stopped: convention routes not on the live CRM bundle |
| Synth intake rows | hosted count | remaining **0** (none created this release chat) |
| Customer tables | hosted counts unchanged | `leads` 73 / `contacts` 20 / `partner_prospects` 41 / `submissions` 2 / `events` 979 |

## Release stop (scope mismatch)

NOS-CONVENTION-PR142-RELEASE-01 authorized a controlled command-center convention-route deploy to `https://app.bhfos.com` only, with **no broader production change**.

Independent browser proof showed the live Hostinger CRM is a **different** production bundle (`hotfix/v1-crm-layout-hooks`, 2026-08-14) whose `commitSha` is not the merged foundation tree (`9087e81` / pin `03073f4`). Replacing that live CRM with a `network-os/foundation` production build would be a broader frontend change than convention routes.

**Stopped before Hostinger upload.** `HOSTINGER_API_TOKEN` was requested then unused. Marketing Vercel / Website/bhfos-site was not used.

**Verdict: PR142_RELEASE_BLOCKED** (merge + durable bind completed; frontend deploy + browser e2e not executed).

## Option A contract (unchanged)

| Requirement | Status |
|---|---|
| Isolated object | Only `public.network_os_provider_interest_intake`. No `tenant_id`. No `duplicate_key`. No FKs to `leads` / `contacts` / `partner_prospects` / `submissions` / `events`. |
| Stamps | `campaign_id=HUGE_2026`, `source=HUGE_2026`, `intake_channel=convention_qr`, initial `onboarding_status=provider_interest_received` |
| Helper | `public.network_os_actor_has_bhis_convention_intake()` exact role `bhis_convention_intake`. No admin/office fallback. |
| HTTP owner | `network-os-provider-interest-intake` only. Exact-origin CORS. No `*`. |
| Queue | helper RPC then RLS SELECT / status-only UPDATE. Client forbids `app_user_roles`. |
| R1 / Slice 1 | **None** |

## Checksums @ `03073f40499b5a3fa53054a3b0a26e3b8fbe5d96` (recomputed this release)

| Artifact | git blob | SHA-256 |
|---|---|---|
| Migration up | `942818e6a8b3bad628341cec6cc29bf131f48d51` | `8119c3e970c98fddcfe2cf3f2b63f2d4598c8f85b9ed71c7a56f3ed225cd5c14` |
| Function `index.ts` | `f91e562982ded0a49385b0a291bea53efc9cd52e` | `2659f3f3da258a6c9313937899c641344eb740277b66e8e615e16cb4cb5215bd` |
| Function `handler.mjs` | `2c1a01a1afcb32c1e4777225c9285d3d028c65cd` | `5fa93b7ceca0a64af09006449d32aa69e1dd2aad8434661f4a75b416153cf595` |
| Rollback sibling | `b3749c364752f88909c9a36bbcc7ad1d777cf9b9` | `e5769ed4fca40b519ee59bc7b965026dfd6f169bcf3dfece8cb13b9b3d7fb093` |

Do **not** `supabase db push`. Do **not** re-apply SQL unless a later packet names a new artifact SHA.

## Explicit non-actions (this release chat)

- No force-push. No squash of the pin. No unfreeze of PR 140 / 141.
- No R1 / Slice 1 activation.
- No customer-table writes. No `supabase db push`. No `SUPABASE_DB_PASSWORD`.
- No Hostinger / Website/bhfos-site / other-host deploy.
- No secret **values**, UUID, email, phone, or PAT printed.
- Apply-runner token locally unset after bind; Cursor-environment removal requested.
- `command-center/build-out.txt` untouched.

## Exact next action

Founder-authorized **surgical** convention-frontend deploy that does **not** replace the live `hotfix/v1-crm-layout-hooks` CRM bundle on `app.bhfos.com` — or an explicit authorization to replace that live bundle with merged `network-os/foundation` `9087e81`. Then browser synth e2e + synth cleanup. Keep the durable `bhis_convention_intake` bind unless Founder authorizes closeout.

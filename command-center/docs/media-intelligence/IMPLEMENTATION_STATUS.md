# Media Intelligence Library — Implementation Status

**Branch:** `feat/media-intelligence-library`  
**Verified HEAD at this status edit:** `28800eca7fd89bc58f7d6400c0353067a9a2076a`  
**Architecture:** Single-company (see `SINGLE_COMPANY_CORRECTION.md`)

## Owner Received inbox (2026-07-31) — DEPLOYED on production

| Field | Value |
|---|---|
| Product | Dedicated **Received** nav + dashboard section for `contributor_self` uploads; Review Queue tab “From contributors” |
| Hosted | `https://app.bhfos.com` SHA **c532ad7cc2b3** / `production` |
| Open | https://app.bhfos.com/media/received |
| Known prod row | `MVI_4463.mp4` pending (Treezy / `contributor_self`) should appear there |
| Evidence tier | **DEPLOYED** (frontend). Owner browser USABLE pending hard refresh |

## Production — contributor self-upload + Treezy role (2026-07-30/31) — DEPLOYED

| Field | Value |
|---|---|
| Production home | `https://app.bhfos.com` + Supabase **`wwyxohjnyqnegzbxtuxs`** |
| Git tip deployed | `28800eca7fd8` (`feat/media-intelligence-library`; PR [#128](https://github.com/faydog127/BHFOS/pull/128) open for `main`) |
| Migrations | Twelve MIL versions `20260725120000`…`20260730180000` applied on `wwyx` (no unrelated older CRM gaps forced via `db push --include-all`) |
| Secrets | `MIL_RECONCILE_KEY` (new prod entropy) + `MIL_ALLOWED_ORIGINS` (includes `https://app.bhfos.com`); existing `OPENAI_API_KEY` retained |
| Edges | All seven `media-intel-*` ACTIVE on `wwyx` (deployed `--use-api`) |
| Frontend | Hostinger `production` / `app.bhfos.com` `build-info` SHA **28800eca7fd8** / `environment=production` / `migrationVersion=20260730180000`; bundle Supabase ref **only** `wwyxohjnyqnegzbxtuxs` |
| Hosted UI marker | `CreatorRoutes-2351ca8d.js` contains Upload my shots / My shots / contributor-upload-my-shots |
| Deploy archive | `command-center/tmp/production-28800eca7fd8-20260731T010029Z.zip` (auth `MIL-PROD-CONTRIBUTOR-SELF-UPLOAD-2026-07-30`) |
| Treezy | `treezyincent@gmail.com` on prod Auth (confirmed) + `app_user_roles.role = reel_creator` (**no** `tenant_id` column on prod) |
| Staging remains | `https://mil.bhfos.com` / `sdzhdupekcnekesbtxsl` untouched as staging |
| Explicit non-actions | No reconcile cron; website promote stays 503 |
| Evidence tier | **DEPLOYED** (prod schema + edges + CRM frontend + role). Browser **USABLE** for Treezy Upload my shots still owner/contributor hands-on |

## Contributor self-upload — Upload my shots (2026-07-30) — STAGING DEPLOYED; browser USABLE pending

| Field | Value |
|---|---|
| Commit | `52527c59de2b0817ae770d1d2f648f1fbf9b7ed3` |
| Product | Contributor JWT mints `create_contributor_session`; quarantine finalize; Review Queue; auto-assign to uploader; My shots list on `/creator` |
| Schema | `20260730180000_media_intel_contributor_self_upload.sql` — **applied** on `sdzhdupekcnekesbtxsl` |
| Edge | `media-intel-upload-session` + `media-intel-sign` redeployed (`--use-api`); creator mint smoke HTTP 200 + token |
| UI | Hosted `CreatorRoutes-92513759.js` has Upload my shots / contributor-upload-my-shots |
| Hosted frontend | `https://mil.bhfos.com` SHA **52527c59de2b** / `mil-staging` / `migrationVersion=20260730180000` / asset `2dbb7ce8b75daa50`; Supabase only `sdzhdupekcnekesbtxsl` |
| Deploy archive | `command-center/tmp/mil-staging-52527c59de2b-20260730T211125Z.zip` (auth `MIL-CONTRIBUTOR-SELF-UPLOAD-FRONTEND-2026-07-30`) |
| Tests | `npm run test:media-intel-helpers` **181 pass** |
| Non-goals | No full library browse; no originals; no reconcile cron |
| Evidence tier | **DEPLOYED** (API mint smoke). Browser USABLE (1–2 JPEG self-upload → Review → My shots) still owner/contributor hands-on |

## Owner-led acceptance (2026-07-30) — CONTRIBUTOR ACCEPT + DENY USABLE (ERRON)

| Field | Value |
|---|---|
| Observer | Erron (owner-led hands-on) |
| Host | `https://mil.bhfos.com` staging (`build-info` tip **39e4b941dc63** / `mil-staging` at record time) |
| Observed | Accept **and** denial tested from the contributor path — **worked** (owner-confirmed) |
| Prior distinct-identity (2026-07-29) | owner assignment → separate contributor login → preview/download → submit → owner review |
| Evidence tier | **USABLE** (owner-confirmed). Closes the prior gap that final accept/deny had not been evidenced. |
| Still not claimed | changes-requested / revised-version preservation cycle (unless later separately confirmed) |
| Production | Code merged via PR #127 (`9d70ef9` on `main`); production migrate/edge/CRM deploy still gated on credentials per packet below |

## Production release kickoff (2026-07-30) — SUPERSEDED BY PROD DEPLOY SECTION ABOVE

| Field | Value |
|---|---|
| Packet | [`PRODUCTION_APPLY_PACKET.md`](./PRODUCTION_APPLY_PACKET.md) |
| Git (earlier) | PR [#127](https://github.com/faydog127/BHFOS/pull/127) **merged** to `main` (`9d70ef9`); self-upload tip via PR [#128](https://github.com/faydog127/BHFOS/pull/128) |
| Outcome | Prod migrate + edges + `app.bhfos.com` Hostinger deploy completed 2026-07-31 (see **Production — contributor self-upload** section) |

## Owner-led acceptance (2026-07-29) — DISTINCT-IDENTITY WORKFLOW OBSERVED BY ERRON

| Field | Value |
|---|---|
| Observer | Erron (owner-led hands-on) |
| Observed | owner assignment → genuinely separate contributor login → contributor preview/download → contributor submission → owner review |
| Follow-up (2026-07-30) | Accept **and** denial from contributor path confirmed **USABLE** — see section above |
| Management API | Relisting **unavailable** when recorded (`SUPABASE_ACCESS_TOKEN` absent). Do not treat frontend work as blocked. Do not use anon/service-role/JWT as a management token. |
| Credential scan (prior + this session) | No credential-exposure incident. Hosted/frontend artifact: no `SUPABASE_ACCESS_TOKEN`, no `sbp_*` management-token pattern; any `service_role` hit is a role-name literal, not an embedded key. |
| Evidence tier | **USABLE** for the observed steps (owner-confirmed). |

## Contributor Workspace (2026-07-28) — FRONTEND DEPLOYED; owner-observed acceptance recorded

| Field | Value |
|---|---|
| Product name | **Contributor** / **Contributor Workspace** (UI) |
| Internal role | `reel_creator` retained (aliases: `creator`, `contributor`) |
| Routes | `/creator` workspace; `/contributor` → `/creator` alias |
| Schema | `20260728140000_media_intel_contributor_workspace.sql` — assignment pause + brief fields; assign denies archived/trashed |
| Edge | `media-intel-sign` trash denial; `media-intel-creator-admin` passes brief fields; `media-intel-analyze` prefers `ai_safe`/`heic_preview` JPEG derivatives (HEIC originals no longer sent to OpenAI) |
| Staging identities | `mil-staging-admin@672803569.test`, `mil-staging-creator@1949824099.test` (no real-recipient invite) |
| Hosted frontend (contributor polish) | `https://mil.bhfos.com` SHA **bd729820333f** / `mil-staging` / only `sdzhdupekcnekesbtxsl` — **DEPLOYED** |
| HEIC AI path | Staging generated `heic_preview`+`ai_safe` for **26/26** HEIC; re-analyze **26/26 OK**; social-suitable still sparse (AI classification) |
| Rollback archive | `command-center/tmp/mil-staging-7532e65313ae-20260728T115135Z.zip` (+ preserved copy under `tmp/mil-hosting-backup-20260728/`) |
| Note | Quality Cleanup migration `20260728120000` verified applied; lifecycle helpers wired into `test:media-intel-helpers`. Distinct-identity acceptance observed by Erron (see section above). |

## Contributor workbench A→B (2026-07-28) — FRONTEND DEPLOYED (included in bd72982 polish tip)

| Field | Value |
|---|---|
| Scope | Assignment workbench UX only — no AI analyze, no full-library search |
| A | Honest **Working copy (JPEG)** labels (HEIC source called out); in-page thumbs via signed `grid_thumb`/`detail_preview`; **Download all working copies** (blob save, never originals) |
| B | Filename search **within assigned set**; read-only **approved-use chips** from `mil_permitted_uses` |
| Code | `src/lib/mediaIntel/contributorWorkspace.js`; `MediaCreatorWorkspace.jsx`; `listAssets` select includes `mil_permitted_uses` |
| Tests | `tests/unit/media-intel-contributor.test.mjs` helper + UI contract coverage |
| Hosted frontend | `https://mil.bhfos.com` `frontendAssetVersion=361ea9ce209d35fb` / `environment=mil-staging` / `commitSha=7532e65313ae…` / Supabase **only** `sdzhdupekcnekesbtxsl`; hosted `CreatorRoutes-8166e7cd.js` contains Working copies / Download all / contributor-media-search |
| Deploy archive | `command-center/tmp/mil-staging-7532e65313ae-20260728T215415Z.zip` (auth `MIL-CONTRIBUTOR-WORKBENCH-AB-FRONTEND-2026-07-28`) |
| Honesty note | Artifact includes **uncommitted** A/B UX; `build-info.commitSha` still reports `7532e653…` until A/B is committed |
| Evidence tier | **DEPLOYED**; owner-observed distinct-identity acceptance recorded 2026-07-29 |
| Neighbors | `bhfos.com` / `app.bhfos.com` HTTP 200 after deploy |
| Non-goals kept | No contributor AI console; no tag/library browse (RLS staff-only for tags); no originals |

## Contributor workbench tight UI (2026-07-28) — FRONTEND DEPLOYED (included in bd72982 polish tip)

| Field | Value |
|---|---|
| Scope | Presentation cleanup only — no new contributor capabilities |
| Top block | Single **Your brief** (creative instructions only; pack/AI-score inventory notes filtered); output/format/due + asset count; **standing rules** once |
| Media cards | Thumb + approved-use chips + Preview/Download — **no filename title**, no per-card honesty prose |
| Search | Filename search shown only when assigned set `> 12` |
| Code | `summarizeContributorBrief` / `looksLikeInventoryNote` / `CONTRIBUTOR_STANDING_RULES` in `contributorWorkspace.js`; `MediaCreatorWorkspace.jsx` |
| Hosted frontend | `https://mil.bhfos.com` `frontendAssetVersion=4c0a3d212a6698ca` / `mil-staging` / SHA label `7532e653…` / Supabase only `sdzhdupekcnekesbtxsl`; hosted `CreatorRoutes-4b4d237c.js` has Your brief / standing rules / Download all |
| Deploy archive | `command-center/tmp/mil-staging-7532e65313ae-20260728T223040Z.zip` (auth `MIL-CONTRIBUTOR-TIGHT-UI-FRONTEND-2026-07-28`) |
| Honesty note | Artifact includes **uncommitted** tight UI; `build-info.commitSha` still reports `7532e653…` |
| Evidence tier | **DEPLOYED**; owner-observed distinct-identity acceptance recorded 2026-07-29 |
| Neighbors | `bhfos.com` / `app.bhfos.com` HTTP 200 after deploy |

## Review Queue list thumbs (2026-07-29) — FRONTEND DEPLOYED

| Field | Value |
|---|---|
| Commit | `39e4b941dc63022167750d2dbd5e8e4426bb8349` |
| Scope | Awaiting-review sidebar shows signed preview thumb + filename; honest Photo/Video fallback when missing/failed |
| Code | `MediaReviewQueue.jsx` `loadQueueThumbs` → `assetPreviewUrl` per row (`allowOriginal: false`; PREVIEW derivatives only; img `onError` clears broken thumbs; failure never breaks queue) |
| Tests | `media-intel-lifecycle` asserts thumb markers, no `allowOriginal: true`, no `createSignedUrl`, API preview contract |
| Keep/Archive/Trash/AI | Unchanged wiring retained |
| Hosted frontend | `https://mil.bhfos.com` `frontendAssetVersion=d03f26e8e92869b8` / `mil-staging` / SHA **39e4b941dc63** / Supabase only `sdzhdupekcnekesbtxsl`; hosted `MediaReviewQueue-598deb8c.js` has thumb + fallback markers; `CreatorRoutes-519a518e.js` polish markers retained |
| Deploy archive | `command-center/tmp/mil-staging-39e4b941dc63-20260729T220648Z.zip` (auth `MIL-REVIEW-QUEUE-THUMBS-FRONTEND-2026-07-29`) |
| Rollback archive | `command-center/tmp/mil-rollback-bd729820333f-before-39e4b941dc63-20260729.zip` SHA-256 `B5722D91A614C48F663FA45A9BE5D2BF90D585EB71DB717C959D45B753ACE18D` (prior polish tip) |
| Artifact scan | Only project ref `sdzhdupekcnekesbtxsl`; no `SUPABASE_ACCESS_TOKEN`; no `sbp_*`; JWT-like hits = public anon key only; `service_role` is role-name literal |
| Neighbors | `bhfos.com` / `app.bhfos.com` HTTP 200 after deploy |
| Evidence tier | **DEPLOYED** (list-thumb browser USABLE not re-run this session; contract locally verified) |

## Contributor polish pass (2026-07-28) — FRONTEND DEPLOYED; owner-observed acceptance recorded

| Field | Value |
|---|---|
| Commit | `bd729820333f707d6e8a829dfd786a46c4b47fbc` |
| Owner | Assign form requires creative **Brief** (`isValidContributorBrief`); rejects empty / inventory notes |
| Contributor | Primary **Download all** CTA; denser 2/3-col square grid; pack summary + due prominence; quieter standing rules; “Next: submit” hint |
| Staging fixture brief | **Done** — 10 active pack assignments share creative `instructions`; inventory `notes` cleared |
| Hosted frontend | `https://mil.bhfos.com` `frontendAssetVersion=53a0c11ef74623ba` / `mil-staging` / SHA **bd729820333f** / Supabase only `sdzhdupekcnekesbtxsl`; `CreatorRoutes-605d0d43.js` + `MediaSettings-0697d218.js` polish markers verified |
| Deploy archive | `command-center/tmp/mil-staging-bd729820333f-20260728T224523Z.zip` (auth `MIL-CONTRIBUTOR-POLISH-FRONTEND-2026-07-28`) |
| Reel upload edge | Contributor JWT mint against `media-intel-reel-upload` returned HTTP 200 (edge reachable) |
| Neighbors | `bhfos.com` / `app.bhfos.com` HTTP 200 |
| Acceptance | Erron completed distinct-identity assign → contributor login → preview/download → submit → owner review (see top section) |
| Evidence tier | **DEPLOYED** + observed acceptance steps **USABLE** (owner-confirmed). Management API not relisted this session. |

## Quality Cleanup workflow (2026-07-28) — staging-applied + API verified

| Field | Value |
|---|---|
| Plan | [`QUALITY_CLEANUP_PLAN.md`](./QUALITY_CLEANUP_PLAN.md) |
| Schema | `trashed_at`, `purge_eligible_at`, `lifecycle_*`, `ai_lifecycle_recommendation` / `ai_quality_issues` / `ai_usability`; RPCs `mil_set_asset_lifecycle` + bulk |
| AI | `mil-v2-lifecycle` advisory disposition only — never auto archive/trash/delete |
| UI | Review Keep·Archive·Trash; `/media/quality-cleanup` bulk; Archive/Trash tabs + owner permanent delete after 30d |
| Hard rule | AI never permanently deletes originals |
| Staging | Migration `20260728120000` **applied** on `sdzhdupekcnekesbtxsl` (SQL-verified). Keep/Archive/Trash/Restore API PASS on synthetic fixture. Assign-while-trashed **denied** after contributor hardening. |
| Follow-ups | Duplicate identification; large-video cellular Safari; `creator_download` derivative generation pipeline |

## Resilient mobile upload + visible AI analysis (2026-07-28) — PASS (desktop + real-phone USABLE)

| Field | Value |
|---|---|
| Plan | [`RESILIENT_UPLOAD_ANALYSIS_PLAN.md`](./RESILIENT_UPLOAD_ANALYSIS_PLAN.md) |
| Client | IndexedDB durable queue (`mil-upload-queue`), signed TUS + PUT fallback, Wake Lock secondary, analysis poll + client analyze invoke |
| Server | `client_upload_id` migration; `media-intel-upload-session` refresh/idempotent mint + non-aborted post-finalize analyze; `media-intel-analyze` mil-v2 structured outcome |
| Staging apply | Migration `20260728010000_media_intel_client_upload_id.sql` on `sdzhdupekcnekesbtxsl`; Edge `media-intel-upload-session` + `media-intel-analyze` redeployed |
| Login | MIL `next` destinations preserved through Login (no forced `/tvg/crm`) |
| Artifact isolation | Brand/storage URLs derive from `VITE_SUPABASE_URL` (no hardcoded production project ref in `src/` or hosted `dist`) |
| Hosted deploy | `https://mil.bhfos.com` `environment=mil-staging` tip `4b0949f2014905800e21e94aa767b48da345ae07` |
| Desktop acceptance | Mixed batch 5/5 → analysis complete (auto UI); review card fields visible; 35s offline → 5/5 recovered; refresh during upload queue restored |
| Real-phone (USABLE, owner) | Photo upload → analysis → Review Queue; refresh mid-upload → Reselect/recover; stale Uploads rows clear once Review has the asset; screen-lock mid-upload recovered |
| Residual risk | Large cellular video (~40MB) earlier stuck at minted/0 bytes — not re-proven in this PASS; treat large-video Safari/cellular as follow-up if needed |
| Rollback archive | `command-center/tmp/mil-staging-*-*.zip` (prior `a7c52ce…` + current tip archives) |

---

## Hosted frontend correction (2026-07-27) — PASS

| Field | Value |
|---|---|
| Approved origin | `https://mil.bhfos.com` |
| Staging backend | `sdzhdupekcnekesbtxsl` only |
| Hostinger username | `u986242606` |
| **Final MIL document root** | `/home/u986242606/domains/bhfos.com/public_html/mil` |
| **bhfos.com testing root** | `/home/u986242606/domains/bhfos.com/public_html` |
| **app.bhfos.com CRM root** | `/home/u986242606/domains/app.bhfos.com/public_html` |
| Isolation | MIL subdomain recreated with `directory=mil`, `is_using_public_directory=false` (no longer shares bare `public_html`) |
| DNS | Cloudflare CNAME `mil` → `mil.bhfos.com.cdn.hstgr.net` (owner-applied; public resolve verified) |
| HTTPS | Let's Encrypt cert `CN=mil.bhfos.com`; HTTP→HTTPS 301 verified |
| Deploy | Staging-built artifact on Hostinger; `build-info` `environment=mil-staging`, commit `a7c52ce857e8d72944fe859f9e4011cbfd34b2e4` |
| Auth | Staging `uri_allow_list` includes `https://mil.bhfos.com` (+ localhost); unauthenticated `/media/dashboard` → login; staging admin reaches MIL |
| Edge | `MIL_ALLOWED_ORIGINS` set; hosted `media-intel-analyze` `config_status` **200** `configured: true` |
| Hosted routes | `/`, `/media/dashboard`, `/media/uploads`, `/media/all`, `/media/review`, `/uploads`, `/all`, `/review` SPA OK |
| Neighbors | `bhfos.com` testing site + `app.bhfos.com` CRM still up |
| Rollback archive | local `command-center/tmp/mil-staging-a7c52ce857e8-*.zip` |
| Tooling tip | `fe0fb01362ee368aa2916b311efb0293e3ec276d` |

---

**Historical / document baseline (branch ancestry from `main`):** `9369d206bfbcaf32267e9e88518b222146e11de8`  
**MIL packet baseline (finalization lifecycle):** `c1767e4427e24d0a9c45638bf8fdd7607d0ab8b9`  
**Authorized staging-apply tip (pre-write gate):** `ad8aaa60c63bae08a39c3ab587ca373810cc1461`  
**Upstream note:** prior search-repair tip `a7c52ce857e8d72944fe859f9e4011cbfd34b2e4`  
**Working tree note:** do not commit `command-center/build-out.txt` or `supabase/.temp/`

**Relay:** root [`AGENTS.md`](../../../AGENTS.md) + [`docs/RELAY_PROTOCOL.md`](../RELAY_PROTOCOL.md)  
**Last consolidated review:** 2026-07-27

## Staging apply (2026-07-27) — EXECUTED on designated MIL staging

Founder authorized [`STAGING_APPLY_PACKET.md`](./STAGING_APPLY_PACKET.md) against designated project only:

| Field | Value |
|---|---|
| Name | BHFOS MIL Staging |
| Ref | `sdzhdupekcnekesbtxsl` |
| URL | `https://sdzhdupekcnekesbtxsl.supabase.co` |
| Org / region / status | The Vent Guys · us-east-1 · `ACTIVE_HEALTHY` |
| Repo link | **None** (apply via Management API + `--project-ref`) |
| Production / excluded | `wwyxohjnyqnegzbxtuxs`, `glkrykpksbsqmmilmjhs`, `rngfowbxiqeyslnncblw` — **untouched** |

### Applied migrations (8)

`20260725120000`, `20260725130000`, `20260725140000`, `20260725150000`, `20260726090000`, `20260727120000`, `20260727130000`, **`20260727140000`** — recorded in `supabase_migrations.schema_migrations`.

### Secrets / Edge Functions

- Secrets set (names only): `MIL_RECONCILE_KEY`, **`OPENAI_API_KEY`** (staging only; sourced from operator env, not `VITE_*` / not in `src`/`dist`/`build-out`); **`MIL_ALLOWED_ORIGINS`** (includes `https://mil.bhfos.com`)
- Deployed ACTIVE: `media-intel-upload-session`, `media-intel-upload-reconcile`, `media-intel-sign`, `media-intel-analyze`, `media-intel-promote-website`, `media-intel-creator-admin`, `media-intel-reel-upload`
- Reconcile cron / `pg_cron`: **not configured** (`health.scheduler` = none; no `pg_cron` extension)

### OpenAI staging config (2026-07-27)

| Check | Result |
|---|---|
| Key location | Operator environment `OPENAI_API_KEY` (prefix `sk-`); **not** in frontend env names |
| Client exposure | **None** — absent from `src/`, `dist/`, `build-out.txt`; no `VITE_OPENAI_*`; build-production disallows `VITE_OPENAI_API_KEY` |
| Staging secret | Set on `sdzhdupekcnekesbtxsl` as `OPENAI_API_KEY` |
| `config_status` | **PASS** `configured: true` |
| Analyze smoke (synthetic 64×64 JPEG asset) | Earlier 403 on default model; after `MIL_OPENAI_MODEL=gpt-5.2` synthetic smoke **PASS** (`provider=openai`, `model=gpt-5.2`, `status=succeeded`) |
| Production / excluded | **Not** configured |

### Representative fixture browser acceptance (2026-07-27) — FAIL (search defect)

Gate against `sdzhdupekcnekesbtxsl` using local Vite + staging Auth (`mil-staging-admin@672803569.test`). **REPRESENTATIVE FIXTURE ACCEPTANCE** (sanitized generated vent before/after + low-quality JPEGs; no real customer media; no EXIF APP1).

| Check | Result |
|---|---|
| Staging identity | `BHFOS MIL Staging` / `sdzhdupekcnekesbtxsl` confirmed before writes |
| UI upload (3 fixtures) | **PASS** — transfer session → `In the library` / `uploaded`; assets `ce6eb7ed…`, `cc8c7c1c…`, `f85280f5…`; no duplicates |
| UI on-demand analyze | **PASS** — Review Queue `Queue analysis` → `media-intel-analyze`; all three `mil_ai_analyses.status=succeeded`, `provider=openai`, `model=gpt-5.2`, jobs `succeeded` |
| Analysis usefulness | **PASS for fixtures** — honest/cautious; before/after tagged; low-q marked unusable for marketing; no invented conclusive mold/damage claims |
| Results in UI + after reload | **PASS** (reselect asset after analyze; full reload still shows `openai/gpt-5.2`) |
| Before/after | AI did **not** propose a pair; reviewer-allowed insert of `possible_before_after` then UI **Confirm** → `before_after` / `confirmed` |
| Tag/filename search | **FAIL** — `listAssets` `id.eq.${search}` throws `invalid input syntax for type uuid` on non-UUID queries; placeholder claims tags but search does not join tags |
| Dashboard counts | Photos **5→8** after upload; fixtures later **archived** via Review Queue Archive |
| Secrets / stacks in UI | **None** observed |
| ACL (9 finalize RPCs) | `anon_exec=false`, `authenticated_exec=false`, `service_role_exec=true` |
| Promote / website objects / `pg_cron` | Still **0** / **0** / not installed |
| Cleanup | Fixtures archived in staging; disposable `public/mil-acceptance-tmp` removed; no production touch |

**Gate verdict:** **FAIL** — core upload/analyze/display/persist passed; All Media search is a material usability defect.

### All Media search repair + acceptance retest (2026-07-27) — PASS

| Item | Detail |
|---|---|
| Defect repaired | `listAssets` no longer applies `id.eq.${search}` to arbitrary text; UUID equality only when syntactically valid; filename ILIKE via quoted/safe filters; tag search against authoritative `mil_asset_tags.tag_slug` |
| Code | `src/lib/mediaIntel/assetSearch.js` (new); `api.js` `listAssets`; `MediaAllMedia.jsx` trim + empty-search copy; `tests/unit/media-intel-search.test.mjs`; `package.json` helper script includes search tests |
| Focused tests | `npm run test:media-intel-helpers` → **148 pass / 0 fail** (includes search suite) |
| Browser retest | Local Vite + staging `sdzhdupekcnekesbtxsl`; fixtures `sr_before_vent_lint.jpg` / `sr_after_vent_clean.jpg` / `sr_lowq_ambiguous.jpg` |
| Upload + gpt-5.2 analyze + UI display + hard-reload persist | **PASS** |
| Filename / tag / UUID / clear / no-match / special-char search | **PASS** in All Media UI (no UUID PostgREST errors); `vent` overlap returned 2 unique assets |
| ACL / promote / cron / website objects | Unchanged (`anon`/`authenticated` cannot EXECUTE finalize RPCs; promotions/objects/`pg_cron` = 0) |
| Cleanup | Retest fixtures archived; disposable `public/mil-search-retest-tmp` removed |

**Known search scale limits (documented, not expanded this gate):** tag-row lookup `.limit(1000)`; unique tag-derived `id.in` capped at 200 for URL safety; final asset page still uses existing `limit` (UI 120). Adequate for current internal single-company volume; not a full-text search index.

**Gate verdict:** **PASS** — search works safely by UUID, filename, and persisted tag; representative upload/analyze/store/display/refresh still passes; security intact. Does **not** authorize push/merge/Hostinger/production.

### Verification

| Suite | Result |
|---|---|
| SQL `00`–`05` | **PASS** (initial apply); `00`/`04` **re-PASS** after `20260727140000` |
| Smoke upload mint→PUT→complete | **PASS** (`status=uploaded`; asset visible) |
| Smoke verify / collections / B&A | **PASS** |
| Smoke promote | **503** `not_implemented` (expected) |
| Smoke unpublish (no prior promotion) | **404** honest empty |
| Smoke reconcile health | **PASS** `configured: true`, scheduler none |
| Smoke analyze config_status | **PASS** initially `configured: false`; after secret set **PASS** `configured: true` |
| Smoke sign / creator-admin / reel review / reel-upload mint | **PASS** |

### Documented deviations (empty-project staging)

1. **Prerequisite:** created minimal `public.app_user_roles` (`user_id`, `role`, `tenant_id`, `created_at`) — required by MIL role helpers / SQL `05` on an empty project (not one of the original seven packet files).

### Forward ACL backport (2026-07-27) — `20260727140000`

Created and applied **only** on `sdzhdupekcnekesbtxsl` (did **not** rewrite prior migrations):

| Item | Detail |
|---|---|
| File | `supabase/migrations/20260727140000_media_intel_finalize_rpc_execute_acl.sql` |
| Intent | Explicit `REVOKE ALL … FROM public, anon, authenticated` on the nine finalization RPCs; re-`GRANT EXECUTE` to `service_role` only |
| Before (hosted-like reseed for proof) | `anon_exec=true`, `authenticated_exec=true`, `service_role_exec=true` on all nine |
| After | `anon_exec=false`, `authenticated_exec=false`, `service_role_exec=true`; `proacl=postgres=X/postgres,service_role=X/postgres` |
| Re-verify | SQL `00_schema_contract` **PASS**; `04_upload_privilege_matrix` **PASS** |

### Staging inventory (post-smoke)

25 `mil_*` tables; buckets `media-intel-originals`, `media-intel-derivatives`, `website-public-media`; smoke users/objects present from verification only.

**Evidence label:** migrations + edges are **staging-applied / staging-deployed** with SQL + smoke evidence on `sdzhdupekcnekesbtxsl`. Not production. Not merged. CRM frontend staging deploy not performed.

## Status buckets (used throughout MIL docs)

| Bucket | Meaning |
|---|---|
| **1. Implemented and locally proven** | Source + unit/contract tests pass (`npm run test:media-intel-helpers`); behavior verified without live Supabase |
| **2. Implemented but requiring staging proof** | SQL/edge code exists in repo; not applied/deployed to an authorized staging project |
| **3. Scaffold/UI only** | Routes/components present; end-to-end behavior not proven against live DB/storage |
| **4. Deferred** | Explicitly out of scope for this slice |
| **5. Disabled pending safe implementation** | Code path exists but intentionally returns blocked/disabled until a proven pipeline exists |

## Migrations (staging-applied on `sdzhdupekcnekesbtxsl`; still **not** production)

| File | Scope |
|---|---|
| `20260725120000_media_intelligence_library.sql` | Core `mil_*` schema, buckets, role helpers, RLS baseline, derivative kinds incl. `public_safe` / `ai_safe`, customer-permission gates |
| `20260725130000_media_intel_access_sessions.sql` | Upload sessions, grant binding, bearer phone upload |
| `20260725140000_media_intel_pre_staging_hardening.sql` | Capability-matrix RLS (drops `mil_staff_all_*`), SECURITY DEFINER RPCs, `mil_finalize_upload_grant`, `mil_is_reviewer` excludes `office` |
| `20260725150000_media_intel_analyze_honesty.sql` | Honest analyze skip reasons (`skipped_needs_ai_safe_derivative`, etc.) |
| `20260726090000_media_intel_upload_finalization_lifecycle.sql` | Durable upload finalization state machine; `abandoned_count`; `mil_integrity_alerts`; nine `service_role`-only RPCs; **drops** `mil_finalize_upload_grant` and `mil_cleanup_expired_upload_grants`; removes client write grants on all lifecycle tables |
| `20260727120000_media_intel_website_public_bucket.sql` | Idempotent `website-public-media` bucket (public read) + anon/authenticated SELECT + `service_role` all; does **not** enable promote |
| `20260727130000_media_intel_client_table_grants.sql` | States `authenticated` SELECT (+ intended writes) and `service_role` full DML on non-lifecycle `mil_*` tables so capability-matrix RLS is reachable; does **not** restore client INSERT/DELETE on `mil_assets` or lifecycle tables |
| `20260727140000_media_intel_finalize_rpc_execute_acl.sql` | Hosted ACL backport: revoke finalization RPC EXECUTE from `anon`/`authenticated` (and `public`); preserve `service_role` EXECUTE — **staging-applied** on `sdzhdupekcnekesbtxsl` |

Packet migrations through `20260727130000` plus ACL backport `20260727140000` are **staging-applied** on `sdzhdupekcnekesbtxsl`. Still **not** production.

### Why 20260726090000 exists

The previous one-shot `mil_finalize_upload_grant` inserted the `mil_assets` row and
*then* asked storage to place the bytes. An interruption between those two steps
left a library entry for media that did not exist, and the phone had already been
told "uploaded" — the worst possible failure for someone who is about to clear
their camera roll. Finalization is now a persisted state machine
(`minted → placing → placed → committed | duplicate | failed | abandoned`), and the
commit transaction proves the final object is visible in `storage.objects` before
an asset row can exist. An interrupted transfer is reconciled from recorded state
instead of guessed at.

Two further consequences of that migration:

- **Client writes are gone, not just policy-restricted.** `INSERT`/`UPDATE`/`DELETE`
  on `mil_upload_batches`, `mil_upload_grants`, `mil_manifest_entries`,
  `mil_upload_sessions` and `mil_integrity_alerts` are revoked from `authenticated`
  and `anon`; `mil_assets` keeps `UPDATE` for the reviewer policy but loses
  `INSERT`/`DELETE`. Correct-looking RLS on a table the role can still write is not
  a control.
- **Surviving grants are stated explicitly.** The migration re-grants `SELECT`
  (and the reviewer `UPDATE`) rather than trusting whatever default privileges an
  environment happened to have, because the local disposable stack and the hosted
  project do not start from the same table ACL.

## Edge functions (staging-deployed on `sdzhdupekcnekesbtxsl`; still **not** production)

| Function | Status |
|---|---|
| `media-intel-upload-session` | **2** — mint/complete driving the finalization state machine: begin (lease) → re-hash quarantine → place with `upsert:false` → mark placed → commit with catalog proof |
| `media-intel-upload-reconcile` | **2** — `health` / `run` / `grant`; finishes or fails stranded grants and sweeps quarantine bytes whose grant is already safe. Requires `MIL_RECONCILE_KEY`; **no schedule is configured** |
| `media-intel-sign` | **2** — server-side signed URL minting (replaces client `createSignedUrl`) |
| `media-intel-analyze` | **2** — invoke-on-demand only; no background worker drains `mil_processing_jobs` |
| `media-intel-promote-website` | **5** — `prepare_public_safe` / `promote` return **503 `not_implemented`**; `unpublish` only |
| `media-intel-creator-admin` | **2** — invite/assign/revoke creators (requires deploy) |
| `media-intel-reel-upload` | **2** — creator reel PUT via signed URL (requires deploy) |

Shared CORS helper: `supabase/functions/_shared/milCors.ts` (**1** — imported by every `media-intel-*` function).

## Client / UI

| Area | Status | Notes |
|---|---|---|
| Product routes `/media/*`, `/creator/*`, `/media/upload` | **1 + 3** | Wired in `App.jsx`; pages are scaffold until staging data exists |
| CRM alias `/crm/media/*` → `/media/*` | **1** | Redirect only; grants no extra access |
| `MediaSessionGuard` + capability guards | **1** | Client hints; **RLS is authoritative** |
| Upload client (`uploadManager.js`) | **1** | Rewritten onto `media-intel-upload-session`. The browser no longer writes batches, manifests, grants or asset rows, and no longer constructs storage paths — every path is minted by the server |
| Authenticated mobile upload batchId | **1** | `MediaMobileUpload` keeps minted `token`+`batchId` in a ref so the first upload after `createUploadSession` does not race stale React state |
| Upload resumability | **4 — deferred** | **Uploads are not resumable in this release.** The previous IndexedDB/TUS resume path was removed with the client rewrite: it resumed against client-chosen paths that the server no longer trusts. An interrupted transfer must be re-selected and re-sent |
| Honest per-file upload states | **1** | `uploaded` / `duplicate` / `pending_reconcile` / `in_progress` / `expired` / `revoked` / `failed` / `skipped`. Only an explicit **200** becomes a success state; a `202 pending_reconcile` is shown as unfinished, never as saved |
| Operator reconcile runbook + UI copy | **1** | [`RECONCILE_OPERATOR.md`](./RECONCILE_OPERATOR.md); Media Uploads / Settings explain stranded `pending_reconcile` — **no** browser reconcile button (`MIL_RECONCILE_KEY` stays edge-only) |
| Practical max upload **250 MB** | **1** | `checksum.js` / `constants.js`; not 2 GB (memory/hashing honesty) |
| Phone upload link format `#session=` | **1** | Fragment preferred over `?session=` (see `MediaSettings.jsx`, `MediaMobileUpload.jsx`) |
| Client `signedUrl()` / `audit()` | **5** | Throw — use `requestSignedMediaUrl` + server RPC audit |
| Grid thumb derivatives (client JPEG) | **3** | Preview path exists; staff cannot write trusted derivatives to storage (quarantine-only INSERT policy) |
| Review queue | **1 + 3** | Verify / permitted-use / on-demand AI await+errors / archive+restrict wired; still needs staging data for USABLE proof |
| All Media `dup=1` | **1** | Honors dashboard duplicate deep-link via `listAssets({ duplicatesOnly })`; removed fake bulk-selection affordance |
| Dashboard nav honesty | **1** | Creator assignments → `/media/settings`; upload copy no longer claims resumable |
| Creator workspace IA | **1 + 3** | Single honest `/creator` workspace (fake media/reels/upload tabs removed); reel-upload failures are retryable with deploy-unavailable copy. Still needs deployed `media-intel-reel-upload` for USABLE proof |
| Before/after confirm UI | **1 + 3** | Confirm/reject errors + busy disable wired; needs staging data for USABLE |
| Collections membership | **1 + 3** | Create / add / remove by asset UUID; no picker yet; needs staging proof |
| Reel review | **1 + 3** | Approve/deny/revision via RPC; error honesty + no-publish copy; needs staging proof |
| Dashboard counts | **1 + 3** | Queries `mil_*`; throws on query errors (no silent zero mask); empty-state + on-demand AI copy. Still needs staging data for USABLE |
| Settings / approved-to-post | **1** | Explicit “no social publishing” copy |

## Security / access hardening (**1** locally, **2** on live DB)

- **Capability-matrix RLS** replaces broad `mil_staff_all_*` policies (**1** in migration source; **2** until applied).
- **`mil_is_reviewer()`** = admin, manager, media_reviewer only — **office excluded** from reviewer write surfaces (**1** contract tests + SQL tests). Client `REVIEWERS` and edge `isMilReviewer` now match SQL (office may still browse/upload via library staff).
- **`phone_uploader` is NOT a product library role** — phone dumps authorized only by bearer upload session tokens minted by owner/admin (**1**).
- **Durable finalization lifecycle** (service_role only, nine RPCs): the edge re-hashes the quarantine bytes on **every** attempt, places with `upsert:false`, and the database proves storage-catalog visibility inside the commit transaction (**1** source + unit + local SQL behavior tests; **2** e2e).
- **Time-based leases** on grant finalization, so a dead worker releases the grant instead of blocking it forever, and two workers cannot finalize one grant (**1** local behavior test).
- **Storage/DB divergence is recorded, not swallowed** — `mil_integrity_alerts` (owner/admin SELECT only) captures bytes-without-a-row, row-without-bytes, checksum drift and catalog mismatch (**1**).
- **Lifecycle tables are not client-writable at the grant level**, not merely policy-filtered (**1** local privilege matrix test).
- **No client `mil_audit_events` inserts** — privileged mutations audit via `mil_audit_insert()` inside RPCs (**1**).
- **No social publishing** (**1** UI + docs).

## AI / processing queue (honest)

- `mil_processing_jobs` rows are created `queued` on finalize, but **there is no always-on worker**.
- **`media-intel-analyze` is invoke-on-demand** — client `queueAiAnalysis` **awaits** the edge only (no client job/asset writes). Edge `ensureAndClaimJob` claims a queued row or inserts one via service_role for reanalyze. Uninvoked finalize jobs stay `queued` forever — honest architecture, not a fake worker.
- Status: **IMPLEMENTED LOCALLY** (unit/contract tests); **staging-unproven** until edge deploy.
- OpenAI path requires key; no-key → honest skip (**1** edge source + tests).
- Large originals still `skipped_needs_ai_safe_derivative` until an `ai_safe` derivative exists (**4** / incomplete).
- Near-duplicate perceptual similarity, HEIC worker, video thumbs/transcripts: **4 — deferred**.

## Website promotion (**5** promote / **1+2** unpublish)

`prepare_public_safe` and `promote` are **disabled (503)** until a proven decode → re-encode → strip pipeline exists. Marker-only EXIF removal does **not** prove public safety. Owner/admin **unpublish** is wired in Media Settings → `unpublishWebsiteMedia` → edge `action: 'unpublish'` (**1** source + contracts; **2** until staging deploy).

## Backup / restore / export

Documented in `BACKUP_RESTORE_EXPORT.md`. Procedures are **2 — not proven recoverable** (no restore drill executed in this worktree).

## Tests

| Suite | Status |
|---|---|
| `npm run test:media-intel-helpers` | **1** — unit/contract tests (Node, no Docker) |
| `tests/unit/media-intel-contracts.test.mjs` | **1** — static cross-file contracts |
| `supabase/tests/mil/*.sql` | **1** — six files; `00`–`05` **PASS** on disposable local stack 2026-07-27 recovery re-verify (after `20260727130000` grants) |
| Local `supabase db reset` | **1** — MIL migrations applied on disposable local stack. Requires conditional skip in `20260721120000_ml_p1_rs101_deny_estimates_insert.sql` when `public.estimates` is absent. **Not applied to staging/production.** |

### What the tests do **not** prove

- `03_upload_lifecycle_behavior.sql` simulates storage by inserting into
  `storage.objects`. It proves the SQL side of placement and commit; it does not
  exercise the Storage API, so the edge's `upload`/`download`/`remove` calls are
  unproven outside a deployed environment.
- No test covers two concurrent HTTP finalizes of the same grant end-to-end. The
  lease contention path is proven at the SQL level only.
- Nothing here proves hosted behavior. Every edge-function claim is **2**.

## Explicit non-goals (**4**)

Social connections, scheduling, automatic publishing, facial recognition, phone deletion, destructive de-dupe, production deploy, vent-guys.com changes, new domains/subdomains, multi-tenant MIL product architecture, artificial organization/account/company/workspace ownership entities for MIL.

## Residual risks after the finalization lifecycle change (honest)

| Risk | Standing |
|---|---|
| **Hosted behavior is unproven** | The migration has never been applied outside a disposable local stack and neither edge function has been deployed. Everything below is source-level reasoning until staging says otherwise |
| **No reconcile schedule** | Nothing runs `media-intel-upload-reconcile` on a timer. Stranded grants are reconciled only when a failing finalize invokes it inline, or when an operator calls it. Until a schedule exists, `pending_reconcile` files can stay pending indefinitely — visibly, in the manifest and in `mil_integrity_alerts` |
| **250 MB per-file ceiling** | The edge must hold the whole object in memory to hash it. Longer phone videos will be rejected rather than silently truncated. Raising `MIL_MAX_UPLOAD_BYTES` without confirming edge memory headroom will turn rejections into crashes |
| **No resumable uploads** | Removed with the client rewrite (see the client table). A dropped connection means re-selecting the file. Desktop owner/admin uploads use the same session path — there is no TUS fallback for them |
| **Reel lifecycle** | Untouched by this change and still unproven. Out of scope |
| **`queueAiAnalysis` (local fix; staging-unproven)** | Client no longer inserts jobs; edge ensure/claim path is in source + unit tests. Still requires deployed `media-intel-analyze` (+ optional `OPENAI_API_KEY`) for USABLE proof |
| **Quarantine retention** | Bytes for `failed` and `abandoned` grants are deliberately **not** deleted, so a customer's only copy is never destroyed by an automated sweep. Those objects accumulate and need an operator decision, not a cron job |
| **Backfill of pre-existing grants** | The migration classifies existing rows from `completed_at` and asset ownership. Any historical row that was already inconsistent stays inconsistent — it is labelled, not repaired |

## Local build cycle (2026-07-27) — committed through `89bb72e`

Accepted (SOURCE + unit/contract tests + local SQL where noted; staging-unproven):

- AI on-demand enqueue repair (`api.js` + `media-intel-analyze` `ensureAndClaimJob`)
- Client + edge reviewer role alignment (office excluded from reviewer writes)
- Mobile authenticated upload batchId race fix
- Review archive/restrict entry UI
- Dashboard nav honesty + All Media `dup=1` + count/empty-state honesty (`89bb72e`)
- Website `website-public-media` bucket migration added (unapplied remotely)
- Creator portal single-workspace honesty + retryable reel upload
- Unpublish UI in Media Settings (promote still disabled)
- Upload `interpretCompletion` / 503-retry honesty unit tests
- Collections membership workflow (create / add / remove by asset UUID; honest “no picker yet” copy) + contracts
- Operator reconcile runbook: [`RECONCILE_OPERATOR.md`](./RECONCILE_OPERATOR.md) + Uploads/Settings copy (no client reconcile trigger)
- Client table grants migration `20260727130000` (RLS was unreachable without GRANT)
- JWT-seeded RLS behavioral SQL `05_jwt_rls_behavior.sql` **PASS** locally + sign/storage source contracts
- Before/after + reel review UI error/busy honesty + no-publish copy
- Staging apply packet (docs only): [`STAGING_APPLY_PACKET.md`](./STAGING_APPLY_PACKET.md)
- Cursor Relay Protocol (docs only): root [`AGENTS.md`](../../../AGENTS.md) + [`docs/RELAY_PROTOCOL.md`](../RELAY_PROTOCOL.md)
- Helper suite: `npm run test:media-intel-helpers` **129 pass / 0 fail**

Still open (production path — Founder authorized kickoff 2026-07-30):

1. **Exact next action:** Execute [`PRODUCTION_APPLY_PACKET.md`](./PRODUCTION_APPLY_PACKET.md) on `wwyxohjnyqnegzbxtuxs` + Hostinger `production` (`app.bhfos.com`) once credentials are available (PR #127 already merged)
2. **Authorization boundary:** Founder authorized production release intent; mutating steps still require `SUPABASE_ACCESS_TOKEN` + production `VITE_*`. No reconcile cron. No website promote. Leave mil-staging untouched as staging.
3. Staging acceptance: distinct-identity + contributor **accept/deny** owner-confirmed **USABLE** (2026-07-30)

### Active defects (honest)

| Defect | Standing |
|---|---|
| Hosted default EXECUTE on finalization RPCs | **Closed on staging** via forward migration `20260727140000` |
| Promote website | Still **503** `not_implemented` by design |
| No reconcile schedule | Intentional; stranded `pending_reconcile` until inline/manual run |
| Uploads not resumable | Deferred |
| All Media search | **Closed** (source + staging browser retest PASS 2026-07-27) |
| Review Queue analysis panel | After `Queue analysis`, panel does not refresh until asset reselect |
| AI before/after proposals | Analyze does not auto-create `possible_before_after`; no user-visible pair-creation UI (confirm-only) |
| Large-file `ai_safe` derivative | Still incomplete; analyze may skip |
| CRM Hostinger staging frontend | **Does not exist** — Hostinger tooling is production-only |
| CRM browser USABLE vs staging | Local Vite USABLE for `/media/*`; CRM hub `/tvg/crm` blocked (no tenant org on empty MIL staging) |

### Orchestration note (chat-loss recovery)

Controlling conversation Request IDs `72cfb4e0-f28c-4206-ab12-96f3823ee101` and `4d85bd56-cf23-428f-9c67-8b0f01a8a22d` are not recoverable. Repository documents + commits are authoritative. Do not re-implement accepted items above from missing chat memory.

Fresh chats use the standardized **RELAY HANDOFF** in [`docs/RELAY_PROTOCOL.md`](../RELAY_PROTOCOL.md) (repository/branch, HEAD/baseline ancestry, upstream divergence, worktree, verified state, verification results, accepted changes, remaining defects, exact next action, authorization boundary).

## Remaining for Definition of Done (requires owner authorization)

1. ~~Founder supplies staging ref + URL~~ → `sdzhdupekcnekesbtxsl`
2. ~~Execute staging apply packet~~ → done 2026-07-27 (see above)
3. ~~Forward ACL backport `20260727140000`~~ → staging-applied + `00`/`04` PASS
4. Browser/USABLE acceptance on CRM staging frontend pointed at staging — representative fixture gate **FAIL (search)** then search-repair retest **PASS** (2026-07-27)
5. Accessibility + responsive screenshot suite
6. Large synthetic library performance harness
7. Owner authorization before merge / production → **Founder authorized production kickoff 2026-07-30**; packet written; mutate blocked until `SUPABASE_ACCESS_TOKEN` + production `VITE_*` + PR/CI/merge

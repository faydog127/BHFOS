# Network OS — Implementation Status

**Docs branch (this increment):** `cursor/nos-surgical-integration-blocked-3072`  
**Foundation tip recorded:** `9087e814de088d93a6de863407dc702fa0530c86` (PR 142 merge)  
**Mission recorded here:** NOS-CONVENTION-SURGICAL-INTEGRATION-BUILDER-01  
**Product / R1 / Slice 1 activation:** **None**  
**PR 140 / 141 / 142 / 143:** not pushed by this increment  

Do **not** equate: source-present · locally verified · deployed · staging verified · merged · production verified.

## SURGICAL_INTEGRATION_BLOCKED (2026-08-24)

Live CRM identity on `https://app.bhfos.com/build-info.json` is `commitSha=0d6bcbb8aa14a43b16dafa5314e156d852785ff5`, `branch=hotfix/v1-crm-layout-hooks`, `environment=production`, generated `2026-08-14T01:20:52.219Z`.

That exact SHA is **not** a git object on `origin` (`git fetch` → `not our ref`; GitHub commits API → HTTP 422). Ref `hotfix/v1-crm-layout-hooks` is **not** on `origin`. No Actions run, tag, or PR contains the live source tree.

**Stopped before creating an integration branch.** Convention join/thanks routes were not ported. Live CRM was not replaced. Full evidence: [`SURGICAL_INTEGRATION_BLOCKED.md`](./SURGICAL_INTEGRATION_BLOCKED.md).

## Prior write-path record (unchanged by this increment)

**Historical branch note:** `cursor/nos-convention-write-path-eb96`  
**Implementation commit:** `a53ea7866b3e7729a0d7c8e0ab97c4a53a59411b`  
**Ancestry:** `87c69217b11ad612449461b2bee4b4d10a6cfcf2` (PR 141 hop, parked)  
**Base:** `network-os/foundation`  
**PR 142:** merged at `9087e814de088d93a6de863407dc702fa0530c86`  
**Original mission text below** is the write-path packet, not this surgical-integration hop.

## Convention write path (2026-08-24) — LOCAL IMPLEMENTATION

Founder authorized v2 Option A. This increment adds the isolated intake table, the exact-role helper, and the public HTTP write owner. Queue access is only `app_user_roles.role = bhis_convention_intake`. No admin fallback. No role seed. No hosted apply.

| Field | Value |
|---|---|
| QR target | `/network-os/convention/join` |
| Form | name, company, email, phone, trades/services, service area, consent, honeypot |
| Persistence | HTTP `network-os-provider-interest-intake` inserts into `public.network_os_provider_interest_intake` only |
| Stamps | `campaign_id=HUGE_2026`, `source=HUGE_2026`, `intake_channel=convention_qr`, `onboarding_status=provider_interest_received` |
| Uniques | campaign-scoped partial uniques on `email`, `phone_digits`, nonempty `client_request_id` |
| Queue | `/network-os/convention/intake` — helper then RLS SELECT; status UPDATE only |
| Confirmation | `/network-os/convention/join/thanks` — no internal identifiers, no echoed PII |
| Evidence tier | **locally verified** M1 + T1–T11. Lint: `globalThis` replaced with `window.fetch` (eslint `no-undef`). Local `npm run lint` 0 errors; local `npm run build:local` pass. Not hosted-applied, not deployed, not merged. Hosted apply remains held. |

## Created objects (source)

1. `public.network_os_provider_interest_intake` — no `tenant_id`, no `duplicate_key`, no FKs to leads/contacts/partner_prospects/submissions/events
2. `public.network_os_actor_has_bhis_convention_intake()` — SECURITY DEFINER, `SET search_path = public`, STABLE, zero args, no dynamic SQL, REVOKE PUBLIC, GRANT EXECUTE to `authenticated` and `service_role` only. Exact role `bhis_convention_intake`. Ignores `tenant_id`.
3. HTTP function `network-os-provider-interest-intake` — public POST, 8KB ceiling, exact-origin CORS, 8s/10-per-hour limits, honeypot non-store, sanitized logs/errors, server-only privileged credential

## Local proof

| Step | Result |
|---|---|
| M1 | Up applied on disposable local DB; customer tables unchanged |
| T1 | HTTP synth stored one row; HUGE_2026 / convention_qr / provider_interest_received; timestamps set; `is_test_data` true |
| T2 | Same email, new request-id → duplicate; still one original row |
| T3 | Same phone, different email → duplicate |
| T4 | Same `client_request_id` → duplicate |
| T5 | Validation / honeypot / extra keys / client source or tenant → no unauthorized customer row; stamps remain server-owned |
| T6 | Anon SELECT/INSERT/UPDATE/DELETE denied |
| T7 | Authenticated `admin`/`office` without exact role: helper false; SELECT empty; no customer-table touch |
| T8 | Authenticated + `bhis_convention_intake`: sees synth row; status → `reviewed`; PII unchanged |
| T9 | Helper has no dynamic SQL; PUBLIC/anon cannot execute; same owner as table |
| T10 | HTTP logs/errors have no email/phone/credential material; no `duplicate_key` column |
| T11 | Down removes helper + table; operational tables/policies unchanged |

## Residual risks

- Hosted RLS public-read/write deny is **unproven** until a later Founder apply packet names the host.
- Role assignment is **unauthorized**. No `bhis_convention_intake` row is shipped. Queue stays empty on a host until a later grant.
- Privileged insert uses the function’s server environment only. Not in `VITE_*`. FORCE RLS does not block service-class BYPASSRLS.
- `app_user_roles` `SELECT USING (true)` remains a residual leak on that table. Queue client never reads it.
- Automatic Vercel preview is Website/bhfos-site, not command-center.
- Rate-limit maps are process-local (best-effort, not a new table).
- Retention purge (180 days) is not this increment.
- This is not R1/S1 activation.

## Deployment requirements (not authorized here)

- Founder apply packet that names the host
- Hosted T6/T7 negatives (H*)
- HTTP function deploy on the command-center host
- One Founder-authorized role insert
- Command-center preview/host (not the marketing Vercel project)

## Exact-head Guard assignment

After this lint correction is published, assign a **new independent** Architecture/Contract Guard to draft PR #142 at the published HEAD. Review the bounded lint fix plus unchanged Option A contract. Do not merge. Do not apply hosted SQL. Do not treat a marketing Vercel URL as the convention app. PR 140 and PR 141 stay parked.

## Exact next action

Restore the live CRM source as a reachable git object on `origin` (`hotfix/v1-crm-layout-hooks` and/or commit `0d6bcbb8aa14a43b16dafa5314e156d852785ff5`), or Founder-authorize a different proven CRM baseline. Then cut a surgical integration branch from that exact commit. Do not invent a hotfix tree. Do not replace live CRM until that proof exists. No R1/S1. No Hostinger upload from this blocked hop.

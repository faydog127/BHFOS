# Network OS — Implementation Status

**Branch:** `cursor/nos-convention-write-path-eb96`
**Implementation commit:** `a53ea7866b3e7729a0d7c8e0ab97c4a53a59411b`
**Ancestry:** `87c69217b11ad612449461b2bee4b4d10a6cfcf2` (PR 141 hop, parked)
**Base:** `network-os/foundation`
**Draft PR:** https://github.com/faydog127/BHFOS/pull/142
**Mission:** NOS-CONVENTION-WRITE-PATH-FOUNDER-GATE-01 v2 Option A
**Product / R1 / Slice 1 activation:** **None**
**PR 140 / PR 141:** parked / frozen / not pushed

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

Independent Guard review of PR 142 at the published HEAD after CI lint + build are green. No merge, hosted write, deploy, role seed, or R1/S1 activation. Hosted apply remains held.


## n8n assurance Phase A capability evidence (2026-08-28) — TEST-ONLY

**Architecture dependency:** draft PR #152 at `d5d61dc93e86fdc1f7498b55cd2ad7428be2f76a`  
**Requirement / release / work item:** `NOS-N8N-ASSURANCE-REQ-001` / `NOS-N8N-ASSURANCE-PHASE-A-01` / `NOS-N8N-INGRESS-CAPABILITY-SPIKE-01`  
**Outcome:** **PHASE A COMPLETE — INGRESS_CAPABILITY_BLOCKED**

Unpublished n8n Cloud tests proved raw-body receipt, exact-byte SHA-256 HMAC, constant-time digest comparison, deterministic allowlist/target validation, explicit response classification, and 11/11 positive/negative matrix cases. Exercised webhook/HMAC paths completed in 89 ms and 330 ms. No AI, GitHub write, merge, deploy, production webhook, Hostinger action, or production mutation occurred.

The required atomic durable single-winner delivery claim remains unproved. Native n8n Data Table column creation exposes no unique constraint; row-not-exists is a read/check; the upsert node is filter-based. Phase A therefore fails closed and requires the architecture's minimal edge verifier plus transactional claim fallback.

Evidence: `command-center/docs/network-os/N8N_ASSURANCE_PHASE_A_EVIDENCE.md`  
Draft next-step packet: `command-center/docs/network-os/N8N_ASSURANCE_PHASE_A_IMPLEMENTATION_PACKET_DRAFT.md`  
Draft envelope schema: `command-center/docs/network-os/schemas/n8n-assurance-normalized-envelope.schema.json`

**Exact next action:** Founder approves, rejects, or revises the draft edge-adapter packet. Until then, do not implement the adapter, choose/apply a transactional store, create preview secrets, deploy, enable a GitHub webhook, publish n8n workflows, merge, or activate production.

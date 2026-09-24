# TVG Email Pass 1 — implementation status

Workstream: TVG Email Automation pass1-v5, the Founder-locked internal SMS amendment, and the 2026-09-24 consolidated staging directive. Not Media Intelligence. `command-center/docs/media-intelligence/IMPLEMENTATION_STATUS.md` is unchanged on purpose.

| Field | Value |
|---|---|
| Branch | `cursor/tvg-email-pass1-v5-3e46` |
| Consolidated slice | `417e6a773909151f812d0db9ca0dcef7ee860069` |
| Consolidated challenge notes | `4b4b1dee6b8f7fabfd6201710cee8862269780f5` |
| Coordinator register and directive | `00effebf7ca3f0e5c4cf322cc21984c2c58163db` |
| Operator-preference recipient model | `8666bde7a6a5ec9a5825916ad8f6aaeef240e69d` |
| Internal SMS amendment | `e0e1b755d81f048bcaa50a789a9780f644b1f361` |
| Challenge notes | `22084ee8b241a708571078c41e6c4387efc0c27a` |
| Pass 1 pack | `b2cddc8bee25f36b1b22d81060defe9847f68aa2` |
| Baseline | `main` at `17f9228951d74824d9b6fb0eb704832befed2afc` |
| Evidence | **Locally verified** on disposable Postgres 16.15. Staging is 17.6. The incremental file was not applied to staging by this session. Not merged. Not deployed. |
| Base staging apply | Coordinator reported `apply/20260924_tvg_email_pass1_v5.sql` applied on `glkrykpksbsqmmilmjhs` on 2026-09-24. This repo has no apply report. This session did not re-query that database and did not re-apply the base file. |
| Staging reads | 2026-09-24 read-only SQL on `glkrykpksbsqmmilmjhs` predates the reported base apply. |
| Production | `wwyxohjnyqnegzbxtuxs` not queried and not modified |
| Hostinger | Off |
| Pre-webhook | Closed. See `PRE_WEBHOOK_OPEN_ITEMS.md` |
| Production gate | Closed |

## Local verification (not staging)

- `node --test tvg-email-automation/pass1/test/*.test.mjs` — 47 pass, including Decision ID status lock TVG-EMAIL-P1-D001 through D022, the Founder-only recipient model, and no free-text urgency class
- Disposable Postgres 16.15: base file, then incremental file, then `fixtures/sql/local-smoke.sql` (`SMOKE_OK`), then a second incremental apply (`REAPPLY_OK`). Claims stayed 1. Founder recipients stayed 1. Subscriptions with null escalation stayed 7. `internal_sms_enabled` stayed false. Staging was not queried.
- Disposable database `tvg_email_pass1` on local PostgreSQL 16.15: stub CRM + base `apply/20260924_tvg_email_pass1_v5.sql` + `apply/20260924_tvg_email_pass1_incremental.sql` + `fixtures/sql/local-smoke.sql` exited 0 (`SMOKE_OK`)
- Second apply of the incremental file on that database exited 0 (`REAPPLY_OK`). `network_os_assurance_delivery_claims` still had 1 row. `internal_sms_enabled` stayed `false`. `live_notification_started_at` stayed null. `health_alerts_enabled` stayed `false`. `health_checks` had 2 rows. `email_responses` and `email_send_queue` were absent
- Docker smoke script was not the runner. Staging project was not migrated

## Challenge PASS notes folded

- Hostinger newer-mail and intake-lag checks are mock and dormant until Pre-webhook. The heartbeat does not call the Hostinger API.
- Unset `live_notification_started_at` records no per-message SMS and at most one backlog summary.
- `TVG_EMAIL_AUTOMATION_DECISION_REGISTER.md` stays in the repo pack and the return packet.
- `n8n_email_automation` password was not set at apply. Approved path is the staging SQL editor, then the n8n credential only.
- Form-filter ordering and open-lead production evidence stay on the Pre-webhook gate. They are not staging blockers.

## Decision register

[`decision-register/TVG_EMAIL_AUTOMATION_DECISION_REGISTER.md`](decision-register/TVG_EMAIL_AUTOMATION_DECISION_REGISTER.md)

Decision IDs TVG-EMAIL-P1-D001 through D022 were copied from the coordinator file. Their statuses were not edited. The full directive is [`directives/CC_DIRECTIVE_PASS1_STAGING_CONSOLIDATED_2026-09-24.md`](directives/CC_DIRECTIVE_PASS1_STAGING_CONSOLIDATED_2026-09-24.md). The pack index is [`INDEX.md`](INDEX.md). `staging-apply/APPLY_REPORT.md` is named by that index and was not in the upload, so it was not created here.

The 2026-09-24 operator-preference addendum is in [`decision-register/ADDENDUM_OPERATOR_PREFERENCE_2026-09-24.md`](decision-register/ADDENDUM_OPERATOR_PREFERENCE_2026-09-24.md). Coordinator Decision IDs for items 1–6 were not in the workspace, so none were invented. Item 6 (follow-up) stays OPEN. No cadence default is stored. Pass 2 inputs are in [`PASS2_DESIGN_INPUTS.md`](PASS2_DESIGN_INPUTS.md) and are not built.

DECISION_REQUIRED:

1. Exact backlog summary sentence. Code uses an implement reading.
2. Retention of excerpts and attachment metadata. No retention job exists.

OPEN and still Founder-only: SMS credential attach (including proof it cannot send unrestricted customer SMS), A2P 10DLC versus verified toll-free, cost, and the mobile number stays out of git.

## Next action

Coordinator runs only `apply/20260924_tvg_email_pass1_incremental.sql` on `glkrykpksbsqmmilmjhs`, using `apply/STAGING_APPLY_CHECKLIST.md`. Do not re-apply the base file. Then import the six n8n JSON files and leave them inactive. Do not attach the Twilio credential. Do not enable Hostinger.

## Authorization boundary

This change does not merge, does not deploy, does not enable Hostinger, does not activate n8n schedules, does not send SMS, and does not create CRM leads.

# TVG Email Pass 1 — implementation status

Workstream: TVG Email Automation pass1-v5, the Founder-locked internal SMS amendment, and the 2026-09-24 consolidated staging directive. Not Media Intelligence. `command-center/docs/media-intelligence/IMPLEMENTATION_STATUS.md` is unchanged on purpose.

| Field | Value |
|---|---|
| Branch | `cursor/tvg-email-pass1-v5-3e46` |
| Consolidated slice | `417e6a773909151f812d0db9ca0dcef7ee860069` |
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

- `node --test tvg-email-automation/pass1/test/*.test.mjs` — 41 pass
- Disposable database `tvg_email_pass1` on local PostgreSQL 16.15: stub CRM + base `apply/20260924_tvg_email_pass1_v5.sql` + `apply/20260924_tvg_email_pass1_incremental.sql` + `fixtures/sql/local-smoke.sql` exited 0 (`SMOKE_OK`)
- Second apply of the incremental file on that database exited 0 (`REAPPLY_OK`). `network_os_assurance_delivery_claims` still had 1 row. `internal_sms_enabled` stayed `false`. `live_notification_started_at` stayed null. `health_alerts_enabled` stayed `false`. `health_checks` had 2 rows. `email_responses` and `email_send_queue` were absent
- Docker smoke script was not the runner. Staging project was not migrated

## Decision register

[`TVG_EMAIL_AUTOMATION_DECISION_REGISTER.md`](TVG_EMAIL_AUTOMATION_DECISION_REGISTER.md)

DECISION_REQUIRED:

1. Exact backlog summary sentence. Code uses an implement reading.
2. Retention of excerpts and attachment metadata. No retention job exists.

OPEN and still Founder-only: SMS credential attach (including proof it cannot send unrestricted customer SMS), A2P 10DLC versus verified toll-free, cost, and the mobile number stays out of git.

## Next action

Coordinator runs only `apply/20260924_tvg_email_pass1_incremental.sql` on `glkrykpksbsqmmilmjhs`, using `apply/STAGING_APPLY_CHECKLIST.md`. Do not re-apply the base file. Then import the six n8n JSON files and leave them inactive. Do not attach the Twilio credential. Do not enable Hostinger.

## Authorization boundary

This change does not merge, does not deploy, does not enable Hostinger, does not activate n8n schedules, does not send SMS, and does not create CRM leads.

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
| Base staging apply | Coordinator evidence in `staging-apply/APPLY_REPORT.md`: `apply/20260924_tvg_email_pass1_v5.sql` applied on `glkrykpksbsqmmilmjhs` on 2026-09-24. Production not touched. This session did not re-query that database and did not re-apply the base file. Incremental SQL is not in that report. |
| Staging reads | 2026-09-24 read-only SQL on `glkrykpksbsqmmilmjhs` predates the reported base apply. |
| Production | `wwyxohjnyqnegzbxtuxs` not queried and not modified |
| Hostinger | Off |
| Pre-webhook | Closed. See `PRE_WEBHOOK_OPEN_ITEMS.md` |
| Production gate | Closed |

## Local verification (not staging)

- `node --test tvg-email-automation/pass1/test/*.test.mjs` — 49 pass, including Decision ID status lock TVG-EMAIL-P1-D001 through D035. D029–D035 are documentation. Pass 1 SQL and n8n do not implement send-anyway, a fallback customer send, outbound observation, Handled UI, or IMAP.
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
- Pass 1 keeps one Founder destination, `founder_mobile_ref`, until the Founder authorizes more recipients.
- Quiet hours, urgency detection, draft review, and reply voice stay Pass 2 inputs. Urgent candidates stay design notes. Pass 1 has no keyword rules.
- After-hours acknowledgement stays disabled. That is not permission for general auto-send.

## Decision register

[`decision-register/TVG_EMAIL_AUTOMATION_DECISION_REGISTER.md`](decision-register/TVG_EMAIL_AUTOMATION_DECISION_REGISTER.md)

Decision IDs TVG-EMAIL-P1-D001 through D035 were copied from the coordinator file. Their statuses were not edited. The full directive is [`directives/CC_DIRECTIVE_PASS1_STAGING_CONSOLIDATED_2026-09-24.md`](directives/CC_DIRECTIVE_PASS1_STAGING_CONSOLIDATED_2026-09-24.md). The Founder operator-preference addendum is [`directives/CC_ADDENDUM_FOUNDER_OPERATOR_PREFERENCES_2026-09-24.md`](directives/CC_ADDENDUM_FOUNDER_OPERATOR_PREFERENCES_2026-09-24.md). The unapproved-by-deadline addendum is [`directives/CC_ADDENDUM_UNAPPROVED_BY_DEADLINE_ESCALATION_2026-09-24.md`](directives/CC_ADDENDUM_UNAPPROVED_BY_DEADLINE_ESCALATION_2026-09-24.md). Its challenge verdict is [`directives/CHALLENGE_VERDICT_UNAPPROVED_BY_DEADLINE.md`](directives/CHALLENGE_VERDICT_UNAPPROVED_BY_DEADLINE.md): CHALLENGE_CONCERNS / proceed-with-concerns. D035 is [`directives/CC_ADDENDUM_D035_AUTHORITATIVE_OUTBOUND_OBSERVATION_2026-09-24.md`](directives/CC_ADDENDUM_D035_AUTHORITATIVE_OUTBOUND_OBSERVATION_2026-09-24.md). Its challenge verdict is [`directives/CHALLENGE_VERDICT_D035_OUTBOUND_OBSERVATION.md`](directives/CHALLENGE_VERDICT_D035_OUTBOUND_OBSERVATION.md): CHALLENGE_PASS. Neither verdict authorizes implementation. The operator-preference challenge verdict is [`directives/CHALLENGE_VERDICT_OPERATOR_PREFERENCES.md`](directives/CHALLENGE_VERDICT_OPERATOR_PREFERENCES.md): CHALLENGE_PASS. It does not authorize Hostinger, credential attach, customer SMS, or production mutation. The pack index is [`INDEX.md`](INDEX.md). Coordinator evidence of the base SQL apply is [`staging-apply/APPLY_REPORT.md`](staging-apply/APPLY_REPORT.md): applied on `glkrykpksbsqmmilmjhs` on 2026-09-24; production `wwyxohjnyqnegzbxtuxs` not touched; Hostinger off; PR not merged. This session did not re-apply that SQL and did not re-query staging. The incremental file is not covered by that report. Index copies now present: [`amendments/CC_AMENDMENT_INTERNAL_SMS_2026-09-24.md`](amendments/CC_AMENDMENT_INTERNAL_SMS_2026-09-24.md), [`amendments/CHALLENGE_VERDICT_INTERNAL_SMS.md`](amendments/CHALLENGE_VERDICT_INTERNAL_SMS.md), [`CHALLENGE_VERDICT.md`](CHALLENGE_VERDICT.md), and [`CC_VERDICT.md`](CC_VERDICT.md). They were copied as given. This session did not apply SQL, activate Hostinger or n8n, attach SMS, or touch production.

D023 Active is the Pass 1 recipient and configuration model already in this pack: one Founder destination and `configuration_audit`. D024 through D028 stay documentation in [`PASS2_DESIGN_INPUTS.md`](PASS2_DESIGN_INPUTS.md). D028 is Open / Proposed. D029 through D034 are Pass 2 policy and gates. D035 is a Pass 2 observation dependency. Pass 1 impact is none. No eligible-class list, fallback template, escalation, send-anyway path, observation job, Handled UI, or IMAP path was added.

DECISION_REQUIRED:

1. Exact backlog summary sentence. Code uses an implement reading.
2. Retention of excerpts and attachment metadata. No retention job exists.

OPEN and still Founder-only: SMS credential attach (including proof it cannot send unrestricted customer SMS), A2P 10DLC versus verified toll-free, cost, and the mobile number stays out of git.

## Next action

Coordinator runs only `apply/20260924_tvg_email_pass1_incremental.sql` on `glkrykpksbsqmmilmjhs`, using `apply/STAGING_APPLY_CHECKLIST.md`. Do not re-apply the base file. Then import the six n8n JSON files and leave them inactive. Do not attach the Twilio credential. Do not enable Hostinger.

## Authorization boundary

This change does not merge, does not deploy, does not enable Hostinger, does not activate n8n schedules, does not send SMS, and does not create CRM leads.

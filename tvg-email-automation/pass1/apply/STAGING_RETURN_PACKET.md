# Staging return packet — consolidated Pass 1 directive

**STAGING ONLY / HOSTINGER OFF / PRODUCTION CLOSED**

Branch: `cursor/tvg-email-pass1-v5-3e46`. Draft PR #160. This packet is source plus local evidence. It is not a new staging apply and it is not a production verification.

## What was not done

- The base file `apply/20260924_tvg_email_pass1_v5.sql` was not re-applied. The coordinator reported that apply on `glkrykpksbsqmmilmjhs`. This repo does not contain `staging-apply/APPLY_REPORT.md`, and this session did not re-query that database.
- Hostinger was not activated. No live SMS credential was attached. Production was not mutated. No CRM lead was created. The PR was not merged.
- `internal_sms_enabled` stays false. `health_alerts_enabled` stays false. `live_notification_started_at` stays null.

## Inactive proof

Six workflow JSON files. Each has `active: false`. Schedule nodes that exist are `disabled: true`. Names start with `[STAGING] `. `meta.tvgEmailPass1.credentialScope` is `staging-only`. There is no `[PROD]` workflow.

| File | Role |
|---|---|
| `n8n/tvg-email-intake-fast-ack.json` | Webhook path present, no Hostinger HTTP call |
| `n8n/tvg-email-intake-worker.json` | Synthetic claim only. Writes the outbox. No Twilio node |
| `n8n/tvg-email-intake-reconcile.json` | Schedule disabled |
| `n8n/tvg-email-daily-filtered-digest.json` | Schedule disabled. No send node |
| `n8n/tvg-email-notification-dispatcher.json` | Selects queued outbox rows. Twilio node disabled and disconnected. Guard throws `INTERNAL_SMS_CREDENTIAL_NOT_APPROVED` |
| `n8n/tvg-email-health-heartbeat.json` | Schedule disabled. No Twilio node. Hostinger newer-mail and intake-lag are mock (`mailbox_probe = dormant`). No Hostinger API call. Writes outbox intent and `health_checks` only |

Postgres credential name: `TVG Staging n8n_email_automation`. Twilio placeholder name: `TVG Internal SMS Twilio`. `to` is `={{ $json.destination_ref }}`. `from` is `={{ $json.sms_from_credential_only }}`, which the select leaves null. No phone number, account SID, or auth token is in the JSON.

## Fixtures

| Concern | Where it is proved locally |
|---|---|
| Heartbeat | `test/pass1-ops-policy.test.mjs` (quiet inbox, stale, fail, dep, one outage, dedup, one recovery). Newer-mail and intake-lag stay dormant unless a test explicitly marks the probe live. The workflow JSON does not. `fixtures/sql/local-smoke.sql` asserts two `health_checks` rows, alerts off, and a repeated `health_outage` window rejected |
| Outbox | Worker has no Twilio node. Dispatcher is separate and inactive. Local smoke inserts one `queued` row and requires `dispatch_after` plus `dispatch_attempt_count = 0` |
| Watermark | `test/pass1-internal-sms.test.mjs`. Unset watermark (`null`, blank, or `null` text) is fail-closed: no per-message SMS, and a second call after `backlogSummarySent` writes no further summary. A real watermark with a missing event time is also `record_only`. Local smoke keeps `live_notification_started_at` null and rejects a second backlog row |
| Storm | Existing SMS tests: first overflow `N=1`, amendment example `N=12`, no second summary. Local smoke rejects a repeated storm window |
| Threading | `captureThreadMetadata` returns `in_reply_to` and `references_header` and no `parent_id`. Local smoke stores both headers |
| Attachments | `assertAttachmentMetadataOnly` rejects `bytes`. SQL check `email_events_attachment_metadata_only` rejects a `bytes` key. Local smoke covers that rejection |
| Timing | Constants 120 and 900 seconds. Settings `primary_path_target_seconds`, `reconcile_target_seconds`, and null `notification_quiet_hours` asserted in local smoke |
| Wording | Ordinary SMS contains `review` and `No reply sent by automation.` Workflow JSON must not contain `needs response` |

## Credentials and customer send

- No production credential material. The forbidden production ref may appear only as the guard label `productionRefForbidden`.
- No customer-send tables. The incremental latch refuses to run if `email_responses` or `email_send_queue` exist.
- No customer SMS channel. The trigger rejects `customer_sms`.
- No inbound SMS command node.
- The `n8n_email_automation` password was not set at the reported apply. This pack does not set it. Approved path: an operator runs `ALTER ROLE n8n_email_automation PASSWORD ...` in the staging SQL editor for `glkrykpksbsqmmilmjhs` only, then stores that secret only in the n8n credential `TVG Staging n8n_email_automation`. The password is not written to git, workflow JSON, SQL files, settings, or logs.

## Challenge PASS notes

1. Heartbeat Hostinger newer-mail / intake-lag checks are mock and dormant until Pre-webhook. They are not live Hostinger API health probing.
2. Unset `live_notification_started_at` means no per-message SMS and at most one backlog summary.
3. Decision register is required now: [`../decision-register/TVG_EMAIL_AUTOMATION_DECISION_REGISTER.md`](../decision-register/TVG_EMAIL_AUTOMATION_DECISION_REGISTER.md). Statuses TVG-EMAIL-P1-D001 through D034 are unchanged from the coordinator file. The operator-preference addendum is [`../directives/CC_ADDENDUM_FOUNDER_OPERATOR_PREFERENCES_2026-09-24.md`](../directives/CC_ADDENDUM_FOUNDER_OPERATOR_PREFERENCES_2026-09-24.md). The unapproved-by-deadline addendum is [`../directives/CC_ADDENDUM_UNAPPROVED_BY_DEADLINE_ESCALATION_2026-09-24.md`](../directives/CC_ADDENDUM_UNAPPROVED_BY_DEADLINE_ESCALATION_2026-09-24.md). Its challenge verdict is CHALLENGE_CONCERNS / proceed-with-concerns and does not authorize implementation.
4. Role password path is the staging SQL editor plus the n8n credential, never git.
5. Pre-webhook still owns form-filter ordering and open-lead production evidence. Those are not staging blockers.

## Decision register and directive

Authoritative register: [`../decision-register/TVG_EMAIL_AUTOMATION_DECISION_REGISTER.md`](../decision-register/TVG_EMAIL_AUTOMATION_DECISION_REGISTER.md).

Full directive: [`../directives/CC_DIRECTIVE_PASS1_STAGING_CONSOLIDATED_2026-09-24.md`](../directives/CC_DIRECTIVE_PASS1_STAGING_CONSOLIDATED_2026-09-24.md).

Founder operator-preference addendum: [`../directives/CC_ADDENDUM_FOUNDER_OPERATOR_PREFERENCES_2026-09-24.md`](../directives/CC_ADDENDUM_FOUNDER_OPERATOR_PREFERENCES_2026-09-24.md). D023 is the Pass 1 recipient and audit model. D024 through D027 stay documentation. D028 is Open / Proposed.

Unapproved-by-deadline addendum: [`../directives/CC_ADDENDUM_UNAPPROVED_BY_DEADLINE_ESCALATION_2026-09-24.md`](../directives/CC_ADDENDUM_UNAPPROVED_BY_DEADLINE_ESCALATION_2026-09-24.md). Challenge verdict: [`../directives/CHALLENGE_VERDICT_UNAPPROVED_BY_DEADLINE.md`](../directives/CHALLENGE_VERDICT_UNAPPROVED_BY_DEADLINE.md) — CHALLENGE_CONCERNS / proceed-with-concerns. D029 through D034 are Pass 2 policy and gates. Pass 1 impact is none. No eligible-class list and no fallback template are stored. The index names `directives/CHALLENGE_VERDICT_OPERATOR_PREFERENCES.md`. That file was not in this upload, so it was not created.

Pack index: [`../INDEX.md`](../INDEX.md).

The index also names `staging-apply/APPLY_REPORT.md`, `amendments/CC_AMENDMENT_INTERNAL_SMS_2026-09-24.md`, `amendments/CHALLENGE_VERDICT_INTERNAL_SMS.md`, `CHALLENGE_VERDICT.md`, and `CC_VERDICT.md`. Those paths were not in the coordinator upload committed here. This pack does not invent them. The SMS amendment and the design challenge verdict that are already in git stay at `design/CC_AMENDMENT_INTERNAL_SMS_2026-09-24.md` and `design/CHALLENGE_VERDICT.md`.

## Directive return-packet map

| Required item | Where this pack records it |
|---|---|
| Directive and Decision Register | Files above. Statuses were copied, not edited |
| Schema mapped to notification and health | `apply/20260924_tvg_email_pass1_incremental.sql` |
| Inactive workflows, schedules disabled | Six `[STAGING]` JSON files. `active: false`. Schedule nodes `disabled: true` |
| Staging-only credentials and prefixes | Workflow meta `credentialScope: staging-only`. No password in JSON or SQL |
| Heartbeat, stale/fail/dep, outage/recovery, timing | `test/pass1-ops-policy.test.mjs`. Newer-mail and intake-lag stay dormant while Pre-webhook is closed (TVG-EMAIL-P1-D021) |
| Watermark pre-live and post-live | `test/pass1-internal-sms.test.mjs` |
| Thread metadata, no thread logic | `captureThreadMetadata` and local smoke |
| Attachment metadata, no bytes | `assertAttachmentMetadataOnly` and the SQL check |
| One-way SMS, wording, privacy | No inbound command node. Ordinary text is `review` / `No reply sent by automation.` Sanitizer tests |
| Outbox uniqueness, suppression, storm | Unique `(email_event_id, notification_kind)`. Storm tests. Inserts use `ON CONFLICT DO NOTHING` |
| Actionable, HOLD, error, filtered/system, duplicate, reconcile, watermark | SMS tests, including reconcile rediscovery of a pre-watermark event |
| No customer address as a destination | `assertDestinationLabel` rejects an email address and a phone number |
| Founder recipient model and config audit | One Founder destination, `founder_mobile_ref`, until the Founder authorizes more. `escalation_after` is null. `after_hours_ack_enabled` and `auto_send_enabled` stay false. Quiet hours, urgency keywords, draft review, and reply voice are not implemented. `configuration_audit` records actor, timestamp, setting, previous, and new |
| SMS amendment and carrier readiness | Amendment in `design/`. Carrier readiness remains Proposed under TVG-EMAIL-P1-D020 |
| APPLY_REPORT, challenge verdicts, PR #160 | PR #160 is this branch. `APPLY_REPORT.md` and the amendment challenge verdict file were not in the upload |
| Hostinger off, schedules inactive, production untouched, no customer communication | This packet. Production was not queried. No customer send tables |

The list below is the staging packet's gate view. It does not replace Decision ID statuses in the register.

## CLOSED / OPEN / DECISION_REQUIRED

CLOSED: design loop, Pre-webhook gate (not passed), production, staging proceed, SMS amendment, CRM lead create deferred, Hostinger off, customer SMS off, one-way SMS, attachment metadata only, thread metadata only, quiet inbox is not a fault, git as implementation system of record, review wording, 120s / 900s / 24/7, `notification_log` as the outbox.

OPEN (gate stays closed): form/filter field lock, production open-lead census, real Hostinger auth sample, carrier readiness, Founder SMS credential, A2P 10DLC versus toll-free, cost, CRM lead-gap since 2024-07-24 before production reliance, production security hardening.

DECISION_REQUIRED:

1. The exact backlog summary sentence. The sentence in code is an implement reading.
2. Retention of excerpts and attachment metadata before any retention job.
3. Follow-up cadence, TVG-EMAIL-P1-D028, stays Open / Proposed. No cadence is stored. It is distinct from unapproved-by-deadline escalation.
4. Unapproved-by-deadline settings that stay unset: grace period (D029), eligible response classes (D030), fallback wording (D031), and the Stage 2 customer path in D034. No class list and no fallback template are stored.

## Next staging command

Do not re-run the base file. After confirming the URL is `glkrykpksbsqmmilmjhs`:

```bash
psql "$STAGING_URL" -v ON_ERROR_STOP=1 -1 \
  -c "SELECT set_config('tvg_email_pass1.target_project', 'glkrykpksbsqmmilmjhs', false);" \
  -f tvg-email-automation/pass1/apply/20260924_tvg_email_pass1_incremental.sql
```

Then import the six n8n JSON files and leave them inactive. Do not attach a Twilio credential. Do not enable schedules. Do not create the Hostinger webhook.

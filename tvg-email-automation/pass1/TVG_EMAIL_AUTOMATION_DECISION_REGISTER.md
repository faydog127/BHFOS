# TVG Email Automation — Decision Register

**STAGING ONLY / HOSTINGER OFF / PRODUCTION CLOSED**

Register required by the 2026-09-24 consolidated Pass 1 directive. Git is the implementation system of record. This file records decisions already locked, items that stay open with the gate closed, and the two places this pack used an implement reading because the Founder paste did not specify the sentence or the retention rule.

Staging project: `glkrykpksbsqmmilmjhs`. Production project `wwyxohjnyqnegzbxtuxs` is not a write target.

The full Founder directive text was not in the workspace when this pack was written. The source used here is the uploaded summary `CC_DIRECTIVE_PASS1_STAGING_CONSOLIDATED_2026-09-24` plus the internal SMS amendment already on this branch. Where those two disagree, the later consolidated directive is the one implemented (alert wording). The amendment file itself is unchanged.

## CLOSED

| Item | Locked reading |
|---|---|
| Design loop | Closed, except a material implementation discovery |
| Pre-webhook | Closed. The gate is not passed. Hostinger stays off |
| Production | Closed. No production mutation, no production credentials in this pack |
| Staging build | Proceed on `glkrykpksbsqmmilmjhs` only |
| Internal SMS amendment | Locked, including the Challenge PASS notes already on this branch |
| CRM lead create | Deferred. Pass 1 remains SELECT-only on `public.contacts` and `public.leads` |
| Customer send | Absent. No `email_responses`, no `email_send_queue`, no customer SMS |
| SMS direction | One-way outbound. No inbound command node |
| Threading | `In-Reply-To` and `References` are stored as text. No parent match and no thread logic |
| Attachments | Metadata only: `filename`, `content_type`, `size_bytes`, `attachment_id`. No bytes and no permanent full MIME |
| Quiet inbox | Zero messages with a healthy pipeline is not a fault |
| Notification record | `email_automation.notification_log` is the durable outbox. Unique `(email_event_id, notification_kind)` where the event id is present |
| Delivery path | Worker writes intent. A separate inactive dispatcher delivers. The worker does not call Twilio |
| Timing | Webhook to dispatcher handoff target 120 seconds. Reconcile target 900 seconds. 24/7. `notification_quiet_hours` stays null |
| Wording | Ordinary headline is `TVG: New email — review`. Closing line is `No reply sent by automation.` |
| Workflow names | Every workflow in this pack starts with `[STAGING] `. No `[PROD]` workflow is in this pack |
| Credentials | Staging-only placeholders. No production secrets. No live Twilio secret |
| Git | Implementation system of record |

## OPEN

These stay open. They do not reopen the design loop, and they do not authorize Pre-webhook or production.

| Item | Why it stays open |
|---|---|
| Form / filter field lock | Implement default is documented in `PRE_WEBHOOK_OPEN_ITEMS.md`. Founder/CC have not signed it |
| Production open-lead census | Not run against `wwyxohjnyqnegzbxtuxs` |
| Real Hostinger authentication sample | Not captured. Workflows do not call Hostinger |
| Carrier readiness | Sending number, U.S. registration, use case, and one real test SMS are not done |
| Founder SMS credential | Not provisioned and not attached. `internal_sms_enabled` stays false |
| A2P 10DLC versus verified toll-free | Founder chooses. Not chosen here |
| Cost | Not estimated as a Founder decision |
| CRM lead-gap since 2024-07-24 | Required before production reliance. Not a staging blocker. Not investigated here |
| Minimum production security hardening | Production gate. Not part of this staging slice |

## DECISION_REQUIRED

Do not treat the implement readings below as Founder answers.

1. **Backlog summary sentence.** The directive requires at most one backlog summary and does not give the sentence. This pack uses `TVG: N emails were already queued before live notifications — review backlog.` `N` is the count of `awaiting_pass2`, `held`, and `error` events at or before the watermark when that single row is written. A later pre-live event does not send another summary and does not change `N`.
2. **Retention of excerpts and attachment metadata.** Excerpts are capped at 500 characters. `In-Reply-To` and `References` are capped at 2000 characters. Those caps are implement limits so the columns cannot hold a full body or a full header dump. How long those values may remain, and whether a later job deletes them, is not decided. No retention job is in this pack.

## Implement readings that are not open decisions

- Null `live_notification_started_at` means pre-live: ingest is allowed, per-message SMS is not, and at most one `backlog_summary` may be recorded. A missing `event_created_at` while a watermark is set is treated as before-live.
- `health_alerts_enabled` defaults to false. While it is false, a failed check does not open an outage row. Null `last_successful_health_at` is `unstarted`, not an outage.
- While Hostinger is off, the inactive heartbeat uses the pending `intake_queue` count as `messagesSeen`. Zero pending rows is the quiet case. It is not a fault.
- `review_notify_enabled` and `review_notify_destination` stay false / null. They are not the SMS phone. SMS uses `internal_sms_*`.
- `stale_intake_hold` remains on the enum for a future `review_notify` row. The SMS channel uses `hold_alert` for held events, including `stale_processing`.

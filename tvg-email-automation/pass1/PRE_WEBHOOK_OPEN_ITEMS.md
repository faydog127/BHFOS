# Pre-webhook gate — closed

**STAGING ONLY / HOSTINGER OFF**

Section B of `design/09-staging-safety-gate.md` is not passed. Do not point Hostinger `message.received` at n8n. Do not enable n8n schedules. Do not send customer notifications. Do not attach a live internal SMS credential. Do not mutate `wwyxohjnyqnegzbxtuxs`.

The consolidated 2026-09-24 directive keeps this gate CLOSED. It does not pass Section B. Command Center left three items open. Form-filter ordering and open-lead production evidence stay on this gate. They are not staging blockers. The Founder-locked internal SMS amendment adds carrier readiness and credential approval as further Pre-webhook blockers. This build documents them and does not close them.

SMS transport is not the system of record. `email_automation.notification_log` is the record. The path is notification event → notification service → delivery channel. Pass 1 channel is `internal_sms`. A later `crm_push` channel can be added without rewriting intake, identity, HOLD, or dedup.

## 1. Form-filter ordering

Not locked. Pre-webhook owns this item. It is not a staging blocker.

The staging worker uses this implement default, which is narrower than the design's "otherwise identified form path":

- Form path = an enabled `known_form_senders.from_email` exact match on the normalized From address. Nothing else.
- That check runs before `email_filter_lists` deny. An allowlisted From with SPF, DKIM, or DMARC not all `pass` becomes `held` / `form_auth_failure` and cannot become `filtered`.
- Field map in code (`FILTER_FIELD_MAP`):

| Filter kind | Field evaluated |
|---|---|
| `sender_deny`, `sender_allow` | Normalized From addr-spec |
| `domain_deny`, `domain_allow`, `vendor` | From domain; `match_mode=domain` also accepts the registrable domain |
| `noreply_pattern` | From local-part |
| `list_pattern` | `List-Id` plus `Precedence` |

Header rules (DSN, Auto-Submitted, Precedence bulk/list/junk, List-Id, From equal to the mailbox) apply only when From is not on the allowlist. Founder/CC still need to sign this field lock before any live mail.

## 2. Open-lead production evidence

Not replaced. Pre-webhook owns this item. It is not a staging blocker.

The seed allowlist remains the design proposal: `new`, `contacted`, `qualified`, `escalated`. `Customer` is excluded. This build did not census production `wwyxohjnyqnegzbxtuxs`.

A read-only staging check on 2026-09-24 found one `public.leads` row, `tenant_id=tvg`, status `Customer`. That is staging evidence only. It is not a production census.

## 3. Real Hostinger authentication sample

Not captured.

Webhook JSON paths, the Authorization header, folder-scoped search body, `listMessages` fields, and Authentication-Results shape remain `MUST_CAPTURE_FROM_REAL_TEST` (`design/05-hostinger-endpoints.md`). The workflows do not call Hostinger. The auth parser in `lib/pass1-intake-logic.mjs` is provisional.

The public-suffix compare uses subset id `tvg-email-pass1-psl-subset-2026-09-24` (`com`, `net`, `org`, `uk`, `co.uk`, `org.uk`, `com.au`, `co.nz`, `com.br`). It is not a pinned Mozilla PSL package. Pin that before Pre-webhook.

## 4. Internal SMS carrier readiness and Founder credential approval

Not approved. Pre-webhook stays closed until all of the following are true:

1. The actual sending number is identified.
2. U.S. registration is confirmed. The Founder chooses A2P 10DLC or verified toll-free.
3. That use case permits internal operational alerts.
4. A real test SMS reaches a Founder-approved phone, with delivery evidence kept outside this repo.
5. A delivery failure is logged and surfaced. A failed send must not look like success.
6. The Founder explicitly approves attaching the dedicated internal-alert credential. Preferred form is a Twilio subaccount or a restricted API key. It is separate from any customer SMS credential.

`internal_sms_enabled` stays `false`. `max_internal_sms_per_hour` stays `10`. The n8n credential name in the inactive delivery workflow is `TVG Internal SMS Twilio`. That JSON has no account SID, no auth token, and no phone number. The Twilio `to` expression is `{{ $json.destination_ref }}`, loaded from `internal_sms_destination_ref`. The seeded label is `founder_mobile_ref`. The phone number stays in the n8n credential after Founder approval, not in git, SQL settings, workflow JSON, or `notification_log`.

At Founder attach time, before that credential is saved and before the Twilio node is enabled, confirm the key or subaccount cannot send unrestricted customer SMS. It is a dedicated internal-alert subaccount or a restricted API key, with no customer messaging service and no production customer number pool.

Founder-only decisions still open: provision and attach the real credential, A2P 10DLC versus verified toll-free, and cost.

When ordinary `actionable_inbound` traffic is already at `max_internal_sms_per_hour` for the UTC hour:

- Further ordinary events are suppress-with-log (`suppression_reason=storm_cap`). One `storm_summary` row is stored for that hour.
- A `held` or material `error` event still surfaces as one prioritized SMS. It is not part of the ordinary summary, and it does not spend the ordinary counter.
- HOLD and error keep their own counter of the same cap. When that counter is also at the cap, further HOLD/error rows are suppress-with-log. The row stays in `notification_log`. No second summary is created.

The summary sentence is `TVG: N additional new emails received — review queue.` `N` is the number of ordinary events suppressed in that hour, including the event that created the summary. The first overflow is `N=1`. The amendment sentence with 12 is that same sentence when 12 ordinary events have been suppressed and the summary has not been written yet. The text is fixed on that single insert. A later suppression in the hour does not change `N` and does not write another summary. `N` is not the count of every email received in the hour.

Column mapping to the design `notification_log` / `review_notify` settings is in [`NOTIFICATION_MODEL.md`](NOTIFICATION_MODEL.md).

The consolidated directive adds these constraints and does not open the gate:

- SMS is one-way. The dispatcher has no inbound command node.
- `live_notification_started_at` stays null until the Founder sets it. Null means ingest may continue and per-message SMS does not.
- `health_alerts_enabled` stays false. A quiet inbox is not a fault. Hostinger newer-mail and intake-lag checks stay mock and dormant. They are not a live Hostinger API health probe.
- The `n8n_email_automation` password was not set at apply. The approved path is the staging SQL editor and the n8n credential `TVG Staging n8n_email_automation` only.
- Timing targets are 120 seconds on the primary path and 900 seconds for reconcile. There are no application quiet hours.
- Ordinary alert wording is `review`, and the closing line is `No reply sent by automation.`
- The backlog summary sentence in the planner is an implement reading. It is not a Decision ID status. Retention stays deferred under TVG-EMAIL-P1-D007. Statuses are only in [`decision-register/TVG_EMAIL_AUTOMATION_DECISION_REGISTER.md`](decision-register/TVG_EMAIL_AUTOMATION_DECISION_REGISTER.md).

## Also still closed

- `review_notify_destination` and `daily_filtered_digest_destination` stay null.
- Notify and digest workflows record suppression. They have no email, Slack, or HTTP send node. The internal SMS Twilio node is disabled and disconnected.
- `known_form_senders` stays empty.
- `contacts.phone` is not unique on staging (no unique index as of the 2026-09-24 read). The worker fail-closes when more than one TVG contact has the same digits. Do not add a CRM unique constraint in this pack.

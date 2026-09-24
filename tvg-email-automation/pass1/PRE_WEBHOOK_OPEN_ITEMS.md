# Pre-webhook gate — closed

**STAGING ONLY / HOSTINGER OFF**

Section B of `design/09-staging-safety-gate.md` is not passed. Do not point Hostinger `message.received` at n8n. Do not enable n8n schedules. Do not send customer notifications. Do not attach a live internal SMS credential. Do not mutate `wwyxohjnyqnegzbxtuxs`.

Command Center left three items open. The Founder-locked internal SMS amendment adds carrier readiness and credential approval as further Pre-webhook blockers. This build documents them and does not close them.

SMS transport is not the system of record. `email_automation.notification_log` is the record. The path is notification event → notification service → delivery channel. Pass 1 channel is `internal_sms`. A later `crm_push` channel can be added without rewriting intake, identity, HOLD, or dedup.

## 1. Form-recognition / filter field lock

Not locked.

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

## 2. Production open-lead statuses

Not replaced.

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

`internal_sms_enabled` stays `false`. `max_internal_sms_per_hour` stays `10`. The n8n credential name in the inactive delivery workflow is `TVG Internal SMS Twilio`. That JSON has no account SID and no auth token. The destination label is `founder_mobile_ref`. The phone number stays out of git, SQL settings, and `notification_log`.

Founder-only decisions still open: provision and attach the real credential, A2P 10DLC versus verified toll-free, and cost.

Ordinary `awaiting_pass2` texts and priority HOLD/error texts each use that hourly cap. An ordinary storm does not spend the HOLD/error budget. One ordinary summary is stored per suppression window: `TVG: <count> additional new emails received — review queue.` This budget split is the staging reading of “prioritize HOLD/error within the same safety mechanism.”

## Also still closed

- `review_notify_destination` and `daily_filtered_digest_destination` stay null.
- Notify and digest workflows record suppression. They have no email, Slack, or HTTP send node. The internal SMS Twilio node is disabled and disconnected.
- `known_form_senders` stays empty.
- `contacts.phone` is not unique on staging (no unique index as of the 2026-09-24 read). The worker fail-closes when more than one TVG contact has the same digits. Do not add a CRM unique constraint in this pack.

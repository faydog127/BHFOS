# Pre-webhook gate — closed

**STAGING ONLY / HOSTINGER OFF**

Section B of `design/09-staging-safety-gate.md` is not passed. Do not point Hostinger `message.received` at n8n. Do not enable n8n schedules. Do not send internal or customer notifications. Do not mutate `wwyxohjnyqnegzbxtuxs`.

Command Center left three items open. This build documents them and does not close them.

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

## Also still closed

- `review_notify_destination` and `daily_filtered_digest_destination` stay null.
- Notify and digest workflows record suppression. They have no email, Slack, or HTTP send node.
- `known_form_senders` stays empty.
- `contacts.phone` is not unique on staging (no unique index as of the 2026-09-24 read). The worker fail-closes when more than one TVG contact has the same digits. Do not add a CRM unique constraint in this pack.

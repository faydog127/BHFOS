# TVG Email Pass 1 — implementation status

Workstream: TVG Email Automation pass1-v5, plus the Founder-locked internal SMS amendment (2026-09-24). Not Media Intelligence. `command-center/docs/media-intelligence/IMPLEMENTATION_STATUS.md` is unchanged on purpose.

| Field | Value |
|---|---|
| Branch | `cursor/tvg-email-pass1-v5-3e46` |
| Pass 1 pack | `b2cddc8bee25f36b1b22d81060defe9847f68aa2` |
| Prior local-verification commit | `c526a5d0e4ff8eb9e1e5f4c26479a2a3cce272f4` |
| Internal SMS amendment | `e0e1b755d81f048bcaa50a789a9780f644b1f361` |
| Baseline | `main` at `17f9228951d74824d9b6fb0eb704832befed2afc` |
| Evidence | **Locally verified** on disposable Postgres 16.15. Staging is 17.6. Not applied on staging. Not merged. Not deployed. |
| Staging reads | 2026-09-24 read-only SQL on `glkrykpksbsqmmilmjhs`. No DDL. |
| Production | `wwyxohjnyqnegzbxtuxs` not queried and not modified |
| Hostinger | Off |
| Internal SMS | Schema, inactive n8n path, and tests are in this branch. Challenge CHALLENGE_PASS notes are folded in: cap surface, settings-only destination, credential scope, model mapping, summary count. `internal_sms_enabled` stays false. No Twilio secret in git. SMS transport is not the system of record. |
| Pre-webhook | Closed. See `PRE_WEBHOOK_OPEN_ITEMS.md` |

## Local verification (not staging)

- `node --test tvg-email-automation/pass1/test/*.test.mjs` — 34 pass, including the hourly-cap HOLD/error surface and the storm summary count text
- Disposable database `tvg_email_pass1` on local PostgreSQL 16.15: stub CRM + `apply/20260924_tvg_email_pass1_v5.sql` + `fixtures/sql/local-smoke.sql` exited 0 (`SMOKE_OK`), including notification dedup, storm-window uniqueness, customer SMS rejection, and phone-shaped `destination_ref` rejection
- Second apply of the same file on that database exited 0 (`REAPPLY_OK`). `network_os_assurance_delivery_claims` still had 1 row. `auto_send_enabled` stayed `false`. `max_internal_sms_per_hour` stayed `10`. `internal_sms_enabled` stayed `false`. `internal_sms_destination_ref` stayed `founder_mobile_ref`
- Docker smoke script was not the runner. Staging project was not migrated

## Founder-only decisions still open

- Provision and attach the dedicated internal-alert credential
- A2P 10DLC versus verified toll-free
- Cost
- The mobile number stays out of git

## Next action

Coordinator/Founder runs `apply/STAGING_APPLY_CHECKLIST.md` against `glkrykpksbsqmmilmjhs` only, then imports the five n8n JSON files and leaves them inactive. Do not attach the Twilio credential until the Pre-webhook SMS items are approved.

## Authorization boundary

Staging schema apply is the next human step. This change does not merge, does not deploy, does not enable Hostinger, does not activate n8n schedules, and does not send SMS.

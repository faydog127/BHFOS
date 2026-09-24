# TVG Email Pass 1 — implementation status

Workstream: TVG Email Automation pass1-v5. Not Media Intelligence. `command-center/docs/media-intelligence/IMPLEMENTATION_STATUS.md` is unchanged on purpose.

| Field | Value |
|---|---|
| Branch | `cursor/tvg-email-pass1-v5-3e46` |
| Baseline | `main` at `17f9228951d74824d9b6fb0eb704832befed2afc` (even with `origin/main` at branch creation) |
| Evidence | **Locally verified** on a disposable Postgres 16.15 (staging is 17.6; Docker was not available, so `fixtures/local-postgres-smoke.sh` was not the runner). Not applied on staging. Not merged. Not deployed. |
| Staging reads | 2026-09-24 read-only SQL on `glkrykpksbsqmmilmjhs`. No DDL. |
| Production | `wwyxohjnyqnegzbxtuxs` not queried and not modified |
| Hostinger | Off |
| Pre-webhook | Closed. See `PRE_WEBHOOK_OPEN_ITEMS.md` |

## Local verification (not staging)

- `node --test tvg-email-automation/pass1/test/*.test.mjs` — 24 pass
- Disposable database `tvg_email_pass1` on local PostgreSQL 16.15: stub CRM + `apply/20260924_tvg_email_pass1_v5.sql` + `fixtures/sql/local-smoke.sql` exited 0 (`SMOKE_OK`)
- Second apply of the same file on that database exited 0. `network_os_assurance_delivery_claims` still had 1 row. `auto_send_enabled` stayed `false`. `known_form_senders` stayed 0
- Staging project was not migrated

## Next action

Coordinator/Founder runs `apply/STAGING_APPLY_CHECKLIST.md` against `glkrykpksbsqmmilmjhs` only, then imports the n8n JSON and leaves it inactive.

## Authorization boundary

Staging schema apply is the next human step. This change does not merge, does not deploy, does not enable Hostinger, and does not activate n8n schedules.

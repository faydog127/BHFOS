# Synthetic fixtures — TVG Email Pass 1

**STAGING ONLY / HOSTINGER OFF**

Design: [`../design/08-synthetic-fixture-plan.md`](../design/08-synthetic-fixture-plan.md).

Markers: emails on `example.com` / `invalid`, names prefixed `SYNTH `, phones `555-01xx`, Message-IDs `<synth-pass1-…@vent-guys.test>`, `tenant_id=tvg`.

## What runs without a database

`node --test tvg-email-automation/pass1/test/pass1-intake-logic.test.mjs` covers the decision library for F1, F3, F4, F4b, F4c, F5, F6, F7, F12, F15 (SQL text only), F16, and F17.

`node --test tvg-email-automation/pass1/test/pass1-internal-sms.test.mjs` covers internal SMS dedup, the hourly-cap HOLD/error surface (`prioritized_sms` then `suppress_with_log`), the storm summary count text (`N=1` on the first overflow, and `TVG: 12 additional new emails received — review queue.` when 12 ordinary events are already the suppressed set), subject sanitization, and the awaiting_pass2 / held / error gate. `fixtures/sql/local-smoke.sql` checks the unique `(email_event_id, notification_kind)` index, the storm-window unique index, customer SMS rejection, and rejection of a phone-shaped `destination_ref`.

```bash
node tvg-email-automation/pass1/fixtures/run-staging-fixtures.mjs
```

prints the plan and does not connect. `--confirm-staging` still does not execute SQL. It only checks:

- `TVG_EMAIL_STAGING_PROJECT_REF=glkrykpksbsqmmilmjhs`
- `TVG_EMAIL_DATABASE_URL` contains that ref and does not contain `wwyxohjnyqnegzbxtuxs`

## Local disposable Postgres

`fixtures/local-postgres-smoke.sh` starts `postgres:17-alpine`, applies a throwaway CRM stub, applies the pack, and runs `fixtures/sql/local-smoke.sql`. It refuses to start if `DATABASE_URL` or `TVG_EMAIL_DATABASE_URL` is set. It covers pointer uniqueness (F2), atomic claim once (F18, same session), resume actor A (F11b), stale HOLD (F13), and n8n SELECT-only RLS (F19).

The authoring session did not have Docker. The same stub, apply file, and `local-smoke.sql` were run with `psql` against disposable PostgreSQL 16.15 and passed, including a second apply. That is local evidence, not staging, and not the PG 17.6 server on `glkrykpksbsqmmilmjhs`.

## Staging

After the apply checklist, a coordinator may replay `fixtures/sql/local-smoke.sql` only against `glkrykpksbsqmmilmjhs` if that database is allowed to receive `SYNTH` rows. Do not run `fixtures/sql/local-crm-stub.sql` on staging. Staging already has CRM tables.

Cleanup on staging is manual: delete rows with Message-ID prefix `synth-pass1-` or name prefix `SYNTH `. Do not mass-delete with the production service role.

## Not executable until Pre-webhook

F8 (moved-message search), F9 (live 401 from Hostinger), F14 (live reject sampling), and F15 (live INBOX list) need a real Hostinger capture. They are not run here. F10 is the absence of send tables, checked by the apply postamble and the workflow tests.

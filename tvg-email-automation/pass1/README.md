# TVG Email Pass 1 (pass1-v5)

**STAGING ONLY / HOSTINGER OFF**

This is the contained staging build for The Vent Guys email intake. It is not Network OS, Fast Lane, or Control Plane work.

| | |
|---|---|
| Staging project | `glkrykpksbsqmmilmjhs` only |
| Production SoR | `wwyxohjnyqnegzbxtuxs` read-only. Do not migrate, write, or copy secrets. |
| Preserve | `public.network_os_assurance_delivery_claims` |
| Hostinger | Off. No webhook enablement. No live mail fetch. |
| n8n | Six workflow JSON files are importable and **inactive**. Names start with `[STAGING] `. Schedule nodes are **disabled**. The Twilio node is disabled and disconnected. |
| Send path | Absent. No `email_responses`. No `email_send_queue`. No customer SMS. |
| Internal SMS | Founder-locked amendment in [`design/CC_AMENDMENT_INTERNAL_SMS_2026-09-24.md`](design/CC_AMENDMENT_INTERNAL_SMS_2026-09-24.md). Mapping to the design log is in [`NOTIFICATION_MODEL.md`](NOTIFICATION_MODEL.md). `notification_log` is the outbox. SMS transport is not the system of record. `internal_sms_enabled` stays false. |
| Directive | Full text: [`directives/CC_DIRECTIVE_PASS1_STAGING_CONSOLIDATED_2026-09-24.md`](directives/CC_DIRECTIVE_PASS1_STAGING_CONSOLIDATED_2026-09-24.md). Index: [`INDEX.md`](INDEX.md). |
| Decision register | [`decision-register/TVG_EMAIL_AUTOMATION_DECISION_REGISTER.md`](decision-register/TVG_EMAIL_AUTOMATION_DECISION_REGISTER.md). Statuses TVG-EMAIL-P1-D001 through D028 are recorded only there. Addendum: [`directives/CC_ADDENDUM_FOUNDER_OPERATOR_PREFERENCES_2026-09-24.md`](directives/CC_ADDENDUM_FOUNDER_OPERATOR_PREFERENCES_2026-09-24.md). |
| Pass 2 | Design inputs only: [`PASS2_DESIGN_INPUTS.md`](PASS2_DESIGN_INPUTS.md). Not built. |

The vendored design pack in [`design/`](design/) is the pass1-v5 source. Its own README still says design-review-only. Command Center authorized a contained staging build after that pack was written. This directory is that build. It does not apply itself to Supabase.

## What is repo-only

- Design pack copy
- Inactive n8n workflow JSON
- Decision library and Node tests
- Fixture plan and the local disposable Postgres smoke
- Apply checklist and read-only audit / smoke SQL

## What a coordinator must apply

Only on `glkrykpksbsqmmilmjhs`, using [`apply/STAGING_APPLY_CHECKLIST.md`](apply/STAGING_APPLY_CHECKLIST.md).

The base file was reported applied. The next file is `apply/20260924_tvg_email_pass1_incremental.sql`. Do not re-apply the base file.

Do not put that file under `command-center/supabase/migrations`. That history is not this staging project.

## Bootstrap

The apply file follows [`design/11-bootstrap-order.md`](design/11-bootstrap-order.md): extensions, schemas, role, enums, tables, foreign keys, indexes, functions, RLS, policies, grants, seeds.

## Pre-webhook

Closed. The three Command Center items, plus internal SMS carrier readiness and Founder credential approval, are in [`PRE_WEBHOOK_OPEN_ITEMS.md`](PRE_WEBHOOK_OPEN_ITEMS.md).

## Tests

```bash
node --test tvg-email-automation/pass1/test/*.test.mjs
```

Local SQL smoke (Docker, not Supabase):

```bash
tvg-email-automation/pass1/fixtures/local-postgres-smoke.sh
```

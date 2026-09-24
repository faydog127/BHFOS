# TVG Email Pass 1 (pass1-v5)

**STAGING ONLY / HOSTINGER OFF**

This is the contained staging build for The Vent Guys email intake. It is not Network OS, Fast Lane, or Control Plane work.

| | |
|---|---|
| Staging project | `glkrykpksbsqmmilmjhs` only |
| Production SoR | `wwyxohjnyqnegzbxtuxs` read-only. Do not migrate, write, or copy secrets. |
| Preserve | `public.network_os_assurance_delivery_claims` |
| Hostinger | Off. No webhook enablement. No live mail fetch. |
| n8n | Workflow JSON is importable and **inactive**. Schedule nodes are **disabled**. |
| Send path | Absent. No `email_responses`. No `email_send_queue`. |

The vendored design pack in [`design/`](design/) is the pass1-v5 source. Its own README still says design-review-only. Command Center authorized a contained staging build after that pack was written. This directory is that build. It does not apply itself to Supabase.

## What is repo-only

- Design pack copy
- Inactive n8n workflow JSON
- Decision library and Node tests
- Fixture plan and the local disposable Postgres smoke
- Apply checklist and read-only audit / smoke SQL

## What a coordinator must apply

Only on `glkrykpksbsqmmilmjhs`, using [`apply/STAGING_APPLY_CHECKLIST.md`](apply/STAGING_APPLY_CHECKLIST.md):

`apply/20260924_tvg_email_pass1_v5.sql`

Do not put that file under `command-center/supabase/migrations`. That history is not this staging project.

## Bootstrap

The apply file follows [`design/11-bootstrap-order.md`](design/11-bootstrap-order.md): extensions, schemas, role, enums, tables, foreign keys, indexes, functions, RLS, policies, grants, seeds.

## Pre-webhook

Closed. The three open items are in [`PRE_WEBHOOK_OPEN_ITEMS.md`](PRE_WEBHOOK_OPEN_ITEMS.md).

## Tests

```bash
node --test tvg-email-automation/pass1/test/*.test.mjs
```

Local SQL smoke (Docker, not Supabase):

```bash
tvg-email-automation/pass1/fixtures/local-postgres-smoke.sh
```

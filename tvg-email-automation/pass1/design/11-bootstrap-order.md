# 11 — Bootstrap / Apply Order (Pass 1 v5)

**Status:** DESIGN REVIEW ONLY — do not apply until **Section A Pre-build** PASS + Founder staging-migrate OK  
**Purpose:** Executable order that avoids forward-reference failures (role before GRANT; tables before FK/RLS/policy; policies before relying on grants under RLS).  
**Canonical SQL:** [`02-email-automation-schema.sql`](./02-email-automation-schema.sql) (sections numbered to match).

---

## Preconditions (not created by this pack)

1. Staging project `glkrykpksbsqmmilmjhs` reachable with a migration / owner role.  
2. CRM baseline present: `public.contacts`, `public.leads` (for real FKs).  
3. `public.network_os_assurance_delivery_claims` preserved (do not drop/alter).  
4. Hostinger webhook traffic **OFF**; n8n email schedules **inactive**.  
5. Section A of `09-staging-safety-gate.md` PASS.

---

## Ordered sequence

| Step | What | Why this order | Notes |
|------|------|----------------|-------|
| **1** | Extensions (`pgcrypto`) | Needed for `gen_random_uuid()` | `CREATE EXTENSION IF NOT EXISTS` |
| **2** | Schemas (`email_automation`, `integrations`) | Containers for types/tables | Comments OK |
| **3** | Role `n8n_email_automation` | **Must exist before any `GRANT … TO n8n_email_automation`** | `LOGIN NOINHERIT`; idempotent `DO $$ … EXCEPTION` |
| **4** | Enums / types in `email_automation` | Tables reference enum types | Incl. `intake_queue_status`, `email_event_status`, filter/notification enums |
| **5** | Tables | No cross-table FKs yet (or deferrable) | Create all `email_automation.*` + `integrations.external_references` |
| **6** | Foreign keys | Referenced tables must exist | CRM FKs to `contacts`/`leads`; internal FKs for errors/notification/queue→events |
| **7** | Indexes | After table columns exist | Unique pointer + identity uniques |
| **8** | Functions + triggers | Tables must exist | `set_updated_at`; **`claim_intake_batch`** |
| **9** | `ENABLE ROW LEVEL SECURITY` | Tables must exist | email_automation.* + integrations.external_references + **contacts/leads** |
| **10** | Policies | RLS enabled; role exists | n8n tenant policies; **contacts/leads SELECT-only**; service_role break-glass |
| **11** | REVOKE / GRANT | Role + tables + policies exist | Private schema REVOKEs; USAGE; table grants; `EXECUTE` on claim function |
| **12** | Seeds / settings | Tables + grants ready | `automation_settings` (incl. open-lead allowlist, `hold_on_form_auth_failure`); `email_filter_lists`; **no** `known_form_senders` rows |

---

## Anti-patterns (do not do)

| Bad order | Failure mode |
|-----------|--------------|
| `GRANT … TO n8n_email_automation` before step 3 | `role "n8n_email_automation" does not exist` |
| FK to `email_events` before that table exists | `relation does not exist` |
| FK to `public.contacts` before CRM baseline | `relation "public.contacts" does not exist` |
| Policies before `ENABLE ROW LEVEL SECURITY` | Policies unused / advisor noise; still enable before relying on RLS |
| Grants without policies (under RLS) | n8n sees **zero rows** on contacts/leads/email tables |
| Seeds before tables | insert target missing |
| Enabling Hostinger webhooks during bootstrap | Violates Pre-webhook gate |

---

## Post-apply smoke checks (staging only)

```sql
-- Role + schemas
SELECT 1 FROM pg_roles WHERE rolname = 'n8n_email_automation';

-- No Pass 2 tables
SELECT to_regclass('email_automation.email_responses');   -- NULL
SELECT to_regclass('email_automation.email_send_queue');  -- NULL

-- Settings
SELECT key, value_json FROM email_automation.automation_settings
WHERE tenant_id='tvg' AND key IN (
  'auto_send_enabled',
  'intake_processing_enabled',
  'open_lead_statuses',
  'hold_on_form_auth_failure'
);

-- Empty form seed
SELECT COUNT(*) FROM email_automation.known_form_senders;  -- 0

-- CRM RLS policies present
SELECT schemaname, tablename, policyname, cmd
FROM pg_policies
WHERE tablename IN ('contacts','leads') AND policyname LIKE 'n8n_%';

-- Claim function executable
SELECT proname FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname='email_automation' AND proname='claim_intake_batch';
```

---

## Relationship to gates

| Gate | Bootstrap |
|------|-----------|
| Section A Pre-build PASS | Required **before** steps 1–12 |
| Steps 1–12 applied | Still **no** Hostinger traffic |
| Section B Pre-webhook PASS | Required **before** webhook enable / schedule activate |

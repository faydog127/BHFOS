# 03 — n8n Role `n8n_email_automation` (Least Privilege)

**Status:** DESIGN REVIEW ONLY — do not create role/grants until **Pre-build** gate + Founder approval  
**LOCKED:** n8n uses **`n8n_email_automation`**, **not** `service_role`  
**Supersedes:** `pass1-v4/03-n8n-role.md` (adds **contacts/leads RLS policies**; documents SELECT-only CRM least privilege)

---

## 1. Principles

1. n8n never holds Supabase `service_role` for TVG email automation.
2. Role is a login/DB role (or Supabase custom role via connection string) with **explicit** grants only.
3. RLS remains enabled; **policies** allow this role for `tenant_id = 'tvg'` only — **grants alone are insufficient**.
4. Pass 1 CRM access: **SELECT only** on `contacts` / `leads` (identity resolution). **No** INSERT/UPDATE/DELETE on CRM — and **no write policies**.
5. Knowledge tables may receive optional **SELECT** grants for future Pass 2 readiness — **Pass 1 worker must not query them**.
6. HCP: **zero writes**.
7. `email_automation` schema is **PRIVATE**: real REVOKE from `PUBLIC` / `anon` / `authenticated`.
8. Secrets stay in n8n Credentials; role password is a secret.
9. **No** grants on `email_responses` / `email_send_queue` — those tables **do not exist** in Pass 1.
10. Create the role **before** GRANTs (see `11-bootstrap-order.md`).

---

## 2. Role creation (draft — step 3 of bootstrap)

```sql
-- DESIGN ONLY — do not apply yet
DO $$ BEGIN
  CREATE ROLE n8n_email_automation LOGIN NOINHERIT;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Schema USAGE only after schemas exist (bootstrap step 11)
GRANT USAGE ON SCHEMA email_automation TO n8n_email_automation;
GRANT USAGE ON SCHEMA integrations TO n8n_email_automation;
GRANT USAGE ON SCHEMA public TO n8n_email_automation;  -- CRM reads only
```

(Full ordered REVOKE/GRANT/RLS statements live in `02-email-automation-schema.sql`.)

---

## 3. Grants matrix

| Object | SELECT | INSERT | UPDATE | DELETE | Notes |
|--------|:------:|:------:|:------:|:------:|-------|
| `email_automation.intake_queue` | ✓ | ✓ | ✓ | ✗ | Worker lock/status; no delete |
| `email_automation.email_events` | ✓ | ✓ | ✓ | ✗ | SoT intake |
| `email_automation.automation_errors` | ✓ | ✓ | ✗ | ✗ | Append-only |
| `email_automation.automation_settings` | ✓ | ✗ | ✗ | ✗ | Read knobs (incl. kill switch) |
| `email_automation.known_form_senders` | ✓ | ✗ | ✗ | ✗ | Config read (seed empty) |
| `email_automation.email_filter_lists` | ✓ | ✗ | ✗ | ✗ | Configurable filters; no hard-code in n8n |
| `email_automation.notification_log` | ✓ | ✓ | ✓ | ✗ | Internal notify audit only |
| `integrations.external_references` | ✓ | ✓ | ✓ | ✗ | Upsert Hostinger refs; RLS required |
| `public.contacts` | ✓ | ✗ | ✗ | ✗ | Person match — **RLS policy required** |
| `public.leads` | ✓ | ✗ | ✗ | ✗ | Opportunity match — **RLS policy required** |
| `email_automation.claim_intake_batch` | EXECUTE | — | — | — | Atomic claim helper |
| Knowledge CRM tables | ✓ optional | ✗ | ✗ | ✗ | Unused by Pass 1 worker |
| `email_responses` / `email_send_queue` | — | — | — | — | **Do not exist in Pass 1** |
| `service_role` / `postgres` | — | — | — | — | **Never** used by n8n |
| HCP write tables / RPCs | ✗ | ✗ | ✗ | ✗ | Locked zero writes |
| `auth.*` / `vault.*` / `storage.*` / `cron.job` | ✗ | ✗ | ✗ | ✗ | No access |

```sql
-- DESIGN ONLY (also embedded in 02, bootstrap step 11)
GRANT SELECT, INSERT, UPDATE ON email_automation.intake_queue TO n8n_email_automation;
GRANT SELECT, INSERT, UPDATE ON email_automation.email_events TO n8n_email_automation;
GRANT SELECT, INSERT ON email_automation.automation_errors TO n8n_email_automation;
GRANT SELECT ON email_automation.automation_settings TO n8n_email_automation;
GRANT SELECT ON email_automation.known_form_senders TO n8n_email_automation;
GRANT SELECT ON email_automation.email_filter_lists TO n8n_email_automation;
GRANT SELECT, INSERT, UPDATE ON email_automation.notification_log TO n8n_email_automation;
GRANT SELECT, INSERT, UPDATE ON integrations.external_references TO n8n_email_automation;
GRANT SELECT ON public.contacts, public.leads TO n8n_email_automation;
GRANT EXECUTE ON FUNCTION email_automation.claim_intake_batch(text, int) TO n8n_email_automation;
```

---

## 4. RLS (required — not optional)

### 4.1 email_automation / integrations

Complete policies in `02-email-automation-schema.sql` for:

- `email_automation.automation_settings`
- `email_automation.intake_queue`
- `email_automation.email_events`
- `email_automation.automation_errors`
- `email_automation.known_form_senders`
- `email_automation.email_filter_lists`
- `email_automation.notification_log`
- `integrations.external_references`

Pattern: `USING (tenant_id = 'tvg') WITH CHECK (tenant_id = 'tvg')` for write tables; SELECT-only policies for config tables.  
Anon / authenticated: **no** policies on email PII tables (deny by default).

### 4.2 CRM contacts / leads (Command Center item 1)

**Grants alone are insufficient.** Even with `GRANT SELECT`, if RLS is enabled (typical on staging/prod for `contacts` / `leads`), n8n sees **zero rows** without a policy.

```sql
-- DESIGN ONLY — also in 02
ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS n8n_contacts_tvg_select ON public.contacts;
CREATE POLICY n8n_contacts_tvg_select ON public.contacts
  FOR SELECT TO n8n_email_automation
  USING (tenant_id = 'tvg');

DROP POLICY IF EXISTS n8n_leads_tvg_select ON public.leads;
CREATE POLICY n8n_leads_tvg_select ON public.leads
  FOR SELECT TO n8n_email_automation
  USING (tenant_id = 'tvg');
```

| Privilege | Pass 1 decision | Justification |
|-----------|-----------------|---------------|
| SELECT | **Yes** | Identity linking only (match contact/lead by email/phone) |
| INSERT / UPDATE / DELETE | **No** | Pass 1 does not create or mutate CRM rows |
| Write policies | **None** | Least privilege; any future write must be explicit + Founder-justified |

**Note:** Existing policies for `authenticated` / other roles on contacts/leads must remain undisturbed. Only **add** the n8n SELECT policies; do not DROP unrelated policies.

---

## 5. Credentials

| Credential | Value |
|------------|-------|
| DB host / URL | Staging `glkrykpksbsqmmilmjhs` |
| Role | `n8n_email_automation` |
| Password | Secret |
| **Not used** | `service_role` key for these workflows |

---

## 6. Verification (staging only, post-apply)

```sql
SELECT value_json FROM email_automation.automation_settings
WHERE tenant_id='tvg' AND key='auto_send_enabled';  -- false

SELECT value_json FROM email_automation.automation_settings
WHERE tenant_id='tvg' AND key='intake_processing_enabled';  -- kill switch present

SELECT value_json FROM email_automation.automation_settings
WHERE tenant_id='tvg' AND key='open_lead_statuses';

SELECT value_json FROM email_automation.automation_settings
WHERE tenant_id='tvg' AND key='hold_on_form_auth_failure';  -- true

SELECT COUNT(*) FROM email_automation.known_form_senders;  -- 0 until real samples

SELECT to_regclass('email_automation.email_responses');   -- NULL
SELECT to_regclass('email_automation.email_send_queue');  -- NULL

-- As n8n_email_automation: must see tvg contacts/leads via RLS
SET ROLE n8n_email_automation;
SELECT COUNT(*) FROM public.contacts WHERE tenant_id='tvg';
SELECT COUNT(*) FROM public.leads WHERE tenant_id='tvg';
RESET ROLE;

SELECT polname, tablename FROM pg_policies
WHERE tablename IN ('contacts','leads') AND polname LIKE 'n8n_%';
```

## 7. Incident

Rotate password; deactivate n8n workflows; set `intake_processing_enabled=false` (does not change Hostinger webhook config); revoke CONNECT; leave tables for forensics.

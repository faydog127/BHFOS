# TVG Email Pass 1 v5 — STAGING APPLY REPORT

**Applied:** YES (staging only)  
**When:** 2026-09-24 ~09:25–09:30 ET (America/New_York)  
**Target project:** `glkrykpksbsqmmilmjhs` — BHFOS n8n Assurance Preview (ACTIVE_HEALTHY, us-east-1, Postgres 17.6)  
**Production:** `wwyxohjnyqnegzbxtuxs` — **NOT TOUCHED** (no MCP calls with that project_id)  
**Hostinger:** OFF (no webhook create/update; no schedule activation; no customer communication)  
**PR merge:** NOT performed  
**Source branch:** `cursor/tvg-email-pass1-v5-3e46` / PR #160  
**Apply SQL SHA256:** `a02f5da14394038e3a8f04b171cb54ff375f778ea67c2eaddce401d23f3ac351` (`20260924_tvg_email_pass1_v5.sql` + latch)

## Section A authorization (evidence)

- Founder verbal go in chat: **"move forward with the staging apply"** (2026-09-24 ~09:12 ET)
- Task framing: Founder go + CC STAGING BUILD AUTHORIZED + Challenge PASS
- File: `SECTION_A_AUTH.txt` (no other signatures invented)
- SMS amendment locked at ~09:23 ET: `/workspace/tvg-email-automation/pass1-v5/amendments/CC_AMENDMENT_INTERNAL_SMS_2026-09-24.md` — **not applied in this pass**; base apply already includes `notification_log`; SMS schema deferred to Cursor PR follow-up

## Preflight (read-only)

| Check | Result |
|---|---|
| Project id/name | `glkrykpksbsqmmilmjhs` / BHFOS n8n Assurance Preview |
| `email_automation` / `integrations` | absent |
| Role `n8n_email_automation` | absent |
| `public.contacts` / `public.leads` | present; RLS enabled; policies `contacts_authenticated_all`, `leads_authenticated_all` |
| `public.network_os_assurance_delivery_claims` | present; RLS on; **FORCE** RLS true; **10** columns; row count **0** |
| Preflight claims_sig | `9bc496035071ded12ade2b6678823a30` |

## What was applied

Single-file apply was split into ordered `apply_migration` calls (MCP payload size / session latch), each prefixed with:

`SELECT set_config('tvg_email_pass1.target_project', 'glkrykpksbsqmmilmjhs', false);`

Migration names recorded on staging:

1. `tvg_email_pass1_v5_staging_01a_latch_schema_role`
2. `tvg_email_pass1_v5_staging_01b_enums`
3. `tvg_email_pass1_v5_staging_01c_tables_core`
4. `tvg_email_pass1_v5_staging_01d_tables_rest`
5. `tvg_email_pass1_v5_staging_02a_fks`
6. `tvg_email_pass1_v5_staging_02b_indexes`
7. `tvg_email_pass1_v5_staging_02c_functions_triggers`
8. `tvg_email_pass1_v5_staging_03a_rls_enable`
9. `tvg_email_pass1_v5_staging_03b_n8n_policies`
10. `tvg_email_pass1_v5_staging_03c_service_role_policies`
11. `tvg_email_pass1_v5_staging_03d_grants`
12. `tvg_email_pass1_v5_staging_04_seeds_verify`

Created: schemas `email_automation`, `integrations`; role `n8n_email_automation` (LOGIN NOINHERIT, **no password set in SQL**); enums; tables including `notification_log` (base pack — not SMS transport); FKs; indexes; `claim_intake_batch`; RLS + policies; REVOKEs/GRANTs; settings + filter-list seeds.

**Not created:** `email_responses`, `email_send_queue`.  
**Not altered:** `public.network_os_assurance_delivery_claims`.

## Post-apply verification

| Check | Result |
|---|---|
| Role `n8n_email_automation` | exists (`role_exists=1`) |
| `email_responses` / `email_send_queue` | **null** (absent) |
| `email_events`, `intake_queue`, `notification_log` | present |
| `auto_send_enabled` | `false` |
| `hold_on_form_auth_failure` | `true` |
| `intake_processing_enabled` | `true` (kill switch; does not touch Hostinger) |
| `open_lead_statuses` | `["new","contacted","qualified","escalated"]` |
| `known_form_senders` row count | **0** |
| Policies `n8n_contacts_tvg_select`, `n8n_leads_tvg_select` | present (SELECT) |
| `claim_intake_batch` | present |
| Claims FORCE RLS | **true** |
| Claims column count | **10** |
| Claims row count | **0** (unchanged vs preflight) |
| Claims_sig post-apply | `9bc496035071ded12ade2b6678823a30` (**identical** to preflight) |
| `automation_settings` rows | 24 |
| `email_filter_lists` rows | 7 |

## Advisors (security) — staging — reported, not "fixed away"

From `get_advisors` type=security after apply:

1. **INFO** `rls_enabled_no_policy` — `public.network_os_assurance_delivery_claims` has RLS enabled but no policies (deny-by-default under FORCE RLS). Pre-existing intentional posture for the claims table; this apply did not add/remove policies on it. Remediation doc: https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy
2. **WARN** `extension_in_public` — extension `pg_trgm` installed in `public`. Pre-existing; not introduced by Pass 1 apply. Remediation doc: https://supabase.com/docs/guides/database/database-linter?lint=0014_extension_in_public

No advisor findings specifically naming new `email_automation.*` tables as missing policies (n8n + service_role policies were created).

## Claims preserved proof

- Preflight: force=true, cols=10, count=0, sig=`9bc496035071ded12ade2b6678823a30`
- Post-apply: force=true, cols=10, count=0, sig=`9bc496035071ded12ade2b6678823a30`
- Final migration DO block also asserted claims_sig unchanged within the seeds session

## n8n remaining steps (Coordinator / Founder — NOT done by this executor)

1. Set role password **out-of-band** in staging SQL editor: `ALTER ROLE n8n_email_automation PASSWORD '<secret>';` — store only in n8n staging credentials. **Do not commit password to git or chat.** Apply file contains no PASSWORD clause.
2. Import the four n8n JSON workflows from `tvg-email-automation/pass1/n8n/` (repo branch). Confirm each workflow is **inactive** and schedule nodes are **disabled**.
3. Do **not** activate schedules. Do **not** create/enable a Hostinger webhook.
4. Do **not** expose `email_automation` on the Data API exposed schemas.
5. Pre-webhook gate remains closed (review_notify destinations still null; review_notify_enabled false).

## Remaining blockers / follow-ups

| Item | Status |
|---|---|
| n8n inactive import | **OPEN** — Coordinator/Founder |
| `n8n_email_automation` password | **OPEN** — Founder/ops secret-request out-of-band |
| Hostinger webhook | **CLOSED / OFF** — do not enable |
| Schedule activation | **OFF** |
| Internal SMS amendment schema | **DEFERRED** — PR follow-up; base `notification_log` already present; no live SMS credentials |
| Production apply | **FORBIDDEN** until separate authorization |
| PR #160 merge | **NOT** done by this apply |

## Evidence paths

- `/workspace/tvg-email-automation/pass1-v5/staging-apply/APPLY_REPORT.md` (this file)
- `/workspace/tvg-email-automation/pass1-v5/staging-apply/20260924_tvg_email_pass1_v5.sql`
- `/workspace/tvg-email-automation/pass1-v5/staging-apply/APPLY_WITH_LATCH.sql`
- `/workspace/tvg-email-automation/pass1-v5/staging-apply/pre_apply_audit.sql`
- `/workspace/tvg-email-automation/pass1-v5/staging-apply/post_apply_smoke.sql`
- `/workspace/tvg-email-automation/pass1-v5/staging-apply/SECTION_A_AUTH.txt`
- `/workspace/tvg-email-automation/pass1-v5/staging-apply/STAGING_APPLY_CHECKLIST.md`
- `/workspace/tvg-email-automation/pass1-v5/staging-apply/parts/` (bootstrap-ordered splits)

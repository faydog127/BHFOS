-- =============================================================================
-- TVG Email Pass 1 — corrective fetch settings
-- STAGING ONLY / live Hostinger fetch OFF
-- Apply only on glkrykpksbsqmmilmjhs after the base pack.
-- Additive and idempotent. ON CONFLICT DO NOTHING, so a later mock URL is kept.
-- Does not write public.*, production, or customer-send tables.
-- =============================================================================

DO $$
BEGIN
  IF current_setting('tvg_email_pass1.target_project', true)
     IS DISTINCT FROM 'glkrykpksbsqmmilmjhs' THEN
    RAISE EXCEPTION 'refusing corrective apply without the staging project latch';
  END IF;
  IF to_regclass('email_automation.automation_settings') IS NULL
     OR to_regclass('email_automation.intake_queue') IS NULL THEN
    RAISE EXCEPTION 'base pass1 pack is not present';
  END IF;
  IF to_regclass('email_automation.email_responses') IS NOT NULL
     OR to_regclass('email_automation.email_send_queue') IS NOT NULL THEN
    RAISE EXCEPTION 'customer send tables must not exist';
  END IF;
END $$;

INSERT INTO email_automation.automation_settings (tenant_id, key, value_json, description) VALUES
  ('tvg', 'hostinger_mail_api_base_url', '"disabled"'::jsonb,
   'Worker fetch base URL. Default disabled. Point at the inactive staging mock test URL for smokes. Never defaults to https://api.mail.hostinger.com.'),
  ('tvg', 'hostinger_mail_api_allowed_hosts', '[]'::jsonb,
   'Host allowlist for worker GET metadata/text/source. Empty until a mock host is added. The live host also requires hostinger_live_fetch_enabled.'),
  ('tvg', 'hostinger_live_fetch_enabled', 'false'::jsonb,
   'Explicit gate for api.mail.hostinger.com. Stays false until the CC/Founder live-test window. No token is stored in this table.'),
  ('tvg', 'hostinger_fetch_timeout_ms', '8000'::jsonb,
   'Worker HTTP timeout cap for the three GET calls. The workflow node reads this value.'),
  ('tvg', 'hostinger_fetch_max_body_bytes', '262144'::jsonb,
   'Maximum accepted metadata, text, or source body. Larger responses HOLD hostinger_body_too_large and are not stored.'),
  ('tvg', 'hostinger_fetch_excluded_uids', '[924150001]'::jsonb,
   'Non-synthetic intake_queue uids the worker must not claim. 924150001 is the stuck staging row and is also hardcoded in the claim SQL.')
ON CONFLICT (tenant_id, key) DO NOTHING;

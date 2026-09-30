-- =============================================================================
-- TVG Email Pass 1 — incremental latch
-- STAGING ONLY / HOSTINGER OFF
-- The base pack is already applied on glkrykpksbsqmmilmjhs.
-- Do not re-apply apply/20260924_tvg_email_pass1_v5.sql from this file.
-- =============================================================================

DO $$
BEGIN
  IF current_setting('tvg_email_pass1.target_project', true)
     IS DISTINCT FROM 'glkrykpksbsqmmilmjhs' THEN
    RAISE EXCEPTION 'refusing incremental apply without the staging project latch';
  END IF;
  IF to_regclass('email_automation.notification_log') IS NULL
     OR to_regclass('email_automation.email_events') IS NULL THEN
    RAISE EXCEPTION 'base pass1 pack is not present';
  END IF;
  IF to_regclass('email_automation.email_responses') IS NOT NULL
     OR to_regclass('email_automation.email_send_queue') IS NOT NULL THEN
    RAISE EXCEPTION 'customer send tables must not exist';
  END IF;
END $$;

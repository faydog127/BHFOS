-- =============================================================================
-- NOT APPLIED by this repository against any Supabase project.
-- Controlled-live preflight. Staging latch required.
-- The supported controlled-live value of resolve_max_attempts is exactly 5,
-- matching the five-entry backoff schedule 1/2/5/10/20.
-- Any other value fails closed. This file does not change the setting.
-- There is no general support for a value above 5.
-- =============================================================================

BEGIN;

DO $$
DECLARE
  configured jsonb;
BEGIN
  IF current_setting('tvg_email_pass1.target_project', true)
     IS DISTINCT FROM 'glkrykpksbsqmmilmjhs' THEN
    RAISE EXCEPTION 'refusing resolve_max_attempts preflight without the staging project latch';
  END IF;
  SELECT s.value_json INTO configured
  FROM email_automation.automation_settings s
  WHERE s.tenant_id = 'tvg'
    AND s.key = 'resolve_max_attempts';
  IF configured IS DISTINCT FROM '5'::jsonb THEN
    RAISE EXCEPTION 'controlled-live refused: resolve_max_attempts must be exactly 5';
  END IF;
END $$;

COMMIT;

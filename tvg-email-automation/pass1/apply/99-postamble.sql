-- Search path lock for the two functions. Bodies stay schema-qualified.
ALTER FUNCTION email_automation.set_updated_at() SET search_path = email_automation, pg_temp;
ALTER FUNCTION email_automation.claim_intake_batch(text, int) SET search_path = email_automation, pg_temp;

DO $$
DECLARE
  sig text;
  forced boolean;
  auto_send jsonb;
  form_hold jsonb;
  form_senders int;
  sms_cap jsonb;
  sms_enabled jsonb;
  sms_dest jsonb;
BEGIN
  SELECT c.relforcerowsecurity,
         md5(string_agg(a.attname || ':' || t.typname, ',' ORDER BY a.attnum))
    INTO forced, sig
  FROM pg_class c
  JOIN pg_namespace ns ON ns.oid = c.relnamespace
  JOIN pg_attribute a ON a.attrelid = c.oid AND a.attnum > 0 AND NOT a.attisdropped
  JOIN pg_type t ON t.oid = a.atttypid
  WHERE ns.nspname = 'public'
    AND c.relname = 'network_os_assurance_delivery_claims'
  GROUP BY c.relforcerowsecurity;

  IF forced IS NOT TRUE
     OR sig IS DISTINCT FROM current_setting('tvg_email_pass1.claims_sig', true) THEN
    RAISE EXCEPTION 'network_os_assurance_delivery_claims changed during Pass 1 apply';
  END IF;

  IF to_regclass('email_automation.email_responses') IS NOT NULL THEN
    RAISE EXCEPTION 'email_responses must not exist in Pass 1';
  END IF;
  IF to_regclass('email_automation.email_send_queue') IS NOT NULL THEN
    RAISE EXCEPTION 'email_send_queue must not exist in Pass 1';
  END IF;

  SELECT value_json INTO auto_send
  FROM email_automation.automation_settings
  WHERE tenant_id = 'tvg' AND key = 'auto_send_enabled';
  IF auto_send IS DISTINCT FROM 'false'::jsonb THEN
    RAISE EXCEPTION 'auto_send_enabled must be false';
  END IF;

  SELECT value_json INTO form_hold
  FROM email_automation.automation_settings
  WHERE tenant_id = 'tvg' AND key = 'hold_on_form_auth_failure';
  IF form_hold IS DISTINCT FROM 'true'::jsonb THEN
    RAISE EXCEPTION 'hold_on_form_auth_failure must be true';
  END IF;

  SELECT count(*) INTO form_senders FROM email_automation.known_form_senders;
  IF form_senders <> 0 THEN
    RAISE EXCEPTION 'known_form_senders must stay empty until a real form sample is captured';
  END IF;

  SELECT value_json INTO sms_cap
  FROM email_automation.automation_settings
  WHERE tenant_id = 'tvg' AND key = 'max_internal_sms_per_hour';
  IF sms_cap IS DISTINCT FROM '10'::jsonb THEN
    RAISE EXCEPTION 'max_internal_sms_per_hour must default to 10';
  END IF;

  SELECT value_json INTO sms_enabled
  FROM email_automation.automation_settings
  WHERE tenant_id = 'tvg' AND key = 'internal_sms_enabled';
  IF sms_enabled IS DISTINCT FROM 'false'::jsonb THEN
    RAISE EXCEPTION 'internal_sms_enabled must stay false until Founder approves the credential';
  END IF;

  SELECT value_json INTO sms_dest
  FROM email_automation.automation_settings
  WHERE tenant_id = 'tvg' AND key = 'internal_sms_destination_ref';
  IF sms_dest IS DISTINCT FROM '"founder_mobile_ref"'::jsonb THEN
    RAISE EXCEPTION 'internal_sms_destination_ref must stay a label';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'email_automation'
      AND indexname = 'uq_notification_log_event_kind'
  ) THEN
    RAISE EXCEPTION 'notification dedup index missing';
  END IF;
END $$;

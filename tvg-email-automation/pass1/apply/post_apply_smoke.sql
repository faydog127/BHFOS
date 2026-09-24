-- Read-only smoke. Staging glkrykpksbsqmmilmjhs after apply. Not proof of Hostinger.

SELECT 1 AS role_exists FROM pg_roles WHERE rolname = 'n8n_email_automation';

SELECT to_regclass('email_automation.email_responses') AS email_responses,
       to_regclass('email_automation.email_send_queue') AS email_send_queue;

SELECT key, value_json
FROM email_automation.automation_settings
WHERE tenant_id = 'tvg'
  AND key IN (
    'auto_send_enabled',
    'intake_processing_enabled',
    'open_lead_statuses',
    'hold_on_form_auth_failure',
    'max_internal_sms_per_hour',
    'internal_sms_enabled',
    'internal_sms_destination_ref'
  )
ORDER BY key;

SELECT count(*) AS known_form_senders FROM email_automation.known_form_senders;

SELECT indexname
FROM pg_indexes
WHERE schemaname = 'email_automation'
  AND indexname IN ('uq_notification_log_event_kind', 'uq_notification_log_storm_window')
ORDER BY indexname;

SELECT schemaname, tablename, policyname, cmd
FROM pg_policies
WHERE tablename IN ('contacts', 'leads') AND policyname LIKE 'n8n_%'
ORDER BY tablename, policyname;

SELECT proname
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'email_automation' AND proname = 'claim_intake_batch';

SELECT c.relforcerowsecurity AS claims_force_rls,
       count(a.attname) AS claims_column_count
FROM pg_class c
JOIN pg_namespace ns ON ns.oid = c.relnamespace
JOIN pg_attribute a ON a.attrelid = c.oid AND a.attnum > 0 AND NOT a.attisdropped
WHERE ns.nspname = 'public'
  AND c.relname = 'network_os_assurance_delivery_claims'
GROUP BY c.relforcerowsecurity;

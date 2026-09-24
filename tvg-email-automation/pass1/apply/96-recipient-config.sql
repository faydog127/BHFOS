-- =============================================================================
-- TVG Email Pass 1 — Founder operator-preference addendum (2026-09-24)
-- STAGING ONLY / HOSTINGER OFF / NO CUSTOMER SEND / NO CADENCE DEFAULT
-- Recipient model is Founder + internal SMS only. Escalation stays null.
-- Coordinator Decision IDs for this addendum were not in the workspace.
-- =============================================================================

CREATE TABLE IF NOT EXISTS email_automation.notification_recipients (
  tenant_id text NOT NULL DEFAULT 'tvg',
  recipient_key text NOT NULL,
  display_label text NOT NULL,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, recipient_key),
  CONSTRAINT notification_recipients_tenant_tvg CHECK (tenant_id = 'tvg'),
  CONSTRAINT notification_recipients_founder_only CHECK (recipient_key = 'founder'),
  CONSTRAINT notification_recipients_label CHECK (recipient_key ~ '^[a-z][a-z0-9_]{0,63}$')
);

COMMENT ON TABLE email_automation.notification_recipients IS
  'Pass 1 notification recipient. One Founder destination until the Founder authorizes more recipients.';

CREATE TABLE IF NOT EXISTS email_automation.notification_subscriptions (
  tenant_id text NOT NULL DEFAULT 'tvg',
  recipient_key text NOT NULL,
  channel text NOT NULL,
  event_kind text NOT NULL,
  destination_ref text NOT NULL,
  enabled boolean NOT NULL DEFAULT false,
  escalation_after interval,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, recipient_key, channel, event_kind),
  CONSTRAINT notification_subscriptions_tenant_tvg CHECK (tenant_id = 'tvg'),
  CONSTRAINT notification_subscriptions_founder_sms CHECK (
    recipient_key = 'founder' AND channel = 'internal_sms'
  ),
  CONSTRAINT notification_subscriptions_no_cadence CHECK (escalation_after IS NULL),
  CONSTRAINT notification_subscriptions_destination_label CHECK (
    destination_ref ~ '^[a-z][a-z0-9_]{0,63}$'
  ),
  CONSTRAINT notification_subscriptions_single_founder_destination CHECK (
    destination_ref = 'founder_mobile_ref'
  )
);

COMMENT ON TABLE email_automation.notification_subscriptions IS
  'Pass 1 subscription shape: recipient, channel, event kind, destination label, enabled, escalation. Enabled stays false. escalation_after stays null. No follow-up cadence is stored.';
COMMENT ON COLUMN email_automation.notification_subscriptions.escalation_after IS
  'Reserved for a later decision. Pass 1 stores null and rejects any interval. No cadence default.';
COMMENT ON COLUMN email_automation.notification_subscriptions.destination_ref IS
  'Settings label only. Not a phone number and not a customer address.';

CREATE TABLE IF NOT EXISTS email_automation.configuration_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id text NOT NULL DEFAULT 'tvg',
  actor text NOT NULL,
  changed_at timestamptz NOT NULL DEFAULT now(),
  setting_key text NOT NULL,
  previous_value jsonb,
  new_value jsonb,
  CONSTRAINT configuration_audit_tenant_tvg CHECK (tenant_id = 'tvg'),
  CONSTRAINT configuration_audit_actor CHECK (actor ~ '^[A-Za-z][A-Za-z0-9_.:@-]{0,80}$')
);

COMMENT ON TABLE email_automation.configuration_audit IS
  'Auditable configuration changes: actor, timestamp, setting, previous value, new value. Not a secret store.';

CREATE OR REPLACE FUNCTION email_automation.audit_setting_change()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  actor_name text;
  setting_name text;
  previous_value jsonb;
  next_value jsonb;
BEGIN
  actor_name := NULLIF(current_setting('tvg_email_pass1.actor', true), '');
  IF actor_name IS NULL AND TG_TABLE_NAME = 'automation_settings' THEN
    actor_name := NULLIF(NEW.updated_by, '');
  END IF;
  IF actor_name IS NULL THEN
    actor_name := session_user;
  END IF;
  IF TG_TABLE_NAME = 'automation_settings' THEN
    setting_name := NEW.key;
    next_value := NEW.value_json;
    IF TG_OP = 'UPDATE' THEN
      previous_value := OLD.value_json;
      IF previous_value IS NOT DISTINCT FROM next_value THEN
        RETURN NEW;
      END IF;
    END IF;
  ELSE
    setting_name := NEW.recipient_key || ':' || NEW.channel || ':' || NEW.event_kind;
    next_value := jsonb_build_object(
      'destination_ref', NEW.destination_ref,
      'enabled', NEW.enabled,
      'escalation_after', NULL
    );
    IF TG_OP = 'UPDATE' THEN
      previous_value := jsonb_build_object(
        'destination_ref', OLD.destination_ref,
        'enabled', OLD.enabled,
        'escalation_after', NULL
      );
      IF previous_value IS NOT DISTINCT FROM next_value THEN
        RETURN NEW;
      END IF;
    END IF;
  END IF;
  INSERT INTO email_automation.configuration_audit (
    tenant_id, actor, changed_at, setting_key, previous_value, new_value
  ) VALUES (
    'tvg', actor_name, now(), setting_name, previous_value, next_value
  );
  RETURN NEW;
END;
$$;

ALTER FUNCTION email_automation.audit_setting_change()
  SET search_path = email_automation, pg_temp;

DROP TRIGGER IF EXISTS trg_audit_automation_settings ON email_automation.automation_settings;
CREATE TRIGGER trg_audit_automation_settings
  AFTER INSERT OR UPDATE ON email_automation.automation_settings
  FOR EACH ROW EXECUTE FUNCTION email_automation.audit_setting_change();

DROP TRIGGER IF EXISTS trg_audit_notification_subscriptions ON email_automation.notification_subscriptions;
CREATE TRIGGER trg_audit_notification_subscriptions
  AFTER INSERT OR UPDATE ON email_automation.notification_subscriptions
  FOR EACH ROW EXECUTE FUNCTION email_automation.audit_setting_change();

ALTER TABLE email_automation.notification_recipients ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_automation.notification_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_automation.configuration_audit ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS n8n_notification_recipients_tvg ON email_automation.notification_recipients;
CREATE POLICY n8n_notification_recipients_tvg ON email_automation.notification_recipients
  FOR SELECT TO n8n_email_automation
  USING (tenant_id = 'tvg');
DROP POLICY IF EXISTS n8n_notification_subscriptions_tvg ON email_automation.notification_subscriptions;
CREATE POLICY n8n_notification_subscriptions_tvg ON email_automation.notification_subscriptions
  FOR SELECT TO n8n_email_automation
  USING (tenant_id = 'tvg');
DROP POLICY IF EXISTS n8n_configuration_audit_tvg ON email_automation.configuration_audit;
CREATE POLICY n8n_configuration_audit_tvg ON email_automation.configuration_audit
  FOR SELECT TO n8n_email_automation
  USING (tenant_id = 'tvg');

DROP POLICY IF EXISTS service_role_notification_recipients ON email_automation.notification_recipients;
CREATE POLICY service_role_notification_recipients ON email_automation.notification_recipients
  FOR ALL TO service_role USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS service_role_notification_subscriptions ON email_automation.notification_subscriptions;
CREATE POLICY service_role_notification_subscriptions ON email_automation.notification_subscriptions
  FOR ALL TO service_role USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS service_role_configuration_audit ON email_automation.configuration_audit;
CREATE POLICY service_role_configuration_audit ON email_automation.configuration_audit
  FOR ALL TO service_role USING (true) WITH CHECK (true);

GRANT SELECT ON email_automation.notification_recipients TO n8n_email_automation;
GRANT SELECT ON email_automation.notification_subscriptions TO n8n_email_automation;
GRANT SELECT ON email_automation.configuration_audit TO n8n_email_automation;

INSERT INTO email_automation.notification_recipients (tenant_id, recipient_key, display_label)
VALUES ('tvg', 'founder', 'Founder')
ON CONFLICT (tenant_id, recipient_key) DO NOTHING;

INSERT INTO email_automation.notification_subscriptions (
  tenant_id, recipient_key, channel, event_kind, destination_ref, enabled, escalation_after
) VALUES
  ('tvg', 'founder', 'internal_sms', 'actionable_inbound', 'founder_mobile_ref', false, NULL),
  ('tvg', 'founder', 'internal_sms', 'hold_alert', 'founder_mobile_ref', false, NULL),
  ('tvg', 'founder', 'internal_sms', 'error_alert', 'founder_mobile_ref', false, NULL),
  ('tvg', 'founder', 'internal_sms', 'storm_summary', 'founder_mobile_ref', false, NULL),
  ('tvg', 'founder', 'internal_sms', 'backlog_summary', 'founder_mobile_ref', false, NULL),
  ('tvg', 'founder', 'internal_sms', 'health_outage', 'founder_mobile_ref', false, NULL),
  ('tvg', 'founder', 'internal_sms', 'health_recovery', 'founder_mobile_ref', false, NULL)
ON CONFLICT (tenant_id, recipient_key, channel, event_kind) DO NOTHING;

INSERT INTO email_automation.automation_settings (tenant_id, key, value_json, description) VALUES
  ('tvg', 'notification_recipient_model', '"founder_internal_sms_only"'::jsonb,
   'Pass 1 recipient model. One Founder destination until the Founder authorizes more recipients.'),
  ('tvg', 'after_hours_ack_enabled', 'false'::jsonb,
   'After-hours customer acknowledgement stays disabled. This is not permission to set auto_send_enabled.')
ON CONFLICT (tenant_id, key) DO NOTHING;

ALTER TABLE email_automation.notification_subscriptions
  DROP CONSTRAINT IF EXISTS notification_subscriptions_single_founder_destination;
ALTER TABLE email_automation.notification_subscriptions
  ADD CONSTRAINT notification_subscriptions_single_founder_destination
  CHECK (destination_ref = 'founder_mobile_ref');

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM email_automation.notification_subscriptions
    WHERE tenant_id = 'tvg' AND escalation_after IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'Pass 1 subscription must not store an escalation cadence';
  END IF;
  IF EXISTS (
    SELECT 1 FROM email_automation.notification_recipients
    WHERE tenant_id = 'tvg' AND recipient_key IS DISTINCT FROM 'founder'
  ) THEN
    RAISE EXCEPTION 'Pass 1 recipient must stay founder';
  END IF;
  IF EXISTS (
    SELECT 1 FROM email_automation.notification_subscriptions
    WHERE tenant_id = 'tvg' AND destination_ref IS DISTINCT FROM 'founder_mobile_ref'
  ) THEN
    RAISE EXCEPTION 'Pass 1 has one Founder destination';
  END IF;
  IF (
    SELECT value_json FROM email_automation.automation_settings
    WHERE tenant_id = 'tvg' AND key = 'after_hours_ack_enabled'
  ) IS DISTINCT FROM 'false'::jsonb THEN
    RAISE EXCEPTION 'after-hours acknowledgement must stay disabled';
  END IF;
  IF (
    SELECT value_json FROM email_automation.automation_settings
    WHERE tenant_id = 'tvg' AND key = 'auto_send_enabled'
  ) IS DISTINCT FROM 'false'::jsonb THEN
    RAISE EXCEPTION 'after-hours acknowledgement disabled is not auto-send permission';
  END IF;
END $$;

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

-- =============================================================================
-- TVG Email Pass 1 — Founder-locked internal SMS amendment (2026-09-24)
-- STAGING ONLY / HOSTINGER OFF / NO CUSTOMER SMS
--
-- Model: notification event → notification service → delivery channel.
-- Pass 1 channel is internal SMS. The notification_log row is the record.
-- SMS transport is not the system of record.
-- No phone numbers, Twilio keys, or other secrets are stored here.
-- =============================================================================

-- New labels are not inserted in this transaction. PostgreSQL can add them
-- here and only use them after commit.
ALTER TYPE email_automation.notification_kind ADD VALUE IF NOT EXISTS 'actionable_inbound';
ALTER TYPE email_automation.notification_kind ADD VALUE IF NOT EXISTS 'storm_summary';

ALTER TABLE email_automation.notification_log
  ADD COLUMN IF NOT EXISTS notification_kind text,
  ADD COLUMN IF NOT EXISTS channel text,
  ADD COLUMN IF NOT EXISTS attempted_at timestamptz,
  ADD COLUMN IF NOT EXISTS provider_message_id text,
  ADD COLUMN IF NOT EXISTS delivery_state text,
  ADD COLUMN IF NOT EXISTS suppression_state text,
  ADD COLUMN IF NOT EXISTS suppression_reason text,
  ADD COLUMN IF NOT EXISTS suppression_window text;

UPDATE email_automation.notification_log
SET notification_kind = kind::text
WHERE notification_kind IS NULL OR btrim(notification_kind) = '';

UPDATE email_automation.notification_log
SET channel = 'unset'
WHERE channel IS NULL OR btrim(channel) = '';

UPDATE email_automation.notification_log
SET delivery_state = COALESCE(NULLIF(btrim(status), ''), 'recorded')
WHERE delivery_state IS NULL OR btrim(delivery_state) = '';

UPDATE email_automation.notification_log
SET attempted_at = COALESCE(sent_at, created_at, now())
WHERE attempted_at IS NULL;

ALTER TABLE email_automation.notification_log
  ALTER COLUMN notification_kind SET NOT NULL,
  ALTER COLUMN channel SET NOT NULL,
  ALTER COLUMN channel SET DEFAULT 'unset',
  ALTER COLUMN delivery_state SET NOT NULL,
  ALTER COLUMN delivery_state SET DEFAULT 'recorded',
  ALTER COLUMN attempted_at SET NOT NULL,
  ALTER COLUMN attempted_at SET DEFAULT now();

ALTER TABLE email_automation.notification_log
  DROP CONSTRAINT IF EXISTS notification_log_no_customer_sms;
ALTER TABLE email_automation.notification_log
  ADD CONSTRAINT notification_log_no_customer_sms
  CHECK (channel IS DISTINCT FROM 'customer_sms');

COMMENT ON TABLE email_automation.notification_log IS
  'Notification audit for the channel-independent path: notification event, then notification service, then delivery channel. Pass 1 channel is internal_sms. SMS transport is not the system of record. destination_ref is a label, never a phone number.';

COMMENT ON COLUMN email_automation.notification_log.notification_kind IS
  'Canonical kind for dedup. Unique with email_event_id. SMS transport is not SoR.';
COMMENT ON COLUMN email_automation.notification_log.channel IS
  'Delivery channel. Pass 1 uses internal_sms. Future crm_push can be added without rewriting intake.';
COMMENT ON COLUMN email_automation.notification_log.provider_message_id IS
  'Provider reference after a real send. Empty in this staging import.';
COMMENT ON COLUMN email_automation.notification_log.delivery_state IS
  'recorded, recorded_not_sent, queued, attempted, sent, delivered, failed, suppressed.';
COMMENT ON COLUMN email_automation.notification_log.suppression_reason IS
  'Why an event was not handed to the channel. Suppression still keeps the row.';

CREATE OR REPLACE FUNCTION email_automation.notification_log_before_write()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.tenant_id IS NULL THEN
    NEW.tenant_id := 'tvg';
  END IF;
  IF NEW.notification_kind IS NULL OR btrim(NEW.notification_kind) = '' THEN
    NEW.notification_kind := NEW.kind::text;
  END IF;
  IF NEW.channel IS NULL OR btrim(NEW.channel) = '' THEN
    NEW.channel := 'unset';
  END IF;
  IF NEW.channel = 'customer_sms' THEN
    RAISE EXCEPTION 'customer SMS is outside Pass 1';
  END IF;
  IF NEW.notification_kind IS DISTINCT FROM NEW.kind::text THEN
    RAISE EXCEPTION 'notification_kind must equal kind';
  END IF;
  IF NEW.channel = 'internal_sms'
     AND NEW.destination_ref !~ '^[a-z][a-z0-9_]{0,63}$' THEN
    RAISE EXCEPTION 'internal SMS destination_ref must be the Founder-approved settings label';
  END IF;
  IF NEW.attempted_at IS NULL THEN
    NEW.attempted_at := now();
  END IF;
  IF NEW.delivery_state IS NULL OR btrim(NEW.delivery_state) = '' THEN
    NEW.delivery_state := 'recorded';
  END IF;
  RETURN NEW;
END;
$$;

ALTER FUNCTION email_automation.notification_log_before_write()
  SET search_path = email_automation, pg_temp;

DROP TRIGGER IF EXISTS trg_notification_log_before_write ON email_automation.notification_log;
CREATE TRIGGER trg_notification_log_before_write
  BEFORE INSERT OR UPDATE ON email_automation.notification_log
  FOR EACH ROW EXECUTE FUNCTION email_automation.notification_log_before_write();

CREATE UNIQUE INDEX IF NOT EXISTS uq_notification_log_event_kind
  ON email_automation.notification_log (tenant_id, email_event_id, notification_kind)
  WHERE email_event_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_notification_log_storm_window
  ON email_automation.notification_log (tenant_id, channel, suppression_window, notification_kind)
  WHERE notification_kind = 'storm_summary';

INSERT INTO email_automation.automation_settings (tenant_id, key, value_json, description) VALUES
  ('tvg', 'max_internal_sms_per_hour', '10'::jsonb,
   'Per UTC hour. Ordinary actionable_inbound at this count becomes suppress-with-log plus one storm summary. HOLD/error still send as one prioritized SMS each until their own count hits this number, then suppress-with-log. Default 10.'),
  ('tvg', 'internal_sms_enabled', 'false'::jsonb,
   'Internal SMS channel switch. Stays false until Founder approves a dedicated credential and carrier readiness.'),
  ('tvg', 'internal_sms_destination_ref', '"founder_mobile_ref"'::jsonb,
   'Label for the Founder-approved mobile. Not the phone number. The number stays in n8n credentials.')
ON CONFLICT (tenant_id, key) DO NOTHING;

UPDATE email_automation.automation_settings
SET description = 'Per UTC hour. Ordinary actionable_inbound at this count becomes suppress-with-log plus one storm summary. HOLD/error still send as one prioritized SMS each until their own count hits this number, then suppress-with-log. Default 10.'
WHERE tenant_id = 'tvg' AND key = 'max_internal_sms_per_hour';

-- =============================================================================
-- TVG Email Pass 1 — consolidated staging directive (2026-09-24)
-- STAGING ONLY / HOSTINGER OFF / NO CUSTOMER SMS / NO LEAD CREATE
-- Apply only after the base pack. Idempotent.
-- =============================================================================

ALTER TYPE email_automation.notification_kind ADD VALUE IF NOT EXISTS 'backlog_summary';
ALTER TYPE email_automation.notification_kind ADD VALUE IF NOT EXISTS 'health_outage';
ALTER TYPE email_automation.notification_kind ADD VALUE IF NOT EXISTS 'health_recovery';

ALTER TABLE email_automation.notification_log
  ADD COLUMN IF NOT EXISTS dispatch_after timestamptz,
  ADD COLUMN IF NOT EXISTS dispatched_at timestamptz,
  ADD COLUMN IF NOT EXISTS dispatch_attempt_count integer NOT NULL DEFAULT 0;

COMMENT ON TABLE email_automation.notification_log IS
  'Durable notification outbox. Worker writes intent. The inactive dispatcher delivers. SMS transport is not the system of record.';
COMMENT ON COLUMN email_automation.notification_log.dispatch_after IS
  'Outbox visibility time. Dispatcher may claim queued rows once this instant has passed.';
COMMENT ON COLUMN email_automation.notification_log.dispatched_at IS
  'When a dispatcher attempt handed the row to the channel. Empty while the credential is not approved.';

CREATE OR REPLACE FUNCTION email_automation.notification_log_before_write()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.tenant_id IS NULL THEN
    NEW.tenant_id := 'tvg';
  END IF;
  IF NEW.notification_kind IS NULL OR btrim(NEW.notification_kind) = '' THEN
    NEW.notification_kind := NEW.kind::text;
  END IF;
  IF NEW.channel IS NULL OR btrim(NEW.channel) = '' THEN
    NEW.channel := 'unset';
  END IF;
  IF NEW.channel = 'customer_sms' THEN
    RAISE EXCEPTION 'customer SMS is outside Pass 1';
  END IF;
  IF NEW.notification_kind IS DISTINCT FROM NEW.kind::text THEN
    RAISE EXCEPTION 'notification_kind must equal kind';
  END IF;
  IF NEW.channel = 'internal_sms'
     AND NEW.destination_ref !~ '^[a-z][a-z0-9_]{0,63}$' THEN
    RAISE EXCEPTION 'internal SMS destination_ref must be the Founder-approved settings label';
  END IF;
  IF NEW.attempted_at IS NULL THEN
    NEW.attempted_at := now();
  END IF;
  IF NEW.delivery_state IS NULL OR btrim(NEW.delivery_state) = '' THEN
    NEW.delivery_state := 'recorded';
  END IF;
  IF NEW.delivery_state = 'queued' AND NEW.dispatch_after IS NULL THEN
    NEW.dispatch_after := NEW.attempted_at;
  END IF;
  IF NEW.dispatch_attempt_count IS NULL THEN
    NEW.dispatch_attempt_count := 0;
  END IF;
  RETURN NEW;
END;
$$;

ALTER FUNCTION email_automation.notification_log_before_write()
  SET search_path = email_automation, pg_temp;

DROP TRIGGER IF EXISTS trg_notification_log_before_write ON email_automation.notification_log;
CREATE TRIGGER trg_notification_log_before_write
  BEFORE INSERT OR UPDATE ON email_automation.notification_log
  FOR EACH ROW EXECUTE FUNCTION email_automation.notification_log_before_write();

CREATE UNIQUE INDEX IF NOT EXISTS uq_notification_log_backlog_summary
  ON email_automation.notification_log (tenant_id, channel, notification_kind)
  WHERE notification_kind = 'backlog_summary';

CREATE UNIQUE INDEX IF NOT EXISTS uq_notification_log_health_outage
  ON email_automation.notification_log (tenant_id, suppression_window)
  WHERE notification_kind = 'health_outage';

CREATE UNIQUE INDEX IF NOT EXISTS uq_notification_log_health_recovery
  ON email_automation.notification_log (tenant_id, suppression_window)
  WHERE notification_kind = 'health_recovery';

ALTER TABLE email_automation.email_events
  ADD COLUMN IF NOT EXISTS in_reply_to text,
  ADD COLUMN IF NOT EXISTS references_header text;

COMMENT ON COLUMN email_automation.email_events.in_reply_to IS
  'Captured In-Reply-To header. Metadata only. Pass 1 does not thread or match a parent.';
COMMENT ON COLUMN email_automation.email_events.references_header IS
  'Captured References header. Metadata only. Pass 1 does not thread or match a parent.';
COMMENT ON COLUMN email_automation.email_events.attachment_meta IS
  'Metadata only: filename, content_type, size_bytes, attachment_id. No bytes. No full MIME.';
COMMENT ON COLUMN email_automation.email_events.body_text_excerpt IS
  'Capped excerpt. Not a retained full body. Retention of excerpts is deferred.';

CREATE OR REPLACE FUNCTION email_automation.attachment_meta_metadata_only(meta jsonb)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN meta IS NULL THEN true
    WHEN jsonb_typeof(meta) IS DISTINCT FROM 'array' THEN false
    ELSE NOT EXISTS (
      SELECT 1
      FROM jsonb_array_elements(meta) AS elem
      WHERE CASE
        WHEN jsonb_typeof(elem) IS DISTINCT FROM 'object' THEN true
        ELSE elem ?| ARRAY['bytes','content','data','body','base64','payload','mime']
      END
    )
  END;
$$;

ALTER FUNCTION email_automation.attachment_meta_metadata_only(jsonb)
  SET search_path = email_automation, pg_temp;

ALTER TABLE email_automation.email_events
  DROP CONSTRAINT IF EXISTS email_events_excerpt_cap;
ALTER TABLE email_automation.email_events
  ADD CONSTRAINT email_events_excerpt_cap CHECK (
    (body_text_excerpt IS NULL OR length(body_text_excerpt) <= 500)
    AND (body_html_excerpt IS NULL OR length(body_html_excerpt) <= 500)
    AND (in_reply_to IS NULL OR length(in_reply_to) <= 2000)
    AND (references_header IS NULL OR length(references_header) <= 2000)
  );

ALTER TABLE email_automation.email_events
  DROP CONSTRAINT IF EXISTS email_events_attachment_metadata_only;
ALTER TABLE email_automation.email_events
  ADD CONSTRAINT email_events_attachment_metadata_only
  CHECK (email_automation.attachment_meta_metadata_only(attachment_meta));

CREATE TABLE IF NOT EXISTS email_automation.health_checks (
  tenant_id text NOT NULL DEFAULT 'tvg',
  component text NOT NULL,
  last_successful_health_at timestamptz,
  last_checked_at timestamptz NOT NULL DEFAULT now(),
  status text NOT NULL DEFAULT 'unstarted',
  open_incident_key text,
  detail text,
  CONSTRAINT health_checks_tenant_tvg CHECK (tenant_id = 'tvg'),
  CONSTRAINT health_checks_component_label CHECK (component ~ '^[a-z_]{1,40}$'),
  PRIMARY KEY (tenant_id, component)
);

COMMENT ON TABLE email_automation.health_checks IS
  'Pipeline heartbeat. A quiet inbox is not a fault. One open outage key, then one recovery.';
COMMENT ON COLUMN email_automation.health_checks.last_successful_health_at IS
  'Last time the check itself succeeded. Empty inbox still updates this. Mail volume does not.';

ALTER TABLE email_automation.health_checks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS n8n_health_checks_tvg ON email_automation.health_checks;
CREATE POLICY n8n_health_checks_tvg ON email_automation.health_checks
  FOR ALL TO n8n_email_automation
  USING (tenant_id = 'tvg') WITH CHECK (tenant_id = 'tvg');
DROP POLICY IF EXISTS service_role_health_checks ON email_automation.health_checks;
CREATE POLICY service_role_health_checks ON email_automation.health_checks
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);
GRANT SELECT, INSERT, UPDATE ON email_automation.health_checks TO n8n_email_automation;

INSERT INTO email_automation.health_checks (tenant_id, component, status)
VALUES
  ('tvg', 'primary_path', 'unstarted'),
  ('tvg', 'reconcile', 'unstarted')
ON CONFLICT (tenant_id, component) DO NOTHING;

INSERT INTO email_automation.automation_settings (tenant_id, key, value_json, description) VALUES
  ('tvg', 'live_notification_started_at', 'null'::jsonb,
   'Watermark. Null means pre-live: ingest is allowed and per-message SMS is not. At most one backlog summary.'),
  ('tvg', 'health_alerts_enabled', 'false'::jsonb,
   'Heartbeat alerts stay off until a Founder-approved staging check is turned on. Quiet inbox is not a fault.'),
  ('tvg', 'primary_path_target_seconds', '120'::jsonb,
   'Webhook received to dispatcher handoff target. 120 seconds. No quiet hours.'),
  ('tvg', 'reconcile_target_seconds', '900'::jsonb,
   'Reconcile cycle target. 900 seconds. Schedule stays inactive until Pre-webhook opens.'),
  ('tvg', 'notification_quiet_hours', 'null'::jsonb,
   'No application quiet hours. Pass 1 notification timing is 24/7.')
ON CONFLICT (tenant_id, key) DO NOTHING;

DO $$
DECLARE
  watermark jsonb;
  health_on jsonb;
  primary_target jsonb;
  reconcile_target jsonb;
  quiet jsonb;
BEGIN
  SELECT value_json INTO watermark
  FROM email_automation.automation_settings
  WHERE tenant_id = 'tvg' AND key = 'live_notification_started_at';
  IF watermark IS DISTINCT FROM 'null'::jsonb THEN
    RAISE EXCEPTION 'live_notification_started_at must stay null until Founder sets the watermark';
  END IF;

  SELECT value_json INTO health_on
  FROM email_automation.automation_settings
  WHERE tenant_id = 'tvg' AND key = 'health_alerts_enabled';
  IF health_on IS DISTINCT FROM 'false'::jsonb THEN
    RAISE EXCEPTION 'health_alerts_enabled must stay false in this import';
  END IF;

  SELECT value_json INTO primary_target
  FROM email_automation.automation_settings
  WHERE tenant_id = 'tvg' AND key = 'primary_path_target_seconds';
  IF primary_target IS DISTINCT FROM '120'::jsonb THEN
    RAISE EXCEPTION 'primary_path_target_seconds must be 120';
  END IF;

  SELECT value_json INTO reconcile_target
  FROM email_automation.automation_settings
  WHERE tenant_id = 'tvg' AND key = 'reconcile_target_seconds';
  IF reconcile_target IS DISTINCT FROM '900'::jsonb THEN
    RAISE EXCEPTION 'reconcile_target_seconds must be 900';
  END IF;

  SELECT value_json INTO quiet
  FROM email_automation.automation_settings
  WHERE tenant_id = 'tvg' AND key = 'notification_quiet_hours';
  IF quiet IS DISTINCT FROM 'null'::jsonb THEN
    RAISE EXCEPTION 'notification_quiet_hours must stay null';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'email_automation'
      AND table_name = 'email_events'
      AND column_name = 'in_reply_to'
  ) THEN
    RAISE EXCEPTION 'in_reply_to column missing';
  END IF;
END $$;

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

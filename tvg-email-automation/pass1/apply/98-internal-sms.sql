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

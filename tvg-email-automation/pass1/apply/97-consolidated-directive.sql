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

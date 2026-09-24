-- =============================================================================
-- TVG Email Pass 1 — stale processing → HOLD
-- STAGING ONLY / HOSTINGER OFF
-- Does not requeue. Does not send. Does not clear other HOLD reasons.
-- =============================================================================

WITH stale AS (
  UPDATE email_automation.intake_queue q
  SET status = 'held',
      hold_reason = 'stale_processing'
  WHERE q.tenant_id = 'tvg'
    AND q.status = 'processing'
    AND q.locked_at IS NOT NULL
    AND q.locked_at < now() - make_interval(mins => COALESCE((
      SELECT (s.value_json #>> '{}')::int
      FROM email_automation.automation_settings s
      WHERE s.tenant_id = 'tvg'
        AND s.key = 'stale_processing_ttl_minutes'
    ), 10))
  RETURNING q.id, q.email_event_id
),
errs AS (
  INSERT INTO email_automation.automation_errors (
    tenant_id, intake_queue_id, email_event_id, stage, error_code, error_message, retryable
  )
  SELECT
    'tvg',
    stale.id,
    stale.email_event_id,
    'reconcile',
    'stale_processing',
    'processing lease exceeded; HOLD for review; no automatic requeue into a send path',
    false
  FROM stale
  RETURNING id
),
events AS (
  UPDATE email_automation.email_events e
  SET status = 'held',
      hold_reason = 'stale_processing'
  FROM stale
  WHERE e.id = stale.email_event_id
    AND e.tenant_id = 'tvg'
    AND e.status IN ('received', 'queued', 'fetching', 'fetched')
  RETURNING e.id
),
notified AS (
  INSERT INTO email_automation.notification_log (
    tenant_id, kind, notification_kind, channel, email_event_id, destination_ref,
    payload_summary, status, delivery_state, suppression_reason, attempted_at
  )
  SELECT
    'tvg',
    'hold_alert',
    'hold_alert',
    'internal_sms',
    stale.email_event_id,
    'founder_mobile_ref',
    jsonb_build_object('status', 'held', 'hold_reason', 'stale_processing'),
    CASE WHEN sms.ok THEN 'queued' ELSE 'recorded_not_sent' END,
    CASE WHEN sms.ok THEN 'queued' ELSE 'recorded_not_sent' END,
    CASE WHEN sms.ok THEN NULL ELSE 'credential_not_approved' END,
    now()
  FROM stale
  CROSS JOIN (
    SELECT COALESCE((
      SELECT value_json = 'true'::jsonb
      FROM email_automation.automation_settings
      WHERE tenant_id = 'tvg' AND key = 'internal_sms_enabled'
    ), false) AS ok
  ) sms
  WHERE stale.email_event_id IS NOT NULL
  ON CONFLICT (tenant_id, email_event_id, notification_kind)
    WHERE email_event_id IS NOT NULL DO NOTHING
  RETURNING id
)
SELECT
  (SELECT count(*) FROM stale) AS held_queue_rows,
  (SELECT count(*) FROM errs) AS error_rows,
  (SELECT count(*) FROM events) AS held_event_rows,
  (SELECT count(*) FROM notified) AS notification_rows;

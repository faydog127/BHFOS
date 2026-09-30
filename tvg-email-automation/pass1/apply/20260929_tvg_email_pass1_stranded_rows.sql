-- =============================================================================
-- NOT APPLIED. Read-only observation query. Not a migration. Not imported by n8n.
-- Staging controlled-live window only. Run it at each window checkpoint.
-- Manual operator observation. This query does not notify, alert, or send.
-- Includes held, error, stale processing, and aged pending rows, including
-- rows whose email_event_id is NULL.
-- =============================================================================

SELECT
  q.id,
  q.status,
  q.hold_reason,
  q.resolution_status,
  q.uid,
  q.email_event_id,
  q.locked_at,
  q.locked_by,
  q.created_at,
  q.next_attempt_at,
  q.webhook_event_id
FROM email_automation.intake_queue q
WHERE q.tenant_id = 'tvg'
  AND (
    q.status IN ('held', 'error')
    OR (
      q.status = 'processing'
      AND q.locked_at < now() - make_interval(mins => COALESCE((
        SELECT (s.value_json #>> '{}')::int
        FROM email_automation.automation_settings s
        WHERE s.tenant_id = 'tvg'
          AND s.key = 'stale_processing_ttl_minutes'
      ), 10))
    )
    OR (
      q.status = 'pending'
      AND q.next_attempt_at IS NULL
      AND q.created_at < now() - interval '10 minutes'
    )
  )
ORDER BY q.hold_reason NULLS LAST, q.status, q.created_at;

-- =============================================================================
-- NOT APPLIED. Manual re-resolve template. One row. CC approval card per use.
-- Not a workflow. Nothing in n8n can trigger this statement.
-- attempt_count is left cumulative. resolve_attempts restarts at 0 for the new cycle.
-- Refuses message_id_missing and the other human-decision holds via the WHERE clause.
-- Replace the queue id literal before running. Do not run this file as a migration.
-- =============================================================================

UPDATE email_automation.intake_queue q
   SET status = 'pending',
       resolve_attempts = 0,
       next_attempt_at = NULL,
       hold_reason = NULL,
       locked_at = NULL,
       locked_by = NULL,
       hostinger_pointers = COALESCE(q.hostinger_pointers, '{}'::jsonb)
         || jsonb_build_object(
              'resolution',
              COALESCE(q.hostinger_pointers->'resolution', '{}'::jsonb)
                || jsonb_build_object(
                     'manual_resets',
                     COALESCE((q.hostinger_pointers->'resolution'->>'manual_resets')::int, 0) + 1
                   )
            )
 WHERE q.id = '00000000-0000-4000-8000-000000000000'::uuid
   AND q.tenant_id = 'tvg'
   AND q.resolution_status = 'unresolved'
   AND q.webhook_message_id IS NOT NULL
   AND q.status IN ('held', 'error')
   AND (
     q.hold_reason IN ('pointer_not_found', 'hostinger_rate_limited')
     OR q.last_error ~ '^(hostinger_timeout|hostinger_upstream_error)'
   )
RETURNING q.id, q.status, q.resolve_attempts, q.attempt_count;

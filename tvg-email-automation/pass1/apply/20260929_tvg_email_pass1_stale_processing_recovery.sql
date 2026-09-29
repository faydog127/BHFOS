-- =============================================================================
-- NOT APPLIED. Not a migration. Not imported by n8n. Not an automatic requeue.
-- Staging only (glkrykpksbsqmmilmjhs). One row. No bulk form. No customer send.
-- Separate controlled-live action card required before any execution.
-- Replace the three OPERATOR literals (queue id, actor, reason) first.
-- The placeholder id is refused. Capture the proof SELECT in the action card.
-- Leaves resolve_attempts and attempt_count unchanged. Does not touch uid.
-- Clears hold_reason only after the WHERE has matched stale_processing.
-- Reconcile's schedule node stays disabled and that workflow stays inactive.
-- =============================================================================

BEGIN;

SET LOCAL lock_timeout = '5s';

CREATE TEMP TABLE tvg_stale_recovery_proof (
  intake_queue_id uuid,
  status text,
  uid bigint,
  resolution_status text,
  locked_at timestamptz,
  locked_by text,
  actor text,
  reason text,
  acted_at timestamptz
) ON COMMIT DROP;

DO $recovery$
DECLARE
  queue_id uuid := '00000000-0000-4000-8000-000000000000';
  actor text := 'REPLACE_ACTOR';
  reason text := 'REPLACE_REASON';
  updated_id uuid;
BEGIN
  IF current_setting('tvg_email_pass1.target_project', true)
     IS DISTINCT FROM 'glkrykpksbsqmmilmjhs' THEN
    RAISE EXCEPTION 'refusing stale_processing recovery without the staging project latch';
  END IF;
  IF queue_id = '00000000-0000-4000-8000-000000000000'::uuid
     OR actor IS NULL OR btrim(actor) = '' OR actor = 'REPLACE_ACTOR'
     OR reason IS NULL OR btrim(reason) = '' OR reason = 'REPLACE_REASON' THEN
    RAISE EXCEPTION 'exact queue-row id, actor, and reason are required; placeholder refused';
  END IF;

  UPDATE email_automation.intake_queue q
     SET status = 'pending',
         hold_reason = NULL,
         locked_at = NULL,
         locked_by = NULL
   WHERE q.tenant_id = 'tvg'
     AND q.id = queue_id
     AND q.status = 'held'
     AND q.hold_reason = 'stale_processing'
     AND q.resolution_status = 'unresolved'
     AND q.uid IS NULL
  RETURNING q.id INTO updated_id;

  IF updated_id IS NULL THEN
    RAISE EXCEPTION 'stale_processing recovery matched no row; transaction rolled back';
  END IF;

  INSERT INTO email_automation.automation_errors (
    tenant_id, intake_queue_id, email_event_id, stage, error_code, error_message, context_json, retryable
  ) VALUES (
    'tvg',
    updated_id,
    NULL,
    'operator',
    'stale_processing_return_to_pending',
    'one-row operator return of a stale_processing unresolved row to pending; no customer send',
    jsonb_build_object(
      'actor', actor,
      'reason', reason,
      'action', 'stale_processing_to_pending'
    ),
    false
  );

  INSERT INTO tvg_stale_recovery_proof (
    intake_queue_id, status, uid, resolution_status, locked_at, locked_by, actor, reason, acted_at
  )
  SELECT q.id, q.status, q.uid, q.resolution_status, q.locked_at, q.locked_by, actor, reason, now()
  FROM email_automation.intake_queue q
  WHERE q.id = updated_id;
END
$recovery$;

SELECT intake_queue_id, status, uid, resolution_status, locked_at, locked_by, actor, reason, acted_at
  FROM tvg_stale_recovery_proof;

COMMIT;

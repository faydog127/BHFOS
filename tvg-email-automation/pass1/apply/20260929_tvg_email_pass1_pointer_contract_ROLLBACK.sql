-- =============================================================================
-- NOT APPLIED. Files only. Rollback for 20260929_tvg_email_pass1_pointer_contract.sql.
-- STAGING ONLY. One atomic transaction.
-- ACCESS EXCLUSIVE on intake_queue is taken BEFORE the NULL-uid check and held
-- until the transaction ends. automation_settings is locked before the settings delete.
-- Refuses to run while any row has uid IS NULL (an unresolved pointer would be lost or
-- violate NOT NULL). Export those rows, then resolve or delete them by explicit CC action.
-- =============================================================================

BEGIN;

DO $$
BEGIN
  IF current_setting('tvg_email_pass1.target_project', true)
     IS DISTINCT FROM 'glkrykpksbsqmmilmjhs' THEN
    RAISE EXCEPTION 'refusing rollback without the staging project latch';
  END IF;
END $$;

LOCK TABLE email_automation.intake_queue IN ACCESS EXCLUSIVE MODE;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM email_automation.intake_queue WHERE uid IS NULL) THEN
    RAISE EXCEPTION 'rollback refused: rows with NULL uid exist; export them and resolve or delete by explicit CC action first';
  END IF;
END $$;

DROP FUNCTION IF EXISTS email_automation.resolve_intake_uid(uuid, bigint, int, int);
DROP INDEX IF EXISTS email_automation.idx_intake_queue_next_attempt;
DROP INDEX IF EXISTS email_automation.uq_intake_queue_webhook_event;

ALTER TABLE email_automation.intake_queue
  DROP CONSTRAINT IF EXISTS intake_queue_resolve_attempts_nonneg,
  DROP CONSTRAINT IF EXISTS intake_queue_unresolved_iff_no_uid,
  DROP CONSTRAINT IF EXISTS intake_queue_identity_present,
  DROP CONSTRAINT IF EXISTS intake_queue_resolution_status_chk;

ALTER TABLE email_automation.intake_queue
  DROP COLUMN IF EXISTS next_attempt_at,
  DROP COLUMN IF EXISTS resolve_attempts,
  DROP COLUMN IF EXISTS resolved_at,
  DROP COLUMN IF EXISTS resolution_status,
  DROP COLUMN IF EXISTS webhook_message_id,
  DROP COLUMN IF EXISTS webhook_event_at,
  DROP COLUMN IF EXISTS webhook_envelope_id,
  DROP COLUMN IF EXISTS webhook_event_id;

ALTER TABLE email_automation.intake_queue ALTER COLUMN uid SET NOT NULL;

COMMENT ON COLUMN email_automation.intake_queue.uid IS
  'Hostinger message UID as bigint. Locator only, not durable identity.';

LOCK TABLE email_automation.automation_settings IN ACCESS EXCLUSIVE MODE;

DELETE FROM email_automation.automation_settings
 WHERE tenant_id = 'tvg'
   AND key IN ('hostinger_mailbox_map','resolve_max_pages','resolve_lookback_hours',
               'resolve_max_attempts','resolve_backoff_minutes','resolve_429_max_consumed');

COMMIT;

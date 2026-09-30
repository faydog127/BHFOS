-- =============================================================================
-- NOT APPLIED by this file. Incremental staging compatibility for the pointer
-- contract on top of migration 20260927154647.
-- STAGING ONLY (glkrykpksbsqmmilmjhs). One atomic transaction. Re-runnable.
-- Replaces intake_queue_pointer_or_webhook_identity. Does not add columns,
-- indexes, settings, or notification behavior. Does not change Fast ACK SQL.
-- The event-identity column is webhook_event_id (created by the 20260929
-- pointer-contract migration, indexed by uq_intake_queue_webhook_event).
-- webhook_message_id is the 20260927 Message-ID and may be NULL.
-- A validated CHECK is used. NOT VALID is not used: every row that can exist
-- after 20260927 and 20260929 already satisfies the replacement, and a
-- violating row aborts the transaction before the old constraint is dropped.
-- =============================================================================

BEGIN;

-- Lock timeout aborts the whole transaction. A timeout is not a partial apply.
SET LOCAL lock_timeout = '5s';

DO $$
BEGIN
  IF current_setting('tvg_email_pass1.target_project', true)
     IS DISTINCT FROM 'glkrykpksbsqmmilmjhs' THEN
    RAISE EXCEPTION 'refusing pointer identity compat without the staging project latch';
  END IF;
  IF to_regclass('email_automation.intake_queue') IS NULL THEN
    RAISE EXCEPTION 'base pass1 pack is not present';
  END IF;
  IF NOT EXISTS (
    SELECT 1
    FROM pg_attribute
    WHERE attrelid = 'email_automation.intake_queue'::regclass
      AND attname = 'webhook_event_id'
      AND NOT attisdropped
  ) THEN
    RAISE EXCEPTION 'compat refused: webhook_event_id is absent; apply the pointer-contract migration first';
  END IF;
  IF EXISTS (
    SELECT 1
    FROM email_automation.intake_queue
    WHERE NOT (
      (uid IS NOT NULL AND folder IS NOT NULL)
      OR (uid IS NULL AND webhook_event_id IS NOT NULL)
    )
  ) THEN
    RAISE EXCEPTION 'compat refused: existing intake_queue rows would violate the replacement check';
  END IF;
END $$;

LOCK TABLE email_automation.intake_queue IN ACCESS EXCLUSIVE MODE;

ALTER TABLE email_automation.intake_queue
  DROP CONSTRAINT IF EXISTS intake_queue_pointer_or_webhook_identity;

ALTER TABLE email_automation.intake_queue
  ADD CONSTRAINT intake_queue_pointer_or_webhook_identity
  CHECK (
    (uid IS NOT NULL AND folder IS NOT NULL)
    OR (uid IS NULL AND webhook_event_id IS NOT NULL)
  );

COMMIT;

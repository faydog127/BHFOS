-- =============================================================================
-- RECORD of staging migration 20260927154647 (tvg_hostinger_webhook_identity_20260927).
-- Already applied on glkrykpksbsqmmilmjhs. This file is the verbatim statement
-- from that migration, kept so tests and the pointer-contract rollback can
-- reproduce the post-20260927 schema. Do not apply it again on staging.
-- =============================================================================

BEGIN;

ALTER TABLE email_automation.intake_queue
  ADD COLUMN IF NOT EXISTS webhook_message_id text;

ALTER TABLE email_automation.intake_queue
  ALTER COLUMN folder DROP NOT NULL,
  ALTER COLUMN uid DROP NOT NULL;

DO $constraint$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'email_automation.intake_queue'::regclass
      AND conname = 'intake_queue_pointer_or_webhook_identity'
  ) THEN
    ALTER TABLE email_automation.intake_queue
      ADD CONSTRAINT intake_queue_pointer_or_webhook_identity
      CHECK (
        (folder IS NULL) = (uid IS NULL)
        AND (folder IS NOT NULL OR webhook_message_id IS NOT NULL)
      );
  END IF;
END
$constraint$;

CREATE UNIQUE INDEX IF NOT EXISTS uq_intake_queue_webhook_message
  ON email_automation.intake_queue (tenant_id, mailbox, webhook_message_id)
  WHERE webhook_message_id IS NOT NULL;

COMMENT ON COLUMN email_automation.intake_queue.webhook_message_id IS
  'Exact RFC Message-ID from an authenticated webhook, before folder/UID resolution. '
  'Not a Hostinger API pointer. Worker resolves and verifies one match before content fetch.';

COMMIT;

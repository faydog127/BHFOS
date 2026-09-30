-- =============================================================================
-- NOT APPLIED. Files only. No Supabase connection is made by this file.
-- TVG Email Pass 1: pointer-contract migration.
-- STAGING ONLY (glkrykpksbsqmmilmjhs). Additive except: intake_queue.uid becomes nullable.
-- One atomic transaction. Re-runnable. Does not write public.*, customer-send tables, or any secret.
-- The hostinger_mailbox_map seed is EMPTY ({}). CC seeds the real value in the live-window
-- runbook under a separate approval card. Empty map => Fast ACK returns 422 (fail closed).
-- attempt_count stays cumulative and is NOT capped. Resolution-cycle authority is resolve_attempts.
-- CC addendum 2026-09-29: do not enforce attempt_count <= 10.
-- =============================================================================

BEGIN;

-- Lock timeout aborts the whole transaction. A timeout is not a partial apply.
SET LOCAL lock_timeout = '5s';

DO $$
BEGIN
  IF current_setting('tvg_email_pass1.target_project', true)
     IS DISTINCT FROM 'glkrykpksbsqmmilmjhs' THEN
    RAISE EXCEPTION 'refusing pointer-contract migration without the staging project latch';
  END IF;
  IF to_regclass('email_automation.intake_queue') IS NULL
     OR to_regclass('email_automation.automation_settings') IS NULL THEN
    RAISE EXCEPTION 'base pass1 pack is not present';
  END IF;
  IF to_regclass('email_automation.email_responses') IS NOT NULL
     OR to_regclass('email_automation.email_send_queue') IS NOT NULL THEN
    RAISE EXCEPTION 'customer send tables must not exist';
  END IF;
END $$;

LOCK TABLE email_automation.intake_queue IN ACCESS EXCLUSIVE MODE;

-- 1) Columns. resolution_status DEFAULT is 'legacy_pointer' ON PURPOSE: every existing
--    insert path (gap-fill, smoke seeds, synthetic rows) supplies a uid and must keep
--    working unchanged. Fast ACK sets 'unresolved' explicitly.
ALTER TABLE email_automation.intake_queue
  ALTER COLUMN uid DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS webhook_event_id    text,
  ADD COLUMN IF NOT EXISTS webhook_envelope_id text,
  ADD COLUMN IF NOT EXISTS webhook_event_at    timestamptz,
  ADD COLUMN IF NOT EXISTS webhook_message_id  text,
  ADD COLUMN IF NOT EXISTS resolution_status   text NOT NULL DEFAULT 'legacy_pointer',
  ADD COLUMN IF NOT EXISTS resolved_at         timestamptz,
  ADD COLUMN IF NOT EXISTS resolve_attempts    int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS next_attempt_at     timestamptz;

-- 2) Constraints (guarded so the file can be re-run).
--    No attempt_count ceiling. resolve_attempts is the resolution-cycle counter.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'intake_queue_resolution_status_chk') THEN
    ALTER TABLE email_automation.intake_queue
      ADD CONSTRAINT intake_queue_resolution_status_chk
      CHECK (resolution_status IN ('unresolved','resolved','legacy_pointer'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'intake_queue_identity_present') THEN
    ALTER TABLE email_automation.intake_queue
      ADD CONSTRAINT intake_queue_identity_present
      CHECK (webhook_event_id IS NOT NULL OR uid IS NOT NULL);
  END IF;
  -- Exact invariant: a row is 'unresolved' if and only if it has no uid yet.
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'intake_queue_unresolved_iff_no_uid') THEN
    ALTER TABLE email_automation.intake_queue
      ADD CONSTRAINT intake_queue_unresolved_iff_no_uid
      CHECK ((resolution_status = 'unresolved') = (uid IS NULL));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'intake_queue_resolve_attempts_nonneg') THEN
    ALTER TABLE email_automation.intake_queue
      ADD CONSTRAINT intake_queue_resolve_attempts_nonneg CHECK (resolve_attempts >= 0);
  END IF;
END $$;

-- 3) Indexes. PLAIN unique indexes (no WHERE): a partial unique index cannot be the
--    arbiter of `ON CONFLICT (cols)` without repeating its predicate, and the existing
--    Worker/gap-fill/smoke SQL uses `ON CONFLICT (tenant_id, mailbox_resource_id, folder, uid)`.
--    NULLs are distinct in a unique index, so many unresolved (uid NULL) rows and many
--    legacy rows (webhook_event_id NULL) coexist. uq_intake_queue_webhook_pointer is left
--    exactly as it is in 02-email-automation-schema.sql.
CREATE UNIQUE INDEX IF NOT EXISTS uq_intake_queue_webhook_event
  ON email_automation.intake_queue (tenant_id, webhook_event_id);

CREATE INDEX IF NOT EXISTS idx_intake_queue_next_attempt
  ON email_automation.intake_queue (next_attempt_at)
  WHERE status = 'pending' AND next_attempt_at IS NOT NULL;

COMMENT ON COLUMN email_automation.intake_queue.uid IS
  'Hostinger message UID (bigint). NULL until the Worker resolves it via GET listMessages '
  '(exact Message-ID match). Locator only, not durable identity.';
COMMENT ON COLUMN email_automation.intake_queue.webhook_message_id IS
  'data.messageId as received. Locator hint only; re-verified against authoritative metadata and source.';
COMMENT ON COLUMN email_automation.intake_queue.resolve_attempts IS
  'Resolution-cycle counter. Attempts 1-5 use the 1/2/5/10/20 minute schedule. '
  'The sixth zero-match claim holds pointer_not_found. attempt_count stays cumulative and is not capped.';
COMMENT ON COLUMN email_automation.intake_queue.next_attempt_at IS
  'Claim skips a pending row while this timestamp is in the future. Stale reconcile does not touch pending rows.';

-- 4) Backfill: existing rows keep their uid and are marked legacy (they bypass resolution).
UPDATE email_automation.intake_queue
   SET resolution_status = 'legacy_pointer'
 WHERE uid IS NOT NULL AND webhook_event_id IS NULL AND resolution_status <> 'legacy_pointer';

-- 5) Resolution write with F3 handling. A unique violation on the uid pointer index
--    means another row already owns that uid: this row becomes 'duplicate' (not an error,
--    no fetch). Any other unique violation is re-raised.
CREATE OR REPLACE FUNCTION email_automation.resolve_intake_uid(
  p_id uuid, p_uid bigint, p_pages int, p_total int)
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  v_n int;
  v_constraint text;
BEGIN
  IF p_uid IS NULL OR p_uid <= 0 THEN
    RAISE EXCEPTION 'invalid uid';
  END IF;
  BEGIN
    UPDATE email_automation.intake_queue q
       SET uid = p_uid,
           resolution_status = 'resolved',
           resolved_at = now(),
           hostinger_pointers = COALESCE(q.hostinger_pointers, '{}'::jsonb)
             || jsonb_build_object('resolution', jsonb_build_object(
                  'method', 'list_mid_exact', 'pages_scanned', p_pages, 'total', p_total))
     WHERE q.id = p_id AND q.tenant_id = 'tvg'
       AND q.status = 'processing' AND q.resolution_status = 'unresolved';
    GET DIAGNOSTICS v_n = ROW_COUNT;
    IF v_n = 0 THEN
      RETURN 'not_claimed';
    END IF;
    RETURN 'resolved';
  EXCEPTION WHEN unique_violation THEN
    GET STACKED DIAGNOSTICS v_constraint = CONSTRAINT_NAME;
    IF v_constraint IS DISTINCT FROM 'uq_intake_queue_webhook_pointer' THEN
      RAISE;
    END IF;
    UPDATE email_automation.intake_queue q
       SET status = 'duplicate',
           locked_at = NULL,
           locked_by = NULL,
           hostinger_pointers = COALESCE(q.hostinger_pointers, '{}'::jsonb)
             || jsonb_build_object('resolution', jsonb_build_object(
                  'method', 'list_mid_exact', 'outcome', 'duplicate_uid',
                  'uid', p_uid, 'pages_scanned', p_pages, 'total', p_total))
     WHERE q.id = p_id AND q.tenant_id = 'tvg' AND q.status = 'processing';
    RETURN 'duplicate';
  END;
END;
$$;

COMMENT ON FUNCTION email_automation.resolve_intake_uid(uuid, bigint, int, int) IS
  'Worker resolution write. Returns resolved | duplicate | not_claimed. Unique violation on '
  'uq_intake_queue_webhook_pointer => this row is marked duplicate (no fetch, no error).';

-- Match the schema's REVOKE/GRANT posture (role guarded: it may not exist on every target).
REVOKE ALL ON FUNCTION email_automation.resolve_intake_uid(uuid, bigint, int, int) FROM PUBLIC;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'n8n_email_automation') THEN
    GRANT EXECUTE ON FUNCTION email_automation.resolve_intake_uid(uuid, bigint, int, int)
      TO n8n_email_automation;
  END IF;
END $$;

-- 6) Settings. hostinger_mailbox_map is seeded EMPTY. Everything else are the accepted defaults.
--    Hard ceilings (5 pages, 7 days) live in workflow code, not here.
--    Manual re-resolve is a separate template:
--    apply/20260929_tvg_email_pass1_manual_reresolve.sql
--    It is not executed here.
INSERT INTO email_automation.automation_settings (tenant_id, key, value_json, description) VALUES
  ('tvg', 'hostinger_mailbox_map', '{}'::jsonb,
   'Trusted mailbox address (lowercase) -> Hostinger mailbox resource id. EMPTY by default: every webhook gets 422 mailbox_not_configured. Seeded by CC in the live-window runbook, never by migration.'),
  ('tvg', 'resolve_max_pages', '3'::jsonb,
   'Max listMessages pages per resolution attempt (perPage 100). Code hard ceiling 5.'),
  ('tvg', 'resolve_lookback_hours', '48'::jsonb,
   'Stop paging when every item on a page is older than webhook_event_at minus this. Code hard ceiling 168 (7 d). Date is never a match criterion.'),
  ('tvg', 'resolve_max_attempts', '5'::jsonb,
   'Zero-match resolution claims that receive the 1/2/5/10/20 minute schedule. The sixth zero-match claim holds pointer_not_found. resolve_attempts is the cycle authority. attempt_count stays cumulative and is not capped.'),
  ('tvg', 'resolve_backoff_minutes', '[1,2,5,10,20]'::jsonb,
   'Delay before retry n (1-based). Requires a Worker schedule or a manual run to act on next_attempt_at.'),
  ('tvg', 'resolve_429_max_consumed', '2'::jsonb,
   'A 429 consumes a resolve attempt at most this many times, then HOLD hostinger_rate_limited.')
ON CONFLICT (tenant_id, key) DO NOTHING;

COMMIT;

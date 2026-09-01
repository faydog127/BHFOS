-- NOS-N8N-RECOVERABLE-DELIVERY-IMPLEMENTATION-01 local rollback.
-- ACCESS EXCLUSIVE lock order: claims then attempts.
-- Raises if attempt rows exist. Drops new RPCs/table/columns only.
-- Does not drop claims. Does not delete AC-3. Does not recreate the old claim RPC.

BEGIN;

LOCK TABLE public.network_os_command_packet_claims IN ACCESS EXCLUSIVE MODE;
LOCK TABLE public.network_os_command_packet_delivery_attempts IN ACCESS EXCLUSIVE MODE;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
      FROM public.network_os_command_packet_delivery_attempts
  ) THEN
    RAISE EXCEPTION 'network_os_command_packet_recoverable_delivery_rollback_blocked_attempts_exist'
      USING ERRCODE = 'check_violation';
  END IF;
END
$$;

DROP FUNCTION IF EXISTS public.network_os_finalize_command_packet_delivery(text, text, text, text);
DROP FUNCTION IF EXISTS public.network_os_mark_command_packet_dispatch_started(text, text);
DROP FUNCTION IF EXISTS public.network_os_lease_command_packet(text, text, text, text, text, interval);

DROP TABLE IF EXISTS public.network_os_command_packet_delivery_attempts;

ALTER TABLE public.network_os_command_packet_claims
  DROP CONSTRAINT IF EXISTS network_os_command_packet_claims_delivery_state_chk,
  DROP CONSTRAINT IF EXISTS network_os_command_packet_claims_dispatch_outcome_chk,
  DROP CONSTRAINT IF EXISTS network_os_command_packet_claims_delivered_pair_chk,
  DROP CONSTRAINT IF EXISTS network_os_command_packet_claims_retryable_no_dispatch_chk,
  DROP CONSTRAINT IF EXISTS network_os_command_packet_claims_dispatch_deadline_chk,
  DROP CONSTRAINT IF EXISTS network_os_command_packet_claims_ac3_or_recon_chk,
  DROP CONSTRAINT IF EXISTS network_os_command_packet_claims_lease_owner_chk,
  DROP CONSTRAINT IF EXISTS network_os_command_packet_claims_attempt_no_chk,
  DROP COLUMN IF EXISTS delivery_state,
  DROP COLUMN IF EXISTS lease_token,
  DROP COLUMN IF EXISTS lease_owner,
  DROP COLUMN IF EXISTS lease_acquired_at,
  DROP COLUMN IF EXISTS lease_expires_at,
  DROP COLUMN IF EXISTS dispatch_started_at,
  DROP COLUMN IF EXISTS post_dispatch_finalize_deadline_at,
  DROP COLUMN IF EXISTS dispatch_outcome,
  DROP COLUMN IF EXISTS delivered_at,
  DROP COLUMN IF EXISTS current_attempt_no;

COMMIT;

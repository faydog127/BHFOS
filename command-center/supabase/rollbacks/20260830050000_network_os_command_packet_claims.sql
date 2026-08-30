-- NOS-N8N-COMMAND-PACKET-CLAIM-CONTRACT-01 local rollback.
-- Removes only the command-packet claim table and RPC. Does not touch PR 154 objects.

BEGIN;

DROP FUNCTION IF EXISTS public.network_os_claim_command_packet(text, text, text, text);
DROP TABLE IF EXISTS public.network_os_command_packet_claims;

COMMIT;

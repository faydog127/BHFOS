-- SOURCE-ONLY rollback for NOS-N8N-EDGE-INGRESS-SPIKE-01.
-- Founder approval is required before executing this rollback against any host.

BEGIN;

DROP FUNCTION IF EXISTS public.network_os_mark_assurance_delivery_forward_result(text, text);
DROP FUNCTION IF EXISTS public.network_os_claim_assurance_delivery(text, text, bigint, bigint, bigint, text);
DROP TABLE IF EXISTS public.network_os_assurance_delivery_claims;

COMMIT;

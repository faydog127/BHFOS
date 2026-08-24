-- Down for NOS-CONVENTION-WRITE-PATH-FOUNDER-GATE-01 v2 Option A.
-- Drops only the helper and isolated intake relation.

BEGIN;

DROP TABLE IF EXISTS public.network_os_provider_interest_intake CASCADE;
DROP FUNCTION IF EXISTS public.network_os_actor_has_bhis_convention_intake();

COMMIT;

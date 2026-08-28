-- NOS-N8N-ASSURANCE-PHASE-A-01 / NOS-N8N-EDGE-INGRESS-SPIKE-01
-- SOURCE-ONLY. Founder approval does not authorize applying this migration.
-- Isolated delivery claims for preview/test GitHub assurance ingress.

BEGIN;

CREATE TABLE public.network_os_assurance_delivery_claims (
  delivery_id text PRIMARY KEY
    CHECK (
      char_length(delivery_id) BETWEEN 1 AND 128
      AND delivery_id ~ '^[A-Za-z0-9._:-]+$'
    ),
  received_at timestamptz NOT NULL DEFAULT now(),
  event_name text NOT NULL CHECK (event_name = 'pull_request'),
  repository_id bigint NOT NULL CHECK (repository_id > 0),
  installation_id bigint NOT NULL CHECK (installation_id > 0),
  pr_number bigint NOT NULL CHECK (pr_number > 0),
  head_sha text NOT NULL CHECK (head_sha ~ '^[0-9a-f]{40}$'),
  forward_state text NOT NULL DEFAULT 'claimed'
    CHECK (forward_state IN ('claimed', 'forwarded', 'forward_failed')),
  forward_updated_at timestamptz,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '30 days'),
  CHECK (expires_at > received_at)
);

ALTER TABLE public.network_os_assurance_delivery_claims ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.network_os_assurance_delivery_claims FORCE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.network_os_assurance_delivery_claims FROM PUBLIC;
REVOKE ALL ON TABLE public.network_os_assurance_delivery_claims FROM anon;
REVOKE ALL ON TABLE public.network_os_assurance_delivery_claims FROM authenticated;
REVOKE ALL ON TABLE public.network_os_assurance_delivery_claims FROM service_role;

CREATE FUNCTION public.network_os_claim_assurance_delivery(
  p_delivery_id text,
  p_event_name text,
  p_repository_id bigint,
  p_installation_id bigint,
  p_pr_number bigint,
  p_head_sha text
)
RETURNS boolean
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  inserted_rows integer := 0;
BEGIN
  INSERT INTO public.network_os_assurance_delivery_claims (
    delivery_id,
    event_name,
    repository_id,
    installation_id,
    pr_number,
    head_sha
  ) VALUES (
    p_delivery_id,
    p_event_name,
    p_repository_id,
    p_installation_id,
    p_pr_number,
    p_head_sha
  )
  ON CONFLICT (delivery_id) DO NOTHING;

  GET DIAGNOSTICS inserted_rows = ROW_COUNT;
  RETURN inserted_rows = 1;
END;
$$;

CREATE FUNCTION public.network_os_mark_assurance_delivery_forward_result(
  p_delivery_id text,
  p_forward_state text
)
RETURNS boolean
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  updated_rows integer := 0;
BEGIN
  IF p_forward_state NOT IN ('forwarded', 'forward_failed') THEN
    RETURN false;
  END IF;

  UPDATE public.network_os_assurance_delivery_claims
  SET
    forward_state = p_forward_state,
    forward_updated_at = now()
  WHERE delivery_id = p_delivery_id
    AND forward_state = 'claimed';

  GET DIAGNOSTICS updated_rows = ROW_COUNT;
  RETURN updated_rows = 1;
END;
$$;

REVOKE ALL ON FUNCTION public.network_os_claim_assurance_delivery(text, text, bigint, bigint, bigint, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.network_os_claim_assurance_delivery(text, text, bigint, bigint, bigint, text) FROM anon;
REVOKE ALL ON FUNCTION public.network_os_claim_assurance_delivery(text, text, bigint, bigint, bigint, text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.network_os_claim_assurance_delivery(text, text, bigint, bigint, bigint, text) TO service_role;

REVOKE ALL ON FUNCTION public.network_os_mark_assurance_delivery_forward_result(text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.network_os_mark_assurance_delivery_forward_result(text, text) FROM anon;
REVOKE ALL ON FUNCTION public.network_os_mark_assurance_delivery_forward_result(text, text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.network_os_mark_assurance_delivery_forward_result(text, text) TO service_role;

COMMIT;

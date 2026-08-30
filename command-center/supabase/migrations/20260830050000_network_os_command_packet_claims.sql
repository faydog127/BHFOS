-- NOS-N8N-COMMAND-PACKET-CLAIM-CONTRACT-01 / NOS-WI-N8N-COMMAND-PACKET-CLAIM-01
-- Purpose-specific durable atomic claim for Command Center courier packets.
-- Keyed by packet_id. At-most-once outbound n8n send eligibility. Not exactly-once delivery.
-- Not a GitHub assurance delivery store. Do not apply to hosted/production from this packet.

BEGIN;

CREATE TABLE public.network_os_command_packet_claims (
  packet_id text PRIMARY KEY
    CHECK (
      char_length(packet_id) BETWEEN 1 AND 128
      AND packet_id ~ '^[A-Za-z0-9._:-]+$'
    ),
  packet_digest text NOT NULL
    CHECK (packet_digest ~ '^[0-9a-f]{64}$'),
  event_type text NOT NULL
    CHECK (event_type = 'command.packet.submitted'),
  source text NOT NULL
    CHECK (source = 'bhfos-command-center'),
  claimed_at timestamptz NOT NULL DEFAULT clock_timestamp()
);

COMMENT ON TABLE public.network_os_command_packet_claims IS
  'Command Center command.packet.submitted courier claim. packet_id unique. No packet_text, URLs, tokens, or credentials.';

ALTER TABLE public.network_os_command_packet_claims ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.network_os_command_packet_claims FORCE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.network_os_command_packet_claims FROM PUBLIC;
REVOKE ALL ON TABLE public.network_os_command_packet_claims FROM anon;
REVOKE ALL ON TABLE public.network_os_command_packet_claims FROM authenticated;
REVOKE ALL ON TABLE public.network_os_command_packet_claims FROM service_role;

CREATE FUNCTION public.network_os_claim_command_packet(
  p_packet_id text,
  p_packet_digest text,
  p_event_type text,
  p_source text
)
RETURNS text
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  inserted_rows integer := 0;
  existing_digest text;
  existing_event_type text;
  existing_source text;
BEGIN
  IF p_packet_id IS NULL
     OR char_length(p_packet_id) < 1
     OR char_length(p_packet_id) > 128
     OR p_packet_id !~ '^[A-Za-z0-9._:-]+$'
     OR p_packet_digest IS NULL
     OR p_packet_digest !~ '^[0-9a-f]{64}$'
     OR p_event_type IS DISTINCT FROM 'command.packet.submitted'
     OR p_source IS DISTINCT FROM 'bhfos-command-center'
  THEN
    RAISE EXCEPTION 'network_os_claim_command_packet_invalid_input'
      USING ERRCODE = 'check_violation';
  END IF;

  INSERT INTO public.network_os_command_packet_claims (
    packet_id,
    packet_digest,
    event_type,
    source
  ) VALUES (
    p_packet_id,
    p_packet_digest,
    p_event_type,
    p_source
  )
  ON CONFLICT (packet_id) DO NOTHING;

  GET DIAGNOSTICS inserted_rows = ROW_COUNT;
  IF inserted_rows = 1 THEN
    RETURN 'claimed';
  END IF;

  SELECT c.packet_digest, c.event_type, c.source
    INTO existing_digest, existing_event_type, existing_source
    FROM public.network_os_command_packet_claims AS c
   WHERE c.packet_id = p_packet_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'network_os_claim_command_packet_indeterminate'
      USING ERRCODE = 'internal_error';
  END IF;

  IF existing_digest = p_packet_digest
     AND existing_event_type = p_event_type
     AND existing_source = p_source
  THEN
    RETURN 'duplicate';
  END IF;

  RETURN 'conflict';
END;
$$;

REVOKE ALL ON FUNCTION public.network_os_claim_command_packet(text, text, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.network_os_claim_command_packet(text, text, text, text) FROM anon;
REVOKE ALL ON FUNCTION public.network_os_claim_command_packet(text, text, text, text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.network_os_claim_command_packet(text, text, text, text) TO service_role;

COMMIT;

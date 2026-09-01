-- NOS-N8N-RECOVERABLE-DELIVERY-IMPLEMENTATION-01
-- Additive recoverable delivery on public.network_os_command_packet_claims.
-- Durations: HTTP 15s / DB finalize 2s / runtime 3s / lease TTL 20s / post-dispatch finalize 20s.
-- delivery_state is ALWAYS SET NOT NULL after AC-3 backfill.
-- INSERT-winner then SELECT FOR UPDATE; current_attempt_no+1 (never MAX).
-- Durable attempt phases: lease_acquired | dispatch_started | finalize_ok only.
-- p_lease_owner = command-packet-courier. No packet_text. Old claim RPC is dropped, not recreated.
-- Do not apply to hosted/preview/production from this packet.

BEGIN;

ALTER TABLE public.network_os_command_packet_claims
  ADD COLUMN delivery_state text,
  ADD COLUMN lease_token text,
  ADD COLUMN lease_owner text,
  ADD COLUMN lease_acquired_at timestamptz,
  ADD COLUMN lease_expires_at timestamptz,
  ADD COLUMN dispatch_started_at timestamptz,
  ADD COLUMN post_dispatch_finalize_deadline_at timestamptz,
  ADD COLUMN dispatch_outcome text,
  ADD COLUMN delivered_at timestamptz,
  ADD COLUMN current_attempt_no integer;

DO $$
DECLARE
  unexpected_count integer;
BEGIN
  SELECT COUNT(*)
    INTO unexpected_count
    FROM public.network_os_command_packet_claims
   WHERE packet_id IS DISTINCT FROM 'NOS-AC3-AUTH-SYNTH-01';

  IF unexpected_count > 0 THEN
    RAISE EXCEPTION 'network_os_command_packet_recoverable_delivery_unexpected_claim_rows'
      USING ERRCODE = 'check_violation';
  END IF;

  UPDATE public.network_os_command_packet_claims
     SET delivery_state = 'reconciliation_required',
         dispatch_outcome = 'historical_delivery_unknown',
         dispatch_started_at = NULL
   WHERE packet_id = 'NOS-AC3-AUTH-SYNTH-01';
END
$$;

ALTER TABLE public.network_os_command_packet_claims
  ALTER COLUMN delivery_state SET NOT NULL;

ALTER TABLE public.network_os_command_packet_claims
  ADD CONSTRAINT network_os_command_packet_claims_delivery_state_chk
    CHECK (delivery_state IN ('leased', 'delivered', 'retryable', 'reconciliation_required')),
  ADD CONSTRAINT network_os_command_packet_claims_dispatch_outcome_chk
    CHECK (
      dispatch_outcome IS DISTINCT FROM 'finalization_failed'
      AND (
        dispatch_outcome IS NULL
        OR dispatch_outcome IN (
          'http_2xx',
          'http_4xx',
          'http_5xx',
          'timeout',
          'transport',
          'historical_delivery_unknown'
        )
      )
    ),
  ADD CONSTRAINT network_os_command_packet_claims_delivered_pair_chk
    CHECK (
      delivery_state <> 'delivered'
      OR (
        dispatch_outcome = 'http_2xx'
        AND dispatch_started_at IS NOT NULL
        AND delivered_at IS NOT NULL
      )
    ),
  ADD CONSTRAINT network_os_command_packet_claims_retryable_no_dispatch_chk
    CHECK (
      delivery_state <> 'retryable'
      OR (
        dispatch_started_at IS NULL
        AND delivered_at IS NULL
        AND post_dispatch_finalize_deadline_at IS NULL
        AND dispatch_outcome IS NULL
      )
    ),
  ADD CONSTRAINT network_os_command_packet_claims_dispatch_deadline_chk
    CHECK (
      dispatch_started_at IS NULL
      OR post_dispatch_finalize_deadline_at IS NOT NULL
    ),
  ADD CONSTRAINT network_os_command_packet_claims_ac3_or_recon_chk
    CHECK (
      delivery_state <> 'reconciliation_required'
      OR dispatch_outcome = 'historical_delivery_unknown'
      OR dispatch_started_at IS NOT NULL
    ),
  ADD CONSTRAINT network_os_command_packet_claims_lease_owner_chk
    CHECK (lease_owner IS NULL OR lease_owner = 'command-packet-courier'),
  ADD CONSTRAINT network_os_command_packet_claims_attempt_no_chk
    CHECK (current_attempt_no IS NULL OR current_attempt_no >= 1);

CREATE TABLE public.network_os_command_packet_delivery_attempts (
  attempt_id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  packet_id text NOT NULL
    REFERENCES public.network_os_command_packet_claims (packet_id),
  attempt_no integer NOT NULL
    CHECK (attempt_no >= 1),
  phase text NOT NULL
    CHECK (phase IN ('lease_acquired', 'dispatch_started', 'finalize_ok')),
  lease_token text NOT NULL,
  outcome text,
  status text,
  recorded_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT network_os_command_packet_attempt_outcome_status_chk CHECK (
    (
      phase = 'lease_acquired'
      AND outcome IS NULL
      AND status = 'leased'
    ) OR (
      phase = 'dispatch_started'
      AND outcome IS NULL
      AND status = 'dispatch_started'
    ) OR (
      phase = 'finalize_ok'
      AND (
        (status = 'delivered' AND outcome = 'http_2xx')
        OR (
          status = 'reconciliation_required'
          AND outcome IN ('http_4xx', 'http_5xx', 'timeout', 'transport')
        )
      )
    )
  )
);

COMMENT ON TABLE public.network_os_command_packet_delivery_attempts IS
  'Committed-facts-only command-packet delivery phases. Phases lease_acquired|dispatch_started|finalize_ok only. No payload body or secret material.';

CREATE UNIQUE INDEX network_os_command_packet_attempt_lease_uq
  ON public.network_os_command_packet_delivery_attempts (packet_id, attempt_no)
  WHERE phase = 'lease_acquired';

ALTER TABLE public.network_os_command_packet_delivery_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.network_os_command_packet_delivery_attempts FORCE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.network_os_command_packet_delivery_attempts FROM PUBLIC;
REVOKE ALL ON TABLE public.network_os_command_packet_delivery_attempts FROM anon;
REVOKE ALL ON TABLE public.network_os_command_packet_delivery_attempts FROM authenticated;
REVOKE ALL ON TABLE public.network_os_command_packet_delivery_attempts FROM service_role;

DROP FUNCTION IF EXISTS public.network_os_claim_command_packet(text, text, text, text);

CREATE FUNCTION public.network_os_lease_command_packet(
  p_packet_id text,
  p_packet_digest text,
  p_event_type text,
  p_source text,
  p_lease_owner text,
  p_lease_ttl interval
)
RETURNS TABLE (
  outcome text,
  lease_token text,
  attempt_no integer,
  delivery_state text
)
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = pg_temp
AS $$
DECLARE
  inserted_rows integer := 0;
  v_now timestamptz;
  v_lease_token text;
  v_attempt_no integer;
  v_row public.network_os_command_packet_claims%ROWTYPE;
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
    RAISE EXCEPTION 'network_os_lease_command_packet_invalid_input'
      USING ERRCODE = 'check_violation';
  END IF;

  IF p_lease_ttl IS DISTINCT FROM interval '20 seconds' THEN
    RAISE EXCEPTION 'network_os_lease_command_packet_invalid_ttl'
      USING ERRCODE = 'check_violation';
  END IF;

  IF p_lease_owner IS DISTINCT FROM 'command-packet-courier' THEN
    RAISE EXCEPTION 'network_os_lease_command_packet_invalid_owner'
      USING ERRCODE = 'check_violation';
  END IF;

  v_now := clock_timestamp();
  v_lease_token := md5(
    p_packet_id || v_now::text || random()::text || pg_backend_pid()::text
  ) || md5(random()::text || v_now::text);

  INSERT INTO public.network_os_command_packet_claims (
    packet_id,
    packet_digest,
    event_type,
    source,
    delivery_state,
    lease_token,
    lease_owner,
    lease_acquired_at,
    lease_expires_at,
    dispatch_started_at,
    post_dispatch_finalize_deadline_at,
    dispatch_outcome,
    delivered_at,
    current_attempt_no
  ) VALUES (
    p_packet_id,
    p_packet_digest,
    p_event_type,
    p_source,
    'leased',
    v_lease_token,
    p_lease_owner,
    v_now,
    v_now + p_lease_ttl,
    NULL,
    NULL,
    NULL,
    NULL,
    1
  )
  ON CONFLICT (packet_id) DO NOTHING
  RETURNING
    public.network_os_command_packet_claims.lease_token,
    public.network_os_command_packet_claims.current_attempt_no,
    public.network_os_command_packet_claims.delivery_state
  INTO v_lease_token, v_attempt_no, delivery_state;

  GET DIAGNOSTICS inserted_rows = ROW_COUNT;
  IF inserted_rows = 1 THEN
    INSERT INTO public.network_os_command_packet_delivery_attempts (
      packet_id,
      attempt_no,
      phase,
      lease_token,
      outcome,
      status
    ) VALUES (
      p_packet_id,
      1,
      'lease_acquired',
      v_lease_token,
      NULL,
      'leased'
    );
    outcome := 'leased';
    lease_token := v_lease_token;
    attempt_no := 1;
    RETURN NEXT;
    RETURN;
  END IF;

  SELECT *
    INTO v_row
    FROM public.network_os_command_packet_claims
   WHERE public.network_os_command_packet_claims.packet_id = p_packet_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'network_os_lease_command_packet_indeterminate'
      USING ERRCODE = 'internal_error';
  END IF;

  IF v_row.packet_digest IS DISTINCT FROM p_packet_digest
     OR v_row.event_type IS DISTINCT FROM p_event_type
     OR v_row.source IS DISTINCT FROM p_source
  THEN
    outcome := 'conflict';
    lease_token := NULL;
    attempt_no := v_row.current_attempt_no;
    delivery_state := v_row.delivery_state;
    RETURN NEXT;
    RETURN;
  END IF;

  IF v_row.delivery_state = 'delivered' THEN
    outcome := 'delivered';
    lease_token := NULL;
    attempt_no := v_row.current_attempt_no;
    delivery_state := v_row.delivery_state;
    RETURN NEXT;
    RETURN;
  END IF;

  IF v_row.dispatch_started_at IS NOT NULL THEN
    IF v_row.post_dispatch_finalize_deadline_at IS NOT NULL
       AND clock_timestamp() < v_row.post_dispatch_finalize_deadline_at
    THEN
      outcome := 'in_flight';
      lease_token := NULL;
      attempt_no := v_row.current_attempt_no;
      delivery_state := v_row.delivery_state;
      RETURN NEXT;
      RETURN;
    END IF;

    UPDATE public.network_os_command_packet_claims AS c
       SET delivery_state = 'reconciliation_required'
     WHERE c.packet_id = p_packet_id
       AND c.delivery_state IS DISTINCT FROM 'reconciliation_required';

    outcome := 'reconciliation_required';
    lease_token := NULL;
    attempt_no := v_row.current_attempt_no;
    delivery_state := 'reconciliation_required';
    RETURN NEXT;
    RETURN;
  END IF;

  IF v_row.delivery_state = 'reconciliation_required' THEN
    outcome := 'reconciliation_required';
    lease_token := NULL;
    attempt_no := v_row.current_attempt_no;
    delivery_state := v_row.delivery_state;
    RETURN NEXT;
    RETURN;
  END IF;

  IF v_row.delivery_state = 'leased'
     AND v_row.lease_expires_at IS NOT NULL
     AND v_row.lease_expires_at > clock_timestamp()
  THEN
    outcome := 'in_flight';
    lease_token := NULL;
    attempt_no := v_row.current_attempt_no;
    delivery_state := v_row.delivery_state;
    RETURN NEXT;
    RETURN;
  END IF;

  IF v_row.delivery_state = 'leased'
     AND v_row.dispatch_started_at IS NULL
     AND (
       v_row.lease_expires_at IS NULL
       OR v_row.lease_expires_at <= clock_timestamp()
     )
  THEN
    UPDATE public.network_os_command_packet_claims AS c
       SET delivery_state = 'retryable',
           lease_token = NULL,
           lease_owner = NULL,
           lease_acquired_at = NULL,
           lease_expires_at = NULL
     WHERE c.packet_id = p_packet_id;
    v_row.delivery_state := 'retryable';
  END IF;

  IF v_row.delivery_state = 'retryable' THEN
    v_now := clock_timestamp();
    v_lease_token := md5(
      p_packet_id || v_now::text || random()::text || pg_backend_pid()::text
    ) || md5(random()::text || v_now::text);
    v_attempt_no := COALESCE(v_row.current_attempt_no, 0) + 1;

    UPDATE public.network_os_command_packet_claims AS c
       SET delivery_state = 'leased',
           lease_token = v_lease_token,
           lease_owner = p_lease_owner,
           lease_acquired_at = v_now,
           lease_expires_at = v_now + p_lease_ttl,
           dispatch_started_at = NULL,
           post_dispatch_finalize_deadline_at = NULL,
           dispatch_outcome = NULL,
           delivered_at = NULL,
           current_attempt_no = v_attempt_no
     WHERE c.packet_id = p_packet_id;

    INSERT INTO public.network_os_command_packet_delivery_attempts (
      packet_id,
      attempt_no,
      phase,
      lease_token,
      outcome,
      status
    ) VALUES (
      p_packet_id,
      v_attempt_no,
      'lease_acquired',
      v_lease_token,
      NULL,
      'leased'
    );

    outcome := 'leased';
    lease_token := v_lease_token;
    attempt_no := v_attempt_no;
    delivery_state := 'leased';
    RETURN NEXT;
    RETURN;
  END IF;

  outcome := 'in_flight';
  lease_token := NULL;
  attempt_no := v_row.current_attempt_no;
  delivery_state := v_row.delivery_state;
  RETURN NEXT;
END;
$$;

CREATE FUNCTION public.network_os_mark_command_packet_dispatch_started(
  p_packet_id text,
  p_lease_token text
)
RETURNS TABLE (
  outcome text
)
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = pg_temp
AS $$
DECLARE
  v_row public.network_os_command_packet_claims%ROWTYPE;
  v_now timestamptz;
BEGIN
  IF p_packet_id IS NULL
     OR p_lease_token IS NULL
     OR char_length(p_lease_token) < 1
  THEN
    RAISE EXCEPTION 'network_os_mark_command_packet_dispatch_started_invalid_input'
      USING ERRCODE = 'check_violation';
  END IF;

  SELECT *
    INTO v_row
    FROM public.network_os_command_packet_claims
   WHERE public.network_os_command_packet_claims.packet_id = p_packet_id
   FOR UPDATE;

  IF NOT FOUND
     OR v_row.lease_token IS DISTINCT FROM p_lease_token
     OR v_row.delivery_state IS DISTINCT FROM 'leased'
     OR v_row.lease_expires_at IS NULL
     OR v_row.lease_expires_at <= clock_timestamp()
  THEN
    outcome := 'lease_lost';
    RETURN NEXT;
    RETURN;
  END IF;

  IF v_row.dispatch_started_at IS NOT NULL THEN
    outcome := 'ok';
    RETURN NEXT;
    RETURN;
  END IF;

  v_now := clock_timestamp();

  UPDATE public.network_os_command_packet_claims AS c
     SET dispatch_started_at = v_now,
         post_dispatch_finalize_deadline_at = v_now + interval '20 seconds'
   WHERE c.packet_id = p_packet_id;

  INSERT INTO public.network_os_command_packet_delivery_attempts (
    packet_id,
    attempt_no,
    phase,
    lease_token,
    outcome,
    status
  ) VALUES (
    p_packet_id,
    v_row.current_attempt_no,
    'dispatch_started',
    p_lease_token,
    NULL,
    'dispatch_started'
  );

  outcome := 'ok';
  RETURN NEXT;
END;
$$;

CREATE FUNCTION public.network_os_finalize_command_packet_delivery(
  p_packet_id text,
  p_lease_token text,
  p_delivery_state text,
  p_dispatch_outcome text
)
RETURNS TABLE (
  outcome text
)
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = pg_temp
AS $$
DECLARE
  v_row public.network_os_command_packet_claims%ROWTYPE;
  v_pair_ok boolean := false;
  v_now timestamptz;
BEGIN
  IF p_packet_id IS NULL
     OR p_lease_token IS NULL
     OR char_length(p_lease_token) < 1
  THEN
    RAISE EXCEPTION 'network_os_finalize_command_packet_delivery_invalid_input'
      USING ERRCODE = 'check_violation';
  END IF;

  v_pair_ok :=
    (p_delivery_state = 'delivered' AND p_dispatch_outcome = 'http_2xx')
    OR (
      p_delivery_state = 'reconciliation_required'
      AND p_dispatch_outcome IN ('http_4xx', 'http_5xx', 'timeout', 'transport')
    );

  IF NOT v_pair_ok THEN
    RAISE EXCEPTION 'network_os_finalize_command_packet_delivery_invalid_pair'
      USING ERRCODE = 'check_violation';
  END IF;

  SELECT *
    INTO v_row
    FROM public.network_os_command_packet_claims
   WHERE public.network_os_command_packet_claims.packet_id = p_packet_id
   FOR UPDATE;

  IF NOT FOUND
     OR v_row.lease_token IS DISTINCT FROM p_lease_token
  THEN
    outcome := 'lease_lost';
    RETURN NEXT;
    RETURN;
  END IF;

  IF v_row.delivery_state = 'delivered'
     AND p_delivery_state = 'delivered'
     AND v_row.dispatch_outcome = 'http_2xx'
  THEN
    outcome := 'ok';
    RETURN NEXT;
    RETURN;
  END IF;

  IF v_row.delivery_state = 'reconciliation_required'
     AND p_delivery_state = 'reconciliation_required'
     AND v_row.dispatch_outcome IS NOT DISTINCT FROM p_dispatch_outcome
  THEN
    outcome := 'ok';
    RETURN NEXT;
    RETURN;
  END IF;

  IF v_row.dispatch_started_at IS NULL THEN
    RAISE EXCEPTION 'network_os_finalize_command_packet_delivery_dispatch_required'
      USING ERRCODE = 'check_violation';
  END IF;

  v_now := clock_timestamp();

  UPDATE public.network_os_command_packet_claims AS c
     SET delivery_state = p_delivery_state,
         dispatch_outcome = p_dispatch_outcome,
         delivered_at = CASE
           WHEN p_delivery_state = 'delivered' THEN v_now
           ELSE c.delivered_at
         END
   WHERE c.packet_id = p_packet_id;

  INSERT INTO public.network_os_command_packet_delivery_attempts (
    packet_id,
    attempt_no,
    phase,
    lease_token,
    outcome,
    status
  ) VALUES (
    p_packet_id,
    v_row.current_attempt_no,
    'finalize_ok',
    p_lease_token,
    p_dispatch_outcome,
    p_delivery_state
  );

  outcome := 'ok';
  RETURN NEXT;
END;
$$;

REVOKE ALL ON FUNCTION public.network_os_lease_command_packet(text, text, text, text, text, interval) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.network_os_lease_command_packet(text, text, text, text, text, interval) FROM anon;
REVOKE ALL ON FUNCTION public.network_os_lease_command_packet(text, text, text, text, text, interval) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.network_os_lease_command_packet(text, text, text, text, text, interval) TO service_role;

REVOKE ALL ON FUNCTION public.network_os_mark_command_packet_dispatch_started(text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.network_os_mark_command_packet_dispatch_started(text, text) FROM anon;
REVOKE ALL ON FUNCTION public.network_os_mark_command_packet_dispatch_started(text, text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.network_os_mark_command_packet_dispatch_started(text, text) TO service_role;

REVOKE ALL ON FUNCTION public.network_os_finalize_command_packet_delivery(text, text, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.network_os_finalize_command_packet_delivery(text, text, text, text) FROM anon;
REVOKE ALL ON FUNCTION public.network_os_finalize_command_packet_delivery(text, text, text, text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.network_os_finalize_command_packet_delivery(text, text, text, text) TO service_role;

COMMIT;

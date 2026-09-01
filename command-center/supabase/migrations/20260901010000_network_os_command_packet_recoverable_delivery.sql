-- NOS-N8N-RECOVERABLE-DELIVERY-IMPLEMENTATION-01
-- Remediation: NOS-N8N-RECOVERABLE-DELIVERY-REMEDIATION-01
-- Additive recoverable delivery on public.network_os_command_packet_claims.
-- Durations: HTTP 15s / DB finalize 2s / runtime 3s / lease TTL 20s / post-dispatch finalize 20s.
-- delivery_state is ALWAYS SET NOT NULL after AC-3 backfill.
-- INSERT-winner then SELECT FOR UPDATE; current_attempt_no+1 (never MAX).
-- Durable attempt phases: lease_acquired | lease_expired | dispatch_started | finalize_ok.
-- p_lease_owner = command-packet-courier. No packet_text. Old claim RPC is dropped, not recreated.
-- Do not apply to hosted/preview/production from this packet.

BEGIN;

ALTER TABLE public.network_os_command_packet_claims
  ADD COLUMN delivery_state text,
  ADD COLUMN lease_token uuid,
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
          'http_timeout',
          'transport_error',
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
  packet_digest text NOT NULL
    CHECK (packet_digest ~ '^[0-9a-f]{64}$'),
  lease_token uuid NOT NULL,
  attempt_no integer NOT NULL
    CHECK (attempt_no >= 1),
  attempted_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  phase text NOT NULL
    CHECK (phase IN ('lease_acquired', 'lease_expired', 'dispatch_started', 'finalize_ok')),
  observable_outcome text,
  receiver_http_status integer,
  CONSTRAINT network_os_command_packet_attempt_outcome_status_chk CHECK (
    (
      phase IN ('lease_acquired', 'dispatch_started')
      AND observable_outcome IS NULL
      AND receiver_http_status IS NULL
    ) OR (
      phase = 'lease_expired'
      AND observable_outcome = 'lease_expired_before_dispatch'
      AND receiver_http_status IS NULL
    ) OR (
      phase = 'finalize_ok'
      AND observable_outcome = 'http_2xx'
      AND receiver_http_status BETWEEN 200 AND 299
    ) OR (
      phase = 'finalize_ok'
      AND observable_outcome = 'http_4xx'
      AND receiver_http_status BETWEEN 400 AND 499
    ) OR (
      phase = 'finalize_ok'
      AND observable_outcome = 'http_5xx'
      AND receiver_http_status BETWEEN 500 AND 599
    ) OR (
      phase = 'finalize_ok'
      AND observable_outcome IN ('http_timeout', 'transport_error')
      AND receiver_http_status IS NULL
    )
  )
);

COMMENT ON TABLE public.network_os_command_packet_delivery_attempts IS
  'Committed-facts-only command-packet delivery phases. Phases lease_acquired|lease_expired|dispatch_started|finalize_ok only. No payload body or secret material.';

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
  result text,
  lease_token uuid,
  delivery_state text,
  attempt_no integer
)
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = pg_temp
AS $$
DECLARE
  inserted_rows integer := 0;
  v_now timestamptz;
  v_lease_token uuid;
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
    RAISE EXCEPTION 'network_os_lease_ttl_out_of_bounds'
      USING ERRCODE = 'check_violation';
  END IF;

  IF p_lease_owner IS DISTINCT FROM 'command-packet-courier' THEN
    RAISE EXCEPTION 'network_os_lease_owner_rejected'
      USING ERRCODE = 'check_violation';
  END IF;

  v_now := clock_timestamp();
  v_lease_token := gen_random_uuid();

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
    v_now + interval '20 seconds',
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
      packet_digest,
      lease_token,
      attempt_no,
      phase,
      observable_outcome,
      receiver_http_status
    ) VALUES (
      p_packet_id,
      p_packet_digest,
      v_lease_token,
      1,
      'lease_acquired',
      NULL,
      NULL
    );
    result := 'leased';
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
    result := 'conflict';
    lease_token := NULL;
    attempt_no := v_row.current_attempt_no;
    delivery_state := v_row.delivery_state;
    RETURN NEXT;
    RETURN;
  END IF;

  IF v_row.delivery_state = 'delivered' THEN
    result := 'duplicate';
    lease_token := NULL;
    attempt_no := v_row.current_attempt_no;
    delivery_state := v_row.delivery_state;
    RETURN NEXT;
    RETURN;
  END IF;

  IF v_row.delivery_state = 'reconciliation_required' THEN
    result := 'held_for_reconciliation';
    lease_token := NULL;
    attempt_no := v_row.current_attempt_no;
    delivery_state := v_row.delivery_state;
    RETURN NEXT;
    RETURN;
  END IF;

  IF v_row.dispatch_started_at IS NOT NULL THEN
    IF v_row.delivery_state = 'leased'
       AND v_row.post_dispatch_finalize_deadline_at IS NOT NULL
       AND clock_timestamp() < v_row.post_dispatch_finalize_deadline_at
    THEN
      result := 'in_flight';
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

    result := 'held_for_reconciliation';
    lease_token := NULL;
    attempt_no := v_row.current_attempt_no;
    delivery_state := 'reconciliation_required';
    RETURN NEXT;
    RETURN;
  END IF;

  IF v_row.delivery_state = 'leased'
     AND v_row.lease_expires_at IS NOT NULL
     AND v_row.lease_expires_at >= clock_timestamp()
  THEN
    result := 'in_flight';
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
       OR v_row.lease_expires_at < clock_timestamp()
     )
  THEN
    INSERT INTO public.network_os_command_packet_delivery_attempts (
      packet_id,
      packet_digest,
      lease_token,
      attempt_no,
      phase,
      observable_outcome,
      receiver_http_status
    ) VALUES (
      p_packet_id,
      v_row.packet_digest,
      v_row.lease_token,
      v_row.current_attempt_no,
      'lease_expired',
      'lease_expired_before_dispatch',
      NULL
    );

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
    v_lease_token := gen_random_uuid();
    v_attempt_no := COALESCE(v_row.current_attempt_no, 0) + 1;

    UPDATE public.network_os_command_packet_claims AS c
       SET delivery_state = 'leased',
           lease_token = v_lease_token,
           lease_owner = p_lease_owner,
           lease_acquired_at = v_now,
           lease_expires_at = v_now + interval '20 seconds',
           dispatch_started_at = NULL,
           post_dispatch_finalize_deadline_at = NULL,
           dispatch_outcome = NULL,
           delivered_at = NULL,
           current_attempt_no = v_attempt_no
     WHERE c.packet_id = p_packet_id;

    INSERT INTO public.network_os_command_packet_delivery_attempts (
      packet_id,
      packet_digest,
      lease_token,
      attempt_no,
      phase,
      observable_outcome,
      receiver_http_status
    ) VALUES (
      p_packet_id,
      p_packet_digest,
      v_lease_token,
      v_attempt_no,
      'lease_acquired',
      NULL,
      NULL
    );

    result := 'leased';
    lease_token := v_lease_token;
    attempt_no := v_attempt_no;
    delivery_state := 'leased';
    RETURN NEXT;
    RETURN;
  END IF;

  result := 'in_flight';
  lease_token := NULL;
  attempt_no := v_row.current_attempt_no;
  delivery_state := v_row.delivery_state;
  RETURN NEXT;
END;
$$;

CREATE FUNCTION public.network_os_mark_command_packet_dispatch_started(
  p_packet_id text,
  p_packet_digest text,
  p_lease_token uuid,
  p_expected_state text
)
RETURNS text
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = pg_temp
AS $$
DECLARE
  v_now timestamptz;
  v_attempt_no integer;
BEGIN
  IF p_packet_id IS NULL
     OR p_packet_digest IS NULL
     OR p_lease_token IS NULL
     OR p_expected_state IS DISTINCT FROM 'leased'
  THEN
    RETURN 'lease_lost';
  END IF;

  v_now := clock_timestamp();

  UPDATE public.network_os_command_packet_claims AS c
     SET dispatch_started_at = v_now,
         post_dispatch_finalize_deadline_at = v_now + interval '20 seconds'
   WHERE c.packet_id = p_packet_id
     AND c.packet_digest = p_packet_digest
     AND c.lease_token = p_lease_token
     AND c.delivery_state = 'leased'
     AND c.lease_expires_at >= clock_timestamp()
     AND c.dispatch_started_at IS NULL
  RETURNING c.current_attempt_no
    INTO v_attempt_no;

  IF NOT FOUND THEN
    RETURN 'lease_lost';
  END IF;

  INSERT INTO public.network_os_command_packet_delivery_attempts (
    packet_id,
    packet_digest,
    lease_token,
    attempt_no,
    phase,
    observable_outcome,
    receiver_http_status
  ) VALUES (
    p_packet_id,
    p_packet_digest,
    p_lease_token,
    v_attempt_no,
    'dispatch_started',
    NULL,
    NULL
  );

  RETURN 'ok';
END;
$$;

CREATE FUNCTION public.network_os_finalize_command_packet_delivery(
  p_packet_id text,
  p_packet_digest text,
  p_lease_token uuid,
  p_expected_state text,
  p_dispatch_outcome text,
  p_receiver_http_status integer
)
RETURNS text
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = pg_temp
AS $$
DECLARE
  v_derived_state text;
  v_now timestamptz;
  v_attempt_no integer;
BEGIN
  IF p_packet_id IS NULL
     OR p_packet_digest IS NULL
     OR p_lease_token IS NULL
     OR p_expected_state IS DISTINCT FROM 'leased'
  THEN
    RETURN 'lease_lost';
  END IF;

  IF p_dispatch_outcome = 'http_2xx'
     AND p_receiver_http_status BETWEEN 200 AND 299
  THEN
    v_derived_state := 'delivered';
  ELSIF p_dispatch_outcome = 'http_4xx'
     AND p_receiver_http_status BETWEEN 400 AND 499
  THEN
    v_derived_state := 'reconciliation_required';
  ELSIF p_dispatch_outcome = 'http_5xx'
     AND p_receiver_http_status BETWEEN 500 AND 599
  THEN
    v_derived_state := 'reconciliation_required';
  ELSIF p_dispatch_outcome = 'http_timeout'
     AND p_receiver_http_status IS NULL
  THEN
    v_derived_state := 'reconciliation_required';
  ELSIF p_dispatch_outcome = 'transport_error'
     AND p_receiver_http_status IS NULL
  THEN
    v_derived_state := 'reconciliation_required';
  ELSE
    RAISE EXCEPTION 'network_os_finalize_command_packet_delivery_invalid_pair'
      USING ERRCODE = 'check_violation';
  END IF;

  v_now := clock_timestamp();

  UPDATE public.network_os_command_packet_claims AS c
     SET delivery_state = v_derived_state,
         dispatch_outcome = p_dispatch_outcome,
         delivered_at = CASE
           WHEN v_derived_state = 'delivered' THEN v_now
           ELSE c.delivered_at
         END
   WHERE c.packet_id = p_packet_id
     AND c.packet_digest = p_packet_digest
     AND c.lease_token = p_lease_token
     AND c.delivery_state = 'leased'
     AND c.dispatch_started_at IS NOT NULL
     AND c.post_dispatch_finalize_deadline_at IS NOT NULL
     AND clock_timestamp() < c.post_dispatch_finalize_deadline_at
  RETURNING c.current_attempt_no
    INTO v_attempt_no;

  IF NOT FOUND THEN
    RETURN 'lease_lost';
  END IF;

  INSERT INTO public.network_os_command_packet_delivery_attempts (
    packet_id,
    packet_digest,
    lease_token,
    attempt_no,
    phase,
    observable_outcome,
    receiver_http_status
  ) VALUES (
    p_packet_id,
    p_packet_digest,
    p_lease_token,
    v_attempt_no,
    'finalize_ok',
    p_dispatch_outcome,
    p_receiver_http_status
  );

  RETURN 'ok';
END;
$$;

REVOKE ALL ON FUNCTION public.network_os_lease_command_packet(text, text, text, text, text, interval) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.network_os_lease_command_packet(text, text, text, text, text, interval) FROM anon;
REVOKE ALL ON FUNCTION public.network_os_lease_command_packet(text, text, text, text, text, interval) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.network_os_lease_command_packet(text, text, text, text, text, interval) TO service_role;

REVOKE ALL ON FUNCTION public.network_os_mark_command_packet_dispatch_started(text, text, uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.network_os_mark_command_packet_dispatch_started(text, text, uuid, text) FROM anon;
REVOKE ALL ON FUNCTION public.network_os_mark_command_packet_dispatch_started(text, text, uuid, text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.network_os_mark_command_packet_dispatch_started(text, text, uuid, text) TO service_role;

REVOKE ALL ON FUNCTION public.network_os_finalize_command_packet_delivery(text, text, uuid, text, text, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.network_os_finalize_command_packet_delivery(text, text, uuid, text, text, integer) FROM anon;
REVOKE ALL ON FUNCTION public.network_os_finalize_command_packet_delivery(text, text, uuid, text, text, integer) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.network_os_finalize_command_packet_delivery(text, text, uuid, text, text, integer) TO service_role;

COMMIT;

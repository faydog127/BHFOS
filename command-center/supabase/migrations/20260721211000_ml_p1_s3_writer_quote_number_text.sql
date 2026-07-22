-- ML-P1 Slice 3 bounded remediation: writer quote_number integer/text coalesce.
-- Root cause: idempotent ensure path used coalesce(quotes.quote_number int, jobs.quote_number text).
-- Blocks repeated office approval / ensure_job after successful first approve.
-- Cast quote_number to text at write/coalesce sites. No actor/public/deny changes.

CREATE OR REPLACE FUNCTION public.ml_p1_s3_ensure_job_for_accepted_quote(
  p_quote_id uuid,
  p_correlation_id text DEFAULT NULL,
  p_actor_role text DEFAULT NULL,
  p_source text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_quote public.quotes%ROWTYPE;
  v_job public.jobs%ROWTYPE;
  v_job_id uuid;
  v_created boolean := false;
  v_idempotent boolean := false;
  v_now timestamptz := now();
  v_corr text := coalesce(nullif(btrim(p_correlation_id), ''), gen_random_uuid()::text);
  v_source text := coalesce(nullif(btrim(p_source), ''), 'lifecycle_approve');
  v_role text := coalesce(nullif(btrim(p_actor_role), ''), 'system');
  v_service_address text;
  v_amount numeric;
  v_version int;
  v_wo text;
BEGIN
  IF p_quote_id IS NULL THEN
    RAISE EXCEPTION 'ML_P1_S3_QUOTE_REQUIRED: quote_id required'
      USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_quote
  FROM public.quotes
  WHERE id = p_quote_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'ML_P1_S3_QUOTE_NOT_FOUND: quote not found'
      USING ERRCODE = 'P0002';
  END IF;

  IF v_quote.tenant_id IS NULL OR btrim(v_quote.tenant_id) = '' THEN
    RAISE EXCEPTION 'ML_P1_S3_TENANT_DENY: quote missing tenant_id'
      USING ERRCODE = '42501';
  END IF;

  IF public.normalize_quote_status(v_quote.status) IS DISTINCT FROM 'accepted' THEN
    RAISE EXCEPTION 'ML_P1_S3_STATUS_DENY: job ensure requires accepted quote (got %)', v_quote.status
      USING ERRCODE = '22023';
  END IF;

  v_version := coalesce(v_quote.quote_version, 1);
  v_amount := coalesce(v_quote.approved_amount, v_quote.total_amount, 0);
  v_wo := public.next_work_order_number(v_quote.tenant_id, coalesce(v_quote.created_at, v_now));

  -- Resolve service address (quote snapshot, else lead+property). Fail closed.
  v_service_address := nullif(btrim(coalesce(v_quote.service_address, '')), '');
  IF v_service_address IS NULL AND v_quote.lead_id IS NOT NULL THEN
    SELECT nullif(
      btrim(
        concat_ws(
          ', ',
          nullif(btrim(concat_ws(' ', nullif(p.address1, ''), nullif(p.address2, ''))), ''),
          nullif(btrim(p.city), ''),
          nullif(btrim(p.state), ''),
          nullif(btrim(p.zip), '')
        )
      ),
      ''
    )
    INTO v_service_address
    FROM public.leads l
    LEFT JOIN public.properties p ON p.id = l.property_id
    WHERE l.id = v_quote.lead_id
    LIMIT 1;
  END IF;

  IF v_service_address IS NULL THEN
    RAISE EXCEPTION 'ML_P1_S3_ADDRESS_REQUIRED: service address required before job create'
      USING ERRCODE = 'P0001';
  END IF;

  -- Fail closed on cross-tenant squat (quote_id unique is global).
  SELECT * INTO v_job
  FROM public.jobs
  WHERE quote_id = v_quote.id
    AND tenant_id IS DISTINCT FROM v_quote.tenant_id
  LIMIT 1;

  IF FOUND THEN
    RAISE EXCEPTION 'ML_P1_S3_TENANT_DENY: existing job tenant mismatch for quote'
      USING ERRCODE = '42501';
  END IF;

  -- Idempotent path: existing quote-linked job (same tenant).
  SELECT * INTO v_job
  FROM public.jobs
  WHERE quote_id = v_quote.id
    AND tenant_id IS NOT DISTINCT FROM v_quote.tenant_id
  LIMIT 1;

  IF FOUND THEN
    IF v_job.source_quote_version IS NOT NULL
       AND v_job.source_quote_version IS DISTINCT FROM v_version THEN
      RAISE EXCEPTION 'ML_P1_S3_VERSION_MISMATCH: existing job pinned to version %; quote is %',
        v_job.source_quote_version, v_version
        USING ERRCODE = '22023';
    END IF;

    -- Re-pin lineage + money snapshot from approved quote (no silent financial drift).
    UPDATE public.jobs
    SET
      updated_at = v_now,
      source_quote_version = coalesce(source_quote_version, v_version),
      total_amount = v_amount,
      quote_number = coalesce(v_quote.quote_number::text, quote_number),
      lead_id = coalesce(v_quote.lead_id, lead_id),
      service_address = CASE
        WHEN service_address IS NULL OR btrim(service_address) = '' THEN v_service_address
        ELSE service_address
      END
    WHERE id = v_job.id
    RETURNING * INTO v_job;

    INSERT INTO public.events (tenant_id, entity_type, entity_id, event_type, actor_type, actor_id, payload)
    VALUES (
      v_quote.tenant_id,
      'quote',
      v_quote.id,
      'QuoteAccepted_JobEnsured',
      v_role,
      NULL,
      jsonb_build_object(
        'job_id', v_job.id,
        'quote_id', v_quote.id,
        'quote_version', v_version,
        'correlation_id', v_corr,
        'source', v_source,
        'idempotent', true,
        'created', false,
        'slice', 'ml-p1-s3'
      )
    );

    RETURN jsonb_build_object(
      'job_id', v_job.id,
      'created', false,
      'idempotent', true
    );
  END IF;

  BEGIN
    INSERT INTO public.jobs (
      tenant_id,
      lead_id,
      quote_id,
      quote_number,
      status,
      payment_status,
      total_amount,
      service_address,
      work_order_number,
      job_number,
      source_quote_version
    ) VALUES (
      v_quote.tenant_id,
      v_quote.lead_id,
      v_quote.id,
      v_quote.quote_number::text,
      'unscheduled',
      'unpaid',
      v_amount,
      v_service_address,
      v_wo,
      v_wo,
      v_version
    )
    ON CONFLICT (quote_id) WHERE quote_id IS NOT NULL
    DO NOTHING
    RETURNING id INTO v_job_id;
  EXCEPTION
    WHEN unique_violation THEN
      v_job_id := NULL;
  END;

  IF v_job_id IS NULL THEN
    SELECT * INTO v_job
    FROM public.jobs
    WHERE quote_id = v_quote.id
    LIMIT 1;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'ML_P1_S3_JOB_ENSURE_FAILED: could not create or load job for quote'
        USING ERRCODE = 'P0001';
    END IF;

    IF v_job.tenant_id IS DISTINCT FROM v_quote.tenant_id THEN
      RAISE EXCEPTION 'ML_P1_S3_TENANT_DENY: existing job tenant mismatch for quote'
        USING ERRCODE = '42501';
    END IF;

    IF v_job.source_quote_version IS NOT NULL
       AND v_job.source_quote_version IS DISTINCT FROM v_version THEN
      RAISE EXCEPTION 'ML_P1_S3_VERSION_MISMATCH: existing job pinned to version %; quote is %',
        v_job.source_quote_version, v_version
        USING ERRCODE = '22023';
    END IF;

    UPDATE public.jobs
    SET
      updated_at = v_now,
      source_quote_version = coalesce(source_quote_version, v_version),
      total_amount = v_amount,
      quote_number = coalesce(v_quote.quote_number::text, quote_number),
      lead_id = coalesce(v_quote.lead_id, lead_id),
      service_address = CASE
        WHEN service_address IS NULL OR btrim(service_address) = '' THEN v_service_address
        ELSE service_address
      END
    WHERE id = v_job.id
    RETURNING id INTO v_job_id;

    v_created := false;
    v_idempotent := true;
  ELSE
    v_created := true;
    v_idempotent := false;
  END IF;

  INSERT INTO public.events (tenant_id, entity_type, entity_id, event_type, actor_type, actor_id, payload)
  VALUES (
    v_quote.tenant_id,
    'quote',
    v_quote.id,
    'QuoteAccepted_JobEnsured',
    v_role,
    NULL,
    jsonb_build_object(
      'job_id', v_job_id,
      'quote_id', v_quote.id,
      'quote_version', v_version,
      'correlation_id', v_corr,
      'source', v_source,
      'idempotent', v_idempotent,
      'created', v_created,
      'slice', 'ml-p1-s3'
    )
  );

  RETURN jsonb_build_object(
    'job_id', v_job_id,
    'created', v_created,
    'idempotent', v_idempotent
  );
END;
$$;

REVOKE ALL ON FUNCTION public.ml_p1_s3_ensure_job_for_accepted_quote(uuid, text, text, text) FROM PUBLIC;

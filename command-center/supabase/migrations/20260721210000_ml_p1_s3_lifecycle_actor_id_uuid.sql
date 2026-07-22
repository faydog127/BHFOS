-- ML-P1 Slice 3 bounded remediation: events.actor_id uuid for office lifecycle.
-- Root cause: ml_p1_s2_quote_lifecycle wrote v_uid::text into events.actor_id (uuid).
-- Fix: write auth.uid() uuid for authenticated office/admin actors.
-- Public approve RPC unchanged (already NULL actor_id — approved nullable/system convention).
-- Does not alter job writer, deny paths, paid deferred behavior, or Slice 2 capability matrix.
-- No Edge/frontend changes required.

CREATE OR REPLACE FUNCTION public.ml_p1_s2_quote_lifecycle(
  p_action text,
  p_quote_id uuid,
  p_reason_code text DEFAULT NULL,
  p_rejection_reason text DEFAULT NULL,
  p_approval_method text DEFAULT NULL,
  p_valid_until date DEFAULT NULL,
  p_correlation_id text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_action text := lower(btrim(coalesce(p_action, '')));
  v_role text := public.ml_p1_s2_current_actor_role();
  v_uid uuid := auth.uid();
  v_tenant text;
  v_jwt_tenant text;
  v_quote public.quotes%ROWTYPE;
  v_prev text;
  v_now timestamptz := now();
  v_corr text := coalesce(nullif(btrim(p_correlation_id), ''), gen_random_uuid()::text);
  v_capability text;
  v_draft public.quotes%ROWTYPE;
  v_next_version int;
  v_amount numeric;
  v_updated int;
  v_job jsonb;
  v_job_id uuid;
  v_job_created boolean := false;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'ML_P1_S2_ROLE_DENY: unauthenticated actor cannot mutate quote money state'
      USING ERRCODE = '42501';
  END IF;

  v_jwt_tenant := nullif(btrim(coalesce(
    auth.jwt() -> 'app_metadata' ->> 'tenant_id',
    ''
  )), '');
  IF v_jwt_tenant IS NULL THEN
    RAISE EXCEPTION 'ML_P1_S2_TENANT_DENY: missing TVG tenant context'
      USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_quote
  FROM public.quotes
  WHERE id = p_quote_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'ML_P1_S2_QUOTE_NOT_FOUND: quote not found'
      USING ERRCODE = 'P0002';
  END IF;

  IF v_quote.tenant_id IS DISTINCT FROM v_jwt_tenant THEN
    RAISE EXCEPTION 'ML_P1_S2_TENANT_DENY: quote tenant mismatch'
      USING ERRCODE = '42501';
  END IF;

  v_tenant := v_quote.tenant_id;
  v_prev := v_quote.status;

  IF v_action = 'approve' THEN
    v_capability := 'quote.approve_break_glass';
  ELSIF v_action = 'ensure_job' THEN
    v_capability := 'quote.approve_break_glass';
  ELSIF v_action = 'issue' THEN
    v_capability := 'quote.issue';
  ELSIF v_action = 'revise' THEN
    v_capability := 'quote.revise';
  ELSIF v_action = 'reject' THEN
    v_capability := 'quote.reject_office';
  ELSIF v_action = 'expire' THEN
    v_capability := 'quote.expire';
  ELSE
    RAISE EXCEPTION 'ML_P1_S2_UNKNOWN_ACTION: %', p_action USING ERRCODE = '22023';
  END IF;

  PERFORM public.ml_p1_s2_assert_capability(v_capability, v_role, p_reason_code);
  PERFORM public.ml_p1_s2_assert_transition(v_action, v_quote.status);

  -- Repair path: accepted/approved without job (or idempotent re-ensure).
  IF v_action = 'ensure_job' THEN
    IF public.normalize_quote_status(v_quote.status) IS DISTINCT FROM 'accepted' THEN
      RAISE EXCEPTION 'ML_P1_S3_STATUS_DENY: ensure_job requires accepted quote'
        USING ERRCODE = '22023';
    END IF;
    v_job := public.ml_p1_s3_ensure_job_for_accepted_quote(
      v_quote.id, v_corr, v_role, 'office_break_glass_ensure'
    );
    RETURN jsonb_build_object(
      'action', 'ensure_job',
      'jobCreated', coalesce((v_job->>'created')::boolean, false),
      'idempotent', coalesce((v_job->>'idempotent')::boolean, true),
      'jobId', v_job->>'job_id',
      'correlationId', v_corr,
      'quote', to_jsonb(v_quote)
    );
  END IF;

  IF v_action = 'revise' THEN
    v_next_version := coalesce(v_quote.quote_version, 1) + 1;
    v_amount := coalesce(v_quote.total_amount, 0);

    UPDATE public.quotes
    SET status = 'revised', updated_at = v_now
    WHERE id = v_quote.id
      AND tenant_id = v_tenant
      AND lower(status) = lower(v_prev);

    GET DIAGNOSTICS v_updated = ROW_COUNT;
    IF v_updated <> 1 THEN
      RAISE EXCEPTION 'ML_P1_S2_TRANSITION_DENY: concurrent revise conflict'
        USING ERRCODE = '40001';
    END IF;

    INSERT INTO public.quotes (
      lead_id, tenant_id, status, service_address, customer_name, customer_email, customer_phone,
      subtotal, total_amount, tax_amount, tax_rate, header_text, footer_text, fulfillment_mode,
      estimate_id, user_id, inspection_id, inspection_revision, line_items,
      quote_version, supersedes_quote_id, created_at, updated_at
    ) VALUES (
      v_quote.lead_id, v_tenant, 'draft', v_quote.service_address, v_quote.customer_name,
      v_quote.customer_email, v_quote.customer_phone, v_quote.subtotal, v_amount,
      coalesce(v_quote.tax_amount, 0), coalesce(v_quote.tax_rate, 0),
      v_quote.header_text, v_quote.footer_text, v_quote.fulfillment_mode,
      v_quote.estimate_id, v_quote.user_id, v_quote.inspection_id, v_quote.inspection_revision,
      coalesce(v_quote.line_items, '[]'::jsonb),
      v_next_version, v_quote.id, v_now, v_now
    )
    RETURNING * INTO v_draft;

    INSERT INTO public.quote_items (quote_id, description, quantity, unit_price, total_price)
    SELECT v_draft.id, qi.description, qi.quantity, qi.unit_price, qi.total_price
    FROM public.quote_items qi
    WHERE qi.quote_id = v_quote.id;

    INSERT INTO public.events (tenant_id, entity_type, entity_id, event_type, actor_type, actor_id, payload)
    VALUES (
      v_tenant, 'quote', v_draft.id, 'quote.revised', v_role, v_uid,
      jsonb_build_object(
        'event_id', gen_random_uuid()::text,
        'record_id', v_draft.id,
        'record_type', 'quote',
        'tenant_id', v_tenant,
        'actor_id', v_uid::text,
        'actor_role', v_role,
        'previous_state', v_prev,
        'new_state', 'draft',
        'reason', coalesce(p_reason_code, 'revise'),
        'source_action', 'ml_p1_s2.revise_quote',
        'correlation_id', v_corr,
        'success', true,
        'timestamp', v_now,
        'quote_id', v_draft.id,
        'lead_id', v_draft.lead_id,
        'quote_version', v_draft.quote_version,
        'supersedes_quote_id', v_quote.id,
        'job_id', NULL,
        'invoice_id', NULL
      )
    );

    RETURN jsonb_build_object(
      'action', 'revise',
      'jobCreated', false,
      'idempotent', false,
      'jobId', NULL,
      'correlationId', v_corr,
      'superseded', v_quote.id,
      'quote', to_jsonb(v_draft)
    );
  END IF;

  IF v_action = 'issue' THEN
    UPDATE public.quotes
    SET status = 'issued',
        issued_at = v_now,
        valid_until = coalesce(p_valid_until, valid_until),
        updated_at = v_now
    WHERE id = v_quote.id
      AND tenant_id = v_tenant
      AND lower(status) = 'draft'
    RETURNING * INTO v_quote;
  ELSIF v_action = 'approve' THEN
    UPDATE public.quotes
    SET status = 'approved',
        accepted_at = v_now,
        approval_method = coalesce(nullif(btrim(p_approval_method), ''), 'admin_break_glass'),
        approved_by_actor_id = v_uid::text,
        approved_amount = coalesce(total_amount, 0),
        updated_at = v_now
    WHERE id = v_quote.id
      AND tenant_id = v_tenant
      AND lower(status) IN ('issued', 'sent', 'viewed')
    RETURNING * INTO v_quote;
  ELSIF v_action = 'reject' THEN
    UPDATE public.quotes
    SET status = 'rejected',
        rejected_at = v_now,
        rejection_reason = coalesce(p_rejection_reason, p_reason_code, 'rejected'),
        updated_at = v_now
    WHERE id = v_quote.id
      AND tenant_id = v_tenant
      AND lower(status) IN ('issued', 'draft', 'sent', 'viewed')
    RETURNING * INTO v_quote;
  ELSIF v_action = 'expire' THEN
    UPDATE public.quotes
    SET status = 'expired',
        expired_at = v_now,
        updated_at = v_now
    WHERE id = v_quote.id
      AND tenant_id = v_tenant
      AND lower(status) IN ('issued', 'sent', 'viewed')
    RETURNING * INTO v_quote;
  END IF;

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  IF v_updated <> 1 THEN
    SELECT * INTO v_quote FROM public.quotes WHERE id = p_quote_id AND tenant_id = v_tenant;
    IF v_action = 'approve' AND public.normalize_quote_status(v_quote.status) = 'accepted' THEN
      v_job := public.ml_p1_s3_ensure_job_for_accepted_quote(
        v_quote.id, v_corr, v_role, 'office_break_glass'
      );
      RETURN jsonb_build_object(
        'action', 'approve',
        'jobCreated', coalesce((v_job->>'created')::boolean, false),
        'idempotent', true,
        'jobId', v_job->>'job_id',
        'correlationId', v_corr,
        'quote', to_jsonb(v_quote)
      );
    END IF;
    RAISE EXCEPTION 'ML_P1_S2_TRANSITION_DENY: concurrent transition conflict for %', v_action
      USING ERRCODE = '40001';
  END IF;

  IF v_action = 'approve' THEN
    v_job := public.ml_p1_s3_ensure_job_for_accepted_quote(
      v_quote.id, v_corr, v_role, 'office_break_glass'
    );
    v_job_id := nullif(v_job->>'job_id', '')::uuid;
    v_job_created := coalesce((v_job->>'created')::boolean, false);
  END IF;

  INSERT INTO public.events (tenant_id, entity_type, entity_id, event_type, actor_type, actor_id, payload)
  VALUES (
    v_tenant,
    'quote',
    v_quote.id,
    CASE v_action
      WHEN 'issue' THEN 'quote.issued'
      WHEN 'approve' THEN 'quote.approved'
      WHEN 'reject' THEN 'quote.rejected'
      WHEN 'expire' THEN 'quote.expired'
    END,
    v_role,
    v_uid,
    jsonb_build_object(
      'event_id', gen_random_uuid()::text,
      'record_id', v_quote.id,
      'record_type', 'quote',
      'tenant_id', v_tenant,
      'actor_id', v_uid::text,
      'actor_role', v_role,
      'previous_state', v_prev,
      'new_state', v_quote.status,
      'reason', coalesce(p_reason_code, p_rejection_reason),
      'source_action', 'ml_p1_s2.' || v_action || '_quote',
      'correlation_id', v_corr,
      'success', true,
      'timestamp', v_now,
      'quote_id', v_quote.id,
      'lead_id', v_quote.lead_id,
      'quote_version', v_quote.quote_version,
      'approved_amount', v_quote.approved_amount,
      'approval_method', v_quote.approval_method,
      'job_id', v_job_id,
      'invoice_id', NULL
    )
  );

  RETURN jsonb_build_object(
    'action', v_action,
    'jobCreated', v_job_created,
    'idempotent', false,
    'jobId', v_job_id,
    'correlationId', v_corr,
    'quote', to_jsonb(v_quote)
  );
END;
$$;

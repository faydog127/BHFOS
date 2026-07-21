-- ML-P1 Slice 3 — Canonical server-side job writer (approved quote → exactly one job).
-- Baseline: ef2470715ddf90c34a77416183eb5b2421bd6373
-- Does NOT flip auto_create_job_on_quote_acceptance=true.
-- Stop: before field execution / invoice / Stripe / follow-up.

BEGIN;

-- ---------------------------------------------------------------------------
-- M1: Lineage column
-- ---------------------------------------------------------------------------
ALTER TABLE public.jobs
  ADD COLUMN IF NOT EXISTS source_quote_version integer;

COMMENT ON COLUMN public.jobs.source_quote_version IS
  'ML-P1 S3: quotes.quote_version pinned at canonical accept→job create.';

-- ---------------------------------------------------------------------------
-- M2: Canonical writer
-- ---------------------------------------------------------------------------
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

  -- Idempotent path: existing quote-linked job.
  SELECT * INTO v_job
  FROM public.jobs
  WHERE quote_id = v_quote.id
  LIMIT 1;

  IF FOUND THEN
    IF v_job.source_quote_version IS NOT NULL
       AND v_job.source_quote_version IS DISTINCT FROM v_version THEN
      RAISE EXCEPTION 'ML_P1_S3_VERSION_MISMATCH: existing job pinned to version %; quote is %',
        v_job.source_quote_version, v_version
        USING ERRCODE = '22023';
    END IF;

    -- Backfill empty address / missing version pin only (no pricing drift).
    UPDATE public.jobs
    SET
      updated_at = v_now,
      source_quote_version = coalesce(source_quote_version, v_version),
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
      source_quote_version
    ) VALUES (
      v_quote.tenant_id,
      v_quote.lead_id,
      v_quote.id,
      v_quote.quote_number,
      'unscheduled',
      'unpaid',
      v_amount,
      v_service_address,
      public.next_work_order_number(v_quote.tenant_id, coalesce(v_quote.created_at, v_now)),
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
    SELECT id INTO v_job_id
    FROM public.jobs
    WHERE quote_id = v_quote.id
    LIMIT 1;

    IF v_job_id IS NULL THEN
      RAISE EXCEPTION 'ML_P1_S3_JOB_ENSURE_FAILED: could not create or load job for quote'
        USING ERRCODE = 'P0001';
    END IF;

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
-- Callable only by SECURITY DEFINER approve RPCs (same owner); no client GRANT.

-- ---------------------------------------------------------------------------
-- M4: Neutralize trigger inserts — accepted/paid never create jobs.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.ensure_job_and_optional_draft_invoice_for_accepted_quote()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_new_status text;
  v_old_status text;
BEGIN
  v_new_status := public.normalize_quote_status(new.status);

  IF tg_op = 'INSERT' THEN
    v_old_status := '';
  ELSE
    v_old_status := public.normalize_quote_status(old.status);
  END IF;

  IF new.tenant_id IS NULL OR btrim(new.tenant_id) = '' THEN
    RETURN new;
  END IF;

  -- S3: accept → deferred only. Canonical create is RPC-only.
  IF v_new_status = 'accepted' AND v_old_status <> 'accepted' THEN
    INSERT INTO public.events (tenant_id, entity_type, entity_id, event_type, actor_type, payload)
    VALUES (
      new.tenant_id,
      'quote',
      new.id,
      'QuoteAccepted_JobCreateDeferred',
      'system',
      jsonb_build_object(
        'reason', 'ml-p1-s3-rpc-only-job-writer',
        'slice', 'ml-p1-s3',
        'auto_create_job_on_quote_acceptance', 'ignored'
      )
    );
    RETURN new;
  END IF;

  -- S3: paid → deferred only (no job/invoice inserts).
  IF lower(btrim(coalesce(new.status, ''))) = 'paid'
     AND lower(btrim(coalesce(old.status, ''))) <> 'paid' THEN
    INSERT INTO public.events (tenant_id, entity_type, entity_id, event_type, actor_type, payload)
    VALUES (
      new.tenant_id,
      'quote',
      new.id,
      'QuotePaid_JobCreateDeferred',
      'system',
      jsonb_build_object(
        'reason', 'ml-p1-s3-paid-deferred-no-job-insert',
        'slice', 'ml-p1-s3'
      )
    );
    RETURN new;
  END IF;

  RETURN new;
END;
$$;

-- Keep WO-on-accept neutralized (still deferred).
CREATE OR REPLACE FUNCTION public.trg_emit_wo_on_quote_accept()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_new text;
  v_old text;
BEGIN
  v_new := public.normalize_quote_status(new.status);
  IF tg_op = 'INSERT' THEN
    v_old := '';
  ELSE
    v_old := public.normalize_quote_status(old.status);
  END IF;

  IF v_new = 'accepted' AND v_old IS DISTINCT FROM 'accepted' THEN
    INSERT INTO public.events (tenant_id, entity_type, entity_id, event_type, actor_type, payload)
    VALUES (
      new.tenant_id,
      'quote',
      new.id,
      'QuoteAccepted_WorkOrderDeferred',
      'system',
      jsonb_build_object(
        'reason', 'ml-p1-s3-wo-neutralized',
        'slice', 'ml-p1-s3'
      )
    );
  END IF;

  RETURN new;
END;
$$;

-- ---------------------------------------------------------------------------
-- M3: Drop S2 gate-off accept belt (writer is mandatory in approve RPCs).
-- ---------------------------------------------------------------------------
DROP TRIGGER IF EXISTS trg_ml_p1_s2_require_job_gate_off_on_accept ON public.quotes;

CREATE OR REPLACE FUNCTION public.ml_p1_s2_trg_require_job_gate_off_on_accept()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  -- S3: belt retired. Accept is allowed; job ensure is RPC-owned.
  RETURN new;
END;
$$;

-- ---------------------------------------------------------------------------
-- Wire approve RPCs: remove gate checks; call canonical writer in-txn.
-- ---------------------------------------------------------------------------
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
      v_tenant, 'quote', v_draft.id, 'quote.revised', v_role, v_uid::text,
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
      AND lower(status) = 'issued'
    RETURNING * INTO v_quote;
  ELSIF v_action = 'reject' THEN
    UPDATE public.quotes
    SET status = 'rejected',
        rejected_at = v_now,
        rejection_reason = coalesce(p_rejection_reason, p_reason_code, 'rejected'),
        updated_at = v_now
    WHERE id = v_quote.id
      AND tenant_id = v_tenant
      AND lower(status) IN ('issued', 'draft')
    RETURNING * INTO v_quote;
  ELSIF v_action = 'expire' THEN
    UPDATE public.quotes
    SET status = 'expired',
        expired_at = v_now,
        updated_at = v_now
    WHERE id = v_quote.id
      AND tenant_id = v_tenant
      AND lower(status) = 'issued'
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
    v_uid::text,
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

CREATE OR REPLACE FUNCTION public.ml_p1_s2_quote_approve_public(
  p_public_token text,
  p_correlation_id text DEFAULT NULL,
  p_approval_method text DEFAULT 'public_token'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_token text := btrim(coalesce(p_public_token, ''));
  v_quote public.quotes%ROWTYPE;
  v_prev text;
  v_now timestamptz := now();
  v_corr text := coalesce(nullif(btrim(p_correlation_id), ''), gen_random_uuid()::text);
  v_updated int;
  v_expiry timestamptz;
  v_job jsonb;
  v_job_id uuid;
  v_job_created boolean := false;
BEGIN
  IF auth.uid() IS NOT NULL THEN
    RAISE EXCEPTION 'ML_P1_S2_ROLE_DENY: authenticated sessions cannot use public-token approve'
      USING ERRCODE = '42501';
  END IF;

  IF v_token = '' THEN
    RAISE EXCEPTION 'ML_P1_S2_MISSING_TOKEN: public_token required'
      USING ERRCODE = '22023';
  END IF;

  PERFORM public.ml_p1_s2_assert_capability('quote.approve_customer', 'customer', NULL);

  SELECT * INTO v_quote
  FROM public.quotes
  WHERE public_token::text = v_token
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'ML_P1_S2_QUOTE_NOT_FOUND: quote not found for token'
      USING ERRCODE = 'P0002';
  END IF;

  IF v_quote.tenant_id IS NULL OR btrim(v_quote.tenant_id) = '' THEN
    RAISE EXCEPTION 'ML_P1_S2_TENANT_DENY: quote missing tenant_id'
      USING ERRCODE = '42501';
  END IF;

  IF public.normalize_quote_status(v_quote.status) = 'accepted' THEN
    v_job := public.ml_p1_s3_ensure_job_for_accepted_quote(
      v_quote.id, v_corr, 'customer', 'customer_public'
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

  IF v_quote.valid_until IS NOT NULL THEN
    v_expiry := ((v_quote.valid_until::date + 1)::timestamp AT TIME ZONE 'UTC') - interval '1 second';
  ELSIF v_quote.sent_at IS NOT NULL THEN
    v_expiry := v_quote.sent_at + interval '7 days';
  ELSE
    v_expiry := NULL;
  END IF;

  IF v_expiry IS NOT NULL
     AND v_now > v_expiry
     AND lower(coalesce(v_quote.status, '')) NOT IN ('approved', 'accepted', 'paid', 'declined', 'rejected', 'expired') THEN
    RAISE EXCEPTION 'ML_P1_S2_QUOTE_EXPIRED: quote has expired and cannot be approved'
      USING ERRCODE = 'P0001';
  END IF;

  PERFORM public.ml_p1_s2_assert_transition('approve', v_quote.status);
  v_prev := v_quote.status;

  UPDATE public.quotes
  SET status = 'approved',
      accepted_at = v_now,
      approval_method = coalesce(nullif(btrim(p_approval_method), ''), 'public_token'),
      approved_by_actor_id = NULL,
      approved_amount = coalesce(total_amount, 0),
      updated_at = v_now
  WHERE id = v_quote.id
    AND tenant_id = v_quote.tenant_id
    AND public_token::text = v_token
    AND lower(status) = 'issued'
  RETURNING * INTO v_quote;

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  IF v_updated <> 1 THEN
    SELECT * INTO v_quote FROM public.quotes WHERE public_token::text = v_token;
    IF public.normalize_quote_status(v_quote.status) = 'accepted' THEN
      v_job := public.ml_p1_s3_ensure_job_for_accepted_quote(
        v_quote.id, v_corr, 'customer', 'customer_public'
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
    RAISE EXCEPTION 'ML_P1_S2_TRANSITION_DENY: concurrent approve conflict'
      USING ERRCODE = '40001';
  END IF;

  v_job := public.ml_p1_s3_ensure_job_for_accepted_quote(
    v_quote.id, v_corr, 'customer', 'customer_public'
  );
  v_job_id := nullif(v_job->>'job_id', '')::uuid;
  v_job_created := coalesce((v_job->>'created')::boolean, false);

  INSERT INTO public.events (tenant_id, entity_type, entity_id, event_type, actor_type, actor_id, payload)
  VALUES (
    v_quote.tenant_id,
    'quote',
    v_quote.id,
    'quote.approved',
    'customer',
    NULL,
    jsonb_build_object(
      'event_id', gen_random_uuid()::text,
      'record_id', v_quote.id,
      'record_type', 'quote',
      'tenant_id', v_quote.tenant_id,
      'actor_id', NULL,
      'actor_role', 'customer',
      'previous_state', v_prev,
      'new_state', v_quote.status,
      'reason', NULL,
      'source_action', 'ml_p1_s2.approve_quote_public_token',
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
    'action', 'approve',
    'jobCreated', v_job_created,
    'idempotent', false,
    'jobId', v_job_id,
    'correlationId', v_corr,
    'quote', to_jsonb(v_quote)
  );
END;
$$;

COMMIT;

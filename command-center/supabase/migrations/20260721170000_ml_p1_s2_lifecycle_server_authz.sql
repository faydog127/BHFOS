-- ML-P1 Slice 2 remediation — server R-S1-03 + transition RPCs, RLS tighten,
-- accept blocked unless job-create gate is explicitly off, atomic revise,
-- concurrent-safe approve.
--
-- Authority: Founder S2 remediation auth for PR #78 blockers.
-- Does NOT authorize production apply (separate A3). No Stripe/job/invoice product.

BEGIN;

-- ---------------------------------------------------------------------------
-- Role + capability helpers (server-side R-S1-03; ignore client-supplied role)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.ml_p1_s2_normalize_role(p_role text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE lower(btrim(coalesce(p_role, '')))
    WHEN 'admin' THEN 'admin'
    WHEN 'super_admin' THEN 'admin'
    WHEN 'manager' THEN 'manager'
    WHEN 'office' THEN 'office'
    WHEN 'csr' THEN 'office'
    WHEN 'technician' THEN 'technician'
    WHEN 'tech' THEN 'technician'
    WHEN 'customer' THEN 'customer'
    WHEN 'public' THEN 'customer'
    WHEN 'designated_customer' THEN 'customer'
    ELSE 'unauthenticated'
  END;
$$;

CREATE OR REPLACE FUNCTION public.ml_p1_s2_current_actor_role()
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role text;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN 'unauthenticated';
  END IF;

  SELECT r.role INTO v_role
  FROM public.app_user_roles r
  WHERE r.user_id = auth.uid()
  ORDER BY r.created_at DESC NULLS LAST
  LIMIT 1;

  IF v_role IS NULL OR btrim(v_role) = '' THEN
    v_role := coalesce(
      auth.jwt() -> 'app_metadata' ->> 'role',
      auth.jwt() -> 'user_metadata' ->> 'role',
      'viewer'
    );
  END IF;

  RETURN public.ml_p1_s2_normalize_role(v_role);
END;
$$;

CREATE OR REPLACE FUNCTION public.ml_p1_s2_job_gate_is_off()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT lower(btrim(coalesce(
    (SELECT value FROM public.global_config WHERE key = 'auto_create_job_on_quote_acceptance' LIMIT 1),
    'true'  -- fail-closed: missing key => treat as NOT off (block accept)
  ))) IN ('0', 'false', 'no', 'off');
$$;

CREATE OR REPLACE FUNCTION public.ml_p1_s2_assert_capability(
  p_capability text,
  p_role text,
  p_reason_code text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  v_role text := public.ml_p1_s2_normalize_role(p_role);
  v_cap text := lower(btrim(coalesce(p_capability, '')));
  v_ok boolean := false;
BEGIN
  IF v_role = 'unauthenticated' THEN
    RAISE EXCEPTION 'ML_P1_S2_ROLE_DENY: unauthenticated actor cannot mutate quote money state'
      USING ERRCODE = '42501';
  END IF;

  IF v_cap = 'quote.approve_break_glass' AND (p_reason_code IS NULL OR btrim(p_reason_code) = '') THEN
    RAISE EXCEPTION 'ML_P1_S2_BREAK_GLASS_REASON_REQUIRED: admin break-glass approve requires reason_code'
      USING ERRCODE = '42501';
  END IF;

  v_ok := CASE v_cap
    WHEN 'quote.draft_edit' THEN v_role IN ('office', 'manager', 'admin')
    WHEN 'quote.issue' THEN v_role IN ('office', 'manager', 'admin')
    WHEN 'quote.revise' THEN v_role IN ('office', 'manager', 'admin')
    WHEN 'quote.reject_office' THEN v_role IN ('office', 'manager', 'admin')
    WHEN 'quote.expire' THEN v_role IN ('office', 'manager', 'admin')
    WHEN 'quote.approve_customer' THEN v_role = 'customer'
    WHEN 'quote.approve_break_glass' THEN v_role = 'admin'
    ELSE false
  END;

  IF NOT v_ok THEN
    RAISE EXCEPTION 'ML_P1_S2_ROLE_DENY: role "%" cannot perform %', v_role, v_cap
      USING ERRCODE = '42501';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.ml_p1_s2_assert_transition(p_action text, p_status text)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  v_action text := lower(btrim(coalesce(p_action, '')));
  v_status text := lower(btrim(coalesce(p_status, '')));
  v_ok boolean := false;
BEGIN
  v_ok := CASE v_action
    WHEN 'issue' THEN v_status = 'draft'
    WHEN 'approve' THEN v_status = 'issued'
    WHEN 'reject' THEN v_status IN ('issued', 'draft')
    WHEN 'expire' THEN v_status = 'issued'
    WHEN 'revise' THEN v_status IN ('issued', 'rejected', 'expired')
    ELSE false
  END;

  IF NOT v_ok THEN
    RAISE EXCEPTION 'ML_P1_S2_TRANSITION_DENY: cannot % quote in status "%"', v_action, p_status
      USING ERRCODE = '22023';
  END IF;
END;
$$;

-- Belt: block accept/approved write unless job gate explicitly off (post-A3 + pre-S3).
CREATE OR REPLACE FUNCTION public.ml_p1_s2_trg_require_job_gate_off_on_accept()
RETURNS trigger
LANGUAGE plpgsql
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
    IF NOT public.ml_p1_s2_job_gate_is_off() THEN
      RAISE EXCEPTION 'ML_P1_S2_JOB_GATE_REQUIRED: cannot accept quote while auto_create_job_on_quote_acceptance is not false'
        USING ERRCODE = 'P0001';
    END IF;
  END IF;
  RETURN new;
END;
$$;

DROP TRIGGER IF EXISTS trg_ml_p1_s2_require_job_gate_off_on_accept ON public.quotes;
CREATE TRIGGER trg_ml_p1_s2_require_job_gate_off_on_accept
BEFORE INSERT OR UPDATE OF status ON public.quotes
FOR EACH ROW
EXECUTE FUNCTION public.ml_p1_s2_trg_require_job_gate_off_on_accept();

-- ---------------------------------------------------------------------------
-- Canonical lifecycle RPC (authenticated office/admin paths)
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
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'ML_P1_S2_ROLE_DENY: unauthenticated actor cannot mutate quote money state'
      USING ERRCODE = '42501';
  END IF;

  v_jwt_tenant := nullif(btrim(coalesce(
    auth.jwt() -> 'app_metadata' ->> 'tenant_id',
    auth.jwt() -> 'user_metadata' ->> 'tenant_id'
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

  IF v_action = 'approve' THEN
    IF NOT public.ml_p1_s2_job_gate_is_off() THEN
      RAISE EXCEPTION 'ML_P1_S2_JOB_GATE_REQUIRED: cannot approve until auto_create_job_on_quote_acceptance=false'
        USING ERRCODE = 'P0001';
    END IF;
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
      subtotal, total_amount, tax_amount, notes, quote_version, supersedes_quote_id, created_at, updated_at
    ) VALUES (
      v_quote.lead_id, v_tenant, 'draft', v_quote.service_address, v_quote.customer_name,
      v_quote.customer_email, v_quote.customer_phone, v_quote.subtotal, v_amount,
      coalesce(v_quote.tax_amount, 0), v_quote.notes, v_next_version, v_quote.id, v_now, v_now
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
      RETURN jsonb_build_object(
        'action', 'approve',
        'jobCreated', false,
        'idempotent', true,
        'correlationId', v_corr,
        'quote', to_jsonb(v_quote)
      );
    END IF;
    RAISE EXCEPTION 'ML_P1_S2_TRANSITION_DENY: concurrent transition conflict for %', v_action
      USING ERRCODE = '40001';
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
      'job_id', NULL,
      'invoice_id', NULL
    )
  );

  RETURN jsonb_build_object(
    'action', v_action,
    'jobCreated', false,
    'idempotent', false,
    'correlationId', v_corr,
    'quote', to_jsonb(v_quote)
  );
END;
$$;

-- ---------------------------------------------------------------------------
-- Public-token approve (anon / edge). Never trusts client role.
-- Authenticated sessions are DENY (use lifecycle break-glass instead).
-- ---------------------------------------------------------------------------
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
BEGIN
  IF auth.uid() IS NOT NULL THEN
    RAISE EXCEPTION 'ML_P1_S2_ROLE_DENY: authenticated sessions cannot use public-token approve'
      USING ERRCODE = '42501';
  END IF;

  IF v_token = '' THEN
    RAISE EXCEPTION 'ML_P1_S2_MISSING_TOKEN: public_token required'
      USING ERRCODE = '22023';
  END IF;

  IF NOT public.ml_p1_s2_job_gate_is_off() THEN
    RAISE EXCEPTION 'ML_P1_S2_JOB_GATE_REQUIRED: cannot approve until auto_create_job_on_quote_acceptance=false'
      USING ERRCODE = 'P0001';
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

  -- Idempotent replay: already accepted
  IF public.normalize_quote_status(v_quote.status) = 'accepted' THEN
    RETURN jsonb_build_object(
      'action', 'approve',
      'jobCreated', false,
      'idempotent', true,
      'correlationId', v_corr,
      'quote', to_jsonb(v_quote)
    );
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
      RETURN jsonb_build_object(
        'action', 'approve',
        'jobCreated', false,
        'idempotent', true,
        'correlationId', v_corr,
        'quote', to_jsonb(v_quote)
      );
    END IF;
    RAISE EXCEPTION 'ML_P1_S2_TRANSITION_DENY: concurrent approve conflict'
      USING ERRCODE = '40001';
  END IF;

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
      'job_id', NULL,
      'invoice_id', NULL
    )
  );

  RETURN jsonb_build_object(
    'action', 'approve',
    'jobCreated', false,
    'idempotent', false,
    'correlationId', v_corr,
    'quote', to_jsonb(v_quote)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.ml_p1_s2_quote_lifecycle(text, uuid, text, text, text, date, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.ml_p1_s2_quote_approve_public(text, text, text) TO anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- RLS: authenticated users may update draft quotes only while status stays draft.
-- Lifecycle status changes go through SECURITY DEFINER RPCs.
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Quotes updatable by tenant" ON public.quotes;
CREATE POLICY "Quotes draft updatable by tenant"
ON public.quotes
FOR UPDATE
USING (
  (
    tenant_id = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')
    OR user_id = auth.uid()
  )
  AND lower(coalesce(status, 'draft')) = 'draft'
)
WITH CHECK (
  (
    tenant_id = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')
    OR user_id = auth.uid()
  )
  AND lower(coalesce(status, 'draft')) = 'draft'
);

COMMIT;

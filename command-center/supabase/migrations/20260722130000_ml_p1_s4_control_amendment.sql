-- ML-P1 Slice 4 — control amendment remediation (Founder 2026-07-22).
-- Make-safe queue/evidence/notify; break-glass immutable evidence; time operational-only.
-- Does not create invoices. Does not expand to Slice 5.

BEGIN;

-- ---------------------------------------------------------------------------
-- Make-safe controls (§8)
-- ---------------------------------------------------------------------------
ALTER TABLE public.job_make_safe_events
  ADD COLUMN IF NOT EXISTS reason_code text,
  ADD COLUMN IF NOT EXISTS customer_notified_at timestamptz,
  ADD COLUMN IF NOT EXISTS customer_notification_method text,
  ADD COLUMN IF NOT EXISTS office_review_status text NOT NULL DEFAULT 'pending_office_review',
  ADD COLUMN IF NOT EXISTS office_reviewed_at timestamptz,
  ADD COLUMN IF NOT EXISTS office_reviewed_by uuid,
  ADD COLUMN IF NOT EXISTS evidence_before_ref text,
  ADD COLUMN IF NOT EXISTS evidence_after_ref text;

ALTER TABLE public.job_make_safe_events
  DROP CONSTRAINT IF EXISTS job_make_safe_office_review_check;
ALTER TABLE public.job_make_safe_events
  ADD CONSTRAINT job_make_safe_office_review_check
  CHECK (office_review_status IN ('pending_office_review', 'reviewed', 'returned'));

ALTER TABLE public.job_make_safe_events
  DROP CONSTRAINT IF EXISTS job_make_safe_notify_method_check;
ALTER TABLE public.job_make_safe_events
  ADD CONSTRAINT job_make_safe_notify_method_check
  CHECK (
    customer_notification_method IS NULL
    OR customer_notification_method IN ('in_person', 'phone', 'sms', 'email', 'other')
  );

COMMENT ON TABLE public.job_make_safe_events IS
  'ML-P1 S4 make-safe allowlist actions: never billable; office review required; separate CO required for billable repair.';

-- ---------------------------------------------------------------------------
-- Break-glass immutable evidence (§9)
-- ---------------------------------------------------------------------------
ALTER TABLE public.change_orders
  ADD COLUMN IF NOT EXISTS customer_auth_evidence_type text,
  ADD COLUMN IF NOT EXISTS customer_auth_evidence_ref text,
  ADD COLUMN IF NOT EXISTS customer_auth_at timestamptz;

ALTER TABLE public.change_orders
  DROP CONSTRAINT IF EXISTS change_orders_break_glass_proof;
ALTER TABLE public.change_orders
  ADD CONSTRAINT change_orders_break_glass_evidence CHECK (
    approval_method IS DISTINCT FROM 'break_glass'
    OR (
      break_glass_reason IS NOT NULL AND btrim(break_glass_reason) <> ''
      AND customer_auth_evidence_type IS NOT NULL AND btrim(customer_auth_evidence_type) <> ''
      AND customer_auth_evidence_ref IS NOT NULL AND btrim(customer_auth_evidence_ref) <> ''
      AND customer_auth_at IS NOT NULL
    )
  );

ALTER TABLE public.change_orders
  DROP CONSTRAINT IF EXISTS change_orders_auth_evidence_type_check;
ALTER TABLE public.change_orders
  ADD CONSTRAINT change_orders_auth_evidence_type_check
  CHECK (
    customer_auth_evidence_type IS NULL
    OR customer_auth_evidence_type IN (
      'recorded_verbal', 'email', 'sms', 'signed_document', 'portal_token', 'other_approved'
    )
  );

-- ---------------------------------------------------------------------------
-- Time/mileage operational-only (§10)
-- ---------------------------------------------------------------------------
ALTER TABLE public.job_time_events
  ADD COLUMN IF NOT EXISTS record_class text NOT NULL DEFAULT 'operational_only',
  ADD COLUMN IF NOT EXISTS prior_started_at timestamptz,
  ADD COLUMN IF NOT EXISTS prior_ended_at timestamptz,
  ADD COLUMN IF NOT EXISTS prior_miles numeric(12, 2),
  ADD COLUMN IF NOT EXISTS corrected_started_at timestamptz,
  ADD COLUMN IF NOT EXISTS corrected_ended_at timestamptz,
  ADD COLUMN IF NOT EXISTS corrected_miles numeric(12, 2);

ALTER TABLE public.job_time_events
  DROP CONSTRAINT IF EXISTS job_time_events_record_class_check;
ALTER TABLE public.job_time_events
  ADD CONSTRAINT job_time_events_record_class_check
  CHECK (record_class = 'operational_only');

COMMENT ON COLUMN public.job_time_events.record_class IS
  'ML-P1 S4: operational records only — not payroll, reimbursement, customer billing, or compensation unless separately authorized.';

-- ---------------------------------------------------------------------------
-- Replace make-safe RPC with amendment fields
-- ---------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.ml_p1_s4_record_make_safe(uuid, text, text, text, jsonb);

CREATE OR REPLACE FUNCTION public.ml_p1_s4_record_make_safe(
  p_job_id uuid,
  p_action_type text,
  p_summary text,
  p_client_mutation_id text,
  p_evidence_refs jsonb DEFAULT '[]'::jsonb,
  p_reason_code text DEFAULT NULL,
  p_customer_notification_method text DEFAULT NULL,
  p_evidence_before_ref text DEFAULT NULL,
  p_evidence_after_ref text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_job public.jobs%ROWTYPE;
  v_role text := public.ml_p1_s2_current_actor_role();
  v_mut text := nullif(btrim(coalesce(p_client_mutation_id, '')), '');
  v_id uuid;
  v_existing public.job_execution_mutations%ROWTYPE;
  v_action text := lower(btrim(coalesce(p_action_type, '')));
  v_before text := nullif(btrim(coalesce(p_evidence_before_ref, '')), '');
  v_after text := nullif(btrim(coalesce(p_evidence_after_ref, '')), '');
  v_notify text := lower(btrim(coalesce(p_customer_notification_method, '')));
BEGIN
  IF v_mut IS NULL THEN
    RAISE EXCEPTION 'ML_P1_S4_MUTATION_ID_REQUIRED' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_existing
  FROM public.job_execution_mutations
  WHERE job_id = p_job_id AND client_mutation_id = v_mut;
  IF FOUND THEN
    RETURN v_existing.result || jsonb_build_object('idempotent', true);
  END IF;

  SELECT * INTO v_job FROM public.jobs WHERE id = p_job_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'ML_P1_S4_JOB_NOT_FOUND' USING ERRCODE = 'P0002';
  END IF;

  PERFORM public.ml_p1_s4_assert_capability('job.field_transition', v_role);
  PERFORM public.ml_p1_s4_assert_job_assignment(v_job, v_role, true);

  IF v_action NOT IN (
    'stop_equipment', 'disconnect_appliance', 'secure_component',
    'document_condition', 'advise_customer'
  ) THEN
    RAISE EXCEPTION 'ML_P1_S4_MAKE_SAFE_ALLOWLIST_DENY: %', v_action USING ERRCODE = '22023';
  END IF;

  IF p_reason_code IS NULL OR btrim(p_reason_code) = '' THEN
    RAISE EXCEPTION 'ML_P1_S4_MAKE_SAFE_REASON_REQUIRED' USING ERRCODE = '22023';
  END IF;
  IF v_before IS NULL OR v_after IS NULL THEN
    RAISE EXCEPTION 'ML_P1_S4_MAKE_SAFE_EVIDENCE_REQUIRED: before and after evidence refs required'
      USING ERRCODE = '22023';
  END IF;
  IF v_before ILIKE 'blob:%' OR v_after ILIKE 'blob:%'
     OR v_before ILIKE 'pending-upload:%' OR v_after ILIKE 'pending-upload:%' THEN
    RAISE EXCEPTION 'ML_P1_S4_MAKE_SAFE_EVIDENCE_INVALID' USING ERRCODE = '22023';
  END IF;
  IF v_notify IS NULL OR v_notify NOT IN ('in_person', 'phone', 'sms', 'email', 'other') THEN
    RAISE EXCEPTION 'ML_P1_S4_MAKE_SAFE_NOTIFY_REQUIRED' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.job_make_safe_events (
    tenant_id, job_id, action_type, summary, evidence_refs, billable, actor_user_id,
    client_mutation_id, reason_code, customer_notified_at, customer_notification_method,
    office_review_status, evidence_before_ref, evidence_after_ref
  ) VALUES (
    v_job.tenant_id, v_job.id, v_action, btrim(p_summary),
    coalesce(p_evidence_refs, '[]'::jsonb), false, auth.uid(), v_mut,
    btrim(p_reason_code), now(), v_notify, 'pending_office_review', v_before, v_after
  )
  RETURNING id INTO v_id;

  PERFORM public.ml_p1_s4_set_writer_context();
  UPDATE public.jobs
  SET
    make_safe_recorded_at = now(),
    make_safe_summary = btrim(p_summary),
    updated_at = now(),
    execution_row_version = coalesce(execution_row_version, 1) + 1
  WHERE id = p_job_id
  RETURNING * INTO v_job;

  PERFORM public.ml_p1_s4_emit_job_event(
    v_job.tenant_id, v_job.id, 'JobMakeSafeRecorded', v_role,
    jsonb_build_object(
      'make_safe_id', v_id,
      'action_type', v_action,
      'billable', false,
      'office_review_status', 'pending_office_review',
      'client_mutation_id', v_mut
    )
  );

  INSERT INTO public.job_execution_mutations (
    tenant_id, job_id, action, client_mutation_id, actor_user_id, actor_role,
    from_status, to_status, result
  ) VALUES (
    v_job.tenant_id, v_job.id, 'make_safe', v_mut, auth.uid(), v_role,
    v_job.status, v_job.status,
    jsonb_build_object(
      'job_id', v_job.id,
      'make_safe_id', v_id,
      'billable', false,
      'office_review_status', 'pending_office_review'
    )
  );

  RETURN jsonb_build_object(
    'job_id', v_job.id,
    'make_safe_id', v_id,
    'billable', false,
    'office_review_status', 'pending_office_review'
  );
END;
$$;

-- ---------------------------------------------------------------------------
-- Time correction RPC (§10)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.ml_p1_s4_correct_time_event(
  p_job_id uuid,
  p_source_event_id uuid,
  p_client_mutation_id text,
  p_reason text,
  p_corrected_started_at timestamptz DEFAULT NULL,
  p_corrected_ended_at timestamptz DEFAULT NULL,
  p_corrected_miles numeric DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_job public.jobs%ROWTYPE;
  v_src public.job_time_events%ROWTYPE;
  v_role text := public.ml_p1_s2_current_actor_role();
  v_mut text := nullif(btrim(coalesce(p_client_mutation_id, '')), '');
  v_new uuid;
BEGIN
  IF v_mut IS NULL THEN
    RAISE EXCEPTION 'ML_P1_S4_MUTATION_ID_REQUIRED' USING ERRCODE = '22023';
  END IF;
  IF p_reason IS NULL OR btrim(p_reason) = '' THEN
    RAISE EXCEPTION 'ML_P1_S4_REASON_REQUIRED: time correction requires reason' USING ERRCODE = '22023';
  END IF;

  PERFORM public.ml_p1_s4_assert_capability('job.time_correct', v_role);

  SELECT * INTO v_job FROM public.jobs WHERE id = p_job_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'ML_P1_S4_JOB_NOT_FOUND' USING ERRCODE = 'P0002';
  END IF;

  SELECT * INTO v_src FROM public.job_time_events WHERE id = p_source_event_id AND job_id = p_job_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'ML_P1_S4_TIME_EVENT_NOT_FOUND' USING ERRCODE = 'P0002';
  END IF;

  INSERT INTO public.job_time_events (
    tenant_id, job_id, event_type, started_at, ended_at, miles, source, actor_id,
    reason_code, note, client_mutation_id, record_class,
    prior_started_at, prior_ended_at, prior_miles,
    corrected_started_at, corrected_ended_at, corrected_miles
  ) VALUES (
    v_job.tenant_id, v_job.id, 'correction',
    coalesce(p_corrected_started_at, v_src.started_at),
    coalesce(p_corrected_ended_at, v_src.ended_at),
    coalesce(p_corrected_miles, v_src.miles),
    CASE WHEN v_role = 'technician' THEN 'technician' ELSE 'office' END,
    auth.uid(), 'manual_correction', btrim(p_reason), v_mut, 'operational_only',
    v_src.started_at, v_src.ended_at, v_src.miles,
    p_corrected_started_at, p_corrected_ended_at, p_corrected_miles
  )
  RETURNING id INTO v_new;

  UPDATE public.job_time_events
  SET superseded_by = v_new
  WHERE id = v_src.id;

  PERFORM public.ml_p1_s4_emit_job_event(
    v_job.tenant_id, v_job.id, 'JobTimeCorrected', v_role,
    jsonb_build_object(
      'source_event_id', v_src.id,
      'correction_event_id', v_new,
      'prior_started_at', v_src.started_at,
      'prior_ended_at', v_src.ended_at,
      'prior_miles', v_src.miles,
      'corrected_started_at', p_corrected_started_at,
      'corrected_ended_at', p_corrected_ended_at,
      'corrected_miles', p_corrected_miles,
      'reason', p_reason,
      'record_class', 'operational_only'
    )
  );

  RETURN jsonb_build_object(
    'job_id', v_job.id,
    'correction_event_id', v_new,
    'source_event_id', v_src.id,
    'record_class', 'operational_only'
  );
END;
$$;

-- ---------------------------------------------------------------------------
-- Patch CO transition for immutable break-glass evidence
-- ---------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.ml_p1_s4_change_order_transition(uuid, text, text, text, text);

CREATE OR REPLACE FUNCTION public.ml_p1_s4_change_order_transition(
  p_change_order_id uuid,
  p_action text,
  p_client_mutation_id text,
  p_reason text DEFAULT NULL,
  p_customer_auth_proof text DEFAULT NULL,
  p_customer_auth_evidence_type text DEFAULT NULL,
  p_customer_auth_evidence_ref text DEFAULT NULL,
  p_customer_auth_at timestamptz DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_co public.change_orders%ROWTYPE;
  v_job public.jobs%ROWTYPE;
  v_role text := public.ml_p1_s2_current_actor_role();
  v_action text := lower(btrim(coalesce(p_action, '')));
  v_mut text := nullif(btrim(coalesce(p_client_mutation_id, '')), '');
  v_from text;
  v_to text;
  v_existing_event public.change_order_events%ROWTYPE;
  v_ev_type text := nullif(btrim(coalesce(p_customer_auth_evidence_type, '')), '');
  v_ev_ref text := nullif(btrim(coalesce(p_customer_auth_evidence_ref, '')), '');
  v_auth_at timestamptz := coalesce(p_customer_auth_at, now());
BEGIN
  IF v_mut IS NULL THEN
    RAISE EXCEPTION 'ML_P1_S4_MUTATION_ID_REQUIRED' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_existing_event
  FROM public.change_order_events
  WHERE change_order_id = p_change_order_id
    AND payload->>'client_mutation_id' = v_mut
  LIMIT 1;
  IF FOUND THEN
    SELECT * INTO v_co FROM public.change_orders WHERE id = p_change_order_id;
    RETURN jsonb_build_object(
      'change_order_id', v_co.id,
      'status', v_co.status,
      'idempotent', true
    );
  END IF;

  SELECT * INTO v_co FROM public.change_orders WHERE id = p_change_order_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'ML_P1_S4_CO_NOT_FOUND' USING ERRCODE = 'P0002';
  END IF;

  SELECT * INTO v_job FROM public.jobs WHERE id = v_co.job_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'ML_P1_S4_JOB_NOT_FOUND' USING ERRCODE = 'P0002';
  END IF;

  v_from := v_co.status;

  IF v_from IN ('approved', 'rejected', 'cancelled', 'superseded') AND v_action NOT IN ('supersede') THEN
    IF v_action IN ('approve_customer', 'approve_break_glass') AND v_from = 'approved' THEN
      RETURN jsonb_build_object('change_order_id', v_co.id, 'status', v_co.status, 'idempotent', true);
    END IF;
    RAISE EXCEPTION 'ML_P1_S4_CO_IMMUTABLE: status %', v_from USING ERRCODE = '22023';
  END IF;

  IF v_action = 'release_free_form' THEN
    PERFORM public.ml_p1_s4_assert_capability('co.free_form_release', v_role);
    IF NOT v_co.free_form_pricing THEN
      RAISE EXCEPTION 'ML_P1_S4_CO_NOT_FREE_FORM' USING ERRCODE = '22023';
    END IF;
    v_to := 'pending_approval';
    UPDATE public.change_orders
    SET free_form_office_approved = true, status = v_to, updated_at = now()
    WHERE id = v_co.id
    RETURNING * INTO v_co;

  ELSIF v_action = 'approve_customer' THEN
    PERFORM public.ml_p1_s4_assert_capability('co.approve_customer', v_role);
    IF v_role = 'technician' THEN
      RAISE EXCEPTION 'ML_P1_S4_TECH_SELF_APPROVE_DENY' USING ERRCODE = '42501';
    END IF;
    IF v_co.proposed_by IS NOT NULL AND v_co.proposed_by = auth.uid() AND v_role <> 'customer' THEN
      RAISE EXCEPTION 'ML_P1_S4_TECH_SELF_APPROVE_DENY' USING ERRCODE = '42501';
    END IF;
    IF v_from NOT IN ('pending_approval') THEN
      RAISE EXCEPTION 'ML_P1_S4_CO_TRANSITION_DENY: % -> approved via customer', v_from USING ERRCODE = '22023';
    END IF;
    IF v_co.free_form_pricing AND NOT v_co.free_form_office_approved THEN
      RAISE EXCEPTION 'ML_P1_S4_FREE_FORM_NOT_RELEASED' USING ERRCODE = '42501';
    END IF;
    v_to := 'approved';
    UPDATE public.change_orders
    SET status = v_to, approved_by = auth.uid(), approved_at = now(),
        approval_method = 'customer_token', updated_at = now()
    WHERE id = v_co.id
    RETURNING * INTO v_co;

  ELSIF v_action = 'approve_break_glass' THEN
    PERFORM public.ml_p1_s4_assert_capability('co.approve_break_glass', v_role, p_reason);
    IF v_role = 'technician' THEN
      RAISE EXCEPTION 'ML_P1_S4_TECH_SELF_APPROVE_DENY' USING ERRCODE = '42501';
    END IF;
    -- Free-form text alone is insufficient (control amendment §9).
    IF v_ev_type IS NULL OR v_ev_ref IS NULL THEN
      RAISE EXCEPTION 'ML_P1_S4_BREAK_GLASS_EVIDENCE_REQUIRED: evidence_type and immutable evidence_ref required'
        USING ERRCODE = '42501';
    END IF;
    IF v_from NOT IN ('pending_approval', 'proposed') THEN
      RAISE EXCEPTION 'ML_P1_S4_CO_TRANSITION_DENY: % -> approved via break_glass', v_from USING ERRCODE = '22023';
    END IF;
    v_to := 'approved';
    UPDATE public.change_orders
    SET status = v_to, approved_by = auth.uid(), approved_at = now(),
        approval_method = 'break_glass',
        break_glass_reason = btrim(p_reason),
        customer_auth_proof = nullif(btrim(coalesce(p_customer_auth_proof, '')), ''),
        customer_auth_evidence_type = v_ev_type,
        customer_auth_evidence_ref = v_ev_ref,
        customer_auth_at = v_auth_at,
        free_form_office_approved = CASE WHEN free_form_pricing THEN true ELSE free_form_office_approved END,
        updated_at = now()
    WHERE id = v_co.id
    RETURNING * INTO v_co;

  ELSIF v_action = 'reject' THEN
    PERFORM public.ml_p1_s4_assert_capability('co.reject', v_role);
    IF v_from NOT IN ('pending_approval', 'proposed') THEN
      RAISE EXCEPTION 'ML_P1_S4_CO_TRANSITION_DENY: % -> rejected', v_from USING ERRCODE = '22023';
    END IF;
    v_to := 'rejected';
    UPDATE public.change_orders
    SET status = v_to, rejected_by = auth.uid(), rejected_at = now(),
        rejection_reason = nullif(btrim(coalesce(p_reason, '')), ''),
        updated_at = now()
    WHERE id = v_co.id
    RETURNING * INTO v_co;

  ELSIF v_action = 'cancel' THEN
    PERFORM public.ml_p1_s4_assert_capability('co.cancel', v_role);
    IF v_from IN ('approved', 'rejected', 'superseded') THEN
      RAISE EXCEPTION 'ML_P1_S4_CO_TRANSITION_DENY: % -> cancelled', v_from USING ERRCODE = '22023';
    END IF;
    v_to := 'cancelled';
    UPDATE public.change_orders
    SET status = v_to, cancelled_by = auth.uid(), cancelled_at = now(), updated_at = now()
    WHERE id = v_co.id
    RETURNING * INTO v_co;

  ELSE
    RAISE EXCEPTION 'ML_P1_S4_CO_ACTION_UNKNOWN: %', v_action USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.change_order_events (
    tenant_id, change_order_id, job_id, event_type, actor_user_id, actor_role,
    from_status, to_status, payload
  ) VALUES (
    v_co.tenant_id, v_co.id, v_co.job_id, 'ChangeOrder_' || v_action, auth.uid(), v_role,
    v_from, v_to,
    jsonb_build_object(
      'client_mutation_id', v_mut,
      'reason', p_reason,
      'customer_auth_evidence_type', v_ev_type,
      'customer_auth_evidence_ref', v_ev_ref,
      'customer_auth_at', v_auth_at,
      'approved_at', v_co.approved_at,
      'actor_user_id', auth.uid()
    )
  );

  PERFORM public.ml_p1_s4_emit_job_event(
    v_job.tenant_id, v_job.id, 'ChangeOrder_' || v_action, v_role,
    jsonb_build_object('change_order_id', v_co.id, 'from_status', v_from, 'to_status', v_to)
  );

  RETURN jsonb_build_object(
    'change_order_id', v_co.id,
    'status', v_co.status,
    'from_status', v_from,
    'to_status', v_to,
    'financial_delta_cents', v_co.financial_delta_cents,
    'approval_method', v_co.approval_method,
    'quote_mutated', false,
    'invoice_mutated', false
  );
END;
$$;

REVOKE ALL ON FUNCTION public.ml_p1_s4_record_make_safe(uuid, text, text, text, jsonb, text, text, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.ml_p1_s4_correct_time_event(uuid, uuid, text, text, timestamptz, timestamptz, numeric) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.ml_p1_s4_change_order_transition(uuid, text, text, text, text, text, text, timestamptz) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.ml_p1_s4_record_make_safe(uuid, text, text, text, jsonb, text, text, text, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.ml_p1_s4_correct_time_event(uuid, uuid, text, text, timestamptz, timestamptz, numeric) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.ml_p1_s4_change_order_transition(uuid, text, text, text, text, text, text, timestamptz) TO authenticated, service_role;

-- Drop prior narrower signatures if present (best-effort; ignore if absent via recreate above).
DO $$
BEGIN
  BEGIN
    REVOKE ALL ON FUNCTION public.ml_p1_s4_record_make_safe(uuid, text, text, text, jsonb) FROM PUBLIC;
  EXCEPTION WHEN undefined_function THEN NULL;
  END;
  BEGIN
    REVOKE ALL ON FUNCTION public.ml_p1_s4_change_order_transition(uuid, text, text, text, text) FROM PUBLIC;
  EXCEPTION WHEN undefined_function THEN NULL;
  END;
END $$;

COMMIT;

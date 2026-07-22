-- ML-P1 Slice 4 — canonical execution + change-order RPCs.
-- Invoice creation forbidden. Quote mutation forbidden.

BEGIN;

-- ---------------------------------------------------------------------------
-- Role helpers (reuse S2 current actor; extend capabilities for S4)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.ml_p1_s4_assert_capability(
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
    RAISE EXCEPTION 'ML_P1_S4_ROLE_DENY: unauthenticated actor'
      USING ERRCODE = '42501';
  END IF;

  IF v_cap IN ('job.reopen', 'co.approve_break_glass') AND (p_reason_code IS NULL OR btrim(p_reason_code) = '') THEN
    RAISE EXCEPTION 'ML_P1_S4_BREAK_GLASS_REASON_REQUIRED: % requires reason', v_cap
      USING ERRCODE = '42501';
  END IF;

  v_ok := CASE v_cap
    WHEN 'job.assign' THEN v_role IN ('office', 'manager', 'admin')
    WHEN 'job.schedule' THEN v_role IN ('office', 'manager', 'admin')
    WHEN 'job.field_transition' THEN v_role IN ('technician', 'office', 'manager', 'admin')
    WHEN 'job.complete' THEN v_role IN ('technician', 'office', 'manager', 'admin')
    WHEN 'job.cancel_prework' THEN v_role IN ('office', 'manager', 'admin')
    WHEN 'job.cancel_after_work' THEN v_role IN ('office', 'manager', 'admin')
    WHEN 'job.reopen' THEN v_role IN ('office', 'manager', 'admin')
    WHEN 'job.ack_waive' THEN v_role IN ('office', 'manager', 'admin')
    WHEN 'job.time_correct' THEN v_role IN ('technician', 'office', 'manager', 'admin')
    WHEN 'co.propose' THEN v_role IN ('technician', 'office', 'manager', 'admin')
    WHEN 'co.approve_customer' THEN v_role = 'customer'
    WHEN 'co.approve_break_glass' THEN v_role IN ('office', 'manager', 'admin')
    WHEN 'co.reject' THEN v_role IN ('office', 'manager', 'admin', 'customer')
    WHEN 'co.cancel' THEN v_role IN ('office', 'manager', 'admin', 'technician')
    WHEN 'co.free_form_release' THEN v_role IN ('office', 'manager', 'admin')
    ELSE false
  END;

  IF NOT v_ok THEN
    RAISE EXCEPTION 'ML_P1_S4_ROLE_DENY: role "%" cannot perform %', v_role, v_cap
      USING ERRCODE = '42501';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.ml_p1_s4_actor_technician_id()
RETURNS uuid
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN NULL;
  END IF;
  SELECT t.id INTO v_id
  FROM public.technicians t
  WHERE t.user_id = auth.uid()
  ORDER BY t.created_at DESC NULLS LAST
  LIMIT 1;
  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.ml_p1_s4_assert_job_assignment(
  p_job public.jobs,
  p_role text,
  p_allow_office_break_glass boolean DEFAULT true
)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  v_role text := public.ml_p1_s2_normalize_role(p_role);
  v_tech uuid := public.ml_p1_s4_actor_technician_id();
BEGIN
  IF v_role IN ('office', 'manager', 'admin') THEN
    IF p_allow_office_break_glass THEN
      RETURN;
    END IF;
  END IF;

  IF v_role = 'technician' THEN
    IF p_job.technician_id IS NULL OR v_tech IS NULL OR p_job.technician_id IS DISTINCT FROM v_tech THEN
      RAISE EXCEPTION 'ML_P1_S4_ASSIGNMENT_DENY: technician not assigned to job'
        USING ERRCODE = '42501';
    END IF;
    RETURN;
  END IF;

  RAISE EXCEPTION 'ML_P1_S4_ROLE_DENY: actor cannot mutate this job'
    USING ERRCODE = '42501';
END;
$$;

CREATE OR REPLACE FUNCTION public.ml_p1_s4_map_action_to_status(p_action text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE lower(btrim(coalesce(p_action, '')))
    WHEN 'schedule' THEN 'scheduled'
    WHEN 'on_my_way' THEN 'en_route'
    WHEN 'arrive' THEN 'arrived'
    WHEN 'start' THEN 'in_progress'
    WHEN 'pause' THEN 'on_hold'
    WHEN 'resume' THEN 'in_progress'
    WHEN 'no_access' THEN 'no_access'
    WHEN 'request_reschedule' THEN 'reschedule_required'
    WHEN 'complete_submit' THEN 'completion_pending'
    WHEN 'complete_finalize' THEN 'completed'
    WHEN 'cancel' THEN 'cancelled'
    WHEN 'reopen' THEN 'in_progress'
    ELSE NULL
  END;
$$;

CREATE OR REPLACE FUNCTION public.ml_p1_s4_transition_allowed(p_from text, p_to text)
RETURNS boolean
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_from text := lower(btrim(coalesce(p_from, '')));
  v_to text := lower(btrim(coalesce(p_to, '')));
BEGIN
  IF v_from = v_to THEN
    RETURN true; -- idempotent self-transition
  END IF;

  RETURN CASE v_from
    WHEN 'unscheduled' THEN v_to IN ('pending_schedule', 'scheduled', 'cancelled')
    WHEN 'pending_schedule' THEN v_to IN ('unscheduled', 'scheduled', 'cancelled')
    WHEN 'scheduled' THEN v_to IN ('en_route', 'in_progress', 'on_hold', 'no_access', 'reschedule_required', 'cancelled')
    WHEN 'en_route' THEN v_to IN ('arrived', 'in_progress', 'scheduled', 'on_hold', 'no_access', 'reschedule_required', 'cancelled')
    WHEN 'arrived' THEN v_to IN ('in_progress', 'on_hold', 'no_access', 'reschedule_required', 'cancelled')
    WHEN 'in_progress' THEN v_to IN ('on_hold', 'completion_pending', 'completed', 'no_access', 'reschedule_required', 'cancelled')
    WHEN 'on_hold' THEN v_to IN ('scheduled', 'en_route', 'arrived', 'in_progress', 'reschedule_required', 'cancelled')
    WHEN 'no_access' THEN v_to IN ('reschedule_required', 'scheduled', 'cancelled')
    WHEN 'reschedule_required' THEN v_to IN ('pending_schedule', 'scheduled', 'cancelled')
    WHEN 'completion_pending' THEN v_to IN ('completed', 'in_progress', 'cancelled')
    WHEN 'completed' THEN false
    WHEN 'cancelled' THEN false
    ELSE false
  END;
END;
$$;

CREATE OR REPLACE FUNCTION public.ml_p1_s4_emit_job_event(
  p_tenant_id text,
  p_job_id uuid,
  p_event_type text,
  p_actor_role text,
  p_payload jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.events (tenant_id, entity_type, entity_id, event_type, actor_type, actor_id, payload)
  VALUES (
    p_tenant_id,
    'job',
    p_job_id,
    p_event_type,
    p_actor_role,
    auth.uid()::text,
    coalesce(p_payload, '{}'::jsonb) || jsonb_build_object('slice', 'ml-p1-s4')
  );
EXCEPTION
  WHEN undefined_column THEN
    INSERT INTO public.events (tenant_id, entity_type, entity_id, event_type, actor_type, payload)
    VALUES (
      p_tenant_id,
      'job',
      p_job_id,
      p_event_type,
      p_actor_role,
      coalesce(p_payload, '{}'::jsonb) || jsonb_build_object('slice', 'ml-p1-s4')
    );
END;
$$;

-- ---------------------------------------------------------------------------
-- Completion readiness (PD-S4-03/06)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.ml_p1_s4_completion_readiness(p_job_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_job public.jobs%ROWTYPE;
  v_blockers jsonb := '[]'::jsonb;
  v_pending_co int := 0;
  v_approved_co int := 0;
  v_photos jsonb;
  v_before int := 0;
  v_after int := 0;
  v_ready boolean := true;
BEGIN
  SELECT * INTO v_job FROM public.jobs WHERE id = p_job_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'ML_P1_S4_JOB_NOT_FOUND' USING ERRCODE = 'P0002';
  END IF;

  IF lower(coalesce(v_job.status, '')) NOT IN ('in_progress', 'completion_pending') THEN
    v_blockers := v_blockers || jsonb_build_array(jsonb_build_object(
      'code', 'status_not_completable',
      'detail', v_job.status
    ));
  END IF;

  IF nullif(btrim(coalesce(v_job.technician_notes, '')), '') IS NULL THEN
    v_blockers := v_blockers || jsonb_build_array(jsonb_build_object('code', 'technician_notes_required'));
  END IF;

  IF nullif(btrim(coalesce(v_job.customer_summary, '')), '') IS NULL THEN
    v_blockers := v_blockers || jsonb_build_array(jsonb_build_object('code', 'customer_summary_required'));
  END IF;

  IF v_job.execution_findings IS NULL
     OR (
       jsonb_typeof(v_job.execution_findings) = 'array'
       AND jsonb_array_length(v_job.execution_findings) = 0
     )
     OR (
       jsonb_typeof(v_job.execution_findings) = 'object'
       AND v_job.execution_findings = '{}'::jsonb
     ) THEN
    v_blockers := v_blockers || jsonb_build_array(jsonb_build_object('code', 'findings_required'));
  END IF;

  v_photos := coalesce(v_job.execution_photos, '[]'::jsonb);
  IF jsonb_typeof(v_photos) = 'array' THEN
    SELECT
      count(*) FILTER (
        WHERE lower(coalesce(p->>'kind', p->>'type', '')) IN ('before', 'pre')
          AND nullif(btrim(coalesce(p->>'object_path', p->>'url', p->>'ref', '')), '') IS NOT NULL
          AND coalesce(p->>'url', p->>'ref', '') NOT ILIKE 'blob:%'
          AND coalesce(p->>'url', p->>'ref', '') NOT ILIKE 'pending-upload:%'
      ),
      count(*) FILTER (
        WHERE lower(coalesce(p->>'kind', p->>'type', '')) IN ('after', 'post')
          AND nullif(btrim(coalesce(p->>'object_path', p->>'url', p->>'ref', '')), '') IS NOT NULL
          AND coalesce(p->>'url', p->>'ref', '') NOT ILIKE 'blob:%'
          AND coalesce(p->>'url', p->>'ref', '') NOT ILIKE 'pending-upload:%'
      )
    INTO v_before, v_after
    FROM jsonb_array_elements(v_photos) p;
  END IF;

  IF v_before < 1 THEN
    v_blockers := v_blockers || jsonb_build_array(jsonb_build_object('code', 'before_photo_required'));
  END IF;
  IF v_after < 1 THEN
    v_blockers := v_blockers || jsonb_build_array(jsonb_build_object('code', 'after_photo_required'));
  END IF;

  IF coalesce(v_job.materials_none, false) IS NOT TRUE
     AND (
       v_job.execution_checklist IS NULL
       OR NOT (v_job.execution_checklist ? 'materials_declared')
     ) THEN
    v_blockers := v_blockers || jsonb_build_array(jsonb_build_object('code', 'materials_declaration_required'));
  END IF;

  -- PD-S4-03: ack optional; if missing, require documented reason or office waiver.
  IF v_job.customer_ack_at IS NULL
     AND nullif(btrim(coalesce(v_job.customer_ack_waiver_reason, '')), '') IS NULL THEN
    v_blockers := v_blockers || jsonb_build_array(jsonb_build_object(
      'code', 'customer_ack_or_waiver_required',
      'detail', 'document why acknowledgement was not obtained or obtain office waiver'
    ));
  END IF;

  SELECT count(*) INTO v_pending_co
  FROM public.change_orders
  WHERE job_id = p_job_id
    AND status IN ('proposed', 'pending_approval');

  IF v_pending_co > 0 THEN
    v_blockers := v_blockers || jsonb_build_array(jsonb_build_object(
      'code', 'pending_change_order',
      'detail', v_pending_co
    ));
  END IF;

  SELECT count(*) INTO v_approved_co
  FROM public.change_orders
  WHERE job_id = p_job_id
    AND status = 'approved';

  -- Approved COs must be accounted in checklist/scope summary when present.
  IF v_approved_co > 0
     AND (
       v_job.execution_checklist IS NULL
       OR NOT (v_job.execution_checklist ? 'approved_change_orders_accounted')
     ) THEN
    v_blockers := v_blockers || jsonb_build_array(jsonb_build_object(
      'code', 'approved_change_order_unaccounted',
      'detail', v_approved_co
    ));
  END IF;

  v_ready := jsonb_array_length(v_blockers) = 0;

  UPDATE public.jobs
  SET completion_blockers = v_blockers
  WHERE id = p_job_id
    AND public.ml_p1_s4_writer_enabled(); -- only when called under writer; else skip persist

  -- Always return readiness; persist blockers when writer context is on.
  IF public.ml_p1_s4_writer_enabled() THEN
    NULL; -- already attempted
  ELSE
    PERFORM public.ml_p1_s4_set_writer_context();
    UPDATE public.jobs
    SET completion_blockers = v_blockers, updated_at = now()
    WHERE id = p_job_id;
  END IF;

  RETURN jsonb_build_object(
    'job_id', p_job_id,
    'ready', v_ready,
    'blockers', v_blockers,
    'approved_change_orders', v_approved_co,
    'pending_change_orders', v_pending_co
  );
END;
$$;

-- ---------------------------------------------------------------------------
-- Assign + schedule
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.ml_p1_s4_assign_and_schedule(
  p_job_id uuid,
  p_technician_id uuid DEFAULT NULL,
  p_scheduled_start timestamptz DEFAULT NULL,
  p_scheduled_end timestamptz DEFAULT NULL,
  p_client_mutation_id text DEFAULT NULL,
  p_reason text DEFAULT NULL
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
  v_existing public.job_execution_mutations%ROWTYPE;
  v_now timestamptz := now();
  v_from text;
BEGIN
  PERFORM public.ml_p1_s4_assert_capability('job.assign', v_role);
  PERFORM public.ml_p1_s4_assert_capability('job.schedule', v_role);

  IF v_mut IS NOT NULL THEN
    SELECT * INTO v_existing
    FROM public.job_execution_mutations
    WHERE job_id = p_job_id AND client_mutation_id = v_mut;
    IF FOUND THEN
      RETURN v_existing.result || jsonb_build_object('idempotent', true);
    END IF;
  END IF;

  SELECT * INTO v_job FROM public.jobs WHERE id = p_job_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'ML_P1_S4_JOB_NOT_FOUND' USING ERRCODE = 'P0002';
  END IF;

  v_from := v_job.status;
  PERFORM public.ml_p1_s4_set_writer_context();

  UPDATE public.jobs
  SET
    technician_id = coalesce(p_technician_id, technician_id),
    scheduled_start = coalesce(p_scheduled_start, scheduled_start),
    scheduled_end = coalesce(p_scheduled_end, scheduled_end),
    status = CASE
      WHEN lower(coalesce(status, '')) IN ('unscheduled', 'pending_schedule', 'reschedule_required')
        AND coalesce(p_scheduled_start, scheduled_start) IS NOT NULL
        THEN 'scheduled'
      ELSE status
    END,
    updated_at = v_now,
    execution_row_version = coalesce(execution_row_version, 1) + 1
  WHERE id = p_job_id
  RETURNING * INTO v_job;

  PERFORM public.ml_p1_s4_emit_job_event(
    v_job.tenant_id,
    v_job.id,
    'JobAssignedScheduled',
    v_role,
    jsonb_build_object(
      'from_status', v_from,
      'to_status', v_job.status,
      'technician_id', v_job.technician_id,
      'reason', p_reason,
      'client_mutation_id', v_mut
    )
  );

  IF v_mut IS NOT NULL THEN
    INSERT INTO public.job_execution_mutations (
      tenant_id, job_id, action, client_mutation_id, actor_user_id, actor_role,
      from_status, to_status, result
    ) VALUES (
      v_job.tenant_id, v_job.id, 'assign_and_schedule', v_mut, auth.uid(), v_role,
      v_from, v_job.status,
      jsonb_build_object('job_id', v_job.id, 'status', v_job.status, 'created', true)
    );
  END IF;

  RETURN jsonb_build_object(
    'job_id', v_job.id,
    'status', v_job.status,
    'technician_id', v_job.technician_id,
    'scheduled_start', v_job.scheduled_start,
    'scheduled_end', v_job.scheduled_end,
    'execution_row_version', v_job.execution_row_version
  );
END;
$$;

-- ---------------------------------------------------------------------------
-- Canonical field transition
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.ml_p1_s4_job_transition(
  p_job_id uuid,
  p_action text,
  p_client_mutation_id text,
  p_reason text DEFAULT NULL,
  p_expected_row_version integer DEFAULT NULL,
  p_payload jsonb DEFAULT '{}'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_job public.jobs%ROWTYPE;
  v_role text := public.ml_p1_s2_current_actor_role();
  v_action text := lower(btrim(coalesce(p_action, '')));
  v_to text;
  v_from text;
  v_mut text := nullif(btrim(coalesce(p_client_mutation_id, '')), '');
  v_existing public.job_execution_mutations%ROWTYPE;
  v_now timestamptz := now();
  v_ready jsonb;
  v_event_type text;
  v_time_type text;
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

  IF p_expected_row_version IS NOT NULL
     AND coalesce(v_job.execution_row_version, 1) IS DISTINCT FROM p_expected_row_version THEN
    RAISE EXCEPTION 'ML_P1_S4_STALE_CLIENT: expected row_version %, actual %',
      p_expected_row_version, coalesce(v_job.execution_row_version, 1)
      USING ERRCODE = '40001';
  END IF;

  v_from := lower(coalesce(v_job.status, ''));
  v_to := public.ml_p1_s4_map_action_to_status(v_action);

  IF v_to IS NULL THEN
    RAISE EXCEPTION 'ML_P1_S4_ACTION_UNKNOWN: %', v_action USING ERRCODE = '22023';
  END IF;

  -- Capability + assignment
  IF v_action = 'reopen' THEN
    PERFORM public.ml_p1_s4_assert_capability('job.reopen', v_role, p_reason);
    IF v_from <> 'completed' THEN
      RAISE EXCEPTION 'ML_P1_S4_TRANSITION_DENY: reopen only from completed' USING ERRCODE = '22023';
    END IF;
    -- reopen bypasses normal transition_allowed from completed
  ELSIF v_action = 'cancel' THEN
    IF v_from IN ('in_progress', 'on_hold', 'arrived', 'en_route', 'completion_pending') THEN
      PERFORM public.ml_p1_s4_assert_capability('job.cancel_after_work', v_role, p_reason);
    ELSE
      PERFORM public.ml_p1_s4_assert_capability('job.cancel_prework', v_role);
    END IF;
    IF p_reason IS NULL OR btrim(p_reason) = '' THEN
      RAISE EXCEPTION 'ML_P1_S4_REASON_REQUIRED: cancel requires reason' USING ERRCODE = '22023';
    END IF;
  ELSIF v_action IN ('complete_submit', 'complete_finalize') THEN
    PERFORM public.ml_p1_s4_assert_capability('job.complete', v_role);
    PERFORM public.ml_p1_s4_assert_job_assignment(v_job, v_role, true);
  ELSE
    PERFORM public.ml_p1_s4_assert_capability('job.field_transition', v_role);
    PERFORM public.ml_p1_s4_assert_job_assignment(v_job, v_role, true);
  END IF;

  IF v_action IN ('no_access', 'request_reschedule') AND (p_reason IS NULL OR btrim(p_reason) = '') THEN
    RAISE EXCEPTION 'ML_P1_S4_REASON_REQUIRED: % requires reason', v_action USING ERRCODE = '22023';
  END IF;

  -- start-on-site skip en_route only for office/admin (capability already office allowed)
  IF v_action = 'start' AND v_from = 'scheduled' AND v_role = 'technician' THEN
    RAISE EXCEPTION 'ML_P1_S4_TRANSITION_DENY: technician cannot skip en_route/arrive from scheduled'
      USING ERRCODE = '22023';
  END IF;

  IF v_action <> 'reopen' AND NOT public.ml_p1_s4_transition_allowed(v_from, v_to) THEN
    RAISE EXCEPTION 'ML_P1_S4_TRANSITION_DENY: % -> % via %', v_from, v_to, v_action
      USING ERRCODE = '22023';
  END IF;

  -- Idempotent same-state
  IF v_from = v_to AND v_action <> 'reopen' THEN
    INSERT INTO public.job_execution_mutations (
      tenant_id, job_id, action, client_mutation_id, actor_user_id, actor_role,
      from_status, to_status, result
    ) VALUES (
      v_job.tenant_id, v_job.id, v_action, v_mut, auth.uid(), v_role,
      v_from, v_to,
      jsonb_build_object('job_id', v_job.id, 'status', v_job.status, 'idempotent', true, 'unchanged', true)
    );
    RETURN jsonb_build_object('job_id', v_job.id, 'status', v_job.status, 'idempotent', true, 'unchanged', true);
  END IF;

  -- Completion gates
  IF v_action IN ('complete_submit', 'complete_finalize') OR v_to IN ('completion_pending', 'completed') THEN
    PERFORM public.ml_p1_s4_set_writer_context();
    v_ready := public.ml_p1_s4_completion_readiness(p_job_id);
    IF coalesce((v_ready->>'ready')::boolean, false) IS NOT TRUE THEN
      -- Allow transition to completion_pending even with blockers; finalize/completed requires ready.
      IF v_to = 'completed' OR v_action = 'complete_finalize' THEN
        RAISE EXCEPTION 'ML_P1_S4_COMPLETION_BLOCKED: %', v_ready->>'blockers'
          USING ERRCODE = 'P0001';
      END IF;
      v_to := 'completion_pending';
    ELSIF v_action = 'complete_submit' AND coalesce((p_payload->>'finalize_if_ready')::boolean, true) THEN
      v_to := 'completed';
    END IF;
  END IF;

  PERFORM public.ml_p1_s4_set_writer_context();

  UPDATE public.jobs
  SET
    status = v_to,
    completed_at = CASE WHEN v_to = 'completed' THEN coalesce(completed_at, v_now) ELSE completed_at END,
    updated_at = v_now,
    execution_row_version = coalesce(execution_row_version, 1) + 1,
    s4_invoice_on_complete_disabled = true
  WHERE id = p_job_id
  RETURNING * INTO v_job;

  -- Time events for key transitions
  v_time_type := CASE v_action
    WHEN 'on_my_way' THEN 'travel_start'
    WHEN 'arrive' THEN 'arrival'
    WHEN 'start' THEN 'onsite_start'
    WHEN 'pause' THEN 'pause'
    WHEN 'resume' THEN 'resume'
    WHEN 'complete_submit' THEN 'work_end'
    WHEN 'complete_finalize' THEN 'work_end'
    ELSE NULL
  END;

  IF v_time_type IS NOT NULL THEN
    INSERT INTO public.job_time_events (
      tenant_id, job_id, event_type, started_at, source, actor_id, note, client_mutation_id
    ) VALUES (
      v_job.tenant_id, v_job.id, v_time_type, v_now,
      CASE WHEN v_role = 'technician' THEN 'technician' ELSE 'office' END,
      auth.uid(), p_reason, v_mut || ':' || v_time_type
    )
    ON CONFLICT (job_id, client_mutation_id) WHERE client_mutation_id IS NOT NULL
    DO NOTHING;
  END IF;

  v_event_type := 'JobTransition_' || v_action;
  PERFORM public.ml_p1_s4_emit_job_event(
    v_job.tenant_id,
    v_job.id,
    v_event_type,
    v_role,
    jsonb_build_object(
      'action', v_action,
      'from_status', v_from,
      'to_status', v_to,
      'reason', p_reason,
      'client_mutation_id', v_mut,
      'payload', coalesce(p_payload, '{}'::jsonb),
      'invoice_created', false
    )
  );

  INSERT INTO public.job_execution_mutations (
    tenant_id, job_id, action, client_mutation_id, actor_user_id, actor_role,
    from_status, to_status, result
  ) VALUES (
    v_job.tenant_id, v_job.id, v_action, v_mut, auth.uid(), v_role,
    v_from, v_to,
    jsonb_build_object(
      'job_id', v_job.id,
      'status', v_job.status,
      'execution_row_version', v_job.execution_row_version,
      'completed_at', v_job.completed_at,
      'invoice_created', false
    )
  );

  RETURN jsonb_build_object(
    'job_id', v_job.id,
    'status', v_job.status,
    'from_status', v_from,
    'to_status', v_to,
    'execution_row_version', v_job.execution_row_version,
    'completed_at', v_job.completed_at,
    'invoice_created', false,
    'readiness', v_ready
  );
END;
$$;

-- ---------------------------------------------------------------------------
-- Evidence upsert (no quote/invoice mutation)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.ml_p1_s4_upsert_evidence(
  p_job_id uuid,
  p_client_mutation_id text,
  p_technician_notes text DEFAULT NULL,
  p_customer_summary text DEFAULT NULL,
  p_execution_findings jsonb DEFAULT NULL,
  p_execution_photos jsonb DEFAULT NULL,
  p_execution_checklist jsonb DEFAULT NULL,
  p_materials_none boolean DEFAULT NULL,
  p_customer_ack_method text DEFAULT NULL,
  p_customer_ack_waiver_reason text DEFAULT NULL
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
  v_existing public.job_execution_mutations%ROWTYPE;
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

  IF p_customer_ack_waiver_reason IS NOT NULL AND btrim(p_customer_ack_waiver_reason) <> '' THEN
    PERFORM public.ml_p1_s4_assert_capability('job.ack_waive', v_role);
  END IF;

  PERFORM public.ml_p1_s4_set_writer_context();

  UPDATE public.jobs
  SET
    technician_notes = coalesce(p_technician_notes, technician_notes),
    customer_summary = coalesce(p_customer_summary, customer_summary),
    execution_findings = coalesce(p_execution_findings, execution_findings),
    execution_photos = coalesce(p_execution_photos, execution_photos),
    execution_checklist = coalesce(p_execution_checklist, execution_checklist),
    materials_none = coalesce(p_materials_none, materials_none),
    customer_ack_method = coalesce(p_customer_ack_method, customer_ack_method),
    customer_ack_at = CASE
      WHEN p_customer_ack_method IS NOT NULL AND btrim(p_customer_ack_method) <> ''
        THEN coalesce(customer_ack_at, now())
      ELSE customer_ack_at
    END,
    customer_ack_waiver_reason = coalesce(p_customer_ack_waiver_reason, customer_ack_waiver_reason),
    customer_ack_waived_by = CASE
      WHEN p_customer_ack_waiver_reason IS NOT NULL AND btrim(p_customer_ack_waiver_reason) <> ''
        THEN auth.uid()
      ELSE customer_ack_waived_by
    END,
    updated_at = now(),
    execution_row_version = coalesce(execution_row_version, 1) + 1
  WHERE id = p_job_id
  RETURNING * INTO v_job;

  PERFORM public.ml_p1_s4_emit_job_event(
    v_job.tenant_id, v_job.id, 'JobEvidenceUpserted', v_role,
    jsonb_build_object('client_mutation_id', v_mut)
  );

  INSERT INTO public.job_execution_mutations (
    tenant_id, job_id, action, client_mutation_id, actor_user_id, actor_role,
    from_status, to_status, result
  ) VALUES (
    v_job.tenant_id, v_job.id, 'upsert_evidence', v_mut, auth.uid(), v_role,
    v_job.status, v_job.status,
    jsonb_build_object('job_id', v_job.id, 'status', v_job.status, 'execution_row_version', v_job.execution_row_version)
  );

  RETURN jsonb_build_object(
    'job_id', v_job.id,
    'status', v_job.status,
    'execution_row_version', v_job.execution_row_version
  );
END;
$$;

-- ---------------------------------------------------------------------------
-- Make-safe (PD-S4-01 B) — never billable
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.ml_p1_s4_record_make_safe(
  p_job_id uuid,
  p_action_type text,
  p_summary text,
  p_client_mutation_id text,
  p_evidence_refs jsonb DEFAULT '[]'::jsonb
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

  INSERT INTO public.job_make_safe_events (
    tenant_id, job_id, action_type, summary, evidence_refs, billable, actor_user_id, client_mutation_id
  ) VALUES (
    v_job.tenant_id, v_job.id, lower(btrim(p_action_type)), btrim(p_summary),
    coalesce(p_evidence_refs, '[]'::jsonb), false, auth.uid(), v_mut
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
      'action_type', lower(btrim(p_action_type)),
      'billable', false,
      'client_mutation_id', v_mut
    )
  );

  INSERT INTO public.job_execution_mutations (
    tenant_id, job_id, action, client_mutation_id, actor_user_id, actor_role,
    from_status, to_status, result
  ) VALUES (
    v_job.tenant_id, v_job.id, 'make_safe', v_mut, auth.uid(), v_role,
    v_job.status, v_job.status,
    jsonb_build_object('job_id', v_job.id, 'make_safe_id', v_id, 'billable', false)
  );

  RETURN jsonb_build_object('job_id', v_job.id, 'make_safe_id', v_id, 'billable', false);
END;
$$;

-- ---------------------------------------------------------------------------
-- Change order number helper
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.ml_p1_s4_next_change_order_number(p_tenant_id text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_n bigint;
BEGIN
  SELECT count(*) + 1 INTO v_n
  FROM public.change_orders
  WHERE tenant_id = p_tenant_id;
  RETURN 'CO-' || to_char(now(), 'YYYY') || '-' || lpad(v_n::text, 5, '0');
END;
$$;

-- ---------------------------------------------------------------------------
-- Change order propose (tech may propose; never self-approve)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.ml_p1_s4_change_order_propose(
  p_job_id uuid,
  p_reason text,
  p_items jsonb,
  p_client_mutation_id text,
  p_pricing_mode text DEFAULT 'price_book',
  p_submit_for_approval boolean DEFAULT true,
  p_evidence_refs jsonb DEFAULT '[]'::jsonb
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
  v_existing public.change_orders%ROWTYPE;
  v_co public.change_orders%ROWTYPE;
  v_item jsonb;
  v_delta bigint := 0;
  v_line_delta bigint;
  v_idx int := 0;
  v_mode text := lower(btrim(coalesce(p_pricing_mode, 'price_book')));
  v_free boolean := false;
  v_status text;
BEGIN
  IF v_mut IS NULL THEN
    RAISE EXCEPTION 'ML_P1_S4_MUTATION_ID_REQUIRED' USING ERRCODE = '22023';
  END IF;
  IF p_reason IS NULL OR btrim(p_reason) = '' THEN
    RAISE EXCEPTION 'ML_P1_S4_REASON_REQUIRED: change order reason required' USING ERRCODE = '22023';
  END IF;
  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'ML_P1_S4_CO_ITEMS_REQUIRED' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_existing
  FROM public.change_orders
  WHERE job_id = p_job_id AND client_mutation_id = v_mut;
  IF FOUND THEN
    RETURN jsonb_build_object('change_order_id', v_existing.id, 'status', v_existing.status, 'idempotent', true);
  END IF;

  SELECT * INTO v_job FROM public.jobs WHERE id = p_job_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'ML_P1_S4_JOB_NOT_FOUND' USING ERRCODE = 'P0002';
  END IF;

  PERFORM public.ml_p1_s4_assert_capability('co.propose', v_role);
  PERFORM public.ml_p1_s4_assert_job_assignment(v_job, v_role, true);

  IF v_mode NOT IN ('price_book', 'free_form') THEN
    RAISE EXCEPTION 'ML_P1_S4_PRICING_MODE_INVALID' USING ERRCODE = '22023';
  END IF;
  v_free := v_mode = 'free_form';

  -- PD-S4-04: free-form cannot go to customer until office releases.
  IF v_free THEN
    v_status := 'proposed'; -- office must release before pending_approval
  ELSIF p_submit_for_approval THEN
    v_status := 'pending_approval';
  ELSE
    v_status := 'draft';
  END IF;

  INSERT INTO public.change_orders (
    tenant_id, job_id, source_quote_id, source_quote_version,
    change_order_number, version, status, reason, financial_delta_cents,
    pricing_mode, free_form_pricing, free_form_office_approved,
    evidence_refs, proposed_by, proposed_at, client_mutation_id
  ) VALUES (
    v_job.tenant_id, v_job.id, v_job.quote_id, v_job.source_quote_version,
    public.ml_p1_s4_next_change_order_number(v_job.tenant_id), 1, v_status, btrim(p_reason), 0,
    v_mode, v_free, false,
    coalesce(p_evidence_refs, '[]'::jsonb), auth.uid(), now(), v_mut
  )
  RETURNING * INTO v_co;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_idx := v_idx + 1;
    v_line_delta := coalesce((v_item->>'line_delta_cents')::bigint,
      round(coalesce((v_item->>'quantity')::numeric, 1)
        * coalesce((v_item->>'unit_price_cents')::numeric, 0))::bigint);

    IF v_mode = 'price_book' AND nullif(v_item->>'price_book_item_id', '') IS NULL
       AND coalesce((v_item->>'allow_description_only')::boolean, false) IS NOT TRUE THEN
      RAISE EXCEPTION 'ML_P1_S4_PRICE_BOOK_REQUIRED: item % needs price_book_item_id', v_idx
        USING ERRCODE = '22023';
    END IF;

    INSERT INTO public.change_order_items (
      tenant_id, change_order_id, line_action, price_book_item_id, description,
      quantity, unit_price_cents, line_delta_cents, is_credit, sort_order, metadata
    ) VALUES (
      v_job.tenant_id,
      v_co.id,
      coalesce(nullif(v_item->>'line_action', ''), 'add'),
      nullif(v_item->>'price_book_item_id', '')::uuid,
      coalesce(nullif(btrim(v_item->>'description'), ''), 'Change order item'),
      coalesce((v_item->>'quantity')::numeric, 1),
      coalesce((v_item->>'unit_price_cents')::bigint, 0),
      v_line_delta,
      coalesce((v_item->>'is_credit')::boolean, false),
      v_idx,
      coalesce(v_item->'metadata', '{}'::jsonb)
    );
    v_delta := v_delta + v_line_delta;
  END LOOP;

  UPDATE public.change_orders
  SET financial_delta_cents = v_delta, updated_at = now()
  WHERE id = v_co.id
  RETURNING * INTO v_co;

  INSERT INTO public.change_order_events (
    tenant_id, change_order_id, job_id, event_type, actor_user_id, actor_role,
    from_status, to_status, payload
  ) VALUES (
    v_job.tenant_id, v_co.id, v_job.id, 'ChangeOrderProposed', auth.uid(), v_role,
    NULL, v_co.status,
    jsonb_build_object('financial_delta_cents', v_delta, 'pricing_mode', v_mode)
  );

  PERFORM public.ml_p1_s4_emit_job_event(
    v_job.tenant_id, v_job.id, 'ChangeOrderProposed', v_role,
    jsonb_build_object('change_order_id', v_co.id, 'status', v_co.status, 'financial_delta_cents', v_delta)
  );

  RETURN jsonb_build_object(
    'change_order_id', v_co.id,
    'status', v_co.status,
    'financial_delta_cents', v_co.financial_delta_cents,
    'free_form_pricing', v_co.free_form_pricing,
    'source_quote_id', v_co.source_quote_id,
    'source_quote_version', v_co.source_quote_version
  );
END;
$$;

-- ---------------------------------------------------------------------------
-- Change order transition (approve/reject/cancel/release free-form)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.ml_p1_s4_change_order_transition(
  p_change_order_id uuid,
  p_action text,
  p_client_mutation_id text,
  p_reason text DEFAULT NULL,
  p_customer_auth_proof text DEFAULT NULL
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
BEGIN
  IF v_mut IS NULL THEN
    RAISE EXCEPTION 'ML_P1_S4_MUTATION_ID_REQUIRED' USING ERRCODE = '22023';
  END IF;

  -- Idempotency via events payload mutation id
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

  -- Immutable terminal states
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
    -- PD-S4-02: technicians never approve (including if role somehow customer+tech)
    IF v_role = 'technician' OR public.ml_p1_s4_actor_technician_id() IS NOT NULL AND v_role NOT IN ('customer') THEN
      IF v_role = 'technician' THEN
        RAISE EXCEPTION 'ML_P1_S4_TECH_SELF_APPROVE_DENY' USING ERRCODE = '42501';
      END IF;
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
    IF p_customer_auth_proof IS NULL OR btrim(p_customer_auth_proof) = '' THEN
      RAISE EXCEPTION 'ML_P1_S4_BREAK_GLASS_PROOF_REQUIRED' USING ERRCODE = '42501';
    END IF;
    -- PD-S4-02: never allow proposer self-approve via break-glass if technician
    IF v_role = 'technician' OR (v_co.proposed_by IS NOT NULL AND v_co.proposed_by = auth.uid() AND v_role = 'technician') THEN
      RAISE EXCEPTION 'ML_P1_S4_TECH_SELF_APPROVE_DENY' USING ERRCODE = '42501';
    END IF;
    IF v_from NOT IN ('pending_approval', 'proposed') THEN
      RAISE EXCEPTION 'ML_P1_S4_CO_TRANSITION_DENY: % -> approved via break_glass', v_from USING ERRCODE = '22023';
    END IF;
    v_to := 'approved';
    UPDATE public.change_orders
    SET status = v_to, approved_by = auth.uid(), approved_at = now(),
        approval_method = 'break_glass',
        break_glass_reason = btrim(p_reason),
        customer_auth_proof = btrim(p_customer_auth_proof),
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
      'customer_auth_proof_present', p_customer_auth_proof IS NOT NULL AND btrim(p_customer_auth_proof) <> ''
    )
  );

  PERFORM public.ml_p1_s4_emit_job_event(
    v_job.tenant_id, v_job.id, 'ChangeOrder_' || v_action, v_role,
    jsonb_build_object('change_order_id', v_co.id, 'from_status', v_from, 'to_status', v_to)
  );

  -- Never mutate source quote
  IF v_job.quote_id IS NOT NULL THEN
    -- touch-free assertion marker for source guards
    NULL;
  END IF;

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

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------
REVOKE ALL ON FUNCTION public.ml_p1_s4_completion_readiness(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.ml_p1_s4_assign_and_schedule(uuid, uuid, timestamptz, timestamptz, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.ml_p1_s4_job_transition(uuid, text, text, text, integer, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.ml_p1_s4_upsert_evidence(uuid, text, text, text, jsonb, jsonb, jsonb, boolean, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.ml_p1_s4_record_make_safe(uuid, text, text, text, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.ml_p1_s4_change_order_propose(uuid, text, jsonb, text, text, boolean, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.ml_p1_s4_change_order_transition(uuid, text, text, text, text) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.ml_p1_s4_completion_readiness(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.ml_p1_s4_assign_and_schedule(uuid, uuid, timestamptz, timestamptz, text, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.ml_p1_s4_job_transition(uuid, text, text, text, integer, jsonb) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.ml_p1_s4_upsert_evidence(uuid, text, text, text, jsonb, jsonb, jsonb, boolean, text, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.ml_p1_s4_record_make_safe(uuid, text, text, text, jsonb) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.ml_p1_s4_change_order_propose(uuid, text, jsonb, text, text, boolean, jsonb) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.ml_p1_s4_change_order_transition(uuid, text, text, text, text) TO authenticated, service_role;

COMMIT;

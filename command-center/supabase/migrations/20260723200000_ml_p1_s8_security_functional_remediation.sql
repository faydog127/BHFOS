-- ML-P1 S8 security & functional remediation
-- Hardens SECURITY DEFINER RPCs, evidence gates, checklist completion, finalize ordering.
-- Does NOT authorize apply: Founder S-auth required per ML-P1_AUTHORITY_PRECEDENCE.md.

BEGIN;

-- Item-specific required-photo linkage
ALTER TABLE public.inspection_photos
  ADD COLUMN IF NOT EXISTS checklist_item_key text;

CREATE INDEX IF NOT EXISTS inspection_photos_checklist_item_idx
  ON public.inspection_photos (inspection_id, checklist_item_key)
  WHERE checklist_item_key IS NOT NULL AND coalesce(is_voided, false) IS NOT TRUE;

-- ---------------------------------------------------------------------------
-- Auth helpers
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.ml_p1_s8_assert_inspection_actor(p_inspection_id uuid)
RETURNS public.inspections
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_inv public.inspections%ROWTYPE;
  v_role text;
BEGIN
  IF p_inspection_id IS NULL THEN
    RAISE EXCEPTION 'ML_P1_S8_INSPECTION_NOT_FOUND' USING ERRCODE = 'P0001';
  END IF;

  SELECT * INTO v_inv
  FROM public.inspections
  WHERE id = p_inspection_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'ML_P1_S8_INSPECTION_NOT_FOUND' USING ERRCODE = 'P0001';
  END IF;

  -- Privileged DB roles (service_role / postgres) may operate for synth/admin tooling.
  -- JWT actors must match tenant membership + field/office role.
  IF coalesce(auth.role(), '') IS DISTINCT FROM 'service_role'
     AND current_user NOT IN ('postgres', 'supabase_admin') THEN
    IF auth.uid() IS NULL THEN
      RAISE EXCEPTION 'ML_P1_S8_UNAUTHENTICATED' USING ERRCODE = '42501';
    END IF;
    IF NOT public.inspection_tenant_access(v_inv.tenant_id) THEN
      RAISE EXCEPTION 'ML_P1_S8_TENANT_ACCESS_DENIED' USING ERRCODE = '42501';
    END IF;
    v_role := public.ml_p1_s2_current_actor_role();
    IF v_role NOT IN ('technician', 'office', 'manager', 'admin') THEN
      RAISE EXCEPTION 'ML_P1_S8_ROLE_DENIED: role "%" cannot mutate inspection workflow', v_role
        USING ERRCODE = '42501';
    END IF;
  END IF;

  RETURN v_inv;
END;
$$;

CREATE OR REPLACE FUNCTION public.ml_p1_s8_valid_evidence_photo_count(p_inspection_id uuid)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT count(*)::integer
  FROM public.inspection_photos p
  WHERE p.inspection_id = p_inspection_id
    AND coalesce(p.is_voided, false) IS NOT TRUE
    AND lower(coalesce(p.upload_state, '')) = 'complete';
$$;

CREATE OR REPLACE FUNCTION public.ml_p1_s8_assert_completion_gates(p_inspection_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_inv public.inspections%ROWTYPE;
  v_unanswered integer;
  v_missing_photo integer;
  v_photo_count integer;
  v_response_count integer;
BEGIN
  v_inv := public.ml_p1_s8_assert_inspection_actor(p_inspection_id);

  IF NOT public.ml_p1_s8_photos_before_report_enabled() THEN
    RETURN;
  END IF;

  SELECT count(*) INTO v_response_count
  FROM public.inspection_checklist_responses r
  WHERE r.inspection_id = p_inspection_id;

  IF v_response_count < 1 THEN
    RAISE EXCEPTION 'ML_P1_S8_CHECKLIST_REQUIRED: seed and complete checklist before finalize'
      USING ERRCODE = 'P0001';
  END IF;

  SELECT count(*) INTO v_unanswered
  FROM public.inspection_checklist_responses r
  WHERE r.inspection_id = p_inspection_id
    AND r.checked IS NULL;

  IF v_unanswered > 0 THEN
    RAISE EXCEPTION 'ML_P1_S8_CHECKLIST_INCOMPLETE: % mandatory responses unanswered', v_unanswered
      USING ERRCODE = 'P0001';
  END IF;

  SELECT count(*) INTO v_missing_photo
  FROM public.inspection_checklist_responses r
  WHERE r.inspection_id = p_inspection_id
    AND r.photo_required IS TRUE
    AND NOT EXISTS (
      SELECT 1
      FROM public.inspection_photos p
      WHERE p.inspection_id = p_inspection_id
        AND p.checklist_item_key = r.item_key
        AND coalesce(p.is_voided, false) IS NOT TRUE
        AND lower(coalesce(p.upload_state, '')) = 'complete'
    );

  IF v_missing_photo > 0 THEN
    RAISE EXCEPTION 'ML_P1_S8_REQUIRED_PHOTOS_MISSING: % checklist items lack complete evidence', v_missing_photo
      USING ERRCODE = 'P0001';
  END IF;

  v_photo_count := public.ml_p1_s8_valid_evidence_photo_count(p_inspection_id);
  IF v_inv.photos_wave_complete_at IS NULL AND v_photo_count < 1 THEN
    RAISE EXCEPTION 'ML_P1_S8_PHOTOS_REQUIRED: complete photo wave before report'
      USING ERRCODE = 'P0001';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.ml_p1_s8_photos_before_report_enabled()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT coalesce(
    (SELECT lower(btrim(value)) IN ('true','1','yes','on')
     FROM public.global_config WHERE key = 'inspection.photos_before_report'),
    true
  );
$$;

CREATE OR REPLACE FUNCTION public.ml_p1_s8_assert_photos_before_report(p_inspection_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  -- Backward-compatible name: now enforces full completion gates.
  PERFORM public.ml_p1_s8_assert_completion_gates(p_inspection_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.ml_p1_s8_mark_photos_wave_complete(p_inspection_id uuid)
RETURNS timestamptz
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_inv public.inspections%ROWTYPE;
  v_at timestamptz;
  v_count integer;
BEGIN
  v_inv := public.ml_p1_s8_assert_inspection_actor(p_inspection_id);
  v_count := public.ml_p1_s8_valid_evidence_photo_count(p_inspection_id);

  IF v_count < 1 THEN
    RAISE EXCEPTION 'ML_P1_S8_PHOTOS_REQUIRED: need at least one complete non-voided photo'
      USING ERRCODE = 'P0001';
  END IF;

  UPDATE public.inspections
  SET photos_wave_complete_at = coalesce(photos_wave_complete_at, now()),
      updated_at = now()
  WHERE id = v_inv.id
  RETURNING photos_wave_complete_at INTO v_at;

  RETURN v_at;
END;
$$;

CREATE OR REPLACE FUNCTION public.ml_p1_s8_seed_checklist_for_inspection(
  p_inspection_id uuid,
  p_work_type text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_inv public.inspections%ROWTYPE;
  v_tmpl public.inspection_checklist_templates%ROWTYPE;
  v_work text;
  v_item jsonb;
  v_sort int := 0;
  v_count int := 0;
BEGIN
  v_inv := public.ml_p1_s8_assert_inspection_actor(p_inspection_id);

  v_work := lower(coalesce(nullif(btrim(p_work_type), ''), nullif(btrim(v_inv.work_type), ''), nullif(btrim(v_inv.service_type), ''), 'general'));

  SELECT * INTO v_tmpl
  FROM public.inspection_checklist_templates
  WHERE tenant_id = v_inv.tenant_id
    AND lower(work_type) = v_work
    AND is_active
  ORDER BY version DESC
  LIMIT 1;

  IF NOT FOUND THEN
    SELECT * INTO v_tmpl
    FROM public.inspection_checklist_templates
    WHERE tenant_id = v_inv.tenant_id
      AND lower(work_type) = 'general'
      AND is_active
    ORDER BY version DESC
    LIMIT 1;
  END IF;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'ML_P1_S8_TEMPLATE_MISSING' USING ERRCODE = 'P0001';
  END IF;

  UPDATE public.inspections
  SET work_type = v_work,
      checklist_template_id = v_tmpl.id,
      updated_at = now()
  WHERE id = v_inv.id;

  FOR v_item IN SELECT * FROM jsonb_array_elements(coalesce(v_tmpl.items, '[]'::jsonb))
  LOOP
    v_sort := v_sort + 10;
    INSERT INTO public.inspection_checklist_responses (
      tenant_id, inspection_id, template_id, item_key, item_label, sort_order,
      checked, flag_code, photo_required
    ) VALUES (
      v_inv.tenant_id,
      v_inv.id,
      v_tmpl.id,
      coalesce(v_item->>'key', 'item_' || v_sort::text),
      coalesce(v_item->>'label', 'Checklist item'),
      v_sort,
      NULL,
      coalesce(nullif(v_item->>'flag_default', ''), 'none'),
      coalesce((v_item->>'photo_required')::boolean, false)
    )
    ON CONFLICT (inspection_id, item_key) DO NOTHING;
    v_count := v_count + 1;
  END LOOP;

  RETURN jsonb_build_object(
    'inspection_id', v_inv.id,
    'template_id', v_tmpl.id,
    'work_type', v_work,
    'items_seeded', v_count
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.ml_p1_s8_upsert_checklist_response(
  p_inspection_id uuid,
  p_item_key text,
  p_checked boolean DEFAULT NULL,
  p_flag_code text DEFAULT NULL,
  p_notes text DEFAULT NULL
)
RETURNS public.inspection_checklist_responses
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_row public.inspection_checklist_responses%ROWTYPE;
  v_flag text := lower(coalesce(nullif(btrim(p_flag_code), ''), 'none'));
BEGIN
  PERFORM public.ml_p1_s8_assert_inspection_actor(p_inspection_id);

  IF v_flag NOT IN ('none', 'safety', 'quality', 'make_safe') THEN
    RAISE EXCEPTION 'ML_P1_S8_FLAG_INVALID' USING ERRCODE = 'P0001';
  END IF;

  UPDATE public.inspection_checklist_responses SET
    checked = coalesce(p_checked, checked),
    flag_code = CASE WHEN p_flag_code IS NULL THEN flag_code ELSE v_flag END,
    notes = CASE WHEN p_notes IS NULL THEN notes ELSE p_notes END,
    updated_at = now()
  WHERE inspection_id = p_inspection_id AND item_key = p_item_key
  RETURNING * INTO v_row;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'ML_P1_S8_CHECKLIST_ITEM_NOT_FOUND' USING ERRCODE = 'P0001';
  END IF;

  RETURN v_row;
END;
$$;

CREATE OR REPLACE FUNCTION public.ml_p1_s8_inspection_open_flags(p_tenant_id text DEFAULT NULL)
RETURNS TABLE (
  inspection_id uuid,
  title text,
  status text,
  work_type text,
  flag_code text,
  flag_count bigint,
  updated_at timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_tenant text;
  v_role text;
BEGIN
  IF coalesce(auth.role(), '') = 'service_role'
     OR current_user IN ('postgres', 'supabase_admin') THEN
    v_tenant := nullif(btrim(coalesce(p_tenant_id, '')), '');
    IF v_tenant IS NULL THEN
      RAISE EXCEPTION 'ML_P1_S8_TENANT_REQUIRED' USING ERRCODE = '42501';
    END IF;
  ELSE
    IF auth.uid() IS NULL THEN
      RAISE EXCEPTION 'ML_P1_S8_UNAUTHENTICATED' USING ERRCODE = '42501';
    END IF;
    v_tenant := public.inspection_current_tenant_id();
    IF v_tenant IS NULL OR btrim(v_tenant) = '' THEN
      RAISE EXCEPTION 'ML_P1_S8_TENANT_REQUIRED' USING ERRCODE = '42501';
    END IF;
    IF p_tenant_id IS NOT NULL AND nullif(btrim(p_tenant_id), '') IS DISTINCT FROM v_tenant THEN
      RAISE EXCEPTION 'ML_P1_S8_TENANT_ACCESS_DENIED' USING ERRCODE = '42501';
    END IF;
    IF NOT public.inspection_tenant_access(v_tenant) THEN
      RAISE EXCEPTION 'ML_P1_S8_TENANT_ACCESS_DENIED' USING ERRCODE = '42501';
    END IF;
    v_role := public.ml_p1_s2_current_actor_role();
    IF v_role NOT IN ('technician', 'office', 'manager', 'admin') THEN
      RAISE EXCEPTION 'ML_P1_S8_ROLE_DENIED' USING ERRCODE = '42501';
    END IF;
  END IF;

  RETURN QUERY
  SELECT
    i.id,
    i.title,
    i.status,
    i.work_type,
    r.flag_code,
    count(*)::bigint,
    max(r.updated_at)
  FROM public.inspection_checklist_responses r
  JOIN public.inspections i ON i.id = r.inspection_id
  WHERE r.flag_code IN ('safety', 'quality', 'make_safe')
    AND i.tenant_id = v_tenant
  GROUP BY i.id, i.title, i.status, i.work_type, r.flag_code
  ORDER BY max(r.updated_at) DESC;
END;
$$;

CREATE OR REPLACE FUNCTION public.ml_p1_s8_link_photo_checklist_item(
  p_inspection_id uuid,
  p_photo_id uuid,
  p_item_key text
)
RETURNS public.inspection_photos
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_inv public.inspections%ROWTYPE;
  v_photo public.inspection_photos%ROWTYPE;
BEGIN
  v_inv := public.ml_p1_s8_assert_inspection_actor(p_inspection_id);

  IF NOT EXISTS (
    SELECT 1 FROM public.inspection_checklist_responses r
    WHERE r.inspection_id = p_inspection_id AND r.item_key = p_item_key
  ) THEN
    RAISE EXCEPTION 'ML_P1_S8_CHECKLIST_ITEM_NOT_FOUND' USING ERRCODE = 'P0001';
  END IF;

  UPDATE public.inspection_photos
  SET checklist_item_key = p_item_key,
      updated_at = now()
  WHERE id = p_photo_id
    AND inspection_id = p_inspection_id
    AND tenant_id = v_inv.tenant_id
  RETURNING * INTO v_photo;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'ML_P1_S8_PHOTO_NOT_FOUND' USING ERRCODE = 'P0001';
  END IF;

  RETURN v_photo;
END;
$$;

-- Finalize only after S8 gates; idempotent if already reviewed at expected revision.
CREATE OR REPLACE FUNCTION public.inspection_finalize_phase5(
  p_tenant_id text,
  p_inspection_id uuid,
  p_expected_revision integer
)
RETURNS public.inspections
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_issues jsonb;
  v_row public.inspections;
BEGIN
  IF NOT public.inspection_tenant_access(p_tenant_id) THEN
    RAISE EXCEPTION 'tenant_access_denied';
  END IF;

  SELECT * INTO v_row
  FROM public.inspections
  WHERE id = p_inspection_id AND tenant_id = p_tenant_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'inspection_not_found';
  END IF;

  -- Idempotent success path: already reviewed at this revision.
  IF v_row.reviewed_at IS NOT NULL AND v_row.reviewed_revision IS NOT DISTINCT FROM p_expected_revision THEN
    RETURN v_row;
  END IF;

  -- Completion gates BEFORE preflight/mark (atomic with this function).
  PERFORM public.ml_p1_s8_assert_completion_gates(p_inspection_id);

  v_issues := public.inspection_finalization_preflight(p_tenant_id, p_inspection_id);
  IF jsonb_array_length(v_issues) > 0 THEN
    RAISE EXCEPTION USING errcode = 'P0001', message = 'inspection_preflight_failed', detail = v_issues::text;
  END IF;

  v_row := public.inspection_mark_reviewed(p_tenant_id, p_inspection_id, p_expected_revision);

  INSERT INTO public.inspection_events (tenant_id, inspection_id, event_type, actor_user_id, inspection_revision, metadata)
  VALUES (
    p_tenant_id,
    p_inspection_id,
    'inspection_finalized_phase5',
    auth.uid(),
    p_expected_revision,
    jsonb_build_object('coherence_gate', 'passed', 'ml_p1_s8_completion_gates', 'passed')
  );

  RETURN v_row;
END;
$$;

-- Grants: revoke overly broad defaults, grant least privilege
REVOKE ALL ON FUNCTION public.ml_p1_s8_photos_before_report_enabled() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.ml_p1_s8_assert_photos_before_report(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.ml_p1_s8_assert_completion_gates(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.ml_p1_s8_assert_inspection_actor(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.ml_p1_s8_valid_evidence_photo_count(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.ml_p1_s8_mark_photos_wave_complete(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.ml_p1_s8_seed_checklist_for_inspection(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.ml_p1_s8_upsert_checklist_response(uuid, text, boolean, text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.ml_p1_s8_inspection_open_flags(text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.ml_p1_s8_link_photo_checklist_item(uuid, uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.inspection_finalize_phase5(text, uuid, integer) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.ml_p1_s8_photos_before_report_enabled() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.ml_p1_s8_assert_photos_before_report(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.ml_p1_s8_assert_completion_gates(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.ml_p1_s8_valid_evidence_photo_count(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.ml_p1_s8_mark_photos_wave_complete(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.ml_p1_s8_seed_checklist_for_inspection(uuid, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.ml_p1_s8_upsert_checklist_response(uuid, text, boolean, text, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.ml_p1_s8_inspection_open_flags(text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.ml_p1_s8_link_photo_checklist_item(uuid, uuid, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.inspection_finalize_phase5(text, uuid, integer) TO authenticated, service_role;

-- Internal helper: do not expose assert_inspection_actor broadly beyond service/authenticated
-- (authenticated needs it only via other RPCs; revoke direct if desired — keep for tests)
GRANT EXECUTE ON FUNCTION public.ml_p1_s8_assert_inspection_actor(uuid) TO service_role;

COMMENT ON FUNCTION public.ml_p1_s8_assert_completion_gates(uuid) IS
  'ML-P1 S8 remediation: tenant/role + checklist answers + required complete photos before finalize';

COMMIT;

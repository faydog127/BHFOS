-- Hotfix: SECURITY DEFINER must not treat function owner (current_user=postgres)
-- as a privileged bypass for JWT callers. Privilege path is auth.role()=service_role only.
-- Authorized under Founder S8 A3 remediation (auth/integrity).

BEGIN;

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

  -- Only service_role bypasses JWT tenant/role checks.
  -- Do NOT use current_user: under SECURITY DEFINER it is the function owner.
  IF coalesce(auth.role(), '') = 'service_role' THEN
    RETURN v_inv;
  END IF;

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

  RETURN v_inv;
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
  IF coalesce(auth.role(), '') = 'service_role' THEN
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

-- Trigger helpers: never privilege-bypass via current_user owner identity.
CREATE OR REPLACE FUNCTION public.ml_p1_s8_checklist_responses_guard()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, auth
AS $$
BEGIN
  IF coalesce(auth.role(), '') = 'service_role' THEN
    RETURN coalesce(NEW, OLD);
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF current_setting('app.ml_p1_s8_checklist_seed', true) IS DISTINCT FROM '1' THEN
      RAISE EXCEPTION 'ML_P1_S8_CHECKLIST_IMMUTABLE: insert only via seed RPC'
        USING ERRCODE = 'P0001';
    END IF;
    RETURN NEW;
  END IF;

  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'ML_P1_S8_CHECKLIST_IMMUTABLE: delete not allowed'
      USING ERRCODE = 'P0001';
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF coalesce(NEW.photo_required, false) IS DISTINCT FROM coalesce(OLD.photo_required, false)
       OR coalesce(NEW.item_key, '') IS DISTINCT FROM coalesce(OLD.item_key, '')
       OR coalesce(NEW.item_label, '') IS DISTINCT FROM coalesce(OLD.item_label, '')
       OR coalesce(NEW.sort_order, 0) IS DISTINCT FROM coalesce(OLD.sort_order, 0)
       OR NEW.template_id IS DISTINCT FROM OLD.template_id
       OR NEW.tenant_id IS DISTINCT FROM OLD.tenant_id
       OR NEW.inspection_id IS DISTINCT FROM OLD.inspection_id THEN
      RAISE EXCEPTION 'ML_P1_S8_CHECKLIST_IMMUTABLE: seeded fields cannot change'
        USING ERRCODE = 'P0001';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.inspection_photos_update_guard()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, auth
AS $$
DECLARE
  parent_status text;
  allowed boolean := false;
BEGIN
  IF coalesce(auth.role(), '') = 'service_role' THEN
    RETURN coalesce(NEW, OLD);
  END IF;

  SELECT lower(coalesce(i.status, 'draft'))
    INTO parent_status
  FROM public.inspections i
  WHERE i.id = coalesce(NEW.inspection_id, OLD.inspection_id)
    AND i.tenant_id = coalesce(NEW.tenant_id, OLD.tenant_id);

  IF NOT FOUND THEN
    RAISE EXCEPTION USING errcode = 'P0001', message = 'Parent inspection not found';
  END IF;

  IF TG_OP IN ('INSERT', 'DELETE') THEN
    IF parent_status <> 'draft' THEN
      RAISE EXCEPTION USING errcode = 'P0001', message = 'Inspection is locked. Reopen to edit.';
    END IF;
    RETURN coalesce(NEW, OLD);
  END IF;

  IF parent_status = 'draft' THEN
    RETURN NEW;
  END IF;

  IF coalesce(NEW.tenant_id, '') <> coalesce(OLD.tenant_id, '') THEN allowed := false; ELSE allowed := true; END IF;
  IF allowed AND coalesce(NEW.inspection_id::text, '') <> coalesce(OLD.inspection_id::text, '') THEN allowed := false; END IF;
  IF allowed AND coalesce(NEW.finding_id::text, '') <> coalesce(OLD.finding_id::text, '') THEN allowed := false; END IF;
  IF allowed AND coalesce(NEW.recommendation_id::text, '') <> coalesce(OLD.recommendation_id::text, '') THEN allowed := false; END IF;
  IF allowed AND coalesce(NEW.caption, '') <> coalesce(OLD.caption, '') THEN allowed := false; END IF;
  IF allowed AND coalesce(NEW.category, '') <> coalesce(OLD.category, '') THEN allowed := false; END IF;
  IF allowed AND coalesce(NEW.is_before::text, '') <> coalesce(OLD.is_before::text, '') THEN allowed := false; END IF;
  IF allowed AND coalesce(NEW.object_path, '') <> coalesce(OLD.object_path, '') THEN allowed := false; END IF;
  IF allowed AND coalesce(NEW.bucket_id, '') <> coalesce(OLD.bucket_id, '') THEN allowed := false; END IF;
  IF allowed AND coalesce(NEW.file_name, '') <> coalesce(OLD.file_name, '') THEN allowed := false; END IF;
  IF allowed AND coalesce(NEW.taken_at::text, '') <> coalesce(OLD.taken_at::text, '') THEN allowed := false; END IF;
  IF allowed AND coalesce(NEW.checklist_item_key, '') <> coalesce(OLD.checklist_item_key, '')
     AND current_setting('app.ml_p1_s8_link_photo', true) IS DISTINCT FROM '1' THEN
    allowed := false;
  END IF;
  IF allowed AND coalesce(NEW.is_voided, false) <> coalesce(OLD.is_voided, false) THEN allowed := false; END IF;
  IF allowed AND coalesce(NEW.void_reason, '') <> coalesce(OLD.void_reason, '') THEN allowed := false; END IF;
  IF allowed AND coalesce(NEW.voided_by::text, '') <> coalesce(OLD.voided_by::text, '') THEN allowed := false; END IF;
  IF allowed AND coalesce(NEW.voided_at::text, '') <> coalesce(OLD.voided_at::text, '') THEN allowed := false; END IF;

  IF NOT allowed THEN
    RAISE EXCEPTION USING errcode = 'P0001', message = 'Inspection is locked. Reopen to edit.';
  END IF;

  RETURN NEW;
END;
$$;

COMMIT;

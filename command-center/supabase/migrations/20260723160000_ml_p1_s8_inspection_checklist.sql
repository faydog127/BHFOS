-- ML-P1 Slice 8 A2: inspection checklist templates, structured flags, photo retention, photos-before-report gate.
-- Authority: Founder Category-C 2026-07-23 · PD-S8-01..07 = A · CACHE_MB=250 · RETENTION_MONTHS=24
-- Scope: inspection workflow only — photo-bundle product & Stripe deferred.
-- Base: 28e8290a69773cda146cac083971700778db1db7

-- ---------------------------------------------------------------------------
-- Runtime config
-- ---------------------------------------------------------------------------
INSERT INTO public.global_config (key, value, updated_at)
VALUES
  ('inspection.offline_cache_mb', '250', now()),
  ('inspection.photo_retention_months', '24', now()),
  ('inspection.photos_before_report', 'true', now())
ON CONFLICT (key) DO UPDATE
  SET value = EXCLUDED.value, updated_at = now();

-- ---------------------------------------------------------------------------
-- Inspection columns
-- ---------------------------------------------------------------------------
ALTER TABLE public.inspections
  ADD COLUMN IF NOT EXISTS work_type text,
  ADD COLUMN IF NOT EXISTS photos_wave_complete_at timestamptz,
  ADD COLUMN IF NOT EXISTS checklist_template_id uuid;

-- Prefer existing service_type when work_type empty
UPDATE public.inspections
SET work_type = nullif(btrim(service_type), '')
WHERE work_type IS NULL
  AND service_type IS NOT NULL
  AND btrim(service_type) <> '';

CREATE INDEX IF NOT EXISTS inspections_tenant_work_type_idx
  ON public.inspections (tenant_id, work_type);

-- ---------------------------------------------------------------------------
-- Photo retention
-- ---------------------------------------------------------------------------
ALTER TABLE public.inspection_photos
  ADD COLUMN IF NOT EXISTS retain_until timestamptz;

UPDATE public.inspection_photos
SET retain_until = coalesce(created_at, now()) + interval '24 months'
WHERE retain_until IS NULL;

CREATE OR REPLACE FUNCTION public.ml_p1_s8_default_photo_retain_until()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.retain_until IS NULL THEN
    NEW.retain_until := coalesce(NEW.created_at, now()) + interval '24 months';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_ml_p1_s8_photo_retain_until ON public.inspection_photos;
CREATE TRIGGER trg_ml_p1_s8_photo_retain_until
  BEFORE INSERT ON public.inspection_photos
  FOR EACH ROW
  EXECUTE FUNCTION public.ml_p1_s8_default_photo_retain_until();

-- ---------------------------------------------------------------------------
-- Checklist templates + responses
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.inspection_checklist_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id text NOT NULL,
  work_type text NOT NULL,
  name text NOT NULL,
  version integer NOT NULL DEFAULT 1,
  is_active boolean NOT NULL DEFAULT true,
  items jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT inspection_checklist_templates_work_type_unique UNIQUE (tenant_id, work_type, version)
);

CREATE INDEX IF NOT EXISTS inspection_checklist_templates_active_idx
  ON public.inspection_checklist_templates (tenant_id, work_type)
  WHERE is_active;

ALTER TABLE public.inspection_checklist_templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS inspection_checklist_templates_tenant_select ON public.inspection_checklist_templates;
CREATE POLICY inspection_checklist_templates_tenant_select
  ON public.inspection_checklist_templates FOR SELECT TO authenticated
  USING (
    tenant_id = coalesce(
      auth.jwt() -> 'app_metadata' ->> 'tenant_id',
      auth.jwt() -> 'user_metadata' ->> 'tenant_id'
    )
  );

DROP POLICY IF EXISTS inspection_checklist_templates_tenant_write ON public.inspection_checklist_templates;
CREATE POLICY inspection_checklist_templates_tenant_write
  ON public.inspection_checklist_templates FOR ALL TO authenticated
  USING (
    tenant_id = coalesce(
      auth.jwt() -> 'app_metadata' ->> 'tenant_id',
      auth.jwt() -> 'user_metadata' ->> 'tenant_id'
    )
  )
  WITH CHECK (
    tenant_id = coalesce(
      auth.jwt() -> 'app_metadata' ->> 'tenant_id',
      auth.jwt() -> 'user_metadata' ->> 'tenant_id'
    )
  );

DROP POLICY IF EXISTS inspection_checklist_templates_service ON public.inspection_checklist_templates;
CREATE POLICY inspection_checklist_templates_service
  ON public.inspection_checklist_templates FOR ALL TO service_role
  USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public.inspection_checklist_responses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id text NOT NULL,
  inspection_id uuid NOT NULL REFERENCES public.inspections(id) ON DELETE CASCADE,
  template_id uuid NOT NULL REFERENCES public.inspection_checklist_templates(id),
  item_key text NOT NULL,
  item_label text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  -- Structured on/off/flag (PD-S8-05)
  checked boolean,
  flag_code text NOT NULL DEFAULT 'none'
    CHECK (flag_code IN ('none', 'safety', 'quality', 'make_safe')),
  notes text,
  photo_required boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT inspection_checklist_responses_unique UNIQUE (inspection_id, item_key)
);

CREATE INDEX IF NOT EXISTS inspection_checklist_responses_inspection_idx
  ON public.inspection_checklist_responses (inspection_id, sort_order);
CREATE INDEX IF NOT EXISTS inspection_checklist_responses_flags_idx
  ON public.inspection_checklist_responses (tenant_id, flag_code)
  WHERE flag_code <> 'none';

ALTER TABLE public.inspection_checklist_responses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS inspection_checklist_responses_tenant_all ON public.inspection_checklist_responses;
CREATE POLICY inspection_checklist_responses_tenant_all
  ON public.inspection_checklist_responses FOR ALL TO authenticated
  USING (
    tenant_id = coalesce(
      auth.jwt() -> 'app_metadata' ->> 'tenant_id',
      auth.jwt() -> 'user_metadata' ->> 'tenant_id'
    )
  )
  WITH CHECK (
    tenant_id = coalesce(
      auth.jwt() -> 'app_metadata' ->> 'tenant_id',
      auth.jwt() -> 'user_metadata' ->> 'tenant_id'
    )
  );

DROP POLICY IF EXISTS inspection_checklist_responses_service ON public.inspection_checklist_responses;
CREATE POLICY inspection_checklist_responses_service
  ON public.inspection_checklist_responses FOR ALL TO service_role
  USING (true) WITH CHECK (true);

ALTER TABLE public.inspections
  DROP CONSTRAINT IF EXISTS inspections_checklist_template_id_fkey;
ALTER TABLE public.inspections
  ADD CONSTRAINT inspections_checklist_template_id_fkey
  FOREIGN KEY (checklist_template_id)
  REFERENCES public.inspection_checklist_templates(id)
  ON DELETE SET NULL;

-- ---------------------------------------------------------------------------
-- Seed default templates (tvg + generic)
-- ---------------------------------------------------------------------------
INSERT INTO public.inspection_checklist_templates (tenant_id, work_type, name, version, items)
VALUES
(
  'tvg',
  'dryer_vent',
  'Dryer Vent Inspection',
  1,
  '[
    {"key":"vent_intake_clear","label":"Intake / lint trap clear","photo_required":true,"flag_default":"none"},
    {"key":"duct_run_intact","label":"Duct run intact / no crush","photo_required":true,"flag_default":"none"},
    {"key":"termination_clear","label":"Exterior termination clear","photo_required":true,"flag_default":"none"},
    {"key":"fire_hazard","label":"Fire / overheat hazard observed","photo_required":true,"flag_default":"safety"},
    {"key":"moisture_damage","label":"Moisture damage near duct","photo_required":false,"flag_default":"quality"}
  ]'::jsonb
),
(
  'tvg',
  'general',
  'General Service Inspection',
  1,
  '[
    {"key":"site_safe","label":"Work area safe for service","photo_required":false,"flag_default":"none"},
    {"key":"before_condition","label":"Before condition documented","photo_required":true,"flag_default":"none"},
    {"key":"after_condition","label":"After condition documented","photo_required":true,"flag_default":"none"},
    {"key":"safety_issue","label":"Safety issue present","photo_required":true,"flag_default":"safety"},
    {"key":"quality_concern","label":"Quality / workmanship concern","photo_required":false,"flag_default":"quality"}
  ]'::jsonb
)
ON CONFLICT (tenant_id, work_type, version) DO NOTHING;

-- ---------------------------------------------------------------------------
-- RPCs
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.ml_p1_s8_photos_before_report_enabled()
RETURNS boolean
LANGUAGE sql
STABLE
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
SET search_path = public
AS $$
DECLARE
  v_inv public.inspections%ROWTYPE;
  v_photo_count integer;
BEGIN
  IF NOT public.ml_p1_s8_photos_before_report_enabled() THEN
    RETURN;
  END IF;

  SELECT * INTO v_inv FROM public.inspections WHERE id = p_inspection_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'ML_P1_S8_INSPECTION_NOT_FOUND' USING ERRCODE = 'P0001';
  END IF;

  IF v_inv.photos_wave_complete_at IS NOT NULL THEN
    RETURN;
  END IF;

  SELECT count(*) INTO v_photo_count
  FROM public.inspection_photos
  WHERE inspection_id = p_inspection_id
    AND coalesce(is_voided, false) IS NOT TRUE;

  IF v_photo_count < 1 THEN
    RAISE EXCEPTION 'ML_P1_S8_PHOTOS_REQUIRED: complete photo wave before report'
      USING ERRCODE = 'P0001';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.ml_p1_s8_mark_photos_wave_complete(p_inspection_id uuid)
RETURNS timestamptz
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_at timestamptz;
  v_count integer;
BEGIN
  SELECT count(*) INTO v_count
  FROM public.inspection_photos
  WHERE inspection_id = p_inspection_id
    AND coalesce(is_voided, false) IS NOT TRUE;

  IF v_count < 1 THEN
    RAISE EXCEPTION 'ML_P1_S8_PHOTOS_REQUIRED' USING ERRCODE = 'P0001';
  END IF;

  UPDATE public.inspections
  SET photos_wave_complete_at = coalesce(photos_wave_complete_at, now()),
      updated_at = now()
  WHERE id = p_inspection_id
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
SET search_path = public
AS $$
DECLARE
  v_inv public.inspections%ROWTYPE;
  v_tmpl public.inspection_checklist_templates%ROWTYPE;
  v_work text;
  v_item jsonb;
  v_sort int := 0;
  v_count int := 0;
BEGIN
  SELECT * INTO v_inv FROM public.inspections WHERE id = p_inspection_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'ML_P1_S8_INSPECTION_NOT_FOUND' USING ERRCODE = 'P0001';
  END IF;

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
  WHERE id = p_inspection_id;

  FOR v_item IN SELECT * FROM jsonb_array_elements(coalesce(v_tmpl.items, '[]'::jsonb))
  LOOP
    v_sort := v_sort + 10;
    INSERT INTO public.inspection_checklist_responses (
      tenant_id, inspection_id, template_id, item_key, item_label, sort_order,
      checked, flag_code, photo_required
    ) VALUES (
      v_inv.tenant_id,
      p_inspection_id,
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
    'inspection_id', p_inspection_id,
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
SET search_path = public
AS $$
DECLARE
  v_row public.inspection_checklist_responses%ROWTYPE;
  v_flag text := lower(coalesce(nullif(btrim(p_flag_code), ''), 'none'));
BEGIN
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
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
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
    AND (p_tenant_id IS NULL OR i.tenant_id = p_tenant_id)
  GROUP BY i.id, i.title, i.status, i.work_type, r.flag_code
  ORDER BY max(r.updated_at) DESC;
$$;

GRANT EXECUTE ON FUNCTION public.ml_p1_s8_photos_before_report_enabled() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.ml_p1_s8_assert_photos_before_report(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.ml_p1_s8_mark_photos_wave_complete(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.ml_p1_s8_seed_checklist_for_inspection(uuid, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.ml_p1_s8_upsert_checklist_response(uuid, text, boolean, text, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.ml_p1_s8_inspection_open_flags(text) TO authenticated, service_role;

COMMENT ON TABLE public.inspection_checklist_templates IS 'ML-P1 S8: work-type checklist templates';
COMMENT ON TABLE public.inspection_checklist_responses IS 'ML-P1 S8: per-inspection checklist answers with structured flags';

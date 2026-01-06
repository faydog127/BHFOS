-- Migration: add missing tables used by call console and signals view shim

-- 1) property_inspections (used by PropertyInspectionPanel.jsx)
CREATE TABLE IF NOT EXISTS public.property_inspections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  address text,
  street_view_url text,
  is_two_story boolean DEFAULT false,
  dryer_vent_on_roof boolean DEFAULT false,
  has_screen boolean DEFAULT false,
  ai_confidence_score integer,
  inspection_notes text,
  inspected_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_property_inspections_lead_id ON public.property_inspections (lead_id);

CREATE OR REPLACE FUNCTION public.handle_property_inspections_updated_at()
RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_property_inspections_updated_at ON public.property_inspections;
CREATE TRIGGER trg_property_inspections_updated_at
BEFORE UPDATE ON public.property_inspections
FOR EACH ROW
EXECUTE FUNCTION public.handle_property_inspections_updated_at();

-- 2) rep_checklists (used by FastRepChecklist.jsx)
CREATE TABLE IF NOT EXISTS public.rep_checklists (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  author uuid NOT NULL REFERENCES auth.users(id),
  notes text,
  why_now text,
  fit text,
  dm_reachable boolean DEFAULT false,
  momentum text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_rep_checklists_lead_id ON public.rep_checklists (lead_id);
CREATE INDEX IF NOT EXISTS idx_rep_checklists_author ON public.rep_checklists (author);

CREATE OR REPLACE FUNCTION public.handle_rep_checklists_updated_at()
RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_rep_checklists_updated_at ON public.rep_checklists;
CREATE TRIGGER trg_rep_checklists_updated_at
BEFORE UPDATE ON public.rep_checklists
FOR EACH ROW
EXECUTE FUNCTION public.handle_rep_checklists_updated_at();

-- 3) signals view shim to map code expectation to existing marketing_signals table
CREATE OR REPLACE VIEW public.signals AS
SELECT * FROM public.marketing_signals;


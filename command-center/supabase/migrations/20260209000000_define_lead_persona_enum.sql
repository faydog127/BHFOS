-- 1) Create enum if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'lead_persona') THEN
    CREATE TYPE public.lead_persona AS ENUM (
      'unclassified',
      'homeowner',
      'realtor',
      'property_manager',
      'hoa',
      'government',
      'b2b',
      'hvac_partner',
      'contractor',
      'vendor',
      'other_partner'
    );
  END IF;
END $$;

-- 2) Convert leads.persona from text -> enum safely
--    Any unexpected/NULL values become 'unclassified' (no NULLs after this).
ALTER TABLE public.leads
  ALTER COLUMN persona DROP DEFAULT;

ALTER TABLE public.leads
  ALTER COLUMN persona TYPE public.lead_persona
  USING (
    CASE
      WHEN persona IS NULL THEN 'unclassified'::public.lead_persona
      WHEN persona IN (
        'homeowner',
        'realtor',
        'property_manager',
        'hoa',
        'government',
        'b2b',
        'hvac_partner',
        'contractor',
        'vendor',
        'other_partner'
      ) THEN persona::public.lead_persona
      ELSE 'unclassified'::public.lead_persona
    END
  );

-- 3) Enforce: never NULL again
ALTER TABLE public.leads
  ALTER COLUMN persona SET DEFAULT 'unclassified',
  ALTER COLUMN persona SET NOT NULL;

COMMENT ON COLUMN public.leads.persona IS
  'Lead persona. Defaults to unclassified; must be set explicitly during intake.';

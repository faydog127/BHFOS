-- Bridge migration for environments where 20260209000000 fails with:
-- "operator does not exist: text = lead_persona"
-- Keeps historical file untouched; applies intended state idempotently.

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

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'leads'
      AND column_name = 'persona'
  ) THEN
    -- Legacy schemas may have a check constraint comparing segment=text to persona.
    -- Drop before type conversion and recreate with explicit persona::text afterwards.
    IF EXISTS (
      SELECT 1
      FROM pg_constraint
      WHERE conname = 'leads_segment_check'
        AND conrelid = 'public.leads'::regclass
    ) THEN
      ALTER TABLE public.leads
        DROP CONSTRAINT leads_segment_check;
    END IF;

    -- Normalize nulls before constraints.
    UPDATE public.leads
    SET persona = 'unclassified'
    WHERE persona IS NULL;

    -- Only cast when still text/varchar/etc.
    IF EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'leads'
        AND column_name = 'persona'
        AND udt_name <> 'lead_persona'
    ) THEN
      ALTER TABLE public.leads
        ALTER COLUMN persona DROP DEFAULT;

      ALTER TABLE public.leads
        ALTER COLUMN persona TYPE public.lead_persona
        USING (
          CASE
            WHEN persona IS NULL THEN 'unclassified'::public.lead_persona
            WHEN persona::text = ANY (
              ARRAY[
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
              ]::text[]
            ) THEN persona::text::public.lead_persona
            ELSE 'unclassified'::public.lead_persona
          END
        );
    END IF;

    ALTER TABLE public.leads
      ALTER COLUMN persona SET DEFAULT 'unclassified',
      ALTER COLUMN persona SET NOT NULL;

    IF EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'leads'
        AND column_name = 'segment'
    ) THEN
      ALTER TABLE public.leads
        ADD CONSTRAINT leads_segment_check
        CHECK ((persona IS NULL) OR (segment = persona::text));
    END IF;

    COMMENT ON COLUMN public.leads.persona IS
      'Lead persona. Defaults to unclassified; must be set explicitly during intake.';
  END IF;
END $$;

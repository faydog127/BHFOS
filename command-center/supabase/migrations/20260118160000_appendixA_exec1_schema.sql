-- A-DB-01 Events
CREATE SCHEMA IF NOT EXISTS public;

CREATE TABLE IF NOT EXISTS public.events (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id text,
    entity_type text NOT NULL,
    entity_id uuid NOT NULL,
    event_type text NOT NULL,
    actor_type text NOT NULL,
    actor_id uuid,
    payload jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS events_tenant_created_idx
    ON public.events (tenant_id, created_at DESC);

CREATE INDEX IF NOT EXISTS events_entity_idx
    ON public.events (entity_type, entity_id, created_at DESC);

CREATE INDEX IF NOT EXISTS events_event_type_idx
    ON public.events (event_type, created_at DESC);

-- A-DB-02 Automation Suspensions
CREATE TABLE IF NOT EXISTS public.automation_suspensions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id text,
    entity_type text NOT NULL,
    entity_id uuid NOT NULL,
    reason text NOT NULL,
    suspended_at timestamptz NOT NULL DEFAULT now(),
    resumed_at timestamptz
);

CREATE UNIQUE INDEX IF NOT EXISTS automation_suspensions_tenant_active_uq
    ON public.automation_suspensions (tenant_id, entity_type, entity_id)
    WHERE resumed_at IS NULL AND tenant_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS automation_suspensions_entity_active_uq
    ON public.automation_suspensions (entity_type, entity_id)
    WHERE resumed_at IS NULL AND tenant_id IS NULL;

CREATE INDEX IF NOT EXISTS automation_suspensions_tenant_suspended_idx
    ON public.automation_suspensions (tenant_id, suspended_at DESC);

CREATE INDEX IF NOT EXISTS automation_suspensions_entity_idx
    ON public.automation_suspensions (entity_type, entity_id);

-- A-DB-03 Job Status Extension
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'job_status') THEN
        BEGIN
            ALTER TYPE job_status ADD VALUE 'UNSCHEDULED';
        EXCEPTION WHEN duplicate_object THEN
            -- already exists
        END;
    END IF;
END;
$$;

-- A-DB-04 Line Items JSONB Exposure
CREATE OR REPLACE VIEW public.quote_line_items AS
SELECT
    quote_id,
    COALESCE(
        jsonb_agg(
            jsonb_build_object(
                'id', id,
                'description', description,
                'quantity', quantity,
                'unit_price', unit_price,
                'total_price', total_price
            ) ORDER BY id
        ) FILTER (WHERE quote_id IS NOT NULL),
        '[]'::jsonb
    ) AS line_items
FROM public.quote_items
GROUP BY quote_id;

CREATE OR REPLACE VIEW public.invoice_line_items AS
SELECT
    invoice_id,
    COALESCE(
        jsonb_agg(
            jsonb_build_object(
                'id', id,
                'description', description,
                'quantity', quantity,
                'unit_price', unit_price,
                'total_price', total_price
            ) ORDER BY id
        ) FILTER (WHERE invoice_id IS NOT NULL),
        '[]'::jsonb
    ) AS line_items
FROM public.invoice_items
GROUP BY invoice_id;

-- A-DB-05 Manual Convert Fields
ALTER TABLE IF EXISTS public.contacts
    ADD COLUMN IF NOT EXISTS is_customer boolean NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS customer_created_at timestamptz,
    ADD COLUMN IF NOT EXISTS manual_convert_reason text;

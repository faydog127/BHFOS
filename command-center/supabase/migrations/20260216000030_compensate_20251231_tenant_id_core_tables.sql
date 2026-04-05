-- Compensating migration for legacy tenant_id retrofit (20251231) that may be marked applied.
-- Scope: Money Loop core tables only, additive + idempotent, single-tenant-friendly.
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'leads',
    'quotes',
    'quote_items',
    'jobs',
    'invoices',
    'invoice_items',
    'crm_tasks',
    'events',
    'automation_suspensions'
  ]
  LOOP
    IF EXISTS (
      SELECT 1
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name = t
    ) THEN
      EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS tenant_id text', t);
      EXECUTE format(
        'COMMENT ON COLUMN public.%I.tenant_id IS %L',
        t,
        'Tenant scope (optional in v1; reserved for multi-tenant).'
      );
    END IF;
  END LOOP;
END $$;

-- Enable tenant-scoped reads for leads

ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Leads are readable by tenant" ON public.leads;

CREATE POLICY "Leads are readable by tenant"
ON public.leads
FOR SELECT
USING (
  tenant_id = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')
);

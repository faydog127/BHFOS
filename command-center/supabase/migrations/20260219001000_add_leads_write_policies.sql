-- Enable tenant-scoped writes for leads (used by CRM ProposalBuilder "Create New Customer").

ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Leads are insertable by tenant" ON public.leads;
DROP POLICY IF EXISTS "Leads are updatable by tenant" ON public.leads;
DROP POLICY IF EXISTS "Leads are deletable by tenant" ON public.leads;
DROP POLICY IF EXISTS "Leads service role full access" ON public.leads;

CREATE POLICY "Leads are insertable by tenant"
ON public.leads
FOR INSERT
TO authenticated
WITH CHECK (
  tenant_id = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')
);

CREATE POLICY "Leads are updatable by tenant"
ON public.leads
FOR UPDATE
TO authenticated
USING (
  tenant_id = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')
)
WITH CHECK (
  tenant_id = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')
);

CREATE POLICY "Leads are deletable by tenant"
ON public.leads
FOR DELETE
TO authenticated
USING (
  tenant_id = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')
);

CREATE POLICY "Leads service role full access"
ON public.leads
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

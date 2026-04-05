-- Enable RLS and create policies for quotes table
-- Allows authenticated users to create/update/delete their own quotes

ALTER TABLE public.quotes ENABLE ROW LEVEL SECURITY;

-- DROP any existing policies
DROP POLICY IF EXISTS "Quotes readable by tenant" ON public.quotes;
DROP POLICY IF EXISTS "Quotes writable by authenticated users" ON public.quotes;
DROP POLICY IF EXISTS "quotes_all_authenticated" ON public.quotes;

-- SELECT policy: users can read quotes from their tenant
CREATE POLICY "Quotes readable by tenant"
ON public.quotes
FOR SELECT
USING (
  tenant_id = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')
);

-- INSERT policy: authenticated users can create quotes for their tenant
CREATE POLICY "Quotes writable by authenticated users"
ON public.quotes
FOR INSERT
WITH CHECK (
  tenant_id = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')
  OR user_id = auth.uid()
);

-- UPDATE policy: users can update quotes from their tenant
CREATE POLICY "Quotes updatable by tenant"
ON public.quotes
FOR UPDATE
USING (
  tenant_id = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')
  OR user_id = auth.uid()
)
WITH CHECK (
  tenant_id = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')
  OR user_id = auth.uid()
);

-- DELETE policy: users can delete quotes from their tenant
CREATE POLICY "Quotes deletable by tenant"
ON public.quotes
FOR DELETE
USING (
  tenant_id = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')
  OR user_id = auth.uid()
);

-- Service role bypass
CREATE POLICY "Service role full access to quotes"
ON public.quotes
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

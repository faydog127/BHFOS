-- Fix quote_items RLS insert failures caused by quotes SELECT visibility.
-- quote_items policies reference public.quotes in EXISTS(...) checks; if the parent
-- quote row is not selectable, INSERT/UPDATE on quote_items can fail with 42501.
-- Ensure quote owners can SELECT their own quotes even when tenant claim is missing.

ALTER TABLE public.quotes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Quotes readable by tenant" ON public.quotes;
DROP POLICY IF EXISTS "Quotes readable by tenant_or_owner" ON public.quotes;

CREATE POLICY "Quotes readable by tenant"
ON public.quotes
FOR SELECT
USING (
  tenant_id = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')
  OR user_id = auth.uid()
);

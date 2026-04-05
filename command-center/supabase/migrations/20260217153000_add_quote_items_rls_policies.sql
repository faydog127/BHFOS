-- Enable tenant-safe quote_items access via parent quote ownership.
-- This unblocks proposal saves where quotes insert succeeds but quote_items insert hits 42501.

ALTER TABLE public.quote_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Quote items readable by parent quote" ON public.quote_items;
DROP POLICY IF EXISTS "Quote items writable by parent quote" ON public.quote_items;
DROP POLICY IF EXISTS "Quote items updatable by parent quote" ON public.quote_items;
DROP POLICY IF EXISTS "Quote items deletable by parent quote" ON public.quote_items;
DROP POLICY IF EXISTS "Service role full access to quote items" ON public.quote_items;

CREATE POLICY "Quote items readable by parent quote"
ON public.quote_items
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.quotes q
    WHERE q.id = quote_items.quote_id
      AND (
        q.tenant_id = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')
        OR q.user_id = auth.uid()
      )
  )
);

CREATE POLICY "Quote items writable by parent quote"
ON public.quote_items
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.quotes q
    WHERE q.id = quote_items.quote_id
      AND (
        q.tenant_id = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')
        OR q.user_id = auth.uid()
      )
  )
);

CREATE POLICY "Quote items updatable by parent quote"
ON public.quote_items
FOR UPDATE
USING (
  EXISTS (
    SELECT 1
    FROM public.quotes q
    WHERE q.id = quote_items.quote_id
      AND (
        q.tenant_id = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')
        OR q.user_id = auth.uid()
      )
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.quotes q
    WHERE q.id = quote_items.quote_id
      AND (
        q.tenant_id = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')
        OR q.user_id = auth.uid()
      )
  )
);

CREATE POLICY "Quote items deletable by parent quote"
ON public.quote_items
FOR DELETE
USING (
  EXISTS (
    SELECT 1
    FROM public.quotes q
    WHERE q.id = quote_items.quote_id
      AND (
        q.tenant_id = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')
        OR q.user_id = auth.uid()
      )
  )
);

CREATE POLICY "Service role full access to quote items"
ON public.quote_items
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

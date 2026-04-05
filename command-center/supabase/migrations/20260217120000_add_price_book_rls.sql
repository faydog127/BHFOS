-- Configure price_book access control
-- This is a product catalog, readable by all

-- Disable RLS since price_book is a public catalog
ALTER TABLE public.price_book DISABLE ROW LEVEL SECURITY;

-- Drop any existing policies
DROP POLICY IF EXISTS "price_book_public_select" ON public.price_book;
DROP POLICY IF EXISTS "price_book_tenant_isolation" ON public.price_book;
DROP POLICY IF EXISTS "price_book_service_role_all" ON public.price_book;


-- Migration: Create Core System Tables
-- Description: Adds app_user_roles and global_config tables as required by the Core Foundation module.

-- 1. app_user_roles
-- We drop to ensure schema matches the new definition exactly
DROP TABLE IF EXISTS public.app_user_roles CASCADE;

CREATE TABLE public.app_user_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    role TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS and Basic Policies
ALTER TABLE public.app_user_roles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable read access for all users" 
ON public.app_user_roles FOR SELECT 
USING (true);

CREATE POLICY "Enable full access for service role" 
ON public.app_user_roles FOR ALL 
USING (true);

-- 2. global_config
DROP TABLE IF EXISTS public.global_config CASCADE;

CREATE TABLE public.global_config (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    key TEXT UNIQUE NOT NULL,
    value TEXT,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS and Basic Policies
ALTER TABLE public.global_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable read access for all users" 
ON public.global_config FOR SELECT 
USING (true);

CREATE POLICY "Enable full access for service role" 
ON public.global_config FOR ALL 
USING (true);

-- Optional: Seed some initial config if needed
INSERT INTO public.global_config (key, value)
VALUES 
  ('system_status', 'active'),
  ('maintenance_mode', 'false')
ON CONFLICT (key) DO NOTHING;
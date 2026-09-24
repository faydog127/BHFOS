-- Disposable local Postgres only. Do not run on staging or production.
-- Staging already has CRM tables. This stub exists so the apply pack can be
-- executed locally without touching glkrykpksbsqmmilmjhs.

DO $$ BEGIN CREATE ROLE anon NOLOGIN; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE ROLE authenticated NOLOGIN; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE ROLE service_role NOLOGIN BYPASSRLS; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE public.contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id text,
  email text,
  phone text,
  name text
);

CREATE TABLE public.leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id text,
  email text,
  phone text,
  status text DEFAULT 'new',
  contact_id uuid
);

ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;

CREATE POLICY contacts_authenticated_all ON public.contacts
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY leads_authenticated_all ON public.leads
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TABLE public.network_os_assurance_delivery_claims (
  delivery_id text PRIMARY KEY,
  received_at timestamptz,
  event_name text,
  repository_id text,
  installation_id text,
  pr_number text,
  head_sha text,
  forward_state text,
  forward_updated_at timestamptz,
  expires_at timestamptz
);

ALTER TABLE public.network_os_assurance_delivery_claims ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.network_os_assurance_delivery_claims FORCE ROW LEVEL SECURITY;

INSERT INTO public.network_os_assurance_delivery_claims (delivery_id, event_name)
VALUES ('local-smoke', 'preserve-me');

-- =============================================================================
-- TVG Email Pass 1 (pass1-v5) — STAGING APPLY PACK
-- STAGING ONLY / HOSTINGER OFF
--
-- Target project ref ONLY: glkrykpksbsqmmilmjhs
--   (Supabase name at audit time: "BHFOS n8n Assurance Preview" / TVG CRM Staging)
-- Production SoR wwyxohjnyqnegzbxtuxs: DO NOT RUN. Read-only. Never set the GUC there.
--
-- This file is NOT a supabase/migrations history entry. Do not copy it into
-- command-center/supabase/migrations or any tree that migrates production.
--
-- Operator latch (required in the same session, before this file):
--   SELECT set_config('tvg_email_pass1.target_project', 'glkrykpksbsqmmilmjhs', false);
-- Postgres cannot see the Supabase project ref. The latch is an operator
-- attestation. The real control is which database URL / MCP project_id you use.
--
-- Run as one transaction:
--   psql "$STAGING_URL" -v ON_ERROR_STOP=1 -1 -f 20260924_tvg_email_pass1_v5.sql
--
-- Preserves public.network_os_assurance_delivery_claims (no ALTER/DROP).
-- Does not create email_responses or email_send_queue.
-- Does not re-baseline CRM and does not copy production secrets.
-- DDL sections 1–12 below are the pass1-v5 design body.
-- =============================================================================

DO $$
BEGIN
  IF current_setting('tvg_email_pass1.target_project', true) IS DISTINCT FROM 'glkrykpksbsqmmilmjhs' THEN
    RAISE EXCEPTION
      'Refusing TVG Email Pass 1 apply. Set tvg_email_pass1.target_project to glkrykpksbsqmmilmjhs in this session, and only on staging. Never wwyxohjnyqnegzbxtuxs.';
  END IF;
END $$;

DO $$
DECLARE
  sig text;
  forced boolean;
  n int;
  contacts_ok boolean;
  leads_ok boolean;
BEGIN
  SELECT count(*) INTO n
  FROM pg_class c
  JOIN pg_namespace ns ON ns.oid = c.relnamespace
  WHERE ns.nspname = 'public'
    AND c.relname = 'network_os_assurance_delivery_claims'
    AND c.relkind = 'r';
  IF n <> 1 THEN
    RAISE EXCEPTION 'public.network_os_assurance_delivery_claims must already exist; this pack must not create or replace it';
  END IF;

  SELECT c.relforcerowsecurity,
         md5(string_agg(a.attname || ':' || t.typname, ',' ORDER BY a.attnum))
    INTO forced, sig
  FROM pg_class c
  JOIN pg_namespace ns ON ns.oid = c.relnamespace
  JOIN pg_attribute a ON a.attrelid = c.oid AND a.attnum > 0 AND NOT a.attisdropped
  JOIN pg_type t ON t.oid = a.atttypid
  WHERE ns.nspname = 'public'
    AND c.relname = 'network_os_assurance_delivery_claims'
  GROUP BY c.relforcerowsecurity;

  IF forced IS NOT TRUE THEN
    RAISE EXCEPTION 'network_os_assurance_delivery_claims must keep FORCE ROW LEVEL SECURITY';
  END IF;
  PERFORM set_config('tvg_email_pass1.claims_sig', sig, false);

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'contacts'
      AND column_name = 'id' AND udt_name = 'uuid'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'contacts' AND column_name = 'tenant_id'
  ) INTO contacts_ok;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'leads'
      AND column_name = 'id' AND udt_name = 'uuid'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'leads' AND column_name = 'tenant_id'
  ) INTO leads_ok;

  IF NOT contacts_ok OR NOT leads_ok THEN
    RAISE EXCEPTION 'CRM baseline public.contacts/public.leads (id uuid, tenant_id) is required. Do not re-baseline.';
  END IF;
END $$;

-- ENABLE RLS must not be the statement that first locks out the CRM app.
-- If RLS is already on, adding n8n SELECT policies is safe.
-- If RLS is off, refuse unless authenticated or service_role policies already exist.
DO $$
DECLARE
  rel record;
  pol_count int;
BEGIN
  FOR rel IN
    SELECT c.relname, c.relrowsecurity
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relname IN ('contacts', 'leads')
      AND c.relkind = 'r'
  LOOP
    IF NOT rel.relrowsecurity THEN
      SELECT count(*) INTO pol_count
      FROM pg_policies
      WHERE schemaname = 'public'
        AND tablename = rel.relname
        AND (
          roles && ARRAY['authenticated']::name[]
          OR roles && ARRAY['service_role']::name[]
        );
      IF pol_count = 0 THEN
        RAISE EXCEPTION
          'Refusing to ENABLE RLS on public.%: RLS is off and no authenticated/service_role policy exists',
          rel.relname;
      END IF;
    END IF;
  END LOOP;
END $$;

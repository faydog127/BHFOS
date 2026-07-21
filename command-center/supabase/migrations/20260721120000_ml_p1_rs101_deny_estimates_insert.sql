-- ML-P1 residual R-S1-01
-- Deny new public.estimates INSERT writes for application roles.
--
-- Authority: Founder authorization to implement additive R-S1-01 migration only.
-- Base: aaf8a766e1b5be758648dd6497922b0fc77399e9
--
-- Purpose (canonical money path only — not tenant isolation):
--   1) Prevent deprecated estimates create writes
--   2) Enforce canonical quotes path
--   3) Prevent an alternate money writer
--
-- Additive / non-destructive:
--   - No DROP TABLE / DROP COLUMN / DELETE / UPDATE of rows
--   - No FORCE ROW LEVEL SECURITY
--   - Does not alter SELECT / UPDATE / DELETE policies
--   - Does not touch quotes, Stripe, follow-up, Slice 2 app code, TIS, or G2.3
--
-- Mechanism:
--   RESTRICTIVE INSERT policies WITH CHECK (false) for authenticated and anon.
--   Restrictive policies are AND-combined with any permissive policies, so an
--   existing permissive INSERT/ALL policy cannot override this DENY.
--
-- Apply-to-production / deploy is NOT authorized by landing this file on main.

BEGIN;

ALTER TABLE public.estimates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ml_p1_rs101_deny_estimates_insert_authenticated"
  ON public.estimates;
DROP POLICY IF EXISTS "ml_p1_rs101_deny_estimates_insert_anon"
  ON public.estimates;

CREATE POLICY "ml_p1_rs101_deny_estimates_insert_authenticated"
  ON public.estimates
  AS RESTRICTIVE
  FOR INSERT
  TO authenticated
  WITH CHECK (false);

CREATE POLICY "ml_p1_rs101_deny_estimates_insert_anon"
  ON public.estimates
  AS RESTRICTIVE
  FOR INSERT
  TO anon
  WITH CHECK (false);

COMMIT;

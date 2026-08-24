-- NOS-CONVENTION-WRITE-PATH-FOUNDER-GATE-01 v2 Option A
-- Isolated HUGE 2026 convention QR provider-interest intake.
-- Not a lead, contact, or Service Partner. No tenant_id. No role seed.
-- Not Release 1 / Slice 1 activation.

BEGIN;

CREATE TABLE public.network_os_provider_interest_intake (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id text NOT NULL DEFAULT 'HUGE_2026'
    CHECK (campaign_id = 'HUGE_2026'),
  source text NOT NULL DEFAULT 'HUGE_2026'
    CHECK (source = 'HUGE_2026'),
  intake_channel text NOT NULL DEFAULT 'convention_qr'
    CHECK (intake_channel = 'convention_qr'),
  onboarding_status text NOT NULL DEFAULT 'provider_interest_received'
    CHECK (onboarding_status IN (
      'provider_interest_received',
      'reviewed',
      'contacted',
      'declined'
    )),
  display_name text NOT NULL
    CHECK (char_length(display_name) BETWEEN 1 AND 80),
  company_name text NOT NULL
    CHECK (char_length(company_name) BETWEEN 1 AND 120),
  email text NOT NULL
    CHECK (
      char_length(email) BETWEEN 1 AND 254
      AND email = lower(btrim(email))
    ),
  phone_digits text NOT NULL
    CHECK (phone_digits ~ '^[0-9]{10}$'),
  trades text[] NOT NULL
    CHECK (
      cardinality(trades) BETWEEN 1 AND 12
      AND (trades[1] IS NULL OR (btrim(trades[1]) <> '' AND char_length(trades[1]) <= 40))
      AND (trades[2] IS NULL OR (btrim(trades[2]) <> '' AND char_length(trades[2]) <= 40))
      AND (trades[3] IS NULL OR (btrim(trades[3]) <> '' AND char_length(trades[3]) <= 40))
      AND (trades[4] IS NULL OR (btrim(trades[4]) <> '' AND char_length(trades[4]) <= 40))
      AND (trades[5] IS NULL OR (btrim(trades[5]) <> '' AND char_length(trades[5]) <= 40))
      AND (trades[6] IS NULL OR (btrim(trades[6]) <> '' AND char_length(trades[6]) <= 40))
      AND (trades[7] IS NULL OR (btrim(trades[7]) <> '' AND char_length(trades[7]) <= 40))
      AND (trades[8] IS NULL OR (btrim(trades[8]) <> '' AND char_length(trades[8]) <= 40))
      AND (trades[9] IS NULL OR (btrim(trades[9]) <> '' AND char_length(trades[9]) <= 40))
      AND (trades[10] IS NULL OR (btrim(trades[10]) <> '' AND char_length(trades[10]) <= 40))
      AND (trades[11] IS NULL OR (btrim(trades[11]) <> '' AND char_length(trades[11]) <= 40))
      AND (trades[12] IS NULL OR (btrim(trades[12]) <> '' AND char_length(trades[12]) <= 40))
    ),
  service_area text NOT NULL
    CHECK (char_length(service_area) BETWEEN 1 AND 80),
  consent_contact boolean NOT NULL
    CHECK (consent_contact = true),
  consented_at timestamptz NOT NULL,
  submitted_at timestamptz NOT NULL,
  client_request_id text
    CHECK (
      client_request_id IS NULL
      OR char_length(client_request_id) <= 80
    ),
  is_test_data boolean NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX network_os_provider_interest_intake_email_huge_2026_uidx
  ON public.network_os_provider_interest_intake (email)
  WHERE campaign_id = 'HUGE_2026';

CREATE UNIQUE INDEX network_os_provider_interest_intake_phone_huge_2026_uidx
  ON public.network_os_provider_interest_intake (phone_digits)
  WHERE campaign_id = 'HUGE_2026';

CREATE UNIQUE INDEX network_os_provider_interest_intake_request_huge_2026_uidx
  ON public.network_os_provider_interest_intake (client_request_id)
  WHERE campaign_id = 'HUGE_2026'
    AND client_request_id IS NOT NULL
    AND length(btrim(client_request_id)) > 0;

ALTER TABLE public.network_os_provider_interest_intake ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.network_os_provider_interest_intake FORCE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.network_os_provider_interest_intake FROM PUBLIC;
REVOKE ALL ON TABLE public.network_os_provider_interest_intake FROM anon;
REVOKE ALL ON TABLE public.network_os_provider_interest_intake FROM authenticated;

GRANT SELECT (
  id,
  campaign_id,
  source,
  intake_channel,
  onboarding_status,
  display_name,
  company_name,
  email,
  phone_digits,
  trades,
  service_area,
  consent_contact,
  consented_at,
  submitted_at,
  client_request_id,
  is_test_data,
  created_at,
  updated_at
) ON TABLE public.network_os_provider_interest_intake TO authenticated;

GRANT UPDATE (onboarding_status, updated_at)
  ON TABLE public.network_os_provider_interest_intake TO authenticated;

GRANT SELECT, INSERT
  ON TABLE public.network_os_provider_interest_intake TO service_role;

CREATE FUNCTION public.network_os_actor_has_bhis_convention_intake()
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN false;
  END IF;

  RETURN EXISTS (
    SELECT 1
    FROM public.app_user_roles
    WHERE user_id = auth.uid()
      AND lower(btrim(role)) = 'bhis_convention_intake'
  );
END;
$$;

REVOKE ALL ON FUNCTION public.network_os_actor_has_bhis_convention_intake() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.network_os_actor_has_bhis_convention_intake() FROM anon;
GRANT EXECUTE ON FUNCTION public.network_os_actor_has_bhis_convention_intake() TO authenticated;
GRANT EXECUTE ON FUNCTION public.network_os_actor_has_bhis_convention_intake() TO service_role;

CREATE POLICY network_os_provider_interest_intake_anon_deny
  ON public.network_os_provider_interest_intake
  AS RESTRICTIVE
  FOR ALL
  TO anon
  USING (false)
  WITH CHECK (false);

CREATE POLICY network_os_provider_interest_intake_select
  ON public.network_os_provider_interest_intake
  AS PERMISSIVE
  FOR SELECT
  TO authenticated
  USING (public.network_os_actor_has_bhis_convention_intake());

CREATE POLICY network_os_provider_interest_intake_update
  ON public.network_os_provider_interest_intake
  AS PERMISSIVE
  FOR UPDATE
  TO authenticated
  USING (public.network_os_actor_has_bhis_convention_intake())
  WITH CHECK (public.network_os_actor_has_bhis_convention_intake());

COMMIT;

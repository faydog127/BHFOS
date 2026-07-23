-- ML-P1 Slice 6 — Payment & Invoicing settings + settlement helpers (SOURCE)
-- PD-S6-01..07. Do not rotate prod Stripe secrets / live-attach webhooks in this PR (A3).

-- Six flags (Payment & Invoicing group; auto-charge/auto-send default OFF)
INSERT INTO public.global_config (key, value) VALUES
  ('payment_invoicing.stripe_checkout_enabled', 'true'),
  ('payment_invoicing.offline_payments_enabled', 'true'),
  ('payment_invoicing.refunds_enabled', 'true'),
  ('payment_invoicing.recon_queue_enabled', 'true'),
  ('payment_invoicing.invoice_auto_send_enabled', 'false'),
  ('payment_invoicing.invoice_auto_charge_enabled', 'false')
ON CONFLICT (key) DO NOTHING;

CREATE OR REPLACE FUNCTION public.ml_p1_s6_payment_flag(p_key text)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_raw text;
  v_default boolean;
BEGIN
  v_default := CASE lower(coalesce(p_key, ''))
    WHEN 'stripe_checkout_enabled' THEN true
    WHEN 'offline_payments_enabled' THEN true
    WHEN 'refunds_enabled' THEN true
    WHEN 'recon_queue_enabled' THEN true
    WHEN 'invoice_auto_send_enabled' THEN false
    WHEN 'invoice_auto_charge_enabled' THEN false
    ELSE false
  END;

  SELECT value INTO v_raw
  FROM public.global_config
  WHERE key = 'payment_invoicing.' || p_key
  LIMIT 1;

  IF v_raw IS NULL THEN
    RETURN v_default;
  END IF;
  RETURN lower(btrim(v_raw)) IN ('true', '1', 'yes', 'on');
END;
$$;

CREATE OR REPLACE FUNCTION public.ml_p1_s6_payment_flags()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'stripe_checkout_enabled', public.ml_p1_s6_payment_flag('stripe_checkout_enabled'),
    'offline_payments_enabled', public.ml_p1_s6_payment_flag('offline_payments_enabled'),
    'refunds_enabled', public.ml_p1_s6_payment_flag('refunds_enabled'),
    'recon_queue_enabled', public.ml_p1_s6_payment_flag('recon_queue_enabled'),
    'invoice_auto_send_enabled', public.ml_p1_s6_payment_flag('invoice_auto_send_enabled'),
    'invoice_auto_charge_enabled', public.ml_p1_s6_payment_flag('invoice_auto_charge_enabled')
  );
$$;

CREATE OR REPLACE FUNCTION public.ml_p1_s6_assert_payment_flag(p_key text, p_code text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.ml_p1_s6_payment_flag(p_key) THEN
    RAISE EXCEPTION '%', coalesce(nullif(btrim(p_code), ''), 'ML_P1_S6_SETTING_OFF:' || p_key)
      USING ERRCODE = 'P0001';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.ml_p1_s6_assert_auto_charge_off()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- A2: auto-charge path not implemented; always deny even if flag flipped.
  RAISE EXCEPTION 'ML_P1_S6_AUTO_CHARGE_DENY: auto-charge not enabled for this slice'
    USING ERRCODE = 'P0001';
END;
$$;

CREATE OR REPLACE FUNCTION public.ml_p1_s6_set_payment_flags(p_flags jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role text := public.ml_p1_s2_current_actor_role();
  v_key text;
  v_val boolean;
  v_allowed text[] := ARRAY[
    'stripe_checkout_enabled',
    'offline_payments_enabled',
    'refunds_enabled',
    'recon_queue_enabled',
    'invoice_auto_send_enabled',
    'invoice_auto_charge_enabled'
  ];
BEGIN
  IF lower(coalesce(v_role, '')) NOT IN ('office', 'manager', 'admin', 'csr') THEN
    RAISE EXCEPTION 'ML_P1_S6_ROLE_DENY' USING ERRCODE = 'P0001';
  END IF;
  IF p_flags IS NULL OR jsonb_typeof(p_flags) <> 'object' THEN
    RAISE EXCEPTION 'ML_P1_S6_FLAGS_REQUIRED' USING ERRCODE = 'P0001';
  END IF;

  FOREACH v_key IN ARRAY v_allowed LOOP
    IF p_flags ? v_key THEN
      v_val := CASE
        WHEN jsonb_typeof(p_flags -> v_key) = 'boolean' THEN (p_flags ->> v_key)::boolean
        ELSE lower(coalesce(p_flags ->> v_key, '')) IN ('true', '1', 'yes', 'on')
      END;
      -- Major Decision gate: refuse persisting auto-charge ON in S6 A2
      IF v_key = 'invoice_auto_charge_enabled' AND v_val IS TRUE THEN
        RAISE EXCEPTION 'ML_P1_S6_AUTO_CHARGE_DENY: cannot enable auto-charge without Founder Major Decision'
          USING ERRCODE = 'P0001';
      END IF;
      INSERT INTO public.global_config (key, value, updated_at)
      VALUES ('payment_invoicing.' || v_key, CASE WHEN v_val THEN 'true' ELSE 'false' END, now())
      ON CONFLICT (key) DO UPDATE
        SET value = EXCLUDED.value, updated_at = now();
    END IF;
  END LOOP;

  RETURN public.ml_p1_s6_payment_flags();
END;
$$;

CREATE TABLE IF NOT EXISTS public.payment_recon_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id text,
  invoice_id uuid REFERENCES public.invoices(id) ON DELETE SET NULL,
  provider text NOT NULL DEFAULT 'stripe',
  provider_event_id text,
  provider_payment_id text,
  event_type text NOT NULL,
  reason text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'open',
  created_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,
  resolved_by uuid,
  CONSTRAINT payment_recon_queue_status_check CHECK (status IN ('open', 'resolved', 'ignored'))
);

CREATE UNIQUE INDEX IF NOT EXISTS payment_recon_queue_event_uq
  ON public.payment_recon_queue (provider, provider_event_id)
  WHERE provider_event_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS payment_recon_queue_open_idx
  ON public.payment_recon_queue (status, created_at DESC);

ALTER TABLE public.payment_recon_queue ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS payment_recon_queue_tenant_select ON public.payment_recon_queue;
CREATE POLICY payment_recon_queue_tenant_select
  ON public.payment_recon_queue FOR SELECT TO authenticated
  USING (
    tenant_id IS NOT DISTINCT FROM (auth.jwt() -> 'app_metadata' ->> 'tenant_id')
    OR lower(coalesce(public.ml_p1_s2_current_actor_role(), '')) = 'admin'
  );

DROP POLICY IF EXISTS payment_recon_queue_service_all ON public.payment_recon_queue;
CREATE POLICY payment_recon_queue_service_all
  ON public.payment_recon_queue FOR ALL TO service_role
  USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public.payment_execution_mutations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  client_mutation_id text NOT NULL,
  action text NOT NULL,
  actor_user_id uuid,
  actor_role text,
  result jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT payment_execution_mutations_uq UNIQUE (invoice_id, client_mutation_id)
);

ALTER TABLE public.payment_execution_mutations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS payment_execution_mutations_deny_client ON public.payment_execution_mutations;
CREATE POLICY payment_execution_mutations_deny_client
  ON public.payment_execution_mutations FOR ALL TO authenticated
  USING (false) WITH CHECK (false);
DROP POLICY IF EXISTS payment_execution_mutations_service ON public.payment_execution_mutations;
CREATE POLICY payment_execution_mutations_service
  ON public.payment_execution_mutations FOR ALL TO service_role
  USING (true) WITH CHECK (true);

CREATE OR REPLACE FUNCTION public.ml_p1_s6_enqueue_recon(
  p_event_type text,
  p_reason text,
  p_provider_event_id text DEFAULT NULL,
  p_provider_payment_id text DEFAULT NULL,
  p_invoice_id uuid DEFAULT NULL,
  p_tenant_id text DEFAULT NULL,
  p_payload jsonb DEFAULT '{}'::jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
BEGIN
  IF NOT public.ml_p1_s6_payment_flag('recon_queue_enabled') THEN
    RETURN NULL;
  END IF;

  BEGIN
    INSERT INTO public.payment_recon_queue (
      tenant_id, invoice_id, provider_event_id, provider_payment_id, event_type, reason, payload
    ) VALUES (
      p_tenant_id, p_invoice_id, p_provider_event_id, p_provider_payment_id,
      coalesce(p_event_type, 'unknown'), coalesce(p_reason, 'unspecified'), coalesce(p_payload, '{}'::jsonb)
    )
    RETURNING id INTO v_id;
  EXCEPTION
    WHEN unique_violation THEN
      SELECT id INTO v_id FROM public.payment_recon_queue
      WHERE provider = 'stripe' AND provider_event_id IS NOT DISTINCT FROM p_provider_event_id
      LIMIT 1;
  END;

  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.ml_p1_s6_record_offline_manual_payment(
  p_tenant_id text,
  p_invoice_id uuid,
  p_amount numeric,
  p_payment_method text,
  p_manual_reference_raw text,
  p_actor_user_id uuid,
  p_request_id text DEFAULT NULL
)
RETURNS TABLE (
  ok boolean,
  duplicate boolean,
  transaction_id uuid,
  payment_attempt_id uuid
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role text := public.ml_p1_s2_current_actor_role();
  v_jwt_tenant text := nullif(btrim(coalesce(auth.jwt() -> 'app_metadata' ->> 'tenant_id', '')), '');
  v_is_service boolean := coalesce(auth.role(), '') = 'service_role';
BEGIN
  PERFORM public.ml_p1_s6_assert_payment_flag('offline_payments_enabled', 'ML_P1_S6_OFFLINE_PAYMENTS_OFF');
  IF NOT v_is_service AND lower(coalesce(v_role, '')) NOT IN ('office', 'manager', 'admin', 'csr') THEN
    RAISE EXCEPTION 'ML_P1_S6_ROLE_DENY' USING ERRCODE = 'P0001';
  END IF;
  IF NOT v_is_service AND v_jwt_tenant IS NOT NULL AND p_tenant_id IS DISTINCT FROM v_jwt_tenant THEN
    RAISE EXCEPTION 'ML_P1_S6_TENANT_DENY' USING ERRCODE = 'P0001';
  END IF;
  RETURN QUERY
  SELECT * FROM public.record_offline_manual_payment(
    p_tenant_id, p_invoice_id, p_amount, p_payment_method,
    p_manual_reference_raw, p_actor_user_id, p_request_id
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.ml_p1_s6_record_refund(
  p_invoice_id uuid,
  p_amount numeric,
  p_reason text,
  p_client_mutation_id text,
  p_provider_refund_id text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role text := public.ml_p1_s2_current_actor_role();
  v_jwt_tenant text := nullif(btrim(coalesce(auth.jwt() -> 'app_metadata' ->> 'tenant_id', '')), '');
  v_is_service boolean := coalesce(auth.role(), '') = 'service_role';
  v_inv public.invoices%ROWTYPE;
  v_mut text := nullif(btrim(coalesce(p_client_mutation_id, '')), '');
  v_prior public.payment_execution_mutations%ROWTYPE;
  v_amount numeric;
  v_new_paid numeric;
  v_status text;
  v_result jsonb;
BEGIN
  PERFORM public.ml_p1_s6_assert_payment_flag('refunds_enabled', 'ML_P1_S6_REFUNDS_OFF');
  IF NOT v_is_service AND lower(coalesce(v_role, '')) NOT IN ('office', 'manager', 'admin', 'csr') THEN
    RAISE EXCEPTION 'ML_P1_S6_ROLE_DENY' USING ERRCODE = 'P0001';
  END IF;
  IF v_mut IS NULL THEN
    RAISE EXCEPTION 'ML_P1_S6_MUTATION_ID_REQUIRED' USING ERRCODE = 'P0001';
  END IF;
  IF p_amount IS NULL OR p_amount <= 0 OR p_amount <> round(p_amount, 2) THEN
    RAISE EXCEPTION 'ML_P1_S6_REFUND_AMOUNT_INVALID' USING ERRCODE = 'P0001';
  END IF;
  IF nullif(btrim(coalesce(p_reason, '')), '') IS NULL THEN
    RAISE EXCEPTION 'ML_P1_S6_REFUND_REASON_REQUIRED' USING ERRCODE = 'P0001';
  END IF;

  SELECT * INTO v_prior
  FROM public.payment_execution_mutations
  WHERE invoice_id = p_invoice_id AND client_mutation_id = v_mut;
  IF FOUND THEN
    RETURN v_prior.result;
  END IF;

  SELECT * INTO v_inv FROM public.invoices WHERE id = p_invoice_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'ML_P1_S6_INVOICE_NOT_FOUND' USING ERRCODE = 'P0001';
  END IF;
  IF NOT v_is_service AND v_jwt_tenant IS NOT NULL AND v_inv.tenant_id IS DISTINCT FROM v_jwt_tenant THEN
    RAISE EXCEPTION 'ML_P1_S6_TENANT_DENY' USING ERRCODE = 'P0001';
  END IF;
  IF coalesce(v_inv.amount_paid, 0) <= 0 THEN
    RAISE EXCEPTION 'ML_P1_S6_NOTHING_TO_REFUND' USING ERRCODE = 'P0001';
  END IF;

  v_amount := least(p_amount, coalesce(v_inv.amount_paid, 0));
  v_new_paid := public.ml_p1_s5_round_money(coalesce(v_inv.amount_paid, 0) - v_amount);
  -- Full refund returns invoice to Issued/sent so office may collect again intentionally (not a silent reopen bug).
  IF v_new_paid <= 0 THEN
    v_status := 'sent';
    v_new_paid := 0;
  ELSIF v_new_paid < coalesce(v_inv.total_amount, 0) THEN
    v_status := 'partially_paid';
  ELSE
    v_status := lower(coalesce(v_inv.status, 'paid'));
  END IF;

  UPDATE public.invoices SET
    amount_paid = v_new_paid,
    balance_due = public.ml_p1_s5_round_money(coalesce(total_amount, 0) - v_new_paid),
    status = v_status,
    paid_at = CASE WHEN v_new_paid <= 0 THEN NULL ELSE paid_at END,
    updated_at = now()
  WHERE id = p_invoice_id
  RETURNING * INTO v_inv;

  v_result := jsonb_build_object(
    'invoice_id', v_inv.id,
    'status', v_inv.status,
    'amount_refunded', v_amount,
    'amount_paid', v_inv.amount_paid,
    'balance_due', v_inv.balance_due,
    'display_status', CASE WHEN v_inv.status = 'sent' THEN 'Issued' ELSE v_inv.status END
  );

  INSERT INTO public.payment_execution_mutations (
    invoice_id, client_mutation_id, action, actor_user_id, actor_role, result
  ) VALUES (
    p_invoice_id, v_mut, 'refund', auth.uid(), v_role, v_result
  );

  PERFORM public.ml_p1_s6_enqueue_recon(
    'office_refund',
    p_reason,
    v_mut,
    p_provider_refund_id,
    p_invoice_id,
    v_inv.tenant_id,
    jsonb_build_object(
      'amount', v_amount,
      'client_mutation_id', v_mut,
      'actor_role', v_role,
      'provider_refund_id', p_provider_refund_id
    )
  );

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.ml_p1_s6_payment_flag(text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.ml_p1_s6_payment_flags() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.ml_p1_s6_set_payment_flags(jsonb) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.ml_p1_s6_assert_payment_flag(text, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.ml_p1_s6_enqueue_recon(text, text, text, text, uuid, text, jsonb) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.ml_p1_s6_record_offline_manual_payment(text, uuid, numeric, text, text, uuid, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.ml_p1_s6_record_refund(uuid, numeric, text, text, text) TO authenticated, service_role;

COMMENT ON FUNCTION public.ml_p1_s6_payment_flags() IS 'ML-P1 S6 Payment & Invoicing flags (runtime; no redeploy to flip)';
COMMENT ON TABLE public.payment_recon_queue IS 'ML-P1 S6 dispute/refund/recon quarantine queue';

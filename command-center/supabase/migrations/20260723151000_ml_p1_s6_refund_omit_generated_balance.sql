-- ML-P1 S6 hotfix: office refund must not write generated column balance_due.
-- Authority: Founder FIX-S6-SETTLEMENT: APPROVE + sk_test E2E after hot-fix (2026-07-23)
-- Root cause: ml_p1_s6_record_refund UPDATE set balance_due (generated) → fail.
-- Scope: replace refund RPC only; omit balance_due (computed from total_amount - amount_paid).

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

COMMENT ON FUNCTION public.ml_p1_s6_record_refund(uuid, numeric, text, text, text) IS
  'ML-P1 S6: office refund with mutation idempotency + recon enqueue; omits generated balance_due.';

-- ML-P1 Slice 5 — canonical invoice RPCs (create / draft update / issue / void / readiness)
-- Implements PD-S5-01..07. SOURCE ONLY — no prod apply in this PR.

CREATE OR REPLACE FUNCTION public.ml_p1_s5_role_can_invoice_create(p_role text)
RETURNS boolean
LANGUAGE sql IMMUTABLE AS $$
  SELECT lower(coalesce(p_role, '')) IN ('office', 'manager', 'admin', 'csr');
$$;

CREATE OR REPLACE FUNCTION public.ml_p1_s5_role_can_void(p_role text)
RETURNS boolean
LANGUAGE sql IMMUTABLE AS $$
  SELECT lower(coalesce(p_role, '')) IN ('office', 'manager', 'admin', 'csr');
$$;

CREATE OR REPLACE FUNCTION public.ml_p1_s5_role_can_write_off(p_role text)
RETURNS boolean
LANGUAGE sql IMMUTABLE AS $$
  SELECT lower(coalesce(p_role, '')) = 'admin';
$$;

CREATE OR REPLACE FUNCTION public.ml_p1_s5_round_money(p_amount numeric)
RETURNS numeric
LANGUAGE sql IMMUTABLE AS $$
  SELECT round(coalesce(p_amount, 0)::numeric, 2);
$$;

CREATE OR REPLACE FUNCTION public.ml_p1_s5_invoice_readiness(p_job_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_job public.jobs%ROWTYPE;
  v_ready jsonb;
  v_blockers jsonb := '[]'::jsonb;
  v_existing uuid;
  v_quote public.quotes%ROWTYPE;
  v_pending int;
BEGIN
  SELECT * INTO v_job FROM public.jobs WHERE id = p_job_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('job_id', p_job_id, 'eligible', false, 'blockers', jsonb_build_array(jsonb_build_object('code', 'ML_P1_S5_JOB_NOT_FOUND')));
  END IF;

  IF lower(coalesce(v_job.status, '')) <> 'completed' THEN
    v_blockers := v_blockers || jsonb_build_array(jsonb_build_object('code', 'ML_P1_S5_JOB_NOT_COMPLETED', 'detail', v_job.status));
  END IF;

  v_ready := public.ml_p1_s4_completion_readiness(p_job_id);
  IF coalesce((v_ready->>'ready')::boolean, false) IS NOT TRUE THEN
    v_blockers := v_blockers || jsonb_build_array(jsonb_build_object('code', 'ML_P1_S5_COMPLETION_NOT_READY', 'detail', v_ready->'blockers'));
  END IF;

  SELECT count(*)::int INTO v_pending
  FROM public.change_orders
  WHERE job_id = p_job_id AND status IN ('proposed', 'pending_approval');
  IF v_pending > 0 THEN
    v_blockers := v_blockers || jsonb_build_array(jsonb_build_object('code', 'ML_P1_S5_PENDING_CHANGE_ORDER', 'detail', v_pending));
  END IF;

  IF v_job.quote_id IS NULL THEN
    v_blockers := v_blockers || jsonb_build_array(jsonb_build_object('code', 'ML_P1_S5_QUOTE_REQUIRED'));
  ELSE
    SELECT * INTO v_quote FROM public.quotes WHERE id = v_job.quote_id;
    IF NOT FOUND OR lower(coalesce(v_quote.status, '')) NOT IN ('accepted', 'approved') THEN
      v_blockers := v_blockers || jsonb_build_array(jsonb_build_object('code', 'ML_P1_S5_QUOTE_REQUIRED', 'detail', coalesce(v_quote.status, 'missing')));
    END IF;
  END IF;

  SELECT id INTO v_existing
  FROM public.invoices
  WHERE job_id = p_job_id
    AND lower(coalesce(status, '')) IS DISTINCT FROM 'void'
  ORDER BY created_at DESC NULLS LAST
  LIMIT 1;
  IF v_existing IS NOT NULL THEN
    v_blockers := v_blockers || jsonb_build_array(jsonb_build_object('code', 'ML_P1_S5_INVOICE_EXISTS', 'invoice_id', v_existing));
  END IF;

  RETURN jsonb_build_object(
    'job_id', p_job_id,
    'eligible', jsonb_array_length(v_blockers) = 0,
    'blockers', v_blockers,
    'existing_invoice_id', v_existing,
    's4_readiness', v_ready
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.ml_p1_s5_invoice_create(
  p_job_id uuid,
  p_client_mutation_id text,
  p_system boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role text := public.ml_p1_s2_current_actor_role();
  v_mut text := nullif(btrim(coalesce(p_client_mutation_id, '')), '');
  v_prior public.invoice_execution_mutations%ROWTYPE;
  v_job public.jobs%ROWTYPE;
  v_quote public.quotes%ROWTYPE;
  v_ready jsonb;
  v_invoice_id uuid;
  v_subtotal numeric := 0;
  v_tax_rate numeric := 0;
  v_tax_amount numeric := 0;
  v_discount numeric := 0;
  v_total numeric := 0;
  v_co_ids uuid[] := '{}';
  v_snapshot jsonb := '{}'::jsonb;
  v_item record;
  v_sort int := 100;
  v_inv_number text;
  v_now timestamptz := now();
BEGIN
  IF v_mut IS NULL THEN
    RAISE EXCEPTION 'ML_P1_S5_MUTATION_ID_REQUIRED' USING ERRCODE = 'P0001';
  END IF;

  IF NOT coalesce(p_system, false) AND NOT public.ml_p1_s5_role_can_invoice_create(v_role) THEN
    RAISE EXCEPTION 'ML_P1_S5_ROLE_DENY' USING ERRCODE = 'P0001';
  END IF;

  IF coalesce(p_system, false) THEN
    v_role := coalesce(nullif(v_role, 'unauthenticated'), 'system');
  END IF;

  SELECT * INTO v_prior
  FROM public.invoice_execution_mutations
  WHERE job_id = p_job_id AND client_mutation_id = v_mut;
  IF FOUND THEN
    RETURN v_prior.result;
  END IF;

  SELECT * INTO v_job FROM public.jobs WHERE id = p_job_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'ML_P1_S5_JOB_NOT_FOUND' USING ERRCODE = 'P0001';
  END IF;
  IF lower(coalesce(v_job.status, '')) = 'cancelled' THEN
    RAISE EXCEPTION 'ML_P1_S5_CANCELLED_JOB' USING ERRCODE = 'P0001';
  END IF;
  IF lower(coalesce(v_job.status, '')) <> 'completed' THEN
    RAISE EXCEPTION 'ML_P1_S5_JOB_NOT_COMPLETED' USING ERRCODE = 'P0001';
  END IF;

  v_ready := public.ml_p1_s4_completion_readiness(p_job_id);
  IF coalesce((v_ready->>'ready')::boolean, false) IS NOT TRUE THEN
    RAISE EXCEPTION 'ML_P1_S5_COMPLETION_NOT_READY: %', v_ready->>'blockers' USING ERRCODE = 'P0001';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.change_orders
    WHERE job_id = p_job_id AND status IN ('proposed', 'pending_approval')
  ) THEN
    RAISE EXCEPTION 'ML_P1_S5_PENDING_CHANGE_ORDER' USING ERRCODE = 'P0001';
  END IF;

  IF v_job.quote_id IS NULL THEN
    RAISE EXCEPTION 'ML_P1_S5_QUOTE_REQUIRED' USING ERRCODE = 'P0001';
  END IF;
  SELECT * INTO v_quote FROM public.quotes WHERE id = v_job.quote_id;
  IF NOT FOUND OR lower(coalesce(v_quote.status, '')) NOT IN ('accepted', 'approved') THEN
    RAISE EXCEPTION 'ML_P1_S5_QUOTE_REQUIRED' USING ERRCODE = 'P0001';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.invoices
    WHERE job_id = p_job_id AND lower(coalesce(status, '')) IS DISTINCT FROM 'void'
  ) THEN
    RAISE EXCEPTION 'ML_P1_S5_INVOICE_EXISTS' USING ERRCODE = 'P0001';
  END IF;

  SELECT coalesce(array_agg(id ORDER BY created_at), '{}') INTO v_co_ids
  FROM public.change_orders
  WHERE job_id = p_job_id AND status = 'approved';

  -- Quote lines collected during insert below (stored prices only — never price_book)

  v_tax_rate := coalesce(v_quote.tax_rate, 0);
  v_inv_number := 'INV-' || to_char(v_now, 'YYMMDD') || '-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 6);

  -- Compute subtotal from quote + approved CO items
  SELECT coalesce(sum(public.ml_p1_s5_round_money(coalesce(qi.total_price, coalesce(qi.quantity, 1) * coalesce(qi.unit_price, 0)))), 0)
    INTO v_subtotal
  FROM public.quote_items qi
  WHERE qi.quote_id = v_quote.id;

  SELECT v_subtotal + coalesce(sum(public.ml_p1_s5_round_money((coalesce(ci.line_delta_cents, 0)::numeric / 100.0))), 0)
    INTO v_subtotal
  FROM public.change_order_items ci
  JOIN public.change_orders co ON co.id = ci.change_order_id
  WHERE co.job_id = p_job_id AND co.status = 'approved';

  v_discount := 0;
  IF coalesce(v_tax_rate, 0) > 0 THEN
    v_tax_amount := public.ml_p1_s5_round_money(GREATEST(v_subtotal - v_discount, 0) * v_tax_rate);
  ELSIF v_quote.tax_amount IS NOT NULL THEN
    v_tax_amount := public.ml_p1_s5_round_money(v_quote.tax_amount);
  ELSE
    v_tax_amount := 0;
  END IF;

  v_total := public.ml_p1_s5_round_money(v_subtotal - v_discount + v_tax_amount);
  v_snapshot := jsonb_build_object(
    'subtotal', v_subtotal,
    'discount_amount', v_discount,
    'tax_rate', v_tax_rate,
    'tax_amount', v_tax_amount,
    'total_amount', v_total,
    'quote_id', v_quote.id,
    'quote_version', coalesce(v_job.source_quote_version, v_quote.quote_version),
    'approved_change_order_ids', to_jsonb(v_co_ids),
    'pricebook_used', false
  );

  INSERT INTO public.invoices (
    tenant_id, lead_id, quote_id, job_id, invoice_number, status, invoice_type,
    subtotal, tax_rate, tax_amount, discount_amount, total_amount,
    amount_paid, balance_due, issue_date, notes,
    customer_email, customer_name, customer_phone,
    source_quote_version, approved_change_order_ids, calculation_snapshot,
    s5_created, created_at, updated_at
  ) VALUES (
    coalesce(v_job.tenant_id, 'default'),
    v_job.lead_id,
    v_quote.id,
    v_job.id,
    v_inv_number,
    'draft',
    'final',
    v_subtotal,
    v_tax_rate,
    v_tax_amount,
    v_discount,
    v_total,
    0,
    v_total,
    (v_now::date),
    'ML-P1 S5 draft from completed job (quote + approved change orders).',
    v_quote.customer_email,
    v_quote.customer_name,
    v_quote.customer_phone,
    coalesce(v_job.source_quote_version, v_quote.quote_version),
    v_co_ids,
    v_snapshot,
    true,
    v_now,
    v_now
  )
  RETURNING id INTO v_invoice_id;

  FOR v_item IN
    SELECT qi.id, qi.description, qi.quantity, qi.unit_price,
           public.ml_p1_s5_round_money(coalesce(qi.total_price, coalesce(qi.quantity, 1) * coalesce(qi.unit_price, 0))) AS total_price
    FROM public.quote_items qi
    WHERE qi.quote_id = v_quote.id
    ORDER BY qi.created_at NULLS LAST
  LOOP
    INSERT INTO public.invoice_items (
      invoice_id, description, quantity, unit_price, total_price, line_type, sort_order, source_kind, source_id
    ) VALUES (
      v_invoice_id,
      coalesce(v_item.description, 'Quote line'),
      coalesce(v_item.quantity, 1),
      coalesce(v_item.unit_price, 0),
      v_item.total_price,
      CASE WHEN v_item.total_price < 0 THEN 'discount' ELSE 'service' END,
      v_sort,
      'quote',
      v_item.id
    );
    v_sort := v_sort + 10;
  END LOOP;

  FOR v_item IN
    SELECT ci.id, ci.description, ci.quantity,
           public.ml_p1_s5_round_money(coalesce(ci.unit_price_cents, 0)::numeric / 100.0) AS unit_price,
           public.ml_p1_s5_round_money(coalesce(ci.line_delta_cents, 0)::numeric / 100.0) AS total_price,
           ci.is_credit
    FROM public.change_order_items ci
    JOIN public.change_orders co ON co.id = ci.change_order_id
    WHERE co.job_id = p_job_id AND co.status = 'approved'
    ORDER BY co.created_at NULLS LAST, ci.sort_order NULLS LAST
  LOOP
    INSERT INTO public.invoice_items (
      invoice_id, description, quantity, unit_price, total_price, line_type, sort_order, source_kind, source_id
    ) VALUES (
      v_invoice_id,
      coalesce(v_item.description, 'Change order line'),
      coalesce(v_item.quantity, 1),
      v_item.unit_price,
      v_item.total_price,
      CASE WHEN v_item.is_credit OR v_item.total_price < 0 THEN 'discount' ELSE 'service' END,
      v_sort,
      'change_order',
      v_item.id
    );
    v_sort := v_sort + 10;
  END LOOP;

  PERFORM public.ml_p1_s4_emit_job_event(
    coalesce(v_job.tenant_id, 'default'),
    v_job.id,
    'InvoiceCreated',
    v_role,
    jsonb_build_object(
      'slice', 'ml-p1-s5',
      'invoice_id', v_invoice_id,
      'invoice_number', v_inv_number,
      'total_amount', v_total,
      'system', coalesce(p_system, false),
      'client_mutation_id', v_mut,
      'calculation_snapshot', v_snapshot
    )
  );

  INSERT INTO public.invoice_execution_mutations (
    tenant_id, job_id, invoice_id, action, client_mutation_id, actor_user_id, actor_role, result
  ) VALUES (
    coalesce(v_job.tenant_id, 'default'),
    v_job.id,
    v_invoice_id,
    CASE WHEN coalesce(p_system, false) THEN 'auto_create' ELSE 'create' END,
    v_mut,
    auth.uid(),
    v_role,
    jsonb_build_object(
      'invoice_id', v_invoice_id,
      'invoice_created', true,
      'status', 'draft',
      'invoice_type', 'final',
      'total_amount', v_total,
      'display_status', 'Draft'
    )
  );

  RETURN jsonb_build_object(
    'invoice_id', v_invoice_id,
    'invoice_created', true,
    'status', 'draft',
    'display_status', 'Draft',
    'invoice_type', 'final',
    'total_amount', v_total,
    'job_id', v_job.id
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.ml_p1_s5_invoice_draft_update(
  p_invoice_id uuid,
  p_client_mutation_id text,
  p_tax_rate numeric DEFAULT NULL,
  p_tax_amount numeric DEFAULT NULL,
  p_discount_amount numeric DEFAULT NULL,
  p_notes text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role text := public.ml_p1_s2_current_actor_role();
  v_mut text := nullif(btrim(coalesce(p_client_mutation_id, '')), '');
  v_inv public.invoices%ROWTYPE;
  v_subtotal numeric;
  v_discount numeric;
  v_tax_rate numeric;
  v_tax_amount numeric;
  v_total numeric;
BEGIN
  IF v_mut IS NULL THEN
    RAISE EXCEPTION 'ML_P1_S5_MUTATION_ID_REQUIRED' USING ERRCODE = 'P0001';
  END IF;
  IF NOT public.ml_p1_s5_role_can_invoice_create(v_role) THEN
    RAISE EXCEPTION 'ML_P1_S5_ROLE_DENY' USING ERRCODE = 'P0001';
  END IF;

  SELECT * INTO v_inv FROM public.invoices WHERE id = p_invoice_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'ML_P1_S5_INVOICE_NOT_FOUND' USING ERRCODE = 'P0001';
  END IF;
  IF lower(coalesce(v_inv.status, '')) <> 'draft' THEN
    RAISE EXCEPTION 'ML_P1_S5_NOT_DRAFT' USING ERRCODE = 'P0001';
  END IF;

  v_subtotal := coalesce(v_inv.subtotal, 0);
  v_discount := coalesce(p_discount_amount, v_inv.discount_amount, 0);
  v_tax_rate := coalesce(p_tax_rate, v_inv.tax_rate, 0);
  IF p_tax_amount IS NOT NULL THEN
    v_tax_amount := public.ml_p1_s5_round_money(p_tax_amount);
  ELSE
    v_tax_amount := public.ml_p1_s5_round_money(GREATEST(v_subtotal - v_discount, 0) * v_tax_rate);
  END IF;
  v_total := public.ml_p1_s5_round_money(v_subtotal - v_discount + v_tax_amount);

  UPDATE public.invoices SET
    tax_rate = v_tax_rate,
    tax_amount = v_tax_amount,
    discount_amount = v_discount,
    total_amount = v_total,
    balance_due = public.ml_p1_s5_round_money(v_total - coalesce(amount_paid, 0)),
    notes = coalesce(p_notes, notes),
    calculation_snapshot = coalesce(calculation_snapshot, '{}'::jsonb) || jsonb_build_object(
      'tax_rate', v_tax_rate,
      'tax_amount', v_tax_amount,
      'discount_amount', v_discount,
      'total_amount', v_total,
      'draft_adjusted', true
    ),
    updated_at = now()
  WHERE id = p_invoice_id;

  RETURN jsonb_build_object(
    'invoice_id', p_invoice_id,
    'status', 'draft',
    'display_status', 'Draft',
    'tax_rate', v_tax_rate,
    'tax_amount', v_tax_amount,
    'discount_amount', v_discount,
    'total_amount', v_total
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.ml_p1_s5_invoice_issue(
  p_invoice_id uuid,
  p_client_mutation_id text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role text := public.ml_p1_s2_current_actor_role();
  v_mut text := nullif(btrim(coalesce(p_client_mutation_id, '')), '');
  v_inv public.invoices%ROWTYPE;
  v_prior public.invoice_execution_mutations%ROWTYPE;
  v_result jsonb;
  v_now timestamptz := now();
BEGIN
  IF v_mut IS NULL THEN
    RAISE EXCEPTION 'ML_P1_S5_MUTATION_ID_REQUIRED' USING ERRCODE = 'P0001';
  END IF;
  IF NOT public.ml_p1_s5_role_can_invoice_create(v_role) THEN
    RAISE EXCEPTION 'ML_P1_S5_ROLE_DENY' USING ERRCODE = 'P0001';
  END IF;

  SELECT * INTO v_inv FROM public.invoices WHERE id = p_invoice_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'ML_P1_S5_INVOICE_NOT_FOUND' USING ERRCODE = 'P0001';
  END IF;

  IF v_inv.job_id IS NOT NULL THEN
    SELECT * INTO v_prior
    FROM public.invoice_execution_mutations
    WHERE job_id = v_inv.job_id AND client_mutation_id = v_mut;
    IF FOUND THEN
      RETURN v_prior.result;
    END IF;
  END IF;

  IF lower(coalesce(v_inv.status, '')) = 'sent' THEN
    RETURN jsonb_build_object(
      'invoice_id', v_inv.id,
      'status', 'sent',
      'display_status', 'Issued',
      'already_issued', true,
      'sent_at', v_inv.sent_at,
      'public_token', v_inv.public_token,
      'total_amount', v_inv.total_amount
    );
  END IF;
  IF lower(coalesce(v_inv.status, '')) <> 'draft' THEN
    RAISE EXCEPTION 'ML_P1_S5_NOT_DRAFT' USING ERRCODE = 'P0001';
  END IF;

  UPDATE public.invoices SET
    status = 'sent',
    sent_at = coalesce(sent_at, v_now),
    public_token = coalesce(public_token, gen_random_uuid()),
    updated_at = v_now
  WHERE id = p_invoice_id
  RETURNING * INTO v_inv;

  IF v_inv.job_id IS NOT NULL THEN
    PERFORM public.ml_p1_s4_emit_job_event(
      coalesce(v_inv.tenant_id, 'default'),
      v_inv.job_id,
      'InvoiceIssued',
      v_role,
      jsonb_build_object(
        'slice', 'ml-p1-s5',
        'invoice_id', v_inv.id,
        'status', 'sent',
        'display_status', 'Issued',
        'total_amount', v_inv.total_amount,
        'client_mutation_id', v_mut
      )
    );
  END IF;

  v_result := jsonb_build_object(
    'invoice_id', v_inv.id,
    'status', 'sent',
    'display_status', 'Issued',
    'sent_at', v_inv.sent_at,
    'public_token', v_inv.public_token,
    'total_amount', v_inv.total_amount
  );

  IF v_inv.job_id IS NOT NULL THEN
    INSERT INTO public.invoice_execution_mutations (
      tenant_id, job_id, invoice_id, action, client_mutation_id, actor_user_id, actor_role, result
    ) VALUES (
      coalesce(v_inv.tenant_id, 'default'),
      v_inv.job_id,
      v_inv.id,
      'issue',
      v_mut,
      auth.uid(),
      v_role,
      v_result
    );
  END IF;

  RETURN v_result;
END;
$$;

CREATE OR REPLACE FUNCTION public.ml_p1_s5_invoice_void(
  p_invoice_id uuid,
  p_client_mutation_id text,
  p_reason text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role text := public.ml_p1_s2_current_actor_role();
  v_mut text := nullif(btrim(coalesce(p_client_mutation_id, '')), '');
  v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
  v_inv public.invoices%ROWTYPE;
  v_prior public.invoice_execution_mutations%ROWTYPE;
  v_result jsonb;
  v_now timestamptz := now();
BEGIN
  IF v_mut IS NULL THEN
    RAISE EXCEPTION 'ML_P1_S5_MUTATION_ID_REQUIRED' USING ERRCODE = 'P0001';
  END IF;
  IF v_reason IS NULL THEN
    RAISE EXCEPTION 'ML_P1_S5_VOID_REASON_REQUIRED' USING ERRCODE = 'P0001';
  END IF;
  IF NOT public.ml_p1_s5_role_can_void(v_role) THEN
    RAISE EXCEPTION 'ML_P1_S5_ROLE_DENY' USING ERRCODE = 'P0001';
  END IF;

  SELECT * INTO v_inv FROM public.invoices WHERE id = p_invoice_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'ML_P1_S5_INVOICE_NOT_FOUND' USING ERRCODE = 'P0001';
  END IF;

  IF v_inv.job_id IS NOT NULL THEN
    SELECT * INTO v_prior
    FROM public.invoice_execution_mutations
    WHERE job_id = v_inv.job_id AND client_mutation_id = v_mut;
    IF FOUND THEN
      RETURN v_prior.result;
    END IF;
  END IF;

  IF lower(coalesce(v_inv.status, '')) = 'void' THEN
    RETURN jsonb_build_object('invoice_id', v_inv.id, 'status', 'void', 'display_status', 'Void', 'already_void', true);
  END IF;
  IF lower(coalesce(v_inv.status, '')) = 'paid' OR coalesce(v_inv.amount_paid, 0) > 0 THEN
    RAISE EXCEPTION 'ML_P1_S5_VOID_NOT_ALLOWED_AFTER_PAYMENT' USING ERRCODE = 'P0001';
  END IF;
  IF lower(coalesce(v_inv.status, '')) NOT IN ('draft', 'sent') THEN
    RAISE EXCEPTION 'ML_P1_S5_VOID_STATUS_DENY' USING ERRCODE = 'P0001';
  END IF;

  UPDATE public.invoices SET
    status = 'void',
    void_reason = v_reason,
    voided_at = v_now,
    voided_by = auth.uid(),
    updated_at = v_now
  WHERE id = p_invoice_id
  RETURNING * INTO v_inv;

  IF v_inv.job_id IS NOT NULL THEN
    PERFORM public.ml_p1_s4_emit_job_event(
      coalesce(v_inv.tenant_id, 'default'),
      v_inv.job_id,
      'InvoiceVoided',
      v_role,
      jsonb_build_object(
        'slice', 'ml-p1-s5',
        'invoice_id', v_inv.id,
        'reason', v_reason,
        'client_mutation_id', v_mut
      )
    );
  END IF;

  v_result := jsonb_build_object(
    'invoice_id', v_inv.id,
    'status', 'void',
    'display_status', 'Void',
    'void_reason', v_reason,
    'voided_at', v_inv.voided_at
  );

  IF v_inv.job_id IS NOT NULL THEN
    INSERT INTO public.invoice_execution_mutations (
      tenant_id, job_id, invoice_id, action, client_mutation_id, actor_user_id, actor_role, result
    ) VALUES (
      coalesce(v_inv.tenant_id, 'default'),
      v_inv.job_id,
      v_inv.id,
      'void',
      v_mut,
      auth.uid(),
      v_role,
      v_result
    );
  END IF;

  RETURN v_result;
END;
$$;

-- Freeze issued financials (PD-S5-04 / PD-S5-06)
CREATE OR REPLACE FUNCTION public.ml_p1_s5_guard_invoice_financial_immutability()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'UPDATE'
     AND lower(coalesce(OLD.status, '')) = 'sent'
     AND lower(coalesce(NEW.status, '')) = 'sent'
  THEN
    IF NEW.subtotal IS DISTINCT FROM OLD.subtotal
       OR NEW.tax_rate IS DISTINCT FROM OLD.tax_rate
       OR NEW.tax_amount IS DISTINCT FROM OLD.tax_amount
       OR NEW.discount_amount IS DISTINCT FROM OLD.discount_amount
       OR NEW.total_amount IS DISTINCT FROM OLD.total_amount
    THEN
      RAISE EXCEPTION 'ML_P1_S5_ISSUED_IMMUTABLE: void and reissue required'
        USING ERRCODE = 'P0001';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_ml_p1_s5_invoice_immutable ON public.invoices;
CREATE TRIGGER trg_ml_p1_s5_invoice_immutable
  BEFORE UPDATE ON public.invoices
  FOR EACH ROW
  EXECUTE FUNCTION public.ml_p1_s5_guard_invoice_financial_immutability();

GRANT EXECUTE ON FUNCTION public.ml_p1_s5_invoice_readiness(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.ml_p1_s5_invoice_create(uuid, text, boolean) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.ml_p1_s5_invoice_draft_update(uuid, text, numeric, numeric, numeric, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.ml_p1_s5_invoice_issue(uuid, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.ml_p1_s5_invoice_void(uuid, text, text) TO authenticated, service_role;

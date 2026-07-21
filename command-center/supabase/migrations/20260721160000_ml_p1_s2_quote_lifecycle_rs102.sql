-- ML-P1 Slice 2 — R-S1-02 draft idempotency UNIQUE + lifecycle columns
-- + defer auto job creation on quote acceptance to Slice 3.
--
-- Authority: Founder Slice 2 coding auth at base caacdc071db3e3333b7109a526681d99f9bb8356
-- Additive only. Does NOT authorize production apply (separate A3).
-- Does NOT reopen R-S1-01. Does NOT implement Stripe / job / invoice product paths.
--
-- Replaces ensure_job_and_optional_draft_invoice_for_accepted_quote from
-- 20260416210000_backfill_job_service_address_on_quote_accept.sql with the same
-- body plus an auto_create_job_on_quote_acceptance gate (default false) that
-- defers BOTH accept→job and paid→job until Slice 3 explicitly enables the gate.
-- Also neutralizes on_quote_accepted_emit_wo so it cannot create jobs pre-S3.

BEGIN;

-- ---------------------------------------------------------------------------
-- R-S1-02: durable draft idempotency key (replaces soft notes marker for new work)
-- ---------------------------------------------------------------------------
ALTER TABLE public.quotes
  ADD COLUMN IF NOT EXISTS idempotency_key text;

ALTER TABLE public.quotes
  ADD COLUMN IF NOT EXISTS quote_version integer NOT NULL DEFAULT 1;

ALTER TABLE public.quotes
  ADD COLUMN IF NOT EXISTS supersedes_quote_id uuid REFERENCES public.quotes(id);

ALTER TABLE public.quotes
  ADD COLUMN IF NOT EXISTS issued_at timestamptz;

ALTER TABLE public.quotes
  ADD COLUMN IF NOT EXISTS expired_at timestamptz;

ALTER TABLE public.quotes
  ADD COLUMN IF NOT EXISTS approved_amount numeric;

ALTER TABLE public.quotes
  ADD COLUMN IF NOT EXISTS approval_method text;

ALTER TABLE public.quotes
  ADD COLUMN IF NOT EXISTS approved_by_actor_id text;

COMMENT ON COLUMN public.quotes.idempotency_key IS
  'ML-P1 S2 R-S1-02: client/request idempotency key for draft create; unique per tenant when set.';
COMMENT ON COLUMN public.quotes.quote_version IS
  'ML-P1 S2: monotonic version within a quote revision lineage.';
COMMENT ON COLUMN public.quotes.supersedes_quote_id IS
  'ML-P1 S2: prior quote id this revision supersedes (revise flow).';

CREATE UNIQUE INDEX IF NOT EXISTS quotes_tenant_idempotency_key_uq
  ON public.quotes (tenant_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL
    AND btrim(idempotency_key) <> '';

-- Expand active set to include Money-State `issued` (one open issued quote per lead).
DROP INDEX IF EXISTS public.quotes_tenant_lead_active_unique;
CREATE UNIQUE INDEX quotes_tenant_lead_active_unique
  ON public.quotes (tenant_id, lead_id)
  WHERE lead_id IS NOT NULL
    AND lower(coalesce(status, 'draft')) IN (
      'draft',
      'pending_review',
      'sent',
      'viewed',
      'issued'
    );

-- ---------------------------------------------------------------------------
-- Defer accept→job to Slice 3: gate auto job creation (default OFF).
-- ---------------------------------------------------------------------------
INSERT INTO public.global_config (key, value)
VALUES ('auto_create_job_on_quote_acceptance', 'false')
ON CONFLICT (key) DO UPDATE
SET value = EXCLUDED.value;

CREATE OR REPLACE FUNCTION public.ensure_job_and_optional_draft_invoice_for_accepted_quote()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_new_status text;
  v_old_status text;
  v_job_id uuid;
  v_auto text;
  v_auto_job text;
  v_should_invoice boolean := false;
  v_should_job boolean := false;
  v_now timestamptz := now();
  v_service_address text;
BEGIN
  v_new_status := public.normalize_quote_status(new.status);

  IF tg_op = 'INSERT' THEN
    v_old_status := '';
  ELSE
    v_old_status := public.normalize_quote_status(old.status);
  END IF;

  IF new.tenant_id IS NULL OR btrim(new.tenant_id) = '' THEN
    RETURN new;
  END IF;

  -- Resolve service address for job creation/backfill.
  v_service_address := nullif(btrim(coalesce(new.service_address, '')), '');
  IF v_service_address IS NULL AND new.lead_id IS NOT NULL THEN
    SELECT nullif(
      btrim(
        concat_ws(
          ', ',
          nullif(btrim(concat_ws(' ', nullif(p.address1, ''), nullif(p.address2, ''))), ''),
          nullif(btrim(p.city), ''),
          nullif(btrim(p.state), ''),
          nullif(btrim(p.zip), '')
        )
      ),
      ''
    )
    INTO v_service_address
    FROM public.leads l
    LEFT JOIN public.properties p ON p.id = l.property_id
    WHERE l.id = new.lead_id
    LIMIT 1;
  END IF;

  -- Quote accepted: optionally ensure exactly one job per quote (S2 default: defer).
  IF v_new_status = 'accepted' AND v_old_status <> 'accepted' THEN
    SELECT value INTO v_auto_job
    FROM public.global_config
    WHERE key = 'auto_create_job_on_quote_acceptance'
    LIMIT 1;

    v_should_job := lower(btrim(coalesce(v_auto_job, 'false'))) IN ('1','true','yes','on');

    IF NOT v_should_job THEN
      INSERT INTO public.events (tenant_id, entity_type, entity_id, event_type, actor_type, payload)
      VALUES (
        new.tenant_id,
        'quote',
        new.id,
        'QuoteAccepted_JobCreateDeferred',
        'system',
        jsonb_build_object(
          'reason', 'auto_create_job_on_quote_acceptance=false',
          'slice', 'ml-p1-s2'
        )
      );
      RETURN new;
    END IF;

    INSERT INTO public.jobs (
      tenant_id,
      lead_id,
      quote_id,
      quote_number,
      status,
      payment_status,
      total_amount,
      service_address,
      work_order_number
    ) VALUES (
      new.tenant_id,
      new.lead_id,
      new.id,
      new.quote_number,
      'unscheduled',
      'unpaid',
      coalesce(new.total_amount, 0),
      v_service_address,
      public.next_work_order_number(new.tenant_id, coalesce(new.created_at, v_now))
    )
    ON CONFLICT (quote_id) WHERE quote_id IS NOT NULL
    DO UPDATE SET
      updated_at = v_now,
      total_amount = coalesce(public.jobs.total_amount, excluded.total_amount),
      service_address = CASE
        WHEN public.jobs.service_address IS NULL OR btrim(public.jobs.service_address) = '' THEN excluded.service_address
        ELSE public.jobs.service_address
      END
    RETURNING id INTO v_job_id;

    INSERT INTO public.events (tenant_id, entity_type, entity_id, event_type, actor_type, payload)
    VALUES (
      new.tenant_id,
      'quote',
      new.id,
      'QuoteAccepted_JobEnsured',
      'system',
      jsonb_build_object('job_id', v_job_id)
    );

    SELECT value INTO v_auto
    FROM public.global_config
    WHERE key = 'auto_create_draft_invoice_on_acceptance'
    LIMIT 1;

    v_should_invoice := lower(btrim(coalesce(v_auto, 'false'))) IN ('1','true','yes','on');

    IF v_should_invoice THEN
      INSERT INTO public.invoices (
        tenant_id,
        lead_id,
        quote_id,
        job_id,
        estimate_id,
        status,
        invoice_type,
        release_approved,
        subtotal,
        tax_rate,
        tax_amount,
        total_amount,
        issue_date,
        due_date,
        customer_email,
        customer_name,
        customer_phone,
        notes
      ) VALUES (
        new.tenant_id,
        new.lead_id,
        new.id,
        v_job_id,
        new.estimate_id,
        'draft',
        'final',
        false,
        new.subtotal,
        new.tax_rate,
        new.tax_amount,
        coalesce(new.total_amount, 0),
        current_date,
        coalesce(new.valid_until, current_date + 14),
        new.customer_email,
        new.customer_name,
        new.customer_phone,
        CASE WHEN new.quote_number IS NOT NULL
          THEN 'Draft created on acceptance for Quote #' || new.quote_number
          ELSE 'Draft created on acceptance'
        END
      )
      ON CONFLICT (tenant_id, job_id, invoice_type)
        WHERE lower(coalesce(status, '')) = 'draft'
      DO NOTHING;

      INSERT INTO public.events (tenant_id, entity_type, entity_id, event_type, actor_type, payload)
      VALUES (
        new.tenant_id,
        'quote',
        new.id,
        'QuoteAccepted_DraftInvoiceEnsured',
        'system',
        jsonb_build_object('job_id', v_job_id)
      );
    END IF;

    RETURN new;
  END IF;

  -- Quote marked paid: job/invoice sync only when S3 gate explicitly ON.
  -- Pre-S3 (gate default false): defer — must not create jobs.
  IF lower(btrim(coalesce(new.status, ''))) = 'paid'
     AND lower(btrim(coalesce(old.status, ''))) <> 'paid' THEN

    SELECT value INTO v_auto_job
    FROM public.global_config
    WHERE key = 'auto_create_job_on_quote_acceptance'
    LIMIT 1;

    v_should_job := lower(btrim(coalesce(v_auto_job, 'false'))) IN ('1','true','yes','on');

    IF NOT v_should_job THEN
      INSERT INTO public.events (tenant_id, entity_type, entity_id, event_type, actor_type, payload)
      VALUES (
        new.tenant_id,
        'quote',
        new.id,
        'QuotePaid_JobCreateDeferred',
        'system',
        jsonb_build_object(
          'reason', 'auto_create_job_on_quote_acceptance=false',
          'slice', 'ml-p1-s2'
        )
      );
      RETURN new;
    END IF;

    INSERT INTO public.jobs (
      tenant_id,
      lead_id,
      quote_id,
      quote_number,
      status,
      payment_status,
      total_amount,
      service_address,
      work_order_number
    ) VALUES (
      new.tenant_id,
      new.lead_id,
      new.id,
      new.quote_number,
      'unscheduled',
      'paid',
      coalesce(new.total_amount, 0),
      v_service_address,
      public.next_work_order_number(new.tenant_id, coalesce(new.created_at, v_now))
    )
    ON CONFLICT (quote_id) WHERE quote_id IS NOT NULL
    DO UPDATE SET
      payment_status = 'paid',
      updated_at = v_now,
      service_address = CASE
        WHEN public.jobs.service_address IS NULL OR btrim(public.jobs.service_address) = '' THEN excluded.service_address
        ELSE public.jobs.service_address
      END
    RETURNING id INTO v_job_id;

    UPDATE public.jobs
    SET payment_status = 'paid',
        updated_at = v_now,
        service_address = CASE
          WHEN (service_address IS NULL OR btrim(service_address) = '') THEN v_service_address
          ELSE service_address
        END
    WHERE quote_id = new.id
      AND tenant_id IS NOT DISTINCT FROM new.tenant_id
      AND lower(coalesce(status, '')) <> 'cancelled';

    BEGIN
      UPDATE public.invoices
      SET status = 'sent',
          sent_at = coalesce(sent_at, v_now),
          release_approved = true,
          release_approved_at = coalesce(release_approved_at, v_now),
          updated_at = v_now
      WHERE quote_id = new.id
        AND tenant_id IS NOT DISTINCT FROM new.tenant_id
        AND lower(coalesce(status, 'draft')) = 'draft';
    EXCEPTION
      WHEN others THEN
        UPDATE public.invoices
        SET status = 'sent',
            sent_at = coalesce(sent_at, v_now),
            updated_at = v_now
        WHERE quote_id = new.id
          AND tenant_id IS NOT DISTINCT FROM new.tenant_id
          AND lower(coalesce(status, 'draft')) = 'draft';
    END;

    BEGIN
      UPDATE public.invoices
      SET status = 'paid',
          paid_at = coalesce(paid_at, v_now),
          amount_paid = CASE WHEN coalesce(total_amount, 0) > 0 THEN coalesce(total_amount, 0) ELSE coalesce(amount_paid, 0) END,
          balance_due = 0,
          payment_method = coalesce(payment_method, 'offline'),
          updated_at = v_now
      WHERE quote_id = new.id
        AND tenant_id IS NOT DISTINCT FROM new.tenant_id
        AND lower(coalesce(status, 'draft')) <> 'void';
    EXCEPTION
      WHEN others THEN
        UPDATE public.invoices
        SET status = 'paid',
            paid_at = coalesce(paid_at, v_now),
            amount_paid = CASE WHEN coalesce(total_amount, 0) > 0 THEN coalesce(total_amount, 0) ELSE coalesce(amount_paid, 0) END,
            payment_method = coalesce(payment_method, 'offline'),
            updated_at = v_now
        WHERE quote_id = new.id
          AND tenant_id IS NOT DISTINCT FROM new.tenant_id
          AND lower(coalesce(status, 'draft')) <> 'void';
    END;

    INSERT INTO public.events (tenant_id, entity_type, entity_id, event_type, actor_type, payload)
    VALUES (
      new.tenant_id,
      'quote',
      new.id,
      'QuotePaid_Synced',
      'system',
      jsonb_build_object('job_id', v_job_id)
    );

    RETURN new;
  END IF;

  RETURN new;
END;
$$;

-- ---------------------------------------------------------------------------
-- Legacy WO-on-accept trigger: neutralize job/WO creation before Slice 3.
-- Original body is not in-repo; fail-closed — emit deferred event only.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.trg_emit_wo_on_quote_accept()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_new text;
  v_old text;
  v_auto text;
BEGIN
  v_new := public.normalize_quote_status(new.status);
  IF tg_op = 'INSERT' THEN
    v_old := '';
  ELSE
    v_old := public.normalize_quote_status(old.status);
  END IF;

  IF v_new = 'accepted' AND v_old IS DISTINCT FROM 'accepted' THEN
    SELECT value INTO v_auto
    FROM public.global_config
    WHERE key = 'auto_create_job_on_quote_acceptance'
    LIMIT 1;

    -- Pre-S3: never create jobs/WOs from this path. Even if gate is later
    -- enabled, S3 must restore a known-good WO body — do not invent inserts.
    INSERT INTO public.events (tenant_id, entity_type, entity_id, event_type, actor_type, payload)
    VALUES (
      new.tenant_id,
      'quote',
      new.id,
      'QuoteAccepted_WorkOrderDeferred',
      'system',
      jsonb_build_object(
        'reason', 'ml-p1-s2-pre-s3-wo-neutralized',
        'gate', coalesce(v_auto, 'false'),
        'slice', 'ml-p1-s2'
      )
    );
  END IF;

  RETURN new;
END;
$$;

COMMIT;

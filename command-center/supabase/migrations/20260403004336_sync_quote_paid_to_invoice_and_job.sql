begin;

-- Extend acceptance invariant trigger function to also sync payments when a quote is marked as paid.
-- This supports the current field behavior where users mark "paid" on the Estimates (quotes) screen.

create or replace function public.ensure_job_and_optional_draft_invoice_for_accepted_quote()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_new_status text;
  v_old_status text;
  v_job_id uuid;
  v_auto text;
  v_should_invoice boolean := false;
  v_now timestamptz := now();
begin
  v_new_status := public.normalize_quote_status(new.status);

  if tg_op = 'INSERT' then
    v_old_status := '';
  else
    v_old_status := public.normalize_quote_status(old.status);
  end if;

  if new.tenant_id is null or btrim(new.tenant_id) = '' then
    -- We require tenant_id for job/invoice linkage.
    return new;
  end if;

  -- 1) Transition into accepted: ensure job always exists (and optionally a draft invoice).
  if v_new_status = 'accepted' and v_old_status <> 'accepted' then
    insert into public.jobs (
      tenant_id,
      lead_id,
      quote_id,
      estimate_id,
      quote_number,
      status,
      payment_status,
      total_amount,
      work_order_number
    ) values (
      new.tenant_id,
      new.lead_id,
      new.id,
      new.estimate_id,
      new.quote_number,
      'unscheduled',
      'unpaid',
      coalesce(new.total_amount, 0),
      public.next_work_order_number(new.tenant_id, coalesce(new.created_at, v_now))
    )
    on conflict (quote_id) where quote_id is not null
    do update set
      updated_at = v_now,
      total_amount = coalesce(public.jobs.total_amount, excluded.total_amount)
    returning id into v_job_id;

    insert into public.events (tenant_id, entity_type, entity_id, event_type, actor_type, payload)
    values (
      new.tenant_id,
      'quote',
      new.id,
      'QuoteAccepted_JobEnsured',
      'system',
      jsonb_build_object('job_id', v_job_id)
    );

    select value into v_auto
    from public.global_config
    where key = 'auto_create_draft_invoice_on_acceptance'
    limit 1;

    v_should_invoice := lower(btrim(coalesce(v_auto, 'false'))) in ('1','true','yes','on');

    if v_should_invoice then
      insert into public.invoices (
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
      ) values (
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
        case when new.quote_number is not null
          then 'Draft created on acceptance for Quote #' || new.quote_number
          else 'Draft created on acceptance'
        end
      )
      on conflict (tenant_id, job_id, invoice_type)
        where lower(coalesce(status, '')) = 'draft'
      do nothing;

      insert into public.events (tenant_id, entity_type, entity_id, event_type, actor_type, payload)
      values (
        new.tenant_id,
        'quote',
        new.id,
        'QuoteAccepted_DraftInvoiceEnsured',
        'system',
        jsonb_build_object('job_id', v_job_id)
      );
    end if;

    return new;
  end if;

  -- 2) Transition into paid: sync payment state to job + invoice so paid status is consistent.
  if lower(btrim(coalesce(new.status, ''))) = 'paid'
     and lower(btrim(coalesce(old.status, ''))) <> 'paid' then

    -- Ensure a job exists.
    insert into public.jobs (
      tenant_id,
      lead_id,
      quote_id,
      estimate_id,
      quote_number,
      status,
      payment_status,
      total_amount,
      work_order_number
    ) values (
      new.tenant_id,
      new.lead_id,
      new.id,
      new.estimate_id,
      new.quote_number,
      'unscheduled',
      'paid',
      coalesce(new.total_amount, 0),
      public.next_work_order_number(new.tenant_id, coalesce(new.created_at, v_now))
    )
    on conflict (quote_id) where quote_id is not null
    do update set
      payment_status = 'paid',
      updated_at = v_now
    returning id into v_job_id;

    update public.jobs
    set payment_status = 'paid',
        updated_at = v_now
    where quote_id = new.id
      and tenant_id is not distinct from new.tenant_id
      and lower(coalesce(status, '')) <> 'cancelled';

    -- Update invoices linked to this quote. balance_due may be generated in some envs, so try/fallback.
    begin
      update public.invoices
      set status = 'paid',
          paid_at = coalesce(paid_at, v_now),
          amount_paid = case
            when coalesce(amount_paid, 0) >= coalesce(total_amount, 0) - 0.009 then amount_paid
            else coalesce(total_amount, 0)
          end,
          balance_due = 0,
          payment_method = coalesce(payment_method, 'offline'),
          updated_at = v_now
      where quote_id = new.id
        and tenant_id is not distinct from new.tenant_id
        and lower(coalesce(status, 'draft')) <> 'void';
    exception
      when others then
        update public.invoices
        set status = 'paid',
            paid_at = coalesce(paid_at, v_now),
            amount_paid = case
              when coalesce(amount_paid, 0) >= coalesce(total_amount, 0) - 0.009 then amount_paid
              else coalesce(total_amount, 0)
            end,
            payment_method = coalesce(payment_method, 'offline'),
            updated_at = v_now
        where quote_id = new.id
          and tenant_id is not distinct from new.tenant_id
          and lower(coalesce(status, 'draft')) <> 'void';
    end;

    insert into public.events (tenant_id, entity_type, entity_id, event_type, actor_type, payload)
    values (
      new.tenant_id,
      'quote',
      new.id,
      'QuotePaid_Synced',
      'system',
      jsonb_build_object('job_id', v_job_id)
    );

    return new;
  end if;

  return new;
end;
$$;

commit;
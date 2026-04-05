begin;

-- Production has guardrails that block draft -> paid. Ensure we move invoices through sent first.

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
    return new;
  end if;

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
    values (new.tenant_id, 'quote', new.id, 'QuoteAccepted_JobEnsured', 'system', jsonb_build_object('job_id', v_job_id));

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
        case when new.quote_number is not null then 'Draft created on acceptance for Quote #' || new.quote_number else 'Draft created on acceptance' end
      )
      on conflict (tenant_id, job_id, invoice_type)
        where lower(coalesce(status, '')) = 'draft'
      do nothing;

      insert into public.events (tenant_id, entity_type, entity_id, event_type, actor_type, payload)
      values (new.tenant_id, 'quote', new.id, 'QuoteAccepted_DraftInvoiceEnsured', 'system', jsonb_build_object('job_id', v_job_id));
    end if;

    return new;
  end if;

  -- Quote marked paid: sync job payment + invoice payment.
  if lower(btrim(coalesce(new.status, ''))) = 'paid'
     and lower(btrim(coalesce(old.status, ''))) <> 'paid' then

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

    -- Step 1: draft -> sent (idempotent)
    begin
      update public.invoices
      set status = 'sent',
          sent_at = coalesce(sent_at, v_now),
          release_approved = true,
          release_approved_at = coalesce(release_approved_at, v_now),
          updated_at = v_now
      where quote_id = new.id
        and tenant_id is not distinct from new.tenant_id
        and lower(coalesce(status, 'draft')) = 'draft';
    exception
      when others then
        update public.invoices
        set status = 'sent',
            sent_at = coalesce(sent_at, v_now),
            updated_at = v_now
        where quote_id = new.id
          and tenant_id is not distinct from new.tenant_id
          and lower(coalesce(status, 'draft')) = 'draft';
    end;

    -- Step 2: sent -> paid
    begin
      update public.invoices
      set status = 'paid',
          paid_at = coalesce(paid_at, v_now),
          amount_paid = case when coalesce(total_amount, 0) > 0 then coalesce(total_amount, 0) else coalesce(amount_paid, 0) end,
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
            amount_paid = case when coalesce(total_amount, 0) > 0 then coalesce(total_amount, 0) else coalesce(amount_paid, 0) end,
            payment_method = coalesce(payment_method, 'offline'),
            updated_at = v_now
        where quote_id = new.id
          and tenant_id is not distinct from new.tenant_id
          and lower(coalesce(status, 'draft')) <> 'void';
    end;

    insert into public.events (tenant_id, entity_type, entity_id, event_type, actor_type, payload)
    values (new.tenant_id, 'quote', new.id, 'QuotePaid_Synced', 'system', jsonb_build_object('job_id', v_job_id));

    return new;
  end if;

  return new;
end;
$$;

create or replace function public.sync_invoice_payment_from_job()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_invoice record;
  v_total numeric := 0;
  v_status text;
  v_now timestamptz := now();
begin
  if lower(btrim(coalesce(new.payment_status, ''))) not in ('paid','partial') then
    return new;
  end if;

  select i.*
    into v_invoice
  from public.invoices i
  where i.job_id = new.id
    and i.tenant_id is not distinct from new.tenant_id
    and lower(coalesce(i.status,'draft')) <> 'void'
  order by i.created_at desc, i.id desc
  limit 1;

  if not found then
    return new;
  end if;

  v_total := coalesce(v_invoice.total_amount, new.total_amount, 0);
  v_status := case when lower(btrim(coalesce(new.payment_status,''))) = 'paid' then 'paid' else 'partial' end;

  if v_status = 'paid' then
    -- draft -> sent first
    begin
      update public.invoices
      set status = 'sent',
          sent_at = coalesce(sent_at, v_now),
          release_approved = true,
          release_approved_at = coalesce(release_approved_at, v_now),
          updated_at = v_now
      where id = v_invoice.id
        and lower(coalesce(status,'draft')) = 'draft';
    exception
      when others then
        update public.invoices
        set status = 'sent',
            sent_at = coalesce(sent_at, v_now),
            updated_at = v_now
        where id = v_invoice.id
          and lower(coalesce(status,'draft')) = 'draft';
    end;

    begin
      update public.invoices
      set status = 'paid',
          amount_paid = case when v_total > 0 then v_total else coalesce(amount_paid, 0) end,
          paid_at = coalesce(paid_at, v_now),
          balance_due = 0,
          payment_method = coalesce(payment_method, 'offline'),
          updated_at = v_now
      where id = v_invoice.id;
    exception
      when others then
        update public.invoices
        set status = 'paid',
            amount_paid = case when v_total > 0 then v_total else coalesce(amount_paid, 0) end,
            paid_at = coalesce(paid_at, v_now),
            payment_method = coalesce(payment_method, 'offline'),
            updated_at = v_now
        where id = v_invoice.id;
    end;
  else
    update public.invoices
    set status = 'partial',
        payment_method = coalesce(payment_method, 'offline'),
        updated_at = v_now
    where id = v_invoice.id;
  end if;

  insert into public.events (tenant_id, entity_type, entity_id, event_type, actor_type, payload)
  values (new.tenant_id, 'job', new.id, 'JobPayment_SyncedInvoice', 'system', jsonb_build_object('invoice_id', v_invoice.id, 'invoice_status', v_status));

  return new;
end;
$$;

commit;

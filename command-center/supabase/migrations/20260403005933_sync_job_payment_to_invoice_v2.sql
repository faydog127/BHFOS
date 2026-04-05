begin;

-- Production-safe: some environments do not have jobs.amount_paid.
-- Sync invoice payment status when the job/work order payment_status is updated.

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

  if lower(btrim(coalesce(new.payment_status, ''))) = 'paid' then
    v_status := 'paid';
  else
    v_status := 'partial';
  end if;

  if v_status = 'paid' then
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
  values (
    new.tenant_id,
    'job',
    new.id,
    'JobPayment_SyncedInvoice',
    'system',
    jsonb_build_object('invoice_id', v_invoice.id, 'invoice_status', v_status)
  );

  return new;
end;
$$;

drop trigger if exists trg_jobs_sync_invoice_payment on public.jobs;
create trigger trg_jobs_sync_invoice_payment
after insert or update of payment_status on public.jobs
for each row
execute function public.sync_invoice_payment_from_job();

commit;

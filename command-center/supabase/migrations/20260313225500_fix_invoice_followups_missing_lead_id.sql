create or replace function public.trg_money_loop_invoice_followups()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  new_status text;
  old_status text;
  v_lead_id uuid;
begin
  new_status := lower(coalesce(new.status, ''));
  old_status := lower(coalesce(old.status, ''));
  v_lead_id := nullif(to_jsonb(new)->>'lead_id', '')::uuid;

  if v_lead_id is null and new.job_id is not null then
    select j.lead_id
      into v_lead_id
    from public.jobs j
    where j.id = new.job_id
      and (new.tenant_id is null or j.tenant_id is not distinct from new.tenant_id)
    limit 1;
  end if;

  if tg_op = 'INSERT' then
    if new_status in ('sent', 'partial', 'overdue') then
      perform public.ensure_follow_up_task(
        new.tenant_id,
        'invoice',
        new.id,
        v_lead_id,
        'Invoice Unpaid – Follow Up',
        null,
        'high',
        null,
        jsonb_build_object('invoice_number', new.invoice_number, 'due_date', new.due_date)
      );
    end if;
    return new;
  end if;

  if tg_op = 'UPDATE' then
    if new_status in ('sent', 'partial', 'overdue')
      and old_status not in ('sent', 'partial', 'overdue') then
      perform public.ensure_follow_up_task(
        new.tenant_id,
        'invoice',
        new.id,
        v_lead_id,
        'Invoice Unpaid – Follow Up',
        null,
        'high',
        null,
        jsonb_build_object('invoice_number', new.invoice_number, 'due_date', new.due_date)
      );
    end if;
    return new;
  end if;

  return new;
end;
$$;

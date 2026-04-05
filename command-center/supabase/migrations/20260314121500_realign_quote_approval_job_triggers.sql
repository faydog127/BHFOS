begin;

create or replace function public.handle_quote_acceptance()
returns trigger
language plpgsql
security definer
as $$
begin
  if old.status != 'accepted' and new.status = 'accepted' then
    if not exists (select 1 from public.jobs where quote_id = new.id) then
      insert into public.jobs (lead_id, quote_id, estimate_id, total_amount, status, payment_status)
      values (new.lead_id, new.id, new.estimate_id, new.total_amount, 'unscheduled', 'unpaid');
    end if;
  end if;
  return new;
end;
$$;

create or replace function public.handle_quote_approval_v2()
returns trigger
language plpgsql
security definer
as $$
begin
  if old.status != 'approved' and new.status = 'approved' then
    if not exists (select 1 from public.jobs where quote_id = new.id) then
      insert into public.jobs (lead_id, quote_id, estimate_id, total_amount, status, payment_status)
      values (new.lead_id, new.id, new.estimate_id, new.total_amount, 'unscheduled', 'unpaid');
    else
      update public.jobs
      set payment_status = case
            when lower(btrim(coalesce(payment_status, ''))) in ('', 'pending', 'open') then 'unpaid'
            else payment_status
          end,
          updated_at = now()
      where quote_id = new.id;
    end if;
  end if;
  return new;
end;
$$;

commit;

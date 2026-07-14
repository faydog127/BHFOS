begin;

create or replace function public.populate_inspection_quote_context()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_inspection public.inspections;
  v_email text;
begin
  if new.inspection_id is null then return new; end if;
  select * into v_inspection from public.inspections
  where id = new.inspection_id and tenant_id = new.tenant_id;
  if not found then raise exception 'inspection_not_found'; end if;
  if v_inspection.lead_id is not null then
    select email into v_email from public.leads where id = v_inspection.lead_id and tenant_id = new.tenant_id;
  end if;
  new.lead_id := coalesce(new.lead_id, v_inspection.lead_id);
  new.service_address := coalesce(new.service_address, v_inspection.service_address);
  new.customer_email := coalesce(new.customer_email, v_email);
  return new;
end;
$$;

drop trigger if exists trg_populate_inspection_quote_context on public.quotes;
create trigger trg_populate_inspection_quote_context
before insert or update of inspection_id on public.quotes
for each row execute function public.populate_inspection_quote_context();

commit;

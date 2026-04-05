alter table public.leads
  add column if not exists preferred_document_delivery text,
  add column if not exists sms_consent boolean default false,
  add column if not exists sms_opt_out boolean default false;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'leads_preferred_document_delivery_check'
  ) then
    alter table public.leads
      add constraint leads_preferred_document_delivery_check
      check (
        preferred_document_delivery is null
        or preferred_document_delivery in ('auto', 'email', 'sms')
      );
  end if;
end
$$;

-- Enforce address capture at quote stage to support travel-zone pricing and dispatch.
alter table if exists public.quotes
  add column if not exists service_address text;

comment on column public.quotes.service_address is
  'Service address captured at quote stage. Used for travel-zone costing and downstream work-order scheduling.';

-- Best-effort backfill for existing quotes from lead.property address.
update public.quotes q
set service_address = nullif(
  trim(
    concat_ws(
      ', ',
      nullif(trim(p.address1), ''),
      nullif(trim(p.address2), ''),
      nullif(trim(p.city), ''),
      nullif(trim(p.state), ''),
      nullif(trim(p.zip), '')
    )
  ),
  ''
)
from public.leads l
join public.properties p on p.id = l.property_id
where q.lead_id = l.id
  and (q.service_address is null or btrim(q.service_address) = '');

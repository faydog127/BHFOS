begin;

-- Backfill existing jobs that predate the quote→job address propagation fix.
-- Only fills when an address can be resolved; otherwise leaves null.

with resolved as (
  select
    j.id as job_id,
    coalesce(
      nullif(btrim(q.service_address), ''),
      nullif(
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
    ) as service_address
  from public.jobs j
  left join public.quotes q on q.id = j.quote_id
  left join public.leads l on l.id = j.lead_id
  left join public.properties p on p.id = l.property_id
  where j.service_address is null or btrim(j.service_address) = ''
)
update public.jobs j
set service_address = r.service_address,
    updated_at = now()
from resolved r
where r.job_id = j.id
  and r.service_address is not null;

commit;


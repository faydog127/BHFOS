begin;

-- Backfill existing jobs that predate the quote→job address propagation fix.
-- Only fills when an address can be resolved; otherwise leaves null.

with resolved as (
  select
    j.id as job_id,
    nullif(btrim(q.service_address), '') as service_address
  from public.jobs j
  left join public.quotes q on q.id = j.quote_id
  where j.service_address is null or btrim(j.service_address) = ''
)
update public.jobs j
set service_address = r.service_address,
    updated_at = now()
from resolved r
where r.job_id = j.id
  and r.service_address is not null;

commit;

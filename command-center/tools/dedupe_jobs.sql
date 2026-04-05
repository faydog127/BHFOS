begin;

with ranked as (
  select
    j.*,
    row_number() over (
      partition by j.tenant_id, j.quote_id
      order by
        case when j.status = 'complete' then 1 else 0 end desc,
        j.created_at desc,
        j.id desc
    ) as rn
  from public.jobs j
  where j.quote_id is not null
),
losers as (
  select id as lose_id
  from ranked
  where rn > 1
)
delete from public.jobs
where id in (select lose_id from losers);

commit;

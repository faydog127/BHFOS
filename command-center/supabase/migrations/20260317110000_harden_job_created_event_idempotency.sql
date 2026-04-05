-- Appendix A / A-EXEC-5 hardening:
-- clean up historical duplicates and make JobCreated singleton per job.

with ranked_job_created as (
  select
    id,
    row_number() over (
      partition by entity_type, entity_id, event_type
      order by created_at asc, id asc
    ) as rn
  from public.events
  where entity_type = 'job'
    and event_type = 'JobCreated'
)
delete from public.events e
using ranked_job_created ranked
where e.id = ranked.id
  and ranked.rn > 1;

create unique index if not exists events_job_created_singleton_uq
  on public.events (entity_type, entity_id, event_type)
  where entity_type = 'job'
    and event_type = 'JobCreated';

-- Ops Visibility: ensure PostgREST picks up newly created tables/columns.
-- This prevents UI errors like:
--   "Could not find the table 'public.event_jobs' in the schema cache"
select pg_notify('pgrst', 'reload schema');

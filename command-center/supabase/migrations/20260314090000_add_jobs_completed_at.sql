-- Ensure jobs.completed_at exists before operational projection views reference it.
-- This is additive and safe to run against environments that already have the column.

alter table public.jobs
  add column if not exists completed_at timestamptz;


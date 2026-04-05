alter table public.tis_assessments
add column if not exists pricing_v1 jsonb not null default '{"schema_version":"pricing_v1"}'::jsonb;

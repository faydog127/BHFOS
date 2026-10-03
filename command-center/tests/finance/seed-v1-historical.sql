-- Local browser proof only. Inserts one superseded schema version 1 plan and one
-- actual that names it. Not a migration. Not for a remote database.
-- The insert trigger forces draft status, so this fixture sets the role that
-- skips triggers and then writes a superseded historical row directly.

begin;

set local session_replication_role = replica;

insert into public.finance_plans (
  id, tenant_id, status, version, schema_version, inputs, notes, approved_at, approved_by
)
values (
  'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1',
  'tvg',
  'superseded',
  1,
  1,
  jsonb_build_object(
    'structural', jsonb_build_object(
      'weeks_per_year', null,
      'months_per_year', null,
      'days_per_month_ar', null,
      'rounding_increment_usd', null
    ),
    'stages', jsonb_build_object(
      'stage_0', jsonb_build_object('label', 'Stage 0'),
      'stage_1', jsonb_build_object('label', 'Stage 1'),
      'stage_2', jsonb_build_object('label', 'Stage 2'),
      'stage_3', jsonb_build_object('label', 'Stage 3')
    ),
    'staffing', '[]'::jsonb,
    'owner_field_replacement', jsonb_build_object('wage', null, 'burden', null),
    'cost_pools', '{}'::jsonb,
    'channels', '[]'::jsonb,
    'services', '{}'::jsonb
  ),
  'historical-v1-browser',
  timestamptz '2025-11-01',
  'cccccccc-cccc-4ccc-8ccc-ccccccccccc1'
);

insert into public.finance_monthly_actuals (
  tenant_id, comparison_plan_id, month, schema_version, source, total_revenue
)
values (
  'tvg',
  'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1',
  date '2025-11-01',
  1,
  'manual_entry',
  8.00
);

commit;

-- Test fixture only. Included inside a rolled-back local SQL test.
-- Not a migration and not applied on its own.

create function pg_temp.finance_v2_document(p_basis jsonb)
returns jsonb
language sql
as $$
  select jsonb_build_object(
    'kept', true,
    'structural', jsonb_build_object(
      'weeks_per_year', null,
      'months_per_year', null,
      'days_per_month_ar', null,
      'rounding_increment_usd', null
    ),
    'stages', jsonb_build_object(
      'stage_0', jsonb_build_object('label', 'Stage 0', 'true_operating_profit_pct', 0, 'growth_reserve_pct', 0, 'bad_debt_warranty_pct', 0, 'unidentified_cost_contingency_pct', 0),
      'stage_1', jsonb_build_object('label', 'Stage 1', 'true_operating_profit_pct', 0, 'growth_reserve_pct', 0, 'bad_debt_warranty_pct', 0, 'unidentified_cost_contingency_pct', 0),
      'stage_2', jsonb_build_object('label', 'Stage 2', 'true_operating_profit_pct', 0, 'growth_reserve_pct', 0, 'bad_debt_warranty_pct', 0, 'unidentified_cost_contingency_pct', 0),
      'stage_3', jsonb_build_object('label', 'Stage 3', 'true_operating_profit_pct', 0, 'growth_reserve_pct', 0, 'bad_debt_warranty_pct', 0, 'unidentified_cost_contingency_pct', 0)
    ),
    'staffing', '[]'::jsonb,
    'owner_field_replacement', jsonb_build_object('wage', null, 'burden', null),
    'cost_pools', '{}'::jsonb,
    'channels', '[]'::jsonb,
    'services', '{}'::jsonb,
    'monthly_basis', coalesce(p_basis, '{}'::jsonb)
  );
$$;

create function pg_temp.finance_v1_document()
returns jsonb
language sql
as $$
  select pg_temp.finance_v2_document('{}'::jsonb) - 'monthly_basis';
$$;

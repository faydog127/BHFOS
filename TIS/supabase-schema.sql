-- TIS core tables for Supabase (run in Supabase SQL editor)
-- Creates dedicated TIS tables to avoid conflicts with existing schema.

create table if not exists tis_properties (
  id text primary key,
  property_name text not null,
  management_group text,
  zone text,
  coverage_type text,
  in_ao boolean,
  street_address text,
  city text,
  state text,
  zip text,
  class_guess text,
  exterior_condition text,
  maintenance_signals text,
  overall_feel text,
  property_class text,
  units_est integer,
  source_url text,
  seed_notes text,
  lead_status text,
  lead_contacted_at timestamptz,
  created_at timestamptz,
  updated_at timestamptz
);

create index if not exists idx_tis_properties_zone on tis_properties(zone);

create table if not exists tis_assessments (
  id text primary key,
  property_id text references tis_properties(id) on delete cascade,
  scout_mode text,
  scout_type text,
  gut_feel_score integer,
  on_site_office_visible boolean,
  leasing_activity_visible boolean,
  maintenance_presence_visible boolean,
  management_quality_signal text,
  exterior_condition text,
  access_ease text,
  building_height text,
  termination_type text,
  access_constraints text,
  access_difficulty text,
  service_fit text,
  entry_path text,
  partner_potential text,
  follow_up_priority text,
  problem_score integer,
  -- commercial/sales-path score; not physical service access
  access_score integer,
  leverage_score integer,
  momentum_score integer,
  total_score integer,
  hazard_severity integer,
  hazard_prevalence integer,
  hazard_maintenance_gap integer,
  hazard_engagement_path integer,
  hazard_total integer,
  hazard_primary_angle text,
  confidence_level text,
  hook text,
  decision_maker_known boolean,
  decision_maker_contacted boolean,
  contact_name text,
  contact_role text,
  contact_phone text,
  contact_email text,
  contact_notes text,
  disqualified boolean,
  disqualifier_reasons text,
  next_action_owner text,
  next_action_type text,
  next_action_due text,
  next_action_notes text,
  opportunity_notes text,
  risk_or_barrier_notes text,
  general_notes text,
  pricing_v1 jsonb not null default '{"schema_version":"pricing_v1"}'::jsonb,
  created_at timestamptz,
  updated_at timestamptz
);

create index if not exists idx_tis_assessments_property on tis_assessments(property_id);

create table if not exists tis_photos (
  id text primary key,
  assessment_id text references tis_assessments(id) on delete cascade,
  timestamp timestamptz,
  tag text,
  note text,
  original_filename text,
  stored_filename text,
  storage_uri text,
  created_at timestamptz
);

create index if not exists idx_tis_photos_assessment on tis_photos(assessment_id);

-- Allow anon access for now (Phase 1)
alter table tis_properties disable row level security;
alter table tis_assessments disable row level security;
alter table tis_photos disable row level security;

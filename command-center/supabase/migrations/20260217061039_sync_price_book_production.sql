-- Sync price_book data from production Supabase
-- This migration imports all price items needed for quote/estimate generation

CREATE TABLE IF NOT EXISTS public.price_book (
  id uuid PRIMARY KEY,
  tenant_id text NOT NULL,
  code text NOT NULL,
  name text NOT NULL,
  category text,
  base_price numeric(10, 2) NOT NULL,
  price_type text,
  description text,
  active boolean DEFAULT true,
  created_at timestamp with time zone,
  
  CONSTRAINT unique_code_per_tenant UNIQUE (tenant_id, code)
);

-- Insert all price_book items from production
INSERT INTO public.price_book (id, tenant_id, code, name, category, base_price, price_type, description, active, created_at)
VALUES
  ('4de6464d-ca6c-46b5-a5ae-a33d7e84d5d0', 'default', 'ODOR-NEUTRAL', 'Odor Neutralization Treatment', 'odor', 299, 'fixed', 'Professional odor neutralization to reduce persistent odors (pets, smoke, mildew smell).', true, '2026-01-01T14:19:30.115774+00:00'),
  ('51adb9c7-952e-4b4a-8f58-ff8ad0add712', 'default', 'EXT-GUARD-STD', 'Bird/Rodent Intrusion Guard', 'dryer_vent', 89, 'fixed', 'Prevents birds/rodents from entering and nesting; reduces callbacks.', true, '2025-12-30T22:09:32.532328+00:00'),
  ('0758b135-edfd-4bf1-847b-72f1ca33dea9', 'default', 'DV-TRANS-HD', 'Metal Transition Upgrade (Code-Compliant)', 'dryer_vent', 89, 'fixed', 'Replace unsafe transition with rigid/semi-rigid metal connection.', true, '2025-12-30T22:09:32.532328+00:00'),
  ('fee4b006-f109-45e9-97af-cf06fbc271c2', 'default', 'DUCT-FOG', 'Botanical Fogging (Per System)', 'air_duct', 149, 'per_system', '', true, '2026-01-04T05:25:40.488263+00:00'),
  ('64b101f9-65f6-488c-927f-130bcbf98014', 'default', 'DV-STD', 'Dryer Vent Safety Clean', 'dryer_vent', 199, 'fixed', 'Includes inspection, standard access, airflow verification, and before/after documentation.', true, '2025-12-07T00:00:35.319923+00:00'),
  ('1d31f939-62a6-4249-b6c1-08401800817c', 'default', 'ROOF-CAP', 'High-Flow Roof Cap Upgrade', 'dryer_vent', 225, 'fixed', 'Upgrade restrictive roof caps to improve airflow and reduce re-clogging.', true, '2025-12-30T22:09:32.532328+00:00'),
  ('476bdb68-ecd3-4b13-aaa4-53db53f5def3', 'default', 'DV-LINT-TRAP', 'Lint Trap Housing Detail', 'dryer_vent', 59, 'fixed', 'Detail clean lint trap housing area without full cabinet teardown.', true, '2025-12-30T22:09:32.532328+00:00'),
  ('5a0da1f7-7682-4db1-aff3-159c26f6a231', 'default', 'BATH-FAN', 'Bathroom Fan Detail (Each)', 'dryer_vent', 89, 'per_unit', 'Clean bath fan grille and housing; improves airflow; quick high-margin add-on.', true, '2025-12-30T22:09:32.532328+00:00'),
  ('68417dca-cb10-4b93-9812-6b9e899e64a1', 'default', 'DV-CABINET', 'Dryer Cabinet Deep Clean (Opened)', 'dryer_vent', 149, 'fixed', 'Open dryer cabinet; remove internal lint near motor/heater. High-skill service.', true, '2025-12-30T22:09:32.532328+00:00'),
  ('15481ee8-de86-461f-aac9-3644c14a0768', 'default', 'EXT-HOOD-FIX', 'Vent Hood Repair (Flap/Hinge)', 'dryer_vent', 79, 'fixed', 'Repair exterior hood function without full replacement when feasible.', true, '2025-12-30T22:09:32.532328+00:00'),
  ('15b0a88f-c1de-450e-96c8-781b8f625433', 'default', 'DV-SEAL', 'Compliance Seal & Fasten (Foil Tape + Screws)', 'dryer_vent', 29, 'fixed', 'Ensures joints are code-appropriate sealed and mechanically secured.', true, '2025-12-30T22:09:32.532328+00:00'),
  ('1a358fa5-7831-428c-94c0-6accadb5d08c', 'default', 'DV-CONN-MAG', 'MagVent Magnetic Connection', 'dryer_vent', 185, 'fixed', 'Magnetic dryer connection for tight spaces; improves airflow and prevents future crush.', true, '2025-12-30T22:09:32.532328+00:00'),
  ('1b4b48f1-2522-4807-b082-5c15ec842ece', 'default', 'DV-CLAMP', 'Steel Tension Clamps (Set)', 'dryer_vent', 15, 'fixed', 'Proper mechanical fastening; replaces tape and weak fasteners.', true, '2025-12-30T22:09:32.532328+00:00'),
  ('0aa84b65-d013-4b00-8fc3-ddf85a8680df', 'default', 'PKG-REALTOR-REFRESH', 'Package: Realtor Refresh', 'package', 599, 'fixed', 'Realtor-focused refresh package. Includes odor neutralization as part of the package price.', true, '2026-01-01T14:23:47.126617+00:00'),
  ('1c02acd9-e3ee-4588-be51-5b99669c099c', 'default', 'DV-ROOF', 'Modifier: Roof Access', 'admin', 99, 'fixed', 'Deprecated. Roof access is included in DV-STD unless specialty roof conditions apply.', true, '2025-12-07T00:00:35.319923+00:00'),
  ('4ffb57cf-7f09-4079-a1c6-edeeb56b2035', 'default', 'PKG-REST', 'Package: Total Restoration', 'package', 526, 'reference', 'DV-STD + DV-TRANS-HD + EXT-GUARD-STD + DV-CABINET.', true, '2025-12-30T22:09:32.532328+00:00'),
  ('49bb5c96-2bcb-4e1f-9853-8627a71f293b', 'default', 'DUCT-SYS1', 'Air Duct Cleaning – System 1', 'air_duct', 699, 'per_system', 'Whole-system duct cleaning for first system.', true, '2025-12-07T00:00:35.319923+00:00'),
  ('05e82b21-d554-4438-89f0-f0a2d4865bd9', 'default', 'HDW-PCO-010', 'Whole-Home PCO System (Installed)', 'iaq', 1499, 'fixed', 'Installed PCO purification system.', true, '2025-12-07T00:00:35.319923+00:00'),
  ('1818f973-caee-432b-ac65-988c89a4b360', 'default', 'HDW-ALARM', 'LintAlert System (Installed)', 'iaq', 199, 'fixed', 'Pressure sensor alert that signals restricted dryer airflow.', true, '2025-12-30T22:09:32.532328+00:00'),
  ('37d5f729-9361-4428-9f06-b935f76c7f43', 'default', 'HDW-FIL-ES', 'Electrostatic Filter (Installed)', 'iaq', 299, 'fixed', 'Installed electrostatic filtration upgrade.', true, '2025-12-07T00:00:35.319923+00:00'),
  ('3c8b381f-927c-4caa-8014-b54b5db9649d', 'default', 'HDW-UV-010', 'UV-C Light System (Installed)', 'iaq', 899, 'fixed', 'Installed UV-C light system.', true, '2025-12-07T00:00:35.319923+00:00'),
  ('48f081c0-76c2-4797-984b-75b35563775f', 'default', 'BLOWER-RESTORE', 'Blower Motor Restoration (Per System)', 'hvac_restoration', 499, 'per_system', 'Restoration/cleaning of blower motor assembly.', true, '2025-12-07T00:00:35.319923+00:00'),
  ('61f8a3af-4191-4980-bea2-8ef541a0ec28', 'default', 'DUCT-BLOW', 'Blower Wheel Cleaning (Per System)', 'hvac_restoration', 249, 'per_system', 'Mechanical cleaning of blower wheel.', true, '2025-12-07T00:00:35.319923+00:00'),
  ('6304bfd2-1bb3-462a-8808-03631ca16c27', 'default', 'ACC-TIGHT', 'Tight Space Modifier', 'modifiers', 99, 'fixed', 'Applies when access is unusually restrictive.', true, '2025-12-07T00:27:16.187956+00:00'),
  ('6b62f516-7416-43ff-874d-8dbc06cd7357', 'default', 'ACC-ATTIC', 'Attic Access', 'modifiers', 79, 'fixed', 'Additional time/risk for attic entry.', true, '2025-12-07T00:27:16.187956+00:00'),
  ('6e5caedf-0bae-4106-ae53-9ceea78aaf55', 'default', 'DUCT-VENT', 'Additional Supply Vent (Each)', 'air_duct', 25, 'per_unit', 'Per vent add-on.', true, '2025-12-07T00:00:35.319923+00:00'),
  ('86447b0f-17dd-4801-b5f8-822fd96dadbf', 'default', 'CHECKUP-1YR', 'Annual Dryer Vent Safety Check', 'membership', 149, 'per_year', 'Annual safety inspection and cleaning as needed.', true, '2025-12-07T00:17:30.886104+00:00'),
  ('8e2f6abe-a0c3-4b59-b69c-b24a30fe102f', 'default', 'ACC-CRAWL', 'Crawlspace Access', 'modifiers', 99, 'fixed', 'Additional time/risk for crawlspace entry.', true, '2025-12-07T00:27:16.187956+00:00'),
  ('93a79266-7843-4b9e-9708-0d02060c76c3', 'default', 'DV-ADD-DRYER', 'Second Dryer Vent (Same Visit)', 'dryer_vent', 149, 'fixed', 'Discounted second vent when already onsite.', true, '2025-12-30T22:09:32.532328+00:00'),
  ('a3cda53e-5665-4a70-b2b4-0201181809f4', 'default', 'MIN-VISIT', 'Minimum Visit Charge', 'admin', 199, 'fixed', 'Minimum charge to roll a truck and perform a safety assessment.', true, '2025-12-07T00:27:16.187956+00:00'),
  ('a48174f3-aa76-4ee0-8adf-534e39f78cf6', 'default', 'COIL-CLEAN', 'Evaporator Coil Cleaning (Per System)', 'hvac_restoration', 399, 'per_system', 'Evaporator coil cleaning service.', true, '2025-12-07T00:00:35.319923+00:00'),
  ('a6f599d8-e592-4c56-b1d9-9755fcd07342', 'default', 'CONDO-SYS1', 'Condo/Townhome Air Duct Cleaning – System 1', 'air_duct', 549, 'per_system', 'Whole-system duct cleaning for smaller footprints.', true, '2025-12-07T00:00:35.319923+00:00'),
  ('ccc9b0d9-88c0-4ee2-ac0d-32df79333538', 'default', 'DUCT-SYS2', 'Additional HVAC System (Same Visit) (Alt Code)', 'air_duct', 399, 'per_system', 'Alias of additional system; consider deprecating later.', true, '2025-12-07T00:27:16.187956+00:00'),
  ('d13d68c1-4cbe-4d14-9b3d-77f13da1f8a0', 'default', 'DV-XTRA', 'Long Run / Complex Vent (25ft+)', 'modifiers', 75, 'fixed', 'Complex/long runs require more time and tooling.', true, '2025-12-07T00:27:16.187956+00:00'),
  ('e2749307-576d-42ee-80c2-9679cbcfbfa5', 'default', 'EXT-HOOD-NO', 'Pest-Resistant Vent Hood Replacement', 'dryer_vent', 149, 'fixed', 'Replace failing exterior hood with pest-resistant sealing hood.', true, '2025-12-30T22:09:32.532328+00:00'),
  ('e5f2af19-10ed-4d99-a4b7-4f56c89a680e', 'default', 'SANITIZER-BASIC', 'Antimicrobial Sanitizer (Per System)', 'sanitization', 149, 'per_system', 'Sanitization add-on (as appropriate).', true, '2025-12-07T00:00:35.319923+00:00'),
  ('f16756ca-7b44-4c0f-8d4b-1bfe9f39a0ba', 'default', 'DUCT-RET', 'Additional Return (Each)', 'air_duct', 45, 'per_unit', 'Per return add-on.', true, '2025-12-07T00:00:35.319923+00:00'),
  ('c11d617c-b4d6-441e-b55d-9b7d885c3025', 'default', 'TRIP-ZONE-2', 'Trip Charge (Zone 2)', 'trip', 59, 'flat', 'Service area 20-40 miles', true, '2025-12-07T00:27:16.187956+00:00'),
  ('6a71e262-22e0-4969-936a-2f0c8521886f', 'default', 'PKG-MIN', 'Package: Minimum (Safety Clean)', 'package', 199, 'reference', 'DV-STD only.', true, '2025-12-30T22:09:32.532328+00:00'),
  ('7547ce3c-d5d3-41c4-bdc7-658f8139cb0b', 'default', 'PKG-COMP', 'Package: Compliance (Most Popular)', 'package', 377, 'reference', 'DV-STD + DV-TRANS-HD + EXT-GUARD-STD.', true, '2025-12-30T22:09:32.532328+00:00'),
  ('bf107284-04c5-4d1b-a348-1a94802879ba', 'default', 'ACC-ROOF', 'Specialty Roof Access', 'modifiers', 150, 'fixed', 'Added only for specialty roof conditions beyond standard access.', true, '2025-12-07T00:27:16.187956+00:00'),
  ('7073b1bb-9210-4549-8cd9-4cd7dc6f775f', 'default', 'DUCT-SYS-ADD', 'Additional HVAC System (Same Visit)', 'air_duct', 449, 'per_system', 'Add-on system cleaning when already onsite.', true, '2025-12-07T00:00:35.319923+00:00'),
  ('09758c68-c973-490f-b8a6-4a90057754dc', 'default', 'BUNDLE-DISCOUNT-50', 'Whole Home Bundle Discount', 'discount', -50, 'fixed', 'Discount for booking duct cleaning and dryer vent cleaning together.', true, '2026-01-04T04:26:56.957757+00:00')
ON CONFLICT (id) DO NOTHING;

-- Create index for common queries if not exists
CREATE INDEX IF NOT EXISTS idx_price_book_tenant_active 
  ON public.price_book(tenant_id, active);
CREATE INDEX IF NOT EXISTS idx_price_book_name 
  ON public.price_book(name);

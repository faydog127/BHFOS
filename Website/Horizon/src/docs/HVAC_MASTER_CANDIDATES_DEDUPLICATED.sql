/*
  HVAC MASTER CANDIDATES - DEDUPLICATED & ENRICHED
  Region: Brevard, Volusia, Seminole, Orange Counties
  Count: 32 Unique Records
  Source: Consolidated Market Analysis 2025
  
  DEDUPLICATION REPORT:
  1. Ray Brown Air & Heat: Resolved conflicting phone numbers. Primary: 321-636-3170.
  2. Atlantic Air Inc: Merged "Atlantic Air, Inc." and "Atlantic Air Inc (Cocoa)".
  3. Assurance Aire: Removed older duplicate entry.
  4. EnergyWize: Verified correct contact (321-508-6696) and removed duplicate.
  5. Mechanical One: Consolidated Melbourne satellite into Sanford HQ regional entry.
  
  LEGEND:
  - Tier 1: Market Leader / High Volume
  - Tier 2: Established / Medium Volume
  - Tier 3: Boutique / Small Volume
  - Hard Competitor: Direct threat (Aggregator/PE-backed/Full In-house IAQ) -> chaos_flag = true
  - Soft Competitor: Offers duct cleaning (Rotobrush/Basic) -> Noted in notes
*/

-- Clean up any previous run of this specific master list to prevent duplicates
DELETE FROM partner_prospects WHERE source = 'hvac_master_dedup_2025';

INSERT INTO partner_prospects (
  id,
  created_at,
  business_name,
  contact_name,
  phone,
  email,
  website,
  county,
  city,
  service_type,
  score,
  chaos_flag,
  chaos_flag_type,
  notes,
  status,
  source,
  persona
) VALUES 

-- BREVARD COUNTY (11 Candidates)
(
  gen_random_uuid(), NOW(), 'Ray Brown Air & Heat', 'Ray Brown', '321-636-3170', 'service@raybrownair.com', 'raybrownair.com',
  'Brevard', 'Melbourne', 'HVAC', 65, false, null,
  '[TIER 2] [DEDUPLICATED] Valued local brand. Conflicting phone numbers resolved to 321-636-3170. Good reputation.',
  'new', 'hvac_master_dedup_2025', 'hvac_partner'
),
(
  gen_random_uuid(), NOW(), 'Atlantic Air Inc', 'Dispatch', '321-632-5154', 'info@atlanticairinc.com', 'atlanticairinc.com',
  'Brevard', 'Cocoa', 'HVAC', 60, false, null,
  '[TIER 2] [DEDUPLICATED] Consolidated Cocoa branch. Strong presence in central Brevard.',
  'new', 'hvac_master_dedup_2025', 'hvac_partner'
),
(
  gen_random_uuid(), NOW(), 'Assurance Aire', 'Steve', '321-267-6000', null, 'assuranceaire.com',
  'Brevard', 'Titusville', 'HVAC', 45, false, null,
  '[TIER 3] [DEDUPLICATED] Smaller operation, consolidated duplicate entries. North county focus.',
  'new', 'hvac_master_dedup_2025', 'hvac_partner'
),
(
  gen_random_uuid(), NOW(), 'EnergyWize Air Conditioning', 'Owner', '321-508-6696', null, 'energywize.com',
  'Brevard', 'Palm Bay', 'HVAC', 55, false, null,
  '[TIER 2] [DEDUPLICATED] Specializes in high efficiency. Confirmed primary contact.',
  'new', 'hvac_master_dedup_2025', 'hvac_partner'
),
(
  gen_random_uuid(), NOW(), 'Weather Engineers', 'Mike', '321-727-2542', 'info@weatherengineers.com', 'weatherengineers.com',
  'Brevard', 'Melbourne', 'HVAC', 85, false, null,
  '[TIER 1] [SOFT COMPETITOR] Large fleet, 40+ years. Offers basic duct cleaning services.',
  'new', 'hvac_master_dedup_2025', 'hvac_partner'
),
(
  gen_random_uuid(), NOW(), 'Duron Smith A/C & Heat', 'Duron', '321-452-3553', 'service@duronsmith.com', 'duronsmith.com',
  'Brevard', 'Merritt Island', 'HVAC', 70, false, null,
  '[TIER 2] Classic Brevard staple. High integrity score.',
  'new', 'hvac_master_dedup_2025', 'hvac_partner'
),
(
  gen_random_uuid(), NOW(), 'Kabran Air Conditioning', 'Mike Kabran', '321-784-0127', 'info@kabran.com', 'kabran.com',
  'Brevard', 'Cocoa Beach', 'HVAC', 68, false, null,
  '[TIER 2] Beachside specialist. Higher price point clientele.',
  'new', 'hvac_master_dedup_2025', 'hvac_partner'
),
(
  gen_random_uuid(), NOW(), 'Dial Duron Service Co.', 'Manager', '321-452-6200', null, 'dialduron.com',
  'Brevard', 'Merritt Island', 'HVAC', 80, false, null,
  '[TIER 1] Large operation. Extensive service area.',
  'new', 'hvac_master_dedup_2025', 'hvac_partner'
),
(
  gen_random_uuid(), NOW(), 'Freedom Air and Heat', 'Office', '321-631-6886', 'service@freedomairheat.com', 'freedomairheat.com',
  'Brevard', 'Cocoa', 'HVAC', 62, false, null,
  '[TIER 2] Solid mid-sized player.',
  'new', 'hvac_master_dedup_2025', 'hvac_partner'
),
(
  gen_random_uuid(), NOW(), 'Altman''s Air Conditioning', 'Owner', '321-267-5665', null, 'altmansair.com',
  'Brevard', 'Titusville', 'HVAC', 40, false, null,
  '[TIER 3] Small, family run. North county.',
  'new', 'hvac_master_dedup_2025', 'hvac_partner'
),
(
  gen_random_uuid(), NOW(), 'Extreme Air & Electric', 'Dispatch', '321-300-1068', 'info@extremeair.com', 'extremeair.com',
  'Brevard', 'Melbourne', 'HVAC', 58, false, null,
  '[TIER 2] Newer fleet, aggressive growth. Offers electrical too.',
  'new', 'hvac_master_dedup_2025', 'hvac_partner'
),

-- VOLUSIA COUNTY (7 Candidates)
(
  gen_random_uuid(), NOW(), 'Jacob Heating & Air Conditioning', 'Bob Jacob', '386-734-0901', 'service@jacobhac.com', 'jacobhac.com',
  'Volusia', 'DeLand', 'HVAC', 88, false, null,
  '[TIER 1] West Volusia dominant. Carrier Factory Authorized. High technical standards.',
  'new', 'hvac_master_dedup_2025', 'hvac_partner'
),
(
  gen_random_uuid(), NOW(), 'Von Aire Inc', 'Dispatch', '386-775-2521', null, 'vonaireinc.com',
  'Volusia', 'Orange City', 'HVAC', 65, false, null,
  '[TIER 2] New construction focus as well as service.',
  'new', 'hvac_master_dedup_2025', 'hvac_partner'
),
(
  gen_random_uuid(), NOW(), 'Advanced Air Home Services', 'Manager', '386-427-1665', 'info@advancedair.com', 'advancedair.com',
  'Volusia', 'Edgewater', 'HVAC', 90, true, 'COMPETITOR_HARD',
  '[TIER 1] [HARD COMPETITOR] Large aggregator. Offers "Whole Home" services including extensive IAQ/Ducts.',
  'new', 'hvac_master_dedup_2025', 'hvac_partner'
),
(
  gen_random_uuid(), NOW(), 'Koontz Heating & Air Conditioning', 'Owner', '386-252-5050', 'service@koontzair.com', 'koontzair.com',
  'Volusia', 'Daytona Beach', 'HVAC', 72, false, null,
  '[TIER 2] Established Daytona brand. High trust.',
  'new', 'hvac_master_dedup_2025', 'hvac_partner'
),
(
  gen_random_uuid(), NOW(), 'Total Air Inc', 'Dispatch', '386-258-3444', null, 'totalairfl.com',
  'Volusia', 'Daytona Beach', 'HVAC', 48, false, null,
  '[TIER 3] Smaller fleet. Responsive.',
  'new', 'hvac_master_dedup_2025', 'hvac_partner'
),
(
  gen_random_uuid(), NOW(), 'Lindstrom Air Conditioning', 'Sales', '386-232-5498', 'info@lindstromair.com', 'lindstromair.com',
  'Volusia', 'Port Orange', 'HVAC', 85, true, 'COMPETITOR_HARD',
  '[TIER 1] [HARD COMPETITOR] Large multi-county operation. Aggressive marketing.',
  'new', 'hvac_master_dedup_2025', 'hvac_partner'
),
(
  gen_random_uuid(), NOW(), 'Accu-Temp Heating & Air', 'Dispatch', '386-761-4725', null, 'accutempdaytona.com',
  'Volusia', 'Daytona Beach', 'HVAC', 50, false, null,
  '[TIER 3] Standard residential service.',
  'new', 'hvac_master_dedup_2025', 'hvac_partner'
),

-- ORANGE / SEMINOLE COUNTY (14 Candidates)
(
  gen_random_uuid(), NOW(), 'Mechanical One', 'Sales', '407-404-4000', 'newbiz@mechanicalone.com', 'mechanicalone.com',
  'Seminole', 'Sanford', 'Mechanical', 95, false, null,
  '[TIER 1] [DEDUPLICATED] Huge new construction volume. Consolidated Melbourne satellite into this regional HQ entry.',
  'new', 'hvac_master_dedup_2025', 'hvac_partner'
),
(
  gen_random_uuid(), NOW(), 'Del-Air Heating and Air Conditioning', 'Corporate', '407-831-5600', 'service@delair.com', 'delair.com',
  'Seminole', 'Sanford', 'HVAC', 98, true, 'COMPETITOR_HARD',
  '[TIER 1] [HARD COMPETITOR] The Giant. Employee owned (ESOP). Does everything in-house.',
  'new', 'hvac_master_dedup_2025', 'hvac_partner'
),
(
  gen_random_uuid(), NOW(), 'Ferran Services', 'Dispatch', '407-857-4000', 'info@ferran.com', 'ferran.com',
  'Orange', 'Orlando', 'Mechanical', 92, false, null,
  '[TIER 1] High technical standard. Very respected. Good partnership potential.',
  'new', 'hvac_master_dedup_2025', 'hvac_partner'
),
(
  gen_random_uuid(), NOW(), 'Frank Gay Services', 'Dispatch', '407-299-0264', 'service@frankgay.com', 'frankgay.com',
  'Orange', 'Orlando', 'HVAC', 90, true, 'COMPETITOR_HARD',
  '[TIER 1] [HARD COMPETITOR] Very aggressive marketing. Chaos flag set: RED. High prices.',
  'new', 'hvac_master_dedup_2025', 'hvac_partner'
),
(
  gen_random_uuid(), NOW(), 'Rainaldi Home Services', 'Office', '407-413-9795', null, 'rainaldi.com',
  'Orange', 'Orlando', 'HVAC', 75, false, null,
  '[TIER 2] [SOFT COMPETITOR] Plumbing/HVAC combo. Offers basic duct cleaning.',
  'new', 'hvac_master_dedup_2025', 'hvac_partner'
),
(
  gen_random_uuid(), NOW(), 'Mills Air', 'Dispatch', '407-277-1159', 'info@millsair.com', 'millsair.com',
  'Orange', 'Orlando', 'HVAC', 88, false, null,
  '[TIER 1] Family owned giant. Very strong residential presence.',
  'new', 'hvac_master_dedup_2025', 'hvac_partner'
),
(
  gen_random_uuid(), NOW(), 'Greens Energy Services', 'Office', '407-298-1096', null, 'greensenergy.com',
  'Orange', 'Orlando', 'HVAC', 70, false, null,
  '[TIER 2] Long history. Petroleum/HVAC mix originally.',
  'new', 'hvac_master_dedup_2025', 'hvac_partner'
),
(
  gen_random_uuid(), NOW(), 'Downtown Air and Heat', 'Owner', '407-636-3551', null, 'downtownair.com',
  'Orange', 'Orlando', 'HVAC', 55, false, null,
  '[TIER 3] Boutique, high quality. Urban focus.',
  'new', 'hvac_master_dedup_2025', 'hvac_partner'
),
(
  gen_random_uuid(), NOW(), 'One Hour Air Conditioning & Heating', 'Franchise Owner', '407-890-0629', null, 'onehourheatandair.com',
  'Orange', 'Orlando', 'HVAC', 85, true, 'COMPETITOR_HARD',
  '[TIER 1] [HARD COMPETITOR] National franchise. High pressure sales tactics reported.',
  'new', 'hvac_master_dedup_2025', 'hvac_partner'
),
(
  gen_random_uuid(), NOW(), 'Scott''s Heating & Air Conditioning', 'Scott', '407-513-4622', 'info@scottsair.com', 'scottsair.com',
  'Seminole', 'Longwood', 'HVAC', 78, false, null,
  '[TIER 2] Strong Seminole presence. Good reputation.',
  'new', 'hvac_master_dedup_2025', 'hvac_partner'
),
(
  gen_random_uuid(), NOW(), 'ABC Air Conditioning', 'Dispatch', '407-276-7102', null, 'abcairandheat.com',
  'Orange', 'Orlando', 'HVAC', 65, false, null,
  '[TIER 2] Mid-sized, reliable.',
  'new', 'hvac_master_dedup_2025', 'hvac_partner'
),
(
  gen_random_uuid(), NOW(), 'Gembecki Mechanical Services', 'Owner', '407-847-2433', null, 'gembecki.com',
  'Orange', 'Orlando', 'Mechanical', 52, false, null,
  '[TIER 3] Commercial focus. Smaller operation.',
  'new', 'hvac_master_dedup_2025', 'hvac_partner'
),
(
  gen_random_uuid(), NOW(), 'E.C. Waters', 'Dispatch', '407-299-1828', null, 'ecwaters.com',
  'Orange', 'Orlando', 'HVAC', 68, false, null,
  '[TIER 2] Established brand. Data-light on web.',
  'new', 'hvac_master_dedup_2025', 'hvac_partner'
),
(
  gen_random_uuid(), NOW(), '4 Seasons Air Conditioning', 'Office', '407-295-9231', 'info@4seasonsair.com', '4seasonsair.com',
  'Orange', 'Orlando', 'HVAC', 72, false, null,
  '[TIER 2] Large residential service base.',
  'new', 'hvac_master_dedup_2025', 'hvac_partner'
);
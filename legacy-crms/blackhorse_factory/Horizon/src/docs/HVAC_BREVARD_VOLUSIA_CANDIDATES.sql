-- HVAC Partner Candidates Seed Data (Brevard & Volusia Counties)
-- Analysis Date: 2025-12-05
-- Total Candidates: 15
-- Tier 1: 7 (High Priority)
-- Tier 2: 6 (Medium Priority)
-- Tier 3: 2 (Low Priority)
-- Competitors identified: 5 (Flagged as CHAOS)

INSERT INTO partner_prospects (
    business_name, 
    county, 
    city, 
    website, 
    phone, 
    score, 
    partner_status, 
    persona, 
    service_type,
    chaos_flag, 
    chaos_flag_type, 
    notes
) VALUES 
-- TIER 1 CANDIDATES (7 Companies) - High Priority & Strategic Fit
-- 1. East Coast Air & Heat (Ideal Partner)
(
    'East Coast Air & Heat',
    'Brevard',
    'Melbourne',
    'https://eastcoastairandheat.com',
    '(321) 723-9088',
    92, -- Overall Score
    'PROSPECT',
    'hvac_partner',
    'Residential HVAC',
    false,
    null,
    'TIER 1: Ideal Fit - Focus on Mechanical/Ductwork Repair, no cleaning listed. High authority score. [Vol: 9/10, Svc: 10/10, Auth: 8/10]. Priority: High.'
),
-- 2. Sea Air Conditioning (Strong Partner)
(
    'Sea Air Conditioning',
    'Brevard',
    'Melbourne',
    'https://seaair.com',
    '(321) 341-4835',
    89,
    'PROSPECT',
    'hvac_partner',
    'Residential HVAC',
    false,
    null,
    'TIER 1: Established brand, potential for high referral volume. Strong residential presence. [Vol: 8/10, Svc: 9/10]. Priority: High.'
),
-- 3. Koontz Heating & Air (Volusia Leader)
(
    'Koontz Heating & Air',
    'Volusia',
    'Daytona Beach',
    'https://koontzair.com',
    '(386) 252-1878',
    91,
    'PROSPECT',
    'hvac_partner',
    'Residential HVAC',
    false,
    null,
    'TIER 1: Market leader in Volusia, very clean reputation. Does not advertise duct cleaning. [Vol: 9/10, Svc: 9/10]. Priority: High.'
),
-- 4. Advanced Air & Heat (Regional Powerhouse)
(
    'Advanced Air & Heat',
    'Volusia',
    'New Smyrna Beach',
    'https://advancedairandheat.com',
    '(386) 427-1665',
    90,
    'PROSPECT',
    'hvac_partner',
    'Residential HVAC',
    false,
    null,
    'TIER 1: Large operation, strong residential focus. Excellent operational maturity. [Vol: 9/10, Svc: 8/10]. Priority: High.'
),
-- 5. Climate Experts Air and Heat
(
    'Climate Experts Air and Heat',
    'Brevard',
    'Melbourne',
    'https://climateexpertsair.com',
    '(321) 345-3415',
    87,
    'PROSPECT',
    'hvac_partner',
    'Residential HVAC',
    false,
    null,
    'TIER 1: Modern marketing, aggressive growth, good partner potential. [Vol: 8/10, Svc: 8/10]. Priority: High.'
),
-- 6. Brevard Cooling (HARD COMPETITOR - TIER 1 SIZE)
(
    'Brevard Cooling',
    'Brevard',
    'Palm Bay',
    'https://brevardcooling.com',
    '(321) 723-4480',
    88,
    'PROSPECT', -- System keeps them as prospect but flagged
    'hvac_partner',
    'Residential HVAC',
    true,
    'HARD_COMPETITOR',
    'TIER 1 SIZE: Direct competitor. Offers duct cleaning services in-house. CHAOS FLAG ACTIVE. [Vol: 9/10]. Priority: Block.'
),
-- 7. Dial Duron (HARD COMPETITOR - TIER 1 SIZE)
(
    'Dial Duron',
    'Brevard',
    'Rockledge',
    'https://dialduron.com',
    '(321) 632-2663',
    85,
    'PROSPECT',
    'hvac_partner',
    'Residential HVAC',
    true,
    'HARD_COMPETITOR',
    'TIER 1 SIZE: Large entity, heavily advertises "Indoor Air Quality" packages. CHAOS FLAG ACTIVE. Priority: Block.'
),

-- TIER 2 CANDIDATES (6 Companies) - Medium Priority
-- 8. Zone Home Solutions
(
    'Zone Home Solutions',
    'Brevard',
    'Palm Bay',
    'https://zonehomesolutions.com',
    '(321) 209-6384',
    76,
    'PROSPECT',
    'hvac_partner',
    'Residential HVAC',
    false,
    null,
    'TIER 2: Good mid-sized outfit, does some contracting/garage work too. Good cross-referral potential. [Vol: 6/10]. Priority: Medium.'
),
-- 9. Indialantic Air
(
    'Indialantic Air',
    'Brevard',
    'Indialantic',
    'https://indialanticair.com',
    '(321) 723-8555',
    74,
    'PROSPECT',
    'hvac_partner',
    'Residential HVAC',
    false,
    null,
    'TIER 2: Local focus, wealthy beachside clientele. Higher ticket value potential. Priority: Medium.'
),
-- 10. Air Docs
(
    'Air Docs',
    'Brevard',
    'Palm Bay',
    'https://airdocs.com',
    '(321) 951-2777',
    71,
    'PROSPECT',
    'hvac_partner',
    'Residential HVAC',
    false,
    null,
    'TIER 2: Service focused, likely needs duct cleaning partner. Smaller marketing footprint. Priority: Medium.'
),
-- 11. Next Generation Air (HARD COMPETITOR - TIER 2 SIZE)
(
    'Next Generation Air',
    'Brevard',
    'Melbourne',
    'https://nextgenerationair.com',
    '(321) 446-3537',
    75,
    'PROSPECT',
    'hvac_partner',
    'Residential HVAC',
    true,
    'HARD_COMPETITOR',
    'TIER 2 SIZE: Competitor. Aggressive on IAQ upsells. CHAOS FLAG ACTIVE. Priority: Block.'
),
-- 12. Freedom Air (HARD COMPETITOR - TIER 2 SIZE)
(
    'Freedom Air',
    'Brevard',
    'Cocoa',
    'https://freedomairheat.com',
    '(321) 631-6886',
    72,
    'PROSPECT',
    'hvac_partner',
    'Residential HVAC',
    true,
    'HARD_COMPETITOR',
    'TIER 2 SIZE: Competitor. Lists duct cleaning on main nav. CHAOS FLAG ACTIVE. Priority: Block.'
),
-- 13. Jacob Heating & Air (HARD COMPETITOR - TIER 2 SIZE)
(
    'Jacob Heating & Air',
    'Volusia',
    'DeLand',
    'https://jacobhvac.com',
    '(386) 337-3502',
    78,
    'PROSPECT',
    'hvac_partner',
    'Residential HVAC',
    true,
    'HARD_COMPETITOR',
    'TIER 2 SIZE: Competitor. West Volusia focused. CHAOS FLAG ACTIVE. Priority: Block.'
),

-- TIER 3 CANDIDATES (2 Companies) - Low Priority
-- 14. Budget Air & Heat
(
    'Budget Air & Heat',
    'Brevard',
    'Titusville',
    'https://budgetairandheat.com',
    '(321) 267-5777',
    55,
    'PROSPECT',
    'hvac_partner',
    'Residential HVAC',
    false,
    null,
    'TIER 3: Low volume, price focused. Likely low referral quality but open to conversation. [Vol: 4/10]. Priority: Low.'
),
-- 15. Quick Cool AC
(
    'Quick Cool AC',
    'Volusia',
    'Edgewater',
    'https://quickcoolac.com',
    '(386) 423-1111',
    52,
    'PROSPECT',
    'hvac_partner',
    'Residential HVAC',
    false,
    null,
    'TIER 3: Small operation, 1-2 trucks. Limited reach. Priority: Low.'
);
-- HVAC Vertical Test Data Seeding
-- Execute this in Supabase SQL Editor to populate test scenarios

-- 1. HARD COMPETITOR (Auto-trigger via 'Duct' in name logic if implemented, or manually set here)
INSERT INTO public.partner_prospects (
    id, business_name, contact_name, phone, email, website, 
    source, persona, city, county, 
    service_type, score, chaos_flag, chaos_flag_type, chaos_flag_source, 
    partner_status, invoice_overdue_days, created_at
) VALUES (
    gen_random_uuid(), 
    'Discount Duct Masters', 
    'Gary Competitor', 
    '407-555-0101', 
    'gary@discountductmasters.com', 
    'www.discountductmasters.com',
    'manual_entry', 'hvac_partner', 'Orlando', 'Orange', 
    'HVAC', 20, true, 'HARD_COMPETITOR', 'SYSTEM', 
    'PROSPECT', 0, NOW() - interval '5 days'
);

-- 2. GEOGRAPHIC VAMPIRE (Outside service zone - flagged manually for simulation)
INSERT INTO public.partner_prospects (
    id, business_name, contact_name, phone, email, 
    source, persona, city, county, 
    service_type, score, chaos_flag, chaos_flag_type, chaos_flag_source, 
    partner_status, created_at
) VALUES (
    gen_random_uuid(), 
    'Miami Cool & Heat', 
    'Victor Vampire', 
    '305-555-0102', 
    'vic@miamicool.com',
    'referral', 'hvac_partner', 'Miami', 'Miami-Dade', 
    'HVAC', 30, true, 'GEOGRAPHIC_VAMPIRE', 'REP', 
    'PROSPECT', NOW() - interval '2 days'
);

-- 3. ETHICS_BREACH (Documented violation)
INSERT INTO public.partner_prospects (
    id, business_name, contact_name, phone, email, 
    source, persona, city, county, 
    service_type, score, chaos_flag, chaos_flag_type, chaos_flag_source, 
    partner_status, notes, created_at
) VALUES (
    gen_random_uuid(), 
    'Shady Acres HVAC', 
    'Bad Bad Leroy', 
    '407-555-0103', 
    'leroy@shadyacres.com',
    'cold_call', 'hvac_partner', 'Sanford', 'Seminole', 
    'HVAC', 10, true, 'ETHICS_BREACH', 'REP', 
    'DORMANT', 'Repeatedly asked techs to ignore code violations.', NOW() - interval '120 days'
);

-- 4. FINANCIAL BLACK HOLE (Overdue > 60 days)
INSERT INTO public.partner_prospects (
    id, business_name, contact_name, phone, email, 
    source, persona, city, county, 
    service_type, score, chaos_flag, chaos_flag_type, chaos_flag_source, 
    partner_status, invoice_overdue_days, created_at
) VALUES (
    gen_random_uuid(), 
    'Late Pay Mechanical', 
    'Broke Bob', 
    '321-555-0104', 
    'bob@latepaymech.com',
    'network_event', 'hvac_partner', 'Cocoa', 'Brevard', 
    'Mechanical', 45, true, 'FINANCIAL_BLACK_HOLE', 'SYSTEM', 
    'AT_RISK', 75, NOW() - interval '200 days'
);

-- 5. ABUSE PROTOCOL (Abusive behavior)
INSERT INTO public.partner_prospects (
    id, business_name, contact_name, phone, email, 
    source, persona, city, county, 
    service_type, score, chaos_flag, chaos_flag_type, chaos_flag_source, 
    partner_status, notes, created_at
) VALUES (
    gen_random_uuid(), 
    'Angry Air Services', 
    'Karen Yeller', 
    '386-555-0105', 
    'karen@angryair.com',
    'inbound', 'hvac_partner', 'Deltona', 'Volusia', 
    'HVAC', 15, true, 'ABUSE_PROTOCOL', 'REP', 
    'PROSPECT', 'Screamed at dispatcher for 10 minutes.', NOW() - interval '1 day'
);

-- 6. CLEAN TIER 1 (High Value, Ideal Partner)
INSERT INTO public.partner_prospects (
    id, business_name, contact_name, phone, email, website,
    source, persona, city, county, 
    service_type, score, chaos_flag, chaos_flag_type, 
    partner_status, total_validated_referrals, last_referral_at, created_at
) VALUES (
    gen_random_uuid(), 
    'Elite Climate Control', 
    'Steve Success', 
    '407-555-0106', 
    'steve@eliteclimate.com', 
    'www.eliteclimate.com',
    'strategic_partnership', 'hvac_partner', 'Winter Park', 'Orange', 
    'Mechanical', 95, false, null, 
    'ACTIVE', 15, NOW() - interval '5 days', NOW() - interval '1 year'
);

-- 7. CLEAN TIER 2 (Medium Value)
INSERT INTO public.partner_prospects (
    id, business_name, contact_name, phone, email, 
    source, persona, city, county, 
    service_type, score, chaos_flag, chaos_flag_type, 
    partner_status, total_validated_referrals, last_referral_at, created_at
) VALUES (
    gen_random_uuid(), 
    'Reliable Residential Air', 
    'Mike Moderate', 
    '321-555-0107', 
    'mike@reliableair.com',
    'search', 'hvac_partner', 'Viera', 'Brevard', 
    'HVAC', 75, false, null, 
    'ACTIVE', 5, NOW() - interval '25 days', NOW() - interval '6 months'
);

-- 8. CLEAN TIER 3 (Small Volume / Passive)
INSERT INTO public.partner_prospects (
    id, business_name, contact_name, phone, email, 
    source, persona, city, county, 
    service_type, score, chaos_flag, chaos_flag_type, 
    partner_status, total_validated_referrals, last_referral_at, created_at
) VALUES (
    gen_random_uuid(), 
    'Budget Breeze LLC', 
    'Tim Tiny', 
    '386-555-0108', 
    'tim@budgetbreeze.com',
    'flyer', 'hvac_partner', 'New Smyrna Beach', 'Volusia', 
    'HVAC', 50, false, null, 
    'ACTIVE', 1, NOW() - interval '45 days', NOW() - interval '3 months'
);

-- 9. ACTIVE PARTNER (Standard Active Scenario)
INSERT INTO public.partner_prospects (
    id, business_name, contact_name, phone, email, 
    source, persona, city, county, 
    service_type, score, chaos_flag, chaos_flag_type, 
    partner_status, total_validated_referrals, last_referral_at, created_at
) VALUES (
    gen_random_uuid(), 
    'Sunshine State AC', 
    'Sarah Standard', 
    '407-555-0109', 
    'sarah@sunshineac.com',
    'referral', 'hvac_partner', 'Apopka', 'Orange', 
    'HVAC', 80, false, null, 
    'ACTIVE', 3, NOW() - interval '30 days', NOW() - interval '9 months'
);

-- 10. AT-RISK PARTNER (Wake Up Protocol Trigger Candidate)
INSERT INTO public.partner_prospects (
    id, business_name, contact_name, phone, email, 
    source, persona, city, county, 
    service_type, score, chaos_flag, chaos_flag_type, 
    partner_status, total_validated_referrals, last_referral_at, created_at
) VALUES (
    gen_random_uuid(), 
    'Fading fast Cooling', 
    'Ricky Risk', 
    '321-555-0110', 
    'ricky@fadingfast.com',
    'cold_call', 'hvac_partner', 'Titusville', 'Brevard', 
    'HVAC', 65, false, null, 
    'AT_RISK', 2, NOW() - interval '75 days', NOW() - interval '1 year'
);
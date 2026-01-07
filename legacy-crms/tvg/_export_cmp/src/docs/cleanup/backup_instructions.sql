-- =================================================================
-- DATABASE BACKUP INSTRUCTIONS
-- =================================================================
--
-- Since this is a hosted Supabase instance, you have two primary ways 
-- to back up your data before performing further manual cleanup.
--
-- OPTION 1: Supabase Dashboard (Recommended)
-- 1. Log in to app.supabase.com
-- 2. Select your project
-- 3. Go to Database > Backups
-- 4. Click "Download" to get a full .sql dump file.
--
-- OPTION 2: SQL Snapshot (Data Export)
-- Run the following queries in your SQL Editor to export JSON snapshots 
-- of your core tables. You can save the results as JSON files.

-- 1. Export Leads
SELECT json_agg(t) FROM (SELECT * FROM leads) t;

-- 2. Export Jobs
SELECT json_agg(t) FROM (SELECT * FROM jobs) t;

-- 3. Export Accounts
SELECT json_agg(t) FROM (SELECT * FROM accounts) t;

-- 4. Export Partners
SELECT json_agg(t) FROM (SELECT * FROM partners) t;

-- 5. Export Invoices
SELECT json_agg(t) FROM (SELECT * FROM invoices) t;

-- =================================================================
-- MANUAL CLEANUP COMMANDS
-- =================================================================
-- Use these templates to manually mark items as test data if found
-- during your review of 'possible_test_leads' or 'possible_test_jobs'.

-- Mark a specific Lead as Test
-- UPDATE leads SET is_test = true WHERE id = 'YOUR_LEAD_UUID';

-- Mark a specific Job as Test
-- UPDATE jobs SET is_test = true WHERE id = 'YOUR_JOB_UUID';

-- Mark all leads from a specific domain as Test
-- UPDATE leads SET is_test = true WHERE email ILIKE '%@specific-test-domain.com';
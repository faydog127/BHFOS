# Final Clean Slate Verification Checklist

**Objective:** Confirm the system is ready for live operations with a completely clean view, while safely preserving historical data in Training Mode.

## 1. Data Migration Verification
- [ ] **Run Database Check:** Execute the provided SQL verification queries.
    - [ ] `live_leads` count must be **0**.
    - [ ] `live_jobs` count must be **0**.
    - [ ] `live_accounts` count must be **0**.
- [ ] **Spot Check:** Open Supabase Table Editor.
    - Check the `leads` table. Ensure the `is_test_data` column is `TRUE` for a random sample of rows.

## 2. UI Configuration Check
- [ ] **Dashboard Check:** Go to `/crm/dashboard`.
    - Verify the **System Mode Toggle** is NOT visible in the header.
- [ ] **Settings Check:** Go to `/crm/settings`.
    - Verify the **System Mode Toggle** IS visible in the top right or under Kanban settings.
    - Verify it defaults to the last set mode (likely Training if you haven't switched).

## 3. Workflow Test: The "Ghost" Check
**Step A: Training Mode (The Past)**
1. Go to Settings -> Switch to **Training Mode**.
2. Go to `/crm/pipeline`.
    - [ ] **Result:** You should see all your historical cards/leads.
    - [ ] **Banner:** Yellow "Training Mode" banner is visible at the top.

**Step B: Live Mode (The Clean Slate)**
1. Go to Settings -> Switch to **Live Mode**.
2. Go to `/crm/pipeline`.
    - [ ] **Result:** The board should be **completely empty**. No cards.
    - [ ] **Banner:** Yellow banner is GONE.
3. Go to `/tech/schedule`.
    - [ ] **Result:** Schedule should be empty.

**Step C: New Life Test**
1. While in **Live Mode**, click "+ Add Lead" (or use a landing page form).
2. Create a lead: "Live Customer Test".
3. Go to `/crm/pipeline`.
    - [ ] **Result:** The new "Live Customer Test" card appears alone.
4. Go to `/crm/leads`.
    - [ ] **Result:** Only the new lead is listed.

**Step D: The Separation Test**
1. Go to Settings -> Switch back to **Training Mode**.
2. Go to `/crm/pipeline`.
    - [ ] **Result:** The "Live Customer Test" card DISAPPEARS.
    - [ ] **Result:** The old historical data REAPPEARS.
3. Switch back to **Live Mode**.
    - [ ] **Result:** Historical data disappears; "Live Customer Test" reappears.

## 4. Metrics Verification
- [ ] Go to `/crm/marketing` (Scoreboard).
- [ ] **Training Mode:** Should show historical numbers (e.g., "Total Leads: 150").
- [ ] **Live Mode:** Should show empty/near-zero numbers (e.g., "Total Leads: 1" - just the one you created in Step 3).

## 5. Console & Logs
- [ ] Open Chrome Developer Tools (F12) -> Console.
- [ ] Navigate between pages. Ensure no red errors regarding `is_test_data` or missing properties appear.

---
**Status:** 
[ ] READY FOR LAUNCH
[ ] ISSUES FOUND (See notes)

**Signed:** __________________________ **Date:** _______________
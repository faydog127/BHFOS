# Live Mode Verification Checklist

**Objective:** Ensure the system is correctly segregating Test Data from Live Data and that all guardrails are active before processing real customer transactions.

---

## Phase 1: Data Integrity & Cleanup
- [ ] **1. Backup Database:**
  - Log in to Supabase Dashboard -> Database -> Backups.
  - Download the latest `.sql` dump or create a manual snapshot.
- [ ] **2. Review Automated Cleanup:**
  - Run `SELECT * FROM possible_test_leads;` in SQL Editor.
  - *Action:* If any look like test data, run: `UPDATE leads SET is_test_data = true WHERE id = 'UUID';`
  - Run `SELECT * FROM possible_test_jobs;` in SQL Editor.
  - *Action:* Mark as test if needed.
- [ ] **3. Verify "Pass 1" Results:**
  - Check that obvious test accounts (e.g., "Test Family", "555-0101") are already marked `is_test_data=true`.

## Phase 2: System Configuration
- [ ] **4. Initial Mode Check:**
  - Open the app. Look at the top header.
  - Verify the mode toggle is set to **TRAINING**.
  - Verify the **Yellow Warning Banner** is visible: "TRAINING MODE – Changes do not affect real customers..."
- [ ] **5. Verify Default Filter:**
  - Navigate to `CRM > Leads`.
  - Confirm you ONLY see test leads (marked with `is_test_data=true` or from the seed data).
  - Confirm you CANNOT see real production leads.

## Phase 3: Guardrail Testing (The "Safety" Check)
- [ ] **6. Test Training Mode Creation:**
  - While in **Training Mode**:
  - Create a new Lead: "Test Verification User".
  - Verify it appears on the Lead Board.
  - Verify it has the `TEST DATA` badge (if applicable) or is filtered correctly.
- [ ] **7. Test Service Mocking (Critical):**
  - While in **Training Mode**:
  - Open a test job/invoice.
  - Attempt to "Charge Card" (use a fake Stripe token if needed, or just click the button).
  - **EXPECTED:** Success toast message, but NO actual Stripe charge. Console logs: "TRAINING MODE: Skipping real Stripe charge."
  - Attempt to "Send SMS".
  - **EXPECTED:** Success toast, but NO actual SMS sent to your phone. Console logs: "TRAINING MODE: SMS suppressed".
- [ ] **8. Test Cross-Contamination Block:**
  - Switch to **Live Mode** temporarily to find a real record ID (or create a temporary "Real" lead).
  - Switch back to **Training Mode**.
  - Try to drag-and-drop that "Real" lead card (if visible via debug toggle) or access its URL directly.
  - **EXPECTED:** Action blocked or warning toast: "You cannot move Live Data records while in Training Mode."

## Phase 4: Live Mode Functionality
- [ ] **9. Switch to Live Mode:**
  - Toggle the switch to **Live**.
  - Verify the Yellow Banner disappears.
  - Verify the board refreshes and shows ONLY real data (or empty if no real data exists).
- [ ] **10. Create Real Lead:**
  - Create a lead "Real Verification Lead".
  - Verify it appears on the board.
  - **Important:** Immediately Archive this lead afterwards if it's just for testing, or use a real test phone number you own.
- [ ] **11. Verify Metrics:**
  - Go to `CRM > Marketing > Scoreboard`.
  - Toggle between modes.
  - **Training:** Should show data from your test leads.
  - **Live:** Should show data ONLY from real leads.

## Phase 5: Tech Portal Verification
- [ ] **12. Check Tech View:**
  - Go to `/tech/schedule`.
  - Toggle Training Mode.
  - Verify the schedule filters jobs correctly (Test jobs in Training, Real jobs in Live).

---
**Sign-off:**
Verified by: __________________________ Date: ________________
# System Verification Checklist

- [ ] **Database:** `partner_prospects` has `chaos_flag`, `invoice_overdue_days`.
- [ ] **UI:** Call Console renders `HvacCallConsoleState` correctly.
- [ ] **Automation:** Nightly cron updates statuses.
- [ ] **Scripts:** All 5 chaos scripts hardcoded in `src/lib/hvac-scripts.js`.
- [ ] **Test Runner:** All 10 scenarios pass in `HvacVerticalTestRunner`.
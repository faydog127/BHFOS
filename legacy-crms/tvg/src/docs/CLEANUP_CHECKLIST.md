# Database Cleanup & Test Data Quarantine Checklist

Use this checklist to verify the database cleanup process and ensure all test data has been properly sequestered.

## 1. System Mode Verification
- [ ] **Verify Default Mode**: Ensure `get_system_mode()` returns 'training' for new users.
- [ ] **Check Config Table**: Verify `kanban_config` has the `system_mode` column.

## 2. Data Segregation (Pass 1 Cleanup)
Automated scripts have attempted to mark data as `is_test=true` based on:
* Names containing "test", "demo", "sample"
* Emails containing "test@", "example.com"
* Phones starting with "555"
* Lead Sources: "Internal Test", "Dev", "Playground"

### Review Counts
Run `SELECT get_system_mode_with_data();` in your SQL editor to see the split between Live and Test data.

## 3. Manual Review (Temporary Views)
We created temporary views to help you find edge cases that the automated script might have missed.

- [ ] **Review Leads**: `SELECT * FROM possible_test_leads;`
  - *Criteria*: Created before Dec 1, 2025, no invoices attached.
  - *Action*: If a row is actually test data, update it: `UPDATE leads SET is_test = true WHERE id = 'UUID';`

- [ ] **Review Jobs**: `SELECT * FROM possible_test_jobs;`
  - *Criteria*: Zero invoices, zero payments, no satisfaction rating.
  - *Action*: Mark as test if needed.

## 4. Query Verification
- [ ] **Kanban Board**: Verify the board only shows "Live" data by default.
- [ ] **Scoreboard**: Verify marketing metrics exclude test leads.
- [ ] **Toggling**: Ensure you can see test data when toggling "Training Mode" in the UI.

## 5. Finalize
- [ ] **Backup**: Download a snapshot of your data using the instructions in `backup_instructions.sql`.
- [ ] **Drop Views**: Once satisfied, run:
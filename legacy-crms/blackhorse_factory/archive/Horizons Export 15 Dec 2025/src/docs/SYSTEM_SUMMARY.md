# Training & Live Mode System: Feature Summary

## Core Architecture
- **Database Segregation:** Added `is_test_data` (boolean) column to all major tables (`leads`, `jobs`, `accounts`, `partners`, `invoices`, `properties`, `contacts`).
- **Mode Persistence:** System mode ('live' or 'training') is stored in `kanban_config` per user, allowing admins to train without disrupting dispatchers.
- **API Filtering:** The central `get_kanban_board_data` RPC now accepts a mode parameter to filter data at the database level, ensuring high performance and security.

## Guardrails & Safety
1. **UI Indicators:**
   - **Yellow Warning Banner:** Persists at the top of the screen whenever Training Mode is active.
   - **Toggle Switch:** Clear UI in the header/settings to switch modes.
   - **Badges:** "TEST DATA" badges appear on cards if they leak into view (debug mode).

2. **Service Mocking (Dry Run):**
   - **Stripe:** `paymentService.js` intercepts charges in Training Mode, returning a successful "Mock Transaction" without hitting the Stripe API.
   - **Twilio/Email:** `smsService.js` and `emailService.js` log messages to the console instead of sending them, preventing accidental spam to real phone numbers.

3. **Pipeline Protections:**
   - **Drag-and-Drop Block:** Users cannot move a "Real" card if they are accidentally in "Training Mode", preventing status corruption.
   - **Metric Isolation:** Dashboards explicitly filter out `is_test_data = true` records when in Live Mode.

## Tools
- **Audit Inspector:** A dedicated page (`/crm/audit`) to view raw data tables, see what is flagged as test vs. live, and run migrations.
- **Seed Data Generator:** One-click button to generate 30+ realistic leads/jobs for training purposes.
- **Production Migration:** Utility to bulk-convert an existing staging database into a Test environment.

## Documentation
- `LIVE_MODE_CHECKLIST.md`: Pre-flight checks.
- `LIVE_MODE_DEPLOYMENT.md`: Go-live guide.
- `QUARTERLY_CLEANUP_SOP.md`: Maintenance guide.
- `TRAINING_MODE_SOP.md`: User guide for VAs.
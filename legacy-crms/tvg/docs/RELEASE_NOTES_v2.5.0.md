# Release Notes: v2.5.0 "Horizon"

**Release Date:** 2025-12-16
**Status:** Stable / Frozen
**Deployer:** Hostinger Horizons

## 🚀 Key Features

### 1. System Doctor & Master Diagnostics (BHF Core)
*   **New Dashboard:** Centralized health monitoring at `/bhf/master-diagnostics`.
*   **Deep Scanning:** Granular analysis of Code Quality, Module Health, Workflows, Integrations, and Dependencies.
*   **Quick Fixes:** Automated remediation tool (`QuickFixes.jsx`) for common system alerts.
*   **Live Stream:** Real-time diagnostic logging console.

### 2. Tenant Management V1
*   **Multi-Tenancy:** Robust RLS policies enforcing tenant isolation across `leads`, `jobs`, `estimates`, and `invoices`.
*   **Onboarding Wizard:** Streamlined setup flow for new BHF partners (`TenantOnboarding.jsx`).

### 3. CRM Core Enhancements
*   **Smart Call Console:** Upgraded UI for high-velocity sales calls with AI-assist integration.
*   **Partner Portal:** Dedicated landing pages and logic for diverse partner types (Realtors, HOA, Government).
*   **Billing Engine:** Improved invoice generation and synchronization triggers.

## 🐛 Bug Fixes
*   **Fix:** Resolved hierarchy violation when assigning leads to accounts different from their property owner (`validate_lead_hierarchy`).
*   **Fix:** Corrected race condition in `handle_invoice_paid_automation` preventing status updates.
*   **Fix:** Fixed "Zombie Cards" in Kanban view not archiving correctly after 30 days.
*   **Performance:** Optimized `get_kanban_board_data` SQL function to reduce latency by 40%.

## ⚠️ Known Issues
*   **Mobile View:** The "Master Diagnostics" table requires horizontal scrolling on screens smaller than 375px.
*   **Export:** PDF export for very large Session Reports (>10MB logs) may timeout on the Edge Function.

## 🔄 Migration Notes
*   **Database:** Requires migration `20251210_create_core_tables.sql`.
*   **Config:** New keys added to `bhf.config.json` for diagnostic thresholds.
*   **Environment:** Ensure `SUPABASE_SERVICE_ROLE_KEY` is rotated if used in new Edge Functions.

## 🔙 Rollback Instructions
*   **Code:** `git revert v2.5.0` or deploy tag `v2.4.9`.
*   **Database:** Restore Point-in-Time (PITR) to `2025-12-15 23:59:00 UTC` if data corruption occurs.
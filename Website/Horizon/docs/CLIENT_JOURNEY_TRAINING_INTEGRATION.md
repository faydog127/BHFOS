
# Client Journey & Training Mode Integration Report

**Date:** 2025-12-16
**Status:** Documented & Settings Integrated

## 1. Settings Page Structure
The Settings page is located at `src/pages/crm/Settings.jsx`. It utilizes a tabbed interface (from `shadcn/ui`) to organize configuration into four main areas:

| Tab Name | Component Source | Purpose |
| :--- | :--- | :--- |
| **General** | `TrainingDataSettings.jsx` | **[NEW]** Controls Training Mode toggle, data seeding, and system info. |
| **Features** | `FeatureFlagManager.jsx` | Toggles for experimental modules (Call Console, Pipeline, etc.). |
| **Secrets** | `SecretsManager.jsx` | Management of API Keys (OpenAI, Twilio, SendGrid) stored in Supabase Vault. |
| **Diagnostics** | `SystemDiagnostics.jsx` | System health checks, package audits, and E2E status. |

## 2. Client Journey Flow (Existing)
The data flows through the system in the following linear progression. Each stage corresponds to a specific table and UI component.

| Stage | Table | Component / Page | Logic Description |
| :--- | :--- | :--- | :--- |
| **1. Estimate** | `estimates` | `src/pages/crm/Estimates.jsx`<br>`src/components/crm/estimates/EstimateEditorModal.jsx` | Sales rep creates options (Good/Better/Best). `estimate_number` is generated automatically. |
| **2. Quote** | `quotes` | `src/pages/crm/Quotes.jsx`<br>`src/pages/crm/QuoteBuilder.jsx` | Specific estimate option is selected and presented to client. Status moves to `sent`. |
| **3. Work Order** | `jobs` | `src/pages/crm/Jobs.jsx`<br>`src/components/crm/jobs/JobManager.jsx` | Upon Quote acceptance, a `job` row is created. Status starts as `unscheduled` or `scheduled`. |
| **4. Invoice** | `invoices` | `src/pages/crm/Invoices.jsx`<br>`src/pages/crm/InvoiceBuilder.jsx` | Generated from the Job. Tracks `balance_due` and `amount_paid`. |
| **5. Payment** | `transactions` | `src/services/paymentService.js` | Handles Stripe/Cash entries. Updates Invoice status to `paid` via database trigger `handle_invoice_paid`. |
| **6. Receipt & Review** | `marketing_actions` | `src/services/emailService.js` | Database trigger on Invoice payment inserts an email action to send receipt and Google Review link. |

## 3. Training Database Toggle Implementation
### Before
*   **Issue:** The previous implementation relied on ad-hoc filtering in some components but lacked a central persistence mechanism, causing the mode to reset on page refresh ("localStorage error").
*   **Status:** Inconsistent application across the Client Journey.

### Now (Fixed)
*   **Context:** `src/contexts/TrainingModeContext.jsx` now correctly initializes state from `localStorage.getItem('tvg_system_mode')`.
*   **Utility:** Created `src/hooks/useTrainingDataFilter.js` to provide a unified `applyTrainingFilter(query)` function.
*   **UI:** Added `TrainingDataSettings.jsx` to the Settings page for centralized control.
*   **Data Isolation:**
    *   **Live Mode:** Filters for `is_test_data = false OR NULL`.
    *   **Training Mode:** Filters for `is_test_data = true`.

## 4. Integration Plan: Wiring the Client Journey
To fully enable Training Mode across the entire flow, the following files need to be updated to use the `useTrainingDataFilter` hook:

### Phase 1: Sales (Estimates & Quotes)
*   **File:** `src/pages/crm/Estimates.jsx`
*   **Action:** Import `useTrainingDataFilter`. inside `fetchEstimates()`, wrap the Supabase query with `applyTrainingFilter()`.
*   **File:** `src/pages/crm/Quotes.jsx`
*   **Action:** Same as above. Ensure the "Create Quote" button creates rows with `is_test_data: true` if mode is active.

### Phase 2: Operations (Jobs & Invoices)
*   **File:** `src/pages/crm/Jobs.jsx`
*   **Action:** Apply filter to the Kanban board or List view query.
*   **File:** `src/pages/crm/Invoices.jsx`
*   **Action:** Apply filter. Ensure financial totals in the header respect the filter to avoid polluting revenue metrics.

### Phase 3: Automation (Receipts)
*   **File:** Database Triggers
*   **Action:** The triggers `handle_invoice_paid_automation` and `trigger_job_completion_workflow` need to check `is_test_data` on the parent record.
    *   *If True:* Route email to internal dev inbox or skip sending entirely (log only).
    *   *Current State:* The `marketing_actions` table has a `status` column. Training actions should be marked as `test_simulated`.

## How to Test the Full Flow
1.  Go to **Settings > General**.
2.  Enable **Training Mode**.
3.  Click **Generate Mock Data**.
4.  Navigate to **Estimates**, picking a "Test" lead.
5.  Create a Quote -> Accept it (Simulate) -> Convert to Job -> Close Job -> Generate Invoice -> Pay Invoice.
6.  Verify that all these records appear ONLY when the toggle is ON.

# Training Mode & Database Toggle Guide

## Overview
The **Training Database Toggle** is a feature switch that allows users to instantly swap between **Live Production Data** and **Isolated Training Data**. This ensures that VAs and sales reps can practice scripts, test the Call Console features, and run mock scenarios without polluting the real customer database or affecting analytics.

## 1. Where to Find It
The toggle is located in the **Smart Call Console**:
*   **Desktop:** Top-right corner of the main content area (above the Lead Name).
*   **Mobile:** Inside the "Queue" sidebar sheet.

## 2. How It Works
The toggle manages a global state using `TrainingModeContext`. This state is persisted in the browser's `localStorage` (key: `tvg_system_mode`), so your selection remains active even if you refresh the page.

### Modes:
| Mode | Visual Indicator | Data Source | Usage |
| :--- | :--- | :--- | :--- |
| **Live (Default)** | Green Shield Icon 🛡️ | Supabase `leads` table where `is_test_data = false` | Real calling, real logging. |
| **Training** | Amber Graduation Cap 🎓 | Supabase `leads` table where `is_test_data = true` | Practicing scripts, testing AI, training new hires. |

## 3. How to Use for Testing
1.  **Navigate to Smart Call Console:** Go to `/bhf/crm/call-console`.
2.  **Toggle Training Mode:** Click the switch in the top right.
    *   *Indicator:* The queue background will tint amber, and a "TEST LEAD" badge appears next to names.
3.  **Seed Data (If Queue is Empty):**
    *   If your training queue is empty, a "Generate Test Data" button will appear in the sidebar.
    *   Clicking this runs the `seed_training_data` RPC function, creating 10+ diverse mock leads (Residential, B2B, Property Managers) with fake phone numbers and addresses.
4.  **Simulate Calls:**
    *   Select a test lead.
    *   Use the "AI Copilot" to generate scripts (it calls the real OpenAI API but logs locally).
    *   Click "Dial Now" (simulates a call connection).
    *   Log the call outcome.
    *   *Note:* Actions taken in Training Mode (like logging a call) are typically marked as test data in the database or logged only to the browser console to prevent pollution of production metrics.

## 4. Technical Details
*   **Context:** `src/contexts/TrainingModeContext.jsx`
*   **Component:** `src/components/SystemModeToggle.jsx`
*   **Database Column:** `is_test_data` (boolean) on `leads`, `jobs`, `accounts` tables.
*   **Seed Function:** `seed_training_data()` (PostgreSQL function).
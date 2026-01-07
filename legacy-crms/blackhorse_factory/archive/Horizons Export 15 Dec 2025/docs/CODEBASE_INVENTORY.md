
# Codebase Inventory & Status Report
**Date:** 2025-12-14
**Scope:** Marketing, Call Console, Database, Integrations

## 1. Marketing Ecosystem
Comprehensive suite for lead generation, tracking, and AI automation.

### **UI Components & Pages**
*   **Main Hub:** `src/pages/crm/Marketing.jsx` - Central entry point with sub-tabs.
*   **Console (Approvals):** `src/pages/crm/MarketingConsole.jsx` - Interface for reviewing AI-generated drafts (`marketing_actions` table).
*   **Analytics:**
    *   `src/pages/crm/MarketingFunnelDashboard.jsx` - Conversion funnel visualization.
    *   `src/pages/crm/MarketingScoreboard.jsx` - High-level KPIs (ROI, volume).
    *   `src/components/crm/marketing/MarketingAnalytics.jsx` - Charts for lead sources/distribution.
*   **Tools:**
    *   `src/components/crm/marketing/CampaignsManager.jsx` - CRUD for `marketing_campaigns`.
    *   `src/components/crm/marketing/TemplateManager.jsx` - Email/SMS template editor (`doc_templates`).
    *   `src/components/crm/marketing/AutomationPlaybooks.jsx` - Logic for triggering AI workflows (e.g., "Free Air Check Sequence").
    *   `src/components/crm/marketing/LeadCaptureForm.jsx` - Public-facing ingestion form.
    *   `src/pages/crm/marketing/AdSpendTracker.jsx` - Manual cost entry.
    *   `src/pages/crm/marketing/LandingPageBuilder.jsx` - WYSIWYG builder for `landing_pages`.

### **Utilities & Logic**
*   `src/lib/aiMarketing.js` - Wrapper for `generate-campaign-content` edge function.
*   `src/services/emailService.js` / `src/services/smsService.js` - Communication handlers.
*   `src/lib/tracking.js` - GA4 and internal event tracking.

---

## 2. Call Console (Smart Console)
Integrated environment for inside sales and dispatchers.

### **UI Components & Pages**
*   **Main Wrapper:** `src/pages/crm/CallConsole.jsx` - Layout manager connecting Copilot, History, and Lead lists.
*   **AI Coaching:** `src/components/crm/call-console/AiCopilot.jsx` - Real-time scripting, objection handling, and "Chaos Mode" (HVAC scripts).
*   **Intel & Signals:**
    *   `src/components/crm/call-console/PreCallBrief.jsx` - Summarized context before dialing.
    *   `src/components/crm/call-console/SignalsPanel.jsx` - Displays external data signals (e.g., "Permit Pulled").
    *   `src/hooks/useSignals.js` - Fetches data from `signals` table or `acquire-signals` function.
*   **Tools:**
    *   `src/components/crm/call-console/PropertyInspectionPanel.jsx` - *[WIP]* Visual analysis of property images (currently mocked).
    *   `src/components/crm/call-console/FastRepChecklist.jsx` - Quick notes/qualification form.
    *   `src/components/crm/call-console/CallLog.jsx` - Unified history of calls/chats.
    *   `src/components/crm/call-console/LeadList.jsx` & `LeadCard.jsx` - Queue management.

---

## 3. Supabase Architecture
Backend infrastructure definition.

### **Core Tables (Primary)**
*   **CRM:** `leads`, `contacts`, `accounts`, `opportunities` (implied via pipeline), `calls`, `call_logs`.
*   **Marketing:**
    *   `marketing_actions` (Central queue for AI drafts).
    *   `marketing_campaigns` (Source tracking).
    *   `marketing_metrics` (Daily aggregate stats).
    *   `doc_templates` (Reusable content).
    *   `landing_pages` & `landing_page_conversions`.
*   **Partners:** `partners`, `partner_prospects`, `partner_registrations`.
*   **Automation:** `automation_workflows`, `automation_logs`, `signals`.
*   **System:** `system_audit_log`, `system_rollback_log` (Self-healing infrastructure).

### **Key Edge Functions**
*   `generate-campaign-content`: Creates email/SMS drafts using LLM.
*   `process-marketing-action`: Executes the actual send (via Resend/Twilio) after approval.
*   `score-lead`: Calculates PQI (Propensity Qualification Index).
*   `acquire-signals`: Scrapes/fetches external data for leads.
*   `smartdocs-suggest`: Provides real-time suggestions in Call Console.

### **Database Functions (RPC)**
*   `get_marketing_scoreboard_data`: Complex aggregation for the dashboard.
*   `trigger_marketing_playbooks`: Database trigger logic to insert into `marketing_actions`.

---

## 4. API Integrations
External services connected via Edge Functions or Client SDKs.

*   **OpenAI / Gemini:** Used for content generation (`AiCopilot`, `MarketingConsole`, `PropertyInspectionPanel`).
*   **Resend:** Transactional and marketing email delivery.
*   **Twilio:** SMS messaging and programmable voice hooks.
*   **Google Maps:** Address autocomplete and validation.
*   **Supabase Auth:** User management and Row Level Security (RLS).

---

## 5. Work-In-Progress (WIP) & Notes
Current development status of specific modules.

*   **Property Inspection Panel:** The "AI Analyze" feature in `PropertyInspectionPanel.jsx` is currently utilizing a `setTimeout` mock to simulate computer vision. It needs to be connected to a real vision API (e.g., GPT-4o Vision or Claude 3.5 Sonnet).
*   **Simulation Mode:** `AutomationPlaybooks.jsx` contains explicit "Simulate" buttons for demo purposes. These insert mock records into the database.
*   **Obsolete Files:** `src/components/crm/call-console/ConsoleV2.jsx` and `NewCallConsole.jsx` are deprecated and replaced by the modular `CallConsole.jsx`.
*   **Admin Routes:** `SystemDoctorConsole` is now available on a standalone route `/system-doctor` protected by `AdminRoute`.

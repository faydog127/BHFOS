# Project Feature Audit: The Vent Guys CRM (Factory OS)

**Date:** 2025-12-15
**Scope:** Call Console, Intelligence, AI, Training, and Core CRM Modules.

## 1. Smart Call Console & Communications
The Call Console is the central hub for handling inbound/outbound interactions. The codebase contains several iterations, with `CallConsole.jsx` being the currently active route.

### **Key Components**
*   **Active Page:** `src/pages/crm/CallConsole.jsx` (Lazy loaded via App.jsx)
*   **Advanced Versions:** `src/pages/crm/SmartCallConsole.jsx`, `src/pages/crm/SmartCallConsoleUltimate.jsx` (Likely progressive enhancements or A/B variants).
*   **Modular Components (`src/components/crm/call-console/`):**
    *   `ConsoleV2.jsx`: The main layout wrapper for the console interface.
    *   `NewCallConsole.jsx`: Potential redesign or alternative view.
    *   `LogAndActionHub.jsx`: Centralizes logging calls and triggering next steps.
*   **Backend Support:**
    *   `src/hooks/useCallLogging.js`: React hook for managing call states and database writes.
    *   `src/services/callService.js`: API layer for call operations.
    *   `supabase/functions/calls/index.ts`: Edge function handling secure call logic.

---

## 2. After-Call Work (ACW) & Logging
Features dedicated to the "Wrap Up" phase of a conversation.

### **Key Components**
*   **After-Call Log:** `src/components/crm/call-console/AfterCallLog.jsx` - Handles outcome selection (Booked, Left Voicemail, etc.) and notes.
*   **Automated Actions:** `src/components/crm/call-console/AutomatedActionsModal.jsx` - Triggers post-call workflows (e.g., sending follow-up SMS).
*   **Logic:** The system appears to link call outcomes directly to the "Action Hub" to update Lead PQI scores.

---

## 3. Lead Scoring & Business Intelligence
The "Brain" of the CRM, calculating lead value and providing context.

### **Lead Scoring (PQI - Priority Qualification Index)**
*   **Logic:** `src/hooks/useSignals.js` - Contains logic to calculate scores based on lead behavior and attributes.
*   **Visualization:** 
    *   `src/components/crm/marketing/SignalsMonitor.jsx` - Dashboard view of incoming signals.
    *   `src/components/crm/call-console/SignalsPanel.jsx` - Real-time signal view during calls.
*   **Testing:** `supabase/tests/node/signals_pqi.test.js` - Server-side validation of scoring logic.

### **Business & Gatekeeper Intel**
*   **Lead Cards:** `src/components/crm/call-console/LeadCard.jsx` - Displays aggregated lead info (Owner, Address, History).
*   **B2B Specifics:** 
    *   `src/components/crm/call-console/B2BLeadCaptureForm.jsx` - Specialized fields for commercial leads (Gatekeeper names, Role, etc.).
    *   `src/pages/partners/B2bPartner.jsx` - Landing/management page for B2B relationships.
*   **Property Intel:** `src/components/crm/call-console/PropertyInspectionPanel.jsx` - Likely displays Zillow data, property age, or details relevant to HVAC/Duct service.

---

## 4. AI Copilot & Automation
Features utilizing LLMs or algorithmic logic to assist agents.

### **AI Copilot**
*   **Component:** `src/components/crm/call-console/AiCopilot.jsx` - The UI overlay providing real-time script suggestions or objection handling.
*   **Chat Agents:**
    *   `src/components/KlaireChatWidget.jsx` / `src/lib/klaire-engine.js`: "Klaire" appears to be the customer-facing AI agent.
    *   `src/components/AlphaChatWidget.jsx`: An alternative or internal AI chat interface.
    *   `src/components/diagnostics/LLMChat.jsx`: A diagnostic tool for testing LLM responses.
*   **Marketing AI:** `src/lib/aiMarketing.js` - Utilities for generating marketing copy.

### **Automation**
*   **Workflows:** `src/components/crm/marketing/AutomationPlaybooks.jsx` - Defines "If This Then That" rules for leads (e.g., "If Estimate Sent -> Wait 2 Days -> Send Email").
*   **Service:** `src/services/automationService.js`.

---

## 5. Visual Intelligence (Street View)
Integration for visual verification of properties.

### **Implementation**
*   **Core Utility:** `src/lib/homeImageCache.js` - Implements the "Option 1 Caching Strategy". It fetches Google Street View images based on lead address/coords and caches the URL in Supabase to save API costs.
*   **Usage:** Used within `LeadCard` or `PropertyInspectionPanel` to give technicians/sales reps a visual confirmation of the property type (e.g., "Is this a 2-story house?").

---

## 6. Training Queue & Simulation
Features designed to onboard new staff without affecting live data.

### **Training Mode**
*   **State Management:** `src/contexts/TrainingModeContext.jsx` - Global context that flags all actions as `is_test_data = true`.
*   **UI Controls:** `src/components/TrainingModeToggle.jsx` - Switch in the UI to enter/exit simulation mode.
*   **Data Generation:** 
    *   `src/lib/seedHVACData.js` - Script to populate the database with dummy leads/jobs.
    *   `src/lib/trainingUtils.js` - Helper functions for simulation scenarios.

---

## 7. B2B Rating & Partner Management
Tools for managing high-volume commercial partners.

### **Rating & Volume**
*   **Dashboards:** `src/pages/crm/PartnerVolumeDashboard.jsx` - Analytics on partner performance.
*   **Calculators:** `src/components/partners/VolumeCalculator.jsx` - Likely used to estimate discounts or commissions based on job volume.
*   **Partner Portal:** `src/components/crm/HvacPartnerDashboardPage.jsx` - Specialized view for HVAC partners.

---

## 8. Summary of Relevant File Paths

| Feature Area | Primary Files |
| :--- | :--- |
| **Call Console** | `src/pages/crm/CallConsole.jsx`, `src/components/crm/call-console/*` |
| **Lead Scoring** | `src/hooks/useSignals.js`, `src/components/crm/marketing/SignalsMonitor.jsx` |
| **Street View** | `src/lib/homeImageCache.js` |
| **AI Copilot** | `src/components/crm/call-console/AiCopilot.jsx`, `src/lib/klaire-engine.js` |
| **Training** | `src/contexts/TrainingModeContext.jsx`, `src/lib/seedHVACData.js` |
| **B2B / Partners** | `src/pages/crm/PartnerVolumeDashboard.jsx`, `src/components/crm/call-console/B2BLeadCaptureForm.jsx` |
| **After-Call** | `src/components/crm/call-console/AfterCallLog.jsx`, `src/components/crm/call-console/LogAndActionHub.jsx` |
# Smart Call Console: Architecture & Implementation Overview

**Date:** 2025-12-16  
**System Version:** v2.4.0 (BHF Enterprise)  
**Status:** Audit Completed

---

## 1. Executive Summary
The **Smart Call Console** is the central operational hub for high-volume outbound calling, lead qualification, and appointment setting. It is currently designed as a "Logic & Logging" layer that sits on top of external telephony systems (e.g., cell phones or hardlines). It provides technicians and VAs with AI-assisted scripting, objection handling, and robust logging, but **does not yet** facilitate browser-based VoIP calling directly.

## 2. Component Inventory

### Core Interface
*   **`src/pages/crm/SmartCallConsole.jsx`**: The main entry point. Orchestrates the session state and layout.
*   **`src/components/crm/call-console/ConsoleV2.jsx`**: The primary layout engine, dividing the screen into Lead Context (Left), Scripting/Action (Center), and Signals/History (Right).
*   **`src/components/crm/call-console/NewCallConsole.jsx`**: Legacy wrapper, likely slated for deprecation in favor of V2.

### Functional Modules
*   **`LeadList.jsx`**: Sidebar component for selecting leads from the queue. Includes filtering by `pqi` (Partner Quality Index) and `status`.
*   **`LeadCard.jsx`**: Displays critical lead info (Name, Address, HVAC Age) and initiates the "Call Mode".
*   **`PreCallBrief.jsx`**: AI-generated summary of the lead's history and recommended approach before the call starts.
*   **`AiCopilot.jsx`**: The scripting engine. Uses `openai` (via Edge Functions) to generate dynamic scripts based on the lead's persona and objection handling.
*   **`CallLog.jsx`**: The form used during/after the call to record `outcome`, `sentiment`, and `notes`.
*   **`AfterCallLog.jsx`**: A post-call workflow wizard for sending follow-up SMS/Emails or booking appointments immediately.
*   **`AutomatedActionsModal.jsx`**: Handles "One-Click" automations (e.g., "Send 'Sorry I Missed You' SMS").

### Data & Logic
*   **`src/hooks/useCallLogging.js`**: Manages the timer, state transitions (dialing -> connected -> wrapping up), and database writes.
*   **`src/services/callService.js`**: Service layer interacting with Supabase for fetching history and saving logs.
*   **`src/data/callFormOptions.js`**: Configuration file defining dropdown options for Outcomes (e.g., "Booked", "Left Voicemail") and Call Types.

---

## 3. Current Call Flow Structure

### A. Outbound Workflow (Primary)
1.  **Selection**: User selects a Lead from `LeadList`.
2.  **Briefing**: System displays `PreCallBrief` (calculated from `leads` table data).
3.  **Initiation**: User clicks "Call". 
    *   *Current State*: This triggers a timer and logs a "Call Started" event but relies on the user to dial the phone number manually on their device.
4.  **In-Call Support**:
    *   `AiCopilot` provides a dynamic script.
    *   User can click "Objection" buttons (e.g., "Too Expensive") to get instant AI counter-scripts (fetched from `objections` table).
5.  **Termination**: User clicks "End Call".
6.  **Disposition**: User selects an Outcome (e.g., "Appointment Set").
    *   If "Appointment Set": Opens Scheduling Modal.
    *   If "Left Voicemail": Triggers `marketing_actions` to send an SMS follow-up.

### B. Inbound Workflow
*   **Current State**: Limited.
*   Inbound calls are typically handled by finding the lead manually in `LeadList` and logging a "Manual Call" entry via `manual_call_logs` table.
*   No automated screen-pop or websocket listener is currently active for inbound telephony events.

---

## 4. Script Management & AI Logic

### Script System
*   **Static Scripts**: Stored in `src/data/mockData.js` or `callFormOptions.js` (basic templates).
*   **Dynamic Scripts**: Generated via `supabase/functions/generate-marketing-copy` or `generate-scripts`.
*   **Structure**: Scripts are persona-based (e.g., "Realtor", "Homeowner", "Property Manager").

### AI Response Generation
*   **Integration**: The `AiCopilot` component sends the `lead_id` and `context` to the backend.
*   **Logic**: The backend (Supabase Edge Function) constructs a prompt using the `brand_profile` (Tone, Value Prop) and the Lead's specific data (Age of Home, Previous Service).
*   **Objection Handling**: When a user clicks an objection tag, the system queries the `objections` table for a stored response or generates one if missing.

---

## 5. Supabase Integration Points

### Core Tables
1.  **`calls`**: The session record. Stores `start_time`, `end_time`, `duration`, `agent_id`.
2.  **`call_logs`**: The outcome record. Stores `outcome`, `sentiment_score`, `notes`.
3.  **`leads`**: Read-only source for context; Updated on outcome (e.g., Status changes from 'New' to 'Contacted').
4.  **`objections`**: Knowledge base for the AI Copilot.
5.  **`script_library`**: Stores approved scripts for compliance.

### Edge Functions
*   **`console-save-call`**: Handles the atomic transaction of saving the call + updating the lead status + triggering workflows.
*   **`klaire-chat`**: (Likely) used for the chat-based interface within the console if enabled.

---

## 6. Authentication & Permissions
*   **Auth**: Handled via `src/contexts/SupabaseAuthContext.jsx`.
*   **Access**:
    *   `role = 'admin'` or `'super_admin'`: Full access to all logs and settings.
    *   `role = 'agent'`: Access to assigned leads and the Console UI only.
*   **RLS Policies**:
    *   `calls` table: `Tenant Isolation Select` ensures agents only see calls for their tenant.
    *   `leads` table: Agents can only see leads assigned to them or in the public queue.

---

## 7. Post-Call Automation
*   **Email/SMS**:
    *   Triggered via `AfterCallLog` component.
    *   Writes to `marketing_actions` table (e.g., `action_type = 'sms'`, `status = 'pending'`).
    *   A database trigger (`trigger-email-send`) or cron job processes these actions.
*   **Workflows**:
    *   "No Answer" -> Moves lead to `Attempted_Contact` pipeline stage -> Schedules a callback task.
    *   "Booked" -> Moves lead to `Scheduled` pipeline stage -> Opens Booking Wizard.

---

## 8. Analytics & Tracking
*   **Dashboards**:
    *   `src/pages/crm/CallsPage.jsx`: List view of all historical calls.
    *   `src/pages/testing/HvacCallTrackingDashboard.jsx`: Analytics for specific campaigns.
*   **Metrics**:
    *   Call Duration (tracked in `calls`).
    *   Conversion Rate (Outcome = 'Booked' / Total Calls).
    *   Sentiment Analysis (AI-graded or manually selected in `CallLog`).

---

## 9. Gap Analysis (Missing Features)

### Critical Gaps
1.  **Browser-Based Telephony (VoIP)**:
    *   **Status**: Missing.
    *   **Impact**: Agents must dial manually. Calls cannot be recorded or transcribed automatically.
    *   **Requirement**: Integration with `Twilio Client SDK` or similar WebRTC provider.
2.  **Inbound Call Routing (ACD)**:
    *   **Status**: Missing.
    *   **Impact**: No "screen pop" when a customer calls. Agents rely on caller ID and manual search.
    *   **Requirement**: Websocket listener on `realtime` channels for inbound call events.
3.  **Real-Time Transcription**:
    *   **Status**: Missing.
    *   **Impact**: AI Copilot relies on *pre-call* data, not *live* conversation context.
    *   **Requirement**: Integration with Deepgram or OpenAI Whisper Live.

### Recommended Next Steps
1.  Install `@twilio/voice-sdk`.
2.  Create `src/services/voiceService.js` to handle WebRTC device setup.
3.  Update `ConsoleV2` to support a "Dialpad" UI.
4.  Implement `call_recordings` bucket in Storage for compliance.
# TVG OS Developer Guide & Architecture Notes

This document provides a comprehensive overview of the TVG OS architecture, focusing on the lead management and Call Console v2 systems. It serves as a contract for all future development.

## 1. TVG OS Architecture Overview

The core of our lead management system is a strategic separation between "warm" and "cold" contacts. This separation is crucial for maintaining data quality, targeting sales efforts effectively, and enabling distinct automated workflows.

- **Warm Leads (`leads` table):** This is the primary table for high-value, high-intent contacts.
  - **Source:** Inbound web forms, chatbot captures, direct calls, partner referrals.
  - **Characteristics:** These contacts have explicitly shown interest. They have a higher probability of conversion and are eligible for our full marketing automation and nurturing sequences.
  - **Primary Key:** `id` (uuid)

- **Cold Prospects (`partner_prospects` table):** This table serves as a staging area and primary repository for cold outreach targets.
  - **Source:** Bulk data imports, scraped lists from public sources (e.g., permit filings, industry directories), B2B partnership lists.
  - **Characteristics:** These contacts have *not* expressed interest. The goal is to qualify them via cold outreach (calls, emails) and "convert" them into a warm lead if interest is established. This table is designed for high-volume, low-conversion-rate activities.
  - **Primary Key:** `id` (uuid)

**Core Principle:** NEVER dump raw, un-vetted, or scraped data directly into the `leads` table. Doing so pollutes our primary sales pipeline, skews conversion metrics, and risks sending inappropriate marketing to cold contacts.

---

## 2. Call Console v2 Behavior Contract

The Call Console (`src/pages/crm/CallConsole.jsx`) is a dual-mode system designed to handle both warm and cold contacts efficiently.

### Dual-Mode System

1.  **Inbound Mode:**
    - **Purpose:** To handle scheduled callbacks, follow-ups, and new inbound leads that require immediate attention.
    - **Data Source:** Currently uses `mockLeads` in `src/data/mockData.js`. The future state will query the `leads` table for records matching specific criteria (e.g., `pipeline_stage = 'new_call_needed'`).
    - **UI:** Displays the "Lead Queue" on the left, with each card showing `name`, `company`, `heat`, `score`. The central panel displays `Property Intel`.

2.  **Prospecting Mode:**
    - **Purpose:** To systematically work through the cold outreach list in the `partner_prospects` table. This is our power-dialing engine.
    - **Data Source:** The `partner_prospects` table in Supabase.
    - **UI:** Displays the "Prospecting Queue" on the left, with each card showing `business_name`, `contact_name`, `persona`, `city`, `phone`. The central panel displays "Business Intel".
    - **Lifecycle:**
        - **Fetch:** Loads all `partner_prospects` with `status='new'` into the queue.
        - **Select:** Clicking a prospect card loads it into the main workspace.
        - **Actions (in main workspace):**
            - **No Answer (`attempted`):** Marks the prospect as `attempted` in `partner_prospects`. The prospect is removed from the current queue, and the next one loads.
            - **Not Interested (`do_not_call`):** Marks the prospect as `do_not_call` in `partner_prospects`. The prospect is removed from the current queue, and the next one loads.
            - **Convert to Partner (`converted`):**
                1.  Creates a new entry in the `leads` table with relevant details from the prospect.
                2.  Sets `persona` to `b2b` (or derived from prospect), `source` to `prospect_conversion`, `pipeline_stage` to `new`.
                3.  Marks the prospect as `converted` in `partner_prospects`.
                4.  The prospect is removed from the current queue, and the next one loads.

### Core Shared UI Components

-   **Script Engine:** Central panel, guiding the conversation with dynamic prompts and response options.
-   **Notes Area:** Persistent notes capture for the current call.
-   **AI Copilot Panel:** Right-hand panel providing real-time AI assistance (inferred persona, key intel, suggested talking points).

---

## 3. Script Engine Documentation

The script engine is a state machine defined by the `SCRIPT_FLOW` object in `src/pages/crm/CallConsole.jsx`.

-   **Structure:** Each key in `SCRIPT_FLOW` represents a "node" or state in the conversation flow.
-   **Node Properties:**
    -   `prompt`: The text the agent should say or an instruction.
    -   `persona`: (Optional) The inferred persona of the contact currently speaking (e.g., "DECISION_MAKER", "GATEKEEPER"). Used for AI Copilot.
    -   `options`: An array of possible customer responses, each leading to a `next` node.
    -   `type: "INPUT"`: If present, the node expects a text input from the agent (e.g., for capturing customer details).
    -   `inputType`: "textarea" or "text" for input type.
    -   `inputLabel`: Label for the input field.
    -   `inputKey`: Key to store the input value in the `formData` state.
    -   `isEnd`: Boolean, true if this node signifies the end of a call path, triggering wrap-up.
    -   `disposition`: (Only for `isEnd` nodes) The final call outcome to be logged.

-   **Flow:** Agents navigate the script by clicking customer response options or submitting input. The `scriptHistory` tracks the path, allowing for a "Back" button.
-   **Interpolation:** Prompts use `[PLACEHOLDER]` syntax (e.g., `[CONTACT_PERSONA]`, `[SIGNAL_SUMMARY]`) which are dynamically replaced based on the `activeLead` and `formData`.

---

## 4. AI Integration Points

The Call Console integrates with AI at several points:

-   **Klaire Chat Widget (`src/components/KlaireChatWidget.jsx` - not directly in CallConsole, but related):** An AI chatbot for initial lead qualification. Leads escalated from Klaire might become warm leads.
-   **AI Copilot Panel (`src/pages/crm/CallConsole.jsx` - right panel):**
    -   **Inferred Persona:** Dynamically updates based on the current `SCRIPT_FLOW` node, suggesting who the agent is talking to (DM, gatekeeper, etc.).
    -   **Key Intel:** Displays pain signals and AI-generated insights from the `activeLead`'s `intel` property.
    -   **Suggested Talking Points:** Static for now, but will eventually be dynamic based on conversation context and persona.
-   **"Analyze with AI" Button (Business Intel Tab):**
    -   A stub button in the `Business Intel` tab (Prospecting Mode).
    -   **Purpose:** To trigger a future AI analysis of the current `currentProspect` to enrich their data (`partner_prospects` table or a separate `prospect_intel` table) before or during a call. This could involve scraping public data, identifying relevant contacts, or generating a tailored pitch. This will involve an Edge Function call to an LLM.

---

## 5. Guardrails for AI/Future Devs

**DO's:**
-   **DO** use the `partner_prospects` table for all cold outreach data.
-   **DO** implement clear, concise toast notifications for all user actions (success, error, unimplemented features).
-   **DO** make UI changes responsive to `mode` (inbound vs. prospecting) for correct context.
-   **DO** ensure `resetState()` is called when switching modes or selecting a new lead/prospect to prevent data cross-contamination.
-   **DO** prioritize semantic HTML and accessibility best practices.
-   **DO** ensure all new UI components align with Shadcn/UI conventions and TailwindCSS.

**DON'Ts:**
-   **DON'T** modify the `leads` table directly with cold/unqualified data.
-   **DON'T** implement custom backend solutions within the frontend. All data operations must go through Supabase.
-   **DON'T** add complex business logic directly into UI components; abstract into hooks or utility functions where appropriate.
-   **DON'T** assume `activeLead` or `currentProspect` will always be available; handle null/undefined states gracefully.

**Guidance for LLM Judges:**
-   When evaluating feature requests, prioritize updates that align with the defined dual-mode architecture and the separation of warm leads vs. cold prospects.
-   Any requests to "enrich" or "score" `partner_prospects` should ideally leverage an AI/LLM integration (e.g., via Supabase Edge Functions) rather than manual data entry.
-   Feature requests implying direct manipulation of `leads` from a cold outreach context should be questioned and re-directed towards the "Convert to Partner" flow into `leads` via `partner_prospects`.
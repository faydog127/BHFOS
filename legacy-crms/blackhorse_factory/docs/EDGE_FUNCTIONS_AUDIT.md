# Supabase Edge Functions Audit

This document provides a detailed audit of the Edge Functions currently visible in the codebase.

## 1. `calls`
*   **Path**: `supabase/functions/calls/index.ts`
*   **Purpose**: Handles the logging of call records for the Call Console. It accepts call details (lead ID, duration, disposition, etc.), validates the input, and saves the record. It also contains logic to automatically update a lead's status from 'OPEN' to 'IN_PROGRESS' upon a successful call log.
*   **Tables Accessed**:
    *   `calls` (INSERT): Creates the call log record.
    *   `leads` (SELECT, UPDATE): Checks current status and updates to 'IN_PROGRESS' if applicable.
*   **External APIs**: None.
*   **Security**: Checks against a CORS whitelist of allowed origins (Production, Console, Localhost).

## 2. `execute-sql`
*   **Path**: `supabase/functions/execute-sql/index.ts`
*   **Purpose**: Acts as a secure, controlled gateway to execute predefined SQL scripts via a Postgres RPC function (`execute_sql`). It is primarily used for seeding database content (Brand Profile, Services, Objections) from the frontend "Brand Brain" loader without exposing raw SQL execution capabilities.
*   **Tables Accessed**:
    *   *Indirectly via SQL Scripts:*
    *   `brand_profile` (UPSERT)
    *   `services` (UPSERT)
    *   `objections` (UPSERT)
*   **External APIs**: None.

## 3. `klaire-chat`
*   **Path**: `supabase/functions/klaire-chat/index.ts`
*   **Purpose**: The backend engine for the "KLAIRE" AI chatbot. It retrieves the company's brand profile, constructs a system prompt for the AI persona, sends the conversation history to OpenAI, and logs the resulting interaction.
*   **Tables Accessed**:
    *   `brand_profile` (SELECT): Fetches knowledge base data to inform the AI's context.
    *   `klaire_chat_logs` (INSERT): specific table for auditing AI chat sessions.
*   **External APIs**: **OpenAI API** (`chat.completions.create`, model: `gpt-3.5-turbo`).

## 4. `leads`
*   **Path**: `supabase/functions/leads/index.ts`
*   **Purpose**: A centralized, secure HTTP endpoint for ingesting leads from external sources or public forms. It implements transactional logic to Upsert a `Contact` record first, then create a `Lead` record linked to it. It also handles phone number normalization (E.164) and basic persona assignment logic.
*   **Tables Accessed**:
    *   `contacts` (SELECT, UPDATE, INSERT): Manages the underlying person entity.
    *   `leads` (INSERT): Creates the specific lead/opportunity record.
*   **External APIs**: None.
*   **Security**: Strict origin whitelist and validation of required fields.

## 5. `submit-form`
*   **Path**: `supabase/functions/submit-form/index.ts`
*   **Purpose**: A general-purpose handler for simple web form submissions (e.g., "Contact Us" page). It performs less validation than the `leads` endpoint and is designed for generic message capture.
*   **Tables Accessed**:
    *   `submissions` (INSERT): Stores raw form data with a default status of 'New'.
*   **External APIs**: None.

---
*Note: Additional functions may be deployed to the Supabase project (e.g., `generate-brief`, `send-template`) but their source code is not currently present in the local environment.*
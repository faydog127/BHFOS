# Custom Hooks Audit

This document provides an overview of the custom React hooks located in `src/hooks/`.

## 1. usePartnerProspects.js

This file contains a collection of hooks for managing Partner Prospect data, utilizing React Query for state management and caching.

### `usePartnerProspects(filters)`
*   **Type**: Query Hook
*   **Purpose**: Fetches a list of partner prospects based on applied filters.
*   **Supabase Interaction**:
    *   **Table**: `partner_prospects`
    *   **Operation**: `SELECT *`
    *   **Filters Applied**:
        *   `status` (exact match)
        *   `persona` (exact match)
        *   `search` (ILIKE match against `business_name`, `contact_name`, or `email`)
    *   **Ordering**: `created_at` descending (newest first).

### `usePartnerProspect(id)`
*   **Type**: Query Hook
*   **Purpose**: Retrieves full details for a specific prospect.
*   **Supabase Interaction**:
    *   **Table**: `partner_prospects`
    *   **Operation**: `SELECT *`
    *   **Condition**: `id` equals provided argument.

### `useNextPartnerProspect()`
*   **Type**: Query Hook
*   **Purpose**: Implements the "Next in Queue" logic for the Call Console. It retrieves the oldest "new" prospect to ensure First-In-First-Out (FIFO) calling order.
*   **Supabase Interaction**:
    *   **Table**: `partner_prospects`
    *   **Operation**: `SELECT *`
    *   **Conditions**:
        *   `status` = 'new'
        *   `ORDER BY created_at ASC` (Oldest first)
        *   `LIMIT 1`

### `useUpdateProspectStatus()`
*   **Type**: Mutation Hook
*   **Purpose**: Updates a prospect's status (e.g., to 'contacted') and modifies other fields like notes.
*   **Supabase Interaction**:
    *   **Table**: `partner_prospects`
    *   **Operation**: `UPDATE`
*   **Side Effects (Cache Invalidations)**:
    *   `['partnerProspects', 'list']`: Refreshes main lists.
    *   `['partnerProspects', 'queue', 'next']`: Refreshes the queue to pull the next lead.
    *   Updates the specific prospect's detail cache immediately with the response data.

---

## 2. useSignals.js

*   **Status**: File exists in codebase but content is currently hidden/read-only in this context.
*   **Inferred Purpose**: Based on the filename and usage in `SignalsPanel.jsx`, this hook likely manages the fetching and interpretation of "buying signals" or "intent signals" for leads (likely interacting with `leads`, `smart_trigger_rules`, or specific signal tables).
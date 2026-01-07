# Custom Hooks Audit

## src/hooks/usePartnerProspects.js
This file contains a collection of hooks for managing Partner Prospect data, utilizing React Query for state management and caching.

### `usePartnerProspects(filters)`
*   **Type**: Query Hook
*   **Purpose**: Fetches a list of partner prospects based on applied filters.
*   **Supabase Interaction**: 
    *   Table: `partner_prospects`
    *   Operation: `SELECT *`
    *   Filters: `status`, `persona`, and `search` (ILIKE on name/email).

### `usePartnerProspect(id)`
*   **Type**: Query Hook
*   **Purpose**: Retrieves full details for a specific prospect.
*   **Supabase Interaction**:
    *   Table: `partner_prospects`
    *   Operation: `SELECT * WHERE id = ?`

### `useNextPartnerProspect()`
*   **Type**: Query Hook
*   **Purpose**: Implements "Next in Queue" logic for the Call Console (FIFO).
*   **Supabase Interaction**:
    *   Table: `partner_prospects`
    *   Operation: `SELECT * WHERE status = 'new' ORDER BY created_at ASC LIMIT 1`

### `useUpdateProspectStatus()`
*   **Type**: Mutation Hook
*   **Purpose**: Updates a prospect's status and notes.
*   **Supabase Interaction**:
    *   Table: `partner_prospects`
    *   Operation: `UPDATE`
*   **Side Effects**: Invalidates 'list' and 'queue' queries to refresh UI.

---

## src/hooks/useSignals.js

### `useSignals(orgName, leadId)`
*   **Type**: Custom Hook (uses `useState`, `useEffect`)
*   **Purpose**: Manages the fetching and acquisition of "Signals" (intelligence) for a lead.
*   **Supabase Interaction**:
    *   Table: `signals` (assumed existing based on query)
    *   Operation: `SELECT *`
    *   Edge Function: Invokes `acquire-signals` to generate new data.
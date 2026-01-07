# Schema Relationship Audit: Leads & Estimates

## 1. Diagnostics Summary
**Status:** 🔴 CRITICAL AMBIGUITY DETECTED  
**Issue:** Circular Foreign Key dependency between `leads` and `estimates` tables.  
**Error Code:** `PGRST201` (Ambiguous relationship)

## 2. Findings
Upon searching the schema definitions, functions, and system constraints, the following relationships were identified:

### A. Direct Relationships (The Conflict)
1.  **`estimates.lead_id` → `leads.id`**
    *   **Type:** Foreign Key
    *   **Purpose:** Standard "One Lead has Many Estimates" relationship.
    *   **Status:** ✅ Correct / Canonical.
2.  **`leads.estimate_id` → `estimates.id`**
    *   **Type:** Foreign Key (Inferred from error & function usage)
    *   **Purpose:** Denormalized reference to a "Primary" or "Latest" estimate.
    *   **Status:** ❌ **PROBLEMATIC**. Creates a circular graph that confuses PostgREST when performing joins (e.g., `leads(*, estimates(*))`).

### B. Dependent Functions
The following functions explicitly rely on the problematic `leads.estimate_id` column:
*   `public.get_kanban_board_data(data_mode)`: Uses `l.estimate_id` to display estimate numbers on Kanban cards.

### C. Related Tables
*   `quotes.estimate_id` → `estimates.id`: Links quotes to their parent estimate.
*   `jobs.estimate_id` → `estimates.id`: Links converted jobs to the original estimate.
*   `work_orders.estimate_id` → `estimates.id`: Links work orders to the estimate.

## 3. Resolution Plan
To resolve the `Ambiguous relationship` error while preserving frontend functionality:

1.  **Update `get_kanban_board_data`**: Refactor the SQL function to derive the `estimate_id` dynamically (fetching the most recently created estimate for the lead) instead of reading a hardcoded column on the lead record.
2.  **Drop `leads.estimate_id`**: Remove the redundant column and its Foreign Key constraint to break the circular dependency loop.

*This report was generated automatically by Horizons System Audit.*
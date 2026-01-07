
# Migration Log Template

Use this template for every database schema change or significant data transformation.
Store files in `docs/migrations/YYYYMMDD_MigrationID.md`.

## Metadata
*   **Migration ID:** `MIG-YYYY-MM-DD-001`
*   **Date:** 202X-XX-XX
*   **Owner:** [Developer Name / GitHub Handle]
*   **Status:** `PENDING` | `STAGED` | `APPLIED` | `ROLLED_BACK`
*   **Related Ticket:** [JIRA-123 / GH-456]

## Description
*Briefly describe the purpose of this migration. Why is it needed? What does it solve?*

## Impact Analysis
*   **Risk Level:** `LOW` | `MEDIUM` | `HIGH` | `CRITICAL`
*   **Downtime Required:** Yes / No
*   **Affected Tables:** `users`, `orders`, `inventory`
*   **Data Volume:** [e.g., ~50,000 rows affected]

## Files Touched
*   `supabase/migrations/202XMMDD_description.sql`
*   `src/lib/database.types.ts`
*   `src/components/AffectedComponent.jsx`

## Execution Plan (UP)
1.  [ ] Backup database via Supabase Dashboard.
2.  [ ] Run pre-migration check script: `npm run db:check`
3.  [ ] Execute SQL:
    
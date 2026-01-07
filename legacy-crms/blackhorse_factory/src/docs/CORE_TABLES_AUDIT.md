# Core Tables Audit Report

**Date:** 2025-12-10  
**Scope:** `app_user_roles` (detected typo: user query `app_users_roles`), `global_config`

## 1. Executive Summary
The core authentication and configuration tables are healthy. No circular dependencies or ambiguity traps were detected. The table name queried (`app_users_roles`) appears to be a typo; the actual system table is `app_user_roles`.

## 2. Table Analysis

### Table: `app_user_roles`
*   **Status:** ✅ Exists (as `app_user_roles`)
*   **Columns:** `id` (UUID), `user_id` (UUID), `role` (Text), `created_at` (Timestamp)
*   **Foreign Keys:**
    *   `user_id` → `auth.users(id)` (Standard Supabase Auth linkage).
*   **Ambiguity/Graph Issues:** None. This table is a leaf node in the schema graph (it references `auth.users`, but `auth.users` does not reference it back in a way that causes join confusion).
*   **References in Codebase:**
    *   **RLS Policies:** Used heavily for permission checks (e.g., "Admins can manage config").
    *   **Functions:**
        *   `admin_delete_user`: Checks for admin role.
        *   `admin_update_role`: Updates the role.
        *   `get_all_users_with_roles`: Joins this table to list users.
        *   `handle_new_user`: Inserts initial role (viewer) on signup.
        *   `migrate_production_to_testbed`: Security check.

### Table: `global_config`
*   **Status:** ✅ Exists
*   **Columns:** `id` (UUID), `key` (Text), `value` (Text), `updated_at` (Timestamp)
*   **Foreign Keys:** None.
*   **Ambiguity/Graph Issues:** None. Completely isolated table used for key-value storage.
*   **References in Codebase:**
    *   **RLS Policies:** references `app_user_roles` to ensure only admins can write to it.
    *   **Functions:** None explicitly found in the function list, but likely used via direct client queries in `src/lib/brandConfig.js` or similar.

## 3. Potential Risks & Mitigations
*   **Infinite Recursion Risk:** The RLS policy on `global_config` queries `app_user_roles`. If `app_user_roles` had a policy that queried `global_config`, it would cause an infinite loop (Stack Overflow).
    *   **Current Status:** ✅ Safe. `app_user_roles` policies are self-contained or reference `auth.uid()`, breaking any potential loops.
*   **Typos:** The pluralization `app_users_roles` vs `app_user_roles` is a common developer error.
    *   **Recommendation:** Ensure all frontend queries strictly use `app_user_roles`.

## 4. Conclusion
The Core Foundation tables are structurally sound. The ambiguity issues seen in the `leads` <-> `estimates` relationship do not exist here.

*Audit completed by Horizons System.*
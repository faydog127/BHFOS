# Software Factory Documentation

## Overview
This directory contains the core logic for the application's module system and software factory architecture. The system is designed to be modular, scalable, and audit-ready.

### Structure
- `modules.js`: Defines the atomic blocks of functionality (`modules`). Each module has a unique ID, status, required database tables, and dependencies.
- `manifests/`: Contains configuration files that compose modules into specific system architectures (e.g., `blackhorse.js`).
- `README.md`: This documentation.

## How to Add Features
1.  **Define Module**: Add a new entry to `MODULES` in `src/build/modules.js`.
    *   **id**: Unique string identifier.
    *   **name**: Display name.
    *   **description**: Short description.
    *   **tables**: Array of Supabase table names required by this module.
    *   **dependencies**: Array of other module IDs that must exist for this one to work.
2.  **Update Manifest**: Add the new module to the active manifest (e.g., `src/build/manifests/blackhorse.js`) to enable it in the build.
3.  **Run Audit**: Visit `/crm/settings/SystemDiagnostics` (System Health Console) to see the new module appear. It will likely show as "Degraded" until you create the required tables.

## Status Legend
The `SystemHealth.jsx` console uses the following statuses:

*   **Healthy (Green)**: All required tables exist, and all dependencies are healthy.
*   **Degraded (Red)**: Missing tables or broken dependencies.
    *   *Missing Tables*: The database schema does not match the module definition.
    *   *Broken Dependencies*: A required module is either missing from the manifest or is itself degraded.

## Safety Rules
1.  **Never delete `modules.js` or manifests** without a backup plan. These files drive the system's self-awareness.
2.  **Database Sync**: The `checkTable` utility performs a live check against Supabase. If you add a table to a module definition, you MUST create it in Supabase for the module to be healthy.
3.  **Prescription SQL**: The System Health Console provides "Repair SQL" templates. **Review these carefully**. They are generic templates. You should customize columns and types before running them in production.
4.  **Dependencies**: Avoid circular dependencies. Module A cannot depend on Module B if Module B depends on Module A.

## Build Console Access
Access to the System Health Console is restricted to users with `admin`, `owner`, or `manager` roles in the `app_user_roles` table. This prevents unauthorized users from inspecting system architecture.
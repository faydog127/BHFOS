# Current Git Tags & Branches Inventory

**Generated Date:** 2025-12-16
**Source of Truth:** `src/config/version.js` & `docs/RELEASE_NOTES.md`

## 1. Active Tags
*   **`v2.5.0`** (Latest Stable) - "Horizon" Release. Features: Smart Call Console, Partner Portal, System Doctor.
*   **`v2.4.9`** - Pre-freeze stable build.
*   **`v2.0.0`** - "Foundation" Release (Initial CRM Core).
*   **`v1.0.0`** - MVP (Locked per `TVG_OS_v1.0_IMPLEMENTATION_COMPLETE.md`).

## 2. Active Branches
*   **`main`**: Currently aligned with `v2.5.0` state.
*   **`develop`**: Development staging area. Contains experimental features:
    *   AI Voice Agents (Klaire) integration.
    *   QuickBooks 2-Way Sync (Beta).
*   **`feature/system-doctor-v2`**: Merged into `main` for v2.5.0.
*   **`feature/call-hunter`**: Merged into `main` for v2.5.0.

## 3. Versioning Strategy
We adhere to Semantic Versioning (`MAJOR.MINOR.PATCH`):
*   **MAJOR**: Breaking changes or massive architectural shifts (e.g., v3.0 for Offline Mode).
*   **MINOR**: New features in a backward-compatible manner (e.g., v2.6 for new Inventory Module).
*   **PATCH**: Backward-compatible bug fixes (e.g., v2.5.1 for hotfixes).

## 4. Configuration
The current runtime version is injected via `src/config/version.js`:
# Code Freeze Protocol (v2.5.0)

## 1. Objective
The goal of this protocol is to maintain the stability of the v2.5.0 release ("Horizon") while allowing for critical bug fixes. No new features are to be merged into the `main` or `release/v2.5` branch until the freeze is lifted.

## 2. Freeze Rules

### ✅ Allowed Changes (Hotfixes)
*   **Security Patches:** Critical vulnerabilities (CVSS > 7.0).
*   **Data Loss Prevention:** Bugs causing data corruption or loss.
*   **Blockers:** Issues preventing users from logging in or completing a primary workflow (e.g., Booking a Job).
*   **Text/Copy:** Minor typos that impact brand reputation.

### ❌ Prohibited Changes
*   **New Features:** No new UI components, pages, or modules.
*   **Refactoring:** No code cleanup or architectural changes, even if they improve performance, unless they solve a specific Blockers bug.
*   **Dependency Upgrades:** No upgrading `npm` packages unless required for a Security Patch.

## 3. Hotfix Process
1.  **Identify:** Issue is reported and verified.
2.  **Branch:** Create a branch from the freeze tag: `hotfix/v2.5.1-issue-description`.
3.  **Fix:** Apply the minimal necessary code change.
4.  **Verify:** Test *only* the affected area and immediate regressions.
5.  **Merge:** Merge into `main` and tag as `v2.5.x`.
6.  **Document:** Update `docs/CHANGELOG.md` with the hotfix details.

## 4. Future Development (v2.6+)
*   All new feature development must occur on separate `feature/` branches.
*   These branches **must not** be merged until the Code Freeze is officially lifted by the Release Manager.

## 5. Emergency Rollback
If v2.5.0 proves unstable in production:
1.  Consult `docs/DEPLOYMENT_SNAPSHOT.md` to identify the previous stable commit.
2.  Execute the rollback via the hosting provider (Vercel/Netlify/etc).
3.  Notify all stakeholders via the internal status page.
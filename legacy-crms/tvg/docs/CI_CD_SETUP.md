# CI/CD Automation Setup Guide

This project uses **GitHub Actions** for Continuous Integration and Continuous Deployment.

## 1. Workflows Overview

### A. Pull Request Checks (`.github/workflows/pr-checks.yml`)
*   **Trigger:** Pull Request to `develop` or `main`.
*   **Jobs:**
    1.  `lint`: Runs `npm run lint`.
    2.  `test`: Runs `npm run test`.
    3.  `build-dry-run`: Runs `npm run build` to ensure buildability.

### B. Production Deploy (`.github/workflows/deploy-prod.yml`)
*   **Trigger:** Push to tag `v*` (e.g., `v2.5.0`).
*   **Jobs:**
    1.  `test`: Run critical test suite.
    2.  `deploy-frontend`: Deploy artifacts to Vercel/Netlify.
    3.  `create-release`: Generate GitHub Release with changelog from `docs/RELEASE_NOTES_vX.X.X.md`.

## 2. Sample Workflow Configuration

Create `.github/workflows/pr-checks.yml`:
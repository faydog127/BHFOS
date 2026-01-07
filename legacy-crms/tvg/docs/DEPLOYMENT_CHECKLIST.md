# Deployment Checklist

**Project:** BHF CRM
**Target Environment:** Production

## 1. Pre-Deployment (Staging)
*   [ ] **Code Freeze:** Confirm `main` branch is locked and tagged.
*   [ ] **Lint & Test:** Run `npm run lint` and `npm run test` with 100% pass rate.
*   [ ] **Build Verification:** Run `npm run build` locally to ensure no compilation errors.
*   [ ] **Dependency Audit:** Run `npm audit` to check for critical security vulnerabilities.
*   [ ] **Database Migration Dry-Run:** Execute migration scripts against a copy of the production DB (or Staging).
*   [ ] **Asset Optimization:** Ensure all new images in `public/` are compressed.

## 2. Deployment Phase
*   [ ] **Backup:** Trigger a manual backup snapshot in Supabase Dashboard.
*   [ ] **Environment Variables:** Verify all new `.env` keys (Secrets) are added to the hosting provider (Vercel/Netlify).
*   [ ] **Deploy Backend:** Deploy Supabase Edge Functions (`supabase functions deploy`).
*   [ ] **Deploy Database:** Apply migrations (`supabase db push`).
*   [ ] **Deploy Frontend:** Push to `main` to trigger CI/CD pipeline.

## 3. Post-Deployment (Verification)
*   [ ] **Health Check:** Visit `/system-doctor` and run a "Deep Scan". Score must be > 90.
*   [ ] **Critical Path Test:**
    1.  Create a test lead.
    2.  Convert to Job.
    3.  Generate Invoice.
    4.  Verify email notification receipt.
*   [ ] **Error Monitoring:** Watch Supabase Logs for spikes in 500 errors.
*   [ ] **Visual Check:** Verify layout on Mobile (iOS/Android) and Desktop (Chrome/Safari).

## 4. Emergency Procedures
*   [ ] **Rollback Criteria:** If Critical Path fails or Error Rate > 1%, initiate Rollback.
*   [ ] **Communication:** Notify stakeholders via Slack `#ops-alerts`.
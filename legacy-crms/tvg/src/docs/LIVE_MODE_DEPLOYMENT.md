# Live Mode Deployment Guide

**Objective:** Final steps to go live with the system for actual business operations.

## Prerequisites
- [ ] Completed `LIVE_MODE_CHECKLIST.md`.
- [ ] All staff have user accounts.
- [ ] Database backup confirmed.

## Step 1: API Configuration
Ensure your `supabase/functions/.env` or Supabase Secrets are set with **LIVE** keys (not test keys) for:
- [ ] **Stripe:** `STRIPE_SECRET_KEY` (Live key starts with `sk_live_...`)
- [ ] **Twilio:** `TWILIO_AUTH_TOKEN` (Live Account SID)
- [ ] **Resend/Email:** `RESEND_API_KEY`

## Step 2: System Activation
1. **Log in** as the Administrator.
2. **Toggle Mode:** Switch the header toggle to **Live Mode**.
3. **Verify:** Yellow banner is gone. Green "Live" shield is visible.

## Step 3: The "Golden Transaction" Test
Perform one real end-to-end flow with a personal credit card to verify the pipes are connected.
1. Create a Lead (yourself).
2. Schedule a Job.
3. "Complete" the Job in the Tech Portal.
4. Generate an Invoice ($1.00).
5. **Pay the Invoice** using a real credit card.
   - [ ] Verify Stripe dashboard shows the $1.00 transaction.
   - [ ] Verify CRM shows "Paid".
   - [ ] Verify you received the receipt email.
6. **Refund** the $1.00 transaction via Stripe Dashboard (optional but recommended).
7. **Archive** the test lead/job to keep metrics clean.

## Step 4: Monitoring (First 24 Hours)
- [ ] Monitor **Edge Function Logs** in Supabase for any errors.
- [ ] Check **CRM > Reporting** to ensure new leads are attributing correctly.
- [ ] Ask technicians to report any "Missing Jobs" (usually caused by being in the wrong mode).

## Rollback Plan
If major issues occur:
1. Send immediate broadcast to staff: "Stop using CRM."
2. Switch back to **Training Mode** if the issue is data-related.
3. Restore database from backup if data corruption occurred (unlikely with mode separation).
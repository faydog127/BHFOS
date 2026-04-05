# 07_appendixA_exec5_verification_and_lock.md

## Purpose
Execute **Appendix A — Phase A-EXEC-5 (Verification & Lock)** and capture the evidence required to mark Appendix A “implemented”.

Operator control files:
- `docs/reconciliation/lock/appendix-a/index.md`
- `docs/reconciliation/A_LOCK_CHECKLIST.md`

Appendix A lock package:
- `docs/reconciliation/lock/appendix-a/`

## Preconditions
- Docker Desktop running (Linux engine) and `docker ps` works.
- Supabase CLI available (`supabase` or `%USERPROFILE%\\.supabase\\bin\\supabase.exe`).
- Run from `c:\\BHFOS\\command-center`.

If you see `open //./pipe/dockerDesktopLinuxEngine: Access is denied`, start Docker Desktop and/or run an elevated PowerShell once to start the Docker Desktop Service.

## Automated Smoke Checks (Local)

### 1) Money Loop Smoke Test (quote view → accept → invoice view → pay)
Command:
```powershell
pwsh -NoProfile -File .\scripts\money-loop-smoke-test.ps1
```

Expected evidence in output (DB prints + assertions):
- ✅ Job created for accepted quote; `jobs.status` is `UNSCHEDULED`
- ✅ Events exist for the quote/invoice/job, including:
  - `QuoteViewed`
  - `HumanSignalReceived`
  - `QuoteAccepted`
  - `JobCreated`
  - `InvoiceViewed`
  - `PaymentSucceeded`
  - `InvoicePaid`
- ✅ `automation_suspensions` rows exist for `quote` and `invoice` after view events
- ✅ Lead transitions to `status = paid` after payment (asserted)
- ✅ Invoice follow-up tasks are closed after payment (asserted)
- ✅ Receipt handling is recorded (`ReceiptSent` event exists; asserted; in `payments_mode=mock` this is logged as “suppressed” not delivered)

### 2) Now Queue Smoke Test (quote view creates follow-up + suspension)
Command:
```powershell
pwsh -NoProfile -File .\scripts\now-queue-smoke-test.ps1
```

Expected evidence in output:
- ✅ Quote follow-up task exists
- ✅ `now_queue` includes the quote follow-up with higher priority than non-money tasks
- ✅ Quote suspension exists
- ✅ No job is created (since approval isn’t called)

## Manual UX Verification (UI Alignment)
Target: `Website\\command-center` (Next.js UI).

### A) UNSCHEDULED jobs surfaced
- Open tenant dashboard and jobs pages.
- Confirm UNSCHEDULED jobs are visible and explicitly require scheduling.

### B) Manual Convert works (and does NOT mark lead PAID)
- Open a lead detail page.
- Use “Manual Convert” and provide a reason.
- Confirm `contacts.is_customer=true` and `contacts.manual_convert_reason` set.
- Confirm lead is not marked paid by this action.

### C) Automation Suspended is visible and actionable
- After viewing a public quote/invoice link, open the lead/dashboard UI.
- Confirm the “Automation Suspended” section shows the suspension(s) and allows resuming (sets `resumed_at`).

## Stop Gate A-LOCK (Mark Appendix A Implemented)
When all checks above pass:
- Record the run output (or paste key DB query results) in your internal notes.
- Mark Appendix A as “implemented” and unblock Appendix B execution.

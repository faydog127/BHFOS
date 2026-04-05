# A-LOCK Checklist

Status date: 2026-03-19
Scope: Appendix A closeout control file
Authority: subordinate to `Product Charter/POS/*` and the Appendix A lock gate in `07_appendixA_exec5_verification_and_lock.md`

Primary lock package:

- `docs/reconciliation/lock/appendix-a/index.md`

## Purpose

Use this file as the operator-owned Appendix A closeout checklist.

Rules:
- If it does not produce proof, it does not count.
- If it is not written, it is not real.
- If it is not decided, it is a blocker.

## Status Legend

- `GREEN` = implemented and already proven enough to rely on
- `PARTIAL` = exists, but still needs definition, broader proof, or doctrine cleanup
- `OPEN` = required and not yet complete
- `DECISION REQUIRED` = governance call must be made before A-LOCK

## Evidence Location

Store all closeout artifacts under:

- `docs/reconciliation/lock/appendix-a/`

Recommended naming:

- `EV-YYYY-MM-DD_money-loop-smoke.md`
- `EV-YYYY-MM-DD_automation-run.md`
- `EV-YYYY-MM-DD_manual-ux.mp4`
- `SN-YYYY-MM-DD_appendix-a-lock-summary.md`

## Execution Order

1. Automation integrity
2. Governance decisions
3. Minimum event model
4. Verification and evidence capture
5. Documentation truth pass
6. Lock Appendix A

## 1. Must Implement

### Automation Integrity

- [ ] Invoice reminder ladder
  - Owner: Backend / Automation
  - Blocks to: Verification, Lock
  - Proof artifact: recorded run showing initial send, follow-up ladder, and stop on payment
  - Current status: `GREEN`

- [ ] Business-hours guard across all auto-safe outbound touches
  - Scope: quote reminders, invoice reminders, appointment reminders, and any deferred safe outbound message
  - Owner: Backend / Automation
  - Blocks to: Verification, Lock
  - Proof artifact: recorded run showing after-hours block plus deferred execution at the next valid window
  - Current status: `GREEN`

### Job-State Doctrine

- [ ] Final Appendix A job-state model decided and enforced
  - Option A: `UNSCHEDULED -> SCHEDULED -> COMPLETED`
  - Option B: current system mapped and justified as Appendix A equivalent
  - Owner: Product / Architecture
  - Blocks to: Documentation, Lock
  - Proof artifact: `docs/reconciliation/lock/appendix-a/decisions/DR-2026-03-18_job-state-doctrine.md`
  - Current status: `DECISION REQUIRED`

### Minimum Event Model

- [ ] Appendix A minimum event set defined and emitted
  - Required v1 event set:
    - Quote: `QuoteSent`, `QuoteViewed`, `QuoteAccepted`
    - Job: `JobCreated`, `JobScheduled`, `JobCompleted`
    - Invoice: `InvoiceSent`, `InvoiceViewed`, `InvoicePaid`
    - Payment: `PaymentSucceeded`, `PaymentFailed`
    - Automation: `AutomationSuspended`, `AutomationResumed`
  - Owner: Backend / Architecture
  - Blocks to: Verification, Documentation, Lock
  - Proof artifact: event list doc plus sample logs proving emission
  - Current status: `PARTIAL`

## 2. Must Verify

- [ ] Money Loop smoke run formally captured
  - Scope: quote -> invoice -> payment -> close, including automation effects
  - Owner: QA / Founder
  - Blocks to: Lock
  - Proof artifact: `docs/reconciliation/lock/appendix-a/evidence/EV-2026-03-18_money-loop-smoke.md`
  - Current status: `OPEN`

- [ ] Automation / now-queue behavior formally captured
  - Scope: reminder ladder, delayed execution, business-hours handling
  - Owner: QA / Backend
  - Blocks to: Lock
  - Proof artifact: `docs/reconciliation/lock/appendix-a/evidence/EV-2026-03-18_automation-run.md`
  - Current status: `PARTIAL`
  - Note: invoice, quote, and appointment reminder lanes are locally proven; formal lock-stage evidence is still pending

- [ ] Manual UX walkthrough formally captured
  - Scope: real operator path with no dev shortcuts
  - Owner: Founder
  - Blocks to: Lock
  - Proof artifact: `docs/reconciliation/lock/appendix-a/evidence/EV-2026-03-18_manual-ux.md`
  - Current status: `OPEN`

- [ ] Evidence pack assembled
  - Scope: all recordings, logs, timestamps, and closeout notes gathered in one place
  - Owner: QA / Founder
  - Blocks to: Lock
  - Proof artifact: indexed evidence set in `docs/reconciliation/lock/appendix-a/index.md`
  - Current status: `OPEN`

## 3. Must Document

- [ ] Appendix A reconciliation docs refreshed to current truth
  - Files:
    - `04_reconciliation_map_appendixA_A2.md`
    - `05_assumption_verification_report.md`
    - `06_prioritized_execution_plan.md`
  - Owner: Product / Founder
  - Blocks to: Lock
  - Proof artifact: diff showing removed outdated claims and updated statuses
  - Current status: `OPEN`

- [ ] Money Loop schema and relationships documented well enough to defend Appendix A
  - Scope: quotes, jobs, invoices, payments, tasks/events relationships
  - Owner: Architecture
  - Blocks to: Lock
  - Proof artifact: schema note or diagram
  - Current status: `OPEN`

- [ ] Edge function responsibility map documented
  - Scope: trigger, responsibility, constraints, and what each function must not do
  - Owner: Backend
  - Blocks to: Lock
  - Proof artifact: responsibility matrix doc
  - Current status: `OPEN`

- [ ] Event model documented
  - Scope: event types, emitters, dependencies
  - Owner: Architecture
  - Blocks to: Lock
  - Proof artifact: event model doc
  - Current status: `OPEN`

- [ ] Final job-state decision documented and conflicting assumptions removed
  - Owner: Product
  - Blocks to: Lock
  - Proof artifact: `docs/reconciliation/lock/appendix-a/decisions/DR-2026-03-18_job-state-doctrine.md` + cleaned reconciliation docs
  - Current status: `DECISION REQUIRED`

## 4. Must Decide

- [ ] `send-estimate` contract-gates scope resolved
  - Option A: included in Appendix A lock and therefore implemented, enforced, and verified
  - Option B: explicitly deferred and removed from implicit Appendix A scope
  - Owner: Product / Founder
  - Blocks to: Lock
  - Proof artifact: `docs/reconciliation/lock/appendix-a/decisions/DR-2026-03-18_send-estimate-scope.md`
  - Current status: `DECISION REQUIRED`

## 5. Lock

- [ ] Execute `07_appendixA_exec5_verification_and_lock.md` end to end
  - Owner: Founder
  - Blocks to: Appendix B execution
  - Proof artifact: completed lock doc + attached evidence
  - Current status: `OPEN`

- [ ] Mark Appendix A as `IMPLEMENTED AND LOCKED`
  - Owner: Founder
  - Blocks to: Appendix B execution
  - Proof artifact: updated lock doc and status note
  - Current status: `OPEN`

- [ ] Remove stop gate and formally unblock Appendix B
  - Owner: Founder
  - Blocks to: Appendix B execution
  - Proof artifact: updated docs reflecting A-LOCK
  - Current status: `OPEN`

## Current Snapshot

- `GREEN`: core money loop path, live Stripe path, receipt path, Schedule trust chain
- `GREEN`: invoice reminder ladder
- `GREEN`: business-hours enforcement across quote + invoice + appointment reminder automation is locally proven, automation-run evidence
- `OPEN`: formal evidence pack, truth-pass documentation
- `DECISION REQUIRED`: job-state doctrine, `send-estimate` contract-gates scope

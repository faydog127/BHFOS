# EV-2026-03-18 Flow Trace Quote Job Invoice Payment

Status: CAPTURED (local)
Owner: QA / Founder

## Scope

Canonical Appendix A flow with identifiers and timestamps.

## Trace

- Local run (2026-04-04)
  - Money loop smoke (quote -> approve -> invoice -> pay):
    - Evidence log: `tmp/money-loop-smoke-test_latest.log`
    - Run ID: `smoke-20260404_114824`
    - Quote: `3566dcdb-a482-4f49-8a3c-0d3fd5e0aa99`
    - Job: `13df892c-6b49-438e-8b88-8ed65d746f34`
    - Invoice: `5914c624-7b4e-40c7-9338-41cf3c162abd`
  - Now-queue smoke (quote view -> follow-up tasks + suspension; no approval; no job):
    - Evidence log: `tmp/now-queue-smoke-test_latest.log`
    - Run ID: `nowqueue-20260404_114833`
    - Lead: `d895675b-5ab7-4777-ad48-313c5a9a0d16`
    - Quote: `41ffcced-c673-4630-8162-b940a403e760`

## Result

- PASS (local)
- Quote view created:
  - follow-up tasks (`crm_tasks`)
  - automation suspension (`automation_suspensions`)
  - now-queue entries (`now_queue`)
- Quote approval created exactly one job for the quote (idempotent accept path)
- Payment succeeded and post-conditions asserted by script (paid invoice, closed tasks, receipt event)

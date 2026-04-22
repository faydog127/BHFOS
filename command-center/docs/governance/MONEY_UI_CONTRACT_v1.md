# Money UI — Contract (v1)

Purpose: define the minimum viable “Money” surface so the CRM can answer:
- what we are owed (AR)
- what we have collected (cash in)
- what we have spent (cash out + job costs)
- profitability per job and per customer (LTV-directional)

This contract is intentionally narrow (v1). It defines UI and traceability requirements, not accounting/GL correctness.

Dependencies:
- `docs/governance/CRM_UI_SYSTEM_CONTRACT_v1.md`

## 0) Scope (v1)

In scope:
- outstanding invoices (AR) and aging
- payments received (cash in) and attribution to invoices
- job costs (cash out) attributed to work orders/jobs
- a dashboard that summarizes: collected, outstanding, spent, margin (directional)

Out of scope (v1):
- full GL, chart of accounts, journal entries
- payroll correctness
- inventory accounting

## 1) Traceability (non-negotiable)

Every money event must link to its source record(s):
- Payment/Receipt → Invoice → Work Order → Estimate
- Vendor/Subcontractor Expense → Work Order (and optionally the vendor)

If an ID exists, it must be clickable.

## 2) Outstanding invoices (AR)

Minimum (v1):
- list of invoices with:
  - invoice id
  - customer
  - amount due
  - due date / age bucket
  - status (draft/sent/overdue/paid/partial)
- total outstanding amount and totals by age bucket

## 3) Job costs (spend per job)

Minimum (v1):
- on a Work Order, a “Costs” section that supports:
  - materials
  - subcontractor (e.g. HVAC sub-out)
  - misc expenses
- costs roll up into per-job spend and directional margin:
  - (invoice total) - (job spend) = directional margin

## 4) Customer value (LTV-directional)

Minimum (v1):
- customer page must display:
  - total invoiced
  - total collected
  - outstanding balance
  - count of estimates / work orders / invoices

Non-goal (v1):
- predictive LTV. This is historical rollup + directional visibility.


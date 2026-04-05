# Charter Job-State Doctrine vs Live BHFOS Model

Status: Working analysis only. Superseded for lock governance by `docs/reconciliation/lock/appendix-a/decisions/DR-2026-03-18_job-state-doctrine.md`
Date: 2026-03-18
Owner: Product / Architecture

Use the decision record in the Appendix A lock package as the authoritative A-LOCK artifact.

## Purpose

Resolve the mismatch between the thinner Appendix A wording and the richer live BHFOS scheduling model.

This document is the bridge between:
- the charter's minimal Appendix A lifecycle abstraction
- the live dispatch model already implemented in BHFOS

## Decision Summary

Recommended decision:

- Accept the current live BHFOS job model as Appendix A-equivalent.
- Do not collapse the system back to a narrower `UNSCHEDULED -> SCHEDULED -> COMPLETED` implementation.
- Ratify a two-layer model:
  - `dispatch status` is the authoritative writable execution state
  - `operational stage` is the derived command/reporting state
- Keep `payment_status` as a financial layer, not a dispatch-state substitute.

## Why This Is The Right Move

The live system already has an explicit pre-scheduled state and a richer execution lifecycle than the older Appendix A reconciliation docs assumed.

Current evidence:
- Quote approval creates jobs with `status = 'unscheduled'` in `supabase/functions/public-quote-approve/index.ts`.
- Writable job statuses already include:
  - `unscheduled`
  - `pending_schedule`
  - `scheduled`
  - `en_route`
  - `in_progress`
  - `on_hold`
  - `completed`
  - `cancelled`
  in `supabase/functions/work-order-update/index.ts`, `src/pages/crm/Jobs.jsx`, and `src/pages/crm/Schedule.jsx`.
- The system already derives a broader operational layer in:
  - `supabase/migrations/20260314113000_add_work_order_operational_projection.sql`
  - `src/lib/workOrderOperational.js`

This means the problem is no longer missing lifecycle depth.

The real problem is doctrine clarity:
- `status`, `operational_stage`, and `payment_status` are not yet ratified sharply enough
- `pending_schedule` needs a hard meaning
- older Appendix A docs still imply a thinner model than the live system now uses

## The Two-Layer Model

### 1. Dispatch Status

Dispatch status is the authoritative writable execution state.

Allowed statuses:
- `unscheduled`
- `pending_schedule`
- `scheduled`
- `en_route`
- `in_progress`
- `on_hold`
- `completed`
- `cancelled`

Use this layer for:
- Schedule board behavior
- Jobs page actions
- dispatch save paths
- overlap protection
- stale-write protection
- operational transition rules

### 2. Operational Stage

Operational stage is the derived command/reporting layer.

Allowed stages:
- `unscheduled`
- `pending_schedule`
- `scheduled`
- `en_route`
- `in_progress`
- `invoice_draft`
- `invoiced`
- `paid`
- `cancelled`

Use this layer for:
- Hub / command-center rollups
- overdue reasoning
- next-action labels
- commercial progression after execution

### 3. Payment Status

Payment status remains a financial layer only.

Use this layer for:
- paid vs unpaid vs partial financial truth
- receipt/payment logic
- invoice reconciliation

Do not use it as a substitute for dispatch status.

## Charter Mapping

The charter's minimal Appendix A lifecycle should be interpreted as an abstraction, not as a requirement to downgrade the live model.

| Charter abstraction | Live BHFOS mapping | Meaning |
|---|---|---|
| `UNSCHEDULED` | `unscheduled`, `pending_schedule` | Work exists but is not yet calendar-committed |
| `SCHEDULED` | `scheduled`, `en_route`, `in_progress` | Work is committed to execution or actively underway |
| `COMPLETED` | `completed` | Field execution is complete |
| Exception branch | `on_hold`, `cancelled` | Operational exceptions outside the minimal happy-path abstraction |
| Commercial progression | `invoice_draft`, `invoiced`, `paid` | Money-loop stages layered on top of dispatch completion |

## Pending Schedule Doctrine

`pending_schedule` must not remain a vague holding bucket.

Definition:
- the job exists
- the operator intends to schedule it
- the job cannot yet be calendar-committed because of an unresolved dependency

Allowed reasons include:
- waiting on customer confirmation
- waiting on access details
- waiting on prerequisite information needed for a committed slot
- waiting on an operational dependency that blocks booking

`pending_schedule` is not:
- generic backlog
- a synonym for `unscheduled`
- a "come back later" bucket with no explicit reason

Operational rule:
- any job in `pending_schedule` should have a clear next action or blocking reason visible to the operator

## What This Means For Appendix A

Appendix A should be ratified against the current live model, not against an older thinner wording.

That means:
- do not rebuild the scheduling model just to match an older three-state description
- do explicitly document the live semantic layers
- do remove older Appendix A claims that say `UNSCHEDULED` is missing
- do treat the richer live model as the certified Appendix A execution model

## Recommended Documentation Changes

The Appendix A truth pass should update the reconciliation docs so they no longer imply:
- `UNSCHEDULED` is absent from the live system
- the system lacks a pre-scheduled state
- the dispatch lifecycle is still placeholder-grade

The docs should instead say:
- the live system has a richer dispatch status model than the original Appendix A shorthand
- the charter three-state chain is now treated as a minimal abstraction
- the certified live model is the two-layer model documented here

## What Still Needs To Be Proven

This doctrine decision does not remove the remaining A-LOCK blockers.

Those remain:
- reminder ladder
- business-hours enforcement
- minimum event model
- formal verification pack
- truth-pass documentation

## Recommendation

Adopt this decision for A-LOCK:

- keep the live model
- certify it explicitly
- sharpen `pending_schedule`
- map the charter abstraction to the richer live lifecycle
- remove old ambiguity everywhere

This preserves operational truth, avoids unnecessary churn, and gives Appendix A a lockable doctrine that matches where BHFOS actually is and where it is going.

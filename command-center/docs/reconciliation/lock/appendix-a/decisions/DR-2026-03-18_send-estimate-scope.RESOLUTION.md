# DR-2026-03-18 Send-Estimate Scope — Planning Resolution

Status: **RECOMMENDED EXPLICIT DEFER** (pending Founder yes on planning-correction packet)  
Parent: `DR-2026-03-18_send-estimate-scope.md`  
Phase: ML-P1 planning correction — **docs only**

## Resolution

**Explicitly defer** `send-estimate` out of ML-P1 quote→pay lock and out of **implicit** Appendix A lock scope.

## Deferral rationale (specific)

- `send-estimate` is a **customer-communication** surface with its own contract gates, templates, and failure modes.
- ML-P1 Phase 1 lock proves **accept → job → invoice → payment/receipt** integrity and evidence, which can proceed via already-issued quotes without requiring send-estimate completion.
- Leaving send-estimate “implied” blocks A-LOCK ambiguously; explicit defer removes that blocker without pretending the feature is done.

## What remains required

- Canonical `quotes` path and approval immutability still apply to whatever quote is accepted.
- A future packet may **include** send-estimate in a later lock slice with its own gates.

## What is forbidden by this deferral

- Claiming A-LOCK complete **because** send-estimate is “close enough.”
- Expanding Phase 1 implementation into send-estimate without a new Founder authorization.

## Completion test

A-LOCK / ML-P1 docs state send-estimate = **deferred**; no checklist item treats send-estimate as required for Phase 1 USABLE; separate DR/packet required to re-include.

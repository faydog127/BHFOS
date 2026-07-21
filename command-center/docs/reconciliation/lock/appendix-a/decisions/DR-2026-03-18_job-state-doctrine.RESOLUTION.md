# DR-2026-03-18 Job-State Doctrine — Planning Resolution

Status: **RECOMMENDED RATIFY** (pending Founder yes on planning-correction packet)  
Parent: `DR-2026-03-18_job-state-doctrine.md`  
Phase: ML-P1 planning correction — **docs only**

## Resolution

**Ratify** the draft decision: accept the current live BHFOS **two-layer** job model as Appendix A-equivalent.

- **Dispatch status** = authoritative writable execution state  
- **Operational stage** = derived command/reporting state  
- Do **not** collapse product into `UNSCHEDULED → SCHEDULED → COMPLETED` only  

## Bounded Phase 1 implication

Phase 1 implementation (when separately authorized) must document the **subset** of transitions used by the quote→pay path and enforce them server-side. Full field FSM expansion remains out of Phase 1 unless required for that path.

## Completion test

Truth-pass / A-LOCK docs cite two-layer model; no Appendix A claim that live system lacks pre-scheduled/dispatch richness; P1 Money-State Design Contract §8 aligned.

# DR-2026-03-18 Job-State Doctrine

Status: Draft for ratification at A-LOCK
Owner: Product / Architecture

## Context

The live system already has a richer scheduling lifecycle than the older Appendix A wording assumed.

## Decision

Accept the current live BHFOS job model as Appendix A-equivalent. Do not collapse the product into a narrower `UNSCHEDULED -> SCHEDULED -> COMPLETED` implementation.

## Compensating Control

Until this decision is ratified by the truth-pass documentation, no Appendix A doc may claim that the live system lacks a pre-scheduled state.

## Impact

Appendix A certification should document a two-layer model:
- dispatch status = authoritative writable execution state
- operational stage = derived command/reporting state

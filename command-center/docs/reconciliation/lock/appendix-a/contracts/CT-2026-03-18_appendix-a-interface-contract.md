# CT-2026-03-18 Appendix A Interface Contract

Status: Draft
Owner: Architecture

## Purpose

Define what downstream appendices may rely on from the Appendix A implementation.

## Approved Contract Surface

### Dispatch

- `status`
- `scheduled_start`
- `scheduled_end`
- `service_address`
- `technician_id`

### Operational Projection

- `operational_stage`
- `operational_sort`
- `due_at`
- `is_overdue`
- `overdue_reason`
- `next_action_label`

### Financial

- invoice progression
- payment status
- paid vs unpaid truth

### Events

- downstream appendices may only rely on the final ratified minimum event model

## Forbidden Assumptions

- unresolved `send-estimate` contract-gate behavior
- any Appendix A field or event not explicitly named here

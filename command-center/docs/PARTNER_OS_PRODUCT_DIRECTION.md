# BHFOS Partner OS — Product Direction

| Field | Value |
| --- | --- |
| Status | Draft product-line direction |
| Date | 2026-08-22 |
| Product | Partner OS |
| Implementation authority | None |

## Purpose

Partner OS is the BHFOS product for Service Partners: service companies that need to run their own operations effectively.

Partner OS inherits the existing BHFOS service-company work as its development foundation and may continue to improve independently of Network OS.

## Core operating problem

Partner OS should help a Service Partner manage demand, customers, estimates, scheduling, dispatch, field execution, inspections, evidence, reports, invoicing, payments, recurring service, reviews, retention, communications, business performance, and controlled automation.

## Independence principle

Partner OS must remain useful as a complete service-company operating product even when the Service Partner receives no work from Network OS.

Network OS must not become a required dependency for normal Partner OS operation.

## Integration end state

The stated BHFOS product-family end state is:

**Partner OS ↔ Network OS**

When a Service Partner uses Partner OS and participates in a Network OS-managed network, authorized work may eventually move from Network OS into the Service Partner's normal Partner OS workflow. Appropriate acceptance, schedule, status, completion, evidence, financial, and exception information may return to Network OS through controlled contracts.

Integration does not imply shared ownership of internal records. Partner OS remains authoritative for the Service Partner's internal business operations; Network OS remains authoritative for the managed-network/customer coordination record.

## Service Partner terminology

The standard BHFOS term for a service company participating in a managed network is **Service Partner**. Legacy use of `provider` may remain in existing code or historical artifacts until deliberately migrated.

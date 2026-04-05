# Command Center Architecture Baseline

## Purpose
This document is the source of truth for how the CRM app is structured and how code changes must be implemented.

## Update Note (Docs-only)
Updated: 2026-04-05

- This update reflects current Phase 0 locks (P0-01/P0-02) and the actual authority surfaces in the repo.
- No runtime behavior is changed by this document.

## Core Principles
1. Mobile-first, desktop-capable: critical workflows must be executable from a phone.
2. Single write authority: mutations flow through domain services, not UI components.
3. Tenant-safe by default: every query and mutation is tenant-scoped.
4. Small, durable contracts: status values and transitions are explicit and enforced.
5. Gated change delivery: small sprint slices with PASS/FAIL UAT gates.

## Required Request Flow
1. `UI` (web/mobile shell)
2. `API endpoint` (validation + auth + tenant context)
3. `Domain service` (business rules + idempotency)
4. `Database` (constraints + RLS + events)

No direct UI-to-database writes for business mutations.

## Canonical Route Ownership
1. `App.jsx` is the canonical route tree.
2. CRM routes live under `/:tenantId/crm/*`.
3. Legacy route trees must not be used as independent entry points.

## Domain Services
1. `CRMService`
   - Customer, lead, and contact lifecycle.
2. `OperationsService`
   - Job lifecycle and dispatch lifecycle transitions.
3. `BillingService`
   - Invoice lifecycle, payment recording, and money-loop integrity.

## Data Authority
1. `jobs` stores job lifecycle state.
2. `job_assignments` stores scheduling/dispatch authority.
3. `invoices` and payment records store billing authority.
4. `public.events` stores audit + automation event history.
5. `idempotency_keys` prevents duplicate writes/retries.

## Billing / Money Authority Surfaces (Current)
These are the canonical money-path primitives introduced/locked in P0-02:

- `transactions` (ledger entries)
- `transaction_applications` (settlement mapping: transaction → invoice)
- `stripe_webhook_events` + `record_stripe_webhook_payment(...)` (canonical webhook ingestion: dual idempotency + settlement)
- `public_payment_attempts` (public-pay initiation-only attempts; not settlement)
- `reconciliation_queue` / `reconciliation_alerts` / `p0_02e_run_sweep(...)` (detective + recovery router; not a settlement engine)

Non-negotiable boundary:
- Settlement truth is derived from `transaction_applications` for successful transactions.
- Public-pay initiation must create **0** `transactions` and **0** `transaction_applications`.

## Public Token Endpoint Tenant Boundary (P0-01)
For public token flows (public quote/invoice/pay):

- Tenant context must be derived from the token-bound record server-side.
- Request-supplied `tenant_id` is optional only for validation; mismatch must reject.
- No fallback/default tenant (e.g., `tenant_id || 'tvg'`) is allowed in these public paths.

## ServiceContext Contract
Every write operation receives:
1. `tenant_id`
2. `actor_id`
3. `actor_type` (`owner` or `system`)
4. `idempotency_key`
5. `request_id`
6. `device_type` (`mobile` or `desktop`)
7. `override_reason` (nullable)

## Enforcement Requirements
1. Status values must match [`STATUS_CONTRACTS.md`](c:\BHFOS\command-center\STATUS_CONTRACTS.md).
2. All new schema work must be migration-driven, reversible, and tenant-safe.
3. All external retry-prone writes (payments, webhooks, sends, lifecycle actions) must be idempotent.
4. Every lifecycle-changing write emits a domain event.

## Operational Target
A solo operator can run:
1. Lead/customer updates
2. Scheduling/dispatch changes
3. Job execution and reporting
4. Invoice send and payment follow-up

from a phone without returning to a desktop for standard work.

# Domain Map

## Goal
Keep ownership clear so logic does not get duplicated across UI, helpers, and RPC calls.

## Update Note (Docs-only)
Updated: 2026-04-05

- This update reflects current Phase 0 locks (P0-01/P0-02) and the actual authority surfaces in the repo.
- No runtime behavior is changed by this document.

## Domains
| Domain | Primary Owner | Owns Writes | Reads | Emits Events | Primary Tables |
| --- | --- | --- | --- | --- | --- |
| CRM | `CRMService` | Lead/customer/contact lifecycle | Customers, leads, jobs summary | `lead_created`, `customer_updated` | `customers`, `leads`, related contact tables |
| Operations | `OperationsService` | Job lifecycle transitions | Jobs, attachments, notes | `job_created`, `job_started`, `job_completed`, `job_cancelled` | `jobs`, job notes/files |
| Dispatch/Scheduling | `OperationsService` (scheduling module) | Assignment creation/reschedule/dispatch state | Jobs + technician availability | `assignment_created`, `assignment_rescheduled`, `dispatch_status_changed` | `job_assignments`, availability tables |
| Billing | `BillingService` | Invoice lifecycle + canonical money writer surfaces | Invoices, ledger projections | `invoice_created`, `invoice_sent`, `payment_recorded`, `payment_failed` | `invoices`, `transactions`, `transaction_applications`, `public_payment_attempts`, `stripe_webhook_events`, `reconciliation_alerts` |
| Messaging | `BillingService` + send pipeline | Invoice/report sends and delivery logs | Email logs/templates | `email_sent`, `email_failed` | `email_logs`, template tables |
| Auth/Tenant | Auth middleware + RLS | Session/tenant authorization controls | Session + tenant membership | `auth_session_restored` (optional) | auth/session tables, tenant membership tables |

## Ownership Rules
1. A domain may read cross-domain data, but only the owning service writes domain state.
2. UI components can request actions, but cannot enforce final lifecycle rules.
3. Cross-domain effects use events, not hidden side effects inside UI code.

## Billing Domain Authority (P0-02)
Canonical money-path rules (do not violate):

- Initiation vs settlement:
  - `public_payment_attempts` records initiation attempts (public-pay).
  - Settlement truth is derived from `transaction_applications` for successful transactions.
- Canonical “final money effect” writer:
  - `record_stripe_webhook_payment(...)` (dual idempotency + concurrency-safe settlement)
- Reconciliation tooling:
  - `reconciliation_queue` is the operational list.
  - `reconciliation_alerts` uses deterministic `alert_key` (no operator spam).
  - `p0_02e_run_sweep(...)` verifies cold state and routes recovery through the canonical pipeline (it does not patch invoice totals as a “fix”).

## Mobile-First Action Set (Must Be Supported)
1. Create/search customer
2. Create/schedule/reschedule job
3. Start/complete/cancel job with notes/photos
4. Generate/send report package
5. Create/send invoice and confirm payment state

## Out of Scope for Field Startup Path
1. Heavy analytics dashboards
2. Nonessential admin views
3. Large calendar spans on first render

These can load after the field shell is interactive.

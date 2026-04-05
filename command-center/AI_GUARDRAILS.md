# AI Guardrails (Autonomous Micro-Sprint Workflow)

## Sprint Model
1. Scope is locked to 1-2 tickets per sprint.
2. No new ticket starts until previous sprint is `PASS`.
3. Handoff must include build/smoke evidence and UAT checklist.
4. User returns explicit `PASS` or `FAIL`.

## Non-Negotiable Implementation Rules
1. No direct business writes from UI components.
2. All mutations go through domain services with `ServiceContext`.
3. All write operations must be tenant-scoped.
4. Retry-prone operations must be idempotent.
5. Status values must match [`STATUS_CONTRACTS.md`](c:\BHFOS\command-center\STATUS_CONTRACTS.md).
6. Risky behavior changes must be feature-flagged.
7. No production writes during sprint development unless explicitly requested.

## Data and Migration Rules
1. Schema changes must be migration-driven.
2. Each migration includes:
   - forward SQL
   - rollback SQL or explicit rollback procedure
   - post-migration validation query
3. Avoid destructive data changes without explicit approval.

## Reliability Rules
1. Blocking startup/loading states must have timeout + retry.
2. Avoid infinite spinners in auth/tenant/startup gates.
3. Service errors must be structured (`code`, `message`, optional `details`).

## Money Loop Rules
1. One canonical pay-link generation path.
2. One canonical invoice send path.
3. Every send attempt is logged (`email_logs` or equivalent).
4. Payment state changes are confirmed via authoritative billing flow/webhook.

## Required Sprint Artifacts
1. [`docs/SPRINT_HANDOFF_TEMPLATE.md`](c:\BHFOS\command-center\docs\SPRINT_HANDOFF_TEMPLATE.md)
2. [`docs/UAT_PASS_FAIL_TEMPLATE.md`](c:\BHFOS\command-center\docs\UAT_PASS_FAIL_TEMPLATE.md)

## Stop-The-Line Conditions
1. Cross-tenant data exposure risk.
2. Duplicate money movement risk (double charge/double payment record).
3. Status contract drift (`Scheduled` vs `scheduled`, etc.).
4. Any migration that cannot be safely rolled back.

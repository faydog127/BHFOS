# PR Checklist (Micro-Sprint)

## Contract and Scope
1. [ ] Scope matches approved sprint goal (no hidden extras).
2. [ ] Out-of-scope changes are excluded or explicitly documented.
3. [ ] Status values conform to [`STATUS_CONTRACTS.md`](c:\BHFOS\command-center\STATUS_CONTRACTS.md).

## Architecture Guardrails
1. [ ] No direct UI business writes to DB.
2. [ ] Mutations routed through service layer.
3. [ ] Tenant scope enforced on reads/writes.
4. [ ] Idempotency applied to retry-prone writes.

## Data Safety
1. [ ] Migration added (if schema changed).
2. [ ] Rollback path documented.
3. [ ] Validation query included.

## Quality Gates
1. [ ] Build passes.
2. [ ] Relevant tests/smokes pass.
3. [ ] Startup/loading error paths have retry behavior.

## Handoff Completeness
1. [ ] Handoff doc completed from template.
2. [ ] UAT checklist provided.
3. [ ] Go/No-Go recommendation included.

# ADR-DEC-V2-014 — Review Board Authority and n8n Integration

**Status:** Active architecture authority; planning and controlled design only  
**Date:** 2026-08-05  
**Decision owner:** Founder  
**Founder approval:** Explicit approval recorded 2026-08-05  
**Repository baseline:** `faydog127/BHFOS` `main@33790e1e7af83917bfd961f16b3e395850faed5c`  
**Implementation authority:** None; no migrations, application code, production changes, release activation, or n8n activation authorized

## Context

BHFOS has approved n8n as the orchestration layer for controlled development. The Review Board proof of concept can invoke OpenAI and write a Drive artifact, but it does not yet create authoritative BHFOS request/run records, atomically reserve provider actions, authenticate request-scoped callbacks, or preserve a human decision inside BHFOS.

The repository already uses Supabase PostgreSQL, Auth, RLS, Edge Functions, Storage, server-owned RPCs, append-only audit events, and additive migrations. V2 is a dedicated single-company TVG platform, and current governance prohibits implementation until a requirement and release are active.

## Decision

When implementation is separately authorized, the Review Board will use this boundary:

1. `review_requests` is the aggregate root in Supabase PostgreSQL.
2. BHFOS owns request creation, idempotency, claims, leases, state transitions, provider-action reservations, artifacts, costs, reconciliation, and human decisions.
3. Edge Functions are thin authenticated transport/adapters. Transactional RPC/domain services own mutations.
4. n8n may execute only a claimed run and may call a provider only after BHFOS returns `authorized_new` for the exact provider action.
5. n8n reports progress/results through request-scoped authorization. It never writes authoritative tables directly.
6. Review artifacts use BHFOS UUIDs allocated before storage/provider writes. Private Supabase Storage is the first adapter; Drive is optional secondary delivery.
7. Multi-model reviewers are blind and independent. Deterministic checks run before AI adjudication. No model can make the final business decision.
8. `tenant_id text` is retained for TVG context integrity and compatibility only; the design introduces no tenant selection, provisioning, or shared-company runtime.

## Status model

Business and orchestration status remain separate. A successful model panel produces `awaiting_decision` / `waiting_human`; only an authorized human decision produces the terminal business disposition and closes orchestration as `completed`.

## Authentication decision

- User endpoints: verified Supabase user JWT plus subject/object authorization.
- n8n service: purpose-specific service identity.
- Request mutation: short-lived request-scoped authorization bound to tenant, request, run, attempt, workflow, digest, permitted operation/transition, expiry, and nonce.
- Controlled-development bridge: a static service credential may establish service identity, but database services must still enforce exact object, attempt, digest, state, and action authorization.
- Production: static-key-only callback authorization is prohibited.

## Transaction decision

The database must provide atomic functions for:

- same-key/same-digest request replay and same-key/different-digest rejection;
- one live run claim;
- one provider-action reservation per logical action;
- dispatch certainty and `unknown` outcomes;
- accepted/rejected callbacks using expected record versions;
- late callback reconciliation;
- append-only human decisions.

Process-local JavaScript maps, n8n execution history, and provider idempotency alone do not satisfy concurrency control.

## Consequences

### Positive

- n8n can be replaced without losing authoritative state.
- simultaneous duplicate requests cannot create duplicate model calls or artifacts when constraints/RPCs are correctly implemented.
- provider-success/callback-failure becomes reconcilable.
- human authority and AI provenance are durable and queryable.
- the design follows the repository's strongest MIL and money-loop patterns.

### Costs

- More database and API work precedes the visible multi-model workflow.
- A watchdog/reconciler and request-scoped token mechanism are required.
- Model calls have additional reservation/callback latency.
- Environment and revision compatibility must be managed across Supabase, Hostinger, and n8n.

### Risks

- Broad `SECURITY DEFINER` grants could bypass RLS if checks drift.
- `verify_jwt = false` copied from legacy functions would undermine the callback boundary.
- Hosted schema drift could invalidate migration assumptions.
- Using `tenant_id` as a product abstraction could conflict with DEC-V2-012.

## Rejected alternatives

| Alternative | Reason rejected |
|---|---|
| n8n owns review records | Violates BHFOS system-of-record boundary |
| n8n writes tables with `service_role` | Excess privilege; bypasses narrow domain contracts |
| Drive file is the review record | No authoritative state, transition, or object authorization |
| Browser directly creates runs/findings/decisions | Fragments business logic and enables forged state |
| One static callback key authorizes every request | Compromise permits arbitrary object/state mutation |
| One giant Edge Function owns all logic | Harder to test and duplicates transactional rules outside Postgres |
| Shared multi-tenant abstraction | Outside the active TVG-only V2 product boundary |

## Implementation gate

This architecture is recorded as DEC-V2-014 and traced to REQ-V2-001. It authorizes planning and controlled design only. Code remains blocked until an active Release ID, work item, branch/worktree, validation plan, and the remaining Definition of Ready controls exist under the [V2 Definition of Ready and Done](https://github.com/faydog127/BHFOS/blob/main/command-center/docs/v2/V2_DEFINITION_OF_READY_AND_DONE.md).

## Evidence

- [BHFOS Architecture Baseline](https://github.com/faydog127/BHFOS/blob/main/command-center/ARCHITECTURE.md)
- [BHFOS Domain Map](https://github.com/faydog127/BHFOS/blob/main/command-center/DOMAIN_MAP.md)
- [V2 Decision Register](https://github.com/faydog127/BHFOS/blob/main/command-center/docs/v2/V2_DECISION_REGISTER.md)
- [Inspection AI review migration](https://github.com/faydog127/BHFOS/blob/main/command-center/supabase/migrations/20260710143000_inspection_ai_review.sql)
- [MIL access-session migration](https://github.com/faydog127/BHFOS/blob/main/command-center/supabase/migrations/20260725130000_media_intel_access_sessions.sql)

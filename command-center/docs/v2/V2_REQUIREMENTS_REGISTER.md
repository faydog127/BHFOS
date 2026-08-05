
# BHFOS V2 — Requirements Register

| Field | Value |
| --- | --- |
| Status | Draft |
| Version | 0.2 |
| Owner | Founder |
| Last reviewed | 2026-08-05 |
| Implementation authority | Draft register; not yet ratified |

## Purpose

Record approved, deferred, rejected, and discovered requirements with traceability to releases, decisions, data classification, work items, and validation evidence.

## Register status

No V2 requirement is authorized for implementation until it has a Requirement ID, an active Release ID, applicable Decision IDs, acceptance criteria, and a recorded Definition of Ready assessment.

## Required fields

Each requirement entry must include: ID, statement, product area, status, source, owner, data touched and classification, applicable decisions, release, acceptance criteria, validation evidence, and disposition history.

## REQ-V2-001 — Authoritative Review Board control layer before n8n execution

| Field | Value |
| --- | --- |
| Status | Approved — planning and controlled design only |
| Date registered | 2026-08-05 |
| Product area | Platform governance / AI orchestration |
| Owner | Founder |
| Source | Founder approval recorded 2026-08-05; repository discovery and approved architecture decision |
| Applicable decisions | DEC-V2-001, DEC-V2-003, DEC-V2-008, DEC-V2-009, DEC-V2-012, DEC-V2-013, DEC-V2-014 |
| Release | None; implementation not authorized |
| Work item | None; planning record only |
| Architecture record | [ADR-DEC-V2-014](./ADR-DEC-V2-014_REVIEW_BOARD_AUTHORITY_AND_N8N_INTEGRATION.md) |
| Implementation authority | None |

### Requirement statement

BHFOS shall create authoritative, single-company Review Board request and run records with atomic idempotency, claims and leases, provider-action reservations, append-only audit evidence, reconciliation, artifact identity, cost and provenance records, and human-decision boundaries before n8n performs authoritative Review Board work.

n8n shall coordinate claimed execution, provider calls, retries, waiting, and exception routing through narrow BHFOS contracts. It shall not become the database, policy authority, financial authority, final decision-maker, or sole audit record.

### Data and handling

| Control | Requirement |
| --- | --- |
| Data touched | Future review requests, source artifacts, runs, findings, decisions, provider actions, model/prompt versions, costs, execution metadata, and audit events |
| Classification | Internal by default; Confidential for unpublished product or business content; Restricted when source material contains customer PII, property media, credentials, or other restricted data |
| Access | Least privilege; authenticated users by approved role and purpose-specific orchestration identities only |
| Storage | Authoritative records in BHFOS-controlled Supabase/PostgreSQL; private BHFOS artifact storage first; external providers or Drive only as controlled adapters |
| Retention and deletion | Must be defined before implementation by classification, business need, security evidence need, and legal/contractual obligation; append-only decision/audit evidence may not be silently rewritten |
| Logging | Redacted operational and forensic evidence only; no secrets, raw credentials, unrestricted prompt payloads, or unnecessary Restricted data |
| Screenshots, fixtures, and tests | Synthetic or specifically authorized redacted data only |
| AI prompts | Minimum necessary content; Restricted data requires explicit authorization and approved provider/data-handling controls |

### Acceptance criteria

- BHFOS is the system of record for requests, runs, states, artifacts, findings, provider actions, audit evidence, costs, and human decisions.
- Request creation and replay use atomic same-key/same-digest idempotency and reject conflicting digests.
- Only one valid live claim exists per run, with controlled lease expiry, heartbeat, timeout, and reconciliation behavior.
- Each paid or externally consequential provider action requires an atomic BHFOS reservation before dispatch.
- Provider success with callback failure is recorded as uncertain and reconciled before retry.
- n8n callbacks use purpose-specific identity plus request/run/action-scoped authorization; broad static-key-only or direct `service_role` table writes are prohibited beyond any explicitly bounded controlled-development bridge.
- AI outputs pass deterministic schema and policy checks; independent reviewer provenance is retained; no model can record the final human decision.
- Append-only audit events record accepted and rejected transitions without retaining secrets or unnecessary Restricted payloads.
- TVG context integrity is preserved without tenant selection, tenant provisioning, or shared-company product scope.
- Contract, authorization, RLS, concurrency, idempotency, partial-success, timeout, reconciliation, cost-control, prompt-injection, and hosted acceptance tests are defined and pass in an authorized non-production environment before production consideration.

### Validation evidence

Current evidence is planning-only: repository discovery, ADR-DEC-V2-014, the approved orchestration standard, the approved domain/contract specification, and the draft OpenAPI and non-production test plan. Implementation evidence does not yet exist and may not be claimed.

### Dependencies and blockers

- Active Release ID: missing by design; no release activation authorized.
- Definition of Ready assessment: incomplete.
- Authorized non-production Supabase environment: not selected.
- Scoped service-token mechanism, provider credentials/models, budgets, retention schedule, and artifact adapter: require later controlled design or implementation authorization.
- The unpublished multi-model n8n proof of concept remains separate and cannot satisfy this requirement by itself.

### Disposition history

| Date | Disposition | Authority | Notes |
| --- | --- | --- | --- |
| 2026-08-05 | Approved for entry into the V2 Requirements Register | Founder | Planning and controlled design only; migrations, application coding, production changes, release activation, and n8n activation remain unauthorized |


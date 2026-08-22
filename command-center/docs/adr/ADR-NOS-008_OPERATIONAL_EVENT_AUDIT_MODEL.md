# ADR-NOS-008 — Operational Event & Audit Model

**Status:** Active — founder ratified 2026-08-22
**Date:** 2026-08-22  
**Decision owner:** Founder  
**Product:** Network OS  
**Implementation authority:** None; architecture decision only

**Ratification evidence:** `../NETWORK_OS_RELEASE1_SLICE1_FOUNDER_RATIFICATION_PACKET.md`

## Context

Network OS must preserve enough history to explain what happened across customer relationships, Service Needs, work coordination, Service Partner responses, exceptions, and later SLA/performance metrics.

The copied foundation already contains audit/event patterns, but Network OS needs a clear distinction between business-operational events and security/forensic audit evidence. Using one undifferentiated log for both would either overexpose sensitive data or fail to provide usable business history.

## Decision

Network OS will maintain two related but distinct event classes:

1. **Operational Events** — business-domain events used to reconstruct customer, demand, coordination, and performance history.
2. **Security / Administrative Audit Events** — privileged, security-relevant, configuration, authorization, and forensic evidence.

A domain state change may produce both when appropriate, but the two purposes remain distinct.

## Operational event requirements

An operational event should preserve, where applicable:

- unique event identity;
- event type;
- occurred-at time;
- recorded-at time when materially different;
- actor type and actor identity or system source;
- source channel/adapter;
- related authoritative domain object(s);
- structured outcome/reason metadata;
- correlation/request identity where useful;
- prior/new state reference where appropriate without duplicating unnecessary payloads.

Operational events must support later derivation of at least:

- relationship contact/visit history;
- Service Need creation and status progression;
- time to assignment;
- time to first offer;
- Service Partner response time;
- first-match acceptance;
- time to schedule;
- completion/review cycle times;
- exception counts and aging.

## Audit requirements

Security/administrative audit evidence should preserve actions such as:

- permission/role changes;
- qualification approvals/rejections;
- high-impact overrides;
- restricted-data access where policy requires;
- configuration/policy changes;
- integration credential/service-identity changes;
- rejected privileged actions where material;
- release/environment administrative actions where applicable.

Audit logs must not become a dumping ground for raw customer communications, photos, documents, secrets, or full restricted payloads.

## Immutability and correction rule

Material operational history should be append-oriented. Corrections should create new events or corrected authoritative state with traceable provenance rather than silently rewriting history.

Exact physical append-only guarantees may differ by event class, but implementation must prevent ordinary UI edits from erasing material business history.

## Event-source boundary

Network OS is the authoritative recorder of managed-network events even when the action originates through an external adapter.

Examples:

- SMS delivery may originate from an external communications service, but Network OS records the associated business action/outcome.
- Partner OS may send a Service Partner acceptance event later, but Network OS records the authoritative managed-network response.
- n8n may orchestrate an action, but Network OS records the resulting authoritative state and event.

## Sensitive-data rule

Event metadata must contain only what is necessary to explain the event.

Do not duplicate:

- raw credentials/secrets;
- full qualification documents;
- resident-sensitive media;
- unnecessary message bodies;
- payment credentials;
- unrestricted prompt payloads.

Where detailed source content is needed, the event should reference the authoritative protected record rather than copy it.

## Legacy reuse decision

Existing audit/event utilities may be reused after review, but legacy event naming and payload structure are not automatically authoritative for Network OS.

## Consequences

### Positive

- Network OS can support reliable SLA/performance metrics later.
- Business history remains understandable without exposing security logs to normal users.
- External adapters can be replaced without losing operational history.
- Corrections do not silently erase material events.

### Costs

- Some state changes will create both domain data updates and event records.
- Event naming/versioning requires governance.
- Reporting must derive from authoritative events carefully to avoid double-counting.

### Risks

- Poor event taxonomy could create noisy or inconsistent analytics.
- Excessive payload capture could create privacy/security risk.
- Missing events could undermine later KPI accuracy.

## Rejected alternatives

| Alternative | Reason rejected |
|---|---|
| One generic activity log for everything | Mixes business history with security evidence and creates access/payload problems |
| Derive all history from current-row timestamps | Cannot reconstruct offers, declines, overrides, or prior states reliably |
| External communication/provider logs are the history | Violates Network OS system-of-record boundary |
| Store full payload snapshots in every event | Unnecessary duplication and sensitive-data risk |

## Implementation gate

Before implementation, the active release must define event taxonomy/versioning, event-write ownership, required Slice 1 events, audit retention/access, sensitive metadata controls, and acceptance tests for REQ-NOS-P1-017, REQ-NOS-P1-019, and REQ-NOS-P1-021. Field-closeout events must distinguish visit saved, communication queued/approved/attempted/delivered/failed, next action scheduled/completed, and explicit no-follow-up without duplicating sensitive note content.

# n8n Assurance — Phase A Edge Adapter Implementation Packet (Draft)

> **DRAFT — FOUNDER APPROVAL REQUIRED**
>
> This document is not an authority packet. It does not authorize source implementation, secret creation, a database migration, preview deployment, GitHub App changes, webhook activation, merge, or production use. AI-generated authority is prohibited. The Founder must approve or revise this packet before it can govern implementation.

## Proposed identifiers

| Field | Proposed value |
|---|---|
| Requirement ID | `NOS-N8N-ASSURANCE-REQ-001` |
| Release ID | `NOS-N8N-ASSURANCE-PHASE-A-01` |
| Work item | `NOS-N8N-EDGE-INGRESS-SPIKE-01` |
| Proposed implementation branch | `implement/nos-n8n-ingress-edge-adapter-0828` |
| Architecture dependency | PR #152 at `d5d61dc93e86fdc1f7498b55cd2ad7428be2f76a` |
| Evidence dependency | `N8N_ASSURANCE_PHASE_A_EVIDENCE.md` |
| Proposed state | source-only, preview/test-only, unpublished |

## Founder decision requested

Approve, reject, or revise the following narrow technical decision:

Use a minimal edge adapter plus a transactional PostgreSQL claim table for GitHub ingress. The edge adapter owns exact-byte HMAC verification, allowlists, target validation, and atomic delivery claiming. It forwards only a normalized authenticated envelope to n8n. n8n remains the workflow coordinator and reviewer fan-in layer.

Approval of this packet would authorize **source implementation and local tests only** unless the Founder explicitly adds another scope. It would not authorize creating production credentials, applying a hosted migration, deploying a preview, enabling the GitHub webhook, publishing n8n workflows, merging, or using production.

## Proposed topology

`GitHub App → edge verifier → transactional delivery claim → authenticated n8n test ingress`

The edge verifier must not call Gemini, Grok, ChatGPT, Cursor, GitHub write APIs, or any production deployment endpoint.

## Proposed bounded components

### 1. Edge endpoint

One isolated serverless HTTP endpoint, source-only until separately authorized.

Responsibilities:

- accept POST only;
- enforce a small request-size ceiling;
- capture raw bytes before JSON parsing;
- require `X-GitHub-Event`, `X-GitHub-Delivery`, and `X-Hub-Signature-256`;
- verify SHA-256 HMAC with constant-time comparison;
- parse JSON only after signature success;
- enforce configured event/action/repository/installation allowlists;
- validate PR number and 40-character lowercase hexadecimal head SHA;
- atomically claim the delivery ID;
- return a deterministic response;
- forward the normalized envelope only after the claim succeeds;
- emit sanitized, correlation-based logs with no payload body, signature, token, or review content.

### 2. Transactional delivery claim

Proposed schema, not authorized for apply:

| Column | Type | Constraint |
|---|---|---|
| `delivery_id` | text | primary key |
| `received_at` | timestamptz | not null, server default |
| `event_name` | text | not null |
| `repository_id` | bigint | not null |
| `installation_id` | bigint | not null |
| `pr_number` | bigint | nullable for ignored events |
| `head_sha` | text | nullable for ignored events |
| `expires_at` | timestamptz | not null |

The claim operation must be one transaction using an insert with database-enforced conflict handling. Application-level select-then-insert is prohibited.

Candidate behavior:

- first valid delivery: insert succeeds, forward once, return 202;
- duplicate delivery: unique conflict produces no forward and returns 200 with a stable duplicate code;
- invalid signature: 401/403, no claim;
- irrelevant event/action: 204, no claim;
- target mismatch or malformed required field: 403, no claim;
- store unavailable or indeterminate: 503, no forward;
- n8n forwarding failure after claim: retain claim and mark retry state only through a separately designed, bounded retry mechanism. Do not delete the claim and create duplicate ambiguity.

The Founder must choose and name the approved transactional host before any migration is applied. No host is selected by this draft.

### 3. Authenticated n8n test ingress

The n8n endpoint must:

- remain unpublished until the preview activation gate;
- require a dedicated machine credential;
- accept only the normalized envelope schema;
- reject unknown keys and invalid schema versions;
- never receive the raw GitHub signature or webhook secret;
- perform no AI work during Phase A;
- return within the configured forwarding timeout.

### 4. Normalized envelope

The proposed JSON Schema is stored in `schemas/n8n-assurance-normalized-envelope.schema.json`. The edge adapter must construct this object server-side. It must not pass arbitrary webhook payload fields through to n8n.

## Proposed first-trial scope

The existing n8n GitHub App installation is read-only and limited to `faydog127/vent-guys-website`, with its webhook disabled. A real-delivery test must not begin until all of the following are recorded without exposing secrets:

- exact GitHub App ID;
- exact installation ID;
- exact repository numeric ID and full name;
- exact App repository permissions;
- exact subscribed event and actions;
- exact preview edge URL;
- exact authenticated n8n test URL;
- exact secret-storage locations and owners;
- rollback owner and execution window.

Expanding the App to BHFOS or another repository requires a separate explicit Founder decision.

## Proposed secret handling

No secret values may be committed, logged, copied into an issue/PR, or placed in n8n expressions as literals.

Proposed secret classes:

| Secret | Proposed location | Activation gate |
|---|---|---|
| GitHub webhook secret | approved preview environment secret store | separate Founder authorization |
| n8n ingress credential | edge preview secret store + n8n credential vault | separate Founder authorization |
| transactional-store credential | approved preview environment secret store | separate Founder authorization |

Secret creation and placement are not authorized by this draft.

## Deterministic acceptance tests

### Local/source tests

1. exact-byte valid signature passes;
2. missing, malformed, and incorrect signatures fail;
3. equal-length constant-time comparison is used;
4. wrong event/action/repository/installation fails or ignores exactly as specified;
5. missing/malformed PR number or head SHA fails;
6. unknown JSON fields never reach the normalized envelope;
7. request-size ceiling rejects oversized bodies;
8. secrets and payload bodies are absent from logs;
9. store failure returns 503 and does not forward;
10. n8n timeout follows the approved non-duplicate retry rule.

### Transactional claim tests

1. first insert wins;
2. sequential duplicate does not forward;
3. at least 25 concurrent identical delivery attempts produce exactly one winner;
4. concurrent different deliveries all succeed independently;
5. expiry cleanup never deletes an unexpired claim;
6. restart/process concurrency does not change single-winner behavior.

### Preview integration tests

These require a later explicit preview-deploy and credential authorization:

1. synthetic signed POST reaches edge preview;
2. exactly one normalized envelope reaches unpublished n8n test ingress;
3. duplicate signed POST does not reach n8n;
4. invalid signatures and target mismatches do not reach n8n;
5. no AI call occurs;
6. no GitHub mutation occurs;
7. total ingress path remains under 10 seconds;
8. rollback disables the preview endpoint and test webhook without data loss.

## Timeouts and retention proposal

These are proposed defaults and require Founder approval:

| Control | Proposed value |
|---|---:|
| Edge total timeout | 8 seconds |
| Store claim timeout | 2 seconds |
| n8n forward timeout | 4 seconds |
| Request body ceiling | 1 MiB |
| Delivery-claim retention | 30 days |
| Sanitized operational-log retention | 14 days |
| Automated retries | none in first proof |

## Evidence required for Definition of Done

- exact repository, branch, base SHA, head SHA, commit(s), and draft PR;
- changed-file inventory;
- source and migration diff;
- local test output including concurrent claim test;
- preview URL and deployment ID only if separately authorized;
- sanitized edge logs and n8n execution IDs;
- proof of one delivery/one forward;
- proof duplicates and invalid inputs do not forward;
- proof no AI, GitHub write, merge, or production action occurred;
- rollback execution and final disabled state;
- independent architecture/contract review at exact head.

## Rollback

Source-only rollback: close the draft PR without merge and delete no shared resources.

Preview rollback, only if later authorized:

1. disable the GitHub test webhook;
2. disable the edge preview route/deployment;
3. unpublish the n8n test workflow;
4. revoke the dedicated n8n ingress credential;
5. preserve delivery-claim rows for the approved evidence-retention window;
6. retain the evidence packet and sanitized logs;
7. confirm zero production and GitHub-write impact.

## Approval checkpoints

The Founder must separately authorize:

1. this packet as implementation authority;
2. the transactional host and source implementation;
3. creation/placement of preview-only secrets;
4. preview migration and deployment;
5. temporary GitHub test webhook activation;
6. the real-delivery integration trial;
7. any merge;
8. any production activation.

No later checkpoint is implied by an earlier approval.

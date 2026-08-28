# n8n Assurance — Phase A Ingress Capability Evidence

**Evidence date:** 2026-08-28  
**Architecture baseline:** PR #152, commit `d5d61dc93e86fdc1f7498b55cd2ad7428be2f76a`  
**Requirement ID:** `NOS-N8N-ASSURANCE-REQ-001`  
**Release ID:** `NOS-N8N-ASSURANCE-PHASE-A-01`  
**Work item:** `NOS-N8N-INGRESS-CAPABILITY-SPIKE-01`  
**Outcome:** **PHASE A COMPLETE — INGRESS_CAPABILITY_BLOCKED**  
**Authority:** test-only capability proof; no implementation, activation, deployment, merge, or production authority

## Executive result

n8n Cloud proved that it can receive an unpublished test webhook, preserve the request body as binary data, compute a SHA-256 HMAC over those exact bytes, perform a constant-time digest comparison in the Code node, enforce event/repository/installation/action/PR-field allowlists, and return explicit HTTP outcomes.

n8n's native Data Table interface did **not** prove the required atomic, durable, single-winner claim on `X-GitHub-Delivery`. The exposed column-creation DTO contains only name, type, and optional CSV name; it exposes no unique constraint. The row-not-exists operation performs a select/check, and the upsert operation is filter-based. Those interfaces do not establish race-safe first-writer-wins delivery ownership.

The architecture therefore fails closed at acceptance criterion 7. The required next design is the documented fallback:

`GitHub App → minimal edge verifier/transactional claim → authenticated n8n test ingress`

No production webhook may be enabled until that path is separately approved, implemented, and proven.

## Environment and artifacts

| Item | Evidence |
|---|---|
| n8n instance | `https://bhfos.app.n8n.cloud` |
| Observed n8n application version | `n8n@2.35.4` |
| Plan | Not asserted; exact commercial plan was not proven from the UI |
| Test date | 2026-08-28 UTC |
| Real GitHub delivery used | No; all fixtures were synthetic |
| AI model calls | None |
| GitHub mutations | None |
| Production/Hostinger mutations | None |
| Published or active workflow | None |

### Unpublished n8n workflows

| Purpose | Workflow | ID | Execution evidence |
|---|---|---|---|
| Raw-body capture | DEV-ASSURANCE — GitHub Ingress Capability Spike — Phase A | `NRmK36l6xT2FbJlJ` | execution `1422`; success; 89 ms |
| Synthetic sender | DEV-ASSURANCE — GitHub Fixture Sender — Phase A | `L4hI0Bfdgz5GnCJl` | sent public synthetic fixtures only |
| Exact-byte HMAC | DEV-ASSURANCE — GitHub HMAC Capability Spike — Phase A | `2t0UesGwUM74pd1e` | execution `1429`; success; 330 ms |
| Deterministic matrix | DEV-ASSURANCE — Ingress Validation Matrix — Phase A | `GvUb9sIecZc2XgrO` | 11/11 cases passed |

All four workflows remained unpublished/inactive. Their test webhook URLs are not production endpoints.

## Capability results

### Raw request body

The Webhook node was configured for POST with **Raw Body** enabled. The received JSON was exposed as binary property `data` with MIME type `application/json`. This proved that the exact request-byte stream is available to downstream nodes before JSON normalization.

### HMAC verification

A Crypto credential containing a non-sensitive public fixture secret was used only for the synthetic test. The Crypto node computed SHA-256 HMAC in hexadecimal form over binary property `data`.

Computed digest:

`e1437127fc96a396c2d2f7594e772d6bd4696d17d82ae75fce252c94ba2342f2`

This exactly matched the independently computed fixture digest. No production GitHub webhook secret was created, copied, or used.

### Constant-time comparison and deterministic matrix

The Code node proved Node's `crypto.timingSafeEqual` is available. It first checks equal buffer length, then compares fixed-length digest buffers.

| Case | Expected | Result |
|---|---:|---|
| Valid fixture, pending durable claim | 202 candidate | Pass |
| Missing signature | 401 | Pass |
| Malformed signature | 401 | Pass |
| Incorrect signature | 403 | Pass |
| Irrelevant event | 204 | Pass |
| Unexpected action | 204 | Pass |
| Repository ID mismatch | 403 | Pass |
| Repository name mismatch | 403 | Pass |
| Installation mismatch | 403 | Pass |
| Missing PR number | 403 | Pass |
| Malformed head SHA | 403 | Pass |

Matrix output: `constant_time_compare=true`, `durable_claim_exercised=false`, `passed=11`, `total=11`, `all_pass=true`.

The 202 result is deliberately labeled a **candidate**. It cannot become an accepted ingress outcome until the durable atomic delivery claim succeeds.

## Acceptance-criteria crosswalk

| # | Architecture criterion | Result |
|---:|---|---|
| 1 | Receive unpublished/test-only GitHub-style POST | Pass with synthetic sender |
| 2 | Preserve raw request body | Pass |
| 3 | Verify `X-Hub-Signature-256` over exact bytes | Pass with public fixture secret |
| 4 | Constant-time signature comparison | Pass |
| 5 | Validate event/action allowlist | Pass |
| 6 | Validate repository, installation, PR number, head SHA | Pass |
| 7 | Atomic, durable, single-winner delivery claim | **Blocked** |
| 8 | Deterministic duplicate response | Not exercisable until criterion 7 exists |
| 9 | Emit normalized envelope only after validation/claim | Schema drafted; runtime emission withheld |
| 10 | Complete ingress under 10 seconds | Pass for exercised paths (89 ms and 330 ms) |
| 11 | No AI calls | Pass |
| 12 | No GitHub/repository/production mutation | Pass |
| 13 | Fail closed and use edge fallback if capability missing | Pass; overall status is blocked |

## Atomic-delivery assessment

The following primary implementation evidence was inspected:

- Data Table column creation accepts `name`, `type`, and optional `csvColumnName`; no uniqueness property is exposed.
- Row-not-exists selects matching rows and returns no item when rows exist. A separate read/check is not an atomic claim.
- Upsert requires a filter and delegates to `upsertRow`; the node contract does not expose or require a unique key.

A concurrent duplicate test against an unconstrained table would only demonstrate a race, not create the missing invariant. Phase A therefore stopped rather than simulating a guarantee that the platform has not exposed.

## Required fallback properties

Any proposed edge adapter must remain test-only and must:

1. Read the raw body before parsing.
2. Verify the `sha256=` HMAC using constant-time comparison.
3. Enforce exact event, action, repository, installation, PR-number, and head-SHA rules.
4. Atomically insert `delivery_id` into a transactional store with a database-enforced unique/primary-key constraint.
5. Return one deterministic first-delivery outcome and one deterministic duplicate outcome.
6. Forward only the normalized envelope to an authenticated n8n test ingress.
7. Use bounded timeouts, bounded retention, sanitized logs, and no AI calls.
8. Remain unpublished and disconnected from the production GitHub App until separately authorized.

## Boundary confirmation

No workflow was published or activated. No GitHub webhook was enabled. No GitHub App permission or repository installation was changed. No production secret was created or revealed. No AI provider was called. No branch was merged. No deploy, database migration, Hostinger change, or production mutation occurred.

## Primary references

- n8n Webhook node raw-body and test/production URL behavior: https://github.com/n8n-io/n8n-docs/blob/main/docs/integrations/builtin/core-nodes/n8n-nodes-base.webhook/README.md
- n8n Crypto node HMAC behavior: https://github.com/n8n-io/n8n-docs/blob/main/docs/integrations/builtin/core-nodes/n8n-nodes-base.crypto.md
- n8n Data Table row operations: https://github.com/n8n-io/n8n-docs/blob/main/docs/integrations/builtin/core-nodes/n8n-nodes-base.datatable/rows.md
- Data Table row-not-exists implementation: https://github.com/n8n-io/n8n/blob/master/packages/nodes-base/nodes/DataTable/actions/row/rowNotExists.operation.ts
- Data Table upsert implementation: https://github.com/n8n-io/n8n/blob/master/packages/nodes-base/nodes/DataTable/actions/row/upsert.operation.ts
- Data Table column DTO: https://github.com/n8n-io/n8n/blob/master/packages/%40n8n/api-types/src/dto/data-table/create-data-table-column.dto.ts

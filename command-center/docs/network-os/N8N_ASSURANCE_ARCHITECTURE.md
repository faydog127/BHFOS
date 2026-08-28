# Network OS — Command–Event–Workflow–Worker Assurance Architecture

**Document ID:** `NOS-N8N-ASSURANCE-ARCHITECTURE-01`  
**Status:** Founder-approved architecture direction; implementation and activation blocked  
**Decision date:** 2026-08-28  
**Decision owner:** Founder  
**Repository scope:** `faydog127/BHFOS` / Network OS development assurance  
**Target base:** `network-os/foundation@9087e814de088d93a6de863407dc702fa0530c86`  
**Change class:** Governance and technical specification only  
**Implementation authority:** None. This document does not authorize workflow activation, GitHub App webhook activation, AI API calls, merge, deployment, migration, production mutation, or Network OS mutation.

## 1. Purpose

This document consolidates and corrects the Network OS development-assurance architecture into one canonical reference.

It resolves the central boundary:

> ChatGPT remains the Product and Build Command Center. n8n operates the mechanical assurance workflow on the Command Center's behalf. n8n does not create work, interpret product authority, adjudicate findings, merge code, deploy releases, or own Network OS state.

The canonical sequence is:

```text
Command → Implementation → Event → Workflow → Workers
→ Adjudication → Authorized Action
```

This is a **Command–Event–Workflow–Worker** architecture, not a flat autonomous agent committee and not a generic n8n-owned orchestrator-worker system.

## 2. Relationship to existing authority

This document is specific to GitHub pull-request assurance for Network OS. It does not repeal or silently replace:

- `command-center/docs/v2/ADR-DEC-V2-014_REVIEW_BOARD_AUTHORITY_AND_N8N_INTEGRATION.md`;
- the repository approval thresholds;
- the current Network OS Definition of Ready / Definition of Done;
- the separation of implementation, merge, migration, deployment, and activation authority.

ADR-DEC-V2-014 remains controlling for the broader Review Board boundary: BHFOS owns authoritative requests, runs, reservations, artifacts, reconciliation, and human decisions; n8n executes only bounded work and never writes authoritative tables directly.

This document adds a narrower rule for development assurance:

1. ChatGPT and the Founder own command authority.
2. Cursor implements only an authorized packet.
3. GitHub emits authenticated change events.
4. A minimal event listener verifies and normalizes those events.
5. n8n runs mechanical assurance against one frozen SHA.
6. Independent workers return evidence-bound findings.
7. ChatGPT adjudicates the findings.
8. A separately authorized actor performs any consequential action.

Where any document appears ambiguous, the stricter no-self-authorization, no-direct-authoritative-write boundary controls until the Founder records a superseding decision.

## 3. Authority classification

### 3.1 Active / Founder-approved architecture

- Erron is the final authority for material product, business, production, financial, security, and risk decisions.
- ChatGPT is the Network OS Product and Build Command Center.
- Cursor is the bounded implementation environment.
- GitHub is authoritative for repositories, branches, commits, pull requests, reviews, and checks.
- Network OS is authoritative for managed-network operational state.
- n8n is a replaceable workflow and assurance coordinator, not a system of record or product authority.
- Gemini and Grok are independent advisory workers; neither can grant authority.
- A changed PR SHA invalidates prior assurance for the superseded SHA.
- Merge, migration, deployment, and activation are distinct authority boundaries.

### 3.2 Proposed next implementation step

A bounded, unpublished n8n Cloud capability spike may be prepared under a separately issued implementation packet to prove:

- original-body availability;
- GitHub HMAC-SHA256 verification;
- explicit HTTP responses;
- repository and installation allowlisting;
- atomic delivery deduplication;
- asynchronous internal handoff;
- no AI calls in ingress.

The capability spike is not authorized by this document alone.

### 3.3 Not authorized

- Production webhook activation.
- Automatic PR merge or closure.
- Automatic deployment or migration apply.
- Direct n8n writes to Network OS authoritative tables.
- n8n interpretation of product scope, architecture, materiality, or acceptable risk.
- AI-generated authority packets.
- Cursor expansion of its own scope or risk tier.
- Comment commands such as `/approve`, `/merge`, or `/deploy`.
- AI reviewers receiving production credentials or write access.
- Treating `PASS` or `ASSURANCE_COMPLETE` as merge or deployment authorization.

## 4. Layer responsibilities

| Layer | Owner | Question answered | Prohibited authority |
| --- | --- | --- | --- |
| Command | Erron + ChatGPT | What work is authorized? | Cannot silently bypass recorded repository authority |
| Implementation | Cursor | What change satisfies the packet? | Cannot expand scope, merge, deploy, or resolve material ambiguity |
| Event | GitHub App + listener | Did an authentic, relevant event occur? | Cannot interpret scope, risk, findings, or business meaning |
| Workflow | n8n | Did the required mechanical process complete for this SHA? | Cannot adjudicate, authorize, merge, deploy, or mutate Network OS |
| Workers | Gemini, Grok, CI | What does the evidence show? | Cannot grant authority or write protected state |
| Adjudication | ChatGPT | What do the findings mean and what is permitted next? | Cannot self-authorize Founder-reserved consequential action |
| Authorized action | Designated actor; Erron when material | May the exact action occur? | Cannot broaden the approved action, payload, SHA, or environment |

## 5. Canonical flow

```text
Founder + ChatGPT
  → authority packet
  → Cursor feature branch and PR
  → GitHub App signed webhook
  → event listener verification and delivery claim
  → normalized event envelope
  → n8n PR assurance coordinator
  → frozen evidence package
  → blind Gemini + blind Grok + deterministic CI
  → n8n mechanical assurance packet
  → ChatGPT adjudication
  → Founder decision only when the authority threshold requires it
  → separately authorized merge/deploy/mutation actor
```

No layer below Command may create new work, expand scope, or grant itself the next layer's authority.

## 6. Workflow 1 — GitHub event listener / ingress

### 6.1 Purpose

The ingress workflow is a minimal security boundary. It authenticates, filters, deduplicates, normalizes, and hands off GitHub events. It contains no AI node and performs no substantive review.

### 6.2 Required order

```text
Webhook receive
→ preserve original body and required headers
→ validate signature-header format
→ calculate and compare HMAC-SHA256
→ validate event, action, repository, repository ID, and installation ID
→ atomically claim X-GitHub-Delivery
→ generate normalized envelope
→ start coordinator asynchronously
→ respond 202
```

The Webhook node must use an explicit response path. It must not return success before verification and durable acceptance.

### 6.3 Response contract

| Condition | HTTP response | Downstream behavior |
| --- | ---: | --- |
| Valid and durably accepted | `202` | Start coordinator asynchronously |
| Valid duplicate delivery | `200` | No-op unless a separately authorized replay exists |
| Authentic but irrelevant event | `204` | No-op |
| Missing or invalid signature | `401` or `403` | Reject; no handoff |
| Invalid repository or installation | `403` | Reject; no handoff |
| Acceptance or enqueue failure | `500` | Do not claim downstream success |

GitHub must receive the response within ten seconds. Slow AI or CI work must never occur before the response.

### 6.4 Signature verification requirements

- Use `X-Hub-Signature-256`, never the legacy SHA-1 header.
- Compute HMAC-SHA256 over the exact original request body bytes using the GitHub App webhook secret.
- Reject a missing or malformed signature before constant-time comparison.
- Require the format `^sha256=[0-9a-f]{64}$`.
- Confirm supplied and expected signature buffers have equal length before `timingSafeEqual` or an equivalent constant-time comparison.
- Store the webhook secret in an approved secret/credential facility; never in workflow JSON, source control, URLs, logs, or review packets.
- Prove raw-body fidelity and cryptographic capability on the actual n8n Cloud plan before choosing the final implementation node.

The following is behavioral pseudocode, not approved copy-paste n8n Code-node implementation:

```js
assertOriginalBodyAvailable();
assert(/^sha256=[0-9a-f]{64}$/i.test(receivedSignature));

const expectedSignature = hmacSha256(webhookSecret, originalBody);
assert(equalByteLength(receivedSignature, expectedSignature));
assert(constantTimeEqual(receivedSignature, expectedSignature));
```

If n8n Cloud cannot prove access to the exact original body or safe secret/crypto handling, the approved design fallback is:

```text
GitHub App → minimal edge verifier/queue → authenticated n8n ingress
```

Moving HMAC verification to a minimal edge adapter does not promote that adapter into command or workflow authority.

### 6.5 Event and repository allowlist

Initial event type:

```text
X-GitHub-Event == pull_request
```

Initial actions:

| Action | Ingress/coordinator result |
| --- | --- |
| `opened` | Record; start only if not draft and authority is valid |
| `ready_for_review` | Evaluate and start assurance |
| `synchronize` | Supersede prior SHA run and start a new SHA-bound run |
| `reopened` | Re-evaluate eligibility |
| `converted_to_draft` | Pause/cancel outstanding assurance work |
| `closed` | Close outstanding work |
| `merged` | Record evidence only; never auto-deploy |

The listener must validate all of:

- GitHub event type;
- action;
- repository numeric ID;
- repository full name (`faydog127/BHFOS` for the initial scope);
- expected GitHub App installation ID;
- installation-target headers when present;
- presence and format of the PR number and head SHA.

`installation_verified`, `signature_verified`, and `delivery_claimed` may be set to `true` only after the corresponding checks actually succeed.

### 6.6 Replay protection

`X-GitHub-Delivery` must be claimed through an atomic insert-if-absent operation backed by a unique constraint or equivalent single-winner primitive.

A `check → then insert` sequence is insufficient because concurrent deliveries can race.

GitHub manual redelivery uses the original delivery ID. Default behavior for a repeated ID is an acknowledged no-op. Deliberate reprocessing requires a separate, authorized replay record referencing the original delivery and reason.

Ingress cannot promise both durable deduplication and zero storage interaction. The capability spike must select a bounded non-authoritative store or queue. n8n execution history, process-local maps, and unguarded workflow static data are not accepted as concurrency controls.

### 6.7 Normalized internal envelope

When Workflow 1 invokes Workflow 2 through an internal n8n sub-workflow boundary, the envelope is trusted by that internal boundary; it is not described as cryptographically signed. If the handoff crosses HTTP, a queue, or another service boundary, it must use separate internal authentication and must not reuse the GitHub webhook secret.

```json
{
  "event_version": "1.0",
  "source": "github_app",
  "delivery_id": "github-supplied-guid",
  "event_type": "pull_request",
  "action": "synchronize",
  "repository_id": 123456789,
  "repository": "faydog127/BHFOS",
  "installation_id": 12345678,
  "pull_request": 152,
  "event_head_sha": "40-character-git-sha",
  "received_at": "server-generated-rfc3339-timestamp",
  "signature_verified": true,
  "installation_verified": true,
  "delivery_claimed": true
}
```

The coordinator must re-fetch current GitHub state; the event envelope alone is not current-state authority.

## 7. Workflow 2 — PR assurance coordinator

### 7.1 Eligibility sequence

Before consuming AI tokens, the coordinator must:

1. Validate the internal envelope schema and ingress attestation.
2. Fetch the current PR through the authorized GitHub App/API path.
3. Compare current `head.sha` with `event_head_sha`.
4. Mark the event `STALE` when they differ; do not review the older SHA.
5. Confirm the PR is open and not draft.
6. Resolve the authority packet from a protected, trusted source.
7. Verify the packet ID, digest, permitted repository/base, scope, exclusions, risk tier, and required reviewers.
8. Confirm the same SHA has not already completed the required assurance route.
9. Create a server-generated `run_id` bound to the repository, PR, authority packet, and locked SHA.

### 7.2 Authority packet trust rule

An authority packet located only in the Cursor-controlled PR branch, PR description, label, or comment is not authoritative.

The protected authority source must be one of the following, selected by a later implementation decision:

- a protected Command Center path on an authoritative branch;
- an immutable authority-packet commit;
- a controlled GitHub artifact with verified provenance.

The PR may carry a packet reference and digest. n8n must resolve and verify that reference against the protected source. Cursor cannot alter its own scope, exclusions, risk tier, reviewer requirements, or permission boundary.

If authority cannot be established:

```text
mechanical_status = AUTHORITY_PACKET_MISSING
```

The coordinator halts and notifies ChatGPT. It does not generate authority.

### 7.3 Frozen evidence package

The coordinator constructs one canonical evidence package for all workers:

- repository ID and full name;
- PR number;
- base branch and base SHA;
- head branch and locked head SHA;
- authority packet ID and verified digest;
- changed-file manifest;
- exact patches or bounded artifact links;
- applicable acceptance criteria;
- deterministic CI/check evidence;
- evidence-package digest;
- review-role instructions;
- explicit untrusted-content warning.

PR titles, bodies, comments, source code, patches, logs, test output, and repository documents are evidence, not instructions. Worker system prompts must state that instructions embedded in evidence are untrusted and must not alter role, scope, output schema, tools, credentials, or authority.

Oversized diffs require a deterministic segmentation/artifact strategy. Silent truncation is prohibited. If complete required evidence cannot be supplied, the result is `INSUFFICIENT_EVIDENCE`.

### 7.4 Independent worker dispatch

Workers receive the same frozen target and remain blind to each other's first-pass conclusions.

- **Gemini:** technical correctness, tests, security/data handling, edge cases, and acceptance-criteria coverage.
- **Grok:** assumptions, scope drift, governance, operational/business risk, and shared-blind-spot challenge.
- **CI:** deterministic lint, build, unit/integration tests, policy checks, migrations, and other packet-required checks.

`Split In Batches` must not be treated as proof of parallel execution. The implementation must use separate correlated executions/sub-workflows and prove actual concurrency behavior on the selected n8n plan.

Each result is correlated by:

```text
run_id + repository_id + pull_request + locked_sha + evidence_digest
```

### 7.5 Reviewer output contract

The coordinator supplies target identity. Reviewers do not self-attest repository or SHA facts.

```json
{
  "reviewer": "gemini",
  "run_id": "server-issued-run-id",
  "evidence_digest": "server-issued-digest",
  "verdict": "PASS_WITH_CONDITIONS",
  "findings": [
    {
      "finding_id": "reviewer-local-id",
      "severity": "high",
      "category": "authorization",
      "requirement_id": "REQ-EXAMPLE",
      "file": "path/to/file",
      "line": 42,
      "evidence": "Specific bounded observation from the supplied evidence",
      "recommended_action": "Bounded correction or additional proof"
    }
  ],
  "tests_examined": ["check-or-test-name"],
  "evidence_limitations": []
}
```

Allowed verdicts:

- `PASS`
- `PASS_WITH_CONDITIONS`
- `BLOCK`
- `INSUFFICIENT_EVIDENCE`

Schema-valid JSON is necessary but insufficient. n8n must verify that referenced files exist in the changed-file/evidence manifest, required fields are populated, the run and digest match, and the target SHA remains current. Claims about executed tests must be supported by deterministic CI evidence or clearly labeled reviewer analysis.

### 7.6 Fan-in and mechanical gate

The coordinator waits only within bounded timeout and cost limits. It may retry provider transport failures within the authorized retry policy. It may not rewrite findings or convert verdicts.

Mechanical statuses:

- `COMPLETE`
- `INCOMPLETE`
- `STALE`
- `AUTHORITY_PACKET_MISSING`
- `INVALID_EVENT`
- `TIMED_OUT`

Policy signals are kept separate from completion:

- `ALL_REQUIRED_REVIEWS_PRESENT`
- `CI_PASS`
- `CI_FAIL`
- `HAS_BLOCK_VERDICT`
- `HAS_CONDITIONS`
- `HAS_INSUFFICIENT_EVIDENCE`
- `SHA_CHANGED`

Example assurance packet:

```json
{
  "run_id": "server-issued-run-id",
  "target": {
    "repository": "faydog127/BHFOS",
    "pull_request": 152,
    "locked_sha": "40-character-git-sha",
    "authority_packet_id": "authority-packet-id",
    "evidence_digest": "server-computed-digest"
  },
  "mechanical_status": "COMPLETE",
  "policy_signals": [
    "ALL_REQUIRED_REVIEWS_PRESENT",
    "CI_PASS",
    "HAS_BLOCK_VERDICT"
  ],
  "adjudication_status": "PENDING",
  "reviews": {
    "gemini": { "status": "COMPLETED", "verdict": "PASS_WITH_CONDITIONS" },
    "grok": { "status": "COMPLETED", "verdict": "BLOCK" },
    "ci": { "status": "COMPLETED", "verdict": "PASS" }
  }
}
```

`COMPLETE` means the required evidence process completed. It does not mean approved, mergeable, deployable, usable, or production-valid.

## 8. ChatGPT adjudication

ChatGPT receives the mechanical assurance packet and linked evidence. ChatGPT determines:

- whether findings are supported;
- whether reviewers misunderstood the authorized requirement;
- whether deviations are material;
- whether Cursor needs a bounded correction packet;
- whether additional evidence or a specialist review is required;
- whether Founder authority is required;
- the next permitted action.

Allowed adjudication dispositions include:

- `RETURN_TO_CURSOR`
- `ADDITIONAL_EVIDENCE_REQUIRED`
- `SPECIALIST_REVIEW_REQUIRED`
- `REVIEWER_MISINTERPRETATION`
- `FOUNDER_DECISION_REQUIRED`
- `READY_FOR_SEPARATE_MERGE_AUTHORIZATION`
- `REJECTED`

A Cursor correction creates a new SHA. Prior reviews remain historical evidence for the prior SHA and are not valid approvals for the new SHA.

Automatic fix/review loops must have explicit iteration, cost, and repeated-failure limits. New material ambiguity halts the loop and returns to Command authority.

## 9. Risk-based routing

The verified authority packet selects a versioned routing policy. n8n cannot infer or lower the risk tier from the diff alone.

| Risk tier | Minimum assurance route |
| --- | --- |
| Tier 1 — docs/cosmetic/low-risk isolated | Relevant deterministic checks; one independent role selected by the packet; ChatGPT verification |
| Tier 2 — meaningful behavior/shared workflow | Gemini + Grok blind reviews; applicable CI; ChatGPT adjudication |
| Tier 3 — auth, RLS, migration, money, secrets, customer communication, destructive or production-critical | Tier 2 plus packet-required security/data/release evidence and explicit Founder authority at each reserved boundary |

No change is Tier 1 merely because it changes few lines. Trigger domains and consequences control risk.

## 10. Permissions and secrets

### 10.1 GitHub App initial least privilege

The capability spike must verify and document the smallest permissions needed. The target posture is read-only access to metadata, pull requests, contents, and checks/status evidence. Checks write permission may be considered only in the later check-reporting phase. Contents write, administration, deployments, workflows, and merge authority are not required for ingress or review.

### 10.2 Worker permissions

- Gemini: read-only evidence, no repository or production credentials.
- Grok: read-only evidence, no repository or production credentials.
- CI: repository-defined deterministic execution under existing GitHub controls.
- Cursor: may write only to an authorized feature branch and PR; no protected-branch, merge, deployment, migration-apply, or production authority.
- n8n: only the credentials required for its activated bounded workflows; no broad database service credential.

### 10.3 Retention and logging

Do not log or persist secrets, credentials, raw authorization headers, private customer data, or unnecessary full provider responses. Apply size limits, redaction, and a retention period to raw model outputs. Durable evidence should contain the minimum necessary provenance and findings.

## 11. Capability spike acceptance criteria

Before production ingress can be designed or activated, an unpublished test must prove all of the following on the actual n8n Cloud account:

1. Original request-body fidelity is demonstrable with a known GitHub HMAC fixture.
2. Valid signature returns the accepted path.
3. Missing, malformed, and incorrect signatures return `401`/`403` and never start Workflow 2.
4. Repository and installation mismatches return `403`.
5. Authentic irrelevant events return `204` with no AI or coordinator call.
6. Accepted events are durably claimed before `202` is returned.
7. Two concurrent attempts with one delivery ID produce exactly one accepted coordinator handoff.
8. A repeated delivery ID returns an acknowledged no-op unless a separate replay authorization exists.
9. Workflow 2 receives only the normalized envelope, not secrets or unnecessary raw payload.
10. Accepted ingress responds within GitHub's ten-second limit.
11. No AI API is called by Workflow 1.
12. The test creates no PR mutation, check write, merge, deploy, migration, production write, or Network OS write.
13. If any required Cloud capability fails, the result is `INGRESS_CAPABILITY_BLOCKED` and the minimal edge-verifier fallback is evaluated rather than weakening verification.

## 12. Progressive activation gates

### Phase A — capability proof

- Unpublished/test-only ingress.
- Synthetic or official HMAC fixtures.
- No GitHub production webhook connection.
- No AI calls.

### Phase B — assurance courier

- Separately authorized GitHub App event subscription.
- Exact-SHA evidence collection.
- Blind review dispatch and result collection.
- Notification to ChatGPT.
- No check writes, merge, deploy, or Network OS mutation.

### Phase C — mechanical GitHub check

- Separately authorized check-write permission.
- Reports only mechanical status such as `ASSURANCE_COMPLETE`, `ASSURANCE_BLOCKED`, or `ASSURANCE_STALE`.
- Does not report merge or deployment authority.

### Phase D — narrow enforcement

- Requires a separate Founder-approved architecture decision and proof from prior phases.
- May enforce that required assurance exists for an exact SHA.
- Does not automatically grant merge, deployment, migration, or Network OS mutation authority.

## 13. Failure and recovery rules

- Invalid ingress fails closed before downstream work.
- Provider timeout produces `TIMED_OUT`, not an assumed failure or pass.
- Malformed reviewer output produces `INCOMPLETE` or `INSUFFICIENT_EVIDENCE`.
- SHA change produces `STALE` and invalidates the run for current-action purposes.
- n8n outage pauses automated assurance; it does not transfer authority to workers.
- GitHub failed-delivery recovery is an explicit operational procedure; no success is inferred from missing events.
- A partial worker panel cannot be described as a completed panel.
- Any uncertainty about authority, target identity, environment, or evidence fails closed and routes to ChatGPT.

## 14. Definition of Ready for implementation

No implementation packet may activate even the capability spike until it records:

- exact n8n Cloud plan/version evidence;
- proven raw-body behavior or selected edge fallback;
- approved secret-storage method;
- approved atomic deduplication store and retention;
- GitHub App ID, installation ID, repository ID, event permissions, and least-privilege review;
- test URL versus production URL handling;
- explicit response-node behavior;
- redaction/log-retention rules;
- timeout, retry, cost, and concurrency limits;
- synthetic fixture plan;
- rollback/disable procedure;
- exact workflow names and owners;
- confirmation that production publish remains disabled.

## 15. Decision summary

The controlling rule is:

> The GitHub App emits. The listener authenticates. n8n transports, freezes, dispatches, validates, and records mechanical completion. Independent workers analyze. ChatGPT adjudicates. Erron authorizes material outcomes. GitHub and Network OS enforce their own authoritative boundaries.

Neither an authentic event, a schema-valid bot response, an all-pass panel, nor `ASSURANCE_COMPLETE` grants authority to merge, deploy, migrate, activate, or mutate Network OS.

## 16. References

- [GitHub — Validating webhook deliveries](https://docs.github.com/en/webhooks/using-webhooks/validating-webhook-deliveries)
- [GitHub — Best practices for webhooks](https://docs.github.com/en/webhooks/using-webhooks/best-practices-for-using-webhooks)
- [GitHub — Webhook events and payloads](https://docs.github.com/en/webhooks/webhook-events-and-payloads)
- [GitHub — Handling failed deliveries](https://docs.github.com/en/webhooks/using-webhooks/handling-failed-webhook-deliveries)
- [n8n — Webhook node](https://docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-base.webhook/)
- [n8n — Respond to Webhook node](https://docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-base.respondtowebhook/)
- [n8n — Code node](https://docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-base.code/)
- [n8n — Execute Sub-workflow node](https://docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-base.executeworkflow/)
- [n8n — Execution order](https://docs.n8n.io/build/flow-logic/understand-execution-order/)
- [n8n — Cloud concurrency](https://docs.n8n.io/deploy/use-n8n-cloud/understand-concurrency/)


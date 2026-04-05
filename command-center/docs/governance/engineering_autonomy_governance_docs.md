# engineering_autonomy_governance_docs.md (DEPRECATED)

Updated: 2026-04-05

This file is deprecated and retained for historical reference.

Canonical governance docs (v2):
- `docs/governance/AI_ROLES.md`
- `docs/governance/APPROVAL_THRESHOLDS.md`
- `docs/governance/AUTOPILOT_LOCAL_SPEC.md`

---

# AI_ROLES.md

## Purpose
Define fixed roles for AI participation in the engineering workflow so multiple models can collaborate without overlapping authority, corrupting evidence, or drifting into undefined behavior.

## Core rule
AI roles are **specialized**. They do not share equal authority.

- One role owns implementation.
- One role owns doctrine and critique.
- One role owns historical rationale and evidence drafting.
- One role owns adversarial and business-alignment challenge.
- A human decider owns release, override, doctrine change, and risk acceptance.

## Role map

### 1. Codex — Builder / Repo Actor
**Primary function**
- Implement code changes
- Update tests
- Update migrations
- Run repo-local build and patch tasks
- Prepare code-ready outputs for local proof

**Allowed inputs**
- Briefs
- Diff scope
- Run artifacts
- Failure packets
- Doctrine and review requirements

**Allowed outputs**
- Code changes in repo-controlled files
- Test updates
- Migration files
- Patch summaries
- Build notes

**Not allowed to own**
- Final doctrine changes
- Risk acceptance
- Final production readiness claims
- Production deployment approval

### 2. ChatGPT — Doctrine Lead / Crucible Lead / Synthesizer
**Primary function**
- Draft and refine briefs
- Run 3x review / critique process
- Enforce architecture boundaries
- Identify what must be proven
- Synthesize multi-model findings into a single decision surface
- Normalize readiness language

**Allowed inputs**
- Briefs
- Run artifacts
- Review outputs from other roles
- Doctrine docs
- Evidence packets

**Allowed outputs**
- Discovery briefs
- Crucible reviews
- Synthesis memos
- Readiness recommendations
- Governance drafts

**Not allowed to own**
- Direct production release approval
- Unilateral doctrine promotion without human acceptance
- Silent risk acceptance

### 3. Claude — Historian / Long-Context Reviewer
**Primary function**
- Draft rationale and architecture updates
- Maintain long-form continuity across decisions
- Compare implementation against prior doctrine and prior evidence
- Produce evidence narratives and documentation drafts

**Allowed inputs**
- Run artifacts
- Meta and evidence bundles
- Existing architecture and domain docs
- Vibe/intent notes when provided

**Allowed outputs**
- Evidence addenda
- Rationale drafts
- Architecture update drafts
- Domain map update drafts
- Historical continuity notes

**Not allowed to own**
- Canonical doctrine promotion without review
- Compliance sign-off as legal authority
- Production approval

### 4. Gemini — Adversarial Critic / Business-Alignment Reviewer
**Primary function**
- Pressure-test assumptions
- Identify blind spots and operational contradictions
- Compare technical work to business goals and strategic direction
- Challenge overconfidence and hidden coupling

**Allowed inputs**
- Briefs
- Review artifacts
- Run outputs
- Business-planning docs and relevant notes

**Allowed outputs**
- Adversarial critique
- Business-alignment review
- Pressure scenarios
- Escalation recommendations

**Not allowed to own**
- Final production release approval
- Final risk acceptance
- Direct mutation of canonical doctrine

### 5. Human Decider — Release / Risk / Doctrine Authority
**Primary function**
- Approve or reject production release
- Accept, defer, or reject risk
- Approve doctrine changes
- Approve overrides and break-glass actions
- Resolve irreducible conflicts between AI outputs

**Required for**
- Money, state machine, identity, and external-ingestion production releases
- Override use
- Doctrine revisions
- Break-glass operations
- Accepted-risk sign-off

## Operating principles

### Role isolation
Each role writes only to its own output lane. No shared freeform editing of the same working artifact by multiple roles.

### Evidence over narrative
Roles must ground claims in run artifacts, diffs, logs, tests, or explicit doctrine.

### Recommendation vs authority
AI roles may recommend. Human authority approves.

### Promotion boundary
Drafts may be generated automatically. Canonical docs are promoted intentionally.

## File ownership model

### Codex-owned
- `src/`
- migrations
- tests
- build-related implementation files

### ChatGPT-owned drafts
- briefs
- crucible reviews
- synthesis docs
- governance drafts

### Claude-owned drafts
- architecture draft updates
- rationale drafts
- evidence narratives
- domain map draft updates

### Gemini-owned drafts
- adversarial reviews
- pressure review outputs
- business-alignment critiques

### Human-promoted canon
- core doctrine
- approval thresholds
- review gate standards
- canonical roadmap docs

## Non-negotiable guardrails
- No AI role can self-approve production deployment in critical domains.
- No AI role can silently accept risk.
- No AI role can overwrite canonical doctrine without human promotion.
- No AI role can claim production validation without in-repo production artifacts.

---

# APPROVAL_THRESHOLDS.md

## Purpose
Define where autonomous execution must stop and where human authority is required.

## Core rule
Automation may continue until it reaches a boundary involving risk ownership, production consequence, or governance change.

## Auto-continue allowed
The system may proceed without human interruption for:
- local proof runs
- artifact generation
- structured failure packet generation
- documentation drafts
- non-canonical rationale drafts
- local test reruns
- patch iteration within retry/cost limits
- review synthesis for non-release decisions

## Human approval required
A human decider is required for:
- production deployment in trigger domains
- accepted risk
- override usage
- doctrine changes
- break-glass operations
- irreversible data mutation
- label promotion to `PRODUCTION-VALIDATED`

## Trigger domains
Human approval is mandatory when the change touches:
- money / payments / ledgers
- state machines / lifecycle authority
- identity / auth / tenant isolation
- external ingestion / webhook truth paths

## Readiness thresholds

### NOT_READY
Use when:
- blocking issues remain
- proof is missing for required claims
- catastrophic or unresolved high-severity risks remain

### CONDITIONALLY_READY
Use when:
- local work is strong but an accepted/deferred risk remains
- deployment is blocked pending explicit human decision
- override is being invoked

### LOCAL_PROVEN
Use when:
- the required local proof exists
- artifacts support the claims
- the scope-specific gate is passed

### LOCAL_COMPLETE
Use when:
- all required local components for the workstream are proven
- remaining gaps are explicitly categorized as production validation or later work

### PRODUCTION-VALIDATED
Use only when:
- production validation artifacts exist in repo-linked evidence
- deployment/runtime conditions were exercised as required
- the decider approved the claim

## Override threshold
Overrides are allowed only when:
- readiness is `CONDITIONALLY_READY`
- there is a written override record
- rollback plan exists
- expiry exists
- scope is explicitly bounded

## Accepted-risk threshold
A risk may be accepted only when all are present:
- named owner
- reason
- blast radius
- expiry date
- revalidation trigger
- decider approval

## Retry / self-heal threshold
Autonomous repair may retry only within bounded limits.

### Default local bounds
- max 3 consecutive self-heal attempts per run without materially different error signature
- bounded cost threshold per run
- if limit is reached, stop and escalate

## Documentation threshold
AI-generated documentation may be drafted automatically, but canonical promotion requires:
- human review or explicit approval path
- alignment with actual run artifacts
- no contradiction with doctrine

## Compliance threshold
Compliance-style outputs are advisory unless explicitly backed by a real legal or policy review workflow. AI may produce a compliance memo, but not legal sign-off.

## Final rule
Automation may recommend every step. It may not own the last word on production, risk, or doctrine.

---

# AUTOPILOT_LOCAL_SPEC.md

## Purpose
Define `autopilot:local` as the single local orchestration backbone for evidence-grade engineering execution. It runs the local pipeline end-to-end, stops at the gate, and produces append-only artifacts for review.

## Core rule
`autopilot:local` is the local execution and evidence runner. It does not deploy, merge, or self-approve critical release decisions.

## Non-goals
`autopilot:local` does not:
- call production deployment targets
- merge branches automatically
- accept risk automatically
- label production validation without production artifacts
- replace human release authority in trigger domains

## Run folder contract
Each invocation creates one run folder:

`artifacts/runs/<run_id>/`

### Required top-level artifacts
- `meta.json`
- `stdout.log`
- `stderr.log`
- `review-input.json`
- `result.json`
- `failure_packet.json` only on failure

### Suggested subfolders
- `logs/`
- `analysis/`
- `outputs/`
- `evidence/`
- `patches/`

## Required metadata
`meta.json` should include at minimum:
- `run_id`
- `timestamp`
- `source_commit`
- `files_changed`
- `domain_tags_derived`
- `change_ref` or `pr_id` when available

## Detection stage
`autopilot:local` must determine what changed using:
- `git diff --name-only` against the target base when possible
- fallback to `git status --porcelain` only when necessary

## Domain-tag derivation
`autopilot:local` must derive required domain tags from changed paths.

Examples:
- payment / webhook / settlement paths → `money_state`
- public endpoint tenant-sensitive changes → `tenant_isolation`
- status helpers / transition code → `state_machine`
- auth / tenancy / policy surfaces → `identity_boundary`

The run must record:
- derived tags
- derivation inputs
- any mismatch between declared and derived tags

## Proof-pack execution
For derived trigger domains, `autopilot:local` runs required local proof packs.

Examples:
- `tenant_isolation` → relevant tenant tests
- `money_state` → relevant P0-02 proof packs
- `state_machine` → state transition/invariant packs when defined

All test output must be captured into the run folder.

## Review gate integration
`autopilot:local` must generate or refresh a run-scoped `review-input.json` and then run:

`npm run review:gate`

The gate is the local SSOT for review enforcement.

## Result contract
### PASS
On success, write `result.json` with:
- run_id
- status
- readiness label
- artifact pointers
- derived domain tags
- proof packs executed

### FAIL
On failure, write `failure_packet.json` with:
- failed step
- error summary
- pointers to logs
- domain tags
- safe next action
- whether autonomous retry is allowed

## Role handoff model
Roles do not communicate through chat. They communicate through append-only run artifacts.

### Communication layer
The run folder is the single coordination surface.

### Role output lanes
- ChatGPT → `analysis/chatgpt_*.json|md`
- Claude → `analysis/claude_*.json|md`
- Gemini → `analysis/gemini_*.json|md`
- Codex → repo changes plus `outputs/codex_*.json|md`

No two roles should write the same file.

## 3x review integration
When the domain requires full critique, `autopilot:local` may trigger a 3x review pass using separate role outputs:
- structural review
- operational review
- pressure review
- synthesis review

These are append-only artifacts, not mutable coordination state.

## Circuit breaker
To prevent infinite self-heal loops:
- max 3 consecutive repair attempts per run for materially identical failure signature
- after threshold, stop and escalate
- write blocker artifact such as `BLOCKED_BY_RETRY_LIMIT.md` or structured equivalent

## Cost guardrail
If cost tracking is available, the run may include budget tracking.
If the configured local budget threshold is exceeded:
- stop
- write blocker artifact
- require human review before continuation

## Concurrency model declaration
For any background/sweeper/async work reviewed within a run, the work must declare whether it is:
- `lock_based`
- `dedupe_based`

And must specify:
- guarantees
- non-guarantees

## Documentation drafting
Historian-style documentation may be drafted from the run, but canonical docs must only be promoted intentionally.

Optional intent file:
- `vibe_intent.txt`
If present, it may be used to enrich rationale drafting.
If absent, documentation remains technical-only.

## Human stop conditions
`autopilot:local` must stop and require a human decider when:
- trigger-domain production deployment is requested
- accepted risk is required
- override is required
- doctrine changes are proposed
- break-glass action is needed
- retry or cost limits are exceeded

## Design principle
Use append-only artifacts, not mutable coordination state. The run folder is the evidence trail and the handoff surface.

## Summary
`autopilot:local` is the deterministic local nervous system:
- detect change
- derive domains
- run proof
- capture artifacts
- run gate
- stop cleanly

It prepares work for decision. It does not replace decision authority.

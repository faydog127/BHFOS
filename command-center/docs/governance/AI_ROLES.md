# AI Roles (Governance) — v2

Updated: 2026-04-05  
Scope: governance only (no runtime behavior change)

## Purpose
Define fixed roles for AI participation in the engineering workflow so multiple models can collaborate without overlapping authority, corrupting evidence, or drifting into undefined behavior.

## SSOT Rule
The **run folder artifacts** are the single source of truth (SSOT). Chat is non-authoritative unless the decision is recorded back into artifacts.

## Core Rule
AI roles are **specialized**. They do not share equal authority.

- One role owns implementation.
- One role owns doctrine and critique.
- One role owns historical rationale and evidence drafting.
- One role owns adversarial and business-alignment challenge.
- A human decider owns release, override, doctrine change, and risk acceptance.

## Canonical Alignment (Must Match Repo Enforcement)

### Domain tags (authoritative list)
These domain tags are enforced by `review:gate` and are the canonical trigger set:

- `tenant_isolation`
- `money_state`
- `acceptance_commit`
- `state_machine`
- `completion_gate`

If new domain tags are needed, they must be added via a policy update to `review-policy.json` and corresponding gate enforcement in `tools/review-gate.mjs`.

### Readiness schema (authoritative)
`review:gate` enforces:

- `readiness.status` ∈ `{ NOT_READY | CONDITIONALLY_READY | READY }`
- `readiness.labels[]` ∈ `{ "P0-02: LOCAL_PROVEN" | "P0-02: PRODUCTION-VALIDATED" }`

Any new readiness label requires updating `review-policy.json` and `tools/review-gate.mjs`.

## Role Map (Capability-first; current tool examples in parentheses)

### 1) Builder (Codex)
Primary function:
- Implement code changes in the repo
- Update tests and migrations
- Run repo-local proof packs
- Produce evidence-grade outputs and artifacts

Allowed outputs:
- Code changes
- Test updates
- Migration files
- Patch summaries
- Local proof notes

Not allowed to own:
- Final doctrine changes
- Risk acceptance
- Production readiness claims (beyond what artifacts prove)
- Production deployment approval

### 2) Doctrine Lead / Crucible Lead (ChatGPT)
Primary function:
- Draft and refine briefs
- Run 3x review / critique process
- Enforce architecture boundaries
- Define what must be proven
- Synthesize multi-model findings into one decision surface

Allowed outputs:
- Discovery briefs
- Crucible reviews
- Synthesis memos
- Readiness recommendations (must map to gate schema)

Not allowed to own:
- Direct production release approval
- Unilateral doctrine promotion without human acceptance
- Silent risk acceptance

### 3) Historian / Long-Context Reviewer (Claude)
Primary function:
- Draft rationale and architecture updates
- Maintain continuity across decisions
- Compare implementation against prior doctrine/evidence
- Produce documentation drafts backed by artifacts

Allowed outputs:
- Evidence addenda
- Rationale drafts
- Architecture/domain map drafts
- Continuity notes

Not allowed to own:
- Canonical doctrine promotion without review + human promotion
- Compliance sign-off as legal authority
- Production approval

### 4) Adversary / Business-Alignment Critic (Gemini)
Primary function:
- Pressure-test assumptions
- Identify blind spots and operational contradictions
- Compare technical work to business goals
- Challenge overconfidence and hidden coupling

Allowed outputs:
- Adversarial critiques
- Pressure scenarios
- Escalation recommendations

Not allowed to own:
- Final production release approval
- Final risk acceptance
- Direct mutation of canonical doctrine

### 5) Human Decider (Release / Risk / Doctrine Authority)
Primary function:
- Approve or reject production release
- Accept, defer, or reject risk
- Approve doctrine changes
- Approve overrides and break-glass actions
- Resolve irreducible conflicts between AI outputs

Required for:
- Trigger-domain production releases (money/state/identity/external truth ingestion)
- Override use
- Doctrine revisions
- Break-glass operations
- Accepted-risk sign-off

## Operating Principles

### Role isolation
Roles write only to their own output lane. Shared coordination happens through **append-only artifacts** in a run folder.

### Evidence over narrative
Claims must be grounded in artifacts (diffs, logs, tests, DB outputs) or explicit doctrine.

### Recommendation vs authority
AI roles may recommend. Human authority approves.

### Promotion boundary
Drafts may be generated automatically. Canonical docs are promoted intentionally.

## File ownership model (practical)
- Builder outputs: repo changes + run folder outputs
- Doctrine outputs: briefs, reviews, synthesis (in run folder lane)
- Historian outputs: rationale, evidence drafts, architecture drafts (in run folder lane)
- Adversary outputs: critiques, pressure scenarios (in run folder lane)
- Human-promoted canon: doctrine/policy/thresholds

## Non-negotiable guardrails
- No AI role can self-approve production deployment in critical domains.
- No AI role can silently accept risk.
- No AI role can overwrite canonical doctrine without human promotion.
- No AI role can claim production validation without in-repo production artifacts.


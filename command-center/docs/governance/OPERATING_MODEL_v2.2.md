# BHFOS Operating Model — v2.2 (Production Operations and Founder Focus)

Governance version: **v2.2**
Scope: **governance only** — documentation, agent definitions, and operating
rules. This document changes **no** application runtime behavior, touches **no**
Supabase schema/function/data, runs **no** migration, provisions **no**
credential, grants **no** actual production access, and triggers **no**
deployment.

Status relative to prior canon: **additive**. v2.2 extends v2
([`AI_ROLES.md`](./AI_ROLES.md), [`APPROVAL_THRESHOLDS.md`](./APPROVAL_THRESHOLDS.md))
and the V1 operating-model rule
([`../../.cursor/rules/v1-operating-model.mdc`](../../.cursor/rules/v1-operating-model.mdc)).
It repeals none of their controls. Where any wording appears to conflict, the
stricter control wins and v2 remains authoritative for role authority, domain
tags, and readiness schema.

---

## 0. North Star

> **Protect Founder Focus and Energy while allowing safe, useful development and
> production operations to move quickly.**

Everything below is subordinate to that objective. If a rule in this model starts
costing more Founder Focus and Energy than the risk it manages, the coordinating
role must **consolidate and simplify** (see §7, Founder Burden stop condition).

### Governing principles

- Governance is **proportional to actual risk**, not to habit or ceremony.
- Agent roles are **available capabilities, not a mandatory assembly line**. Not
  every release needs every agent.
- Agents complete **authorized mechanical work** instead of handing it back to
  the founder.
- The founder makes **business and risk decisions**, not technical deployments,
  debugging, log review, credential management, or artifact maintenance.
- Routine releases normally require **one consolidated founder decision**.
- **Repeated approval requests for an unchanged release are prohibited.**
- Each release or incident has **one active coordinating owner** at a time.
- No agent role may **self-authorize** production, risk, or doctrine.

---

## 1. Related documents (the v2.2 package)

| Document | Purpose |
| --- | --- |
| This file | The v2.2 spine: risk tiers, Definition of Done, evidence standards, Founder Focus rules, HALT, tie-break/escalation, versioning and pinning. |
| [`PRODUCTION_ACCESS_MATRIX.md`](./PRODUCTION_ACCESS_MATRIX.md) | Exact action-level production permissions per role. |
| [`INCIDENT_AND_PRODUCTION_READINESS.md`](./INCIDENT_AND_PRODUCTION_READINESS.md) | P0–P3 incident model, Incident Commander, drift, readiness baseline, synthetic-data rules, fire-drill plan. |
| [`AGENT_PILOT_SCORECARD.md`](./AGENT_PILOT_SCORECARD.md) | Lightweight, agent-maintained effectiveness scorecard. |
| [`FOUNDER_RUN_READINESS.md`](./FOUNDER_RUN_READINESS.md) | Mandatory gate before Founder terminal/OAuth/credential/dashboard actions. |
| [`FOUNDER_DELEGATED_AUTHORITY_POLICY.md`](./FOUNDER_DELEGATED_AUTHORITY_POLICY.md) | Categories A/B/C — when Orchestrator proceeds without Founder interruption vs Category C auth. |
| [`ENVIRONMENT_ACCEPTANCE.md`](./ENVIRONMENT_ACCEPTANCE.md) | Platform-path acceptance when OS/browser/OAuth/path behavior matters. |
| [`LOW_RISK_CONTROL_PLANE_CORRECTION.md`](./LOW_RISK_CONTROL_PLANE_CORRECTION.md) | Bounded lane for delegated merge of low-risk control-plane corrections. |
| [`templates/RELEASE_BATON.template.yaml`](./templates/RELEASE_BATON.template.yaml) | Machine-readable release-state artifact (per active release). |
| [`templates/DECISION_PACKET.template.md`](./templates/DECISION_PACKET.template.md) | One consolidated founder-facing decision surface per routine release. |
| [`templates/RELEASE_LEDGER.template.yaml`](./templates/RELEASE_LEDGER.template.yaml) | Persistent, append-only record of releases and production actions. |
| [`templates/AGENT_STATUS_REPORT.template.md`](./templates/AGENT_STATUS_REPORT.template.md) | TECHNICAL RESULT / GOVERNANCE STATUS / AUTHORIZED NEXT STATE contract. |

Prior canon that remains authoritative: [`AI_ROLES.md`](./AI_ROLES.md),
[`APPROVAL_THRESHOLDS.md`](./APPROVAL_THRESHOLDS.md), the machine gate
(`review-policy.json` + `tools/review-gate.mjs`), and GitHub + CI for live PR and
check state.

---

## 2. Roles as available capabilities

Roles are capabilities invoked when a release or incident needs them. They are
**not** a fixed pipeline that must run end-to-end for every change.

| Role | Definition file | One-line purpose |
| --- | --- | --- |
| V1 Orchestrator | [`../../.cursor/agents/v1-orchestrator.md`](../../.cursor/agents/v1-orchestrator.md) | Plans one bounded release; assigns risk tier; opens the Baton; produces the Decision Packet. |
| V1 Builder | [`../../.cursor/agents/v1-builder.md`](../../.cursor/agents/v1-builder.md) | Implements one approved brief and opens a PR. Never operates production. |
| Architecture Guard | [`../../.cursor/agents/architecture-guard.md`](../../.cursor/agents/architecture-guard.md) | Independent contract/architecture/scope review. Never operates production. |
| Independent UAT | [`../../.cursor/agents/independent-uat.md`](../../.cursor/agents/independent-uat.md) | Independent behavior verification; controlled production UAT only when the Baton authorizes it. |
| Release Agent | [`../../.cursor/agents/release-agent.md`](../../.cursor/agents/release-agent.md) | Mechanical merge of one exact, human-authorized PR; records to the Ledger. |
| Production Operator | [`../../.cursor/agents/production-operator.md`](../../.cursor/agents/production-operator.md) | Authorized production mechanics (deploy approved SHA, smoke, rollback, health, synthetic data). |
| Production Diagnostics | [`../../.cursor/agents/production-diagnostics.md`](../../.cursor/agents/production-diagnostics.md) | Read-only production diagnosis and root-cause recommendation. |
| Production Incident Commander | [`../../.cursor/agents/production-incident-commander.md`](../../.cursor/agents/production-incident-commander.md) | Coordinates response for P0/P1/qualifying P2 incidents. |
| Founder / Human Decider | — | Owns the last word on production, risk, and doctrine. |

**Separation of duties is preserved:** the chat/agent that implements a change
does not certify, merge, or deploy its own work (per
[`../../.cursor/rules/v1-operating-model.mdc`](../../.cursor/rules/v1-operating-model.mdc)).

### One active coordinating owner

At any moment a release or incident has exactly **one** active coordinating
owner, recorded as `current_owner` on the Release Baton:

- Release planning/coordination → **V1 Orchestrator**.
- Merge execution → **Release Agent** (only under explicit human authorization).
- Production change execution → **Production Operator** (only under explicit
  authorization).
- Active declared incident (P0/P1/qualifying P2) → **Production Incident
  Commander** until the incident is closed and the system returns to normal
  release governance.

Handoffs are recorded on the Baton (`current_owner` → `next_owner`). Conflicting
simultaneous ownership is a stop condition.

---

## 3. Risk tiers

Governance is proportional to risk. **Do not require every agent for every
release.** The Orchestrator assigns a tier at planning time and records it on the
Baton (`risk_tier`). Trigger domains
(`tenant_isolation`, `money_state`, `acceptance_commit`, `state_machine`,
`completion_gate`) force **Tier 3** regardless of surface size, consistent with
[`AI_ROLES.md`](./AI_ROLES.md) and `review-policy.json`.

### Tier 1 — low risk

Low-risk UI, copy, bounded component repairs, tests, and documentation.

- **Minimum required roles:** Orchestrator (brief may be one paragraph) →
  Builder PR → **a different chat** confirms → owner one-click accept → Release
  Agent merge.
- **Required evidence:** green required CI checks; SOURCE-level diff review; a
  brief different-chat confirmation. USABLE evidence only where user-visible
  behavior actually changed.
- **Required reviews:** independent Architecture Guard review **optional**;
  Independent UAT lightweight.
- **Production verification:** not required unless something is deployed; if
  deployed, Production Operator confirms deployed SHA and a bounded smoke check.
- **Owner checkpoint:** one consolidated accept (Decision Packet may be short).
- **Rollback expectation:** revertable PR; rollback point recorded on the Baton.
- **When to add roles:** add Architecture Guard or full UAT only if review shows
  hidden coupling, shared-component blast radius, or a mis-tiered change.

### Tier 2 — meaningful behavior

Operational workflows, shared components, inspections, scheduling, intake, and
other meaningful user behavior.

- **Minimum required roles:** Orchestrator brief → Builder PR → Architecture
  Guard review → Independent UAT (USABLE) → owner checkpoint → Release Agent
  merge → deploy under authorization when applicable.
- **Required evidence:** green required CI checks; Architecture Guard verdict
  `APPROVE_FOR_INDEPENDENT_UAT`; Independent UAT reaching **USABLE** on the
  approved workflow; deployed-SHA confirmation when deployed.
- **Required reviews:** Architecture Guard **required**; Independent UAT
  **required**.
- **Production verification:** if deployed, Production Operator verifies deployed
  SHA + health; Independent UAT may perform controlled production UAT **only**
  when the Baton authorizes it (see §8b of the brief and `independent-uat.md`).
- **Owner checkpoint:** one consolidated Decision Packet.
- **Rollback expectation:** predefined rollback point recorded before any
  production change.
- **When to add roles:** add Production Diagnostics/Incident Commander only on an
  incident; add Tier 3 controls if a trigger domain is touched.

### Tier 3 — high risk

Authentication, authorization, tenant isolation, migrations, money-loop and
financial actions, customer communications, secrets, security controls, and
destructive data operations.

- **Minimum required roles:** full chain — Orchestrator → Builder → Architecture
  Guard → Independent UAT → owner checkpoint → Release Agent merge → Production
  Operator deploy **under separate explicit authorization**.
- **Required evidence:** everything in Tier 2 **plus** `review:gate` trigger-domain
  gate satisfied per `review-policy.json`; explicit **written** owner approval for
  any migration; recorded rollback point; drift check clean
  ([`INCIDENT_AND_PRODUCTION_READINESS.md`](./INCIDENT_AND_PRODUCTION_READINESS.md)).
- **Required reviews:** Architecture Guard **required**; Independent UAT
  **required**; independent governance review for doctrine/permission changes.
- **Production verification:** Production Operator verifies deployed SHA,
  environment identity, health, and rollback readiness **before** the change;
  post-change verification recorded to the Ledger.
- **Owner checkpoint:** consolidated Decision Packet with an explicit, exact
  authorization request; migrations and financial/destructive actions each
  require **separate** explicit human authorization.
- **Rollback expectation:** predefined, tested rollback point mandatory before
  change; rollback authority pre-assigned.
- **When to add roles:** Production Diagnostics and Incident Commander are added
  when a Tier 3 change is implicated in an incident.

---

## 4. Definition of Done and evidence standards by tier

Evidence tiers are inherited unchanged from the operating-model rule:
**SOURCE-ONLY** / **DEPLOYED** / **REACHABLE** / **USABLE**. Only **USABLE**,
confirmed by the owner or independently observed, may be called **PASS**.
Forbidden without evidence: "healthy", "fully verified", "should work", "deployed
successfully".

| Requirement | Tier 1 | Tier 2 | Tier 3 |
| --- | --- | --- | --- |
| Approved brief (may be short) | required | required | required |
| Focused tests or documented reason none | required | required | required |
| Green required CI checks | required | required | required |
| Architecture Guard verdict | optional | required | required |
| Independent UAT to USABLE | where behavior changed | required | required |
| `review:gate` trigger-domain gate | n/a unless triggered | if triggered | required when triggered |
| Written owner approval for migration | n/a | n/a | required |
| Recorded rollback point | required | required | required (tested) |
| Deployed-SHA + environment identity confirmed | if deployed | if deployed | required when deployed |
| Drift check clean before release | n/a | recommended | required |
| Decision Packet | short form ok | required | required (exact authorization) |
| Ledger entry on completion | required | required | required |

"Done" for a release means: the tier's evidence exists, the owner gave the single
authorization the Decision Packet requested, the authorized mechanical work
completed, and the Ledger entry is written by an agent.

---

## 5. Governance versioning and pinned-version rules

- This release promotes the model to **v2.2**. v2 remains authoritative for role
  authority, domain tags, and readiness schema.
- **Pinning rule:** every Release Baton and Decision Packet records the exact
  governance version it was planned under (e.g. `governance_version: v2.2`). A
  release executes under the version pinned at **planning time**. A mid-flight
  governance change does **not** silently re-govern an in-flight release.
- No new domain tags or readiness labels are introduced by v2.2. Domain tags and
  readiness schema remain owned by `review-policy.json` and `tools/review-gate.mjs`.

---

## 6. Founder Focus and Energy operating rules

- The founder makes **business and risk decisions**, not technical mechanics.
- The founder is **not** asked to run commands, inspect logs, manage credentials,
  relay technical messages between chats, or perform deployment mechanics.
- **One consolidated decision per routine release.**
- **One unchanged release must not produce repeated approval requests.**
- The founder is **never asked to repeat data** already available in the brief,
  the Baton, GitHub, CI, the Ledger, or verification evidence.
- **Delegated authority:** Routine read-only, reversible, non-destructive work
  proceeds under standing authority per
  [`FOUNDER_DELEGATED_AUTHORITY_POLICY.md`](./FOUNDER_DELEGATED_AUTHORITY_POLICY.md)
  (Categories A/B). Do **not** interrupt the Founder for metadata checks,
  planning drafts, review dispatch, or other Category A/B work. Category C
  (merge, migration apply, deploy, new slice, financial/security mutation, etc.)
  still requires explicit Founder authorization.

### Founder interruption protocol

- **P0 / P1:** may interrupt immediately (including quiet hours).
- **P2:** interrupts only when business judgment or extraordinary authority is
  required; otherwise batched.
- **P3 / routine releases:** batched into one Decision Packet.
- **Quiet hours:** broken only for defined critical conditions (P0/P1 or a
  documented critical drift/security condition — see
  [`INCIDENT_AND_PRODUCTION_READINESS.md`](./INCIDENT_AND_PRODUCTION_READINESS.md)).

---

## 7. Founder Burden controls and stop condition

**Founder Burden controls (explicit):**

- Maintaining the Release Baton, Release Ledger, Agent Pilot Scorecard, and
  Decision Packet is **agent work**. The founder is **not** responsible for
  manually updating any governance artifact.
- The founder must **not** be asked to repeat information already available in the
  brief, Baton, GitHub, CI, Ledger, or verification evidence.
- Routine releases should normally require **one** founder authorization.
- **Repeated approval requests for the same unchanged PR and SHA are prohibited.**
- The founder should **not** be asked to run commands, inspect logs, manage
  credentials, or perform deployment mechanics.
- No path may route technical deployment, debugging, log review, credential
  management, or artifact maintenance to the founder.

**Founder Burden stop condition:**

- If an agent is about to hand the founder mechanical/technical work (commands,
  logs, credentials, message-relaying, deployment mechanics), it must **STOP**,
  record the burden as a blocker on the Baton (`blockers`), and route that work to
  the correct agent role instead of the founder.
- If the same release would trigger a repeat approval request with no material
  change, that is a Founder Burden condition — **HALT and consolidate** rather
  than re-ask (see §9).
- **When process burden exceeds release risk, the coordinator must consolidate
  and simplify** the governance path for that release.

---

## 8. Tie-break and escalation rules

- Roles **recommend**; the human decider owns the **last word** on production,
  risk, and doctrine (consistent with [`AI_ROLES.md`](./AI_ROLES.md) and
  [`APPROVAL_THRESHOLDS.md`](./APPROVAL_THRESHOLDS.md)).
- During a declared incident, the **Production Incident Commander** holds
  coordination authority for containment and rollback **within the declared
  severity**. Conflicts about business risk or financial action escalate to the
  founder.
- Irreducible conflicts between agents escalate to the founder as a **single
  consolidated summary**, never as competing chat threads.
- No agent may resolve a tie by self-authorizing an action reserved for the human
  decider (production release in trigger domains, accepted risk, override,
  doctrine change, break-glass, irreversible data mutation).

---

## 9. HALT and consolidate policy

HALT is a **governance command, not a fictional technical kill switch.** It is not
claimed to technically cancel independent sessions or running jobs unless tooling
actually supports that.

When HALT is issued:

- **no** new commits;
- **no** merges;
- **no** deployments;
- **no** migrations;
- **no** production mutations;
- active roles record their **exact stopping state** on the Release Baton;
- the coordinating owner creates **one** consolidated Decision Packet;
- work resumes **only** after explicit authorization.

**Future technical emergency-brake capabilities** (documented as future, not built
in v2.2, and requiring the later controlled implementation): cancel active
workflows; pause deployments; revoke credentials; disable scheduled production
actions. See
[`INCIDENT_AND_PRODUCTION_READINESS.md`](./INCIDENT_AND_PRODUCTION_READINESS.md).

---

## 10. Persistent records

- **Release Baton** — one per active release; the current handoff state and
  verified references. GitHub and CI remain authoritative for live PR/check state.
- **Release Ledger** — persistent, append-only record of releases, merges,
  deployments, migrations, and production actions.
- **Agent Pilot Scorecard** — lightweight effectiveness signals.

All three are **agent-maintained** and must **not** contain credentials, secrets,
customer data, copied logs, screenshots, or sensitive production details.

---

## 11. Controlled production access

Actual production access is defined by
[`PRODUCTION_ACCESS_MATRIX.md`](./PRODUCTION_ACCESS_MATRIX.md) and is exercised
**only by designated roles under exact authorization**. No agent self-authorizes
production. **No production access, credential, or capability is configured by this
governance release** — provisioning is a later, separately approved controlled
implementation.

---

## 12. Founder Focus operating contract (G2.3 additive)

This section tightens the operating contract without repealing merge, deploy,
credential, or production controls. Full procedures live in the linked docs.

### 12.1 FOUNDER_RUN_READINESS

Before asking the Founder to run a terminal command, approve OAuth consent, enter
or rotate credentials, use a platform dashboard, execute a protected launcher,
interact with production infrastructure, or perform any environment-specific
manual action, the coordinating owner must produce a FOUNDER_RUN_READINESS
report per [`FOUNDER_RUN_READINESS.md`](./FOUNDER_RUN_READINESS.md). The report
must end with exactly `FOUNDER_RUN_READY` or `FOUNDER_RUN_BLOCKED`. If blocked,
the Founder must not receive the execution command.

### 12.2 Completion status contract

Every Builder, Architecture Guard, Release Agent, Production Operator,
Diagnostics, and Orchestrator report must distinguish:

- **TECHNICAL RESULT** — what executed or was observed
- **GOVERNANCE STATUS** — accepted / not accepted / blocked / pending, and why
- **AUTHORIZED NEXT STATE** — the exact next authorized action

No agent may use words such as complete, closed, approved, ready, or successful
without identifying whether the statement refers to technical execution or
governance acceptance. Template:
[`templates/AGENT_STATUS_REPORT.template.md`](./templates/AGENT_STATUS_REPORT.template.md).

### 12.3 ENVIRONMENT_ACCEPTANCE

When work depends on Windows, PowerShell, browser launch, OAuth redirects, local
listeners, certificates, filesystem paths, worktree state, deployment CLIs,
external platforms, shell quoting/escaping, or OS-specific executable discovery,
[`ENVIRONMENT_ACCEPTANCE.md`](./ENVIRONMENT_ACCEPTANCE.md) is required before
Founder execution. Path-level integration (mocks allowed) beats isolated unit
coverage alone.

### 12.4 Founder responsibility boundary

Founder responsibilities **may** include:

- business authorization
- approval of material residual risk
- account-owner consent
- OAuth consent
- entry of credentials into an approved external secret store
- approval of production mutation
- approval of financial or customer-facing actions

Founder responsibilities **must not** include:

- diagnosing shell errors
- debugging worktree state
- finding file-extension mismatches
- identifying stale launcher pins
- validating executable paths
- comparing technical configuration across files
- determining whether tests apply to the correct SHA
- manually relaying routine technical reports between agents
- reconstructing commands from multiple instructions

When a Founder action fails, the Orchestrator classifies and routes the failure
without asking the Founder to diagnose it.

### 12.5 Early Architecture Guard

Architecture Guard must review the **execution design** before Founder execution
when the proposed design introduces or changes credentials, OAuth, callbacks,
certificates, external platform assumptions, production identities, access
scopes, executable launching, production diagnostics, or deployment/rollback
behavior. A post-implementation code review alone is not sufficient for these
classes. Post-PR Architecture Guard remains required for Tier 2/3 as before.

### 12.6 Automatic handoff ownership

The persistent Orchestrator owns routine inter-agent handoffs. The Founder
should not normally be asked to copy Builder reports to Architecture Guard,
Architecture Guard results to Release Agent, merge reports back to Orchestrator,
or routine CI status between tabs. Where Cursor limitations prevent automated
handoff, the Orchestrator produces **one** compact, complete relay block and
states why manual relay is unavoidable. Founder relay count is a process metric
([`AGENT_PILOT_SCORECARD.md`](./AGENT_PILOT_SCORECARD.md)).

### 12.7 LOW-RISK_CONTROL_PLANE_CORRECTION

A bounded delegated-merge lane exists for low-risk control-plane corrections
only, under every eligibility gate in
[`LOW_RISK_CONTROL_PLANE_CORRECTION.md`](./LOW_RISK_CONTROL_PLANE_CORRECTION.md).
Founder exact PR/SHA merge authorization remains mandatory for credentials,
OAuth, production access/diagnostics, deployment, rollback activation,
migrations, production mutation, financial actions, customer communication,
material residual-risk acceptance, customer-facing behavior, and for the
governance PR that activates the lane.

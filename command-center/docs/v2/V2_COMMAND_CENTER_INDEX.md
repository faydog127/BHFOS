
# BHFOS V2 — Command Center

| Field | Value |
| --- | --- |
| Status | Active |
| Version | 0.1 |
| Owner | Founder |
| Last reviewed | 2026-08-01 |
| Source baseline | `c65a923` |
| Implementation authority | Active governance authority; no implementation authority |

## Current control state

| Item | Current state |
| --- | --- |
| Active phase | Command Center foundation |
| Active implementation slice | None |
| Active release | None |
| Next required action | Reconcile Product Definition and planning registers |
| Decisions awaiting approval | None |
| Coding authorized | No |
| Current blocker | None |
| Implementation blocker | Product definition and planning registers not yet reconciled |

## Purpose

This index is the active landing page for V2 product governance, requirements, release control, risk management, workflow definition, and evidence. The governance foundation is ratified; it does not authorize V2 application implementation, production changes, migrations, or an implementation release.

## Authority hierarchy

When documents conflict, use this order:

1. Founder-approved decisions in `V2_DECISION_REGISTER.md`.
2. Ratified product direction in `V2_PRODUCT_DEFINITION.md`.
3. Authorized release scope in `V2_RELEASE_REGISTER.md`.
4. Approved requirements in `V2_REQUIREMENTS_REGISTER.md`.
5. Architecture decisions and implementation plans.
6. GitHub issues and pull requests.
7. Conversation history and informal notes.

A lower-level artifact may not silently override a higher-level decision.

## Authority lifecycle

`Conversation or observation` → `Inbox item` → `Discovery` → `Proposed requirement or decision` → `Founder approval` → `Active authority` → `Release assignment` → `Implementation`

## Work authorization check

Before beginning implementation, a human or AI agent must state:

- Requirement ID;
- active Release ID;
- applicable Decision IDs;
- work item or issue ID;
- branch and worktree;
- intended validation method.

When the Requirement ID or active Release ID is missing, implementation stops.

When a governing decision is missing or unclear, the item moves to `Needs Decision`.

Only one implementation release may have the status `Active` at a time. The founder is the only person who may move a release into or out of `Active`.

## Source-control policy

- No direct implementation work on `main`.
- Every implementation uses a dedicated branch or worktree.
- Every change reaches `main` through a pull request.
- Unrelated changes may not be mixed.
- The branch must be current with its approved base.
- The pull request must link its requirement and release.
- Generated files, secrets, and customer data may not be committed.

## Scope-change control

After a release is authorized, an added requirement must record its reason, expected value, schedule impact, risk impact, what is removed, delayed, or expanded, and founder approval.

## Controlled documents

| Document | Role |
| --- | --- |
| Product Definition | Product direction and boundaries |
| Decision Register | Binding founder and architecture decisions |
| Requirements Register | Approved, deferred, rejected, and discovered requirements |
| Release Register | Release scope, gates, status, and non-goals |
| Risk Register | Product, data, security, financial, and delivery risks |
| Workflow Map | Current and target operating workflows |
| Capability Disposition Matrix | Reuse, redesign, replace, abandon, defer, or investigate decisions |
| Definition of Ready and Done | Entry, completion, traceability, and exception rules |
| Data Classification | Sensitivity vocabulary and handling expectations |
| Weekly Log | Lightweight evidence of ongoing control |

## Weekly review checklist

- Confirm the active phase, implementation slice, and release.
- Review decisions awaiting approval and unresolved `Needs Decision` items.
- Confirm scope changes are recorded before work proceeds.
- Review stale, blocked, and at-risk work.
- Confirm environment, deployment, and validation evidence is current.
- Record material decisions, risks, and the next required action in `V2_WEEKLY_LOG.md`.

If the weekly review cannot establish the active release, authorization traceability, environment, or evidence state, stop new implementation work until the gap is recorded and resolved.

## Stop rule

When the next action is unclear, implementation stops. The ambiguity must be converted into a discovery item, proposed decision, requirement clarification, dependency, or recorded blocker.

## Terminology control

Use `capability`, `requirement`, `implementation slice`, or `product area` for controlled work. Use `implementation slice` for work in progress. Avoid the ambiguous term `feature` in governance records.

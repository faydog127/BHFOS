# Command Center Fast Lane for Codex (MODE_A)

Use this prompt for tiny, low-risk Codex tasks where speed matters more than heavy orchestration.

This is the **MODE_A companion**. If you are using the v3 Orchestrator, only use this after it selects **MODE_A**.

---

Treat this task as a **Command Center Fast Lane task**.

Your job is to complete one small, low-risk task quickly without drifting into unrelated systems.

## Use Fast Lane only when all are true
- the task is narrow
- one primary file or one tiny file group is involved
- no deploy or infrastructure changes are needed
- no external auth, Docker, or service dependency is required
- no parallel agents are needed
- the user would benefit from speed over ceremony

## Do not use Fast Lane for
- deploy or infrastructure work
- cross-system integration
- n8n + CRM + TIS coordination
- any task needing multiple agents
- anything with meaningful production risk
- anything blocked by credentials, Docker, external services, or missing contracts

If any of those are true, escalate to the Serious Task prompt (MODE_B) or the full Orchestrator (MODE_C).

## Core rules
- Inspect first
- Keep scope tight
- Touch only the minimum necessary files
- Do not create placeholder files or fake abstractions
- Do not claim completion without validation
- If the task grows, stop and escalate

## Blocked-State Behavior

If blocked by Docker, auth, missing secrets, missing contract, unavailable service, or unclear source-of-truth:
- do not expand scope
- do not start unrelated work
- do one of the following only:
  1. report the blocker
  2. propose the minimum unblock action
  3. identify the best fallback task if explicitly requested

## Founder Pressure Protection

If the user is juggling multiple urgent tasks:
- choose the one task that creates a real-world outcome now
- defer everything else explicitly (do not “squeeze it in”)

## Required output format
0. Selected mode: MODE_A
1. Objective
2. Scope
3. Risk
4. Change made
5. Validation
6. Next step

## Escalation rule
Escalate out of Fast Lane if:
- more than one system boundary appears
- validation becomes non-trivial
- more than a small file set is affected
- blockers appear
- risk is higher than low

## Example
Current job:
Fix the property address in the report header and remove one line of pre-sale wording.

Constraints:
- Keep changes minimal
- Validate in regenerated HTML/PDF

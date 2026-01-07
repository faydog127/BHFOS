ROLE ALIGNMENT
Author: ChatGPT
Work State: S1
Current Goal: Save WORK_EXECUTION_MODEL.md (v2.1) into the repo alongside AI_ROLES.md

CONTENT

# WORK_EXECUTION_MODEL.md (v2.1)

## Purpose
A governed execution system for **BHF on Hostinger Horizons**, designed for **Vibe Coding**. Ensures work doesn’t drift, debugging doesn’t spiral, state corruption is prevented/detected, and Horizons is used as a Junior Developer (not source of truth).

## Core Principles
1. State > Code: We own the state machine, invariants, decision logic; Horizons writes syntax.
2. Prompt Payload Is the Deliverable: primary artifact is a high-fidelity prompt (context, problem, fix strategy, invariants).
3. You Are the Context Bridge: paste relevant files/snippets/schema; we return a Prompt Payload to paste into Horizons.
4. Linear Handoffs: every output specifies who owns it, who gets it next, and why.
5. Evidence-First Debugging: no “try this”; evidence (logs/DB/Nerve Center) required.

## Work State Machine
| State | Meaning | Exit Criteria |
| --- | --- | --- |
| S0 — UNFRAMED | Ambiguous issue/request | Repro Packet (bugs) or Ticket Frame (features) |
| S1 — FRAMED | Scope + invariants defined | Strategy defined (what & why) |
| S2 — STRATEGY LOCKED | Technical approach chosen | Horizons Prompt Payload written |
| S3 — READY FOR ERRON | Prompt approved/audited | Erron applies prompt in Horizons |
| S4 — VERIFIED | Horizons wrote code | Evidence of correct behavior |
| S5 — DONE | Shipped & stable | Nerve Center confirms logic |

Rule: No skipping states.

## Roles and Ownership
### ChatGPT — Governor / Framer (S0 → S1)
Owns: framing, invariants at risk (tenant/idempotency/money/state), defining Done, routing next role. Constraint: reject new features during freeze.

### Claude — Technical Strategist / Prompt Engineer (S1 → S2)
Owns: Horizons Prompt Payload, logic explanation, fix strategy for concurrency/retries/RLS. Writes: context/problem/fix strategy. Constraint: no raw code unless Horizons fails twice.

### Gemini — Auditor / Adversary (S2 → S3)
Owns: evil-path analysis, invariant enforcement, corruption detection. Authority: any unblocked/unobservable corruption → back to S1.

### Erron — Context Bridge & Executor (S3 → S4)
Owns: paste Prompt Payload into Horizons, verify UI/DB/Nerve Center, report hallucinations/success. Only Erron marks DONE.

## Mandatory Output Contract (ALL AIs)
```
ROLE ALIGNMENT
Author: <ChatGPT | Claude | Gemini>
Work State: <S0–S5>
Current Goal: <one sentence>

CONTENT

NEXT HANDOFF
Send to: <specific role>
Instruction: <exact next action>
```

## Horizons Protocol
1) Single-File Constraint: one file/module per cycle; minimal schema.
2) Prompt Payload (S3):
```
📋 HORIZONS PROMPT PAYLOAD (COPY THIS)
Target File: <path>
Context: <what file does/where it fits>
Problem: <what is broken or risky>
Fix Strategy: <logical steps, not syntax>
⚠️ INVARIANTS (DO NOT VIOLATE)
- Tenant isolation enforced (tenant_id scoped everywhere).
- No optimistic UI settles without DB confirmation.
- External actions idempotent.
- Do not introduce new features/tables/configs.
```
3) Hallucination Detector: Erron must confirm only target file touched, no invented APIs/tables, imports/context preserved, invariants respected. Any NO → HORIZONS_HALLUCINATED → back to Claude.

## Debugging Protocol (Nerve Center)
- Not DONE unless Nerve Center shows the intended logic path executed.
- UI success without Nerve Center evidence = state corruption risk.
- If UI looks right but data didn’t persist: check Nerve Center for RLS violations, missing tenant_id, stalled outbox, duplicate attempts.

## Non-Negotiable Rules
- Prompt-first; raw code is fallback only.
- Invariants repeated inside every Prompt Payload.
- One file at a time.
- Gemini veto on silent corruption.
- DONE requires Nerve Center confirmation.

# HOW ERRON USES THIS DAILY (1-Page)
## When Something Breaks
1) Reproduce in Horizons.
2) Capture tenant, URL, steps, expected vs actual, one piece of evidence.
3) Stop after 2 failed attempts.
4) Bring to ChatGPT → S1.
## When You Want Work Done
1) Start with ChatGPT (S0 → S1).
2) Follow handoffs: ChatGPT → Claude → Gemini → You.
3) Paste Prompt Payload into Horizons.
4) Verify UI/DB/Nerve Center.
5) Mark DONE only after evidence.
## Daily 2-Minute Health Check
- Open Nerve Center; check tenant identity, outbox, errors.
## Golden Rule
- If you’re guessing, you skipped a state.

NEXT HANDOFF
Send to: Erron
Instruction: Adopt as canonical alongside AI_ROLES.md; confirm Gemini veto authority.

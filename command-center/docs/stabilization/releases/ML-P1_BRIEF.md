# Release Brief — Money Loop Phase 1 (ML-P1) Planning / Lock Focus

> **Orchestrator / Builder planning output. Planning-only phase. No product
> implementation in this phase.**
>
> This brief locks the Money Loop Phase 1 planning surface after the G2.3
> Stabilization Exit Review (minimum safe baseline met at `6bc8db4…`). It does
> **not** authorize money-loop product/code changes, migrations, deploy,
> production mutation, live Stripe/pay, G2.3 reopen, or B3 re-run.
>
> Implementation of any Phase 1 lock/formalization work requires a **separate**
> Founder authorization naming exact scope, PR, and head SHA.

---

## 0. Release header

| Field | Value |
| --- | --- |
| Release name | **ML-P1 — Money Loop Phase 1 (Planning / Lock Focus)** |
| Governance version pinned | **BHFOS Operating Model v2.2** |
| Release type | Planning / lock-boundary ratification (docs-first) |
| G2.3 exit baseline SHA | `6bc8db4f46bb604c0a3e4c9631985e8314616a8d` |
| ML-P1 planning merge (PR #64) | head `43c776eaf226fb4c0d9a95da18c6b77a0044f711` → merge `dd7bbe3544f9f8ec016330c5f29b9d8f95f02b40` |
| Planning correction | Required before implementation — see `ML-P1_PLANNING_CORRECTION_DECISION_PACKET.md` |
| G2.3 exit | **Complete** — minimum safe baseline (B2D Named Tunnel + B3 read-only adapter); no reopen |
| Planning worktree (initial) | `F:\Dev\BHFOS-ml-p1-plan` / `ml/p1-planning` |
| Planning correction worktree | `F:\Dev\BHFOS-ml-p1-plan-correction` / `ml/p1-planning-correction` |
| Risk tier | **Tier 3** (money-loop / financial domain) — planning ratification only under this brief |
| Application deployment required | **No** |
| Migration execution required | **No** |
| Credential / live pay | **None** |
| Independent workflow UAT | **NOT_APPLICABLE** for this planning PR |

---

## 1. Purpose

Establish the **planning and lock boundary** for Money Loop Phase 1 so later
implementation can close Appendix A evidence and quote→pay lock without silent
scope expansion, without reopening G2.3, and without treating Pillar 1 polish as
Phase 1 by default.

**North Star:** one canonical money loop, evidence-backed lock, Founder Focus
preserved (Founder approves boundaries; agents do authorized mechanical work).

---

## 2. Preconditions verified (read-only)

| Check | Result |
| --- | --- |
| Pinned baseline SHA | `6bc8db4f46bb604c0a3e4c9631985e8314616a8d` |
| G2.3 Stabilization Exit Review | Minimum safe baseline **met**; G2.3 **closed** (no reopen) |
| B3 live connection | Accepted at baseline (project status/health HTTP 200); **no B3 re-run required** for this planning phase |
| Planning worktree / branch | `F:\Dev\BHFOS-ml-p1-plan` / `ml/p1-planning` — clean, on baseline before planning edits |
| Dirty worktree `F:\Dev\BHFOS` | **Not used** |
| Founder auth for this phase | Transition to Money Loop Phase 1 **planning only** authorized at baseline `6bc8db4…` |

---

## 3. Canonical money loop (binding)

Phase 1 planning binds to this canonical loop (Appendix A.2 /
`03_inventory_ui_money_loop.md`; Pillar 1 Quote→Accept→Job→Invoice→Payment→Completion):

```
lead → quote → accept → job (×1) → invoice → payment → receipt/close
```

**Invariants (planning constraints for later implementation):**

1. Accept ⇒ job is **idempotent** (one job per acceptance path).
2. **Single money writer** — no alternate “paid” path outside the canonical payment writer.
3. Events + stable IDs required for lock evidence (per Appendix A minimum event doctrine when ratified).
4. Phase 1 lock focus is **quote→pay** (accept through payment/receipt), not a full Pillar 1 rewrite.

---

## 4. Current proof state (honest labels)

| Area | Label | Notes |
| --- | --- | --- |
| Core loop / smoke / flow-trace | **SOURCE / LOCAL GREEN** | `EV-2026-03-18_money-loop-smoke`, flow-trace; A_LOCK automation items largely GREEN locally |
| Public pay (UAT-006) | **LIVE Resolved** | Residual: duplicate `JobCreated` noted; non-blocking for UAT-006 |
| Appendix A lock package | **IN PROGRESS / unlocked** | Formal evidence pack, truth-pass docs, DR ratification still open (`lock/appendix-a/index.md`) |
| DRs: job-state / send-estimate | **OPEN** | Job-state draft for ratification; send-estimate **Pending** include-or-defer |
| Pillar 1 gaps | **OPEN — later unless required** | Completion gate, alternate path cleanup, broader prod validation — not Phase 1 default |
| Phase 0 board | **NOT_READY** (context) | Does not authorize scope expansion; Phase 1 stays on lock/evidence boundary |

---

## 5. Phase 1 outcomes (planning-bound)

These are the **intended Phase 1 outcomes** once separately authorized for
implementation. This planning brief / packet does **not** execute them.

1. **Appendix A evidence formalization** — complete the lock-package evidence
   surface (smoke, automation, manual UX, snapshots/summary) so A-LOCK is
   documentary-real, not implied by local GREEN alone.
2. **DR ratification or explicit defer** —
   - `DR-2026-03-18_job-state-doctrine` → planning correction **recommends RATIFY** (two-layer model); see `.RESOLUTION.md`,
   - `DR-2026-03-18_send-estimate-scope` → planning correction **recommends EXPLICIT DEFER** from P1 lock / implicit A-LOCK; see `.RESOLUTION.md`.
3. **Quote→pay lock bound** — Phase 1 implementation (when authorized) stays
   inside quote→accept→job→invoice→payment→receipt; no silent expansion into
   Pillar 2–4 or TIS.
4. **Pillar 1 gaps listed as later** unless a gap is proven required to close
   quote→pay / A-LOCK (e.g. duplicate `JobCreated` only if it blocks lock
   evidence). Default later: completion-gate hardening, alternate estimate-path
   cleanup, broader production validation campaigns.
5. **G2.3 carry-forward hygiene tracked separately** (Section 7) — not core
   money-loop product work.

---

## 6. Explicit out of scope (this planning phase and default Phase 1)

Must **not**, and this brief authorizes **none** of:

- Money-loop **product/code implementation** (CRM/public UI, edge functions, RPCs)
- Migrations / schema changes / production data mutation
- Deploy / Hostinger upload / Edge Function deploy
- Live Stripe charges or live pay runs
- G2.3 reopen (B4/B5, Hostinger I2, issue #55, formal Improvement Register)
- B3 re-run as a Phase 1 prerequisite
- Pillar 2–4 / TIS work
- Quote-path cleanup, completion-gate product work, or field-commit redesign
  **unless** later Founder-authorized as required for quote→pay lock
- Production USABLE certification claims from planning docs alone

---

## 7. G2.3 exit complete — carry-forward hygiene

G2.3 Stabilization Exit Review: **minimum safe baseline met**; program **closed**.

| Carry-forward | Class | Phase 1 treatment |
| --- | --- | --- |
| Release Baton refresh (repo baton stale vs live G2.3 closeout) | Hygiene | Close G2.3 baton; open ML-P1 baton at `planning_only` |
| Windows node adapter exit anomaly (HTTP OK; process sometimes exits `-1073740791` after success) | Hygiene / diagnostics | Track for fix-or-defer during Money Loop era; **not** core loop behavior; **no B3 re-run required** for planning |

These items must not expand Phase 1 into a diagnostics reopen.

---

## 8. Planning artifacts

| Artifact | Path | Role |
| --- | --- | --- |
| This brief | `command-center/docs/stabilization/releases/ML-P1_BRIEF.md` | Planning / lock boundary |
| Decision Packet (initial) | `command-center/docs/governance/decisions/ML-P1_DECISION_PACKET.md` | Tier 3 planning ratification (PR #64) |
| Planning correction packet | `command-center/docs/governance/decisions/ML-P1_PLANNING_CORRECTION_DECISION_PACKET.md` | Review disposition corrections |
| Known-Issue Register | `command-center/docs/stabilization/releases/ML-P1_KNOWN_ISSUE_REGISTER.md` | Issues + deferral rationale |
| KPI Scorecard | `command-center/docs/stabilization/releases/ML-P1_KPI_SCORECARD.md` | Baseline-first KPIs |
| Blocking Acceptance Gates | `command-center/docs/stabilization/releases/ML-P1_BLOCKING_ACCEPTANCE_GATES.md` | USABLE gates |
| Money-State Design Contract | `command-center/docs/stabilization/releases/ML-P1_MONEY_STATE_DESIGN_CONTRACT.md` | Minimum design rules |
| G2.3 Baton close | `command-center/docs/governance/RELEASE_BATON.g2-3.yaml` | Close G2.3; point next to ML-P1 |
| ML-P1 Baton | `command-center/docs/governance/RELEASE_BATON.ml-p1.yaml` | Active baton; `status: planning_only` |

### 8.1 Independent review disposition

**LIMITED PLANNING CORRECTIONS REQUIRED BEFORE IMPLEMENTATION** — accepted.
Implementation Decision Packets are ineligible until the planning-correction
docs are merged. Correction docs still do **not** authorize implementation.

---

## 9. Authorization model

| Action | Authorized by this planning PR? |
| --- | --- |
| Merge planning docs (exact PR + head SHA) | **Yes — after Founder merge auth** |
| Ratify planning boundary / Phase 1 outcomes list | **Yes — Decision Packet** |
| Implement Appendix A formalization / DR edits in repo | **No — separate Founder auth** |
| Product/code, migration, deploy, live pay | **No — separate Founder auth each** |
| Reopen G2.3 | **No** |

Architecture Guard: **not required** for this docs-only planning PR.
`review:gate` trigger domains apply when money-loop **behavior** changes are
later proposed — not by planning docs alone.

---

## 10. Stop conditions

Halt and escalate if: worktree/branch/SHA mismatch vs baseline; any step would
implement product code, migrate, deploy, mutate production, run live pay, or
reopen G2.3; Phase 1 scope silently expands into Pillar 1 polish / TIS / Pillar
2–4; planning docs claim gate USABLE/PASS without evidence.

---

## 11. Confirmation of non-action (planning authoring)

This brief authorizes **repository planning documents only**. No production
access, credential use, deploy, migration, financial action, customer
communication, or money-loop product implementation is performed under this
brief.

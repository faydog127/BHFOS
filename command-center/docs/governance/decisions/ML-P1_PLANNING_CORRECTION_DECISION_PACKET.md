# Decision Packet — ML-P1 Planning Correction

> **One consolidated founder-facing decision surface.** Agent-prepared.
> No credentials, secrets, customer data, or pasted logs.
>
> Disposition accepted: **LIMITED PLANNING CORRECTIONS REQUIRED BEFORE IMPLEMENTATION**
> (independent planning-quality review).
>
> This packet authorizes **docs-only planning correction** merge. It does **not**
> authorize product/code implementation, migrations, deployment, production
> mutation, live payments, TIS work, or G2.3 reopen.

---

## Release

| Field | Value |
| --- | --- |
| Release ID | `ML-P1-PC` (Money Loop Phase 1 — Planning Correction) |
| Governance | BHFOS Operating Model v2.2 |
| Risk tier | Tier 3 domain; **authority = planning docs only** |
| Prior planning merge | PR #64 @ head `43c776eaf226fb4c0d9a95da18c6b77a0044f711` → merge `dd7bbe3544f9f8ec016330c5f29b9d8f95f02b40` |
| G2.3 exit baseline | `6bc8db4f46bb604c0a3e4c9631985e8314616a8d` |
| Branch / worktree | `ml/p1-planning-correction` / `F:\Dev\BHFOS-ml-p1-plan-correction` |
| PR + head SHA | `<GitHub authoritative at Founder merge auth>` |

## Operational problem

PR #64 established a planning boundary but omitted: known-issue register with
deferral rationale, KPI scorecard, blocking acceptance gates, minimum
money-state design contract, UX/field binding, and DR resolutions. Independent
review disposition: **LIMITED PLANNING CORRECTIONS REQUIRED BEFORE IMPLEMENTATION**.

## Proposed correction (docs only)

Merge planning-correction documents that add:

1. Known-Issue Register  
2. KPI Scorecard (baseline-first)  
3. Blocking Acceptance Gates  
4. Minimum Money-State Design Contract  
5. Job-state **ratify** + send-estimate **explicit defer** resolutions  
6. Baton / SHA corrections  

## Artifacts

| Artifact | Path |
| --- | --- |
| This packet | `command-center/docs/governance/decisions/ML-P1_PLANNING_CORRECTION_DECISION_PACKET.md` |
| Known-Issue Register | `command-center/docs/stabilization/releases/ML-P1_KNOWN_ISSUE_REGISTER.md` |
| KPI Scorecard | `command-center/docs/stabilization/releases/ML-P1_KPI_SCORECARD.md` |
| Blocking Gates | `command-center/docs/stabilization/releases/ML-P1_BLOCKING_ACCEPTANCE_GATES.md` |
| Money-State Contract | `command-center/docs/stabilization/releases/ML-P1_MONEY_STATE_DESIGN_CONTRACT.md` |
| Job-state resolution | `.../decisions/DR-2026-03-18_job-state-doctrine.RESOLUTION.md` |
| Send-estimate resolution | `.../decisions/DR-2026-03-18_send-estimate-scope.RESOLUTION.md` |
| Brief pointer update | `command-center/docs/stabilization/releases/ML-P1_BRIEF.md` |
| Baton update | `command-center/docs/governance/RELEASE_BATON.ml-p1.yaml` |

## What changes

- Planning baseline becomes correction-complete for **implementation Decision Packet eligibility** (still requires separate impl auth).
- Critical issues cannot hide under “later” without register rows.
- USABLE claims require gates G-01–G-10; CI ≠ USABLE.
- Job-state doctrine recommended **ratified**; send-estimate **explicitly deferred** from P1 lock / implicit A-LOCK.

## What does NOT change

- No product/runtime behavior.
- No migrations, deploy, live pay, TIS, G2.3 reopen.
- No Appendix A declared LOCKED solely by this packet.
- No implementation slice authorized.

## Evidence

- Independent ML-P1 planning-quality review (disposition accepted by Founder).
- Prior PR #64 merge SHA `dd7bbe3…`.
- Repo backlog / A-LOCK / baseline / R1 / Pillar gaps cited in Known-Issue Register.

## Deployment / rollback

- **No deployment.**
- Rollback = `git revert` of planning-correction PR; zero production impact.

## Exact authorization requested

> **"Authorize merge of the ML-P1 planning-correction PR at the exact head SHA
> named on the Release Baton / PR (docs only). Ratify job-state two-layer doctrine
> for Appendix A equivalence. Explicitly defer send-estimate from ML-P1 lock and
> implicit A-LOCK scope. Do not authorize implementation, migration, deploy,
> live pay, TIS, or G2.3 reopen."**

## Explicit non-authorization

This authorization does **NOT** authorize:

- Money-loop product/code implementation  
- Migrations / schema / production data changes  
- Deploy / Edge Function deploy / Hostinger mutation  
- Live Stripe or live payment runs  
- TIS / Pillar 2–4  
- G2.3 reopen  
- Declaring Appendix A LOCKED complete  
- Any later implementation PR (requires **new** Decision Packet + exact SHA)

## Recommendation

**Authorize docs-only planning-correction merge** so a future implementation
Decision Packet can be drafted against a complete planning baseline.

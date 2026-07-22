# ML-P1 Slice 4 — Residual Register (additive)

Continues `ML-P1_SLICES_1_3_RESIDUAL_REGISTER.md`. Do not close R-COH-08/12/14 without evidence.

| Issue ID | Description | Surface | Severity | Prod impact | Source SHA | Discovery | Owner | Remediation | Status | Closure evidence | Escaped to prod |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| R-COH-08 | Edge list/send vs lifecycle RPC dual writers (quotes) | Quotes | Medium | Parallel writers | prior | Coherence | Architecture | Defer | OPEN / ACCEPTED_RESIDUAL | — | Yes |
| R-COH-12 | Superseded quotes in main list vs history | Quotes list | Medium | Version clutter | prior | Coherence | Product | Defer | OPEN | — | Possible |
| R-COH-14 | Finance/Growth nav visibility before later slices | Sidebar | Medium | Premature ops look | prior | Coherence | Product | Founder product decision if hide | OPEN / PRODUCT_DECISION | — | Yes |
| R-S4-01 | Job execution photos reuse `inspection-photos` bucket prefix; dedicated bucket/policies not added | Tech evidence | Low | Relies on existing bucket grants | S4 coding | Builder | Data/Security | Accept for S4; optional dedicated bucket later | ACCEPTED_RESIDUAL | Upload helper + blob reject | No |
| R-S4-02 | Orphan callers of raw edge status (not via jobService) still 409 | Edge | Low | Non-bridged clients fail closed | S4 coding | Architecture | Architecture | Inventory closed; fail-closed intentional | ACCEPTED_RESIDUAL | Writer inventory | No |
| R-S4-05 | Control amendment required make-safe/break-glass/time remediation after first freeze | S4 | Medium | First freeze insufficient vs newest Founder control | tip pre-amend | Orchestrator | Orchestrator | Remediated in `…221300…` + UI/edge denies | REMEDIATED | Amendment migration + tests | No |
| R-S4-03 | Customer token CO approve UI/path not shipped (RPC capability exists) | Public CO | Medium | Office break-glass interim | S4 coding | Product | Product | Add token surface or document break-glass-only until path lands | OPEN | — | No |
| R-S4-04 | S3 unit test expects legacy `/estimates/p1-lifecycle` path (stale vs coherence) | tests | Low | CI noise | main tip | Process | Process | Update S3 test to `/crm/quotes/p1-lifecycle` | OPEN | — | N/A |
| R-S4-06 | `ml_p1_s4_emit_job_event` wrote text into `events.actor_id` (uuid); blocks office assign/schedule + all S4 job audits | S4 RPC emit | **High** | Authenticated execution RPCs fail at first event write | `aa2dd72…` live | Synth prod UAT 2026-07-22 | Data | Forward-fix `…221400…` | **REMEDIATED** | PR #97 + synth PASS closeout | Yes (live; fixed) |
| R-S4-07 | Soft: row-level `tenant_id` still stamped by S4 writers under single-company V1 (auth no longer tenant-gated) | S4 schema/RPC | Low | Residue only | live | Founder model update | Architecture | Track; do not reintroduce user tenant checks | OPEN / ACCEPTED_RESIDUAL | Synth evidence | Yes |
| PROC-LEDGER-LOCK | `ledger_lock` PowerShell harness flake | CI | Medium | False fail risk | prior | Process | Process | Do not accept as permanent | OPEN | — | N/A |
| PROC-PR84-ADMIN | PR #84 admin bypass process issue | Process | Medium | Governance debt | prior | Process | Process | Track; do not normalize | OPEN | — | N/A |

# ML-P1 Slice 4 — Residual Register (additive)

Continues `ML-P1_SLICES_1_3_RESIDUAL_REGISTER.md`. Do not close R-COH-08/12/14 without evidence.

| Issue ID | Description | Surface | Severity | Prod impact | Source SHA | Discovery | Owner | Remediation | Status | Closure evidence | Escaped to prod |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| R-COH-08 | Edge list/send vs lifecycle RPC dual writers (quotes) | Quotes | Medium | Parallel writers | prior | Coherence | Architecture | Defer | OPEN / ACCEPTED_RESIDUAL | — | Yes |
| R-COH-12 | Superseded quotes in main list vs history | Quotes list | Medium | Version clutter | prior | Coherence | Product | Defer | OPEN | — | Possible |
| R-COH-14 | Finance/Growth nav visibility before later slices | Sidebar | Medium | Premature ops look | prior | Coherence | Product | Founder product decision if hide | OPEN / PRODUCT_DECISION | — | Yes |
| R-S4-01 | Job execution photos reuse `inspection-photos` bucket prefix; dedicated bucket/policies not added | Tech evidence | Low | Relies on existing bucket grants | S4 coding | Builder | Data/Security | Accept for S4; optional dedicated bucket later | ACCEPTED_RESIDUAL | Upload helper + blob reject | No |
| R-S4-02 | `work-order-update` legacy path returns 409 for status; clients must use S4 RPCs | Edge | Medium | Breaks callers that ignore jobService bridge | S4 coding | Architecture | Architecture | jobService routes to S4; orphan callers may fail | OPEN | — | No |
| R-S4-03 | Customer token CO approve UI/path not shipped (RPC capability exists) | Public CO | Medium | Office break-glass interim | S4 coding | Product | Product | Add token surface or document break-glass-only until path lands | OPEN | — | No |
| R-S4-04 | S3 unit test expects legacy `/estimates/p1-lifecycle` path (stale vs coherence) | tests | Low | CI noise | main tip | Process | Process | Update S3 test to `/crm/quotes/p1-lifecycle` | OPEN | — | N/A |
| PROC-LEDGER-LOCK | `ledger_lock` PowerShell harness flake | CI | Medium | False fail risk | prior | Process | Process | Do not accept as permanent | OPEN | — | N/A |
| PROC-PR84-ADMIN | PR #84 admin bypass process issue | Process | Medium | Governance debt | prior | Process | Process | Track; do not normalize | OPEN | — | N/A |

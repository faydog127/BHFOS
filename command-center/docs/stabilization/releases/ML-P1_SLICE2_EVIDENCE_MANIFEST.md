# Evidence Manifest — ML-P1 Slice 2 production-readiness remediation

> Pilot template. Builder cannot self-certify production apply or USABLE without
> Founder/independent evidence.

| Field | Value |
| --- | --- |
| Authorized slice / scope | **ML-P1-S2 A2 prod-readiness remediation** — remove `quotes.notes` dependency; revise RPC live-schema; gate accept **and** paid job creation; neutralize WO-on-accept job path; preserve gate default-off, RLS, R-S1-03, audit |
| Coding auth base SHA | `cbc557727c017c0b0a46f4f1c90b992953724392` (PR #78 merge) |
| Branch / worktree | `ml/p1-s2-prod-readiness-remediation` / `F:\Dev\BHFOS-ml-p1-s2-prod-readiness` |
| Head SHA | `bd504d21484d7f93563154ce0d32684b0b9ac724` |
| Files changed | `20260721160000_ml_p1_s2_quote_lifecycle_rs102.sql`; `20260721170000_ml_p1_s2_lifecycle_server_authz.sql`; unit tests; evidence / Decision Packet |
| Data objects changed | **Proposed (not applied):** same S2 objects; paid→job now deferred when gate off; `trg_emit_wo_on_quote_accept` neutralized; revise INSERT uses live columns only (no `notes`) |
| Tests executed | `npm run test:ml-p1-s2-helpers` (22/22); `npm run test:ml-p1-s1-helpers` (15/15) |
| Tests skipped + reason | Live prod apply / edge deploy / Slice 3 — not authorized |
| Runtime environments tested | Local Node unit + migration source guards |
| Claims proven by **execution** | No `v_quote.notes` / revise column allowlist; both `INSERT INTO public.jobs` behind `IF NOT v_should_job`; WO deferred event present; RPC/authz/gate/replay/estimates DENY cases |
| Claims supported by **source inspection only** | Atomic revise txn; concurrent approve predicates; draft-only RLS; fail-closed accept gate |
| Known residuals | Prod apply = **A3** after SAFE packet; edge/app deploy separate; manual `jobService.createJob` unchanged (not automatic S2 path); R-S1-01 apply status independent |
| Rollback method | Revert PR; do not apply migrations. If applied under A3: restore prior function bodies/policies with Founder auth |
| Required reviewers + verdicts | Product · Data · Security · Financial Control · Architecture · Independent Adversarial |

**Hard stop:** no merge without exact-head Founder auth; no deploy; no production S2 migration apply without A3; no Slice 3 / Stripe / follow-up / invoice / TIS / G2.3.

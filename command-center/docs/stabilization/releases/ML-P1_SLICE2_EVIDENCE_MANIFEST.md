# Evidence Manifest — ML-P1 Slice 2 (PR #78 remediation)

> Pilot template. Builder cannot self-certify production apply or USABLE without
> Founder/independent evidence.

| Field | Value |
| --- | --- |
| Authorized slice / scope | **ML-P1-S2 remediation** — PR #78 blockers only: neutralize live job create; fail-closed pre-A3 accept; server R-S1-03 + transitions; concurrent-safe approve; atomic revise |
| Coding auth base SHA | `caacdc071db3e3333b7109a526681d99f9bb8356` |
| Prior freeze | `773e3f5d0d9a66eccaffeb277162bad007b29e73` |
| Branch / worktree | `ml/p1-s2-quote-issue-approval` / `F:\Dev\BHFOS-ml-p1-s2` |
| Head SHA | `1ac46c06117a448a9cc46abc7dd3c33b5154a36d` |
| Files changed | `public-quote-approve` (no jobs); `20260721170000_ml_p1_s2_lifecycle_server_authz.sql`; lifecycle service → RPC; tests; evidence |
| Data objects changed | **Proposed (not applied):** RPCs `ml_p1_s2_quote_lifecycle`, `ml_p1_s2_quote_approve_public`; accept blocked unless `auto_create_job_on_quote_acceptance` explicitly false; draft-only UPDATE RLS; prior R-S1-02 migration unchanged |
| Tests executed | `npm run test:ml-p1-s2-helpers` (17/17); `npm run test:ml-p1-s1-helpers` (15/15) |
| Tests skipped + reason | Live RLS / prod apply / edge deploy — not authorized |
| Runtime environments tested | Local Node unit + source guards |
| Claims proven by **execution** | Client forces `jobCreated:false`; RPC error mapping (role/tenant/gate/break-glass); public edge source has no `jobs` insert; migration SQL contains RPC/gate/RLS |
| Claims supported by **source inspection only** | Atomic revise in one PL/pgSQL txn; optimistic status predicates; fail-closed missing gate key; authenticated sessions denied on public approve RPC |
| Known residuals | Prod apply of S2 migrations = **A3**; edge deploy separate; paid→job trigger branch pre-existing |
| Rollback method | Revert PR commits; do not apply migrations. If applied under A3: drop RPCs/trigger/restore UPDATE policy with Founder auth |
| Required reviewers + verdicts | Product · Security · Architecture (minimum); Data/Financial/UX if evidence changed; Independent Adversarial Test |

**Hard stop:** no merge without exact-head Founder auth; no deploy; no production S2 migration apply without A3; no Slice 3 / Stripe / follow-up / invoice.

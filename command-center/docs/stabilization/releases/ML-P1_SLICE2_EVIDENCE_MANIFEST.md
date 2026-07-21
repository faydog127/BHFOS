# Evidence Manifest — ML-P1 Slice 2 (Quote issue / revise / approve / reject / expire)

> Pilot template filled for implementation branch. Builder cannot self-certify
> production apply or USABLE without Founder/independent evidence.

| Field | Value |
| --- | --- |
| Authorized slice / scope | **ML-P1-S2** — issue / revise / approve / reject / expire on canonical `quotes` only; R-S1-02 UNIQUE; R-S1-03 role authz; stop before accept→job |
| Coding auth base SHA | `caacdc071db3e3333b7109a526681d99f9bb8356` |
| Branch / worktree | `ml/p1-s2-quote-issue-approval` / `F:\Dev\BHFOS-ml-p1-s2` |
| Head SHA | _(fill at freeze / PR open)_ |
| Files changed | Migration `20260721160000_ml_p1_s2_quote_lifecycle_rs102.sql`; `mlP1S2RoleAuthz.js`; `mlP1S2AuditEvents.js`; `mlP1S2QuoteLifecycleService.js`; S1 draft idempotency column use; `MlP1S2QuoteLifecyclePage.jsx`; App route; unit tests; this manifest + reviews |
| Data objects changed | **Proposed (not applied to prod):** `quotes` columns (`idempotency_key`, `quote_version`, `supersedes_quote_id`, `issued_at`, `expired_at`, `approved_amount`, `approval_method`, `approved_by_actor_id`); UNIQUE `quotes_tenant_idempotency_key_uq`; active-lead UNIQUE includes `issued`; `global_config.auto_create_job_on_quote_acceptance=false`; replace `ensure_job_and_optional_draft_invoice_for_accepted_quote` with job-create gate |
| Tests executed | `npm run test:ml-p1-s2-helpers`; `npm run test:ml-p1-s1-helpers` |
| Tests skipped + reason | Live RLS / production apply / Playwright smoke — no deploy; S2 migrations not applied to prod |
| Runtime environments tested | Local Node unit tests (mocked Supabase). No disposable DB apply in this packet. |
| Claims proven by **execution** | Role DENY (technician/viewer/unauth); transition DENY; tenant DENY; break-glass reason required; issue/approve/reject/expire/revise happy paths; public-token approve; estimates create DENY still holds; audit payload completeness; `jobCreated: false` in service returns |
| Claims supported by **source inspection only** | Migration SQL gates job auto-create; UNIQUE index semantics; DB `approved`→`accepted` normalize; R-S1-01 untouched |
| Known residuals | Production apply of S2 migration = **separate A3**; public edge `public-quote-approve` not fully cut over to S2 service (canonical client service exists); accept→job product = S3; Stripe/S6/invoice = out of scope; schema_migrations history for R-S1-01 bookkeeping unchanged |
| Rollback method | Revert branch / do not apply migration. If migration applied under later A3: restore prior function from `20260416210000_…`, drop new columns/indexes only with Founder auth, set `auto_create_job_on_quote_acceptance` per Founder |
| Required reviewers + verdicts | Product · Data · Security · Financial Control · Architecture — see `docs/stabilization/releases/reviews/ML-P1_S2_*.md` |

**Evidence levels:** unit paths = `EXECUTED` (local). Migration / live posture = `SOURCE-ONLY` until A3 + independent verify.  
**Hard stop:** no merge without exact-head Founder auth; no deploy; no production S2 migration apply without separate A3.

## Pilot sentinels (S-01…S-06)

| Sentinel | Status this packet |
| --- | --- |
| S-01 Stale PR head | Pending at merge freeze |
| S-02 Dirty/wrong worktree | Worktree clean at coding start on authorized base |
| S-03 Duplicate submit | R-S1-02 UNIQUE + service idempotent reuse; unit coverage |
| S-04 Estimates writer | DENY retained; no estimates create in S2 |
| S-05 Unauthorized money action | Role matrix unit adversarial |
| S-06 Missing audit | Audit builders + emit on transitions |

## Explicit non-delivery

Stripe · autonomous follow-up · job product · invoice · reopen R-S1-01 · production migration apply · merge without exact-head auth

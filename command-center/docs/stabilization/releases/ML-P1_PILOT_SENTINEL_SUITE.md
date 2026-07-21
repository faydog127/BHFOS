# ML-P1 Pilot — Small BHFOS Sentinel Suite

> **Pilot only (Slice 2–3).** Five to seven cases. Not a benchmark platform.
> Creating or expanding this suite **must not delay Slice 2**.
> Run only the **relevant subset** per PR.

Authority: `REDUCED_AI_DEVELOPMENT_ASSURANCE_PILOT.md` §6.

---

## Cases

### S-01 — Stale PR head or stale review

| Field | Value |
| --- | --- |
| Requirement | Reviews bind to exact head SHA |
| Known failure | Review clears; head moves; merge uses unreviewed commits |
| Expected non-scope | Auto-merge without Founder/product auth |
| Pass/fail | Live `headRefOid` == frozen reviewed SHA; else `ASSIGNMENT_STALE` |
| Independent test | Orchestrator/CI SHA check before merge packet |

### S-02 — Dirty or wrong worktree / base

| Field | Value |
| --- | --- |
| Requirement | Branch from authorized base; clean worktree for consequential work |
| Known failure | Edits in `F:\Dev\BHFOS` dirty tree or wrong base SHA |
| Expected non-scope | Using dirty main worktree for product PRs |
| Pass/fail | `git rev-parse` base match + porcelain empty when required |
| Independent test | Pre-flight script / Orchestrator checklist |

### S-03 — Duplicate customer or quote submission

| Field | Value |
| --- | --- |
| Requirement | Idempotent / dedupe behavior per Money-State Contract |
| Known failure | Double-submit creates duplicate money objects |
| Expected non-scope | Silent duplicate accept |
| Pass/fail | Spec-derived replay/concurrent submit tests |
| Independent test | Test role from Contract + KI register (not Builder narrative) |

### S-04 — Deprecated `estimates` writer / alternate money writer

| Field | Value |
| --- | --- |
| Requirement | Canonical `quotes` path; R-S1-01 server INSERT DENY when applied |
| Known failure | App or API still INSERTs `public.estimates` |
| Expected non-scope | New estimates create as money path |
| Pass/fail | Source grep + (post-apply) authenticated INSERT DENY |
| Independent test | Adversarial “alternate writer attempt” |

### S-05 — Unauthorized money-state action

| Field | Value |
| --- | --- |
| Requirement | Role/authn gates for issue/approve (Slice 2+) |
| Known failure | Wrong role or unauthenticated caller mutates money state |
| Expected non-scope | Open money mutations |
| Pass/fail | Unauthorized-role + unauthenticated negatives |
| Independent test | Spec-derived negatives |

### S-06 — Missing audit event or silent partial failure

| Field | Value |
| --- | --- |
| Requirement | G-02 audit on money transitions; fail visibly on partial write |
| Known failure | State changes without audit; half-written quote/items |
| Expected non-scope | Silent swallow |
| Pass/fail | Audit presence assertions; partial-failure cases |
| Independent test | Contract § audit + negative partial failure |

### S-07 — Stripe replay or silent automation failure

| Field | Value |
| --- | --- |
| Requirement | External event idempotency (when Stripe/automation in scope) |
| Known failure | Duplicate webhook double-settles; automation fails quietly |
| Expected non-scope | **Out of Slice 2–3 product coding** unless separately authorized |
| Pass/fail | N/A for S2/S3 unless work touches webhooks/automation |
| Independent test | Defer until S5b/S6; keep case defined for later |

---

## Usage

| PR type | Suggested subset |
| --- | --- |
| Docs-only | S-01 (if merging), else none |
| Slice 2 implementation | S-01, S-02, S-03, S-04, S-05, S-06 |
| Migration apply packet | S-01, S-04 (+ live posture) |
| Stripe / follow-up (later) | Add S-07 when authorized |

**Add a case only when:** defect escapes review, failure class recurs, or field use exposes material workflow problem. **Retire** obsolete cases.

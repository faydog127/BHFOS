# Decision Packet — ML-P1 Slice 2 Implementation

> **One consolidated founder-facing decision surface.** Agent-prepared.
> No credentials, secrets, customer data, or pasted logs.
>
> **Roadmap:** `ML-P1_IMPLEMENTATION_ROADMAP.md` § Slice 2.  
> **Baseline main:** `2b62bf35dd2cc32ac30808ba36b3ad93ff1547ab`  
> **Closeout:** `ML-P1_SLICE1_CLOSEOUT_AND_RESIDUAL_DISPOSITION.md`  
> **Architecture:** `BHFOS_V1_V2_PRODUCT_BOUNDARY.md`
>
> **V1:** The Vent Guys single-company operation.  
> **V2:** White-label **dedicated instance per company** — shared multi-tenancy
> **removed** from V2 scope.
>
> Docs merge ≠ Slice 2 coding auth. Coding requires R-S1-01 migration merged +
> separate Founder coding line + later exact head merge auth.

---

## Release

| Field | Value |
| --- | --- |
| Release ID | `ML-P1-S2` |
| Risk tier | **Tier 3** |
| Slice | 2 of 6 — Quote issue, revision, approval |
| Operator | **TVG** (V1 Money Loop focus) |
| Base SHA | `2b62bf35…` (or post–R-S1-01 `main` at kickoff) |
| Branch / worktree | `ml/p1-s2-quote-issue-approval` / `F:\Dev\BHFOS-ml-p1-s2` |

## Operational problem

Draft canonical quotes exist. TVG still needs **issue / revise / approve /
reject / expire** with server **role** authz, valid company context, idempotency,
and audit — without leaving deprecated `estimates` create as an alternate writer.

## Prerequisite before Slice 2 coding

| ID | Prerequisite |
| --- | --- |
| **R-S1-01** | Server DENY on `estimates` INSERT (canonical path / dual-writer) |

**Not prerequisites:** Cross-tenant G-03; shared multi-tenancy; Stripe execution (program-in-V1 but **not** this slice); full autonomous follow-up product (program-in-V1 but **not** this slice).

## Exact scope (when coding authorized)

1. Issue / revise / approve / reject / expire on canonical quote versions  
2. Immutability of issued/approved content; approval audit fields  
3. Server **internal role** matrix (R-S1-03)  
4. Idempotent issue/approve + draft UNIQUE (R-S1-02)  
5. Authn + deny-by-default; missing/malformed TVG context → DENY  
6. Audit (G-02); G-05 forced-failure behavior  
7. Mobile office + designated customer accept (minimal)  
8. Unauthorized-role + unauthenticated negatives  

## Explicit non-scope (this slice)

- Accept → job (S3) · job execution (S4) · invoice (S5)  
- Stripe execution (later V1 payment work — **not** “out of V1”)  
- Autonomous follow-up product build-out (later V1 — **not** “out of V1”)  
- send-estimate marketing product  
- Shared multi-tenancy / cross-tenant suites (**N/A**)  
- Visual workflow builder  
- Deploy without Production Operator auth · TIS · G2.3 reopen  

## Residuals

| ID | Class |
| --- | --- |
| R-S1-01 | Before S2 coding |
| R-S1-02 | Inside S2 |
| R-S1-03 | Inside S2 |
| R-S1-04 | **NOT APPLICABLE** (shared multi-tenancy removed) |

## Migration request

**A — Before S2 coding:** Authorize additive `ml_p1_s1_estimates_insert_deny` (timestamp-prefixed OK) — DENY `estimates` INSERT for app roles; dual-path only; not tenancy.

**B — With S2 coding:** Additive migrations for versions/approvals/idempotency UNIQUE if needed — separate Founder line at kickoff.

## Required reviews

Product · UX/Field · Data · Security (authn/roles/deny-by-default — **not** cross-tenant) · Architecture · Financial Control. Release only if deploy later.

## Acceptance gates (Slice 2)

- Canonical quotes issue/approve path only  
- R-S1-01 / R-S1-02 / R-S1-03 evidenced  
- Unauthorized **role** + unauthenticated + malformed TVG context → DENY  
- G-02 · G-05  
- **Not required:** R-S1-04 / cross-tenant G-03  

## Program alignment (outside this slice)

| Theme | Authority |
| --- | --- |
| Stripe in V1 | Product boundary — schedule in payment slice(s), not S2 |
| Autonomous follow-up in V1 | Product boundary — separate analysis/slice |
| Workflow architecture | Pending V1 option decision (lightweight framework recommended) |

## Exact docs-merge authorization (this PR)

> Accept V1/V2 product boundary (dedicated-instance V2; no shared multi-tenancy),
> amended Slice 1 residual disposition, and this Slice 2 Decision Packet as
> **planning docs**. Does **not** authorize Slice 2 coding.

## Exact coding authorization (later)

After R-S1-01 on `main`:

> Authorize ML-P1 Slice 2 implementation on `ml/p1-s2-quote-issue-approval` /
> `F:\Dev\BHFOS-ml-p1-s2` at base `<post-R-S1-01 main>`, scope issue/revise/
> approve/reject/expire with server role authz, TVG context DENY, audit,
> idempotency (R-S1-02/03). Do not require cross-tenant tests. Do not authorize
> S3–S6, job, invoice, Stripe execution in this slice, deploy, TIS, or G2.3.
> Migrations only if named. Code PR merge needs later exact head-SHA auth.

## Recommendation

1. Accept product boundary + residual table.  
2. Authorize R-S1-01 migration when ready.  
3. Merge docs PR #68 at frozen head.  
4. Authorize S2 coding only after R-S1-01 merges.

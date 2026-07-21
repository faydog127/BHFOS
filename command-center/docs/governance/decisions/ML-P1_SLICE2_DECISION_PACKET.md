# Decision Packet — ML-P1 Slice 2 Implementation

> **Docs only.** Coding not authorized by merging this packet.
>
> Baseline: `2b62bf35dd2cc32ac30808ba36b3ad93ff1547ab`  
> Roadmap (final S1–S7): `ML-P1_IMPLEMENTATION_ROADMAP.md`  
> Boundary: `BHFOS_V1_V2_PRODUCT_BOUNDARY.md`  
> Closeout: `ML-P1_SLICE1_CLOSEOUT_AND_RESIDUAL_DISPOSITION.md`

---

## Release

| Field | Value |
| --- | --- |
| Release ID | `ML-P1-S2` |
| Slice | Quote issue, revision, approval, rejection, expiration |
| Operator | The Vent Guys (V1) |
| Branch / worktree | `ml/p1-s2-quote-issue-approval` / `F:\Dev\BHFOS-ml-p1-s2` |
| Base at kickoff | `main` after **R-S1-01** migration merge (Orchestrator states exact SHA) |

## Prerequisite before coding

**R-S1-01** — Server DENY on `estimates` INSERT (canonical path / dual-writer only).

## Exact scope

Issue / revise / approve / reject / expire on canonical quote versions; immutability; approval audit; server **role** authz (R-S1-03); idempotency + draft UNIQUE (R-S1-02); authn + TVG context DENY; audit G-02; G-05; mobile + designated customer accept; unauthorized-role + unauthenticated negatives.

## Explicit non-scope (preserved)

- Job (S3) · job execution (S4) · invoice (S5)  
- **Stripe / S5b**  
- **Autonomous follow-up / S6**  
- send-estimate product · visual workflow builder · shared multi-tenancy  
- Deploy without PO auth · TIS · G2.3 reopen  

## Migrations

- **A (before coding):** R-S1-01 estimates INSERT DENY — separate Founder line.  
- **B (with coding):** versions/approvals/idempotency UNIQUE if needed — named at kickoff.

## Reviews

Product · UX/Field · Data · Security · Architecture · Financial Control.

## Acceptance

R-S1-01/02/03 evidenced; G-02; G-03 (role/authn/context); G-05; no Stripe/follow-up claimed done.

## Later coding authorization (template)

> Authorize ML-P1 Slice 2 on `ml/p1-s2-quote-issue-approval` / `F:\Dev\BHFOS-ml-p1-s2`
> at base `<post-R-S1-01 main>`, scope issue/revise/approve/reject/expire only.
> Include R-S1-02/03. Do not implement Stripe or autonomous follow-up.
> Migrations only if named. Code merge needs later exact head-SHA auth.

## Recommendation

Merge this docs PR when Founder accepts; then R-S1-01 migration; then S2 coding auth.

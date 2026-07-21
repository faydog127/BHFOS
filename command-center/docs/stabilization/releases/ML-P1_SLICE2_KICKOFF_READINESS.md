# ML-P1 Slice 2 — Kickoff Readiness (post–R-S1-01)

> Docs only. Does **not** authorize Slice 2 coding until Founder issues the
> exact authorization line below (or equivalent).
>
> Base: `e8f5abc848d9fe45bc5b5d4263b4c4606039aed9`  
> Prerequisite: R-S1-01 **CLOSED** (`ML-P1_RS101_CLOSEOUT.md`)

---

## Binding coordinates

| Field | Value |
| --- | --- |
| Release ID | `ML-P1-S2` |
| Branch | `ml/p1-s2-quote-issue-approval` |
| Worktree | `F:\Dev\BHFOS-ml-p1-s2` (create clean from base at kickoff) |
| Base SHA | `e8f5abc848d9fe45bc5b5d4263b4c4606039aed9` |
| Operator | The Vent Guys (V1) |

## Approved scope only

Issue / revise / approve / reject / expire on canonical quote versions; issued/approved immutability; approval audit; server **role** authz (**R-S1-03**); idempotency including draft UNIQUE (**R-S1-02**); authn + TVG context DENY; audit **G-02**; **G-05**; mobile + designated customer accept; unauthorized-role + unauthenticated negatives.

## Explicit non-scope

Job (S3) · job execution (S4) · invoice (S5) · **Stripe / S5b** · **autonomous follow-up / S6** · send-estimate product · visual workflow builder · shared multi-tenancy · TIS · G2.3 reopen · reopen R-S1-01

## Migrations inside Slice 2

| ID | Scope | Auth |
| --- | --- | --- |
| **R-S1-02** | Draft idempotency **UNIQUE** (and related versioning/idempotency schema if required for Contract §7·§15) | Inside S2 coding auth |
| **R-S1-03** | Server internal **role** matrix support (schema only if required; prefer code/RPC authz) | Inside S2 coding auth |
| Other | Not authorized unless Named in a later Founder line | — |

Exact migration filenames are named on the implementation branch before Security/Architecture review; scope may not expand beyond R-S1-02/03.

## Risk-based review set (pilot)

Money-state slice → **Product · Data · Security · Financial Control · Architecture** (schema/txn/concurrency/state boundaries).  
UX/Field when mobile/customer-accept UI changes.  
CI required. Exact-head freeze before merge packet.

## Evidence

Every implementation PR: one `EVIDENCE_MANIFEST` (pilot template).  
Pilot measurements M1–M5 for S2.  
Sentinel subset relevant to S2: **S-01…S-06** (S-07 N/A unless webhooks/automation touched).

## Independent adversarial tests

Required (money state / authz / idempotency). Cases derived from Money-State Contract, Slice 2 acceptance, and Known-Issue Register — **not** Builder narrative. Include unauthorized-role, unauthenticated, duplicate-submit, and alternate `estimates` writer attempt (S-04).

## Hard stop

Before: accept→job (S3); merge to `main` without Founder exact-head auth; deploy; production apply of S2 migrations without separate A3 apply line; Stripe; autonomous follow-up; R-S1-01 reopen.

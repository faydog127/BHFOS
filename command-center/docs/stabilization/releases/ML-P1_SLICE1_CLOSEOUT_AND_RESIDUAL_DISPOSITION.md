# ML-P1 Slice 1 Closeout and Open Residual Disposition

> **Docs only.** Does **not** authorize Slice 2 coding, migrations, deploy, or
> production mutation.
>
> Baseline `origin/main`: `2b62bf35dd2cc32ac30808ba36b3ad93ff1547ab`
> (PR #67 merge — Slice 1 customer + canonical draft quote foundation).
>
> Companion: `ML-P1_SLICE2_DECISION_PACKET.md`

---

## 1. Slice 1 closeout status

| Field | Value |
| --- | --- |
| Release | ML-P1-S1 |
| PR | [#67](https://github.com/faydog127/BHFOS/pull/67) |
| Authorized head | `07d13819d52e19c37282a086bf8320bd3502ac4c` |
| Merge commit | `2b62bf35dd2cc32ac30808ba36b3ad93ff1547ab` |
| Delivered | Customer find/create; service address; draft `quotes`/`quote_items`; app estimates create DENY; session-required tenant helpers; audit `event_id`; in-flight + notes idempotency; mobile draft UI; S1 KPI hooks |
| Explicit stop held | No issue/approve; no job; no invoice; no live pay; no send-estimate; no migration in S1 |
| Review disposition at merge | Product / UX / Data / Architecture APPROVE; Security ACCEPT_WITH_DOCUMENTED_RESIDUAL |
| Slice 1 coding | **Closed** (merged) |
| Slice 1 residuals | **Open — dispositioned below (no “later”)** |
| Slice 1 Founder acceptance / USABLE | **Not claimed** — S1 is foundation merge; USABLE is Phase 1 / S6 |

---

## 2. Open residual disposition (exactly one class each)

Classes allowed:

1. required before Slice 2 implementation starts  
2. included inside Slice 2 implementation  
3. required before Slice 2 acceptance  
4. required before deployment  
5. explicitly deferred (rationale + owner + risk + completion gate)

| ID | Residual | Classification | Binding authority | Owner | Risk if ignored | Completion gate | Migration? |
| --- | --- | --- | --- | --- | --- | --- | --- |
| **R-S1-01** | Server/RLS DENY on `estimates` INSERT | **required before Slice 2 implementation starts** | Money-State §1 (server DENY + UI freeze); KI-01 completion test (UI+server); Security residual at merge | Security Guard + Data Guard; money-loop owner | Dual writers while S2 issues/approves on `quotes`; Contract §1/§11 incomplete | Additive RLS (or equivalent server policy) DENYs `estimates` INSERT for app roles; automated DENY proof; inventory: no new Phase 1 path writes to `estimates` | **Yes** — separate Founder migration auth **before** S2 coding auth |
| **R-S1-02** | DB unique constraint for draft idempotency | **included inside Slice 2 implementation** | Money-State §7/§15; KI-13 (idempotent retry); S1 process lock is soft | Data Guard; money-loop owner | Cross-process/multi-tab duplicate drafts under same idem key | Dedicated idempotency column (or equivalent) + UNIQUE; retry harness = 0 duplicate drafts | **Yes** — package in S2 migration auth line (with version/approval schema if needed) |
| **R-S1-03** | Server-enforced role matrix | **included inside Slice 2 implementation** | Money-State §11–12; roadmap S2 “server authz”; S2 roles (issue/approve) | Security Guard; money-loop owner | Client-asserted `actorRole`; unauthorized issue/approve/override | Server checks for issue / revise / approve / reject / expire / manager override per §11; negatives DENY | **Maybe** — prefer RPC/edge + JWT claims; migration only if RLS/policy tables required (separate auth if so) |
| **R-S1-04** | Live G-03 cross-tenant RLS negative testing | **required before Slice 2 acceptance** | Blocking gate G-03; KI-05; roadmap S2 gates include G-03 | Security + Data + Independent UAT coordinator | False confidence from helper-only unit tests; cross-tenant money leak | Automated read/write cross-tenant negatives on S2 money entities = 0 unauthorized success | **No** (tests/harness; may use existing RLS) |

**None deferred.** None left as generic “later.”

### Classification rationale (short)

- **R-S1-01 before S2 coding:** Expanding to issue/approve without server freeze of legacy `estimates` INSERT violates Contract §1 and leaves KI-01 dual-writer open during the slice that must finish “KI-01 remainder.” App DENY alone was accepted only as residual under no-migration remediation.
- **R-S1-02 inside S2:** Soft lock is enough to *start* after R-S1-01; hard uniqueness belongs with S2’s expected schema/idempotency work (issue/approve keys) so one migration auth packet can cover draft + S2 keys. Must be done before S2 acceptance evidence is signed.
- **R-S1-03 inside S2:** Draft-only path could assume office; issue/approve **requires** §11 server authz as core S2 scope—not a pre-code gate separate from S2.
- **R-S1-04 before S2 acceptance:** Roadmap binds G-03 to S2; helper unit tests ≠ G-03 proof. Coding may proceed; S2 cannot be accepted without live/automated RLS negatives.

---

## 3. Block / migrate summary

| Question | Residuals |
| --- | --- |
| Require migration | **R-S1-01** (mandatory before S2 coding); **R-S1-02** (inside S2); **R-S1-03** only if policy/schema required |
| Block Slice 2 **coding** start | **R-S1-01** (and its migration auth + merge) |
| Block Slice 2 **acceptance** | **R-S1-02**, **R-S1-03**, **R-S1-04** (must be evidenced closed) |
| Block **deployment** of S2 surfaces | Any open residual that blocks S2 acceptance — do not deploy S2 until S2 accepted; R-S1-01 already closed before coding |

---

## 4. KI / gate mapping

| Residual | KI / gate |
| --- | --- |
| R-S1-01 | KI-01; Contract §1; feeds G-08 honesty |
| R-S1-02 | KI-13; Contract §7/§15; supports G-05 spirit on draft create |
| R-S1-03 | KI-08; Contract §11–12 |
| R-S1-04 | KI-05; **G-03** |

---

## 5. Authorized next state (docs)

1. Founder accepts this disposition table (or amends classes).  
2. Founder authorizes **R-S1-01 migration** with exact additive migration name (separate line) — **before** Slice 2 coding.  
3. Founder merges Slice 2 Decision Packet docs when ready (docs ≠ coding auth).  
4. Only after R-S1-01 merged to main: Founder may authorize Slice 2 **implementation** at named branch/base SHA.

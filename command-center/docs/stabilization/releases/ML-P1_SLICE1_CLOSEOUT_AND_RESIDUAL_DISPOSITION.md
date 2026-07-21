# ML-P1 Slice 1 Closeout and Open Residual Disposition

> **Docs only.** Does **not** authorize Slice 2 coding, migrations, deploy, or
> production mutation.
>
> Baseline `origin/main`: `2b62bf35dd2cc32ac30808ba36b3ad93ff1547ab`
> (PR #67 merge — Slice 1 customer + canonical draft quote foundation).
>
> Companion: `ML-P1_SLICE2_DECISION_PACKET.md`  
> Architecture authority: `BHFOS_V1_V2_PRODUCT_BOUNDARY.md`
>
> **V1:** Single-company operation for **The Vent Guys**.  
> **V2:** Configurable white-label **dedicated instance per company** — **not**
> shared multi-tenancy. Shared multi-tenancy is **removed** from V2 scope unless
> Founder reauthorizes later.

---

## 1. Slice 1 closeout status

| Field | Value |
| --- | --- |
| Release | ML-P1-S1 |
| PR | [#67](https://github.com/faydog127/BHFOS/pull/67) |
| Authorized head | `07d13819d52e19c37282a086bf8320bd3502ac4c` |
| Merge commit | `2b62bf35dd2cc32ac30808ba36b3ad93ff1547ab` |
| Delivered | Customer find/create; service address; draft `quotes`/`quote_items`; app estimates create DENY; TVG context helpers; audit `event_id`; soft idempotency; mobile draft UI; S1 KPI hooks |
| Explicit stop held (this slice) | No issue/approve; no job; no invoice; no Stripe execution in S1; no send-estimate product; no migration in S1 |
| Program note | **Stripe payment processing and autonomous follow-up are in V1** (see product boundary) — owned by later slices / follow-up work, not S1 |
| Slice 1 coding | **Closed** (merged) |

### V1 controls that remain in force

Authentication · internal roles · least privilege · deny-by-default · unauthorized-write prevention · canonical money writers · auditability · idempotency · data integrity · secret isolation · valid TVG company context on money writes.

### Explicitly not blockers (V1 or V2 Money Loop)

- Shared multi-tenancy  
- Cross-tenant isolation / cross-tenant G-03 suites  
- Tenant switching / shared-runtime tenant provisioning  

---

## 2. Residual disposition

| ID | Residual | Classification | Binding authority | Owner | Completion gate | Migration? |
| --- | --- | --- | --- | --- | --- | --- |
| **R-S1-01** | Server DENY on `estimates` INSERT | **required before Slice 2 implementation starts** | Canonical `quotes` path; KI-01 dual writer — **not** multi-tenancy | Security + Data | Server DENY proof; no new P1-path `estimates` creates | **Yes** — before S2 coding |
| **R-S1-02** | DB unique for draft idempotency | **included inside Slice 2** | Contract §7/§15; KI-13 | Data | 0 duplicate drafts under retry | **Yes** — inside S2 |
| **R-S1-03** | Server-enforced **internal role** matrix | **included inside Slice 2** | Contract §11 roles (TVG users) | Security | Unauthorized role → DENY | Maybe |
| **R-S1-04** | Live G-03 cross-tenant RLS negatives | **NOT APPLICABLE** — shared multi-tenancy **removed** from V1 and V2 | `BHFOS_V1_V2_PRODUCT_BOUNDARY.md` | — | Do not schedule as Money Loop work | **No** |

### R-S1-01

**Retain as S2 coding blocker** solely to: (1) block deprecated `estimates` create, (2) force canonical `quotes`, (3) prevent alternate money writer. Not a tenancy control.

### R-S1-04

**Not deferred to “V2 multi-tenant.”** Shared multi-tenancy is **out of V2**. Cross-tenant negatives are **N/A**. Dedicated-instance isolation is an **ops** concern for V2 instance platform — not an ML-P1 gate.

---

## 3. Block / migrate summary

| Question | Answer |
| --- | --- |
| Blocks Slice 2 **coding** | **R-S1-01** only |
| Blocks Slice 2 **acceptance** | **R-S1-02**, **R-S1-03** (+ G-02, G-05, unauthorized-role + unauthenticated + malformed TVG-context DENY) |
| Blocks **deployment** of S2 | Same as S2 acceptance |
| N/A (removed) | **R-S1-04** / shared multi-tenant G-03 |
| Migrations still necessary | **R-S1-01**, **R-S1-02** (+ R-S1-03 only if schema required) |

---

## 4. Program residuals outside Slice 1 (tracked, not “later”-forgotten)

| Theme | V1 status | Notes |
| --- | --- | --- |
| Stripe live payment path | **In V1** | Harden gaps (failure, min refund/void, recon, KI-07) in payment-oriented slice(s) |
| Autonomous follow-up | **In V1** | Separate analysis / slice; KI-11 visibility mandatory |
| Workflow architecture | **V1 analysis pending** | Lightweight framework recommended; full builder not assumed |

---

## 5. Authorized next state (docs)

1. Founder accepts product boundary + this residual table.  
2. Authorize **R-S1-01** migration when ready (dual-path DENY).  
3. Merge PR #68 at frozen amended head when ready (docs ≠ S2 coding).  
4. Do **not** authorize S2 coding until R-S1-01 is on `main` + separate coding line.

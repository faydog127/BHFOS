# ML-P1 Slice 1 Closeout and Open Residual Disposition

> **Docs only.** Does **not** authorize Slice 2 coding, migrations, deploy, or
> production mutation.
>
> Baseline `origin/main`: `2b62bf35dd2cc32ac30808ba36b3ad93ff1547ab`  
> Companions: `ML-P1_SLICE2_DECISION_PACKET.md`, `BHFOS_V1_V2_PRODUCT_BOUNDARY.md`,
> `ML-P1_IMPLEMENTATION_ROADMAP.md` (final S1–S7 map).

---

## 1. Slice 1 closeout

| Field | Value |
| --- | --- |
| Merged | PR #67 @ `2b62bf35dd2cc32ac30808ba36b3ad93ff1547ab` |
| Delivered | Draft canonical quotes path; app estimates DENY; TVG context; audit; soft idempotency; mobile draft UI |
| S1 stop | Before issue/approve |
| Program | Stripe = **S5b**; autonomous follow-up = **S6**; UAT freeze = **S7** |

---

## 2. Residuals (final)

| ID | Residual | Class | Rationale |
| --- | --- | --- | --- |
| **R-S1-01** | Server DENY on `estimates` INSERT | **Before Slice 2 coding** | Canonical money path only: (1) prevent deprecated `estimates` writes; (2) enforce canonical `quotes`; (3) prevent alternate money writer. **Not** tenant isolation |
| **R-S1-02** | Draft idempotency UNIQUE | **Inside Slice 2** | KI-13 / Contract §7·§15 |
| **R-S1-03** | Server internal **role** matrix | **Inside Slice 2** | TVG role authz for issue/approve |
| **R-S1-04** | Cross-tenant G-03 | **NOT APPLICABLE** | Shared multi-tenancy removed |

| Blocks S2 coding | **R-S1-01** |
| Blocks S2 acceptance | **R-S1-02**, **R-S1-03** (+ G-02, G-05, role/authn/context negatives) |
| Blocks S2 deploy | Same as acceptance |
| Migrations | R-S1-01 (before S2); R-S1-02 (in S2); R-S1-03 maybe |

---

## 3. Final slice map (reference)

S1 (done) → S2 → S3 → S4 → S5 → **S5b Stripe** → **S6 follow-up** → **S7 UAT/V1 freeze**.

S2 does **not** implement Stripe or autonomous follow-up.

---

## 4. Authorized next state

1. Founder merges PR #68 docs at frozen head.  
2. Authorize R-S1-01 migration when ready.  
3. Authorize S2 coding only after R-S1-01 on `main` + separate coding line.

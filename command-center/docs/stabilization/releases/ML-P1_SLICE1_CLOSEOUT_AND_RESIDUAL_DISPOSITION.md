# ML-P1 Slice 1 Closeout and Open Residual Disposition

> **Docs only.** Does **not** authorize Slice 2 coding, migrations, deploy, or
> production mutation.
>
> Baseline `origin/main`: `2b62bf35dd2cc32ac30808ba36b3ad93ff1547ab`
> (PR #67 merge — Slice 1 customer + canonical draft quote foundation).
>
> Companion: `ML-P1_SLICE2_DECISION_PACKET.md`
>
> **V1 product authority (Founder):** BHFOS V1 is a **single-tenant** system
> operated solely for **The Vent Guys (TVG)**. Multi-tenant support and
> cross-tenant isolation are **V2** features and are **not** part of the V1
> freeze or ML-P1 acceptance standard.

---

## 1. Slice 1 closeout status

| Field | Value |
| --- | --- |
| Release | ML-P1-S1 |
| PR | [#67](https://github.com/faydog127/BHFOS/pull/67) |
| Authorized head | `07d13819d52e19c37282a086bf8320bd3502ac4c` |
| Merge commit | `2b62bf35dd2cc32ac30808ba36b3ad93ff1547ab` |
| Delivered | Customer find/create; service address; draft `quotes`/`quote_items`; app estimates create DENY; TVG tenant-context helpers; audit `event_id`; in-flight + notes idempotency; mobile draft UI; S1 KPI hooks |
| Explicit stop held | No issue/approve; no job; no invoice; no live pay; no send-estimate; no migration in S1 |
| Review disposition at merge | Product / UX / Data / Architecture APPROVE; Security ACCEPT_WITH_DOCUMENTED_RESIDUAL |
| Slice 1 coding | **Closed** (merged) |
| Slice 1 residuals | **Dispositioned below under V1 single-tenant authority** |
| Slice 1 Founder acceptance / USABLE | **Not claimed** — S1 is foundation merge; USABLE is Phase 1 / S6 |
| V1 tenancy model | **Single-tenant TVG only** — not multi-tenant |

### V1 controls that remain in force (not multi-tenant)

- Authenticated access  
- Deny-by-default authorization  
- Role enforcement (TVG Office / Technician / Manager / Admin)  
- Protection against missing or malformed TVG tenant context  
- Prevention of unauthorized writes  
- One canonical money writer (proven by S5; watched from S1)  
- Canonical `quotes` path (legacy `estimates` create frozen)  
- Auditability  
- Idempotency  
- Data integrity  

### Explicitly not V1 ML-P1 blockers

- Cross-tenant isolation / multi-tenant RLS  
- Live G-03 cross-tenant negative testing  
- Multi-tenant architecture redesign  

---

## 2. Residual disposition (revised)

Allowed classes:

1. required before Slice 2 implementation starts  
2. included inside Slice 2 implementation  
3. required before Slice 2 acceptance  
4. required before deployment  
5. explicitly deferred / **NOT APPLICABLE TO V1** (rationale + owner + risk + completion gate)

| ID | Residual | Classification | Binding authority | Owner | Risk if ignored | Completion gate | Migration? |
| --- | --- | --- | --- | --- | --- | --- | --- |
| **R-S1-01** | Server/RLS DENY on `estimates` INSERT | **required before Slice 2 implementation starts** | Money-State §1 (canonical `quotes` only; forbid legacy create); KI-01 dual writers; alternate money-path prevention — **not** multi-tenant enforcement | Security + Data; money-loop owner | Deprecated `estimates` create remains an alternate money writer while S2 issues/approves on `quotes` | Additive server policy DENYs `estimates` INSERT for app roles; DENY proof; no new P1-path writes to `estimates` | **Yes** — separate Founder migration auth **before** S2 coding |
| **R-S1-02** | DB unique constraint for draft idempotency | **included inside Slice 2 implementation** | Money-State §7/§15; KI-13 idempotent retry | Data Guard; money-loop owner | Cross-process/multi-tab duplicate drafts | Idempotency column (or equivalent) + UNIQUE; retry = 0 duplicate drafts | **Yes** — inside S2 migration auth at kickoff |
| **R-S1-03** | Server-enforced **role** matrix (TVG users) | **included inside Slice 2 implementation** | Money-State §11–12 role rows; roadmap S2 server authz — **internal TVG roles, not multi-tenant** | Security; money-loop owner | Client-asserted role; unauthorized issue/approve/override among TVG users | Server DENY for unauthorized role on issue/revise/approve/reject/expire/override; unauthorized-role negatives | **Maybe** — RPC/JWT preferred; migration only if policies require it |
| **R-S1-04** | Live G-03 cross-tenant RLS negative testing | **NOT APPLICABLE TO V1** — deferred to **V2 multi-tenant architecture** | Founder V1 single-tenant decision; G-03 cross-tenant clause waived for V1 ML-P1; KI-05 cross-tenant portion → V2 | V2 architecture owner (later) | N/A for V1 (single TVG tenant) | V2 planning item: multi-tenant isolation + cross-tenant negatives when multi-tenant is authorized | **No** for V1 |

**No residual left as vague “later.”** R-S1-04 is explicitly **V2**, not an open V1 defect.

### R-S1-01 reassessment (independent of multi-tenancy)

**Retain as Slice 2 coding blocker.** Rationale is solely:

1. Prevent use of the deprecated `estimates` money path  
2. Enforce canonical creation through `quotes`  
3. Prevent an alternate money writer  

Not justified by cross-tenant isolation. If this migration were only for multi-tenant RLS, it would be removed as an S2 coding blocker — that is **not** the case.

### R-S1-03 reassessment

**Retain inside Slice 2.** Different TVG users have different permissions (Office vs Technician vs Manager vs Admin). That is **role authorization**, not multi-tenant architecture.

### Classification rationale (short)

- **R-S1-01 before S2 coding:** Dual-path money writer must be server-frozen before issue/approve expands the money loop.  
- **R-S1-02 inside S2:** Soft lock OK to start after R-S1-01; hard UNIQUE with S2 schema/idempotency migrations.  
- **R-S1-03 inside S2:** Issue/approve requires server role checks among TVG roles.  
- **R-S1-04 → V2:** V1 is single-tenant TVG; cross-tenant G-03 is out of V1 freeze / ML-P1 acceptance.

---

## 3. Block / migrate / V2 summary

| Question | Answer |
| --- | --- |
| **Blocks Slice 2 coding** | **R-S1-01** only (migration + merge) |
| **Blocks Slice 2 acceptance** | **R-S1-02**, **R-S1-03** (+ S2 gates: G-02, G-05; unauthorized-role + unauthenticated negatives) — **not** R-S1-04 |
| **Blocks deployment** of S2 | Same as S2 acceptance — do not deploy until S2 accepted |
| **Moved to V2** | **R-S1-04**; KI-05 cross-tenant isolation; G-03 multi-tenant clause; multi-tenant architecture |
| **Migrations still necessary for V1** | **R-S1-01** (before S2 coding); **R-S1-02** (inside S2); **R-S1-03** only if schema/policies required |

---

## 4. KI / gate mapping (V1)

| Residual | V1 mapping |
| --- | --- |
| R-S1-01 | KI-01; Contract §1 (canonical path / dual writer) |
| R-S1-02 | KI-13; Contract §7/§15 |
| R-S1-03 | Contract §11 role matrix; KI-08 (no silent auth fallback) — **roles**, not orgs |
| R-S1-04 | **V2 only** — not V1 G-08 critical for ML-P1 |

### V1 acceptance negatives (replace cross-tenant G-03 for ML-P1)

| Required on V1 money path | Not required on V1 |
| --- | --- |
| Unauthorized-**role** → DENY | Cross-tenant read/write negatives |
| Unauthenticated access → DENY | Multi-tenant RLS proof |
| Missing/malformed TVG tenant context → DENY | Foreign-tenant isolation suite |

---

## 5. Authorized next state (docs)

1. Founder accepts this **amended** disposition (V1 single-tenant).  
2. Founder authorizes **R-S1-01 migration** (dual-path DENY) — before S2 coding.  
3. Founder merges PR #68 docs when ready at the **frozen amended head**.  
4. After R-S1-01 on `main`: Founder may authorize Slice 2 coding (separate line).  
5. V2 multi-tenant architecture (incl. former R-S1-04 / G-03 cross-tenant) waits for a future V2 planning packet.

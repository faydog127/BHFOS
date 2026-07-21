# ML-P1 Implementation Roadmap

> **Authoritative V1 / Phase 1 implementation sequence.**
> Baseline after Slice 1 merge: `2b62bf35dd2cc32ac30808ba36b3ad93ff1547ab`
>
> Binds: Known-Issue Register, KPI Scorecard, Blocking Acceptance Gates,
> Money-State Design Contract, job-state doctrine (ratified),
> `BHFOS_V1_V2_PRODUCT_BOUNDARY.md`.
>
> **This document does not authorize implementation.** Each slice requires a
> separate Founder Decision Packet + exact head-SHA authorization.
>
> **Anti-delay:** Do not reopen full planning before each slice unless evidence
> invalidates an assumption. Otherwise prepare the next slice Decision Packet
> directly after prior slice acceptance.

---

## 0. V1 end-state

```
Create/find customer
  → draft canonical quote
  → issue / revise / approve quote
  → approved quote → job (×1)
  → execute and complete job
  → invoice (draft → issued)
  → Stripe payment (full/partial/refund/void paths)
  → autonomous follow-up (quote→pay→review)
  → office + mobile end-to-end UAT → V1 freeze / USABLE
```

**Product boundary:** V1 = TVG single-company. V2 = dedicated white-label instance
per company. Shared multi-tenancy **removed**. Stripe + autonomous follow-up
**in V1**. Workflow = **lightweight internal framework** (Founder-approved);
no visual builder / arbitrary admin workflow language in V1.

**USABLE** requires gates G-01–G-10. CI green ≠ USABLE.

---

## 1. Full slice map (final)

| Slice | Name | Stops before |
| --- | --- | --- |
| **S1** | Customer + canonical draft quote foundation | Issue/approve, job, invoice, pay, follow-up product |
| **S2** | Quote issue, revision, approval, rejection, expiration | Job, invoice, Stripe, autonomous follow-up product |
| **S3** | Approved quote → job | Field execution beyond init, invoice, pay |
| **S4** | Job execution and completion | Invoice, pay |
| **S5** | Completed job → invoice | Stripe execution (S5b) |
| **S5b** | Stripe payment operations | Autonomous follow-up product build-out (S6) |
| **S6** | Autonomous follow-up and automation | Claiming V1 freeze without UAT |
| **S7** | End-to-end UAT and V1 freeze | Post-V1 scope |

### Dependency graph

```
S1 → S2 → S3 → S4 → S5 → S5b → S6 → S7
                      │      │     │
                      │      │     └── lightweight workflow framework + journeys
                      │      └── canonical paid writer + refunds/voids
                      └── invoice immutability / lineage
```

S7 depends on S1–S6 acceptance evidence. No parallel Tier-3 money-state slices without Architecture Guard exception. **S2 must not implement Stripe or autonomous follow-up.**

---

## 2. Known-issue → slice mapping

| KI | Disposition |
| --- | --- |
| KI-01 Dual estimates/quotes | S1 path + R-S1-01 server DENY before S2; remainder purge as needed |
| KI-02 Identity/address | S1; B-023 deferred |
| KI-03 UUID↔bigint | Documented pattern S1; unification deferred |
| KI-04 Address fields | S1 |
| KI-05 Company context / money-writer | Every slice authn/role/context; **G-09 / KI-07 proven in S5b**; cross-tenant **N/A** |
| KI-06 payment_status divergence | Design S4/S5; fix S5/S5b |
| KI-07 Alternate paid writers | **Proven in S5b** |
| KI-08 Admin auth fallback | Each money-state slice |
| KI-09 Technician identity | S3/S4 |
| KI-10 tenant_id gaps | Enforce via money entities; backfill deferred |
| KI-11 Follow-up fragility | **S6** (framework + journeys); no silent fail |
| KI-12 Event doctrine | Each slice; 100% by S7 |
| KI-13 Idempotent / connectivity | S1+; proven S4/S5b/S6/S7 |
| KI-14 Notes escape | Measured S1+; **0 on S7 gate trials** |
| KI-15 Manual re-entry | Design S1–S5; 0 on path by S5 |
| KI-16 Dup JobCreated | S3 |
| KI-17 Node adapter | N/A product gate |
| Send-estimate product | Deferred unless packet includes |
| Job-state doctrine | Ratified; S3–S4 |

---

## 3. Review matrix (proportional)

| Slice | Product | UX/Field | Data | Security | Architecture | Financial | Release/Prod |
| --- | --- | --- | --- | --- | --- | --- | --- |
| S1 | Required | Required | Required | Required | Required | Light | Only if deploy |
| S2 | Required | Required | Required | Required | Required | Required | Only if deploy |
| S3 | Required | Light | Required | Required | Required | Required | Only if deploy |
| S4 | Required | Required | Required | Required | Required | Light | Only if deploy |
| S5 | Required | Required | Required | Required | Required | Required | Only if deploy |
| S5b | Required | Light | Required | Required | Required | Required | Only if deploy |
| S6 | Required | Required | Required | Required | Required | Light | Only if deploy |
| S7 | Required | Required | Required | Required | Required | Required | As needed for UAT env |

---

## 4. KPI and instrumentation plan

| Slice | Instrument now | Gates |
| --- | --- | --- |
| S1 | Customer/draft times; taps; escape diary; dup hits; authz denies; audit | G-02, G-03, G-06 partial, G-07 start |
| S2 | Issue/approve/revise; unauthorized role; abandoned | G-02, G-03, G-05 |
| S3 | Approval→job; dup job; lineage; partial tx | G-01 partial, G-04 jobs, G-05, G-02 |
| S4 | Complete time; evidence; Notes escape; failed transitions | G-06, G-02, G-05 |
| S5 | Complete→invoice; lineage; dup invoice; void reasons | G-01, G-04 invoices, G-05, G-02 |
| S5b | Pay conversion; webhook/idempotent hits; fail recovery; refund/void; recon exceptions; **G-09** | G-02, G-05, G-09 |
| S6 | Automation failure rate; chase conversion; time-to-first-follow-up; opt-out; escape | G-02, G-06 progress, KI-11 |
| S7 | Full scorecard lock; all G-01–G-10; task-time caps | **All blocking gates** |

---

## 5. Migration strategy

| Slice | Migration expectation |
| --- | --- |
| S1 | Prefer none (done); R-S1-01 estimates INSERT DENY = **before S2** separate auth |
| S2 | Versions/approvals/idempotency UNIQUE — separate auth if needed |
| S3 | Accept→job idempotency unique — if needed + auth |
| S4 | Job status columns if needed + auth |
| S5 | Invoice immutability/numbering/lineage — if needed + auth |
| S5b | Prefer none if existing Stripe schema suffices; additive only + auth |
| S6 | Framework tables if needed (triggers/runs/failures) — additive + auth |
| S7 | None preferred (verification) |

**Rule:** No migration without explicit Founder migration line in that slice’s packet.

---

## 6. UX and field acceptance plan

- Mobile-first S1–S5; pay UX in S5b; follow-up surfaces in S6.
- Housecall Pro = workflow **benchmark** only.
- Easier than Notes (G-06); real-device trials S4 + mandatory S7.
- Escape diary from S1; **0** on S7 gate trials.

---

## 7. Security and authorization plan

- Deny-by-default; internal role matrix §11.
- Valid TVG company context on money writes.
- V2 = dedicated instances; shared multi-tenancy **removed**.
- G-03 = authn/role/context negatives; cross-tenant **N/A**.
- Canonical paid writer proven **S5b** (G-09).
- Automation enable/disable + failure queue **S6** (no silent fail).

---

## 8. Data and lineage plan

```
lead → service address → quote/version/items → job/scope → invoice/items
                                                      └─ Stripe settlement (S5b)
follow-up framework (S6) observes money/job/appointment events
```

---

## 9. Financial-control plan

- S2: issued/approved immutability.
- S5: issued invoice immutability; void reason codes.
- **S5b:** Stripe initiation/status/webhooks/idempotency/fail recovery/recon/**full+partial refunds**/unpaid void behavior/audit/comms/escalation/**one paid writer**.
- No alternate paid writers.

---

## 10. Rollback and recovery plan

| Level | Action |
| --- | --- |
| Code | `git revert` slice PR |
| Migration | Expand/contract per packet |
| Partial failure | Atomic units §14; visible error; safe retry |
| Exceptions | Owned queue by **S5b/S6**; no silent automation failure |

---

## 11. Lightweight workflow framework (V1 — Founder-approved)

Built on existing `crm_tasks` / events / runners / escalation spine.

| Capability | V1 |
| --- | --- |
| Shared trigger model | **Required** |
| Controlled conditions (code/policy, not free-form) | **Required** |
| Actions (email/SMS/task/event) | **Required** |
| Delays and schedules | **Required** |
| Bounded retry policy | **Required** |
| Idempotency | **Required** |
| Audit events | **Required** |
| Failure queue | **Required** |
| Exception ownership | **Required** |
| Enable/disable controls | **Required** |
| Operational visibility | **Required** |
| Visual workflow builder | **Not in V1** |
| Arbitrary admin-defined conditions | **Not in V1** |
| Free-form workflow scripting | **Not in V1** |
| Shared multi-tenant workflow configuration | **N/A** |

Implemented primarily in **S6**; earlier slices may emit events/tasks compatible with the framework.

---

## 12. Slice definitions

### S1 — Customer + canonical draft quote foundation

*(Merged — PR #67.)* Draft `quotes` only; app estimates DENY; TVG context; audit; soft idempotency. Stop before issue/approve. **R-S1-01** server estimates INSERT DENY remains prerequisite before S2 coding.

### S2 — Quote issue, revision, approval, rejection, expiration

| Field | Content |
| --- | --- |
| Scope | Issue/revise/approve/reject/expire; immutability; approval audit; server **role** authz; idempotency (incl. draft UNIQUE R-S1-02); mobile + designated customer accept |
| Non-scope | Job; invoice; **Stripe**; **autonomous follow-up product**; send-estimate; shared multi-tenancy |
| Gates | G-02, G-03, G-05 |
| Stop | Before accept→job |
| Branch | `ml/p1-s2-quote-issue-approval` · `F:\Dev\BHFOS-ml-p1-s2` |

### S3 — Approved quote → job

Idempotent job from approved version; lineage; dup-job prevention; audit. Stop before field execution. Branch `ml/p1-s3-quote-to-job`.

### S4 — Job execution and completion

Authorized field transitions; evidence; mobile; Notes-escape measurement. Includes statuses needed for later on-my-way / no-access **comms** (comms themselves in S6). Stop before invoice. Branch `ml/p1-s4-job-execution`.

### S5 — Completed job → invoice

Invoice from completed scope; lineage; issued immutability; void reason codes; reconciliation-ready fields. **Stop before Stripe execution.** Branch `ml/p1-s5-job-to-invoice`.

### S5b — Stripe payment operations

| Field | Content |
| --- | --- |
| Business objective | TVG collects via Stripe with safe settlement and recovery |
| Scope | Payment initiation; payment status; webhook settlement; duplicate-payment protection; failed-payment recovery; reconciliation; **full and partial refunds**; unpaid-invoice void behavior; audit events; customer communication; exception escalation; **proof of one canonical paid writer (G-09 / KI-07)** |
| Non-scope | Autonomous follow-up product build-out (S6); visual workflow builder; new payment providers |
| Gates | G-02, G-05, **G-09**; financial review required |
| Branch | `ml/p1-s5b-stripe-payment-operations` · `F:\Dev\BHFOS-ml-p1-s5b` |
| Stop | Before claiming V1 freeze; before S6 may assume paid-writer closed |

### S6 — Autonomous follow-up and automation

| Field | Content |
| --- | --- |
| Business objective | Customer/revenue follow-up runs without routine manual push |
| Framework | Lightweight internal workflow framework (section 11) |
| Scope journeys | Quote follow-up; appointment confirmation and reminders; on-my-way communication; no-access and reschedule handling; job-completion communication; invoice delivery; unpaid-invoice follow-up; failed-payment follow-up; review requests; internal task escalation |
| Non-scope | Visual builder; arbitrary admin conditions; free-form scripting; shared multi-tenant workflow config; Stripe paid-writer changes (owned by S5b) |
| Gates | G-02; KI-11 no silent fail; G-06 progress |
| Branch | `ml/p1-s6-autonomous-follow-up` · `F:\Dev\BHFOS-ml-p1-s6` |
| Stop | Before S7 UAT freeze claim |

**Autonomous ≠ uncontrolled AI:** executes Founder-approved rules with audit, retry, opt-out, and escalation.

### S7 — End-to-end UAT and V1 freeze

| Field | Content |
| --- | --- |
| Scope | Real-device office + Founder + tech path; repeated-click; forced-failure; role/authn negatives; lineage; audit; task-time caps; Notes escape = 0; Stripe + follow-up journeys; KPI review; UX disposition |
| Non-scope | New features; TIS; G2.3 reopen; shared multi-tenancy |
| Gates | **All G-01–G-10** |
| Branch | `ml/p1-s7-uat-v1-freeze` · `F:\Dev\BHFOS-ml-p1-s7` |

---

## 13. V1 freeze / Phase 1 completion definition

V1 freeze is **complete** when:

1. S1–S6 implementation slices accepted with evidence.  
2. **S7** proves G-01–G-10 (or Founder signs residual-risk waivers per gate).  
3. Known-Issue Register: all `P1_BLOCKING` fixed or signed.  
4. **S5b:** single money-writer + Stripe operational minimum evidenced.  
5. **S6:** autonomous follow-up minimum + no silent automation failure evidenced.  
6. send-estimate deferred unless packet includes it.  
7. Founder declares V1 **USABLE** — not CI alone.  
8. Shared multi-tenancy is **not** a completion requirement.

---

## 14. Worktree / branch naming

| Slice | Branch | Worktree |
| --- | --- | --- |
| S1 | `ml/p1-s1-customer-quote-foundation` | `F:\Dev\BHFOS-ml-p1-s1` |
| S2 | `ml/p1-s2-quote-issue-approval` | `F:\Dev\BHFOS-ml-p1-s2` |
| S3 | `ml/p1-s3-quote-to-job` | `F:\Dev\BHFOS-ml-p1-s3` |
| S4 | `ml/p1-s4-job-execution` | `F:\Dev\BHFOS-ml-p1-s4` |
| S5 | `ml/p1-s5-job-to-invoice` | `F:\Dev\BHFOS-ml-p1-s5` |
| S5b | `ml/p1-s5b-stripe-payment-operations` | `F:\Dev\BHFOS-ml-p1-s5b` |
| S6 | `ml/p1-s6-autonomous-follow-up` | `F:\Dev\BHFOS-ml-p1-s6` |
| S7 | `ml/p1-s7-uat-v1-freeze` | `F:\Dev\BHFOS-ml-p1-s7` |

Docs planning branch for this packet: `ml/p1-s2-decision-packet` · `F:\Dev\BHFOS-ml-p1-s2-plan`.

Base each slice on then-current `origin/main` after prior merge.

---

## 15. Explicit program non-scope

- Shared multi-tenancy / cross-tenant shared-runtime  
- Visual workflow builder; arbitrary admin conditions; free-form workflow scripting  
- TIS / Pillar 2–4 (unless separately authorized)  
- G2.3 reopen  
- Full offline sync  
- UUID↔bigint unification  
- Full property multi-company rewrite  

**In V1 (not non-scope):** Stripe (S5b); autonomous follow-up (S6); lightweight workflow framework.

# ML-P1 Implementation Roadmap

> **Authoritative Phase 1 implementation sequence.** One coordinated planning pass.
> Baseline `origin/main`: `8d8ac06b7e64f2b8e92b04c76d7d7094c631831d`
>
> Binds: Known-Issue Register, KPI Scorecard, Blocking Acceptance Gates,
> Money-State Design Contract, job-state doctrine (ratified), send-estimate deferral.
>
> **This document does not authorize implementation.** Each slice requires a
> separate Founder Decision Packet + exact head-SHA authorization.
>
> **Anti-delay:** Do not reopen full planning before each slice unless evidence
> invalidates an assumption, a critical known issue changes, a platform constraint
> changes, or a material security/data/financial/usability risk is discovered.
> Otherwise prepare the next slice Decision Packet directly after prior slice acceptance.

---

## 0. Phase 1 end-state

```
Create/find customer
  → create canonical quote (draft)
  → issue quote
  → revise or approve quote
  → convert approved quote → job (×1)
  → execute and complete job
  → generate invoice (draft → issued)
  → office + mobile end-to-end acceptance
```

**In Phase 1 / V1 freeze:** Live **Stripe payment processing is in scope for V1**
(see `BHFOS_V1_V2_PRODUCT_BOUNDARY.md`). Money Loop **slices S1–S4** still stop
before payment execution; payment hardening and autonomous follow-up are scheduled
in payment/follow-up oriented work — not treated as “V2-only.”

**USABLE** requires gates G-01–G-10 (Blocking Acceptance Gates). CI green ≠ USABLE.

---

## 1. Full slice map

| Slice | Name | Stops before |
| --- | --- | --- |
| **S1** | Customer + canonical quote foundation | Approval, job, invoice, pay |
| **S2** | Quote issue, revision, approval | Job conversion, invoice, pay |
| **S3** | Approved quote → job | Job field execution beyond init, invoice, pay |
| **S4** | Job execution and completion | Invoice, pay |
| **S5** | Completed job → invoice | Live pay |
| **S6** | End-to-end UAT + Phase 1 acceptance | Post-P1 scope |

### Dependency graph

```
S1 ──► S2 ──► S3 ──► S4 ──► S5 ──► S6
 │      │      │      │      │
 │      │      │      │      └── payment readiness (design only)
 │      │      │      └── job-state doctrine (ratified two-layer)
 │      │      └── KI-16 dup job / idempotent accept
 │      └── immutability + approval audit
 └── KI-01 canonical quotes; KI-02..04 identity/address; tenant
```

S6 depends on S1–S5 acceptance evidence. No parallel Tier-3 money-state slices without Architecture Guard exception.

---

## 2. Known-issue → slice mapping

| KI | Disposition |
| --- | --- |
| KI-01 Dual estimates/quotes | **Required before S1** (path policy); **fixed during S1** (freeze legacy create on P1 path); full UI purge may continue S2 if needed |
| KI-02 Customer/property/address lineage | **Resolved in S1** (P1 authority rules); B-023 rewrite **explicitly deferred** |
| KI-03 UUID↔bigint | **Required before S1** (document safe join; no name linking); unification **explicitly deferred** |
| KI-04 Address field mismatch | **Fixed during S1** (correct `address_line_1` mapping on P1 path) |
| KI-05 Company context / money-writer | **V1 every slice:** authn + role + TVG context DENY; money-writer inventory by payment slice. **Shared multi-tenant / cross-tenant → NOT APPLICABLE** |
| KI-06 payment_status divergence | **Designed in S4/S5** (invoice authority); **fixed during S5** |
| KI-07 Alternate paid writers | **Proven by S5** (inventory); no paid mutation in S1–S4 |
| KI-08 Admin auth fallback | **Fixed during each slice** touching money-state endpoints; **blocking for S1+** on new endpoints |
| KI-09 Technician identity | **Must design S3/S4**; full auth FK **deferred**; actor on completion **S4** |
| KI-10 tenant_id gaps on properties/techs | **Enforce via money entities S1+**; column backfill **deferred** |
| KI-11 Follow-up fragility | **Deferred** rich UX; **S5/S6** visible failure / no silent break on P1 path |
| KI-12 Incomplete event doctrine | **Fixed during each slice** for transitions introduced; **100% by S6** |
| KI-13 Mobile / poor-connectivity | **S1+** idempotent submit; full offline **deferred**; proven **S4/S6** |
| KI-14 Notes escape | **Measured S1+**; **blocking S6** (0 escape on gate trials) |
| KI-15 Manual re-entry | **Must design S1–S5**; **0 on path by S5** |
| KI-16 Duplicate JobCreated | **Fixed during S3** (dup jobs blocking); event hygiene **S3/S6** |
| KI-17 Node adapter exit | **Hygiene / N/A** to money-loop product — **rejected as P1 product gate** |
| Send-estimate | **Explicitly deferred** (not in any slice) |
| Job-state doctrine | **Ratified**; applied **S3–S4** |

---

## 3. Review matrix (proportional)

| Slice | Product | UX/Field | Data | Security | Architecture | Financial | Release/Prod |
| --- | --- | --- | --- | --- | --- | --- | --- |
| S1 | Required | Required | Required | Required | Required (Tier 3 path) | Light (no money settle) | Only if deploy |
| S2 | Required | Required | Required | Required | Required | Required | Only if deploy |
| S3 | Required | Light | Required | Required | Required | Required | Only if deploy |
| S4 | Required | Required | Required | Required | Required | Light | Only if deploy |
| S5 | Required | Required | Required | Required | Required | Required | Only if deploy |
| S6 | Required | Required | Required | Required | Required | Required | As needed for UAT env |

---

## 4. KPI and instrumentation plan

| Slice | Instrument now | Gates exercised |
| --- | --- | --- |
| S1 | Customer find/create time; estimate create time; taps; Notes escape diary; dup customer attempts; authz deny count; audit completeness on quote draft create | G-02 (slice events), G-03 **V1** (role/authn/context), G-06 partial, G-07 baseline start |
| S2 | Approval rate inputs; abandoned; audit on issue/approve/revise; unauthorized **role** attempts | G-02, G-03 **V1** (role/authn), G-05 (issue/approve atomicity) |
| S3 | Approval→job time; dup job under retry; lineage quote→job; partial tx under failure | G-01 partial, G-04 jobs, G-05, G-02 |
| S4 | Job complete time; evidence completeness; Notes escape; failed transitions; tech help requests | G-06, G-02, G-13/14 metrics |
| S5 | Completion→invoice time; lineage 100%; dup invoice retry; void reason coverage; writer inventory | G-01, G-04 invoices, G-05, G-09 |
| S6 | Full scorecard baseline lock; all G-01–G-10; task-time caps published | **All blocking gates** |

**Baseline-first:** no invented numeric task-time targets until S1–S6 measurement window allows lock (G-07).

---

## 5. Migration strategy

| Slice | Migration expectation |
| --- | --- |
| S1 | Prefer **no** migration if enforceable in app + RLS; if quote state/audit tables missing columns, **separate migration auth** in S1 packet amendment |
| S2 | Likely schema/constraints for quote states, version immutability, approval records — **Dedicated Founder migration auth** if required |
| S3 | Idempotency keys / unique (quote_version→job) — migration if needed + auth |
| S4 | Job status columns if missing for ratified two-layer model — migration if needed + auth |
| S5 | Invoice immutability / numbering / lineage columns — migration if needed + auth |
| S6 | None preferred (verification only) |

**Rule:** No migration in a slice without explicit Founder migration line in that slice’s Decision Packet. Prefer additive, reversible migrations.

---

## 6. UX and field acceptance plan

- Mobile-first for customer find/create, quote entry (S1), approval surfaces (S2), job execution (S4), invoice review (S5).
- Housecall Pro = **workflow benchmark only** (states/cadence), not UI copy.
- P1 path must be **easier than Notes** (G-06).
- Real-device Founder + technician trials at S4 and mandatory at S6; S1/S2 office+mobile smoke.
- Escape-to-Notes diary from S1; zero on S6 gate trials.

---

## 7. Security and authorization plan

- Deny-by-default; least privilege; **internal role** matrix from Money-State §11.
- **V1:** single-company TVG — require valid TVG context on money writes.
- **V2 product model:** dedicated white-label instance per company (`BHFOS_V1_V2_PRODUCT_BOUNDARY.md`). **Shared multi-tenancy removed** from V2 scope.
- No UI-only auth; V1 negatives: unauthorized **role**, unauthenticated access (G-03). Cross-tenant suites **N/A**.
- Secrets never in logs; audit events without token/PII payloads.
- Single money-writer proven by payment-oriented slice (G-09); Stripe **in V1**.
- Autonomous follow-up **in V1** (separate from this security bullet list; see product boundary).

---

## 8. Data and lineage plan

```
lead (authoritative customer for P1)
  └─ service address (address_line_1 mapping)
       └─ quote + quote_version + quote_items
            └─ job (source_quote_id + version) + job scope lines
                 └─ invoice + invoice_items (lineage ids)
```

- No name-based linking (KI-03).
- UUID↔bigint: documented opaque/safe pattern only; no unification migration in P1 unless separately authorized as exception.

---

## 9. Financial-control plan

- S2: issued/approved immutability; approval amount+version.
- S5: issued invoice immutability; void/correction reason codes; reconciliation-ready fields.
- Payment readiness (partials, webhooks, idempotent intents) designed in S5; **not executed**.
- No alternate paid writers.

---

## 10. Rollback and recovery plan

| Level | Action |
| --- | --- |
| Code | `git revert` slice PR |
| Migration | Expand/contract or reverse migration per packet; never destructive without separate auth |
| Partial failure | Atomic units per Money-State Contract §14; visible error; safe retry |
| Exceptions | Owned queue by S5/S6; no silent automation failure on P1 path |

---

## 11. Slice definitions (complete)

### SLICE 1 — Customer and canonical quote foundation

| Field | Content |
| --- | --- |
| Business objective | Office/tech can find or create customer, select service address, create **draft** canonical quote with line items on `quotes` only |
| Roles | Office, Manager, Admin; Technician per policy (create draft if allowed) |
| Exact scope | Authoritative lead/customer identity for P1; service address selection; duplicate detection (warn/block); canonical `quotes` + line items; draft only; stable IDs; tenant enforcement; role authz; initial audit events; duplicate-submit protection; mobile-first entry; KPI instrumentation for S1 |
| Non-scope | Issue/approve/reject/expire; job; invoice; live pay; send-estimate; estimates table writes; property schema unification; TIS; G2.3 |
| Entities | `leads`/`contacts` as used today for customer; service address fields; `quotes`, `quote_items`; tenant; audit/event store |
| KI addressed | KI-01 (path), KI-02, KI-03 (pattern), KI-04, KI-05/08 (tenant/auth on new endpoints), KI-10 (via entities), KI-12 (draft events), KI-13/14/15 (start) |
| KI deferred | KI-03 unification, B-023, send-estimate, KI-17, KI-06/07/09 completion, KI-16 |
| Dependencies | Planning correction merged (`8d8ac06…`) |
| Migration | Prefer none; if required → explicit auth in S1 packet |
| Authz | Server-side create/update draft quote; tenant required |
| UX | Mobile-first find/create customer + draft quote; fewer taps; no Notes required for draft |
| Audit | quote.draft_created / line_item events with minimum fields |
| Idempotency | Duplicate submit → same draft quote id |
| Failure | No orphan quote without tenant/customer; rollback create |
| KPI | Time find/create customer; time create draft; taps; escape diary; tenant denies |
| Acceptance | Draft quote on `quotes` only; legacy estimates create blocked on P1 path; tenant negatives pass; audit present; mobile smoke |
| Blocking gates | G-02 (slice), G-03 **V1** (role/authn/context), G-08 for S1 critical KIs, start G-07 baseline |
| Reviewers | Product, UX/Field, Data, Security, Architecture |
| Branch/worktree | See Slice 1 Decision Packet |
| Evidence | Screenshots/IDs (no secrets); test log; KI checklist |
| Stop | Before issue/approve |
| Next slice criteria | S1 Founder acceptance → prepare S2 Decision Packet (no full replan) |

### SLICE 2 — Quote issue, revision, approval

| Field | Content |
| --- | --- |
| Business objective | Issue immutable quote versions; revise; approve/reject/expire with full approval audit |
| Roles | Office/Manager issue; Customer approve via designated method; Manager override+reason |
| Scope | States draft/issued/approved/rejected/expired/revised; immutability; approval actor/method/ts/amount/version; revision/expiration; partial-approval **policy** (default: whole-quote approve unless packet amends); cancel/reject reasons; idempotent approve; server authz; audit; mobile + customer-facing accept behavior |
| Non-scope | Job conversion; invoice; pay; send-estimate |
| Entities | Quote versions, approval records, state machine |
| KI | KI-01 remainder; KI-12; KI-08; KI-15 |
| Deferred | send-estimate; job |
| Migration | Likely state/version/approval tables — separate auth if needed |
| Gates | G-02, G-03 **V1** (role/authn), G-05 on issue/approve |
| Stop | Before accept→job |
| Next | S2 accepted → S3 packet |

### SLICE 3 — Approved quote → job

| Field | Content |
| --- | --- |
| Business objective | One idempotent job from approved quote version with lineage |
| Roles | System via accept; office trigger if allowed; no tech-created bypass |
| Scope | Version pin; accept→job idempotency; line→scope lineage; dup job prevention; atomicity; minimal job init per ratified two-layer model; office/tech assignment fields; rollback; retry; audit+correlation |
| Non-scope | Full field execution UI; invoice; pay; collapsing job FSM |
| KI | KI-16 (blocking); KI-12; KI-05; KI-09 assignment fields |
| Gates | G-01 partial, G-04 jobs, G-05, G-02 |
| Stop | Before job execution workflow |
| Next | S3 accepted → S4 packet |

### SLICE 4 — Job execution and completion

| Field | Content |
| --- | --- |
| Business objective | Field completes job with evidence; authorized transitions; no Notes escape |
| Roles | Technician, Office, Manager |
| Scope | States: scheduled, dispatched, on_my_way, arrived, started, paused (if required), completed, cancelled, no_access, rescheduled — **as authorized subset** of ratified two-layer model; tech identity; timestamps; notes/photos/findings/measurements; additional-work customer approval when required; completion evidence; mobile-first; safe retry/poor-connectivity; no dup complete; Notes-escape measurement |
| Non-scope | Invoice; pay; full offline sync engine; copying Housecall Pro UI |
| KI | KI-09, KI-13, KI-14, KI-06 design input, KI-12 |
| Gates | G-06 progress, G-02, G-05 |
| Benchmark | Housecall Pro workflow cadence only |
| Stop | Before invoice |
| Next | S4 accepted → S5 packet |

### SLICE 5 — Completed job → invoice

| Field | Content |
| --- | --- |
| Business objective | Invoice from approved+completed scope with full lineage; issued immutability; payment-ready |
| Roles | Office, Manager; Admin void+reason |
| Non-scope | Live Stripe/pay execution **in this slice** (Stripe remains **in V1** — schedule payment slice); send-estimate product |
| Scope | Generate from completed scope; quote→job→invoice lineage; draft/issued; issued immutability; numbering; taxes/fees/discounts/credits/deposits/adjustments as needed for P1; void/correction reasons; partial completion; dup invoice prevention; atomicity; financial audit; reconciliation-ready; **hand off to V1 Stripe payment work** |
| Stop | Before claiming Phase 1 USABLE without payment+follow-up evidence; invoice slice may stop before pay **execution** only if a named payment slice immediately follows |
| Next | S5 accepted → S6 packet |

### SLICE 6 — End-to-end UAT and Phase 1 acceptance

| Field | Content |
| --- | --- |
| Business objective | Prove office + Founder + technician mobile path USABLE under gates |
| Roles | Founder, Technician, Office, reviewers |
| Scope | Real-device tests; repeated-click; forced-failure; **V1** unauthorized-role/unauthenticated negatives; lineage verification; audit completeness; task-time baselines→caps; Notes escape testing; recovery/exceptions; blocking KPI review; UX/Field review disposition. **Cross-tenant suite = V2** |
| Non-scope | New product features; live pay; TIS; G2.3 reopen |
| Gates | **All G-01–G-10** |
| Stop | Phase 1 complete definition met or residual-risk acceptances signed |
| Next | Post-P1 only under new program auth |

---

## 12. Phase 1 completion definition

Phase 1 is **complete** when:

1. S1–S5 implementation slices accepted with evidence.  
2. S6 proves G-01–G-10 (or Founder signs residual-risk waivers per gate).  
3. Known-Issue Register shows all `P1_BLOCKING` items fixed or signed.  
4. Single money-writer proven; **Stripe payment path in V1** evidenced.  
5. Autonomous follow-up minimum in V1 evidenced (or Founder residual signed).  
6. send-estimate remains deferred unless a packet includes it.  
7. Founder declares Phase 1 / V1 USABLE — not CI alone.  
8. Shared multi-tenancy is **not** a completion requirement.

---

## 13. Worktree / branch naming convention

| Slice | Branch | Worktree |
| --- | --- | --- |
| S1 | `ml/p1-s1-customer-quote-foundation` | `F:\Dev\BHFOS-ml-p1-s1` |
| S2 | `ml/p1-s2-quote-issue-approval` | `F:\Dev\BHFOS-ml-p1-s2` |
| S3 | `ml/p1-s3-quote-to-job` | `F:\Dev\BHFOS-ml-p1-s3` |
| S4 | `ml/p1-s4-job-execution` | `F:\Dev\BHFOS-ml-p1-s4` |
| S5 | `ml/p1-s5-job-to-invoice` | `F:\Dev\BHFOS-ml-p1-s5` |
| S6 | `ml/p1-s6-uat-acceptance` (docs/evidence) | `F:\Dev\BHFOS-ml-p1-s6` |

**V1:** single-company The Vent Guys. **V2:** dedicated white-label instance per company — shared multi-tenancy **removed**.
See `BHFOS_V1_V2_PRODUCT_BOUNDARY.md`, `ML-P1_SLICE1_CLOSEOUT_AND_RESIDUAL_DISPOSITION.md`,
and `ML-P1_SLICE2_DECISION_PACKET.md` (docs only — coding not authorized by those docs alone).

Base each slice on the **then-current** `origin/main` after prior slice merge (anti-delay: no full replan).

---

## 14. Explicit program non-scope (clarify)

- Shared multi-tenancy / cross-tenant shared-runtime (removed from V1 and V2)  
- TIS / Pillar 2–4 (unless separately authorized)  
- G2.3 reopen  
- Full offline sync  
- UUID↔bigint unification migration  
- Full property multi-company rewrite  
- Visual workflow builder (unless value-proved)  

**Not “out of V1”:** Stripe payment processing; autonomous follow-up (placement in slices TBD).  
**Still slice-scoped:** send-estimate product may remain deferred from early money-loop slices until scheduled.

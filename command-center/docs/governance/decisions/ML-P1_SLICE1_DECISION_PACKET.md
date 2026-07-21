# Decision Packet — ML-P1 Slice 1 Implementation

> **One consolidated founder-facing decision surface.** Agent-prepared.
> No credentials, secrets, customer data, or pasted logs.
>
> **Roadmap:** `ML-P1_IMPLEMENTATION_ROADMAP.md` (complete Phase 1 sequence).
> **Baseline main:** `8d8ac06b7e64f2b8e92b04c76d7d7094c631831d`
>
> This packet requests **authorization to implement Slice 1 only** after the
> roadmap is accepted. Merging this packet as docs does **not** by itself start
> coding — Founder must authorize implementation at the named branch/base SHA
> (and later exact head SHA for merge).

---

## Release

| Field | Value |
| --- | --- |
| Release ID | `ML-P1-S1` |
| Governance | v2.2 |
| Risk tier | **Tier 3** (money-loop path foundation) |
| Slice | 1 of 6 — Customer and canonical quote foundation |
| Base SHA | `8d8ac06b7e64f2b8e92b04c76d7d7094c631831d` (or newer main if roadmap docs merge first — then rebase S1 base to that merge) |
| Proposed branch | `ml/p1-s1-customer-quote-foundation` |
| Proposed worktree | `F:\Dev\BHFOS-ml-p1-s1` |
| Do not use | `F:\Dev\BHFOS` (dirty) |

## Operational problem

Phase 1 cannot issue/approve/convert quotes safely until customer identity,
service address, and canonical `quotes` draft creation exist with tenant
enforcement, audit events, and legacy `estimates` create frozen on the P1 path.

## Proposed correction (Slice 1 implementation — when authorized)

Implement **only** Slice 1 per roadmap §11:

- Authoritative customer (lead) find/create for P1  
- Service address selection (`address_line_1` mapping)  
- Duplicate detection (warn/block — no silent dup)  
- Canonical draft `quotes` + `quote_items`  
- Stable IDs; tenant enforcement; role authorization  
- Initial audit events; duplicate-submit protection  
- Mobile-first customer + draft quote entry  
- S1 KPI instrumentation  

## Exact scope

1. P1 customer find/create UX + server APIs (tenant-scoped).  
2. Service address selection bound to customer/lead.  
3. Duplicate customer detection (deterministic rules documented in PR).  
4. Draft quote create/update/delete-draft on `quotes` / `quote_items` only.  
5. Block/hide legacy `estimates` **create** on P1 surfaces (server DENY).  
6. Document UUID↔bigint safe join pattern; no name-based linking.  
7. Audit events for draft create/update with Money-State Contract minimum fields.  
8. Idempotent draft create on double-submit.  
9. Automated tenant negative tests for new endpoints.  
10. Instrumentation hooks/events for S1 KPIs (times may be stopwatch initially).

## Explicit non-scope

- Quote issue / approve / reject / expire / revise (Slice 2)  
- Accept → job (Slice 3)  
- Job execution (Slice 4)  
- Invoice (Slice 5)  
- Live payment  
- send-estimate  
- Property schema unification / B-023  
- Migrations **unless** separately authorized in an amended line below  
- Deploy / production mutation without Production Operator auth  
- TIS / G2.3 reopen  

## Expected files and data entities (indicative)

| Area | Likely touch |
| --- | --- |
| UI | CRM quote builder / customer find-create mobile-capable surfaces under `command-center/src/pages/crm/` (exact files in impl PR) |
| Services | Quote/lead services; deny paths for `estimates` create |
| AuthZ / RLS | Tenant checks on quote/lead writes |
| Events | Draft quote audit emitter |
| Tests | Adapter/unit/e2e for tenant deny, estimates DENY, idempotent draft |
| Docs | Slice evidence appendix (no secrets) |

**Entities:** leads (customer), service address fields, `quotes`, `quote_items`, tenants, audit/event records.

## Migration request

**Default: none.**

If implementation discovers missing columns/constraints required for draft quotes or audit:

> **Separate Founder line required:** “Authorize additive migration `<name>` for Slice 1 only.”

Do not ship destructive migrations under this packet.

## Required reviews

| Role | Required |
| --- | --- |
| Product Owner | Yes |
| UX/Field Workflow | Yes |
| Data Guard | Yes |
| Security Guard | Yes |
| Architecture Guard | Yes (Tier 3 path) |
| Financial Control | Light (no settlement) |
| Release/Production | Only if deploy authorized later |

## Acceptance gates (Slice 1)

- Draft quotes created only on `quotes`; `estimates` create DENY on P1 path  
- Customer + service address selectable; address uses correct field mapping  
- Tenant negative tests: **0** unauthorized access  
- Audit events present for draft create (minimum fields)  
- Double-submit does not create duplicate drafts  
- Mobile smoke: create/find customer + draft quote without Notes  
- KI-01/02/04 progress evidenced; KI-03 pattern documented  
- No issue/approve/job/invoice code paths shipped as “done”

Maps to roadmap gates: G-02 (slice), G-03, G-08 (S1 critical), G-07 baseline **start**.

## KPI instrumentation (Slice 1)

- Time to create/find customer (stopwatch/telemetry)  
- Time to create draft quote  
- Taps/screens count (task analysis)  
- Notes/text/paper escape diary (target observation)  
- Duplicate-customer detection hits  
- Cross-tenant deny count  
- Audit completeness % for draft events  

Targets remain `BASELINE_FIRST` except binary gates (0 unauthorized, estimates DENY).

## Rollback plan

1. Revert implementation PR(s).  
2. If migration was authorized: reverse/expand-contract per migration packet.  
3. No production data backfill without separate auth.  
4. Feature flags preferred for UI cutover where feasible.

## Authorized stopping point

**Stop before** quote issue, approval, job conversion, invoice, or payment.

## Criteria to authorize Slice 2

- Founder accepts Slice 1 evidence  
- S1 gates green  
- Orchestrator prepares S2 Decision Packet from roadmap (**no full replan**)

## Exact authorization requested (implementation)

> **"Authorize ML-P1 Slice 1 implementation on branch
> `ml/p1-s1-customer-quote-foundation` in worktree `F:\Dev\BHFOS-ml-p1-s1`,
> base SHA `8d8ac06b7e64f2b8e92b04c76d7d7094c631831d` (or the roadmap-docs merge
> SHA if that merges first — Orchestrator must state the exact base at kickoff),
> scope limited to customer find/create, service address, canonical draft quotes
> on `quotes` only, tenant/authz, audit, idempotent submit, mobile-first entry,
> and S1 KPI instrumentation. Do not authorize Slice 2–6, issue/approve, job,
> invoice, live pay, send-estimate, migrations (unless separately named), deploy,
> TIS, or G2.3 reopen. Merge of the Slice 1 code PR still requires a later exact
> head-SHA authorization."**

## Explicit non-authorization

Does **not** authorize: Slices 2–6; quote approval; jobs; invoices; live pay;
send-estimate; deploy; unrestricted migrations; production mutation; TIS; G2.3 reopen.

## Recommendation

1. Founder **accepts** the complete Phase 1 Implementation Roadmap.  
2. Founder separately **authorizes Slice 1** with the exact text above when ready to start coding.  
3. Do **not** start implementation from roadmap acceptance alone.

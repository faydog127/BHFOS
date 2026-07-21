# Decision Packet — ML-P1 Slice 2 Implementation

> **One consolidated founder-facing decision surface.** Agent-prepared.
> No credentials, secrets, customer data, or pasted logs.
>
> **Roadmap:** `ML-P1_IMPLEMENTATION_ROADMAP.md` § Slice 2.
> **Baseline main (post–Slice 1 merge):** `2b62bf35dd2cc32ac30808ba36b3ad93ff1547ab`
> **Slice 1 closeout / residuals:** `ML-P1_SLICE1_CLOSEOUT_AND_RESIDUAL_DISPOSITION.md`
>
> Merging this packet as docs does **not** authorize Slice 2 coding.
> Coding requires: (1) R-S1-01 migration authorized + merged; (2) separate
> Founder implementation auth at named branch/base SHA; (3) later exact
> head-SHA merge auth.

---

## Release

| Field | Value |
| --- | --- |
| Release ID | `ML-P1-S2` |
| Governance | v2.2 |
| Risk tier | **Tier 3** (money-state issue / approval) |
| Slice | 2 of 6 — Quote issue, revision, approval |
| Base SHA | `2b62bf35dd2cc32ac30808ba36b3ad93ff1547ab` (or newer `main` after R-S1-01 migration merges — Orchestrator must state exact base at kickoff) |
| Proposed branch | `ml/p1-s2-quote-issue-approval` |
| Proposed worktree | `F:\Dev\BHFOS-ml-p1-s2` |
| Do not use | `F:\Dev\BHFOS` (dirty) |

## Operational problem

Slice 1 delivered draft-only canonical quotes. Phase 1 cannot proceed to job
conversion until quotes can be **issued** as immutable versions, **revised**,
and **approved / rejected / expired** with server-side authz, tenant DENY,
idempotent transitions, and full audit — without reopening dual `estimates`
writers or skipping G-03.

## Prerequisite before Slice 2 coding (hard gate)

| ID | Prerequisite | Status |
| --- | --- | --- |
| **R-S1-01** | Server/RLS DENY on `estimates` INSERT — separately authorized additive migration + evidence | **Must complete before S2 implementation starts** |

Do **not** authorize S2 coding while R-S1-01 is open.

## Proposed correction (Slice 2 implementation — when authorized)

Implement **only** Slice 2 per roadmap §11, and close in-scope residuals:

- Quote states: draft → issued → approved / rejected / expired / revised  
- Immutable issued/approved content; revision creates new version  
- Approval record: actor, method, timestamp, amount, quote version id  
- Server-side transition + role matrix (§11) — **closes R-S1-03**  
- Idempotent issue/approve (+ draft idempotency unique — **closes R-S1-02**)  
- Tenant deny-by-default on all new writes  
- Audit events (G-02 slice) with Money-State minimum fields  
- Mobile + designated customer accept path (not send-estimate product)  
- Automated G-03 cross-tenant negatives on S2 entities — **required before S2 acceptance (R-S1-04)**  

## Exact scope

1. Issue draft quote → immutable version (`issued`).  
2. Revise issued/approved path → new draft/version; supersede prior.  
3. Approve / reject / expire with reason codes where required.  
4. Manager override of approval path only with reason + role (server-enforced).  
5. Partial-approval **policy default:** whole-quote approve only (amend only via Founder line).  
6. Idempotent approve/issue (and draft create unique constraint per R-S1-02).  
7. Server authz for Office/Manager issue; customer designated approve; deny UI-only.  
8. Audit for every material transition (G-02).  
9. Mobile office surfaces + customer-facing accept behavior (minimal).  
10. Tenant session-required writes; no URL/default tenant fallback.  
11. Automated G-03 negatives before acceptance (R-S1-04).  
12. Evidence appendix (no secrets).

## Explicit non-scope

- Accept → job (Slice 3)  
- Job execution (Slice 4)  
- Invoice (Slice 5)  
- Live payment  
- send-estimate product / outbound marketing send  
- Wholesale legacy `estimates` UI purge beyond create INSERT DENY (R-S1-01)  
- UUID↔bigint unification; B-023 property rewrite  
- Deploy / production mutation without Production Operator auth  
- TIS / G2.3 reopen  
- Full offline sync engine  

## Residuals inherited from Slice 1 (binding)

| ID | Class | In this packet |
| --- | --- | --- |
| R-S1-01 estimates RLS DENY | Before S2 coding | **Prerequisite** — separate migration packet/auth |
| R-S1-02 draft idempotency UNIQUE | Inside S2 | **In scope** when S2 coding authorized |
| R-S1-03 role matrix server | Inside S2 | **In scope** |
| R-S1-04 live G-03 | Before S2 acceptance | **Acceptance gate** — not optional |

## Migration request

### A — Prerequisite (before S2 coding) — Founder line required now

> **Authorize additive migration** `ml_p1_s1_estimates_insert_deny` (final name
> may be timestamp-prefixed by Implementer) **for R-S1-01 only:** DENY
> `INSERT` on `public.estimates` for authenticated/anon app roles (service_role
> break-glass documented). No destructive changes. Apply only after Architecture
> + Security Guard on the migration PR exact head.

### B — Inside Slice 2 (when S2 coding authorized) — Founder line at S2 kickoff

If schema/constraints for quote versions, approval records, and/or draft
idempotency unique are required:

> **Authorize additive migration(s)** named in the S2 implementation kickoff
> for Slice 2 only (versions/approvals/idempotency). Prefer additive,
> reversible. No destructive migrations.

Do not ship B before A is merged to `main`.

## Required reviews

| Role | Required |
| --- | --- |
| Product Owner | Yes |
| UX/Field Workflow | Yes |
| Data Guard | Yes |
| Security Guard | Yes |
| Architecture Guard | Yes (Tier 3) |
| Financial Control | **Required** (roadmap S2) |
| Release/Production | Only if deploy authorized later |

## Acceptance gates (Slice 2)

- Issue/revise/approve/reject/expire work only on canonical `quotes` versions  
- R-S1-01 proven (estimates INSERT DENY at server)  
- R-S1-02 proven (0 duplicate drafts under retry harness)  
- R-S1-03 proven (unauthorized role → DENY)  
- R-S1-04 / **G-03:** 0 unauthorized cross-tenant successes  
- **G-02** audit completeness on S2 transitions  
- **G-05** no silent partial on issue/approve under forced failure  
- Immutability: issued/approved content not silently editable  
- Idempotent approve returns same approval/version outcome  
- No job / invoice / pay / send-estimate shipped as done  

Maps to roadmap: G-02, G-03, G-05 on issue/approve.

## KPI instrumentation (Slice 2)

- Issue / approve / revise / reject / expire counts and timings  
- Unauthorized transition attempts  
- Abandoned issued quotes  
- Audit completeness % on S2 events  
- Cross-tenant deny count  
- Idempotent hit rate on approve/issue  

Targets remain `BASELINE_FIRST` except binary DENY gates.

## Rollback plan

1. Revert S2 implementation PR(s).  
2. Reverse/expand-contract authorized migrations per migration packet.  
3. No production backfill without separate auth.  
4. Feature flags preferred for issue/approve UI cutover.

## Authorized stopping point

**Stop before** accept → job conversion, invoice, or payment.

## Criteria to authorize Slice 3

- Founder accepts Slice 2 evidence (incl. R-S1-02/03/04)  
- S2 gates green  
- Orchestrator prepares S3 Decision Packet from roadmap (**no full replan**)

## Exact authorization requested (docs merge only — this PR)

> Accept Slice 1 closeout residual disposition and merge this Slice 2 Decision
> Packet as **planning docs** at base `2b62bf35dd2cc32ac30808ba36b3ad93ff1547ab`
> (or the docs PR head when authorized). Does **not** authorize Slice 2 coding.

## Exact authorization requested (later — coding)

After R-S1-01 migration is merged:

> **"Authorize ML-P1 Slice 2 implementation on branch
> `ml/p1-s2-quote-issue-approval` in worktree `F:\Dev\BHFOS-ml-p1-s2`, base SHA
> `<exact main after R-S1-01 merge>`, scope limited to quote issue / revision /
> approval / reject / expire with server authz, tenant DENY, audit, idempotency
> (incl. R-S1-02), and G-03 evidence path. Include R-S1-03. Do not authorize
> Slice 3–6, job, invoice, live pay, send-estimate, deploy, TIS, or G2.3 reopen.
> Migrations only if named in a Founder migration line. Merge of the Slice 2
> code PR still requires later exact head-SHA authorization."**

## Explicit non-authorization

Does **not** authorize: Slice 2 coding (until prerequisites + coding line);
Slices 3–6; jobs; invoices; live pay; send-estimate; deploy; unrestricted
migrations; production mutation; TIS; G2.3 reopen.

## Recommendation

1. Founder **accepts** residual disposition (R-S1-01…04).  
2. Founder **authorizes R-S1-01 migration** (separate line) and Implementer
   opens migration-only PR → review → merge.  
3. Founder **merges this docs packet** when ready.  
4. Founder **separately authorizes Slice 2 coding** only after R-S1-01 is on
   `main`, using the coding text above with the exact post-migration base SHA.

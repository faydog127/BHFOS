# Decision Packet — ML-P1 Slice 2 Implementation (PR #78 freeze)

> **One consolidated founder-facing decision surface.** Agent-prepared.
> No credentials, secrets, customer data, or pasted logs.
>
> Reviews and adversarial Test address exact frozen head below.
> **Do not merge, deploy, apply S2 migrations, or begin Slice 3 under this packet alone.**

---

## Release

| Field | Value |
| --- | --- |
| Release ID | `ML-P1-S2` |
| Governance | v2.2 + Reduced AI Development Assurance Pilot |
| Risk tier | **Tier 3** (money-state) |
| PR | [#78](https://github.com/faydog127/BHFOS/pull/78) |
| Branch / worktree | `ml/p1-s2-quote-issue-approval` / `F:\Dev\BHFOS-ml-p1-s2` |
| Coding auth base | `caacdc071db3e3333b7109a526681d99f9bb8356` |
| **Frozen PR head** | `773e3f5d0d9a66eccaffeb277162bad007b29e73` |

## Operational problem

Slice 2 must deliver issue / revise / approve / reject / expire on canonical quotes with R-S1-02 UNIQUE and R-S1-03 role authz, while stopping before accept→job (S3).

## What landed at freeze (SOURCE / unit EXECUTED)

- Lifecycle service + office UI + R-S1-03 client role matrix  
- Migration `20260721160000_ml_p1_s2_quote_lifecycle_rs102.sql` (R-S1-02 UNIQUE, versioning columns, **job-create gate default off**) — **not applied to prod**  
- Evidence Manifest + review packets  
- Unit + adversarial helper suites green at freeze  

## What does NOT change / hard stops held

No merge · no deploy · no production S2 migration apply (needs separate **A3**) · no Slice 3 · no Stripe · no autonomous follow-up · no invoice product · R-S1-01 not reopened  

## Evidence (executed vs source-only)

| Claim | Level |
| --- | --- |
| Role DENY / transition DENY / tenant DENY / break-glass reason / estimates DENY / revise lineage / `jobCreated:false` on **S2 service** | **EXECUTED** (local unit) |
| Migration gate design (after apply: no auto-job on accept; default-off coalesce) | **SOURCE-ONLY** (Data APPROVE) |
| Live DB job-gate posture / prod apply | **NOT PROVEN** (correct A3 boundary) |
| Designated customer accept stops before job | **FAIL** on live path (see below) |
| Server-side R-S1-03 / transition enforcement | **NOT MET** (client-only) |

**CI at freeze:** build, lint, identity_contracts, founder_run_readiness, control_plane_lane, ledger_lock, supabase_oauth_helper — **pass**.  
(`validate:review-governance` fails on main for pre-existing `tenant_id` schema gap — not introduced by this PR.)

## Reconciled reviews @ `773e3f5d0d9a66eccaffeb277162bad007b29e73`

| Role | Verdict |
| --- | --- |
| Product | **CHANGES_REQUIRED** |
| Data | **APPROVE** |
| Security | **CHANGES_REQUIRED** |
| Financial Control | **APPROVE** (with pre-A3 / edge warnings) |
| Architecture | **CHANGES_REQUIRED** |
| UX/Field | **APPROVE** |
| Independent Adversarial Test | **FAIL** |

### Blocking consensus (cross-role)

1. **Live designated customer accept still creates jobs (P0/P1)**  
   `QuoteView` → `public-quote-approve` still inserts jobs. S2 `approveByPublicToken` is unwired. Migration trigger gate does **not** stop the edge path. Violates S2 hard stop and in-scope customer accept.

2. **Pre-A3 CRM approve still auto-jobs (P0)**  
   Until migration apply, DB trigger always creates a job on `accepted`. Service `jobCreated: false` is not DB truth. Financial Control: do not enable approve against production until A3.

3. **R-S1-03 / transitions are client-only (P1 / Security HIGH)**  
   Money-State §11–12 require server-side authz. Tenant JWT can UPDATE `quotes` status via RLS without role/transition checks; `actorRole` is caller-supplied; `approveByPublicToken` hardcodes customer capability.

4. **Concurrent approve / non-atomic revise (P1–P2)**  
   No optimistic `WHERE status = …` on lifecycle updates; concurrent public-token approve can double-succeed + duplicate audits. Revise is mark-then-insert (partial failure risk).

### Non-blocking

- Evidence Manifest Head field still cites impl commit `4c6d44f…` (freeze tip is `773e3f5…`) — S-01 hygiene  
- Approval audit `related` omits `quote_version` / amount / method (row has them) — P2  
- Paid→job branch retained in replaced trigger — pre-existing residual  

## Job-create gate (Founder attention)

| Posture | Accept recorded? | Auto job? |
| --- | --- | --- |
| **After** A3 apply + S2 office path | Yes | **No** (gate false + deferred event) |
| **Before** A3 apply | Yes | **Yes** (legacy trigger) |
| **Live** `public-quote-approve` | Yes | **Yes** (edge insert; bypasses gate) |

Data Review: migration design is correct for post-apply trigger path. Boundary is **not** closed for production customer accept.

## Recommendation

**Do not authorize merge of PR #78 at `773e3f5…`.**

Authorize a **remediation cycle under existing S2 A2** on the same branch, then re-freeze and re-review. Minimum remediations before merge auth:

1. Neutralize accept→job on designated customer path (gate/remove job insert in `public-quote-approve`, or cut `QuoteView` over to S2 approve without job create).  
2. Add **server** enforcement for R-S1-03 + transition matrix (RPC / SECURITY DEFINER writer and/or tighter RLS) — Contract §11.  
3. Optimistic concurrency on lifecycle status updates; harden revise against partial failure.  
4. Refresh Evidence Manifest Head SHA to the new freeze tip; enrich approval audit related fields.

**A3** (prod apply of `20260721160000_…`) remains a **separate** Founder line after merge; do not apply until customer edge and server authz remediations land or are explicitly accepted with controls.

## Exact authorization requested

> **No** — do not merge PR #78 at `773e3f5d0d9a66eccaffeb277162bad007b29e73`.

Optional follow-on (yes/no):

> Authorize S2 A2 remediation on `ml/p1-s2-quote-issue-approval` / `F:\Dev\BHFOS-ml-p1-s2` to close blockers (1)–(4) above; re-freeze; re-run required reviews + adversarial Test; return a new Decision Packet. Still no deploy / no prod migration apply / no Slice 3.

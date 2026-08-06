# Decision Packet — ML-P1 R-S1-01 Production Apply

> **One consolidated founder-facing decision surface.** Agent-prepared.
> No credentials, secrets, customer data, or pasted logs.
>
> **Does not apply the migration. Does not deploy. Does not authorize Slice 2,
> Stripe, follow-up, TIS, or G2.3 reopen.**
>
> Authoritative `origin/main`: `80acb8eb9bcff8771027f76c47257de657a2103e`  
> (PR #69 merge — migration artifact on `main`, **not yet applied**).

---

## Release

| Field | Value |
| --- | --- |
| Release ID | `ML-P1-RS101-APPLY` |
| Residual | **R-S1-01** |
| Risk tier | **Tier 3** (money_state path control) |
| Artifact main SHA | `80acb8eb9bcff8771027f76c47257de657a2103e` |
| Migration PR | [#69](https://github.com/faydog127/BHFOS/pull/69) @ `a1ac3ee81532398ab04c1865da4ac7baf478f47b` |
| Companion | `ML-P1_RS101_ESTIMATES_INSERT_DENY.md` |

## Operational problem

Server-side `public.estimates` INSERT remains an alternate money-writer path until
the merged R-S1-01 migration is **applied** to production. App create is already
DENIED (Slice 1); server DENY is required before Slice 2 coding.

## Proposed action (when Founder authorizes)

Apply **only** migration
`20260721120000_ml_p1_rs101_deny_estimates_insert.sql` to the production
Supabase project for TVG V1 — no app deploy, no other migrations, no Slice 2.

## Exact scope

1. Deny new `public.estimates` INSERT for application roles (`authenticated`, `anon`).
2. Enforce canonical `quotes` path.
3. Prevent an alternate money writer.

## Explicit non-goals

- Production deploy of app/edge functions  
- Slice 2 coding  
- Stripe / autonomous follow-up / TIS / G2.3  
- SELECT / UPDATE / DELETE policy redesign  
- `FORCE ROW LEVEL SECURITY`  
- Data backfill or row mutation  

## Hard pre-apply precondition (read-only)

Founder (or authorized operator under separate line) must run the **Pre-apply
SQL checklist** below in Supabase SQL Editor **read-only** and confirm:

1. `relrowsecurity = true` on `public.estimates` **before** apply, **or**  
   Founder explicitly accepts that first-time ENABLE could deny all app ops if
   no permissive SELECT/UPDATE/DELETE policies exist.
2. Neither named R-S1-01 policy already exists (or re-apply is understood idempotent).
3. No surprise permissive INSERT policy that would change blast-radius expectations
   (RESTRICTIVE deny still wins; checklist is for evidence, not mechanism).

---

## TECHNICAL RESULT

| Item | Evidence |
| --- | --- |
| Migration on `main` | Yes — PR #69 → `80acb8eb9bcff8771027f76c47257de657a2103e` |
| Applied to production | **No** |
| Live hosted SQL this session | **Not executed** — `execute-sql` prohibited; I2 `database_read` not available in this agent session |
| Best hosted schema evidence | Production schema dump `20260710-022218-partial-inspection-54cb267-pg17` (`public-storage-schema.sql`, 2026-07-10) |
| App INSERT path | Slice 1 DENY — `EstimateEditorModal` calls `assertEstimatesCreateAllowed`; no `.insert` into `estimates` |
| Canonical draft quotes | `mlP1S1QuoteDraftService` inserts `quotes` / `quote_items` only — independent of estimates INSERT |

---

## HOSTED PRE-APPLY POSTURE

### Evidence class

| Class | Status |
| --- | --- |
| LIVE Dashboard/SQL query (2026-07-21) | **NOT PERFORMED** |
| Hosted schema dump (2026-07-10) | **USED** — treat as best available; may drift |

### Dump observations (`public.estimates`)

| Check | Result (dump) |
| --- | --- |
| Table exists | Yes |
| `ENABLE ROW LEVEL SECURITY` | **Yes** (`ALTER TABLE public.estimates ENABLE ROW LEVEL SECURITY`) |
| `FORCE ROW LEVEL SECURITY` | **Not present** in dump |
| `CREATE POLICY … ON public.estimates` | **None** found |
| Table GRANT lines for `estimates` | **Not present** in this dump (privileges section incomplete / stripped) |

### Interpretation

| Topic | Assessment |
| --- | --- |
| Application roles in scope | Supabase PostgREST roles **`authenticated`** and **`anon`** (migration targets) |
| INSERT under dump posture | With RLS on and **no** policies, Postgres default-denies INSERT for non-owner / non-BYPASSRLS roles — dump suggests INSERT may **already** be denied for app roles |
| Why apply anyway | Explicit, named, RESTRICTIVE DENY survives any future permissive INSERT/ALL policy; closes residual R-S1-01; matches Money-State Contract |
| Critical drift risk | If live RLS is **off** (unlike dump), `ENABLE ROW LEVEL SECURITY` without SELECT policies can deny legacy **reads/updates** — **must confirm live `relrowsecurity` before apply** |

### Pre-apply SQL checklist (Founder / authorized operator — read only)

```sql
-- 1) RLS flag
SELECT c.relname, c.relrowsecurity, c.relforcerowsecurity
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relname = 'estimates';

-- 2) Existing policies
SELECT polname, polcmd, polpermissive, polroles::regrole[], pg_get_expr(polqual, polrelid) AS using_expr,
       pg_get_expr(polwithcheck, polrelid) AS with_check
FROM pg_policy
WHERE polrelid = 'public.estimates'::regclass
ORDER BY polname;

-- 3) Privileges (INSERT)
SELECT grantee, privilege_type
FROM information_schema.role_table_grants
WHERE table_schema = 'public' AND table_name = 'estimates'
ORDER BY grantee, privilege_type;
```

**Pass criteria for low-risk apply:** `relrowsecurity = true` already, and apply only adds the two RESTRICTIVE INSERT policies.

---

## CURRENT PRODUCTION WRITE-PATH CHECK

### Source at `80acb8eb…` (command-center)

| Path | Operation on `estimates` | Notes |
| --- | --- | --- |
| `EstimateEditorModal.jsx` | **Create DENY** (app) | `assertEstimatesCreateAllowed`; no insert attempted |
| `EstimateManager.jsx` | SELECT + **UPDATE** status | Not INSERT; R-S1-01 does not block UPDATE |
| `Estimates.jsx` | SELECT | Read |
| `quoteService.createQuoteFromEstimate` | SELECT then insert **`quotes`** | Read-only on estimates |
| `emailService.js` | SELECT | Read |
| `EmailActionMenu.jsx` | SELECT | Read |
| `TrafficCopVerify.jsx` | SELECT | Diagnostics/test |
| `send-estimate` edge | SELECT via **`supabaseAdmin`** | service_role / BYPASSRLS read |

### Active money create path (canonical)

| Path | Tables written |
| --- | --- |
| `mlP1S1QuoteDraftService` | `quotes`, `quote_items` (+ audit `events`) — **no** `estimates` INSERT |
| `ProposalBuilder` / `QuoteBuilder` | `quotes` / `quote_items` |

**Conclusion:** No current production **application** workflow under Slice 1 should INSERT into `public.estimates`. Residual risk is bypass clients, stale builds without app DENY, or direct SQL/API inserts as `authenticated`/`anon`. Server DENY closes that.

**Quotes independence:** Canonical draft creation does **not** require `estimates` INSERT. Optional `estimate_id` FK on quotes is read/link only.

---

## EXACT MIGRATION ARTIFACT

| Field | Value |
| --- | --- |
| Filename | `command-center/supabase/migrations/20260721120000_ml_p1_rs101_deny_estimates_insert.sql` |
| Main commit | `80acb8eb9bcff8771027f76c47257de657a2103e` |
| Git blob SHA | `08cf08b1041f42ab10b2ffed237d3cf5511e78f8` |
| Content SHA-256 (UTF-8, git show bytes) | `385404e1986012d83a75a3bc199f3b8b266cd1fa9d4befe77789d0f27598fcb2` |
| Size | 1623 bytes (git show) |

Mechanism:

- `ALTER TABLE public.estimates ENABLE ROW LEVEL SECURITY;` (idempotent if already on)
- RESTRICTIVE `FOR INSERT TO authenticated|anon WITH CHECK (false)`
- Policy names:
  - `ml_p1_rs101_deny_estimates_insert_authenticated`
  - `ml_p1_rs101_deny_estimates_insert_anon`

---

## EXPECTED POST-APPLY STATE

| Actor | INSERT `public.estimates` | SELECT / UPDATE (unchanged by this migration) |
| --- | --- | --- |
| `authenticated` | **DENIED** (RESTRICTIVE false) | Unchanged vs pre-apply policy set |
| `anon` | **DENIED** | Unchanged |
| `service_role` / BYPASSRLS | **Allowed** (RLS bypass) | Allowed |
| Table owner (postgres/supabase_admin) | Allowed unless FORCE RLS | Allowed |

`quotes` INSERT policies and app draft path unchanged.

---

## ROLLBACK PLAN

**Authorized only by separate Founder line after apply.**

```sql
BEGIN;
DROP POLICY IF EXISTS "ml_p1_rs101_deny_estimates_insert_authenticated"
  ON public.estimates;
DROP POLICY IF EXISTS "ml_p1_rs101_deny_estimates_insert_anon"
  ON public.estimates;
COMMIT;
```

**Does not** `DISABLE ROW LEVEL SECURITY`. If apply newly enabled RLS on a previously RLS-off table, reversal of ENABLE requires a **separate** Founder authorization (out of default rollback).

---

## POST-APPLY VERIFICATION PLAN

```sql
-- Policies present and restrictive
SELECT polname, polcmd, polpermissive
FROM pg_policy
WHERE polrelid = 'public.estimates'::regclass
  AND polname LIKE 'ml_p1_rs101_deny_estimates_insert_%';
-- Expect: 2 rows, polcmd = 'a' (INSERT), polpermissive = false
```

Behavioral (non-destructive):

1. As normal CRM user (`authenticated`): attempt INSERT into `estimates` via API/SQL as that role → expect RLS/policy rejection.  
2. Create draft quote via canonical S1 path → expect success (`quotes` insert).  
3. Optional: service_role break-glass SELECT on existing estimate row still works (no customer PII in evidence logs).

Do **not** use `execute-sql` Edge Function for verification.

---

## SECURITY REVIEW STATUS

| Review | Head | Verdict |
| --- | --- | --- |
| Security Guard (merge PR #69) | `a1ac3ee81532398ab04c1865da4ac7baf478f47b` | `APPROVE_MERGE` — no blocking findings |
| Apply-time residual | Hosted live RLS/policy state | Confirm via pre-apply SQL before Founder apply auth |

---

## ARCHITECTURE REVIEW STATUS

| Review | Head | Verdict |
| --- | --- | --- |
| Architecture Guard (merge PR #69) | `a1ac3ee81532398ab04c1865da4ac7baf478f47b` | `APPROVE_FOR_INDEPENDENT_UAT` — no blocking findings |
| Non-blocking (still open for apply) | Pre-apply live RLS posture; ENABLE rollback gap; no automated RLS test | Addressed by pre-apply checklist + post-apply verification |

---

## BLAST RADIUS AND RESIDUAL RISK

| Risk | Level | Mitigation |
| --- | --- | --- |
| Block alternate `estimates` INSERT writers | Intended | RESTRICTIVE deny |
| Break canonical `quotes` create | Low | Independent tables/policies |
| Break legacy estimates SELECT/UPDATE | **Conditional** | High only if live RLS newly enabled without SELECT/UPDATE policies — **pre-apply confirm `relrowsecurity`** |
| service_role / edge read paths | Low | BYPASSRLS unchanged; send-estimate is SELECT |
| Dump drift vs live (11+ days) | Medium | Mandatory pre-apply SQL |
| App still UPDATEs estimate status | Accepted | Out of R-S1-01 INSERT scope |

---

## FOUNDER PRODUCTION-APPLY AUTHORIZATION LINE

After pre-apply SQL confirms `relrowsecurity = true` on `public.estimates` (or Founder explicitly accepts ENABLE risk):

> Approve production apply of migration `20260721120000_ml_p1_rs101_deny_estimates_insert.sql` (SHA-256 `385404e1986012d83a75a3bc199f3b8b266cd1fa9d4befe77789d0f27598fcb2`) from main `80acb8eb9bcff8771027f76c47257de657a2103e` only. No deploy. No Slice 2. No other migrations.

---

## AUTHORIZED NEXT STATE

1. Founder runs (or delegates) **pre-apply SQL checklist** — read only.  
2. Founder replies with the **production-apply authorization line** (exact).  
3. Authorized operator applies **only** that migration file.  
4. Run post-apply verification.  
5. Slice 2 coding still requires a **separate** Founder coding authorization at then-current `main`.

**This packet alone does not authorize apply.**

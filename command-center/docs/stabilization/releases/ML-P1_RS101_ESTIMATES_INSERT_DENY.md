# ML-P1 R-S1-01 — `estimates` INSERT DENY (server)

> **Migration artifact only.** Does **not** authorize production apply, deploy,
> Slice 2 coding, Stripe, autonomous follow-up, TIS, or G2.3 reopen.
>
> Base `origin/main`: `aaf8a766e1b5be758648dd6497922b0fc77399e9`  
> Residual authority: `ML-P1_SLICE1_CLOSEOUT_AND_RESIDUAL_DISPOSITION.md`

---

## 1. Intent

| Field | Value |
| --- | --- |
| Residual | **R-S1-01** |
| Table | `public.estimates` |
| Action | Deny **INSERT** for application roles (`authenticated`, `anon`) |
| Why | Canonical money path: prevent deprecated `estimates` writes; enforce `quotes`; prevent alternate money writer |
| Not | Tenant isolation / cross-tenant G-03 |

---

## 2. Migration

| Field | Value |
| --- | --- |
| File | `command-center/supabase/migrations/20260721120000_ml_p1_rs101_deny_estimates_insert.sql` |
| Style | Additive RESTRICTIVE RLS `WITH CHECK (false)` on INSERT |
| Destructive ops | None (no table/column/data mutation) |
| Out of scope | SELECT/UPDATE/DELETE policy changes; Slice 2 app; Stripe; follow-up |

---

## 3. Review and merge gates

| Gate | Status |
| --- | --- |
| Security Guard review | **Required** before Founder merge authorization |
| Architecture Guard review | **Required** before Founder merge authorization |
| Founder merge at exact frozen head | Required after both reviews clear |
| Production apply / deploy | **Not authorized** by this PR alone |
| Slice 2 coding | **Not authorized** |

---

## 4. Rollback (if ever applied)

Drop the two named policies:

- `ml_p1_rs101_deny_estimates_insert_authenticated`
- `ml_p1_rs101_deny_estimates_insert_anon`

Do not use rollback without separate Founder authorization.

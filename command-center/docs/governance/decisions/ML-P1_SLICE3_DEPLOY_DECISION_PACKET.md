# Decision Packet — ML-P1 Slice 3 Production Deploy (Edge + Hostinger)

> Reduced AI Development Assurance Pilot.  
> Migration already applied and I2-verified; **do not reapply**.  
> **Deploy executed 2026-07-21** under Founder authorization (see post-evidence).

---

## Disposition

# **SLICE3_DEPLOY_EXECUTED — IDENTITY PASS / MONEY-PATH OPERATOR PENDING**

Founder authorized coordinated deploy of (1) three Supabase Edge Functions and (2)
Hostinger static frontend from tip `5cd7360…`. Does **not** authorize Slice 4,
Stripe, invoices, autonomous follow-up, TIS, G2.3, or migration re-apply.

Evidence: `docs/stabilization/releases/ML-P1_SLICE3_DEPLOY_POST_EVIDENCE.md`

---

## Release identity

| Field | Value |
| --- | --- |
| Release ID | `ML-P1-S3-DEPLOY` |
| Main tip (deploy SHA) | `5cd7360aceb5492985cea6f3ff56253e5165bbea` |
| Supabase project | `wwyxohjnyqnegzbxtuxs` |
| Production site | `app.bhfos.com` (Hostinger static) |
| Slice 3 migration | `20260721200000_ml_p1_s3_canonical_job_writer` — **already applied** · post-apply **PASS** |
| Migration re-apply | **Forbidden** under this packet |

---

## Edge Function deploy set (exact — no others)

| Function | Role in Slice 3 | Source path | SHA-256 (LF git blob @ main) |
| --- | --- | --- | --- |
| `public-quote-approve` | Public-token approval → RPC + job pass-through; fail-closed without writer | `command-center/supabase/functions/public-quote-approve/index.ts` | `B03DAD1AFC5B72292169524B0B3178C1B45307A2EFF62716200178874119300A` |
| `quote-update-status` | Status-path DENY for accept/approve | `command-center/supabase/functions/quote-update-status/index.ts` | `3D11DBD27DF8AD6F0271C0278557C6020DAE5B8D3AA3FC1ACD74EB1BE5440EC1` |
| `kanban-move` | No quote-linked job insert; accept status DENY | `command-center/supabase/functions/kanban-move/index.ts` | `EB00F3A80D3A1071990BB491561F31FA935E464A99B708201D401FF039CF871C` |

**Not in deploy set:** all other Edge Functions (unchanged by Slice 3).

Office approval uses browser → `ml_p1_s2_quote_lifecycle` RPC (no Edge). Public approval uses `public-quote-approve` Edge → `ml_p1_s2_quote_approve_public` RPC (DB already applied).

### Edge pre-check notes

| Check | Result |
| --- | --- |
| Unrelated functions included | **No** |
| `deno check` on deploy set | **FAIL** (13 TS strict errors; `quote-update-status` `error?.message` pattern present on pre-S3 `ef24707` tip — treat as pre-existing residual, not S3 product defect). Supabase function deploy historically not gated on local `deno check`. |
| Scope containment (no Stripe/S4/invoice/follow-up/TIS in S3 diff) | **PASS** (13 paths under S3 merge; money-loop quote/job only) |

---

## Hostinger frontend artifact

| Field | Value |
| --- | --- |
| Build command | `npm run build` in `command-center` (production `.env` + secret scan + `build-info`) |
| Built from tip | `5cd7360aceb5492985cea6f3ff56253e5165bbea` |
| `dist/build-info.json` commitSha | `5cd7360aceb5492985cea6f3ff56253e5165bbea` |
| environment | `production` |
| releaseId | `v2.5.0` |
| migrationVersion (info) | `20260721200000` (already live; info only) |
| Secret scan | **OK** (0 findings) |
| `verify-build-info --require-release` | **PASSED** |
| Deploy dry-run | **plan OK** — `app.bhfos.com/`, 84 files, sha match |
| Lifecycle route in app | `estimates/p1-lifecycle/:id` → `MlP1S2QuoteLifecyclePage` |
| Dist chunks present | `MlP1S2QuoteLifecyclePage-*.js`, `ProposalList-*.js` |

### Frontend source pins (same tip)

| Path | SHA-256 (LF git blob) |
| --- | --- |
| `src/services/mlP1S2QuoteLifecycleService.js` | `2FF83F238B0D905F463C43FE7A1BEDDB654A82441B66E230B36874C7EF8EDFE3` |
| `src/pages/crm/MlP1S2QuoteLifecyclePage.jsx` | `0563413C05BAF9A4CDCF59BB404FD931835B0DFD7424BAF4A772AB802D1198D9` |
| `src/pages/crm/proposals/ProposalList.jsx` | `9D07384D9F62621AF4C47326DFAE2634392C58FE2B70E939AA4C29C4F74E4338` |

Client calls `ml_p1_s2_quote_lifecycle` / `ml_p1_s2_quote_approve_public` only; surfaces `jobCreated`/`jobId`; ProposalList Accept navigates to lifecycle (no `quote-update-status` accept).

---

## Pre-deploy evidence executed

| Check | Result |
| --- | --- |
| Main tip confirmed | `5cd7360…` |
| S1+S2+S3 unit suites | **51/51 PASS** |
| Alternate writer source guards | **PASS** (in S3 suite) |
| Production env keys present (values not displayed) | `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` **PRESENT**; `HOSTINGER_API_TOKEN` **PRESENT** in `.env.local`; no `VITE_*OPENAI*` |
| Production frontend build + secret scan | **PASS** |
| Hostinger dry-run | **PASS** |
| SPA route / chunk smoke (dist) | **PASS** |
| `auto_create_job_on_quote_acceptance` | App does **not** read/flip the flag; DB writer is RPC-only; flag must remain **false** (do not enable) |
| Migration re-apply | **Not performed / not authorized** |

---

## Rollback

| Surface | Procedure |
| --- | --- |
| **Edge Functions** | Redeploy prior function bodies from main parent tip `ef2470715ddf90c34a77416183eb5b2421bd6373` for the same three function names only (or restore last known-good deploy archive). DB writer remains; old Edge without WRITER_REQUIRED must not be restored without accepting approve-without-job risk — prefer keep fail-closed Edge if rolling back product behavior. |
| **Hostinger** | Redeploy prior production artifact whose live `build-info.json` `commitSha` = `ef2470715ddf90c34a77416183eb5b2421bd6373` (pre-S3) via Hostinger static deploy CLI with Founder auth. |
| **Database** | **Do not** roll back S3 migration under this deploy packet (separate Founder auth). |

---

## Required post-deploy verification

1. `https://app.bhfos.com` → HTTP 200  
2. Live `/build-info.json` `commitSha` = `5cd7360aceb5492985cea6f3ff56253e5165bbea`  
3. Auth session healthy  
4. Lifecycle route loads (`estimates/p1-lifecycle/:id`)  
5. Customer public approve → exactly one linked job  
6. Office break-glass approve → exactly one linked job  
7. Replay → same `job_id`  
8. Concurrent approve → one job (best-effort controlled test)  
9. Approve+job same transaction (fail address → quote stays issued)  
10. Paid status does not create job  
11. `quote-update-status` / Kanban accept / estimates create / client job insert with `quote_id` cannot create quote-linked jobs  
12. Lifecycle UI shows created / linked / failure  
13. `npm run verify:live-secrets` clean  
14. No new runtime/DB error spike  
15. R-S1-01 + Slice 2 draft RLS still intact (I2 spot-check optional)

---

## Exact Founder A3 authorization line (copy/paste)

> Authorize ML-P1 Slice 3 **production deploy only** from main  
> `5cd7360aceb5492985cea6f3ff56253e5165bbea` to:  
> (1) Supabase Edge Functions on project `wwyxohjnyqnegzbxtuxs` — deploy **only**  
> `public-quote-approve`, `quote-update-status`, and `kanban-move` from that tip  
> (SHA-256s `B03DAD1A…` / `3D11DBD2…` / `EB00F3A8…` per Decision Packet); and  
> (2) Hostinger static site `app.bhfos.com` — production `npm run build` artifact whose  
> `dist/build-info.json` `commitSha` equals `5cd7360aceb5492985cea6f3ff56253e5165bbea`,  
> then deploy via approved Hostinger CLI.  
> Migration already applied — **do not reapply**.  
> Require post-deploy verification per `ML-P1_SLICE3_DEPLOY_DECISION_PACKET.md`.  
> On failure, roll back Edge and/or Hostinger per packet; do not reverse DB without new auth.  
> Does **not** authorize Slice 4, Stripe, invoices, autonomous follow-up, TIS, or G2.3 reopen.

---

## Hard locks

No migration re-apply · no Slice 4 · no Stripe · no invoices · no autonomous follow-up · no TIS · no G2.3

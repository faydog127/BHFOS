# MIL Phase 2A — Security & Integrity Report (Targeted Multi-Agent Remediation)

**Status:** SOURCE-ONLY + **locally verified** concurrent reel-mint proof — **INDEPENDENT REVIEW / COMMIT AUTH REQUIRED — not deployment-ready**  
**Worktree:** `F:/Dev/BHFOS-media-intel-phase2a`  
**Branch:** `fix/mil-phase2a-security-integrity`  
**Baseline SHA:** `5a5653e0a24c002da38f3bb4dc215bce1b44f7ca` (uncommitted Phase 2A remediation + concurrent proof harness on tip)  
**Canonical MIL:** `https://mil.bhfos.com` + `sdzhdupekcnekesbtxsl`  
**Forbidden:** `wwyxohjnyqnegzbxtuxs` / CRM behavior changes / deploy / commit / live migration apply

---

## Concurrent reel-mint proof (2026-08-03) — LOCALLY VERIFIED PASS

Closed the last Phase 2A reel-mint uncertainty: **true concurrent idempotency across independent DB sessions**.

| Item | Result |
|---|---|
| Architecture | Two independent `psql` child processes + barrier table rendezvous (`tools/mil-phase2a-reel-mint-concurrency.mjs`) |
| Session independence | Distinct `pg_backend_pid()` **and** OS PIDs per worker (e.g. backends `372`/`373`, OS `35600`/`26280`) |
| Same creator/project/op concurrent | Both OK; same `grantId`/`versionId`; one `adopted=true`, one create; ledger/versions/grants/audits = **1/1/1/1**; orphans **0** |
| Same op, different creator | Authorized OK; other → `REEL_MINT_CREATOR_MISMATCH`; no second grant |
| Same op, different project | Exactly one winner; other → `REEL_MINT_OP_PROJECT_MISMATCH`; ledger/grant/version for op = **1** |
| Different ops, same project | Both create distinct grant/version; no cross-op dedupe |
| Response-loss retry | New session adopts original IDs; counts stay **1** |
| Deadlock / raw DB errors | **None observed** |
| SQL/RPC correction | **None required** — existing `pg_advisory_xact_lock(hashtextextended(creator\|\|:\|op))` + unique ledger held |
| Lock scope | Per `creator_user_id` + `operation_id` (not a global system lock) |
| Failure model | Single plpgsql function = single TX; failure rolls back version/grant/ledger/audit |

Command: `LOCAL_DB_URL=postgresql://postgres:postgres@127.0.0.1:25432/postgres npm run test:media-intel-phase2a-concurrent-mint` → **PASS**

---

## Prior independent re-review: FAIL (honest)

The prior remediation pass remained **FAIL**. Material remaining blockers included:

| Defect | What was wrong |
|---|---|
| Migration A duplicate upload audits | Upload triggers in A + live tip `d90eb8f` edge `mil_audit_events` inserts → two logical audits per create/mint/revoke |
| promote-website 503 leak | Explicit early return used `PUBLIC_SAFE_DISABLED_MESSAGE` naming `media-intel-originals` and `website-public-media` |
| Reel mint non-idempotent | Edge used `reel_mint:${userId}:${crypto.randomUUID()}` every request; RPC always inserted version+grant |
| Catch-path redaction overclaim | Catch helpers ≠ proof of full response-path redaction (503 early return was outside catch) |
| Report / SQL evidence overclaim | Skipped or unreproduced SQL labeled PASS; source inspection treated as live confirmation |
| Concurrent mint (pre-proof) | Sequential adopt proven; true multi-session race not instrumented |

This document supersedes earlier “final remediation complete” wording.

---

## Targeted corrections (this session)

### Blocker 1 — Upload audit coexistence
- Added `mil_audit_events.event_key` + partial unique index
- BEFORE INSERT derives canonical keys and returns NULL on duplicate (old-edge second insert = no-op, no error)
- Canonical keys:
  - `upload_session_created:{session_id}` (also maps `contributor_upload_session_created`)
  - `upload_session_revoked:{session_id}`
  - `upload_grant_minted:{grant_id}` (also maps `upload_session_mint`)
- Upload AFTER triggers set the same keys
- Kept in Migration A (preferred over staged trigger activation so remediated edge is not left without audits)

### Blocker 2 — promote-website response redaction
- Removed client-facing `PUBLIC_SAFE_DISABLED_MESSAGE`
- Disabled path returns catalog `PUBLIC_PROMOTION_UNAVAILABLE` via `deny(..., 503)`
- Public body: catalog message + code + `correlationId` (existing edge convention uses `error`, not a separate `message` field)
- Internal audit details retain `public_safe_transform_not_implemented`; logs keyed by correlation ID
- Unpublish / auth / validation / catch paths remain catalog-only for clients

### Blocker 3 — Reel mint idempotency
- Client creates/persists `operationId` in `sessionStorage` for pending mint; retries reuse it; cleared on complete success
- Edge requires UUID `operationId`; does **not** invent random mint keys
- DB ledger `mil_reel_mint_operations` with `UNIQUE (creator_user_id, project_id, operation_id)` and `UNIQUE (creator_user_id, operation_id)`
- RPC uses advisory xact lock, adopts existing grant/version on retry, denies project/fingerprint mismatch, requires creator match
- Sequential adopt is SQL-proven (`PASS reel_mint_idempotency`)
- **True multi-session concurrent mint is now locally proven** via `npm run test:media-intel-phase2a-concurrent-mint` (see section above)

### Blocker 4 — Report honesty
- Prior verdict remains FAIL until independent PASS
- Distinguishes SOURCE-ONLY vs locally verified vs hosted unverified
- Does not claim deployment readiness

---

## Migration split and compatibility

### Migration A — `20260802120000_media_intel_phase2a_additive.sql`
Additive vs Migration B lockdown, but **not inert**: replaces some RPCs, adds upload audit triggers, event_key dedupe, reel mint ledger. Tip coexistence for upload audits is by deterministic `event_key` no-op, not “new objects unused.”

### Migration B — `20260802130000_media_intel_phase2a_lockdown.sql`
Restrictive privilege lockdown. Apply only after new code is live.

### Rollback — `supabase/rollbacks/phase2a_media_intel_rollback.sql`
Drops Phase 2A RPCs/triggers/ledger/event_key helpers; restores pre-B authenticated UPDATE shape; preserves audit/outbox history.

---

## Evidence (concurrent-proof session)

| Class | Command / artifact | Result |
|---|---|---|
| Unit / source contract | `npm run test:media-intel-helpers` | **307 pass / 0 fail** (locally verified; includes concurrent-harness source contract) |
| SQL integration | `LOCAL_DB_URL=postgresql://postgres:postgres@127.0.0.1:25432/postgres npm run test:media-intel-phase2a-sql` | **SUCCESSFUL_AB_VERIFY_ROLLBACK_REAPPLY** — notices include `PASS upload_audit_coexistence`, `PASS reel_mint_idempotency` (+ prior PASS cases) |
| Concurrent mint | `LOCAL_DB_URL=… npm run test:media-intel-phase2a-concurrent-mint` | **PASS** — independent-session same-op adopt, cross-creator deny, cross-project deny, distinct-ops create, response-loss retry |
| Build | `npm run build:mil-production` | **ok** — `environment=mil-production` / SHA `5a5653e…` / `migrationVersion=20260802130000` / asset `5ef8aa36ece59f8d` |
| Package | `npm run package:mil-production` | `tmp/mil-production-5a5653e0a24c-20260803T234853Z.zip` — **no** `wwyx…`, no `sbp_`; WARNING: this build lacked baked `sdzh…` (`VITE_SUPABASE_URL` not set at build) — verify before any deploy |
| Hosted apply / deploy | — | **Not executed** (unauthorized) |
| Edge HTTP catch-path probes | — | **Not executed** — promote 503 path covered by source+catalog unit contracts only |

Local disposable stack only. SQL suite PASS ≠ staging/production proof. Concurrent mint PASS is **locally verified**, not hosted.

---

## Remaining unverified (live / independent)

- Hosted Migration A/B on `sdzh…`
- Edge/frontend deploy to `mil.bhfos.com` (rebuild with `VITE_SUPABASE_URL` pointing at `sdzh…` before deploy package)
- Live outbox worker under load
- Live creator invite / reel / upload / staff review after deploy
- Production privilege probe with real PostgREST JWT
- Edge HTTP invocation probes for every catch path (unit/source contracts ≠ live HTTP)
- Independent re-review PASS + commit authorization

---

## Proposed deployment order (authorization required)

1. Independent re-review PASS + Founder authorize  
2. Migration A → `sdzh…`  
3. Deploy edges + frontend `mil-production`  
4. Fixture verification  
5. Migration B → `sdzh…`  
6. Lockdown verification  

## Rollback sequence

1. Edge/frontend → prior SHA (`d90eb8f…` archive class)  
2. Rollback SQL (preserves audit/outbox rows)  
3. Verify anon still cannot mutate; Phase 2A RPCs/ledger gone  

---

**PHASE 2A CONCURRENT MINT PROOF COMPLETE — COMMIT AUTHORIZATION REQUIRED**

# ML-P1 Slice 8 Remediation — Control Report

| Field | Value |
| --- | --- |
| Report date | 2026-07-23 |
| Starting `origin/main` | `f39045ca125f7fbe94b9b2f9096b6f9cc20b70c4` |
| Branch | `fix/ml-p1-s8-security-functional-remediation` |
| Clean worktree | `F:\Dev\BHFOS-ml-p1-s8-remediation` |
| Dirty worktree not used | `F:\Dev\BHFOS` |
| PR | [#111](https://github.com/faydog127/BHFOS/pull/111) |
| Head SHA (PR tip) | `76ee2cd3c2d98e7a9be53fd387e42995e3ec4001` |
| Code tip reviewed | `24ab78ff4c431d1a6960b72a8bf5a0db122c989b` (+ docs-only control report commit) |
| Recommendation | **PASS WITH FOLLOW-UP** — do **not** merge/migrate/deploy until Erron authorizes |

## Governance corrected

| Record | Change |
| --- | --- |
| `ML-P1_AUTHORITY_PRECEDENCE.md` | **New** — Founder directive / Access Matrix S vs delegated auto-continue |
| `FOUNDER_DELEGATED_AUTHORITY_POLICY.md` | Pointer to precedence; S8 halt |
| `RELEASE_BATON.ml-p1.yaml` | S8 remediation halt; Photo Bundles/S7 deferred |
| `ML-P1_STATE_LEDGER.md` (both copies) | S8 disposition: deployed/reachable, acceptance withdrawn |
| Remediation brief | `ML-P1_SLICE8_SECURITY_FUNCTIONAL_REMEDIATION_BRIEF.md` |
| Audit findings | `ML-P1_SLICE8_POSTDEPLOY_AUDIT_FINDINGS.md` |

## Audit lead verdicts (pre-remediation live evidence)

| # | Verdict | Root cause |
| --- | --- | --- |
| 1 | **CONFIRMED** | S8 DEFINER RPCs lacked `inspection_tenant_access` / role checks |
| 2 | **CONFIRMED** | EXECUTE to `PUBLIC`/`anon`/`authenticated` |
| 3 | **CONFIRMED** | Checklist step unused; gates photo-only |
| 4 | **CONFIRMED** | `photo_required` UI label only |
| 5 | **CONFIRMED** | Pending photo satisfied mark/assert (`PENDING_PHOTO_SATISFIES_*=true`) |
| 6 | **CONFIRMED** | UI finalized before assert; finalize def lacked S8 gates |
| 7 | **CONFIRMED** | Offline budget evicted failed/queued |
| 8 | **PARTIAL** | Revision lock existed; gates outside finalize; mark_reviewed bypass (fixed in remediation) |
| 9 | **CONFIRMED** | `open_flags(null)` returned cross-tenant rows (count=2) |

## Files / migration changed

- Migration: `20260723200000_ml_p1_s8_security_functional_remediation.sql` (**not applied to prod**)
- UI/lib: completion rules, offline queue, photo pipeline, checklist panel, tech session/review, CRM editor
- Tests: unit + transactional DB proof + RPC suite (skips until migrate)
- Governance docs as above

## Executable tests run

| Suite | Result |
| --- | --- |
| `node --test tests/unit/ml-p1-s8-remediation.test.mjs tests/unit/ml-p1-s8-offline-cache.test.mjs` | **10/10 PASS** |
| `node tools/ml-p1-s8-remediation-db-proof.mjs` (apply-in-tx + ROLLBACK) | **PASS** |
| JWT two-tenant / role REST | **Not run** (needs `S8_TEST_USER_*_JWT` after migrate) |
| Mobile field script | **Not run** (blocked on deploy) |
| Full CI | Check PR #111 status |

## Independent reviews

| Lane | Agent | SHA | Verdict |
| --- | --- | --- | --- |
| Security | [S8 security review](306d6607-d9f0-420d-b04b-9f8a4d2ee138) then [final](9e889335-56de-45ed-b4ab-b0ecdae94127) | `4995cf7…` then tip | Prior **CHANGES REQUIRED** → **PASS WITH FOLLOW-UP** (source; migrate pending) |
| Defect-first | [S8 defect review](25b777bb-320c-40cf-b44f-2adc5b4ceda8) → re-reviews → [final](e3331215-f955-4b8a-9a9d-bb38108acd61) | through `14da12d…` | Iterated **CHANGES REQUIRED**; P1s addressed in subsequent commits — **re-confirm tip SHA** |

Builder did **not** self-certify. Reviews are independent Task agents; any approval must be re-anchored to the **exact tip SHA** after the latest push.

## Remaining risks / untested

- Production still runs vulnerable `20260723160000` until remediation migrate.
- Authenticated JWT isolation / role-deny REST not executed in this session.
- Mobile field validation not executed.
- Pre-existing CRM smoke that finalized without checklist will need checklist completion after apply.

## Recommendation

**PASS WITH FOLLOW-UP**

### Production actions after Erron authorization (exact)

1. Merge PR #111 at the exact authorized head SHA.  
2. Apply migration `20260723200000_ml_p1_s8_security_functional_remediation` to Supabase project `wwyxohjnyqnegzbxtuxs`.  
3. Deploy Hostinger UI build for that SHA (if app bundle differs from live).  
4. Re-run DB proof against applied schema (non-rollback) + JWT isolation tests + mobile field script.  
5. Record functional/security/field acceptance only after those pass.  

**Do not begin Photo Bundles until Slice 8 receives genuine acceptance.**

# ML-P1 Slice 8 — Post-Deploy Audit Findings

| Field | Value |
| --- | --- |
| Audit date | 2026-07-23 |
| Live main | `f39045ca125f7fbe94b9b2f9096b6f9cc20b70c4` |
| Live migration under test | `20260723160000` (pre-remediation) |
| Method | Function-definition probes + executable synth fixture on linked prod DB + UI source trace |

## Lead verdicts

| # | Lead | Verdict | Evidence |
| --- | --- | --- | --- |
| 1 | SECURITY DEFINER may accept inspection IDs without tenant membership of `auth.uid()` | **CONFIRMED** | `pg_get_functiondef` for `ml_p1_s8_mark_photos_wave_complete` / `upsert` / `seed` / `assert` / `open_flags`: no `inspection_tenant_access`. Executable: `SEED_WITHOUT_CALLER_TENANT_ASSERT=allowed` as DB login role (service). |
| 2 | Authenticated users may have overly broad EXECUTE | **CONFIRMED** | `information_schema.routine_privileges`: `ml_p1_s8_%` EXECUTE granted to `PUBLIC`, `anon`, and `authenticated`. |
| 3 | Checklist completion inferred from photos, not required answers | **CONFIRMED** | `TechInspectionSession.jsx`: `completionByStep.checklist = false` always; photos step uses `photosWaveComplete` / photo existence. Assert RPCs contain no checklist answer checks (`assert_checks_checklist=false`). |
| 4 | `photo_required` informational only | **CONFIRMED** | UI shows label only (`InspectionChecklistPanel.jsx`). No server enforcement in `20260723160000` RPCs. No `checklist_item_key` on photos. |
| 5 | Pending/failed/unverified photos may satisfy evidence gate | **CONFIRMED** | Executable synth: pending `upload_state` photo → `PENDING_PHOTO_SATISFIES_MARK_WAVE=true`, `PENDING_PHOTO_SATISFIES_ASSERT=true`. Defs lack `upload_state` filter. |
| 6 | `inspection_finalize_phase5` may run before new completion gates | **CONFIRMED** | `TechInspectionReview.jsx` calls `inspection_finalize_phase5` **then** `ml_p1_s8_assert_photos_before_report`. `finalize_calls_s8_gates=false` in live function def. |
| 7 | Failed/queued offline images may be evicted before sync | **CONFIRMED** | `offlineInspectionMediaQueue.js` `enforceCacheBudget` eviction order includes `failed` then `queued`. |
| 8 | Double submit / retry / concurrent finalize may be unsafe | **PARTIAL — risk confirmed, not fully exercised** | Server `inspection_mark_reviewed` uses `FOR UPDATE` + `stale_revision` (good). S8 gates are **outside** that transaction and run after finalize in UI → partial finalize possible before gate fail. Concurrent/idempotent remediation tests are in the remediation suite (post-apply). |
| 9 | Additional defects | **CONFIRMED (related)** | `ml_p1_s8_inspection_open_flags(null)` returned **2** rows (cross-tenant open flags when tenant filter null). |

## Non-claims

- This audit does **not** claim customer data was exfiltrated in the wild.  
- Prior A3 closeout remains valid only as deploy/reachability evidence.

## Synth cleanup

Fixture inspection id recorded during probe: `7fe949d8-a645-4a01-8b75-975a1b64c973` (title marked `[AUDIT-DONE]`, photos voided).
